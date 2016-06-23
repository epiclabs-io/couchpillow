var argv = require('yargs').argv;
var gutil = require('gulp-util');
var srcbase = "./backend";
var dist = "./dist";
var debug = "./debug";

gutil.log(gutil.colors.bgBlack("             "));
gutil.log(gutil.colors.bgBlack.bold("  " + gutil.colors.white("epic") + gutil.colors.yellow(">") + gutil.colors.green("labs") + "  "));
gutil.log(gutil.colors.bgBlack("             "));
gutil.log("Deployment folder: " + gutil.colors.blue(dist));

module.exports = {
  "general": {
    "dist": dist
  },
  "backend": {
    "sourceTsFiles": ["backend/**/*.ts", "!node_modules/**", "!frontend/**"]
  },
  "typescript": {
    "sourcefiles": [srcbase + "/**/*.ts"],
    "customtypings": srcbase + "/customtypings/**/*.ts",
    "outputfilename": "index.ts.js",
    "debugfilename": "../../" + debug + "/output.debug.js",
    "debugfolder": srcbase + "/ts",
    "dist": dist + "/js/"
  }
};
