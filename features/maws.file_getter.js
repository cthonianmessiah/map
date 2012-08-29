/*
Copyright (c) 2012 ICRL

See the file license.txt for copying permission.
*/

/* maws.file_getter.js
 *
 * File getter for maws.
 * Sends a paused readable stream to the render interface.
 *
 * Date        Author      Change
 * 2012-07-02  gdow        Initial working version.
 * 2012-07-03  gdow        Updated to be compatible with multi-feature mapping.
 * 2012-07-12  gdow        Refactored to conform to interface definitions.
 *                         Added caching and a file watch to spoil cache entries
 *                         for changed files.
 * 2012-08-23  gdow        Added dynamo compatibility for hot-patching.
 */

var fs = require('fs');

var vocabulary = {
  request_file: map.translate('request_file'),
  request_render: map.translate('request_render'),
  request_error: map.translate('request_error'),
  cache_spoil: map.translate('cache_spoil'),
  log: map.translate('log')
};

var watchers = {};

var library = {
  main: function(data) {
/*    fs.exists(data.path, function(exists) {
      if (exists) {*/
        data.status = 200;
        console.log(data.path);
        data.content = fs.createReadStream(data.path);
        data.content.pause();
        if (!data.resource in watchers) {
          watchers[data.resource] = fs.watch(data.path, function(event) {
            map.emit(vocabulary.cache_spoil, {
              resource: data.resource
            });
          });
        }
        map.emit(vocabulary.log, {timestamp: new Date(),
                                  category: 'LOG',
                                  message: 'Serving resource "' + data.resource + '" from filesystem at "' + data.path + '".'});
        map.emit(vocabulary.request_render, data);
/*      } else {
        map.emit(vocabulary.log, {
          timestamp: new Date(),
          category: 'LOG',
          message: 'Requested resource "' + data.resource
                    + '" not found, serving error 404.'
        });
        map.emit(vocabulary.request_error, {
          status: 404,
          message: 'The server could not find the requested resource.',
          response: data.response
        });
      }
    });*/
  },
  exit: function() {
    for (i in watchers) {
      watchers[i].close();
    }
  },
  save: function() {
    library.exit();
    process.removeListener('exit', library.exit);
  }
};

exports.feature = {
  name: 'maws.file_getter',
  implements: {
    request_file: library.main
  },
  monitors: {},
  emits: ['request_render', 'request_error', 'cache_spoil', 'log'],
  save: library.save
};

process.on('exit', function() {
  library.exit();
});
