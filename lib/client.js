var page = require('page');
var Store = require('./store');
var DOMReady = require('./domready');
var validateOptions = require('./validate-options');
require('native-promise-only');
require('html5-history-api');

function Client(options, routeContext) {
  validateOptions(options);
  var stores = options.stores;
  var routes = options.routes;
  var storeId = options.storeId;
  var initializeCallback = options.initialize;
  var render = options.render;
  var storeOptions = {};
  if (options.autoClearCaches) {
    storeOptions.autoClearCaches = true;
  }
  if (typeof options.autoToJSON !== "undefined") {
    storeOptions.autoToJSON = options.autoToJSON;
  }
  var store = new Store(stores, storeOptions);
  routeContext = routeContext || {};

  DOMReady.then(function() {
    var storeState = document.getElementById(storeId);
    store.import( storeState.innerHTML );
    storeState.innerHTML = "";

    Object.keys(routes).forEach(function(route) {
      page(route, function(ctx) {
        var params = Object.keys(ctx.params).map(function(key) {
          return ctx.params[key];
        });
        routeContext.store = store;

        return Promise.resolve(routes[route].apply(routeContext, params)).then(function(options) {
          return render(options);
        }).catch(function(error) {
          console.error("Render error while processing route "+ route +":", error);
        });
      });
    });

    // init routes
    page();

    if (initializeCallback && typeof initializeCallback === "function") {
      initializeCallback.call(null, {
        router: page,
        store: store
      });
    }

  });
};

module.exports = Client;
