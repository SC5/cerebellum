var exoskeleton = require("./wrapper/exoskeleton");
require('native-promise-only');

var Store = (function() {
  function Store(stores, options) {
    var store, id;
    if (options == null) {
      options = {};
    }

    // store cookie for server side API request authentication
    if (options.cookie) {
      this.cookie = options.cookie;
    }

    this.stores = {};
    for (id in stores) {
      store = stores[id];
      this.stores[id] = new store();
    }
  }

  exoskeleton.utils.extend(Store.prototype, exoskeleton.Events);

  Store.prototype.clearCookie = function() {
    this.cookie = null;
  };

  // set caches from initial JSON
  Store.prototype.import = function(json) {
    var stores, data, id;
    if (!json) {
      return;
    }
    stores = JSON.parse(json);
    for (id in stores) {
      data = stores[id];
      this.stores[id].set(data);
    }
    return true;
  };

  // export current cached stores to JSON
  Store.prototype.export = function() {
    var store, stores, id;
    stores = {};
    for (id in this.stores) {
      store = this.stores[id];
      stores[id] = store.toJSON();
    }
    return JSON.stringify(stores);
  };

  // returns store instance
  Store.prototype.get = function(storeId) {
    return this.stores[storeId];
  };

  // get store from cache or fetch from server
  Store.prototype.fetch = function(storeId) {
    var options = {};
    if (this.cookie) {
       options.headers = {'cookie': this.cookie};
    }
    var self = this;
    return new Promise(function(resolve, reject) {
      var store = self.stores[storeId];
      if (!store) {
        reject(new Error("Store " + storeId + " not registered"));
      }

      var cachedCollection = (!!store.length && store.length > 0);
      var cachedModel = (!!store.isNew && !store.isNew());

      if (cachedCollection || cachedModel) {
        return resolve(store);
      } else {
        return store.fetch(options).then(function() {
          return resolve(store);
        }).catch(function(err) {
          // TODO: handle error somehow
          return resolve(store);
        });
      }
    });
  };

  return Store;
})();

module.exports = Store;
