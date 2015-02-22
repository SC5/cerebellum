var extend = require('vertebrae/utils').extend;
var Events = require('vertebrae/events');
require('native-promise-only');

function createCacheKey(store) {
  var storeOptions = store.storeOptions || {};
  // if store is collection
  if (typeof store.create === "function") {
    if (typeof store.cacheKey === "function") {
      return store.cacheKey();
    } else {
      // for collection empty cache key is ok when there's only a single collection
      return store.cacheKey ? store.cacheKey : (storeOptions.id || "/");
    }
  } else { // store is model
    if (typeof store.cacheKey === "function") {
      return store.cacheKey();
    } else {
      // fallback to model's id as cache key, fetch will reject if it does not exist
      return store.cacheKey ? store.cacheKey : storeOptions.id;
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

    // allowed status codes
    // return empty store with these status codes
    // this allows us to show proper data for logged-in users
    // and prevents error for users who are not logged-in
    this.allowedStatusCodes = [401, 403];
    if (Array.isArray(options.allowedStatusCodes)) {
      this.allowedStatusCodes = options.allowedStatusCodes;
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

    // alias 'trigger' as 'dispatch'
    this.dispatch = this.trigger;

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
    store.storeOptions = extend({}, storeOptions);

    if (typeof store.create !== "function") {
      self.trigger("create:"+storeId, new Error("You can call create only for collections!"));
      return;
    }

    store.create(attrs, {
      success: function(model, response) {
        if (self.autoClearCaches) {
          self.clearCache(storeId, store.storeOptions);
        }
        self.trigger("create:"+storeId, null, {
          cacheKey: createCacheKey(store),
          store: storeId,
          options: storeOptions,
          result: model
        });
      },
      error: function(model, response) {
        var error = new Error("Creating new item to store '" + storeId + "' failed");
        error.store = storeId;
        error.result = response;
        error.options = storeOptions;
        self.trigger("create:"+storeId, error);
      }
    });
  };

  Store.prototype.onUpdate = function onUpdate(storeId, storeOptions, attrs) {
    var self = this;
    var store = this.get(storeId);
    store.storeOptions = extend({}, storeOptions);

    if (typeof store.save !== "function") {
      self.trigger("update:"+storeId, new Error("You can call update only for models!"));
      return;
    }

    store.save(attrs, {
      success: function(model, response) {
        if (self.autoClearCaches) {
          self.clearCache(storeId, store.storeOptions);
        }
        self.trigger("update:"+storeId, null, {
          cacheKey: createCacheKey(store),
          store: storeId,
          options: storeOptions,
          result: model
        });
      },
      error: function(model, response) {
        var error = new Error("Updating '" + storeId + "' failed");
        error.store = storeId;
        error.result = response;
        error.options = storeOptions;
        self.trigger("update:"+storeId, error);
      }
    });
  };

  Store.prototype.onDelete = function onDelete(storeId, storeOptions) {
    var self = this;
    var store = this.get(storeId);
    store.storeOptions = extend({}, storeOptions);
    // Model#destroy needs id attribute or it considers model new and triggers success callback straight away
    store.set("id", store.storeOptions.id);

    if (typeof store.destroy !== "function") {
      self.trigger("delete:"+storeId, new Error("You can call destroy only for models!"));
      return;
    }

    store.destroy({
      success: function(model, response) {
        if (self.autoClearCaches) {
          self.clearCache(storeId, store.storeOptions);
        }
        self.trigger("delete:"+storeId, null, {
          cacheKey: createCacheKey(store),
          store: storeId,
          options: storeOptions,
          result: model
        });
      },
      error: function(model, response) {
        var error = new Error("Deleting '" + storeId + "' failed");
        error.store = storeId;
        error.result = response;
        error.options = storeOptions;
        self.trigger("delete:"+storeId, error);
      }
    });
  };

  Store.prototype.onExpire = function onExpire(storeId, storeOptions) {
    var store = this.get(storeId);
    store.storeOptions = extend({}, storeOptions);
    this.clearCache(storeId, store.storeOptions);
    this.trigger("expire:"+storeId, null, {
      cacheKey: createCacheKey(store),
      store: storeId,
      options: storeOptions
    });
  };

  Store.prototype.clearCache = function clearCache(storeId, storeOptions) {
    var cacheKey, relatedCaches, relatedCacheKeys;
    var self = this;
    var store = this.get(storeId);
    if (!store) {
      return;
    }
    store.storeOptions = storeOptions;
    cacheKey = createCacheKey(store);
    if (cacheKey) {
      // clear cache for store
      if (this.cached[storeId] && this.cached[storeId][cacheKey]) {
        delete this.cached[storeId][cacheKey];
      }

      // clear related caches
      if (typeof store.relatedCaches === "function") {
        relatedCaches = store.relatedCaches();
      } else {
        relatedCaches = {};
      }
      relatedCacheKeys = Object.keys(relatedCaches);
      if (relatedCacheKeys.length) {
        relatedCacheKeys.forEach(function(id) {
          var key = relatedCaches[id];
          if (self.cached[id] && self.cached[id][key]) {
            delete self.cached[id][key];
          }
        });
      }
    }
  };

  Store.prototype.clearCookie = function() {
    this.cookie = null;
  };

  // bootstrap caches from JSON snapshot
  Store.prototype.bootstrap = function(json) {
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

  // export snapshot of current caches to JSON
  Store.prototype.snapshot = function() {
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

      store.storeOptions = extend({}, options);
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
          var allowedStatus = self.allowedStatusCodes.some(function(statusCode) {
            return statusCode === err.status;
          });
          if (allowedStatus) {
            if (self.instantResolve) {
              return self.trigger("fetch:"+storeId, null, store);
            } else {
              return resolve(store);
            }
          } else {
            // reject for other statuses so error can be catched in router
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

  Store.prototype.fetchAll = function(options) {
    var self = this;
    var storeIds = Object.keys(options);
    return Promise.all(storeIds.map(function(storeId) {
      return self.fetch(storeId, options[storeId]);
    })).then(function(results) {
      var result = {};
      for (var i = 0; i < storeIds.length; i++) {
        result[storeIds[i]] = results[i];
      };
      return result;
    });
  };

  return Store;
})();

module.exports = Store;
