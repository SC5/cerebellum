var director = require('director');
var Store = require('./store');
var Gator = require('./vendor/gator.shim');
require('native-promise-only');

var DOMReady = new Promise(function(resolve, reject) {
  if (document.readyState === 'complete') {
    resolve();
  } else {
    function onReady() {
      resolve();
      document.removeEventListener('DOMContentLoaded', onReady, true);
    }
    document.addEventListener('DOMContentLoaded', onReady, true);
  }
});

function Client(options) {
  var stores = options.stores;
  var routes = options.routes;
  var storeId = options.storeId;
  var initializeCallback = options.initialize;
  var render = options.render;
  var passthrough = options.passthrough || [];

  var store = new Store(stores);

  DOMReady.then(function() {
    store.import( document.getElementById(storeId).innerHTML );

    var router = director.Router().configure({
      html5history: true,
      notfound: function() {
        console.warn("Route handler for "+ this.path +" was not found.");
      }
    });

    var route;
    var action;
    for (route in routes) {
      action = routes[route];
      (function(route, action) {
        router.on(route, function() {
          var routeThis = {
            store: store
          };
          return action.apply(routeThis, arguments).then(function(options) {
            return render(options);
          }).catch(function(error) {
            console.error("Render error while processing route "+ route +":", error);
          });
        });
      })(route, action);
    }

    router.init();

    Gator(document).on('click', 'a', function(event) {
      var target = this;
      var href = target.href;
      var protocol = target.protocol +"//";
      var local = document.location.host === target.host;
      var relativeUrl = href != null ? href.slice(protocol.length + target.host.length) : void 0;
      var properLocal = local && relativeUrl.match(/^\//) && !relativeUrl.match(/#$/);

      var passThrough = passthrough.filter(function(url) {
        return (href && href.indexOf(url) > -1);
      }).length > 0;

      if (!passThrough && properLocal && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
        event.preventDefault();
        router.setRoute(target.href);
      }
    });

    if (initializeCallback && typeof initializeCallback === "function") {
      initializeCallback.call(null, {
        router: router,
        store: store
      });
    }

  });
};

module.exports = Client;
