/*
Copyright (c) 2012 ICRL

See the file license.txt for copying permission.
*/

/* map_core.flush.js
 *
 * Event flusher for map core.  Emits all queued events.
 *
 * Date        Author      Change
 * 2012-06-19  gdow        Initial working version.
 * 2012-07-12  gdow        Modified to confirm to log interface definition.
 * 2012-08-27  gdow        Changed dependency checking for 'log' interface to only
 *                          print to stdout if log is neither implemented nor monitored.
 */

exports.feature = {
  name: 'flush',
  implementation: function() {
    map.queue.push({
      event: 'log',
      data: {
        timestamp: new Date(),
        category: 'LOG',
        message: 'Program assembled, emitting events queued during startup.'
      }
    });
    if (!('log' in map.dependencies.implementations)) {
      var missing = true;
      for (var j in map.features) {
        if ('log' in map.features[j].monitors) {
          missing = false;
        }
      }
      if (missing) {
        console.log('log interface not implemented or monitored, dumping startup events to stdout.');
        for (var e in map.queue) {
          console.log(map.queue[e]);
        }
      }
    }
    for (var e in map.queue) {
      map.emit(map.queue[e].event, map.queue[e].data);
    }
  }
};
