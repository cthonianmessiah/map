/*
Copyright (c) 2012 ICRL

See the file license.txt for copying permission.
*/

/* maws.directory_monitor.js
 *
 * Directory monitor for maws.
 * Maps the contents of configured directories to specified url directories.
 * Detects file creation, modification, and deletion and modifies httpresources accordingly.
 * Spoils cached data for any modified files.
 *
 * Date        Author      Change
 * 2012-08-13  gdow        Initial working version.
 * 2012-08-22  gdow        Cleaned up references in map.config.
 * 2012-08-23  gdow        Added dynamo compatibility for hot-patching.
 * 2012-08-29  gdow        Added support for the property active_scan_type.
 */

var fs = require('fs');

var vocabulary = {
  start: map.translate('start'),
  cache_spoil: map.translate('cache_spoil'),
  log: map.translate('log')
};

var watchers = {};
var interval;

var library = {
  main: function(data) {
    if ('monitors' in map.config) {
      for (var i in map.config.monitors.urls) {
        map.emit(vocabulary.log, {
          timestamp: new Date(),
          category: 'LOG',
          message: 'Scanning folder "' + map.config.monitors.urls[i].path + '".'
        });
        library.addmonitor(i, map.config.monitors.urls[i].path, map.config.monitors.urls[i].active_scan_type);
      }
      if ('active_scan_interval' in map.config.monitors) {
        map.emit(vocabulary.log, {
          timestamp: new Date(),
          category: 'LOG',
          message: 'Activating resource scanner to detect new folders that do not spawn file events.'
        });
        interval = setInterval(function() {
          for (var i in map.config.monitors.urls) {
            library.addmonitor(i, map.config.monitors.urls[i].path, map.config.monitors.urls[i].active_scan_type);
          }
        }, map.config.monitors.active_scan_interval);
      }
    }
  },
  addmonitor: function(urlpath, localpath, active_scan_type) {
    // Browse through monitored folder and create resources and additional monitors.
    fs.readdir(localpath, function(err, files) {
      files.forEach(function(filename) {
        fs.stat(localpath + '/' + filename, function(err, stats) {
          if (stats.isFile()) {
            if (!(urlpath + '/' + encodeURIComponent(filename) in map.config.urls)) {
              map.emit(vocabulary.log, {
                timestamp: new Date(),
                category: 'LOG',
                message: 'Detected file "' + filename + '" on monitored folder "' + localpath + '".\n'
                       + 'Creating new resource at "' + urlpath + '/' + encodeURIComponent(filename) + '".'
              });
              var mime;
              var mime_map = {
                gif: 'image/gif',
                gz: 'application/x-gzip',
                htm: 'text/html',
                html: 'text/html',
                css: 'text/css',
                jpg: 'image/jpeg',
                jpeg: 'image/jpeg',
                js: 'text/javascript',
                json: 'application/json',
                pdf: 'application/pdf',
                png: 'image/png',
                svg: 'image/svg+xml',
                txt: 'text/plain',
                xml: 'text/xml',
                zip: 'application/zip'
              }
              var arr = filename.split('.');
              var ext = arr[arr.length - 1];
              if (ext in mime_map) {
                mime = mime_map[ext];
              } else {
                mime = 'application/octet-stream';
              }
              map.config.urls[urlpath + '/' + encodeURIComponent(filename)] = {
                mime: mime,
                emit: 'request_file',
                path: localpath + '/' + filename,
                cachetime: 0,
                mtime: stats.mtime
              };
            } else {
              if (stats.mtime > map.config.urls[urlpath + '/' + encodeURIComponent(filename)].mtime) {
                map.emit(vocabulary.log, {
                  timestamp: new Date(),
                  category: 'LOG',
                  message: 'Detected change in local file "' + localpath + '/' + filename + '".  Spoiling cache entry.'
                });
                map.config.urls[urlpath + '/' + encodeURIComponent(filename)].mtime = stats.mtime;
                map.emit(vocabulary.cache_spoil, {request: {url: urlpath + '/' + encodeURIComponent(filename)}});
              }
            }
          } else if (stats.isDirectory()) {
            library.addmonitor(urlpath + '/' + encodeURIComponent(filename), localpath + '/' + filename, active_scan_type);
          }
        });
      });
    });
    // Set up monitors.
    if (active_scan_type == 'watch' && !(urlpath in watchers)) {
      map.emit(vocabulary.log, {
        timestamp: new Date(),
        category: 'LOG',
        message: 'Creating monitor for folder "' + localpath + '".'
      });
      watchers[urlpath] = fs.watch(localpath, function(event, filename) {
        if (filename) {
          if (event == 'change') {
            fs.stat(localpath + '/' + filename, function(err, stats) {
              if (err) {
                map.emit(vocabulary.log, {
                  timestamp: new Date(),
                  category: 'ERROR',
                  message: 'Failed stat function for file "' + filename + '" on monitored folder "' + localpath + '".'
                });
              } else {
                if (stats.isFile()) {
                  if (!(urlpath + '/' + encodeURIComponent(filename) in map.config.urls)) {
                    map.emit(vocabulary.log, {
                      timestamp: new Date(),
                      category: 'LOG',
                      message: 'Detected new file "' + filename + '" on monitored folder "' + localpath + '".\n'
                             + 'Creating new resource at "' + urlpath + '/' + encodeURIComponent(filename) + '".'
                    });
                    var mime;
                    var mime_map = {
                      gif: "image/gif",
                      gz: "application/x-gzip",
                      htm: "text/html",
                      html: "text/html",
                      jpg: "image/jpeg",
                      jpeg: "image/jpeg",
                      js: "text/javascript",
                      json: "application/json",
                      pdf: "application/pdf",
                      png: "image/png",
                      svg: "image/svg+xml",
                      txt: "text/plain",
                      xml: "text/xml",
                      zip: "application/zip"
                    }
                    var arr = filename.split(".");
                    var ext = arr[arr.length - 1];
                    if (ext in mime_map) {
                      mime = mime_map[ext];
                    } else {
                      mime = "application/octet-stream";
                    }
                    map.config.urls[urlpath + '/' + encodeURIComponent(filename)] = {
                      mime: mime,
                      emit: 'request_file',
                      path: localpath + '/' + filename,
                      cachetime: 0,
                      mtime: stats.mtime
                    };
                  } else {
                    map.emit(vocabulary.log, {
                      timestamp: new Date(),
                      category: 'LOG',
                      message: 'Detected change in local file "' + localpath + '/' + filename + '".  Spoiling cache entry.'
                    });
                    map.config.urls[urlpath + '/' + encodeURIComponent(filename)].mtime = stats.mtime;
                    map.emit(vocabulary.cache_spoil, {request: {url: urlpath + '/' + encodeURIComponent(filename)}});
                  }
                } else if (stats.isDirectory()) {
                  if (!(urlpath + '/' + encodeURIComponent(filename) in watchers)) {
                    map.emit(vocabulary.log, {
                      timestamp: new Date(),
                      category: 'LOG',
                      message: 'Detected new directory "' + filename + '" on monitored folder "' + localpath + '".\n'
                             + 'Creating new monitor to populate "' + urlpath + '/' + encodeURIComponent(filename) + '".'
                    });
                    library.addmonitor(urlpath + '/' + encodeURIComponent(filename), localpath + '/' + filename, active_scan_type);
                  }
                }
              }
            });
          } else if (event == 'rename') { /* For files */
            if (urlpath + '/' + encodeURIComponent(filename) in map.config.urls) {
              map.emit(vocabulary.log, {
                timestamp: new Date(),
                category: 'LOG',
                message: 'Detected deleted file "' + filename + '" on monitored folder "' + localpath + '".'
                       + 'Removing old resource at "' + urlpath + '/' + encodeURIComponent(filename) + '".'
              });
              delete map.config.urls[urlpath + '/' + encodeURIComponent(filename)];
            } else if (urlpath + '/' + encodeURIComponent(filename) in watchers) {
              map.emit(vocabulary.log, {
                timestamp: new Date(),
                category: 'LOG',
                message: 'Detected removed directory "' + filename + '" on monitored folder "' + localpath + '".\n'
                       + 'Removing monitor for "' + urlpath + '/' + encodeURIComponent(filename) + '".'
              });
              watchers[urlpath + '/' + encodeURIComponent(filename)].close();
              delete watchers[urlpath + '/' + encodeURIComponent(filename)];
            }
          }
        }
      });
      watchers[urlpath].on('error', function(error) {
        if (urlpath in watchers) {
          map.emit(vocabulary.log, {
            timestamp: new Date(),
            category: 'LOG',
            message: 'File watcher for "' + urlpath + '" is no longer valid, removing.'
          });
          watchers[urlpath].close();
          delete watchers[urlpath];
        }
      });
    }
  },
  exit: function() {
    for (var i in watchers) {
      watchers[i].close();
    }
    if (interval) {
      clearInterval(interval);
    }
  },
  save: function() {
    library.exit();
    process.removeListener('exit', library.exit);
  },
  load: function() {
    library.main();
  }
};

exports.feature = {
  name: 'maws.directory_monitor',
  implements: {},
  monitors: {
    start: library.main
  },
  emits: ['cache_spoil', 'log'],
  save: library.save,
  load: library.load
};

process.on('exit', function() {
  library.exit();
});
