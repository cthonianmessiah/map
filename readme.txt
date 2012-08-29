Copyright (c) 2012 ICRL

See the file license.txt for copying permission.


Welcome to map!  Thus far an early prototype, this is a modular programming paradigm designed by Gregory Dow.

In order to run map applications, you should have node installed on your machine and added to your command line.  Once that is done, you can start map from its home directory via:

node map.js

However, in order to get map to do anything other than spit out some garbled log data, you need to define an application for it to load and run.  This is done via the command line argument 'config'.

You can take a look at two pre-configured programs using the following command lines:

node map.js config=map_config_helloworld.js
node map.js config=map_config_maws.js

The first one simply returns hello world to the console, whereas the second starts a web server at localhost:8080 that does a simlar thing at http://localhost:8080/helloworld.txt.

You could create your own replacement module for any of these features and it would serve as a drop-in replacement for the existing module.  For example, you could replace the http server with a https server and still use the hello world responder feature.

Take a look at features/map.helloworld.js for a commented walkthrough of what a map feature should contain.