var fs = require('fs');
var express = require('express');
var cheerio = require('cheerio');

var utils = require('./utils');
var Store = require('./store');

function Server(options) {
  var stores = options.stores;
  var staticFiles = options.staticFiles;
  var storeId = options.storeId;
  var routes = options.routes;
  var render = options.render;
  var middleware = options.middleware;
  var appSettings = options.app;

  if (!staticFiles || typeof staticFiles !== "string") {
    throw new Error("You must define staticFiles path for index.html");
  }

  var indexHTML = cheerio.load(fs.readFileSync(staticFiles +'/index.html', {
    encoding: "UTF-8"
  })).html();

  function storeServerState(document, json) {
    return document("#"+storeId).text(json);
  };

  var app = express();

  var key;
  for (key in appSettings) {
    app.set(key, appSettings[key]);
  }

  middleware.forEach(function(mw) {
    app.use( mw );
  });

  app.useStatic = function() {
    app.use( express.static(staticFiles) );
  };

  var route;
  var action;
  for (route in routes) {
    action = routes[route];
    (function(route, action) {
      app.get(route, function(req, res) {
        var options = {};
        if (req.headers.cookie) {
          options.cookie = req.headers.cookie;
        }
        var store = new Store(stores, options);
        var routeThis = {
          store: store
        };
        return action.apply(routeThis, utils.extractParams(req.params)).then(function(options) {
          var document = cheerio.load( indexHTML );
          storeServerState( document, store.export() );
          return res.send( render(document, options) );
        }).catch(function(error) {
          if (error.status && error.data) {
            return res.send("Error "+ error.status +": "+ error.data);
          } else {
            return res.send("Error: "+ error);
          }
        });
      });
    })(route, action);
  }

  return app;
};

module.exports = Server;