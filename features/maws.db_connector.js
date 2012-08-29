/*
Copyright (c) 2012 ICRL

See the file license.txt for copying permission.
*/

/* maws.db_connector.js
 *
 * Database connector for maws.
 * Manages a pool of connection threads instantiated from 'maws.db_worker.js'.
 * Responds to database render requests.
 *
 * Date        Author      Change
 * 2012-08-13  gdow        Initial working version.
 * 2012-08-22  gdow        Cleaned up references in map.config.
 * 2012-08-23  gdow        Added dynamo compatibility for hot-patching.
 * 2012-08-27  gdow        Fixed child process termination logic.
 * 2012-08-28  gdow        Changed interface names from 'request_database' to
 *                          'request_database_stream' and 'request_database_submit'
 *                          to reflect the two possible implemented actions.
 * 2012-08-29  gdow        Added default configuration.
 */

/* TODO: Fix save / load process to properly schedule closure of child processes.
 */

var child = require('child_process');
var events = require('events');
var stream = require('stream');

var vocabulary = {
  request_database_stream: map.translate('request_database_stream'),
  request_database_submit: map.translate('request_database_submit'),
  request_render: map.translate('request_render'),
  request_error: map.translate('request_error'),
  cache_spoil: map.translate('cache_spoil'),
  log: map.translate('log')
};

var connections = [];

// Set configuration defaults.
if (!('db_connector' in map.config)) { map.config.db_connector = {}; }
if (!('max_connections' in map.config)) { map.config.db_connector.max_connections = 5; }
if (!('blocksize' in map.config)) { map.config.db_connector.blocksize = 1; }
if (!('retry_interval' in map.config)) { map.config.db_connector.retry_interval = 1000 * 1; } // 1 second

var library = {
  makeconnection: function(data, callback) {
  // Create a new connection with the specified connection properties
    var db = map.config.databases[data.db];
    var i = connections.push({
      status: "busy",
      dsn: db.dsn,
      user: db.user,
      password: db.password,
      connection: child.fork(process.cwd() + '/lib/maws.db_worker.js', null, {env: process.env}),
      events: new events.EventEmitter,
      reserved: false
    }) - 1;
    // Attach default monitors for errors.
    connections[i].events.on('error', function(eventdata) {
      map.emit(vocabulary.log, {timestamp: new Date(),
                                category: 'ERROR',
                                message: eventdata});
    });
    connections[i].events.once('error', function(eventdata) {
      map.emit(vocabulary.request_error, {
        status: 500,
        message: 'The server encountered an internal error.',
        response: data.response
      });
      connections[i].reserved = false;
      if (connections[i].terminate) {
        map.emit(vocabulary.log, {timestamp: new Date(),
                                  category: 'LOG',
                                  message: 'Connection scheduled for termination, closing on error event.'});
        library.closeconnection(i);
      }
    });
    // Attach default monitor for log events.
    connections[i].events.on('log', function(eventdata) {
      map.emit(vocabulary.log, {timestamp: new Date(),
                                category: 'LOG',
                                message: eventdata});
    });
    // Attach a default monitor to the connection's event emitter that will translate messages into event types
    // and emit them through the local event emitter object.
    connections[i].connection.on('message', function(message) {
      if ('type' in message && 'data' in message) {
        connections[i].events.emit(message.type, message.data);
      } else {
        connections[i].events.emit('error',
                                   'Invalid message received from database connection thread # ' + i + ':\n'
                                    + message.toString());
      }
    });
    // Send connection configuration data to the child thread.
    var blocksize = map.config.db_connector.blocksize;
    if ('blocksize' in data) {blocksize = data.blocksize};
    connections[i].connection.send({
      type: 'config',
      dsn: connections[i].dsn,
      user: connections[i].user,
      password: connections[i].password,
      blocksize: blocksize
    });
    // Execute the requested callback with the index of the new connection.
    callback(i, data);
  },
  getconnection: function(data, callback) {
    // Reference an existing connection with the specified connection properties or create a new one
    // Search for an existing connection with the same properties that isn't busy
    var db = map.config.databases[data.db];
    var i = 0;
    var found = false;
    for (i = 0; i < connections.length && found == false; i++) {
      if (connections[i].reserved == false
           && connections[i].dsn == db.dsn
           && connections[i].user == db.user
           && connections[i].password == db.password) {
        found = true;
        break;
      }
    }
    if (found) {
      // If found execute the callback with the index of the located connection after repointing its error handler
      connections[i].events.once('error', function(eventdata) {
        map.emit(vocabulary.log, {timestamp: new Date(),
                                  category: 'ERROR',
                                  message: eventdata});
        map.emit(vocabulary.request_error, {
          status: 500,
          message: 'The server encountered an internal error.',
          response: data.response
        });
        connections[i].reserved = false;
        if (connections[i].terminate) {
          map.emit(vocabulary.log, {timestamp: new Date(),
                                    category: 'LOG',
                                    message: 'Connection scheduled for termination, closing on error event.'});
          library.closeconnection(i);
        }
      });
      callback(i, data);
    } else {
      // If not found then check max connections
      if (connections.length < map.config.db_connector.max_connections) {
        // If more can be created then pass the callback to makeconnection
        library.makeconnection(data, callback);
      } else {
        // If max connections reached then check for any non-busy connection
        i = 0;
        found = false;
        for (i = 0; i < connections.length && found == false; i++) {
          if (connections[i].reserved == false) {
            found = true;
          }
        }
        if (found) {
          // If found then repoint that connection to the desired properties and reconnect via callbacks
          connections[i].dsn = db.dsn;
          connections[i].user = db.user;
          connections[i].password = db.password;
          connections[i].connection.send({
            type: 'config',
            dsn: connections[i].dsn,
            user: connections[i].user,
            password: connections[i].password,
            blocksize: blocksize
          });
          connections[i].connection.send({type: 'reset'});
          connections[i].events.once('error', function(eventdata) {
            map.emit(vocabulary.log, {timestamp: new Date(),
                                      category: 'ERROR',
                                      message: eventdata});
            map.emit(vocabulary.request_error, {
              status: 500,
              message: 'The server encountered an internal error.',
              response: data.response
            });
            connections[i].reserved = false;
            if (connections[i].terminate) {
              map.emit(vocabulary.log, {timestamp: new Date(),
                                        category: 'LOG',
                                        message: 'Connection scheduled for termination, closing on error event.'});
              library.closeconnection(i);
            }
          });
          callback(i, data);
        } else {
          // If not found then check again soon
          setTimeout(function() {library.getconnection(data, callback)}, map.config.db_connector.retry_interval);
        }
      }
    }
  },
  closeconnection: function(index) {
    // Reset an existing connection and disconnect from it to close the process
    map.emit(vocabulary.log, {
      timestamp: new Date(),
      category: 'LOG',
      message: 'Closing connection # ' + index + '.'
    });
    connections[index].connection.send({type: 'reset'});
    connections[index].connection.send({type: 'terminate'});
    connections[index].events.emit('error', 'Connection to the database has been terminated.');
    connections[index].connection.removeAllListeners('message');
    connections.splice(index, 1);
  },
  get_stream: function(data) {
    // Implement the request_database_stream interface to get a data stream and call the request_render interface
    // Pass a callback to getconnection that will:
    library.getconnection(data, function(i, querydata) {
      // Reserve the obtained connection for use with this query
      connections[i].reserved = true;
      // Attach a listener to check for statement completion and pass a response stream
      connections[i].events.removeAllListeners('status');
      connections[i].events.on('status', function(eventdata) {
        // Create a read / write stream to interface with the child's data events
        connections[i].status = eventdata;
        if (connections[i].status == 'paused') {
          // Query has completed successfully, create a paused stream object and pass it to request_render.
          data.content = library.makestream(i);
          data.status = 200;
          map.emit(vocabulary.request_render, data);
        }
      });
      // Collect query parameters
      var params_valid = true;
      map.emit(vocabulary.log, {timestamp: new Date(),
                                category: 'LOG',
                                message: 'Applying query parameters.'});
      var params = {};
      map.emit(vocabulary.log, {timestamp: new Date(),
                                category: 'LOG',
                                message: 'Applying default parameters.'});
      for (var x in data.defaults) {
        params[x] = data.defaults[x];
      }
      map.emit(vocabulary.log, {timestamp: new Date(),
                                category: 'LOG',
                                message: 'Applying client parameters.'});
      for (var x in data.arguments) {
        if (x in data.protection) {
          if (data.protection[x] == 'text') {
            params[x] = data.arguments[x].replace(/(['\\])/g, '\\$1');
          } else {
            var regexp_text;
            switch (data.protection[x]) {
            case 'int':
              regexp_text = '^[-+]?[0-9]+$';
              break;
            case 'uint':
              regexp_text = '^[0-9]+$';
              break;
            case 'dec':
              regexp_text = '^[-+]?[0-9]*\.?[0-9]+$';
              break;
            case 'udec':
              regexp_text = '^[0-9]*\.?[0-9]+$';
              break;
            case 'date':
              regexp_text = '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
              break;
            case 'time':
              regexp_text = '^[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?$'
              break;
            case 'timestamp':
              regexp_text = '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?$'
              break;
            default:
              regexp_text = data.protection[x];
            }
            if (!(x in data.overrides) && data.arguments[x].match(new RegExp(regexp_text)) == null) {
              params_valid = false;
              map.emit(vocabulary.log, {timestamp: new Date(),
                                        category: 'ERROR',
                                        message: 'Client submitted an invalid value "' + data.arguments[x] + '" for parameter "' + x + '".'});
              map.emit(vocabulary.request_error, {
                status: 500,
                message: 'The server encountered an internal error.',
                response: data.response
              });
              break;
            }
            params[x] = data.arguments[x];
          }
        } else {
          if (!(x in data.overrides)) {
            map.emit(vocabulary.log, {timestamp: new Date(),
                                      category: 'WARN',
                                      message: 'Client parameter "' + x + '" is not protected from SQL injection.'});
          }
        }
      }
      map.emit(vocabulary.log, {timestamp: new Date(),
                                category: 'LOG',
                                message: 'Applying override parameters.'});
      for (var x in data.overrides) {
        params[x] = data.overrides[x];
      }
      // Set parameter delimiter
      if (params_valid) {
        if (!('_maws_delimiter' in params)) {
          params._maws_delimiter = '?';
        }
        var param_delimiter = params._maws_delimiter;
        delete params._maws_delimiter;
        // Apply parameters to query
        map.emit(vocabulary.log, {timestamp: new Date(),
                                  category: 'LOG',
                                  message: 'Delimiter set to "' + param_delimiter + '".'});
        var sql = data.query;
        for (var x in params) {
          map.emit(vocabulary.log, {timestamp: new Date(),
                                    category: 'LOG',
                                    message: 'Parameter "' + x + '" set to "' + params[x] + '".'});
          sql = sql.replace(new RegExp((param_delimiter + x).replace(/([.?*+^$[\]\\(){}|-])/g, '\\$1'), 'g'), params[x]);
        }
        // Execute the requested statement
        connections[i].connection.send({
          type: 'render',
          sql: sql
        });
      }
    });
  },
  makestream: function(i) {
    connections[i].events.removeAllListeners('status');
    var newstream = new stream.Stream();
    newstream.impl = {
      reading: false,
      active: true,
      queue: []
    };
    newstream.readable = true;
    newstream.pause = function() {
      if (newstream.impl.active) {
        newstream.impl.reading = false;
        connections[i].connection.send({type: 'pause'});
      }
    };
    newstream.resume = function() {
      if (newstream.impl.queue.length > 0) {
        for (var x = 0; x < newstream.impl.queue.length; x++) {
          newstream.emit('data', newstream.impl.queue[x]);
        }
        newstream.impl.queue.length = 0;
      }
      if (newstream.impl.active) {
        newstream.impl.reading = true;
        connections[i].connection.send({type: 'resume'});
      }
    };
    connections[i].events.removeAllListeners('data');
    connections[i].events.on('data', function(eventdata) {
      if (newstream.impl.reading == true) {
        newstream.emit('data', eventdata);
      } else {
        newstream.impl.queue.push(eventdata);
      }
    });
    connections[i].events.removeAllListeners('end');
    connections[i].events.on('end', function(eventdata) {
      if (newstream.impl.queue.length > 0) {
        for (var x = 0; x < newstream.impl.queue.length; x++) {
          newstream.emit('data', newstream.impl.queue[x]);
        }
        newstream.impl.queue.length = 0;
      }
      newstream.emit('end');
      newstream.impl.active = false;
      newstream.impl.reading = false;
      connections[i].reserved = false;
      if (connections[i].terminate) {
        map.emit(vocabulary.log, {timestamp: new Date(),
                                  category: 'LOG',
                                  message: 'Connection scheduled for termination, closing on completed stream.'});
        library.closeconnection(i);
      }
    });
    return newstream;
  },
  submit_sql: function(data) {
    // Implement the request_database_submit interface to get a data stream and call the request_render interface
    // Pass a callback to getconnection that will:
    library.getconnection(data, function(i, querydata) {
      // Reserve the obtained connection for use with this query
      connections[i].reserved = true;
      // Attach a simple listener to maintain connection status
      connections[i].events.on('status', function(eventdata) {
        connections[i].status = eventdata;
      });
      // Attach a listener to check for statement completion and pass a response
      connections[i].events.removeAllListeners('end');
      connections[i].events.on('end', function(eventdata) {
        // Send a reponse indicating query success
        connections[i].reserved = false;
        data.content = eventdata.toString();
        data.status = 200;
        map.emit(vocabulary.request_render, data);
      });
      // Collect query parameters
      var params_valid = true;
      map.emit(vocabulary.log, {timestamp: new Date(),
                                category: 'LOG',
                                message: 'Applying query parameters.'});
      var params = {};
      map.emit(vocabulary.log, {timestamp: new Date(),
                                category: 'LOG',
                                message: 'Applying default parameters.'});
      for (var x in data.defaults) {
        params[x] = data.defaults[x];
      }
      map.emit(vocabulary.log, {timestamp: new Date(),
                                category: 'LOG',
                                message: 'Applying client parameters.'});
      for (var x in data.arguments) {
        if (x in data.protection) {
          if (data.protection[x] == 'text') {
            params[x] = data.arguments[x].replace(/(['\\])/g, '\\$1');
          } else {
            var regexp_text;
            switch (data.protection[x]) {
            case 'int':
              regexp_text = '^[-+]?[0-9]+$';
              break;
            case 'uint':
              regexp_text = '^[0-9]+$';
              break;
            case 'dec':
              regexp_text = '^[-+]?[0-9]*\.?[0-9]+$';
              break;
            case 'udec':
              regexp_text = '^[0-9]*\.?[0-9]+$';
              break;
            case 'date':
              regexp_text = '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
              break;
            case 'time':
              regexp_text = '^[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?$'
              break;
            case 'timestamp':
              regexp_text = '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?$'
              break;
            default:
              regexp_text = data.protection[x];
            }
            if (!(x in data.overrides) && data.arguments[x].match(new RegExp(regexp_text)) == null) {
              params_valid = false;
              map.emit(vocabulary.log, {timestamp: new Date(),
                                        category: 'ERROR',
                                        message: 'Client submitted an invalid value "' + data.arguments[x] + '" for parameter "' + x + '".'});
              map.emit(vocabulary.request_error, {
                status: 500,
                message: 'The server encountered an internal error.',
                response: data.response
              });
              break;
            }
            params[x] = data.arguments[x];
          }
        } else {
          if (!(x in data.overrides)) {
            map.emit(vocabulary.log, {timestamp: new Date(),
                                      category: 'WARN',
                                      message: 'Client parameter "' + x + '" is not protected from SQL injection.'});
          }
        }
      }
      map.emit(vocabulary.log, {timestamp: new Date(),
                                category: 'LOG',
                                message: 'Applying override parameters.'});
      for (var x in data.overrides) {
        params[x] = data.overrides[x];
      }
      // Set parameter delimiter
      if (params_valid) {
        if (!('_maws_delimiter' in params)) {
          params._maws_delimiter = '?';
        }
        var param_delimiter = params._maws_delimiter;
        delete params._maws_delimiter;
        // Apply parameters to query
        map.emit(vocabulary.log, {timestamp: new Date(),
                                  category: 'LOG',
                                  message: 'Delimiter set to "' + param_delimiter + '".'});
        var sql = data.query;
        for (var x in params) {
          map.emit(vocabulary.log, {timestamp: new Date(),
                                    category: 'LOG',
                                    message: 'Parameter "' + x + '" set to "' + params[x] + '".'});
          sql = sql.replace(new RegExp((param_delimiter + x).replace(/([.?*+^$[\]\\(){}|-])/g, '\\$1'), 'g'), params[x]);
        }
        // Execute the requested statement
        connections[i].connection.send({
          type: 'submit',
          sql: sql
        });
      }
    });
  },
  exit: function() {
    while (connections.length > 0) {
      library.closeconnection(0);
    }
  },
  save: function() {
    // Close inactive connections and schedule active connections to close
    for (var i in connections) {
      connections[i].events.on('error', function() { ; });
      if (connections[i].reserved == false) {
        map.emit(vocabulary.log, {timestamp: new Date(),
                                  category: 'LOG',
                                  message: 'Connection #' + i + ' not reserved, closing directly.'});
        library.closeconnection(i);
      } else {
        map.emit(vocabulary.log, {timestamp: new Date(),
                                  category: 'LOG',
                                  message: 'Connection reserved, scheduling closure.'});
        connections[i].terminate = true;
      }
    }
    process.removeListener('exit', library.exit);
  }
};

exports.feature = {
  name: 'maws.db_connector',
  implements: {
    request_database_stream: library.get_stream,
    request_database_submit: library.submit_sql
  },
  monitors: {},
  emits: ['request_render', 'request_error', 'cache_spoil', 'log'],
  save: library.save
};

process.on('exit', function() {
  library.exit();
});
