/*
Copyright (c) 2012 ICRL

See the file license.txt for copying permission.
*/

/* maws.response_cache.js
 *
 * Response cacher for maws.
 * Takes http responses specified by data object and optionally caches them in memory
 * as they are passed to the original render interface.
 *
 * Content rendered from the cache uses a custom readable stream implementation when
 * the cached data is stored in more than one chunk.
 *
 * This feature implements the render interface transparently, passing 'cacherender'
 * in its place.  The existing implementation of 'render' should be reconfigured to
 * implement 'cacherender' instead when this feature is in use.
 *
 * Stream data (indicated by the presence of data.render.stream) is assumed to be
 * paused when passed to the render interface.  Cached data, when rendered as a
 * stream, is rendered in a paused state.
 *
 * Date        Author      Change
 * 2012-07-03  gdow        Initial working version.
 *                         Updated to be compatible with multi-feature mapping.
 * 2012-07-12  gdow        Refactored to conform to documented interfaces.
 *                         Implemented 'cache_spoil'.
 * 2012-08-23  gdow        Added dynamo compatibility for hot-patching.
 * 2012-08-27  gdow        Changed caching behavior, which is now based on a processed url
 *                          which ignores parameters not explicitly supported.
 */

var stream = require('stream');

var vocabulary = {
  request_render: map.translate('request_render'),
  request_cache: map.translate('request_cache'),
  cache_spoil: map.translate('cache_spoil'),
  request_render_cache: map.translate('request_render_cache'),
  cache_created: map.translate('cache_created'),
  cache_spoiled: map.translate('cache_spoiled'),
  cache_missed: map.translate('cache_missed'),
  log: map.translate('log')
};

var cache = {};

var cache_timers = {};

var library = {
  main: function(data) {
    map.emit(vocabulary.log, {
      timestamp: new Date(),
      category: 'LOG',
      message: 'Checking cache properties of response data.'
    });
    if ('cachetime' in data && !(data.resource in cache)) {
      map.emit(vocabulary.log, {
        timestamp: new Date(),
        category: 'LOG',
        message: 'Caching this response for ' + data.cachetime + ' milliseconds.'
      });
      cache[data.resource] = {
        status: data.status,
        content: [],
      };
      if (typeof data.content == 'object' && Buffer.isBuffer(data.content) == false) {
        data.content.on('data', function(streamdata) {
          cache[data.resource].content.push(streamdata);
        });
        data.content.on('end', function() {
          map.emit(vocabulary.cache_created, data);
        });
      } else {
        cache[data.resource].content.push(data.content);
        map.emit(vocabulary.cache_created, data);
      }
      if (data.resource in cache_timers) {
        clearTimeout(cache_timers[data.resource]);
        delete cache_timers[data.resource];
      }
      if (data.cachetime > 0) {
        cache_timers[data.resource] = setTimeout(function() {
          map.emit(vocabulary.log, {
            timestamp: new Date(),
            category: 'LOG',
            message: 'Spoiling cached resource "' + data.resource + '".'
          });
          library.cache_remove(data);
          delete cache_timers[data.resource];
        }, data.cachetime);
      }
    }
    map.emit(vocabulary.request_render_cache, data);
  },
  fromcache: function(data) {
    if (data.resource in cache) {
      map.emit(vocabulary.log, {
        timestamp: new Date(),
        category: 'LOG',
        message: 'Rendering from cache.'
      });
      data.status = cache[data.resource].status;
      if (cache[data.resource].content.length > 1) {
        data.content = library.makestream(data.resource);
      } else {
        data.content = cache[data.resource].content[0];
      }
      map.emit(vocabulary.request_render_cache, data);
    } else {
      map.emit(vocabulary.log, {
        timestamp: new Date(),
        category: 'LOG',
        message: 'Cache missed!'
      });
      map.emit(vocabulary.cache_missed, data);
    }
  },
  cache_remove: function(data) {
    if (data.resource in cache) {
      delete cache[data.resource];
      map.emit(vocabulary.cache_spoiled, data);
    }
  },
  makestream: function(element) {
    var newstream = new stream.Stream();
    newstream.impl = {
      index: 0,
      length: cache[element].content.length,
      reading: false,
      active: true,
      go: function() {
        if (newstream.impl.active) {
          if (newstream.impl.index == newstream.impl.length) {
            newstream.emit('end');
            newstream.impl.active = false;
            newstream.impl.reading = false;
          } else if (newstream.impl.reading) {
            newstream.emit('data', cache[element].content[newstream.impl.index]);
            newstream.impl.index++;
            process.nextTick(newstream.impl.go);
          }
        }
      }
    };
    newstream.readable = true;
    newstream.pause = function() {
      newstream.impl.reading = false;
    };
    newstream.resume = function() {
      if (newstream.impl.active) {
        newstream.impl.reading = true;
        newstream.impl.go();
      }
    };
    return newstream;
  },
  save: function() {
    return cache;
  },
  load: function(oldstate) {
    cache = oldstate;
  }
};

exports.feature = {
  name: 'maws.response_cache',
  implements: {
    request_render: library.main,
    request_cache: library.fromcache,
    cache_spoil: library.cache_remove
  },
  monitors: {},
  emits: [
    'request_render_cache',
    'cache_created',
    'cache_spoiled',
    'cache_missed',
    'log'
  ],
  save: library.save,
  load: library.load
};
