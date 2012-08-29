/*
Copyright (c) 2012 ICRL

See the file license.txt for copying permission.
*/

/* map_core.aggregate.js
 *
 * Program aggregator for map core.  Assembles loaded features into event callbacks.
 *
 * Date        Author      Change
 * 2012-06-19  gdow        Initial working version.
 * 2012-06-21  gdow        Added step to log feature usage into the trace object.
 * 2012-07-03  gdow        Enabled multi-function feature mappings.
 * 2012-07-12  gdow        Modified to conform to log interface definition.
 * 2012-08-27  gdow        Changed dependency checking to create warnings when an interface
 *                          is not implemented or monitored by anything.  Previously it only
 *                          checked implementations and not monitors.
 */

exports.feature = {
  name: 'aggregate',
  implementation: function() {
    map.queue.push({
      event: 'log',
      data: {
        timestamp: new Date(),
        category: 'LOG',
        message: 'Features loaded, assembling program.'
      }
    });
    /* Check interface dependencies */
    for (var i in map.dependencies.interfaces) {
      if (!(i in map.dependencies.implementations)) {
        var missing = true;
        for (var j in map.features) {
          if (i in map.features[j].monitors) {
            missing = false;
          }
        }
        if (missing) {
          map.queue.push({
            event: 'log',
            data: {
              timestamp: new Date(),
              category: 'WARN',
              message: 'Interface ' + i + ' can be called but is not implemented or monitored by anything.'
            }
          });
        }
      }
    }
    /* Attach monitors */
    for (var m in map.dependencies.monitors) {
      var featurename = m;
      for (var i in map.dependencies.monitors[m]) {
        var eventname = map.dependencies.monitors[m][i];
        if (eventname in map.dependencies.interfaces) {
          map.on(eventname, map.features[featurename].monitors[eventname]);
          if (!(eventname in map.dependencies.trace.consumes)) {
            map.dependencies.trace.consumes[eventname] = {};
          }
          map.dependencies.trace.consumes[eventname][featurename] = true;
        } else {
          map.queue.push({
            event: 'log',
            data: {
              timestamp: new Date(),
              category: 'WARN',
              message: 'Feature ' + featurename + ' monitors interface ' + eventname + ' which is never used.'
            }
          });
        }
      }
    }
    /* Attach implementations */
    for (var i in map.dependencies.implementations) {
      var eventname = i;
      var featurename = map.dependencies.implementations[i];
      if (eventname in map.dependencies.interfaces) {
        map.on(eventname, map.features[featurename].implements[eventname]);
        if (!(eventname in map.dependencies.trace.consumes)) {
          map.dependencies.trace.consumes[eventname] = {};
        }
        map.dependencies.trace.consumes[eventname][featurename] = true;
      } else {
        map.queue.push({
          event: 'log',
          data: {
            timestamp: new Date(),
            category: 'WARN',
            message: 'Feature ' + map.dependencies.implementations[i] + ' implements interface ' + i + ' which is never used.'
          }
        });
      }
    }
  }
};