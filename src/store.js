import 'native-promise-only';
import Events from 'vertebrae/events';
import Immutable from 'immutable';
import {extend} from 'vertebrae/utils';
import createCacheKey from './store/create-cache-key';

class Store {
  constructor(stores={}, options={}) {
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

    // which key should be considered as model identity when merging collections
    this.identifier = "id";
    if (typeof options.identifier !== "undefined") {
      this.identifier = options.identifier;
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
    this.cached = Immutable.Map();

    // used for tracking stale caches, it's better to mark caches stale
    // and re-fetch than mutating the cache and causing glitchy re-renders
    this.staleCaches = [];

    // used for tracking ongoing fetch requests to prevent multiple
    // concurrent fetch calls to same API
    this.ongoingFetches = [];

    // used for tracking temporarily disabled caches, failing fetch request
    // with non-allowed status code gets cached disabled for 60 seconds
    this.temporarilyDisabledCaches = [];

    // empty instances of stores
    // clone actual instances from these
    this.stores = {};

    Object.keys(stores).forEach(storeId => {
      const store = stores[storeId];
      this.stores[storeId] = new store();
      this.cached = this.cached.set(storeId, Immutable.fromJS({}));
    });

    // allows Store to be used as event bus
    extend(this, Events);
  }

  dispatch(action, storeId, storeOptions, attrs) {
    return this[action].call(this, storeId, storeOptions, attrs);
  }

  create(storeId, storeOptions, attrs) {
    return new Promise((resolve, reject) => {
      if (!attrs) {
        attrs = storeOptions;
        storeOptions = {};
      }

      const store = this.get(storeId);
      store.storeOptions = extend({}, storeOptions);
      const cacheKey = createCacheKey(store);

      if (typeof store.create !== "function") {
        // DEPRECATED
        this.trigger(`create:${storeId}`, new Error("You can call create only for collections!"));
        this.trigger("create", new Error("You can call create only for collections!"), {store: storeId});
        return;
      }

      // optimistic create, save previous value for error scenario
      const previousCollection = this.cached.getIn([storeId, cacheKey]);
      this.cached = this.cached.updateIn([storeId, cacheKey], collection => {
        const newItem = Immutable.fromJS(attrs);
        if (collection) {
          return collection.push(newItem);
        } else {
          return Immutable.List([newItem]);
        }
      });

      store.create(attrs, {
        success: (model, response) => {
          if (this.autoClearCaches) {
            this.clearCache(storeId, store.storeOptions);
          }
          // DEPRECATED
          this.trigger(`create:${storeId}`, null, {
            cacheKey: cacheKey,
            store: storeId,
            options: storeOptions,
            result: model
          });
          this.trigger("create", null, {
            cacheKey: cacheKey,
            store: storeId,
            options: storeOptions,
            result: model
          });
          resolve(model);
        },
        error: (model, response) => {
          const error = new Error(`Creating new item to store '${storeId}' failed`);
          error.store = storeId;
          error.result = response;
          error.options = storeOptions;
          this.cached = this.cached.updateIn([storeId, cacheKey], () => previousCollection);
          // DEPRECATED
          this.trigger(`create:${storeId}`, error);
          this.trigger("create", error, {store: storeId});
          reject(error);
        }
      });
    });
  }

  update(storeId, storeOptions, attrs) {
    return new Promise((resolve, reject) => {
      const store = this.get(storeId);
      store.storeOptions = extend({}, storeOptions);
      const cacheKey = createCacheKey(store);

      if (typeof store.save !== "function") {
        // DEPRECATED
        this.trigger(`update:${storeId}`, new Error("You can call update only for models!"));
        this.trigger("update", new Error("You can call update only for models!"), {store: storeId});
        return;
      }

      // optimistic update, save previous value for error scenario
      const previousModel = this.cached.getIn([storeId, cacheKey]);
      if (previousModel) {
        this.cached = this.cached.updateIn([storeId, cacheKey], previous => {
          return previous.merge(attrs);
        });
      }

      store.save(attrs, {
        success: (model, response) => {
          if (this.autoClearCaches) {
            this.clearCache(storeId, store.storeOptions);
          }
          // DEPRECATED
          this.trigger(`update:${storeId}`, null, {
            cacheKey: createCacheKey(store),
            store: storeId,
            options: storeOptions,
            result: model
          });
          this.trigger("update", null, {
            cacheKey: createCacheKey(store),
            store: storeId,
            options: storeOptions,
            result: model
          });
          resolve(model);
        },
        error: (model, response) => {
          const error = new Error(`Updating '${storeId}' failed`);
          error.store = storeId;
          error.result = response;
          error.options = storeOptions;
          if (previousModel) {
            this.cached = this.cached.updateIn([storeId, cacheKey], () => previousModel);
          }
          // DEPRECATED
          this.trigger(`update:${storeId}`, error);
          this.trigger("update", error, {store: storeId});
          reject(error);
        }
      });
    });
  }

  delete(storeId, storeOptions) {
    return new Promise((resolve, reject) => {
      const store = this.get(storeId);
      store.storeOptions = extend({}, storeOptions);
      // Model#destroy needs id attribute or it considers model new and triggers success callback straight away
      store.set("id", store.storeOptions.id);
      const cacheKey = createCacheKey(store);

      if (typeof store.destroy !== "function") {
        // DEPRECATED
        this.trigger(`delete:${storeId}`, new Error("You can call destroy only for models!"));
        this.trigger("delete", new Error("You can call destroy only for models!"), {store: storeId});
        return;
      }

      // optimistic delete, save previous value for error scenario
      const previousModel = this.cached.getIn([storeId, cacheKey]);
      this.cached = this.cached.deleteIn([storeId, cacheKey]);

      store.destroy({
        success: (model, response) => {
          if (this.autoClearCaches) {
            this.clearCache(storeId, store.storeOptions);
          }
          // DEPRECATED
          this.trigger(`delete:${storeId}`, null, {
            cacheKey: createCacheKey(store),
            store: storeId,
            options: storeOptions,
            result: model
          });
          this.trigger("delete", null, {
            cacheKey: createCacheKey(store),
            store: storeId,
            options: storeOptions,
            result: model
          });
          resolve(model);
        },
        error: (model, response) => {
          const error = new Error(`Deleting '${storeId}' failed`);
          error.store = storeId;
          error.result = response;
          error.options = storeOptions;
          this.cached = this.cached.setIn([storeId, cacheKey], previousModel);
          // DEPRECATED
          this.trigger(`delete:${storeId}`, error);
          this.trigger("delete", error, {store: storeId});
          reject(error);
        }
      });
    });
  }

  expire(storeId, storeOptions) {
    return new Promise((resolve, reject) => {
      const store = this.get(storeId);
      store.storeOptions = extend({}, storeOptions);
      this.clearCache(storeId, store.storeOptions);
      // DEPRECATED
      this.trigger(`expire:${storeId}`, null, {
        cacheKey: createCacheKey(store),
        store: storeId,
        options: storeOptions
      });
      this.trigger("expire", null, {
        cacheKey: createCacheKey(store),
        store: storeId,
        options: storeOptions
      });
      return resolve(storeId);
    });
  }

  clearCache(storeId, storeOptions) {
    let relatedCaches = {};
    let relatedCacheKeys = [];

    const store = this.get(storeId);
    if (!store) {
      return;
    }
    store.storeOptions = storeOptions;
    const cacheKey = createCacheKey(store);

    if (cacheKey) {
      // mark cache as stale
      if (this.cached.getIn([storeId, cacheKey])) {
        this.staleCaches.push({id: storeId, key: cacheKey});
      }
    } else {
      // mark all caches for store stale if cacheKey doesn't exist
      Object.keys(this.cached.getIn([storeId]).toJS()).forEach(key => {
        this.staleCaches.push({id: storeId, key: key});
      });
    }

    // mark related caches as stale
    if (typeof store.relatedCaches === "function") {
      relatedCaches = store.relatedCaches();
      relatedCacheKeys = Object.keys(relatedCaches);

      if (relatedCacheKeys.length) {
        relatedCacheKeys.forEach(id => {
          const key = relatedCaches[id];
          if (this.cached.getIn([id, key])) {
            this.staleCaches.push({id: id, key: key});
          }
        });
      }
    }
  }

  clearCookie() {
    this.cookie = null;
  }

  // bootstrap caches from JSON snapshot
  bootstrap(json) {
    if (!json) {
      return;
    }

    this.cached = this.cached.update(() => {
      return Immutable.fromJS(JSON.parse(json));
    });
    return this.cached;
  }

  // export snapshot of current caches to JSON
  snapshot() {
    return JSON.stringify(
      this.cached.toJSON()
    );
  }

  // returns cloned empty store instance
  get(storeId) {
    const store = this.stores[storeId];
    return (store ? store.clone() : null);
  }

  // checks if cache has gone stale
  isCacheStale(id, key) {
    return this.staleCaches.some(cache => {
      return cache.id === id && cache.key === key;
    });
  }

  // mark cache as not stale
  markCacheFresh(id, key) {
    this.staleCaches = this.staleCaches.filter(cache => {
      return cache.id !== id && cache.key !== key;
    });
  }

  ongoingFetch(id, key) {
    return this.ongoingFetches.filter(fetch => {
      return fetch.id === id && fetch.key === key.toString();
    })[0];
  }

  markFetchOngoing(id, key, promise) {
    this.ongoingFetches.push({
      id: id,
      key: key,
      promise: promise
    });
  }

  markFetchCompleted(id, key) {
    this.ongoingFetches = this.ongoingFetches.filter(fetch => {
      return fetch.id !== id && fetch.key !== key;
    });
  }

  disableCache(id, key) {
    this.temporarilyDisabledCaches.push({
      id: id,
      key: key,
      disabledUntil: (new Date()).getTime() + 60000 // disable for 60 seconds
    });
  }

  temporarilyDisabledCache(id, key) {
    return this.temporarilyDisabledCaches.filter(cache => {
      return (
        cache.disabledUntil > (new Date()).getTime() &&
        cache.id === id &&
        cache.key === key
      );
    })[0];
  }

  createFetchOptions() {
    const fetchOptions = {};
    if (this.cookie) {
      fetchOptions.headers = {'cookie': this.cookie};
    }
    return fetchOptions;
  }

  createStoreInstance(storeId, options) {
    const store = this.get(storeId);
    if (!store) {
      throw new Error(`Store ${storeId} not registered.`);
    }
    store.storeOptions = extend({}, options);
    return store;
  }

  // get store from cache or fetch from server
  // TODO: split to smaller parts, this is really complicated to comprehend
  fetch(storeId, options) {
    return new Promise((resolve, reject) => {
      const fetchOptions = this.createFetchOptions();
      const instantResolve = this.instantResolve;
      const store = this.createStoreInstance(storeId, options);
      const cacheKey = createCacheKey(store);
      if (!cacheKey) {
        reject(new Error(`Store ${storeId} has no cacheKey method.`));
      }
      const cachedStore = this.cached.getIn([storeId, cacheKey]);
      const ongoingFetch = this.ongoingFetch(storeId, cacheKey);
      const temporarilyDisabledCache = this.temporarilyDisabledCache(storeId, cacheKey);

      if (
        (!this.isCacheStale(storeId, cacheKey) && cachedStore && cachedStore.size) || temporarilyDisabledCache
      ) {
        return resolve(cachedStore);
      } else {
        if (instantResolve) {
          resolve(Immutable.fromJS(store.toJSON()));
        }
        if (ongoingFetch) {
          return ongoingFetch.promise.then(() => {
            if (instantResolve) {
              this.trigger("fetch", null, {store: storeId, value: this.cached.getIn([storeId, cacheKey])});
              // DEPRECATED
              return this.trigger(`fetch:${storeId}`, null, this.cached.getIn([storeId, cacheKey]));
            } else {
              return resolve(this.cached.getIn([storeId, cacheKey]));
            }
          });
        } else {
          const fetchPromise = store.fetch(fetchOptions).catch(err => {
            const allowedStatus = this.allowedStatusCodes.some(statusCode => {
              return statusCode === err.status;
            });
            if (allowedStatus) {
              const result = Immutable.fromJS(store.toJSON());
              if (instantResolve) {
                this.trigger("fetch", null, {store: storeId, value: result});
                // DEPRECATED
                return this.trigger(`fetch:${storeId}`, null, result);
              } else {
                return resolve(result);
              }
            } else {
              // reject for other statuses so error can be catched in router

              // disable cache for 60 seconds so we don't get in re-render loop
              this.disableCache(storeId, cacheKey);

              if (instantResolve) {
                // DEPRECATED
                this.trigger(`fetch:${storeId}`, err);
                this.trigger("fetch", err, {store: storeId});
              }
              return reject(err);
            }
          });

          this.markFetchOngoing(storeId, cacheKey, fetchPromise);

          return fetchPromise.then(() => {
            this.cached = this.cached.updateIn([storeId, cacheKey], previousStore => {
              // TODO: optimize
              if (previousStore) {
                const nextStore = Immutable.fromJS(store.toJSON());
                if (previousStore.findIndex) {
                  const identifier = this.identifier;
                  const mergedStore = previousStore.reduce((result, prevItem) => {
                    const index = nextStore.findIndex((item) => {
                      return item.get(identifier) === prevItem.get(identifier);
                    });
                    if (index !== -1) {
                      return result.set(result.indexOf(prevItem), prevItem.merge(nextStore.get(index)));
                    } else {
                      return result.delete(result.indexOf(prevItem));
                    }
                  }, previousStore).concat(
                    nextStore.filterNot((nextItem) => {
                      return previousStore.find((item) => {
                        return item.get(identifier) === nextItem.get(identifier);
                      });
                    })
                  );
                  return mergedStore;
                } else {
                  return previousStore.mergeDeep(nextStore);
                }
              } else {
                return Immutable.fromJS(store.toJSON());
              }
            });

            if (instantResolve) {
              // DEPRECATED
              this.trigger(`fetch:${storeId}`, null, this.cached.getIn([storeId, cacheKey]));
              this.trigger("fetch", null, {store: storeId, value: this.cached.getIn([storeId, cacheKey])});
            } else {
              resolve(this.cached.getIn([storeId, cacheKey]));
            }

            this.markCacheFresh(storeId, cacheKey);
            // wait 50ms before marking fetch completed to prevent multiple fetches
            // within small time window
            setTimeout(() => {
              this.markFetchCompleted(storeId, cacheKey);
            }, 50);
          });
        }

      }
    });
  }

  fetchAll(options={}) {
    const storeIds = Object.keys(options);
    return Promise.all(storeIds.map(storeId => {
      return this.fetch(storeId, options[storeId]);
    })).then(results => {
      return results.reduce((result, store, i) => {
        result[storeIds[i]] = store;
        return result;
      }, {});
    });
  }

}

export default Store;
