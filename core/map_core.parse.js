/*
Copyright (c) 2012 ICRL

See the file license.txt for copying permission.
*/

/* map_core.parse.js
 *
 * Command line parser for map core.  Loads command line arguments into map.config.
 *
 * Date        Author      Change
 * 2012-06-20  gdow        Initial working version.
 * 2012-07-12  gdow        Modified to confirm to log interface definition.
 */

exports.feature = {
  name: 'parse',
  implementation: function() {
    map.emit('log', {
      timestamp: new Date(),
      category: 'LOG',
      message: 'LOG: Parsing command line arguments.'
    });
    map.config.args = [];
    for (var i in process.argv) {
      if (i > 1) {
        if (process.argv[i].indexOf('=') > 0) {
          map.config[process.argv[i].substr(0,process.argv[i].indexOf('='))] = process.argv[i].substr(process.argv[i].indexOf('=') + 1);
        } else {
          map.config.args.push(process.argv[i]);
        }
      }
    }
  }
};