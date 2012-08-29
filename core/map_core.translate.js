/*
Copyright (c) 2012 ICRL

See the file license.txt for copying permission.
*/

/* map_core.translate.js
 *
 * Dependency translator for map core.  Provides a mechanism for overriding feature dependencies.
 *
 * Date        Author      Change
 * 2012-06-21  gdow        Initial working version.
 * 2012-07-03  gdow        Changed to translate the indexes in a hash table as well as strings.
 * 2012-07-12  gdow        Added log message to notify when non-default interface mappings are in use.
 */

exports.feature = {
  name: 'translate',
  implementation: function(data) {
    var translated;
    if (typeof data == 'object') {
      translated = {};
      for (var i in data) {
        var t;
        if (i in map.dependencies.translation) {
          t = map.dependencies.translation[i];
        } else {
          t = i;
        }
        translated[t] = data[i];
      }
    } else {
      if (data in map.dependencies.translation) {
        map.queue.push({
          event: 'log',
          data: {
            timestamp: new Date(),
            category: 'LOG',
            message: 'Translating default interface ' + data + ' to alternate interface ' + map.dependencies.translation[data] + '.'
          }
        });
        translated = map.dependencies.translation[data];
      } else {
        translated = data;
      }
    }
    return translated;
  }
};