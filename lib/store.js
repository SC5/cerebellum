var extend = require('vertebrae/utils').extend;
var Events = require('vertebrae/events');
var immstruct = require('immstruct');
var Immutable = require('immutable');
var Cursor = require('immutable/contrib/cursor');
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

    // instantly resolve "fetch" promise, for non-blocking rendering on client side
    // use "fetch" event to re-render when this is enabled
    this.instantResolve = false;
    if (typeof options.instantResolve !== "undefined") {
      this.instantResolve = options.instantResolve;
    }

    // automatically clear caches after mutation operations, default true
    this.autoClearCaches = true;
    if (typeof options.autoClearCaches !== "undefined") {
      this.autoClearCaches = options.autoClearCaches;
    }

    // allowed status codes
    // return empty store with these status codes
    // this allows us to show proper data for logged-in users
    // and prevents error for users who are not logged-in
    this.allowedStatusCodes = [401, 403];
    if (Array.isArray(options.allowedStatusCodes)) {
      this.allowedStatusCodes = options.allowedStatusCodes;
    }

    // used for storing all collection/model data, fetch returns
    // fresh cursors to this structure
    var localImmstruct = new immstruct.Immstruct();
    this.cached = localImmstruct.get();

    // used for tracking stale caches, it's better to mark caches stale
    // and re-fetch than mutating the cache and causing glitchy re-renders
    this.staleCaches = [];

    // used for tracking ongoing fetch requests to prevent multiple
    // concurrent fetch calls to same API
    this.ongoingFetches = [];

    // empty instances of stores
    // clone actual instances from these
    this.stores = {};

    for (id in stores) {
      store = stores[id];
      this.stores[id] = new store();
      this.cached.cursor().set(id, Immutable.fromJS({}));
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

    var cacheKey;
    var self = this;
    var store = this.get(storeId);
    store.storeOptions = extend({}, storeOptions);
    cacheKey = createCacheKey(store);

    if (typeof store.create !== "function") {
      self.trigger("create:"+storeId, new Error("You can call create only for collections!"));
      return;
    }

    // optimistic create, save previous value for error scenario
    var previousCollection = this.cached.cursor([storeId, cacheKey]).deref();
    this.cached.cursor([storeId, cacheKey]).update(function(collection) {
      var newItem = Immutable.Map(attrs);
      if (collection) {
        return collection.push(newItem);
      } else {
        return new Immutable.List([newItem]);
      }
    });

    store.create(attrs, {
      success: function(model, response) {
        if (self.autoClearCaches) {
          self.clearCache(storeId, store.storeOptions);
        }
        self.trigger("create:"+storeId, null, {
          cacheKey: cacheKey,
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
        self.cached.cursor([storeId, cacheKey]).update(function() {
          return previousCollection;
        });
        self.trigger("create:"+storeId, error);
      }
    });
  };

  Store.prototype.onUpdate = function onUpdate(storeId, storeOptions, attrs) {
    var cacheKey;
    var self = this;
    var store = this.get(storeId);
    store.storeOptions = extend({}, storeOptions);
    cacheKey = createCacheKey(store);

    if (typeof store.save !== "function") {
      self.trigger("update:"+storeId, new Error("You can call update only for models!"));
      return;
    }

    // optimistic update, save previous value for error scenario
    var previousModel = this.cached.cursor([storeId, cacheKey]).deref();
    if (previousModel) {
      this.cached.cursor([storeId, cacheKey]).mergeDeep(attrs);
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
        if (previousModel) {
          self.cached.cursor([storeId, cacheKey]).mergeDeep(previousModel);
        }
        self.trigger("update:"+storeId, error);
      }
    });
  };

  Store.prototype.onDelete = function onDelete(storeId, storeOptions) {
    var cacheKey;
    var self = this;
    var store = this.get(storeId);
    store.storeOptions = extend({}, storeOptions);
    // Model#destroy needs id attribute or it considers model new and triggers success callback straight away
    store.set("id", store.storeOptions.id);
    cacheKey = createCacheKey(store);

    if (typeof store.destroy !== "function") {
      self.trigger("delete:"+storeId, new Error("You can call destroy only for models!"));
      return;
    }

    // optimistic delete, save previous value for error scenario
    var previousModel = this.cached.cursor([storeId, cacheKey]).deref();
    this.cached.cursor(storeId).delete(cacheKey);

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
        self.cached.cursor(storeId).set(cacheKey, previousModel);
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
      // mark cache as stale
      if (this.cached.cursor().getIn([storeId, cacheKey])) {
        this.staleCaches.push({id: storeId, key: cacheKey});
      }
    } else {
      // mark all caches for store stale if cacheKey doesn't exist
      Object.keys(this.cached.cursor().getIn([storeId]).toJS()).forEach(function(key) {
        self.staleCaches.push({id: storeId, key: key});
      });
    }

    // mark related caches as stale
    if (typeof store.relatedCaches === "function") {
      relatedCaches = store.relatedCaches();
    } else {
      relatedCaches = {};
    }
    relatedCacheKeys = Object.keys(relatedCaches);
    if (relatedCacheKeys.length) {
      relatedCacheKeys.forEach(function(id) {
        var key = relatedCaches[id];
        if (self.cached.cursor().getIn([id, key])) {
          self.staleCaches.push({id: id, key: key});
        }
      });
    }
  };

  Store.prototype.clearCookie = function() {
    this.cookie = null;
  };

  // bootstrap caches from JSON snapshot
  Store.prototype.bootstrap = function(json) {
    if (!json) {
      return;
    }

    return this.cached.cursor().update(function() {
      return Immutable.fromJS(JSON.parse(json));
    });
  };

  // export snapshot of current caches to JSON
  Store.prototype.snapshot = function() {
    return JSON.stringify(this.cached.cursor().toJSON());
  };

  // returns cloned empty store instance
  Store.prototype.get = function(storeId) {
    var store = this.stores[storeId];
    return (store ? store.clone() : null);
  };

  // checks if cache has gone stale
  Store.prototype.isCacheStale = function(id, key) {
    return this.staleCaches.some(function(cache) {
      return cache.id === id && cache.key === key;
    });
  };

  // mark cache as not stale
  Store.prototype.markCacheFresh = function(id, key) {
    this.staleCaches = this.staleCaches.filter(function(cache) {
      return cache.id !== id && cache.key !== key;
    });
  };

  Store.prototype.ongoingFetch = function(id, key) {
    return this.ongoingFetches.filter(function(fetch) {
      return fetch.id === id && fetch.key === key.toString();
    })[0];
  };

  Store.prototype.markFetchOngoing = function(id, key, promise) {
    this.ongoingFetches.push({
      id: id,
      key: key,
      promise: promise
    });
  };

  Store.prototype.markFetchCompleted = function(id, key) {
    this.ongoingFetches = this.ongoingFetches.filter(function(fetch) {
      return fetch.id !== id && fetch.key !== key;
    });
  };

  Store.prototype.createFetchOptions = function() {
    var fetchOptions = {};
    if (this.cookie) {
      fetchOptions.headers = {'cookie': this.cookie};
    }
    return fetchOptions;
  };

  Store.prototype.createStoreInstance = function(storeId, options) {
    var store = this.get(storeId);
    if (!store) {
      throw new Error("Store " + storeId + " not registered.");
    }
    store.storeOptions = extend({}, options);
    return store;
  };

  // get store from cache or fetch from server
  Store.prototype.fetch = function(storeId, options) {
    var fetchOptions = this.createFetchOptions();
    var self = this;
    var instantResolve = this.instantResolve;
    var store, key, cacheKey, cachedStore, ongoingFetch;

    return new Promise(function(resolve, reject) {
      store = self.createStoreInstance(storeId, options);
      cacheKey = createCacheKey(store);
      if (!cacheKey) {
        reject(new Error("Store " + storeId + " has no cacheKey method."));
      }

      cachedStore = self.cached.cursor([storeId, cacheKey]);
      ongoingFetch = self.ongoingFetch(storeId, cacheKey);

      if (!self.isCacheStale(storeId, cacheKey) && cachedStore.size) {
        return resolve(cachedStore);
      } else {
        if (instantResolve) {
          resolve(Cursor.from(Immutable.fromJS(store.toJSON())));
        }
        if (ongoingFetch) {
          return ongoingFetch.promise.then(function() {
            if (instantResolve) {
              return self.trigger("fetch:"+storeId, null, self.cached.cursor([storeId, cacheKey]));
            } else {
              return resolve(self.cached.cursor([storeId, cacheKey]));
            }
          });
        } else {
          var fetchPromise = store.fetch(fetchOptions);
          self.markFetchOngoing(storeId, cacheKey, fetchPromise);
          return fetchPromise.then(function() {
            var result = self.cached.cursor([storeId, cacheKey]).update(function(previousStore) {
              if (previousStore) {
                return previousStore.mergeDeep(store.toJSON());
              } else {
                return Immutable.fromJS(store.toJSON());
              }
            });
            if (instantResolve) {
              self.trigger("fetch:"+storeId, null, result);
            } else {
              resolve(result);
            }
            self.markCacheFresh(storeId, cacheKey);
            // wait 50ms before marking fetch completed to prevent multiple fetches
            // within small time window
            setTimeout(function() {
              self.markFetchCompleted(storeId, cacheKey);
            }, 50);
          }).catch(function(err) {
            var allowedStatus = self.allowedStatusCodes.some(function(statusCode) {
              return statusCode === err.status;
            });
            if (allowedStatus) {
              var result = Cursor.from(Immutable.fromJS(store.toJSON()));
              if (instantResolve) {
                return self.trigger("fetch:"+storeId, null, result);
              } else {
                return resolve(result);
              }
            } else {
              // reject for other statuses so error can be catched in router
              if (instantResolve) {
                return self.trigger("fetch:"+storeId, err);
              } else {
                return reject(err);
              }
            }
          });
        }

      }
    });
  };

  Store.prototype.fetchAll = function(options) {
    var self = this;
    var storeIds = Object.keys(options);
    return Promise.all(storeIds.map(function(storeId) {
      return self.fetch(storeId, options[storeId]);
    })).then(function(results) {
      return results.reduce(function(result, store, i) {
        result[storeIds[i]] = store;
        return result;
      }, {});
    });
  };

  return Store;
})();

module.exports = Store;
