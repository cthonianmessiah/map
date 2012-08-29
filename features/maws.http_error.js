/*
Copyright (c) 2012 ICRL

See the file license.txt for copying permission.
*/

/* maws.http_error.js
 *
 * HTTP error handler for maws.
 * Formats http error data into a structure that can be rendered through
 * the request_render interface.
 *
 * Date        Author      Change
 * 2012-07-12  gdow        Initial working version.
 */

var vocabulary = {
  request_error: map.translate('request_error'),
  request_render: map.translate('request_render'),
  log: map.translate('log')
};

var library = {
  main: function(data) {
    data.mime = 'text/plain';
    data.content = data.message;
    data.resource = 'error';
    map.emit(vocabulary.request_render, data);
  }
};

exports.feature = {
  name: 'maws.http_error',
  implements: {
    request_error: library.main
  },
  monitors: {},
  emits: ['request_render', 'log']
};
