var fs = require('fs');
var express = require('express');
var cheerio = require('cheerio');
var utils = require('./lib/utils');
var Store = require('./store');
var validateOptions = require('./lib/validate-options');
require('native-promise-only');

function Server(options, routeContext) {
  validateOptions(options);
  var appSettings = options.app;
  var middleware = options.middleware || [];
  var render = options.render;
  var routes = options.routes;
  var staticFiles = options.staticFiles;
  var storeId = options.storeId;
  var stores = options.stores;
  var autoToJSON = true;
  var initStore = true;
  var allowedStatusCodes = null;

  if (typeof options.autoToJSON !== "undefined") {
    autoToJSON = options.autoToJSON;
  }
  if (typeof options.initStore !== "undefined") {
    initStore = options.initStore;
  }
  if (typeof options.allowedStatusCodes !== "undefined") {
    allowedStatusCodes = options.allowedStatusCodes;
  }

  var app = express();
  routeContext = routeContext || {};

  if (!staticFiles || typeof staticFiles !== "string") {
    throw new Error("You must define staticFiles path for index.html");
  }

  var indexHTML = cheerio.load(fs.readFileSync(staticFiles +'/index.html', {
    encoding: "UTF-8"
  })).html();

  function stateSnapshot(document, json) {
    return document("#"+storeId).text(json);
  };

  var key;
  for (key in appSettings) {
    app.set(key, appSettings[key]);
  }

  middleware.forEach(function(mw) {
    if (mw.constructor === Array) {
      app.use.apply(app, mw);
    } else {
      app.use(mw);
    }
  });

  app.useStatic = function() {
    app.use( express.static(staticFiles) );
  };

  Object.keys(routes).forEach(function(route) {
    app.get(route, function(req, res) {
      var context;
      var params = utils.extractParams(route, req.params);
      // add parsed query string object as last parameter for route handler
      params.push(req.query);

      if (typeof routeContext === "function") {
        context = routeContext.call({}, req);
      } else {
        context = routeContext;
      }

      Promise.resolve(context).then(function(context) {
        if (initStore) {
          var options = {};

          if (req.headers.cookie) {
            options.cookie = req.headers.cookie;
          }
          options.autoToJSON = autoToJSON;
          options.allowedStatusCodes = allowedStatusCodes;
          context.store = new Store(stores, options);
        }

        return Promise.resolve(routes[route].apply(context, params)).then(function(options) {
          var document = cheerio.load(indexHTML);
          if (context.store) {
            stateSnapshot( document, context.store.snapshot() );
          }
          return res.send( render(document, options) );
        }).catch(function(error) {
          if (app.routeError && typeof app.routeError === "function") {
            app.routeError(error);
          }
          if (error.status && error.data) {
            return res.send("Error "+ error.status +": "+ error.data);
          } else {
            return res.send("Error: "+ error);
          }
        });
      });

    });
  });

  return app;
};

module.exports = Server;