var exoskeleton = require("./wrapper/exoskeleton");
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
    exoskeleton.utils.extend(this, exoskeleton.Events);

    // callbacks expect: storeId, storeOptions, params
    this.on({
      "create": this.onCreate,
      "update": this.onUpdate,
      "delete": this.onDelete
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
        if (self.autoClearCaches) {
          self.clearCache(storeId, store.cacheKey());
        }
        self.trigger("create:"+storeId, null, {
          cacheKey: store.cacheKey(),
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
        if (self.autoClearCaches) {
          self.clearCache(storeId, store.cacheKey());
        }
        self.trigger("update:"+storeId, null, {
          cacheKey: store.cacheKey(),
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

    if (typeof store.destroy !== "function") {
      self.trigger("delete:"+storeId, new Error("You can call destroy only for models!"));
      return;
    }

    store.destroy({
      success: function(model, response) {
        if (self.autoClearCaches) {
          self.clearCache(storeId, store.cacheKey());
        }
        self.trigger("delete:"+storeId, null, {
          cacheKey: store.cacheKey(),
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
          // We can't reject here, should resolve with 401 & 403 etc.
          // TODO: handle other error statuses somehow
          return resolve(store);
        });
      }
    });
  };

  return Store;
})();

module.exports = Store;
