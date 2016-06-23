/// <reference path="../typings/tsd.d.ts" />

import * as couchbase from "couchbase";
import * as fs from "fs";
import * as path from "path";
import Promise from "ts-promise";

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




}


class Pillow {

    public cluster: couchbase.Cluster;
    public bucket: couchbase.Bucket;
    public manager: couchbase.BucketManager;
    public designDocuments: { [designDocumentName: string]: DesignDocument };
    public changesetPath: string;

    constructor(changesetPath: string, connString: string, bucketName: string, password?: string) {
        this.cluster = new couchbase.Cluster(connString);
        this.bucket = this.cluster.openBucket(bucketName, password);
        this.bucket.operationTimeout = 120 * 1000;
        this.manager = this.bucket.manager();
        this.designDocuments = {};
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

    public saveDesign() {
        for (let documentName in this.designDocuments) {
            let document = this.designDocuments[documentName];
            if (document.dirty) {
                this.upsertDesignDocument(document)
            }
        }
    }

    public upsertDesignDocument(document: DesignDocument) {
        console.log("Saving " + document.name + " ...")
        //wait.forMethod(this.manager, "upsertDesignDocument", document.name, document.toJSON());

    }

    public run(): Promise<void> {
        return new Promise<void>((resolve, reject) => {

            this.bucket.get("_PillowState", (err: couchbase.CouchbaseError, result: any) => {
                let state: IPillowState;
                if (err.code == 13) {
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
                        var id: any = changeset.id;
                        changeset.id = parseInt(id, 10);
                        if (!isNaN(changeset.id) && typeof changeset.run === "function") {
                            changesets[changeset.id] = changeset;
                        }
                    }
                }

                for (let i = state.lastId + 1; i < changesets.length; i++) {
                    changeset = changesets[i];
                    if (changeset) {
                        changeset.run(this);
                    }
                }

            });


        });
    }


}

function main() {


    let pillow = new Pillow("./changesets", "couchbase://192.168.6.250", "default");

    pillow.run();
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
