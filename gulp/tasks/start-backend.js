var gulp = require('gulp');
var server = require('gulp-develop-server');
gulp.task('start-backend', ['build-backend'], function() {
    server.listen({path: 'dist/app.js'}, function(error) {
        if(error)
			console.log("Error: " + error);
    });
});

gulp.task('restart-backend', ['build-backend'], function() {
    server.restart();
});
