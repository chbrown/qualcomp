/// <reference path="type_declarations/index.d.ts" />
var child_process_1 = require('child_process');
var loge_1 = require('loge');
/**
Read image at input_filepath and write compressed JPEG to output_filepath.
*/
function convert(input_filepath, output_filepath, options, callback) {
    var resize_args = options.resize ? "-resize " + options.resize : '';
    var convert_command = "convert \"" + input_filepath + "\" " + resize_args + " TGA:-";
    var cjpeg_command = "cjpeg -quality " + options.quality + " -outfile \"" + output_filepath + "\" -targa";
    loge_1.logger.debug("$ " + convert_command + " | " + cjpeg_command);
    child_process_1.exec(convert_command + " | " + cjpeg_command, function (err, stdout, stderr) {
        if (err) {
            loge_1.logger.error('stdout: %s; stderr: %s', stdout, stderr);
            return callback(err);
        }
        if (stdout)
            loge_1.logger.info("stdout: " + stdout);
        if (stderr)
            loge_1.logger.debug("stderr: " + stderr);
        callback();
    });
}
exports.convert = convert;
