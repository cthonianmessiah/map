/*
Copyright (c) 2012 ICRL

See the file license.txt for copying permission.
*/

/* maws.request_dispatcher.js
 *
 * Request dispatcher for maws.  Checks the configured resource map
 * and emits retrieval events for mapped resources.  Emits error
 * events for unmapped resources.
 * This is the start point of the maws workflow
 * (not counting the initial server creation).
 *
 * Date        Author      Change
 * 2012-07-02  gdow        Initial working version.
 * 2012-07-03  gdow        Updated to be compatible with multi-feature mapping.
 *                         Mapped implementation of 'cache_created'.
 * 2012-07-12  gdow        Refactored to conform to maws interface definitions.
 *                         Mapped implementations of 'cache_spoiled' and 'cache_missed'.
 *                         Added request support for database and dynamic resource types.
 * 2012-08-22  gdow        Cleaned up references in map.config.
 * 2012-08-23  gdow        Added dynamo compatibility for hot-patching.
 * 2012-08-27  gdow        Added strict url parsing to prevent unauthorized parameters from
 *                          affecting cache behavior.
 * 2012-08-28  gdow        Changed interface names from 'request_database' to
 *                          'request_database_stream' and 'request_database_submit'
 *                          to reflect the two possible implemented actions.
 */

var url = require('url');

var vocabulary = {
  request: map.translate('request'),
  request_file: map.translate('request_file'),
  request_database_stream: map.translate('request_database_stream'),
  request_database_submit: map.translate('request_database_submit'),
  request_dynamic: map.translate('request_dynamic'),
  request_cache: map.translate('request_cache'),
  request_render: map.translate('request_render'),
  request_error: map.translate('request_error'),
  log: map.translate('log'),
  cache_created: map.translate('cache_created'),
  cache_spoiled: map.translate('cache_spoiled'),
  cache_missed: map.translate('cache_missed')
};

var cache = {};

var library = {
  main: function(data) {
    var parsed = url.parse(data.request.url, true);
    delete parsed.search;
    data.resource = data.request.url;
    if (parsed.pathname in map.config.urls) {
      var urlresource = map.config.urls[parsed.pathname];
      // Strip unsupported parameters from the url string
      if ('params' in urlresource) {
        var newquery = {};
        for (var i in urlresource.params) {
          if (i in parsed.query) {
            newquery[i] = parsed.query[i];
          }
        }
        parsed.query = newquery;
      } else {
        parsed.query = {};
      }
      data.resource = url.format(parsed);
      data.mime = urlresource.mime;
      if ('cachetime' in urlresource) {
        data.cachetime = urlresource.cachetime;
      }
      var canrender = true;
      switch (urlresource.emit) {
      case vocabulary.request_file:
        data.path = urlresource.path;
        break;
      case vocabulary.request_database_stream:
      case vocabulary.request_database_submit:
        data.defaults = {};
        data.overrides = {};
        data.protection = {};
        if ('params' in urlresource) {
          for (var x in urlresource.params) {
            if ('default' in urlresource.params[x]) {data.defaults[x] = urlresource.params[x].default;};
            if ('override' in urlresource.params[x]) {data.overrides[x] = urlresource.params[x].override;};
            if ('protect' in urlresource.params[x]) {data.protection[x] = urlresource.params[x].protect;};
          }
        }
        data.arguments = parsed.query;
        data.db = urlresource.db;
        data.query = urlresource.query;
        break;
      case vocabulary.request_dynamic:
        data.arguments = parsed.query;
        data.definition = urlresource.definition;
        break;
      default:
        canrender = false;
        map.emit(vocabulary.log, {
          timestamp: new Date(),
          category: 'ERROR',
          message: 'Mapped resource ' + data.resource
                    + ' requested unsupported request_rendering interface "' + urlresource.emit
                    + '", serving error 500.'});
        map.emit(vocabulary.request_error, {
          status: 500,
          message: 'The server cannot render the requested resource.',
          response: data.response
        });
      }
      if (canrender) {
        if (data.resource in cache) {
          map.emit(vocabulary.request_cache, data);
        } else {
          map.emit(vocabulary[urlresource.emit], data);
        }
      }
    } else {
      map.emit(vocabulary.log, {
        timestamp: new Date(),
        category: 'LOG',
        message: 'Requested resource "' + data.request.url
                  + '" not found, serving error 404.'
      });
      map.emit(vocabulary.request_error, {
        status: 404,
        message: 'The server could not find the requested resource.',
        response: data.response
      });
    }
  },
  cache_add: function(data) {
    cache[data.resource] = true;
  },
  cache_remove: function(data) {
    delete cache[data.resource];
  },
  cache_redirect: function(data) {
    var parsed = url.parse(data.request.url, true);
    delete cache[data.resource];
    var urlresource = map.config.urls[parsed.pathname];
    map.emit(vocabulary[urlresource.emit], data);
  },
  save: function() {
    return cache;
  },
  load: function(oldstate) {
    cache = oldstate;
  }
};

exports.feature = {
  name: 'maws.request_dispatcher',
  implements: {
    request: library.main,
    cache_created: library.cache_add,
    cache_spoiled: library.cache_remove,
    cache_missed: library.cache_redirect
  },
  monitors: {},
  emits: [
    'request_file',
    'request_database_stream',
    'request_database_submit',
    'request_dynamic',
    'request_cache',
    'request_error',
    'request_render',
    'log'
  ],
  save: library.save,
  load: library.load
};
