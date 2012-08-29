/*
Copyright (c) 2012 ICRL

See the file license.txt for copying permission.
*/

/* map.dynamo.js
 *
 * Dynamic feature reloader for maws.
 * Can monitor core, configuration, and feature modules for changes
 * and reload when program components have changed.
 * Modules can provide 'save' and 'load' functions to preserve state
 * during a reload.
 *
 * Date        Author      Change
 * 2012-08-23  gdow        Initial working version.
 * 2012-08-29  gdow        Added default configuration.
 */

var fs = require('fs');

var vocabulary = {
  start: map.translate('start'),
  log: map.translate('log')
};

var state = {
  watchers: {
    core: {},
    config: {},
    features: {}
  }
};

// Set configuration defaults.
if (!('dynamo' in map.config)) { map.config.dynamo = {}; }
if (!('core' in map.config.dynamo)) { map.config.dynamo.core = false; }
if (!('config' in map.config.dynamo)) { map.config.dynamo.config = false; }
if (!('features' in map.config.dynamo)) { map.config.dynamo.features = false; }
if (!('delay' in map.config.dynamo)) { map.config.dynamo.delay = 1000 * 5; } // 5 seconds

var library = {
  main: function() {
    map.emit(vocabulary.log, {
      timestamp: new Date(),
      category: 'LOG',
      message: 'Dynamic resource monitoring enabled.'
    });
    if (map.config.dynamo.core) { library.watchcore(); };
    if (map.config.dynamo.config) { library.watchconfig(); };
    if (map.config.dynamo.features) { library.watchfeatures(); };
  },
  watchcore: function() {
    map.emit(vocabulary.log, {
      timestamp: new Date(),
      category: 'LOG',
      message: 'Enabling monitor for core map modules.'
    });
    library.makewatchers(state.watchers.core, process.cwd() + '/core', library.schedulereload);
  },
  watchconfig: function() {
    map.emit(vocabulary.log, {
      timestamp: new Date(),
      category: 'LOG',
      message: 'Enabling monitor for configuration files.'
    });
    library.makewatchers(state.watchers.config, process.cwd() + '/config/' + map.config.config, library.schedulereload);
  },
  watchfeatures: function() {
    map.emit(vocabulary.log, {
      timestamp: new Date(),
      category: 'LOG',
      message: 'Enabling monitor for loaded feature modules.'
    });
    library.makewatchers(state.watchers.features, process.cwd() + '/features', library.checkfeature);
  },
  checkfeature: function(event, filename, path) {
    if (require.resolve(path + '/' + filename) in map.featureusage) {
      library.schedulereload();
    }
  },
  makewatchers: function(watchlist, path, listener) {
    map.emit(vocabulary.log, {
      timestamp: new Date(),
      category: 'LOG',
      message: 'Adding monitor for local path "' + path + '".'
    });
    if (!(path in watchlist)) {
      watchlist[path] = fs.watch(path, function(event, filename) {
        map.emit(vocabulary.log, {
          timestamp: new Date(),
          category: 'LOG',
          message: 'Change detected for file "' + filename + '" at local path "' + path + '".'
        });
        listener(event, filename, path);
      });
      watchlist[path].on('error', function(error) {
        if (path in watchlist) {
          map.emit(vocabulary.log, {
            timestamp: new Date(),
            category: 'LOG',
            message: 'File watcher for "' + path + '" is no longer valid, removing.'
          });
          watchlist[path].close();
          delete watchlist[path];
        }
      });
    }
    var filelist = fs.readdirSync(path);
    for (var i in filelist) {
      try {
        var stats = fs.statSync(path + '/' + filelist[i]);
        if (stats.isDirectory()) {
          library.makewatchers(watchlist, path + '/' + filelist[i], listener);
        }
      } catch (err) {
        ; // Do nothing
      }
    }
  },
  reload: function() {
    map.emit(vocabulary.log, {
      timestamp: new Date(),
      category: 'LOG',
      message: 'Reload triggered, building new program version.'
    });
    if ('reloadtimer' in state) {
      clearTimeout(state.reloadtimer);
      delete state.reloadtimer;
    }
    var oldstate = {};
    // Save existing state
    for (var i in map.features) {
      if ('save' in map.features[i]) {
        map.emit(vocabulary.log, {
          timestamp: new Date(),
          category: 'LOG',
          message: 'Saving existing state of feature "' + i + '".'
        });
        oldstate[i] = map.features[i].save();
      }
    }
    // Create new map
    map.emit(vocabulary.log, {
      timestamp: new Date(),
      category: 'LOG',
      message: 'Compiling new map program.'
    });
    var oldmap = map;
    if (require.resolve(process.cwd() + '/core/map_core.js') in require.cache) {
      delete require.cache[require.resolve(process.cwd() + '/core/map_core.js')];
    }
    map = new require(process.cwd() + '/core/map_core.js').feature.implementation();
    map.parse();
    map.loadfeatures();
    map.aggregate();
    map.flush();
    map.clean();
    // Load existing state
    for (var i in map.features) {
      if ('load' in map.features[i]) {
        map.emit(vocabulary.log, {
          timestamp: new Date(),
          category: 'LOG',
          message: 'Transferring saved state of feature "' + i + '".'
        });
        if (!(i in oldstate)) {
          oldstate[i] = {};
        }
        map.features[i].load(oldstate[i]);
      }
    }
    // Redirect events from old map instance to new map instance
    map.emit(vocabulary.log, {
      timestamp: new Date(),
      category: 'LOG',
      message: 'Redirecting pending events from old program to new program.'
    });
    oldmap.removeAllListeners();
    for (var i in oldmap.eventlist) {
      oldmap.on(i, function(data) {
        map.emit(i, data);
      });
    }
  },
  schedulereload: function() {
    map.emit(vocabulary.log, {
      timestamp: new Date(),
      category: 'LOG',
      message: 'A monitored program feature has been changed.  Scheduling a reload for ' + map.config.dynamo.delay + ' milliseconds from now.'
    });
    if ('reloadtimer' in state) {
      clearTimeout(state.reloadtimer);
      delete state.reloadtimer;
    }
    state.reloadtimer = setTimeout(library.reload, map.config.dynamo.delay);
  },
  exit: function() {
    for (var i in state.watchers.core) {
      state.watchers.core[i].close();
    }
    for (var i in state.watchers.config) {
      state.watchers.config[i].close();
    }
    for (var i in state.watchers.features) {
      state.watchers.features[i].close();
    }
  },
  save: function() {
    state.config = map.config.dynamo;
    state.exit = library.exit;
    state.cleanup = function() {
      this.exit();
      process.removeListener('exit', this.exit);
      if ('reloadtimer' in this) {
        clearTimeout(this.reloadtimer);
      }
    };
    return state;
  },
  load: function(oldstate) {
    // Check changes to configuration and rebind or create monitors as appropriate
    if (typeof oldstate.config == 'object') {
      if (map.config.dynamo.core) {
        if (oldstate.config.core && typeof oldstate.watchers == 'object' && typeof oldstate.watchers.core == 'object') {
          // Transfer possible, use old state to load new state
          for (var i in oldstate.watchers.core) {
            try {
              state.watchers.core[i] = fs.watch(i, library.schedulereload);
              state.watchers.core[i].on('error', function(error) {
                if (i in state.watchers.core) {
                  map.emit(vocabulary.log, {
                    timestamp: new Date(),
                    category: 'LOG',
                    message: 'File watcher for "' + i + '" is no longer valid, removing.'
                  });
                  state.watchers.core[i].close();
                  delete state.watchers.core[i];
                }
              });
            } catch(err) {
              map.emit(vocabulary.log, {
                timestamp: new Date(),
                category: 'LOG',
                message: 'Failed to create watcher for "' + i + '".'
              });
              console.log(err);
              console.log(err.stack);
            }
          }
        } else {
          // Transfer not possible, load from scratch
          library.watchcore();
        }
      }
      if (map.config.dynamo.config) {
        if (oldstate.config.config && typeof oldstate.watchers == 'object' && typeof oldstate.watchers.config == 'object') {
          // Transfer possible, use old state to load new state
          for (var i in oldstate.watchers.config) {
            state.watchers.config[i] = fs.watch(i, library.schedulereload);
            state.watchers.config[i].on('error', function(error) {
              if (i in state.watchers.config) {
                map.emit(vocabulary.log, {
                  timestamp: new Date(),
                  category: 'LOG',
                  message: 'File watcher for "' + i + '" is no longer valid, removing.'
                });
                state.watchers.config[i].close();
                delete state.watchers.config[i];
              }
            });
          }
        } else {
          // Transfer not possible, load from scratch
          library.watchconfig();
        }
      }
      if (map.config.dynamo.features) {
        if (oldstate.config.features && typeof oldstate.watchers == 'object' && typeof oldstate.watchers.features == 'object') {
          // Transfer possible, use old state to load new state
          for (var i in oldstate.watchers.features) {
            state.watchers.features[i] = fs.watch(i, library.schedulereload);
            state.watchers.features[i].on('error', function(error) {
              if (i in state.watchers.features) {
                map.emit(vocabulary.log, {
                  timestamp: new Date(),
                  category: 'LOG',
                  message: 'File watcher for "' + i + '" is no longer valid, removing.'
                });
                state.watchers.features[i].close();
                delete state.watchers.features[i];
              }
            });
          }
        } else {
          // Transfer not possible, load from scratch
          library.watchfeatures();
        }
      }
    } else {
      // Old configuration not readable, create all from scratch
      library.main();
    }
    // Cleanup old resources
    if (typeof oldstate.cleanup == 'function') {
      oldstate.cleanup();
    }
  }
};

exports.feature = {
  name: 'map.dynamo',
  implements: {},
  monitors: {
    start: library.main
  },
  emits: ['log'],
  save: library.save,
  load: library.load
};

process.on('exit', library.exit);
