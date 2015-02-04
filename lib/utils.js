var pathToRegexp = require('path-to-regexp');

var Utils = {
  extractParams: function(route, params) {
    return pathToRegexp(route).keys.map(function(key) {
      return params[key.name];
    });
  }
};

module.exports = Utils;