/// <reference path="type_declarations/index.d.ts" />
import {logger} from 'loge';

var http = require('http-enhanced');
var controller = require('./controller');

var server = http.createServer(function(req, res) {
  logger.debug('%s %s', req.method, req.url);
  controller(req, res);
})
.on('listening', function() {
  var address = this.address();
  logger.info('server listening on http://%s:%d', address.address, address.port);
});

export = server;
