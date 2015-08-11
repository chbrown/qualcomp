/// <reference path="type_declarations/index.d.ts" />
var loge_1 = require('loge');
var http = require('http-enhanced');
var controller = require('./controller');
var server = http.createServer(function (req, res) {
    loge_1.logger.debug('%s %s', req.method, req.url);
    controller(req, res);
})
    .on('listening', function () {
    var address = this.address();
    loge_1.logger.info('server listening on http://%s:%d', address.address, address.port);
});
module.exports = server;
