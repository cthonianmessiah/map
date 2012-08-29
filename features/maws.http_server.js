/*
Copyright (c) 2012 ICRL

See the file license.txt for copying permission.
*/

/* maws.http_server.js
 *
 * Simple implementation of maws web server core.
 * Creates an event-emitting server at program start.
 *
 * Date        Author      Change
 * 2012-06-22  gdow        Initial working version.
 * 2012-07-03  gdow        Updated to be compatible with multi-feature mapping.
 * 2012-08-23  gdow        Added dynamo compatibility for hot-patching.
 * 2012-08-29  gdow        Added default configuration.
 */

var http = require('http');

var vocabulary = {
  start: map.translate('start'),
  request: map.translate('request')
};

var server;

if (!('http_server' in map.config)) { map.config.http_server = {}; }
if (!('port' in map.config.http_server)) { map.config.http_server.port = 8080; }
if (!('host' in map.config.http_server)) { map.config.http_server.host = 'localhost'; }

var library = {
  main: function(data) {
    server = http.createServer(function(request, response) {
      map.emit(vocabulary.request, {'request': request, 'response': response});
    }).listen(map.config.http_server.port, map.config.http_server.host);
  },
  save: function() {
    server.close();
  },
  load: function(oldstate) {
    library.main();
  }
};

exports.feature = {
  name: 'maws.http_server',
  implements: {
    start: library.main
  },
  monitors: {},
  emits: ['request'],
  save: library.save,
  load: library.load
};