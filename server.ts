import {logger} from 'loge';
import * as async from 'async';
import {join} from 'path';
import * as fs from 'fs';
import {parse as parseUrl} from 'url';
import {IncomingForm, File as FormidableFile} from 'formidable';
import Router from 'regex-router';
import {asArray} from 'tarry';
import {exec} from 'child_process';

const http = require('http-enhanced');
const send = require('send');

interface ConvertOptions {
  quality: number | string;
  resize?: string;
}

/**
Read image at input_filepath and write compressed JPEG to output_filepath.
*/
export function convert(input_filepath: string,
                        output_filepath: string,
                        options: ConvertOptions,
                        callback: (error?: Error) => void) {
  var resize_args = options.resize ? `-resize ${options.resize}` : '';
  var convert_command = `convert "${input_filepath}" ${resize_args} TGA:-`;
  var cjpeg_command = `cjpeg -quality ${options.quality} -outfile "${output_filepath}" -targa`;
  logger.debug(`$ ${convert_command} | ${cjpeg_command}`);
  exec(`${convert_command} | ${cjpeg_command}`, (err, stdout, stderr) => {
    if (err) {
      logger.error('stdout: %s; stderr: %s', stdout, stderr);
      return callback(err);
    }

    if (stdout) logger.info(`stdout: ${stdout}`);
    if (stderr) logger.debug(`stderr: ${stderr}`);
    callback();
  });
}


/**
Open a file descriptor for the specified variation of an uploaded image,
executing the conversion to create the variation, if needed.

Note the callback signature is the same as fs.open(...)
*/
function ensureOpenCache(original_filepath: string,
                         cache_filepath: string,
                         options: ConvertOptions,
                         callback: (error: Error, fd?: number) => void) {
  // optimistically open the file at `cache_filepath`
  fs.open(cache_filepath, 'r', (err, fd) => {
    if (err) {
      if (err.code == 'ENOENT') {
        // ENOENT just means that the file doesn't already exist, which isn't fatal
        logger.debug('fs.createReadStream error: %s', err);
        convert(original_filepath, cache_filepath, options, (err) => {
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

/**
Open a file descriptor for an uploaded image, if no variation is specified,
or for the specified variation, using ensureOpenCache, executing the conversion
to create the variation, if needed.

Note the callback signature is the same as fs.open(...)
*/
function ensureOpenImage(original_filepath: string,
                         cache_filepath: string,
                         options: ConvertOptions,
                         callback: (error: Error, fd?: number) => void) {
  if (options.quality || options.resize) {
    ensureOpenCache(original_filepath, cache_filepath, options, callback);
  }
  else {
    // if no variation arguments were specified, we just open the original file
    //    i.e., no need for: fs.link(upload_filepath, cache_filepath, ...);
    fs.open(original_filepath, 'r', callback);
  }
}

var R = new Router();

/** GET /

Serve root index.html page.
*/
R.get(/^\/$/, (req, res) => {
  send(req, 'index.html', {root: __dirname}).pipe(res);
});

/** GET /build/*

Serve static resource
*/
R.get(/^\/build\/([^?]+)(\?|$)/, (req, res: any, m) => {
  send(req, m[1], {root: join(__dirname, 'build')})
  .on('error', (err) => {
    res.status(err.status || 500).die('send error: ' + err.message);
  })
  .pipe(res);
});

/** GET /images

Get uploaded images.
*/
R.get(/^\/images$/, (req, res: any) => {
  fs.readdir(join(__dirname, 'uploads'), (err, filenames) => {
    if (err) return res.die(err);
    // stupid Mac OS X with your .DS_Store files
    filenames = filenames.filter(filename => !/^\./.test(filename));

    async.map(filenames, (filename, callback) => {
      var filepath = join(__dirname, 'uploads', filename);
      fs.stat(filepath, (err, stats) => {
        callback(err, {
          filename: filename,
          filepath: filepath,
          stats: stats,
        });
      });
    }, (err, uploads) => {
      if (err) return res.die(err);
      res.json(uploads);
    });
  });
});

/** POST /images

Upload new image.
*/
R.post(/^\/images$/, (req, res: any, m) => {
  var form = new IncomingForm(); // {multiples: true}
  form.multiples = true;
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
  form.parse(req, (err, fields, formFiles) => {
    if (err) return res.die(err);
    // logger.info('files: %j', files);
    var files = asArray(formFiles['file']);
    async.map(files, (file, callback) => {
      var filename = file.name;
      var filepath = join(__dirname, 'uploads', file.name);

      // copy from the temporary path
      fs.link(file.path, filepath, (err) => {
        if (err) return res.die(err);
        // return the same output that GET /images returns
        fs.stat(filepath, (err, stats) => {
          callback(err, {
            filename: filename,
            filepath: filepath,
            stats: stats,
          });
        });
      });
    }, (err, uploads) => {
      if (err) return res.die(err);
      res.json(uploads);
    });
  });

});

/** GET /images/:filename.jpg

  ?quality: number
    cjpeg encoder quality argument
  &resize: string
    ImageMagick convert resize argument

*/
R.get(/^\/images\/([^?]+)(\?.+|$)/, (req, res: any, m) => {
  var urlObj = parseUrl(req.url, true);
  var options = urlObj.query;

  // TODO: fix the security issue here with accessing paths higher than
  // __dirname/uploads by sticking `../` parent directories in m[1]
  var upload_filepath = join(__dirname, 'uploads', m[1]);
  var cache_filepath = join(__dirname, 'cache', m[1] + m[2]);

  ensureOpenImage(upload_filepath, cache_filepath, urlObj.query, (err, fd) => {
    if (err) return res.die('Could not prepare image: ' + cache_filepath);
    // res.setHeader('Expires', );
    fs.fstat(fd, (err, stats) => {
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
R.head(/^\/images\/([^?]+)(\?.+|$)/, (req, res: any, m) => {
  var urlObj = parseUrl(req.url, true);
  var options = urlObj.query;

  // TODO: fix the security issue here with accessing paths higher than
  //   __dirname/uploads by sticking `../` parent directories in m[1] and/or m[2]
  var filepath = (options.quality || options.resize) ?
    join(__dirname, 'cache', m[1] + m[2]) : join(__dirname, 'uploads', m[1]);

  fs.stat(filepath, (err, stats) => {
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

const server = http.createServer((req, res) => {
  var started = Date.now();
  res.on('finish', () => {
    logger.info('%s %s [%d ms]', req.method, req.url, Date.now() - started);
  });
  R.route(req, res);
})
.on('listening', () => {
  const address = server.address();
  logger.info('server listening on http://%s:%d', address.address, address.port);
});

export default server;
