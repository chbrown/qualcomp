import {exec} from 'child_process';
var logger = require('loge');

/** convert(input_filepath: string,
                  output_filepath: string,
                  options: {
                    quality: number,
                    resize?: string,
                  },
                  callback: (error: Error))

Read image at input_filepath and write compressed JPEG to output_filepath.
*/
export function convert(input_filepath, output_filepath, options, callback) {
  var resize_args = options.resize ? `-resize ${options.resize}` : '';
  var command = `convert "${input_filepath}" ${resize_args} TGA:- |
    cjpeg -quality ${options.quality} -outfile "${output_filepath}" -targa`;
  logger.debug(`$ ${command}`);
  exec(command, function(err, stdout, stderr) {
    if (err) {
      logger.error('stdout: %s; stderr: %s', stdout, stderr);
      return callback(err);
    }

    if (stdout) logger.info('stdout: ' + stdout);
    if (stderr) logger.debug('stderr: ' + stderr);
    callback();
  });
}
