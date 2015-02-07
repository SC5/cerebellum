var page = require('page');
var qs = require('qs');
var extend = require('vertebrae/utils').extend;
var Events = require('vertebrae/events');
var Store = require('./store');
var DOMReady = require('./domready');
var validateOptions = require('./lib/validate-options');
var utils = require('./lib/utils');
require('native-promise-only');
require('html5-history-api');

function Client(options, routeContext) {
  validateOptions(options);
  var client = this;
  var initializeCallback = options.initialize;
  var render = options.render;
  var routes = options.routes;
  var storeId = options.storeId;
  var stores = options.stores;
  extend(this, Events);

  var initStore = true;
  if (typeof options.initStore !== "undefined") {
    initStore = options.initStore;
  }

  if (initStore) {
    var storeOptions = {};
    if (options.autoClearCaches) {
      storeOptions.autoClearCaches = true;
    }
    if (typeof options.autoToJSON !== "undefined") {
      storeOptions.autoToJSON = options.autoToJSON;
    }
    if (typeof options.instantResolve !== "undefined") {
      storeOptions.instantResolve = options.instantResolve;
    }
    if (typeof options.allowedStatusCodes !== "undefined") {
      storeOptions.allowedStatusCodes = options.allowedStatusCodes;
    }
    var store = new Store(stores, storeOptions);
  }
  routeContext = routeContext || {};

  DOMReady.then(function() {
    if (initStore) {
      var storeState = document.getElementById(storeId);
      store.bootstrap( storeState.innerHTML );
      storeState.innerHTML = "";
    }

    Object.keys(routes).forEach(function(route) {
      page(route, function(ctx) {
        var context;
        var params = utils.extractParams(route, ctx.params);
        // add parsed query string object as last parameter for route handler
        var query = qs.parse(ctx.querystring);
        params.push(query);

        if (typeof routeContext === "function") {
          context = routeContext.call({});
        } else {
          context = routeContext;
        }

        Promise.resolve(context).then(function(context) {
          if (initStore) {
            context.store = store;
          }

          // do not invoke route handler directly if it provides title & fetch
          var routeHandler;
          if (routes[route].title && routes[route].fetch) {
            routeHandler = routes[route];
          } else {
            routeHandler = routes[route].apply(context, params);
          }

          return Promise.resolve(routeHandler).then(function(options) {
            return Promise.resolve(
              render.call(context, options, {params: ctx.params, query: query})
            ).then(function(result) {
              client.trigger("render", route);
              return result;
            });
          }).catch(function(error) {
            console.error("Render error while processing route "+ route +":", error);
          });
        });

      });
    });

    // init routes
    page();

    if (initializeCallback && typeof initializeCallback === "function") {
      DOMReady.then(function() {
        initializeCallback.call(null, {
          router: page,
          store: store
        });
      });
    }

  });

  return this;
};

module.exports = Client;
