var gulp = require('gulp');
var uglify = require('gulp-uglify');
var rename = require('gulp-rename');
var pump = require('pump');
var cleanCSS = require('gulp-clean-css');

gulp.task('minify-js', function (cb) {
  pump([
        gulp.src('src/*.js'),
        uglify(),
        rename({ suffix: '.min' }),
        gulp.dest('dist')
    ],
    cb
  );
});


gulp.task('minify-css', function() {
  return gulp.src('src/*.css')
    .pipe(cleanCSS({compatibility: 'ie8'}))
    .pipe(rename({ suffix: '.min' }))
    .pipe(gulp.dest('dist'));
});

gulp.task('compress', ['minify-css', 'minify-js']);
gulp.task('build',['compress']);
