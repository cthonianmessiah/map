/*
Copyright (c) 2012 ICRL

See the file license.txt for copying permission.
*/

/* map_core.clean.js
 *
 * Cleanup function for map core.  Removes features used only during startup.
 *
 * Date        Author      Change
 * 2012-06-19  gdow        Initial working version.
 * 2012-06-21  gdow        Added step to prune unused features based on the contents
 *                          of the trace object.
 * 2012-07-12  gdow        Modified to confirm to log interface definition.
 */

var trace = function(feature) {
  var emits;
  if (arguments.length == 0) {
    emits = ["log", "start"];
  } else {
    emits = map.dependencies.trace.emits[feature];
  }
  for (var i in emits) {
    if (emits[i] in map.dependencies.trace.consumes) {
      for (var j in map.dependencies.trace.consumes[emits[i]]) {
        if (!(j in map.dependencies.trace.used)) {
          map.dependencies.trace.used[j] = true;
          trace(j);
        }
      }
    }
  }
};

exports.feature = {
  name: 'clean',
  implementation: function() {
    map.emit('log', {
      timestamp: new Date(),
      category: 'LOG',
      message: 'Queue flushed, deleting obsolete map properties.'
    });
    map.emit('log', {
      timestamp: new Date(),
      category: 'LOG',
      message: 'Tracing feature usage.'
    });
    trace();
    for (var i in map.dependencies.trace.features) {
      if (!(i in map.dependencies.trace.used)) {
        map.emit('log', {
          timestamp: new Date(),
          category: 'LOG',
          message: 'Removing unreachable feature ' + i + '.'
        });
        delete map.features[i];
      }
    }
    delete map.dependencies;
    delete map.queue;
    delete map.loadfeatures;
    delete map.aggregate;
    delete map.translate;
    delete map.flush;
    delete map.start;
    delete map.clean;
  }
};