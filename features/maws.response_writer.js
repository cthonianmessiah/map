/*
Copyright (c) 2012 ICRL

See the file license.txt for copying permission.
*/

/* maws.response_writer.js
 *
 * Response writer for maws.
 * Writes http responses specified by the render object into the response object.
 * Stream data (indicated by the presence of data.render.stream) is assumed to be
 * paused when passed to the render interface.
 * This is the endpoint of the maws workflow.
 *
 * Date        Author      Change
 * 2012-07-02  gdow        Initial working version.
 * 2012-07-03  gdow        Updated to be compatible with multi-feature mapping.
 * 2012-07-12  gdow        Refactored to conform to documented interfaces.
 */

var vocabulary = {
  request_render: map.translate('request_render'),
  log: map.translate('log')
};

var library = {
  main: function(data) {
    map.emit(vocabulary.log, {
      timestamp: new Date(),
      category: 'LOG',
      message: 'Writing response data for resource "' + data.resource + '".'});
    data.response.writeHead(data.status, {'Content-Type': data.mime});
    if (typeof data.content == 'object' && Buffer.isBuffer(data.content) == false) {
      data.content.pipe(data.response);
      data.content.resume();
    } else {
      data.response.end(data.content);
    }
  }
};

exports.feature = {
  name: 'maws.response_writer',
  implements: {
    request_render: library.main
  },
  monitors: {},
  emits: ['log']
};
