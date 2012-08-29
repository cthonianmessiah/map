/*
Copyright (c) 2012 ICRL

See the file license.txt for copying permission.
*/

/* map_core.js
 *
 * Core of map paradigm.  Loads features from the core folder and attaches
 * them to the map object definition, overwriting existing properties
 *
 * Date        Author      Change
 * 2012-06-19  gdow        Initial working version.
 * 2012-06-21  gdow        Added trace object to allow pruning.
 *                         Added translation object to support dependency translation.
 * 2012-07-12  gdow        Modified to confirm to log interface definition.
 * 2012-08-22  gdow        Reconfigured to use new explicit dependency format.
 *                         Added feature to store which events are in use.
 */

/* Load required libraries */
var events = require('events')
  , util = require('util')
  , fs = require('fs');

var map = function() {
  /* Build core map object */
  this.config = {};
  this.features = {};
  this.dependencies = {
    interfaces: {
      start: true,
      log: true
    },
    implementations: {},
    monitors: {},
    trace: {
      features: {},
      used: {},
      emits: {},
      consumes: {}
    },
    translation: {},
    config: {
      dependencies: {}
    }
  };
  this.queue = [];
  this.eventlist = {};
  this.featureusage = {};
  var featurelist = fs.readdirSync('core');
  for (var f in featurelist) {
    if (featurelist[f].substr(featurelist[f].length - 3, 3) == '.js' && featurelist[f] != 'map_core.js') {
      /* Register feature */
      if (require.resolve(process.cwd() + '/core/' + featurelist[f]) in require.cache) {
        delete require.cache[require.resolve(process.cwd() + '/core/' + featurelist[f])];
      }
      var feature = require(process.cwd() + '/core/' + featurelist[f]).feature;
      this[feature.name] = feature.implementation;
    }
  }
  events.EventEmitter.call(this);
  this.on('newListener', function(event, listener) {
    this.eventlist[event] = true;
  });
  this.queue.push({
    event: 'log',
    data: {
      timestamp: new Date(),
      category: 'LOG',
      message: 'map initialized.'
    }
  });
}
util.inherits(map, events.EventEmitter);

/* Build core feature */
exports.feature = {
  name: 'map_core',
  implementation: function() {
    return new map();
  }
};
