var Model = require('cerebellum').Model;
var apiConfig = require("../config/api");

var Page = Model.extend({
  cacheKey: function() {
    return this.storeOptions.id;
  },
  url: function() {
    return apiConfig.url +"/pages/"+ this.storeOptions.id +".json"
  }
});

module.exports = Page;