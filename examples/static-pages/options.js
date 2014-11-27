var routes = require('./routes');
var page = require('./stores/page');

module.exports = {
  staticFiles: __dirname+"/public",
  storeId: "store_state_from_server",
  appId: "app",
  routes: routes, // shared routes required from routes.js
  stores: {
    page: page
  }
};