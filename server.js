var http = require('http-enhanced');
var logger = require('loge');

var controller = require('./controller');

var server = module.exports = http.createServer(function(req, res) {
  logger.debug('%s %s', req.method, req.url);
  controller(req, res);
})
.on('listening', function() {
  var address = server.address();
  logger.info('server listening on http://%s:%d', address.address, address.port);
});
