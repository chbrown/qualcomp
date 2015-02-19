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

/** ensureOpenCache(original_filepath: string,
                    cache_filepath: string,
                    options: {
                      quality: string,
                      resize?: string,
                    },
                    callback: (error: Error, fd: number))

Open a file descriptor for the specified variation of an uploaded image,
executing the conversion to create the variation, if needed.

Note the callback signature is the same as fs.open(...)
*/
function ensureOpenCache(original_filepath, cache_filepath, options, callback) {
  // optimistically open the file at `cache_filepath`
  fs.open(cache_filepath, 'r', function(err, fd) {
    if (err) {
      if (err.code == 'ENOENT') {
        // ENOENT just means that the file doesn't already exist, which isn't fatal
        logger.debug('fs.createReadStream error: %s', err);
        cjpeg.convert(original_filepath, cache_filepath, options, function(err) {
          if (err) return callback(err);
          fs.open(cache_filepath, 'r', callback);
        });
      }
      else {
        // other errors ARE fatal
        callback(err);
      }
    }
    else {
      callback(null, fd);
    }
  });
}

/** ensureOpenImage(original_filepath: string,
                    cache_filepath: string,
                    options: {
                      quality: string,
                      resize?: string,
                    },
                    callback: (error: Error, fd: number))

Open a file descriptor for an uploaded image, if no variation is specified,
or for the specified variation, using ensureOpenCache, executing the conversion
to create the variation, if needed.

Note the callback signature is the same as fs.open(...)
*/
function ensureOpenImage(original_filepath, cache_filepath, options, callback) {
  if (options.quality || options.resize) {
    ensureOpenCache(original_filepath, cache_filepath, options, callback);
  }
  else {
    // if no variation arguments were specified, we just open the original file
    //    i.e., no need for: fs.link(upload_filepath, cache_filepath, ...);
    fs.open(original_filepath, 'r', callback);
  }
}


/** GET /images/:filename.jpg

  ?quality: number
    cjpeg encoder quality argument
  &resize: string
    ImageMagick convert resize argument

*/
R.get(/^\/images\/([^?]+)(\?.+|$)/, function(req, res, m) {
  var urlObj = url.parse(req.url, true);
  var options = urlObj.query;

  // TODO: fix the security issue here with accessing paths higher than
  // __dirname/uploads by sticking `../` parent directories in m[1]
  var upload_filepath = path.join(__dirname, 'uploads', m[1]);
  var cache_filepath = path.join(__dirname, 'cache', m[1] + m[2]);

  ensureOpenImage(upload_filepath, cache_filepath, urlObj.query, function(err, fd) {
    if (err) return res.die('Could not prepare image: ' + cache_filepath);
    // res.setHeader('Expires', );
    fs.fstat(fd, function(err, stats) {
      if (err) return res.die('Could not stat image: ' + cache_filepath);

      res.setHeader('Content-Length', stats.size);
      // max-age is specified in seconds
      res.setHeader('Cache-Control', 'max-age=60');
      fs.createReadStream(null, {fd: fd}).pipe(res);
    });
  });
});

/** HEAD /images/:filename.jpg

  ?quality: number
    cjpeg encoder quality argument
  &resize: string
    ImageMagick convert resize argument

*/
R.head(/^\/images\/([^?]+)(\?.+|$)/, function(req, res, m) {
  var urlObj = url.parse(req.url, true);
  var options = urlObj.query;

  // TODO: fix the security issue here with accessing paths higher than
  //   __dirname/uploads by sticking `../` parent directories in m[1] and/or m[2]
  var filepath = (options.quality || options.resize) ?
    path.join(__dirname, 'cache', m[1] + m[2]) : path.join(__dirname, 'uploads', m[1]);

  fs.stat(filepath, function(err, stats) {
    if (err) {
      res.statusCode = 404;
      res.setHeader('X-Message', 'File not found "' + filepath + '"');
      res.end();
    }
    else {
      res.setHeader('X-Created', stats.ctime);
      res.setHeader('Last-Modified', stats.mtime);
      res.setHeader('Content-Length', stats.size);
      res.end();
    }
  });
});

module.exports = R.route.bind(R);
