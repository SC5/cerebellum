var extend = require('vertebrae/utils').extend;
var Events = require('vertebrae/Events');
require('native-promise-only');

function createStoreOptions(options) {
  var storeOptions = {};
  for (key in options) {
    if (options.hasOwnProperty(key)) {
      storeOptions[key] = options[key];
    }
  }
  return storeOptions;
};

function createCacheKey(store) {
  // if store is collection
  if (typeof store.create === "function") {
    if (typeof store.cacheKey === "function") {
      return store.cacheKey();
    } else {
      // for collection empty cache key is ok as there's only a single cache per collection
      return store.cacheKey ? store.cacheKey : "/";
    }
  } else { // store is model
    if (typeof store.cacheKey === "function") {
      return store.cacheKey();
    } else {
      // fallback to model's id as cache key, fetch will reject if it does not exist
      return store.cacheKey ? store.cacheKey : store.storeOptions.id;
    }
  }
};

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

    // automatically clear caches after mutation operations, default off
    if (options.autoClearCaches) {
      this.autoClearCaches = true;
    }

    // call toJSON() for stores in fetch automatically, default on
    this.autoToJSON = true;
    if (typeof options.autoToJSON !== "undefined") {
      this.autoToJSON = options.autoToJSON;
    }

    // instantly resolve "fetch" promise, for non-blocking rendering on client side
    // use "fetch" event to re-render when this is enabled
    this.instantResolve = false;
    if (typeof options.instantResolve !== "undefined") {
      this.instantResolve = options.instantResolve;
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

    // allows Store to be used as event bus
    extend(this, Events);

    // callbacks expect: storeId, storeOptions, params
    this.on({
      "create": this.onCreate,
      "update": this.onUpdate,
      "delete": this.onDelete,
      "expire": this.onExpire
    });
  }

  Store.prototype.onCreate = function onCreate(storeId, storeOptions, attrs) {
    if (!attrs) {
      attrs = storeOptions;
      storeOptions = {};
    }

    var self = this;
    var store = this.get(storeId);
    store.storeOptions = createStoreOptions(storeOptions);

    if (typeof store.create !== "function") {
      self.trigger("create:"+storeId, new Error("You can call create only for collections!"));
      return;
    }

    store.create(attrs, {
      success: function(model, response) {
        var cacheKey = createCacheKey(store);
        if (self.autoClearCaches) {
          self.clearCache(storeId, cacheKey);
        }
        self.trigger("create:"+storeId, null, {
          cacheKey: cacheKey,
          store: storeId,
          options: storeOptions,
          result: model
        });
      },
      error: function(model, response) {
        self.trigger("create:"+storeId, new Error(response));
      }
    });
  };

  Store.prototype.onUpdate = function onUpdate(storeId, storeOptions, attrs) {
    var self = this;
    var store = this.get(storeId);
    store.storeOptions = createStoreOptions(storeOptions);

    if (typeof store.save !== "function") {
      self.trigger("update:"+storeId, new Error("You can call update only for models!"));
      return;
    }

    store.save(attrs, {
      success: function(model, response) {
        var cacheKey = createCacheKey(store);
        if (self.autoClearCaches) {
          self.clearCache(storeId, cacheKey);
        }
        self.trigger("update:"+storeId, null, {
          cacheKey: cacheKey,
          store: storeId,
          options: storeOptions,
          result: model
        });
      },
      error: function(model, response) {
        self.trigger("update:"+storeId, new Error(response));
      }
    });
  };

  Store.prototype.onDelete = function onDelete(storeId, storeOptions) {
    var self = this;
    var store = this.get(storeId);
    store.storeOptions = createStoreOptions(storeOptions);
    // Model#destroy needs id attribute or it considers model new and triggers success callback straight away
    store.set("id", store.storeOptions.id);

    if (typeof store.destroy !== "function") {
      self.trigger("delete:"+storeId, new Error("You can call destroy only for models!"));
      return;
    }

    store.destroy({
      success: function(model, response) {
        var cacheKey = createCacheKey(store);
        if (self.autoClearCaches) {
          self.clearCache(storeId, cacheKey);
        }
        self.trigger("delete:"+storeId, null, {
          cacheKey: cacheKey,
          store: storeId,
          options: storeOptions,
          result: model
        });
      },
      error: function(model, response) {
        self.trigger("delete:"+storeId, new Error(response));
      }
    });
  };

  Store.prototype.onExpire = function onExpire(storeId, storeOptions) {
    var store = this.get(storeId);
    store.storeOptions = createStoreOptions(storeOptions);
    var cacheKey = createCacheKey(store);
    this.clearCache(storeId, cacheKey);
    this.trigger("expire:"+storeId, null, {
      cacheKey: cacheKey,
      store: storeId,
      options: storeOptions
    });
  };

  Store.prototype.clearCache = function clearCache(storeId, cacheKey) {
    if (this.cached[storeId] && this.cached[storeId][cacheKey]) {
      delete this.cached[storeId][cacheKey];
    }
  };

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

  // returns cloned empty store instance
  Store.prototype.get = function(storeId) {
    var store = this.stores[storeId];
    return (store ? store.clone() : null);
  };

  // get store from cache or fetch from server
  Store.prototype.fetch = function(storeId, options) {
    var fetchOptions = {};
    var autoToJSON = this.autoToJSON;
    var self = this;
    var store, key, cacheKey, cachedStore;

    if (this.cookie) {
      fetchOptions.headers = {'cookie': this.cookie};
    }

    return new Promise(function(resolve, reject) {
      store = self.get(storeId);
      if (!store) {
        reject(new Error("Store " + storeId + " not registered."));
      }

      store.storeOptions = createStoreOptions(options);
      cacheKey = createCacheKey(store);
      if (!cacheKey) {
        reject(new Error("Store " + storeId + " has no cacheKey method."));
      }

      cachedStore = self.cached[storeId][cacheKey];

      if (cachedStore) {
        return resolve(autoToJSON ? cachedStore.toJSON() : cachedStore);
      } else {
        if (self.instantResolve) {
          resolve(autoToJSON ? store.toJSON() : store);
        }
        return store.fetch(fetchOptions).then(function() {
          self.cached[storeId][cacheKey] = store;
          if (self.instantResolve) {
            return self.trigger("fetch:"+storeId, null, autoToJSON ? store.toJSON() : store);
          } else {
            return resolve(autoToJSON ? store.toJSON() : store);
          }
        }).catch(function(err) {
          // TODO: make this list configurable?
          // return empty store with these status codes
          // this allows us to show proper data for logged-in users
          // and prevents error for users who are not logged-in
          var allowedStatusCodes = [401, 403];
          var allowedStatus = allowedStatusCodes.some(function(statusCode) {
            return statusCode === err.status;
          });
          if (allowedStatus) {
            if (self.instantResolve) {
              return self.trigger("fetch:"+storeId, null, store);
            } else {
              return resolve(store);
            }
          } else {
            // reject for other statuses so
            // error can be catched in router
            if (self.instantResolve) {
              return self.trigger("fetch:"+storeId, err);
            } else {
              return reject(err);
            }
          }
        });
      }
    });
  };

  return Store;
})();

module.exports = Store;
