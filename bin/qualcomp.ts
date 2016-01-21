#!/usr/bin/env node
import {logger, Level} from 'loge';
import * as yargs from 'yargs';
import server from '../server';

function main() {
  let argvparser = yargs
    .describe({
      hostname: 'hostname to listen on',
      port: 'port to listen on',
      help: 'print this help message',
      verbose: 'print extra output',
      version: 'print version',
    })
    .boolean(['help', 'verbose', 'version'])
    .alias({verbose: 'v'})
    .default({
      hostname: '127.0.0.1',
      port: 8080,
    });

  let argv = yargs.argv;
  logger.level = argv.verbose ? Level.debug : Level.info;

  if (argv.help) {
    yargs.showHelp();
  }
  else if (argv.version) {
    console.log(require('../package').version);
  }
  else {
    server.listen(argv.port, argv.hostname);
  }
}

if (require.main === module) {
  main();
}
