#!/usr/bin/env node
var loge_1 = require('loge');
var yargs = require('yargs');
var server_1 = require('../server');
function main() {
    var argvparser = yargs
        .describe({
        hostname: 'hostname to listen on',
        port: 'port to listen on',
        help: 'print this help message',
        verbose: 'print extra output',
        version: 'print version',
    })
        .boolean(['help', 'verbose', 'version'])
        .alias({ verbose: 'v' })
        .default({
        hostname: '127.0.0.1',
        port: 8080,
    });
    var argv = yargs.argv;
    loge_1.logger.level = argv.verbose ? loge_1.Level.debug : loge_1.Level.info;
    if (argv.help) {
        yargs.showHelp();
    }
    else if (argv.version) {
        console.log(require('../package').version);
    }
    else {
        server_1.default.listen(argv.port, argv.hostname);
    }
}
if (require.main === module) {
    main();
}
