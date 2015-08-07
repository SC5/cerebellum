module.exports.API = require('./lib/api');
module.exports.createActions = require('./lib/store').createActions;
module.exports.createState = require('./lib/store').createState;
module.exports.createStore = require('./lib/store').createStore;
module.exports.observers = require('./lib/observers');

module.exports.DOMReady = function() {
  return require('./lib/domready');
}
