module.exports.server = function server(options, routeContext) {
  return require("./lib/server")(options, routeContext);
};

module.exports.client = function(options, routeContext) {
  return require("./lib/client")(options, routeContext);
};

module.exports.API = require('./lib/api');
module.exports.createStore = require('./lib/store').createStore;
module.exports.createState = require('./lib/store').createState;

module.exports.DOMReady = function() {
  return require('./lib/domready');
}
