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

    // this.cached is used for storing actual instances
    this.cached = {};

    // empty instances of stores
    // clone actual instances from these
    this.stores = {};

    for (id in stores) {
      store = stores[id];
      this.stores[id] = new store();
      this.cached[id] = {};
    }
  }

  // allows Store to be used as event bus
  exoskeleton.utils.extend(Store.prototype, exoskeleton.Events);

  Store.prototype.clearCookie = function() {
    this.cookie = null;
  };

  // set caches from initial JSON
  Store.prototype.import = function(json) {
    var cachedStores, stores, storeId, id;

    if (!json) {
      return;
    }

    cachedStores = JSON.parse(json);
    for (storeId in cachedStores) {
      stores = cachedStores[storeId];
      this.cached[storeId] = {};

      for (id in stores) {
        this.cached[storeId][id] = this.get(storeId).clone();
        this.cached[storeId][id].set(stores[id]);
      }
    }

    return true;
  };

  // export current cached stores to JSON
  Store.prototype.export = function() {
    var stores, cachedStores, storeId, id;

    cachedStores = {};
    for (storeId in this.cached) {
      stores = this.cached[storeId];
      cachedStores[storeId] = {};
      for (id in stores) {
        cachedStores[storeId][id] = stores[id].toJSON();
      }
    }
    return JSON.stringify(cachedStores);
  };

  // returns empty store instance, clone from result of this
  Store.prototype.get = function(storeId) {
    return this.stores[storeId];
  };

  // get store from cache or fetch from server
  Store.prototype.fetch = function(storeId, options) {
    var fetchOptions = {};
    var self = this;
    var store, key, cacheKey, cachedStore;

    if (this.cookie) {
      fetchOptions.headers = {'cookie': this.cookie};
    }

    return new Promise(function(resolve, reject) {
      store = self.get(storeId);
      if (!store) {
        reject(new Error("Store " + storeId + " not registered"));
      }

      // don't modify the original store instance
      store = store.clone();
      store.storeOptions = {};
      for (key in options) {
        if (options.hasOwnProperty(key)) {
          store.storeOptions[key] = options[key];
        }
      }

      if (!store.cacheKey) {
        reject(new Error("Store " + storeId + " has no cacheKey method."));
      }

      cacheKey = store.cacheKey();
      cachedStore = self.cached[storeId][cacheKey];

      if (cachedStore) {
        return resolve(cachedStore);
      } else {
        return store.fetch(fetchOptions).then(function() {
          self.cached[storeId][cacheKey] = store;
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
