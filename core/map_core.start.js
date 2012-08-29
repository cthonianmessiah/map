/*
Copyright (c) 2012 ICRL

See the file license.txt for copying permission.
*/

/* map_core.start.js
 *
 * Feature loader for map core.  Loads map features from the feature folder.
 *
 * Date        Author      Change
 * 2012-06-19  gdow        Initial working version.
 * 2012-07-12  gdow        Modified to confirm to log interface definition.
 */

exports.feature = {
  name: 'start',
  implementation: function() {
    map.emit('log', {
      timestamp: new Date(),
      category: 'LOG',
      message: 'map is ready, starting program.'
    });
    map.emit('start');
  }
};