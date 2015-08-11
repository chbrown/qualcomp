/// <reference path="type_declarations/index.d.ts" />
import {exec} from 'child_process';
import {logger} from 'loge';

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
