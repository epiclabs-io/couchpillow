/// <reference path="../typings/tsd.d.ts" />

import "./utils/loglevelInit";

import * as couchbase from "couchbase";
import * as fs from "fs";
import * as path from "path";
import Promise from "ts-promise";
import * as loglevel from "loglevel";

import {Pillow} from "./Pillow";




function main() {

    let pillow = new Pillow("./changesets", "couchbase://192.168.6.250", "default");

    pillow.run().then(() => {
        console.log("Pillow finished successfully.");
    })

}

main();
