/*
Copyright (c) 2012 ICRL

See the file license.txt for copying permission.
*/

/* config/helloworld/config.js
 *
 * map 'Hello, world!' configuration.  Loads the example hello world module.
 *
 * Date        Author      Change
 * 2012-08-20  gdow        Initial working version.
 */

exports.feature = { // map.config
  dependencies: {
    'map.helloworld.js': {},
    'map.logger.js': {}
  }
};
