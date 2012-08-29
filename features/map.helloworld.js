/*
Copyright (c) 2012 ICRL

See the file license.txt for copying permission.
*/

/* map.helloworld.js
 *
 * Simple implementation of 'start' interface.  Sends a 'Hello, world!' message to stdout.
 *
 * Date        Author      Change
 * 2012-06-18  gdow        Initial working version.
 * 2012-06-21  gdow        Changed interface setup to use map.translate.
 * 2012-06-22  gdow        Added comments explaining how map features are built.
 * 2012-07-03  gdow        Updated to be compatible with multi-feature mapping.
 */

/* This is the vocabulary object.  Use the values enumerated here instead of static strings
 * whenever you call map.emit from a feature.  This allows the map translator component
 * to re-map the feature's workflow if the configuration file specifies alternate mappings.
 */
var vocabulary = {
  start: map.translate('start')
};

/* This is the library object.  This is a convenient means of grouping this feature's
 * usable functions together, but is optional.
 */
var library = {
  main: function(data) {
    console.log('Hello, world!');
  }
};

/* The feature object is the standardized format for creating map features.
 * It is expected to have the properties shown here.
 */
exports.feature = {
  /* The feature name should be unique to this implementation of one or
   * more interfaces.  Alternate implementations of the same interface should
   * be named differently so that map's loader can distinguish them.
   */
  name: 'map_core.helloworld',
  /* implements maps interface names that this feature uses to the functions
   * called by each interface.  Each function listed here is used in the program's
   * main workflow.  Only one feature can implement a given interface at a time.
   * An implementing function will be called after an interface's monitors.
   * The specific interface names listed here can be overriden in the configuration file.
   */
  implements: {
    start: library.main
  },
  /* monitors maps interface names that this feature uses to the functions
   * called by each interface outside the main workflow.  Think of these as
   * branches from the main trunk.  There can be multiple monitors for the same
   * interface, which will be called in no particular order before that interface's
   * implementation is called.  Monitors as a rule should not modify the interface's
   * data lest they interfere with the subsequent primary workflow.  Logging is an
   * excellent example of a feature that might monitor interfaces without implementing
   * them.
   */
  monitors: {},
  /* emits is a list of interface names that this feature may call.  This information
   * is used by the program aggregator to test the program flow and prune features
   * that can not be triggered via the dependencies published by each included feature.
   * In order for an interface to be enabled in the assembled program, at least one
   * feature reachable via the program's workflow must declare it in the emits list.
   */
  emits: []
};
