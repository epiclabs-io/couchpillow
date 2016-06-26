/// <reference path="../typings/tsd.d.ts" />

import * as couchbase from "couchbase";
import * as fs from "fs";
import * as path from "path";
import Promise from "ts-promise";
import * as loglevel from "loglevel";
import {View} from "./View";
import {DesignDocument} from "./DesignDocument";

var log = loglevel.getLogger("PILLOW");

interface IChangeset {
    id: number,
    design: (pillow: Pillow) => void,
    run: (pillow: Pillow) => void
}

interface IPillowState {
    version: string,
    lastId: number,
    lastUpdated: Date
}

export class Pillow {

    public cluster: couchbase.Cluster;
    public bucket: couchbase.Bucket;
    public manager: couchbase.BucketManager;
    public designDocuments: { [designDocumentName: string]: DesignDocument };
    public documents: { [documentName: string]: any }
    public changesetPath: string;

    public done = new Function();
    public error = new Function();
    public log:Log;

    constructor(changesetPath: string, connString: string, bucketName: string, password?: string) {
        this.cluster = new couchbase.Cluster(connString);
        this.bucket = this.cluster.openBucket(bucketName, password);
        this.bucket.operationTimeout = 120 * 1000;
        this.manager = this.bucket.manager();
        this.designDocuments = {};
        this.documents = {};
        this.changesetPath = changesetPath;

    }

    public readChangesets(): string[] {
        let files = fs.readdirSync(this.changesetPath);
        let match = /\.js$/;
        log.info("Loading changesets...");
        //keep only .js files
        files = files.filter((value) => {
            return match.test(value);
        });
        log.info("Found %s files.", files.length);
        return files;
    }


    public pushDesignDocument(document: DesignDocument) {
        this.designDocuments[document.name] = document;
    }

    private saveDesign(): Promise<number> {

        return new Promise<number>((resolve, reject) => {
            var count = 0;
            if (Object.keys(this.designDocuments).length == 0) {
                resolve(-1);
                return;
            }
            var totalChanges: number = 0;

            var callback = (err: any, result: any) => {
                if (err)
                    reject(err);
                else {
                    count--;
                    if (count == 0)
                        resolve(totalChanges);
                }
            }

            for (let documentName in this.designDocuments) {
                let document = this.designDocuments[documentName];
                if (document.dirty) {
                    count++;
                    this.manager.upsertDesignDocument(document.name, document.toJSON(), callback);
                }
            }
            totalChanges = count;
            if (totalChanges == 0)
                resolve(0);
        });
    }

    public run(): Promise<void> {
        return new Promise<void>((resolve, reject) => {

            this.bucket.get("_PillowState", (err: couchbase.CouchbaseError, result: any) => {
                let state: IPillowState;
                if (err && err.code == 13) {
                    state = { version: "1.0", lastId: -1, lastUpdated: null };
                }
                else if (err) {
                    reject(new Error(err.message));
                    return;
                }
                else {
                    state = result.value;
                }

                let files = this.readChangesets();
                let changesets: IChangeset[] = [];
                let changeset: IChangeset;
                for (let i = 0; i < files.length; i++) {
                    let file = files[i];
                    if (file) {
                        changeset = require(path.resolve(this.changesetPath + "/" + file));
                        let id: any = changeset.id;
                        changeset.id = parseInt(id, 10);
                        if (!isNaN(changeset.id) && typeof changeset.run === "function") {
                            changesets[changeset.id] = changeset;
                        }
                    }
                }

                let id = state.lastId;

                this.done = () => {
                    if (id != state.lastId) {
                        log.info("Saving Design Document changes for changeset #%s ...", id);
                    }

                    this.saveDesign().then((numChanges) => {
                        if (numChanges > -1) {
                            log.info("Processed %s Design Document changes", numChanges);
                        }

                        let numdocs = Object.keys(this.documents).length;
                        if (numdocs > 0)
                            log.info("Saving %s documents for changeset %s", numdocs, id);

                        this.saveDocuments().then((numdocs) => {
                            if (numdocs > 0)
                                log.info("Saved %s documents for changeset %s", numdocs, id);

                            id++;
                            if (id >= changesets.length) {
                                state.lastId = id - 1;
                                state.lastUpdated = new Date();
                                this.bucket.upsert("_PillowState", state, (err: couchbase.CouchbaseError, result: any) => {
                                    if (err) {
                                        reject(new Error(err.message));
                                    } else {
                                        resolve(null);
                                    }
                                });
                            }
                            else {

                                log.info("Processing changeset %s", id);
                                this.log=loglevel.getLogger("CHANGESET" + id + "-DESIGN");
                                changesets[id].design(this);
                                this.log=loglevel.getLogger("CHANGESET" + id + "-RUN");
                                changesets[id].run(this);

                            }
                        }).catch((err) => {
                            log.error("Error saving documents of changeset %s", id);
                        });

                    }).catch((err) => {
                        log.error("Error saving design of changeset %s", id);
                    });
                }

                this.error = (err: Error) => {
                    reject(err);
                }

                //initialize design 

                for (let i = 0; i <= state.lastId; i++) {
                    this.log=loglevel.getLogger("CHANGESET" + i + "-DESIGN");
                    changesets[i].design(this);
                }

                for (let docName in this.designDocuments) {
                    this.designDocuments[docName].clean();
                }

                this.done();

            });
        });
    }

    public pushDocument(id: string, obj: any | string) {

        if (typeof obj === "string") {
            obj = JSON.parse(fs.readFileSync(obj, "utf8"));
        }

        if (typeof obj !== "object")
            throw new Error("Must provide either a path name to a json file or an object");

        this.documents[id] = obj;
    }

    public pushDocumentWithId(obj: any | string, idKey: string = "id") {
        if (typeof obj === "string") {
            obj = JSON.parse(fs.readFileSync(obj, "utf8"));
        }

        if (typeof obj !== "object")
            throw new Error("Must provide either a path name to a json file or an object");

        let id = obj[idKey];
        this.pushDocument(id, obj);

    }

    private saveDocuments(): Promise<number> {
        return new Promise<number>((resolve, reject) => {
            let count = Object.keys(this.documents).length;

            if (count == 0) {
                resolve(0);
                return;
            }


            let upsertCallback = (err: couchbase.CouchbaseError, result: any) => {
                if (err) {
                    this.documents = {};
                    reject(new Error(err.message));
                    return;
                }
                count--;
                if (count == 0) {
                    count = Object.keys(this.documents).length;
                    this.documents = {};
                    resolve(count);
                }
            }


            for (let documentName in this.documents) {
                let doc = this.documents[documentName];

                this.bucket.upsert(documentName, doc, upsertCallback);
            }

        });
    }
    
    public createView(name: string, map?: Function | string, reduce?: Function | string): View{
        return new View(name,map,reduce);
    }
    
    public createDesignDocument(name: string):DesignDocument{
        return new DesignDocument(name);
    }


}