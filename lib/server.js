var fs = require('fs');
var express = require('express');
var cheerio = require('cheerio');

var utils = require('./utils');
var Store = require('./store');

function Server(options) {
  var collections = options.collections;
  var staticFiles = options.staticFiles;
  var storeId = options.storeId;
  var routes = options.routes;
  var render = options.render;
  var middlewares = options.middlewares;

  if (!staticFiles || typeof staticFiles !== "string") {
    throw new Error("You must define staticFiles path for index.html");
  }

  var indexHTML = cheerio.load(fs.readFileSync(staticFiles +'/index.html', {
    encoding: "UTF-8"
  }));

  function storeServerState(document, json) {
    return document("#"+storeId).text(json);
  };

  var app = express();

  var route;
  var action;
  for (route in routes) {
    action = routes[route];
    (function(route, action) {
      app.get(route, function(req, res) {
        var store = new Store(collections);
        var routeThis = {
          store: store
        };
        return action.apply(routeThis, utils.extractParams(req.params)).then(function(options) {
          var document = cheerio.load( indexHTML.html() );
          storeServerState( document, store.export() );
          return res.send( render(document, options) );
        }).catch(function(error) {
          return res.send("Error "+ error.status +": "+ error.data);
        });
      });
    })(route, action);
  }

  middlewares.forEach(function(middleware) {
    app.use( middleware );
  });

  app.use( express.static(staticFiles) );

  return app;
};

module.exports = Server;