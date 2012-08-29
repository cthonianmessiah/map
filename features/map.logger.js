/*
Copyright (c) 2012 ICRL

See the file license.txt for copying permission.
*/

/* map.logger.js
 *
 * Implementation of 'log' interface.  Sends log output to the configured media.
 * Allows multiple specifications of file-based logs with different configurations.
 *
 * Date        Author      Change
 * 2012-08-27  gdow        Initial working version.
 * 2012-08-29  gdow        Added default configuration.
 */

var fs = require('fs');

var vocabulary = {
  log: map.translate('log'),
  start: map.translate('start')
};

var state = {
  init: false,
  queue: []
}

// Set configuration defaults.
if (!('logger' in map.config)) { map.config.logger = {}; }
if (!('timestamp' in map.config.logger)) { map.config.logger.timestamp = '?timestamp'; }
if (!('screen' in map.config.logger)) {
  map.config.logger.screen = {
    ERROR: true,
    WARN: true,
    LOG: true,
    FINE: true,
    FINER: true,
    FINEST: true
  };
}

var library = {
  main: function(data) {
    if (state.init) {
      // Write screen output
      if (data.category in map.config.logger.screen) {
        console.log(data.timestamp + ' - ' + data.category + ': ' + data.message);
      }
      // Write file output
      if ('files' in state) {
        for (var i in state.files) {
          if (data.category in map.config.logger.files[i]) {
            state.files[i].write(data.timestamp + ' - ' + data.category + ': ' + data.message + '\n');
          }
        }
      }
    } else {
      // Queue output
      state.queue.push(data);
    }
  },
  init: function() {
    // Configure file output
    if ('files' in map.config.logger) {
      var ts = new Date();
      state.files = {};
      for (var i in map.config.logger.files) {
        var j = i.replace(new RegExp((map.config.logger.timestamp).replace(/([.?*+^$[\]\\(){}|-])/g, '\\$1'), 'g'),
                      '' + ts.getFullYear() + ts.getMonth() + ts.getDate() + ts.getHours() + ts.getMinutes() + ts.getSeconds() + ts.getMilliseconds());
        state.files[i] = fs.createWriteStream(process.cwd() + j);
      }
    }
    state.init = true;
    // Flush queued data
    while (state.queue.length > 0) {
      var data = state.queue.shift();
      if (data.category in map.config.logger.screen) {
        console.log(data.timestamp + ' - ' + data.category + ': ' + data.message);
      }
      if ('files' in state) {
        for (var i in state.files) {
          if (data.category in map.config.logger.files[i]) {
            state.files[i].write(data.timestamp + ' - ' + data.category + ': ' + data.message + '\n');
          }
        }
      }
    }
  },
  exit: function() {
    if ('files' in state) {
      for (var i in state.files) {
        state.files[i].end();
      }
    }
  },
  save: function() {
    process.removeListener('exit', library.exit);
    return state;
  },
  load: function(oldstate) {
    // Configure file output
    if ('files' in map.config.logger) {
      var ts = new Date();
      state.files = {};
      for (var i in map.config.logger.files) {
        if ('files' in oldstate && i in oldstate.files) {
          state.files[i] = oldstate.files[i];
        } else {
          var j = i.replace(new RegExp((map.config.logger.timestamp).replace(/([.?*+^$[\]\\(){}|-])/g, '\\$1'), 'g'),
                        '' + ts.getFullYear() + ts.getMonth() + ts.getDate() + ts.getHours() + ts.getMinutes() + ts.getSeconds() + ts.getMilliseconds());
          state.files[i] = fs.createWriteStream(process.cwd() + j);
        }
      }
    }
    if ('files' in oldstate) {
      for (var i in oldstate.files) {
        if (!('files' in state && i in state.files)) {
          oldstate.files[i].end();
        }
      }
    }
    state.init = true;
    // Flush queued data
    while (state.queue.length > 0) {
      var data = state.queue.shift();
      if (data.category in map.config.logger.screen) {
        console.log(data.timestamp + ' - ' + data.category + ': ' + data.message);
      }
      if ('files' in state) {
        for (var i in state.files) {
          if (data.category in map.config.logger.files[i]) {
            state.files[i].write(data.timestamp + ' - ' + data.category + ': ' + data.message + '\n');
          }
        }
      }
    }
  }
};

exports.feature = {
  name: 'map.logger_file',
  implements: {},
  monitors: {
    log: library.main,
    start: library.init
  },
  emits: [],
  save: library.save,
  load: library.load
};

process.on('exit', library.exit);