var exoskeleton = require("./lib/wrapper/exoskeleton");

module.exports.server = function server(options, routeContext) {
  return require("./lib/server")(options, routeContext);
};

module.exports.client = function(options, routeContext) {
  return require("./lib/client")(options, routeContext);
};

module.exports.Store = require('./lib/store');
module.exports.Collection = exoskeleton.Collection;
module.exports.Model = exoskeleton.Model;
module.exports.DOMReady = function() {
  return require('./lib/domready');
}