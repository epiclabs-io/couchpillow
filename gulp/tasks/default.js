var gulp = require('gulp');
var config = require('../../gulpconfig.js');

gulp.task('default', ['start-backend'], function() {
    gulp.watch(config.backend.sourceTsFiles, ['restart-backend']);
});
