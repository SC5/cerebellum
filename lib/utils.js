var pathToRegexp = require('path-to-regexp');

var Utils = {
  extractParams: function(route, params) {
    var routeKeys = [];
    pathToRegexp(route, routeKeys);
    return routeKeys.map(function(key) {
      return params[key.name];
    });
  }
};

module.exports = Utils;