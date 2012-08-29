/*
Copyright (c) 2012 ICRL

See the file license.txt for copying permission.
*/

/* map_core.loadfeatures.js
 *
 * Feature loader for map core.  Loads map features from the feature folder.
 *
 * Date        Author      Change
 * 2012-06-19  gdow        Initial working version.
 * 2012-06-21  gdow        Added step to log loaded features into trace object.
 * 2012-07-03  gdow        Enabled multi-function feature mappings.
 *                         Changed the usage of the translator.
 * 2012-07-12  gdow        Modified to confirm to log interface definition.
 *                         Added step to load config properties into global map.config.
 * 2012-08-13  gdow        Fixed the creation of interface monitors.
 * 2012-08-22  gdow        Reconfigured to use new explicit dependency format.
 */

var fs = require('fs');

var loadconfig = function(path, target) {
  var configlist = fs.readdirSync(path);
  var pathlist = [];
  for(var i in configlist) {
    var configfile = fs.statSync(path + configlist[i]);
    if (configfile.isFile() && configlist[i].substr(configlist[i].length - 3, 3) == '.js') {
      if (require.resolve(path + '/' + configlist[i]) in require.cache) {
        delete require.cache[require.resolve(path + '/' + configlist[i])];
      }
      var newconfig = require(path + '/' + configlist[i]).feature;
      var configtarget = target;
      if (configlist[i] != 'config.js') {
        var configarray = configlist[i].split('.');
        for (var j = 0; j < configarray.length - 1; j++) {
          if (!(configarray[j] in configtarget)) {
            configtarget[configarray[j]] = {};
          }
          configtarget = configtarget[configarray[j]];
        }
      }
      for (var j in newconfig) {
        configtarget[j] = newconfig[j];
      }
    } else if (configfile.isDirectory()) {
      pathlist.push(configlist[i]);
    }
  }
  for (var i in pathlist) {
    if (!(pathlist[i] in target)) {
      target[pathlist[i]] = {};
    }
    loadconfig(path + '/' + pathlist[i], target[pathlist[i]]);
  }
};

exports.feature = {
  name: 'loadfeatures',
  implementation: function() {
    map.queue.push({
      event: 'log',
      data: {
        timestamp: new Date(),
        category: 'LOG',
        message: 'Loading features.'
      }
    });
    if ('config' in map.config) {
      map.queue.push({
        event: 'log',
        data: {
          timestamp: new Date(),
          category: 'LOG',
          message: 'Loading specified configuration "' + map.config.config + '".'
        }
      });
      loadconfig(process.cwd() + '/config/' + map.config.config + '/', map.config);
    }
    for (var i in map.config.dependencies) {
      map.dependencies.translation = map.config.dependencies[i];
      /* Register feature */
      if (require.resolve(process.cwd() + '/features/' + i) in require.cache) {
        delete require.cache[require.resolve(process.cwd() + '/features/' + i)];
      }
      map.featureusage[require.resolve(process.cwd() + '/features/' + i)] = true;
      var feature = require(process.cwd() + '/features/' + i).feature;
      feature.implements = map.translate(feature.implements);
      feature.monitors = map.translate(feature.monitors);
      var emitobj = {};
      for (var i in feature.emits) {
        emitobj[feature.emits[i]] = true;
      }
      feature.emits = map.translate(emitobj);
      map.queue.push({
        event: 'log',
        data: {
          timestamp: new Date(),
          category: 'LOG',
          message: 'Loading feature ' + feature.name
        }
      });
      map.dependencies.trace.features[feature.name] = true;
      /* Register implements, monitors, and emits */
      for (var i in feature.implements) {
        /* Resolve implementation conflicts */
        if (i in map.dependencies.implementations) {
          map.queue.push({
            event: 'log',
            data: {
              timestamp: new Date(),
              category: 'WARN',
              message: 'Feature ' + feature.name + ' implements interface ' + i + ', which is already implemented by '
                        + map.dependencies.implementations[i] + '.  Ignoring this mapping.'
            }
          });
        } else {
          map.dependencies.implementations[i] = feature.name;
        }
      }
      map.dependencies.trace.emits[feature.name] = [];
      for (var i in feature.emits) {
        map.dependencies.trace.emits[feature.name].push(i);
        map.dependencies.interfaces[i] = true;
      }
      map.dependencies.monitors[feature.name] = [];
      for (var i in feature.monitors) {
        map.dependencies.monitors[feature.name].push(i);
      }
      map.features[feature.name] = feature;
    }
  }
};