/*
Copyright (c) 2012 ICRL

See the file license.txt for copying permission.
*/

/* config/maws/config.js
 *
 * maws base configuration.
 *
 * Date        Author      Change
 * 2012-08-20  gdow        Initial working version.
 */

exports.feature = { // map.config
  dependencies: { // Controls which modules are loaded and in what order
    'maws.http_server.js': {},
    'maws.request_dispatcher.js': {},
    'maws.file_getter.js': {},
    'maws.http_error.js': {},
    'maws.response_writer.js': {
      'request_render': 'request_render_cache'
    },
    'maws.response_cache.js': {},
    'map.logger.js': {},
    'maws.db_connector.js': {},
    'maws.directory_monitor.js': {},
    'map.dynamo.js': {}
  },
  dynamo: { // Controls which portions will trigger a reload when changed
    core: true,
    config: true,
    features: true
  }
};
