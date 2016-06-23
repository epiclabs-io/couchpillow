var gulp = require('gulp');
var changed = require("gulp-changed");
var requireDir = require('require-dir');

//global object to add task functions
task={};

//global object to add helper functions
helper={};

//copies files from src to dest only if the files in src are newer
helper.copyIfChanged = function(src,dest) {
 return gulp.src(src)
  .pipe(changed(dest)) //the changed function "filters" the stream and leaves only changed files
  .pipe(gulp.dest(dest));
} 


// Require all tasks in gulp/tasks, including sub-folders
requireDir('./gulp/tasks', { recurse: true });