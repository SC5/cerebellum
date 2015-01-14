var exoskeleton = require("./lib/wrapper/exoskeleton");

module.exports.server = function server(options, routeContext) {
  return require("./lib/server")(options, routeContext);
};

module.exports.client = function(options, routeContext) {
  return require("./lib/client")(options, routeContext);
};

module.exports.Collection = exoskeleton.Collection;
module.exports.Model = exoskeleton.Model;