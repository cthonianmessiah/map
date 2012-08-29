/*
Copyright (c) 2012 ICRL

See the file license.txt for copying permission.
*/

/* maws.db_worker.js
 *
 * Database worker thread for maws.
 * Communicates with the async controller in 'maws.db_connector.js'.
 *
 * Date        Author      Change
 * 2012-08-13  gdow        Initial working version.
 * 2012-08-28  gdow        Tweaked query submission function's emitted events.
 */

var ndbc = require('./ndbc');

// Create connection state object
var state = {
  status: 'inactive', // inactive, active, connected, streaming, paused
  dsn: '',
  user: '',
  password: '',
/*  env: null,
  dbc: null,
  stmt: null,*/
  desc: '',
  explicit: false,
  blocksize: 1,
  header: false,
  trailer: false
};

var library = {
  render: function(data) {
    // Reset the environment if necessary
    if (state.status == 'inactive') {
      library.reset();
    }
    // Connect if necessary
    if (state.status == 'active') {
      library.connect();
    }
    // Clear existing statement if necessary
    if (state.status == 'streaming' || state.status == 'paused') {
      if ('stmt' in state) {
        var retCode = ndbc.SQLFreeHandle('SQL_HANDLE_STMT', state.stmt);
        delete state.stmt;
        state.header = false;
        state.trailer = false;
      }
      library.newStatus('connected');
    }
    // Submit statement
    if (state.status == 'connected') {
      // Confirm still connected
      var retCode = ndbc.SQLGetConnectAttr(state.dbc, 'SQL_ATTR_CONNECTION_DEAD');
      if (retCode == 'SQL_CD_TRUE') {
        // Connection is dead, attempt to reconnect
        library.connect();
      }
      process.send({type: 'log', data: 'Connected, preparing statement handle.'});
      state.stmt = ndbc.SQLAllocHandle('SQL_HANDLE_STMT', state.dbc);
      if (typeof state.stmt == 'number') {
        process.send({type: 'log', data: 'Submitting SQL query:\n' + data.sql});
        retCode = ndbc.SQLExecDirect(state.stmt, data.sql);
        if (retCode == 'SQL_SUCCESS') {
          // Query succeeded, prepare to stream data
          if (state.explicit == false) {
            retCode = ndbc.JsonDescribe(state.stmt);
            if (retCode.substring(0, 1) == 'c') {
              process.send({type: 'log', data: 'Query succeeded, returned result set descriptor "' + retCode + '".'});
              state.desc = retCode;
              library.newStatus('paused');
              state.header = true;
              state.trailer = true;
            } else {
              process.send({type: 'error', data: 'Could not produce implicit result set descriptor.  Returned error "' + retCode + '".'});
            }
          } else {
            library.newStatus('paused');
            state.header = true;
            state.trailer = true;
          }
        } else {
          process.send({type: 'error', data: 'Query failed.  Returned error "' + retCode + '".'});
        }
      } else {
        process.send({type: 'error', data: 'Failed to allocate statement handle.  Returned error "' + retCode + '".'});
      }
    }
  },
  pause: function() {
    if (state.status == 'streaming') {
      state.status = 'paused';
    }
  },
  resume: function() {
    if (state.status == 'paused') {
      if (state.header == true) {
        var jsonData = ndbc.JsonHeader(state.stmt);
        if (jsonData.substring(0,1) == '[') {
          process.send({type: 'data', data: jsonData});
          state.header = false;
        } else {
          process.send({type: 'error', data: 'Could not produce result set header.  Returned error "' + jsonData + '".'});
          ndbc.SQLFreeHandle('SQL_HANDLE_STMT', state.stmt);
          state.stmt = 0;
          state.header = false;
          state.trailer = false;
        }
      }
      state.status = 'streaming';
      process.nextTick(library.stream);
    }
  },
  stream: function() {
    if (state.status == 'streaming') {
      var jsonData = ndbc.JsonData(state.stmt, state.desc, state.blocksize);
      if (jsonData.substring(0, 1) == ',') {
        // Send data and queue up next read.
        process.send({type: 'data', data: jsonData});
        process.nextTick(library.stream);
      } else {
        // Finished or encountered an error.  Either way, clean up the statement handle.
        library.newStatus('connected');
        if (jsonData == 'SQL_NO_DATA') {
          // End of data reached
          if (state.trailer == true) {
            process.send({type: 'log', data: 'Result set completed, sending trailer data.'});
            var jsonData = ndbc.JsonTrailer(state.stmt);
            if (jsonData.substring(0,1) == ']') {
              process.send({type: 'data', data: jsonData});
            } else {
              process.send({type: 'error', data: 'Could not produce result set trailer.  Returned error "' + jsonData + '".'});
            }
          }
          process.send({type: 'end', data: ''});
        } else {
          // Data retrieval ended in error
          process.send({type: 'error', data: 'Failed to read JSON data from the result set.  Returned error "' + jsonData + '".'});
        }
        ndbc.SQLFreeHandle('SQL_HANDLE_STMT', state.stmt);
        state.stmt = 0;
        state.header = false;
        state.trailer = false;
      }
    }
  },
  newStatus: function(status) {
    state.status = status;
    process.send({type: 'log', data: 'Changing connection status to "' + status + '".'});
    process.send({type: 'status', data: status});
  },
  reset: function() {
    // Reset the environment and connection.
    if ('stmt' in state) {
      ndbc.SQLFreeHandle('SQL_HANDLE_STMT', state.stmt);
      delete state.stmt;
      state.header = false;
      state.trailer = false;
    }
    if ('dbc' in state) {
      ndbc.SQLFreeHandle('SQL_HANDLE_DBC', state.dbc);
      delete state.dbc;
    }
    if ('env' in state) {
      ndbc.SQLFreeHandle('SQL_HANDLE_ENV', state.env);
      delete state.env;
    }
    if (state.status != 'inactive') {
      library.newStatus('inactive');
    }
    process.send({type: 'log', data: 'Creating environment handle.'});
    state.env = ndbc.SQLAllocHandle('SQL_HANDLE_ENV', 0);
    if (typeof state.env == 'number') {
      process.send({type: 'log', data: 'Setting ODBC version.'});
      var retCode = ndbc.SQLSetEnvAttr(state.env, 'SQL_ATTR_ODBC_VERSION', 'SQL_OV_ODBC3');
      if (retCode == 'SQL_SUCCESS') {
        process.send({type: 'log', data: 'Creating connection handle.'});
        state.dbc = ndbc.SQLAllocHandle('SQL_HANDLE_DBC', state.env);
        if (typeof state.dbc == 'number') {
          process.send({type: 'log', data: 'Environment has been activated.'});
          library.newStatus('active');
        } else {
          delete state.dbc;
          process.send({type: 'error', data: 'Failed to allocate connection handle.  Returned error "' + retCode + '".'});
        }
      } else {
        process.send({type: 'error', data: 'Failed to set ODBC version.  Returned error "' + retCode + '".'});
      }
    } else {
      delete state.env;
      process.send({type: 'error', data: 'Failed to allocate environment handle.  Returned error "' + retCode + '".'});
    }
  },
  connect: function() {
    // Connect to the configured DSN.
    if (state.dsn != '') {
      if (state.status == 'inactive') {
        // Reset the connection if inactive
        library.reset();
      }
      if (state.status == 'connected' || state.status == 'streaming' || state.status == 'paused') {
        // Disconnect if already connected
        library.disconnect();
      }
      if (state.status == 'active') {
        // Connect to the specified DSN.
        process.send({type: 'log', data: 'Connecting to the database.'});
        var retCode = ndbc.SQLConnect(state.dbc, state.dsn, state.user, state.password);
        if (retCode == 'SQL_SUCCESS') {
          process.send({type: 'log', data: 'Setting synchronous connection.'});
          retCode = ndbc.SQLSetConnectAttr(state.dbc, 'SQL_ATTR_ASYNC_ENABLE', 'SQL_ASYNC_ENABLE_OFF');
          if (retCode == 'SQL_SUCCESS') {
            library.newStatus('connected');
          } else {
            process.send({type: 'error', data: 'Failed to set synchronous execution.  Returned error "' + retCode + '".'});
          }
        } else {
          process.send({type: 'error', data: 'Failed to connect to the database.  Returned error "' + retCode + '".'});
        }
      }
    }
  },
  disconnect: function() {
    // Close any active query
    if (state.status == 'streaming' || state.status == 'paused') {
      if ('stmt' in state) {
        ndbc.SQLFreeHandle('SQL_HANDLE_STMT', state.stmt);
        delete state.stmt;
        state.header = false;
        state.trailer = false;
      }
      library.newStatus('connected');
    }
    if (state.status == 'connected') {
      // Disconnect from the database.
      var retCode = ndbc.SQLDisconnect(state.dbc);
      if (retCode = 'SQL_SUCCESS') {
        library.newStatus('active');
      } else {
        process.send({type: 'error', data: 'Failed to disconnect from the database.  Returned error "' + retCode + '".'});
        library.newStatus('inactive');
      }
    }
  },
  submit: function(data) {
    // Reset the environment if necessary
    if (state.status == 'inactive') {
      library.reset();
    }
    // Connect if necessary
    if (state.status == 'active') {
      library.connect();
    }
    // Clear existing statement if necessary
    if (state.status == 'streaming' || state.status == 'paused') {
      if ('stmt' in state.stmt) {
        var retCode = ndbc.SQLFreeHandle('SQL_HANDLE_STMT', state.stmt);
        delete state.stmt;
        state.header = false;
        state.trailer = false;
      }
      library.newStatus('connected');
    }
    // Submit statement
    if (state.status == 'connected') {
      // Confirm still connected
      var retCode = ndbc.SQLGetConnectAttr(state.dbc, 'SQL_ATTR_CONNECTION_DEAD');
      if (retCode == 'SQL_CD_TRUE') {
        // Connection is dead, attempt to reconnect
        library.connect();
      }
      state.stmt = ndbc.SQLAllocHandle('SQL_HANDLE_STMT', state.dbc);
      if (typeof state.stmt == 'number') {
        process.send({type: 'log', data: 'Submitting SQL query:\n' + data.sql});
        retCode = ndbc.SQLExecDirect(state.stmt, data.sql);
        if (retCode == 'SQL_SUCCESS') {
          // Query succeeded, get row count
          retCode = ndbc.SQLRowCount(state.stmt);
          if (typeof retCode == 'integer') {
            process.send({type: 'end', data: retCode});
          } else {
            process.send({type: 'end', data: -1});
          }
        } else {
          process.send({type: 'error', data: 'Query failed.  Returned error "' + retCode + '".'});
        }
      } else {
        process.send({type: 'error', data: 'Failed to allocate statement handle.  Returned error "' + retCode + '".'});
      }
    }
  },
  config: function(params) {
    if ('dsn' in params) {
      if (params.dsn != state.dsn || params.user != state.user || params.password != state.password) {
        // New connection details do not match old ones, disconnect
        library.disconnect();
      }
      state.dsn = params.dsn;
      if ('user' in params) {
        state.user = params.user;
      } else {
        state.user = '';
      }
      if ('password' in params) {
        state.password = params.password;
      } else {
        state.password = '';
      }
    }
    if ('blocksize' in params) {
      state.blocksize = params.blocksize;
    }
    if ('desc' in params) {
      state.desc = params.desc;
      state.explicit = true;
    }
    if ('explicit' in params) {
      state.explicit = params.explicit;
    }
  },
  describe: function() {
    if (state.status == 'paused' || state.status == 'streaming') {
      process.send({type: 'data', data: state.desc});
    }
  },
  terminate: function() {
    process.exit();
  }
}

// This message dispatcher routes incoming messages to the functions available in the interface.
process.on('message', function(data) {
  if ('type' in data) {
    // Message types are ordered according to expected frequency, with more frequent messages at the top.
    if (data.type == 'resume') {
      library.resume(data);
    } else if (data.type == 'pause') {
      library.pause(data);
    } else if (data.type == 'render') {
      library.render(data);
    } else if (data.type == 'submit') {
      library.submit(data);
    } else if (data.type == 'config') {
      library.config(data);
    } else if (data.type == 'reset') {
      library.reset(data);
    } else if (data.type == 'describe') {
      library.describe(data);
    } else if (data.type == 'terminate') {
      library.terminate();
    } else {
      process.send({type: 'error', data: 'Invalid message type, valid message types are "render", "pause", "resume", "submit", "config", "reset", and "describe".'});
    }
  } else {
    process.send({type: 'error', data: 'Invalid message, all messages must have the "type" property.'});
  }
});

process.on('exit', function() {
  // Disconnect and reset before the process exits.
  library.disconnect();
  library.reset();
});
