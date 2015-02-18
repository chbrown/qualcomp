var async = require('async');
var path = require('path');
var send = require('send');
var fs = require('fs');
var url = require('url');
var formidable = require('formidable');

var logger = require('loge');
var Router = require('regex-router');

var cjpeg = require('./cjpeg');

var R = new Router(function(req, res) {
  res.status(404).die('No resource at: ' + req.url);
});

R.get(/^\/$/, function(req, res, m) {
  req.url = '/ng/index.html';
  R.route(req, res);
});

R.any(/^\/(static|ng)\/([^?]+)(\?|$)/, function(req, res, m) {
  var root = path.join(__dirname, m[1]);
  send(req, m[2], {root: root})
    .on('error', function(err) {
      res.status(err.status || 500).die('send error: ' + err.message);
    })
    .pipe(res);
});

/** GET /images

Get uploaded images.
*/
R.get(/^\/images$/, function(req, res) {
  fs.readdir(path.join(__dirname, 'uploads'), function(err, filenames) {
    if (err) return res.die(err);
    filenames = filenames.filter(function(filename) {
      // stupid Mac OS X with your .DS_Store files
      return !filename.match(/^\./);
    });

    async.map(filenames, function(filename, callback) {
      var filepath = path.join(__dirname, 'uploads', filename);
      fs.stat(filepath, function(err, stats) {
        callback(err, {
          filename: filename,
          filepath: filepath,
          stats: stats,
        });
      });
    }, function(err, uploads) {
      if (err) return res.die(err);
      res.ngjson(uploads);
    });
  });
});

/** POST /images

Upload new image.
*/
R.post(/^\/images$/, function(req, res, m) {
  var form = new formidable.IncomingForm({multiples: true});
  /** formidable.IncomingForm#parse(request: http.IncomingMessage,
                                    callback: (...))

  The `files` object in the callback is keyed by the field name used by the
  client.

  Depending on the whether the client sent one or multiple files with
  the same field name, the `files` object's values will be a File, or an Array
  of Files. Not the API design I would have chosen, but easy enough to coalesce
  to an Array.

  Example `files` object (where the client sent a single file on with the field
  name "upload":

      {
        "upload": {
          "size": 899791,
          "path": "/var/folders/m8/cq7z9jxj0774qz_3yg0kw5k40000gn/T/upload_c93ff63b9905c00ca7c8b778dab527f0",
          "name": "5th-cat.jpg",
          "type": "image/jpeg",
          "mtime": "2015-02-13T11:34:47.811Z"
        }
      }
  */
  form.parse(req, function(err, fields, files) {
    if (err) return res.die(err);
    // logger.info('files: %j', files);
    files = Array.isArray(files.file) ? files.file : [files.file];
    async.map(files, function(file, callback) {
      var filename = file.name;
      var filepath = path.join(__dirname, 'uploads', file.name);

      // copy from the temporary path
      fs.link(file.path, filepath, function(err) {
        if (err) return res.die(err);
        // return the same output that GET /images returns
        fs.stat(filepath, function(err, stats) {
          callback(err, {
            filename: filename,
            filepath: filepath,
            stats: stats,
          });
        });
      });
    }, function(err, uploads) {
      if (err) return res.die(err);
      res.ngjson(uploads);
    });
  });

});

/** GET /images/:filename.jpg

  ?quality: number
    cjpeg encoder quality argument
  &resize: string
    ImageMagick convert resize argument

*/
R.get(/^\/images\/([^?]+)(\?.+|$)/, function(req, res, m) {
  var urlObj = url.parse(req.url, true);

  var upload_filename = m[1];
  var upload_filepath = path.join(__dirname, 'uploads', upload_filename);
  var full_filename = m[1] + m[2];
  var full_filepath = path.join(__dirname, 'cache', full_filename);

  var stream = fs.createReadStream(full_filepath);
  stream.pipe(res);
  stream.on('error', function(err) {
    logger.error('fs.createReadStream error:', err);

    if (urlObj.query.quality || urlObj.query.resize) {
      // logger.info(`${input_filepath} -> ${output_filepath}`);
      cjpeg.convert(upload_filepath, full_filepath, urlObj.query, function(err) {
        if (err) return res.die('Error in cjpeg.convert:', err);

        // var input_stats = fs.statSync(input_filepath);
        // var output_stats = fs.statSync(output_filepath);

        // logger.info(`recompressed file is ${(100.0 * output_stats.size / input_stats.size).toFixed(2)}% the size of the original`);
        var stream = fs.createReadStream(full_filepath);
        stream.pipe(res);
      });
    }
    else {
      // just copy it as-is
      fs.link(upload_filepath, full_filepath, function(err) {
        if (err) return res.die('Error in fs.link:', err);

        var stream = fs.createReadStream(full_filepath);
        stream.pipe(res);
      });
    }
  });
});

module.exports = R.route.bind(R);
