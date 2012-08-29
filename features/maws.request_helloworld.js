/*
Copyright (c) 2012 ICRL

See the file license.txt for copying permission.
*/

/* maws.request_helloworld.js
 *
 * Simple implementation of maws response interface.
 * Writes hello world plaintext to the web browser.
 *
 * Date        Author      Change
 * 2012-06-22  gdow        Initial working version.
 * 2012-07-03  gdow        Updated to be compatible with multi-feature mapping.
 * 2012-07-12  gdow        Refactored to conform to documented interfaces.
 */

var vocabulary = {
  request: map.translate('request'),
  log: map.translate('log')
};

var library = {
  main: function(data) {
    map.emit(vocabulary.log, {
      timestamp: new Date(),
      category: 'LOG',
      message: 'Serving "hello world" request.'});
    data.response.writeHead(200, {'Content-Type': 'text/plain'});
    data.response.end('Hello, world!\n');
  }
};

exports.feature = {
  name: 'maws.request_helloworld',
  implements: {
    request: library.main
  },
  monitors: {},
  emits: [] 
};
