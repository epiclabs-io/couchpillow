/// <reference path="../typings/tsd.d.ts" />

import * as couchbase from "couchbase";
import * as fs from "fs";
import * as path from "path";
import Promise from "ts-promise";
import * as loglevel from "loglevel";

//var wait = require("wait.for");

interface IView {
    map: Function | string;
    reduce: Function | string;
}
interface IDesignDocument {
    views: { [viewName: string]: IView }
}

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

class View {
    private _map: string;
    private _reduce: string;
    public name: string;
    public dirty: boolean;

    constructor(name: string, map?: Function | string, reduce?: Function | string) {
        this.name = name;
        this.map = map;
        this.reduce = reduce;
        this.dirty = true;
    }


    get map(): Function | string {
        return this._map;
    }

    set map(func: Function | string) {
        this._map = func ? func.toString() : null;
        this.dirty = true;
    }

    get reduce(): Function | string {
        return this._reduce;
    }

    set reduce(func: Function | string) {
        this._reduce = func ? func.toString() : null;
        this.dirty = true;
    }

    public toJSON() {
        var obj = {};
        if (this._map)
            obj["map"] = this._map;
        if (this._reduce)
            obj["reduce"] = this._reduce;
        return obj;
    }
    public clean() {
        this.dirty = false;
    }

}

class DesignDocument {
    public views: { [viewName: string]: View }
    public dirty_: boolean = false;
    public name: string;

    constructor(name: string) {
        this.views = {};
        this.name = name;
    }

    public pushView(view: View) {
        this.views[view.name] = view;
        this.dirty_ = true;
    }

    public removeView(name: string) {
        delete this.views[name];
        this.dirty_ = true;

    }


    get dirty(): boolean {
        let d = this.dirty_;
        for (let viewName in this.views) {
            if (d)
                break;
            d = d || this.views[viewName].dirty;
        }

        return d;
    }

    public toJSON() {
        let views = {};
        for (let viewName in this.views) {
            views[viewName] = this.views[viewName].toJSON();
        }

        return { views: views }

    }

    public clean() {
        for (let viewName in this.views) {
            this.views[viewName].clean();
        }
    }




}


class Pillow {

    public cluster: couchbase.Cluster;
    public bucket: couchbase.Bucket;
    public manager: couchbase.BucketManager;
    public designDocuments: { [designDocumentName: string]: DesignDocument };
    public documents: { [documentName: string]: any }
    public changesetPath: string;

    public done = new Function();
    public error = new Function();

    public View = View;
    public DesignDocument = DesignDocument;

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
        console.log("Loading changesets...");
        //keep only .js files
        files = files.filter((value) => {
            return match.test(value);
        });

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
                        console.log("Saving Design Document changes for changeset #%s ...", id);
                    }

                    this.saveDesign().then((numChanges) => {
                        if (numChanges > -1) {
                            console.log("Processed %s Design Document changes", numChanges);
                        }
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

                            console.log("Processing changeset %s", id);
                            changesets[id].design(this);
                            changesets[id].run(this);

                        }
                    }).catch((err) => {
                        console.log("Error saving design of changeset %s", id);
                    });
                }

                this.error = (err: Error) => {
                    reject(err);
                }

                //initialize design 

                for (let i = 0; i <= state.lastId; i++) {
                    changesets[i].design(this);
                }

                for (let docName in this.designDocuments) {
                    this.designDocuments[docName].clean();
                }

                this.done();

            });
        });
    }

    pushDocument(id: string, obj: any | string) {

        if (typeof obj === "string") {
            obj = JSON.parse(fs.readFileSync(obj, "utf8"));
        }

        if (typeof obj !== "object")
            throw new Error("Must provide either a path name to a json file or an object");

        this.documents[id] = obj;
    }

    pushDocumentWithId(obj: any | string, idKey: string = "id") {
        if (typeof obj === "string") {
            obj = JSON.parse(fs.readFileSync(obj, "utf8"));
        }

        if (typeof obj !== "object")
            throw new Error("Must provide either a path name to a json file or an object");

        let id = obj[idKey];
        this.pushDocument(id, obj);

    }

    saveDocuments(): Promise<number> {
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


}

function main() {


    let pillow = new Pillow("./changesets", "couchbase://192.168.6.250", "default");

    pillow.run().then(() => {
        console.log("Pillow finished successfully.");
    })
    /*
    
        let view = new View("testView");
        view.map = function (doc: any, meta: any) {
            return meta;
        }
    
        let doc = new DesignDocument("testdoc");
        doc.pushView(view);
        pillow.pushDesignDocument(doc);
    
        pillow.saveDesign();
    
    */





}


main();

//wait.launchFiber(main);
