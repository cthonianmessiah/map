/*
Copyright (c) 2012 ICRL

See the file license.txt for copying permission.
*/

/* config/maws/monitors.js
 *
 * maws monitor configuration.
 * Instructs the monitor feature to browse the filesystem and expose files as URLs.
 *
 */

exports.feature = { // map.config.monitors
  urls: {
    '': {
      path: process.cwd() + '/web',
      active_scan_type: 'watch'
    }
  },
  active_scan_interval: 1000 * 5 // 5 seconds
};
