/// <reference path="../typings/tsd.d.ts" />

import * as couchbase from "couchbase";

var wait = require("wait.for");

interface IView {
    map: Function | string;
    reduce: Function | string;
}
interface IDesignDocument {
    views: { [viewName: string]: IView }
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

    constructor(connString: string, bucketName: string, password?: string) {
        this.cluster = new couchbase.Cluster(connString);
        this.bucket = this.cluster.openBucket(bucketName, password);
        this.bucket.operationTimeout = 120 * 1000;
        this.manager = this.bucket.manager();
        this.designDocuments = {};

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
        wait.forMethod(this.manager, "upsertDesignDocument", document.name, document.toJSON());

    }


}

function main() {


    let pillow = new Pillow("couchbase://192.168.6.250", "default");


    let view = new View("testView");
    view.map = function (doc: any, meta: any) {
        return meta;
    }

    let doc = new DesignDocument("testdoc");
    doc.pushView(view);
    pillow.pushDesignDocument(doc);

    pillow.saveDesign();







}



wait.launchFiber(main);
