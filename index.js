var ajax = require('vertebrae/adapters/axios');
var Sync = require('vertebrae/sync')({ajax: ajax});
var Model = require('vertebrae/model')({sync: Sync});
var Collection = require('vertebrae/collection')({sync: Sync}, Model);

module.exports.server = function server(options, routeContext) {
  return require("./lib/server")(options, routeContext);
};

module.exports.client = function(options, routeContext) {
  return require("./lib/client")(options, routeContext);
};

module.exports.Store = require('./store');
module.exports.Collection = Collection;
module.exports.Model = Model;
module.exports.DOMReady = function() {
  return require('./lib/domready');
}