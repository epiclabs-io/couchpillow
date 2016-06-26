/// <reference path="../typings/tsd.d.ts" />

import "./utils/loglevelInit";

import * as couchbase from "couchbase";
import * as fs from "fs";
import * as path from "path";
import Promise from "ts-promise";
import * as yargs from "yargs";
import * as loglevel from "loglevel";
import {Pillow} from "./Pillow";

var log = loglevel.getLogger("MAIN");

var argv = yargs
    .alias("c", "changesetsFolder")
    .default({ c: "./changesets" })
    .describe("c", "folder where to scan for changesets.")
    .alias("s", "server")
    .demand("s", "You must provide a connection string, e.g. couchbase://127.0.0.1")
    .describe("s", "Server connection string")
    .alias("b", "bucket")
    .demand("b", "You must provide a bucket name")
    .describe("b", "Bucket name to connect to")
    .alias("p", "password")
    .describe("p", "Password to access the bucket")
    .help('h')
    .alias('h', 'help')
    .argv;


function main() {

    let pillow = new Pillow(argv.changesetsFolder, argv.server, argv.bucket,argv.password);

    pillow.run().then(() => {
        log.info("Pillow finished successfully.");
        process.exit(0);
    }).catch((err) => {
        log.error("Error: " + err.message);
        process.exit(1);
    });

}

main();
