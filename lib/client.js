var page = require('page');
var Store = require('./store');
var DOMReady = require('./domready');

function Client(options) {
  var stores = options.stores;
  var routes = options.routes;
  var storeId = options.storeId;
  var initializeCallback = options.initialize;
  var render = options.render;
  var store = new Store(stores);

  DOMReady.then(function() {
    store.import( document.getElementById(storeId).innerHTML );

    var route;
    var action;
    for (route in routes) {
      action = routes[route];
      (function(route, action) {
        page(route, function(ctx) {
          var params = Object.keys(ctx.params).map(function(key) {
            return ctx.params[key];
          });
          var routeThis = {
            store: store
          };
          return action.apply(routeThis, params).then(function(options) {
            return render(options);
          }).catch(function(error) {
            console.error("Render error while processing route "+ route +":", error);
          });
        });
      })(route, action);
    }

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
