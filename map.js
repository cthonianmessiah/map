/*
Copyright (c) 2012 ICRL

See the file license.txt for copying permission.
*/

/* map.js
 *
 * Shell of map paradigm.  Loads map core object and calls predefined
 * features to assemble and run the program.
 *
 * Date        Author      Change
 * 2012-06-18  gdow        Initial working version.
 * 2012-06-19  gdow        Broke core features into separate modules.
 * 2012-07-12  gdow        Changed reference to map_core.js to use process.cwd().
 */

/* Create map object */
map = new require(process.cwd() + '/core/map_core.js').feature.implementation();

/* Parse command line arguments */
map.parse();

/* Load map features */
map.loadfeatures();

/* Assemble aggregate program */
map.aggregate();

/* Flush events cached during startup (logs, warnings, errors) */
map.flush();

/* emit start event */
map.start();

/* Clean up obsolete components */
map.clean();
