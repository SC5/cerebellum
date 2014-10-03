var director = require('director');
var Store = require('./store');
var Gator = require('./vendor/gator.shim');

function Client(options) {
  var stores = options.stores;
  var routes = options.routes;
  var storeId = options.storeId;
  var initializeCallback = options.initialize;
  var render = options.render;
  var passthrough = options.passthrough || [];

  var store = new Store(stores);

  document.addEventListener("DOMContentLoaded", function() {
    store.import( document.getElementById(storeId).innerHTML );

    var router = director.Router().configure({
      html5history: true
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
