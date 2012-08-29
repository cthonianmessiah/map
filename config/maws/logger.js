/*
Copyright (c) 2012 ICRL

See the file license.txt for copying permission.
*/

/* config/maws/logger.js
 *
 * maws logger configuration.  Controls where log output goes.
 *
 */

exports.feature = { // map.config.logger
  screen: {
    ERROR: true,
    WARN: true,
    LOG: true
  },
  files: {
    '/log/maws_?timestamp.log': {
      ERROR: true,
      WARN: true,
      LOG: true,
      FINE: true,
      FINER: true,
      FINEST: true
    }
  }
};
