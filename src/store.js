import 'native-promise-only';
import Cursor from 'immutable/contrib/cursor';
import Events from 'vertebrae/events';
import immstruct from 'immstruct';
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
    this.cached = (new immstruct.Immstruct()).get();

    // used for tracking stale caches, it's better to mark caches stale
    // and re-fetch than mutating the cache and causing glitchy re-renders
    this.staleCaches = [];

    // used for tracking ongoing fetch requests to prevent multiple
    // concurrent fetch calls to same API
    this.ongoingFetches = [];

    // empty instances of stores
    // clone actual instances from these
    this.stores = {};

    Object.keys(stores).forEach(storeId => {
      const store = stores[storeId];
      this.stores[storeId] = new store();
      this.cached.cursor().set(storeId, Immutable.fromJS({}));
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
        this.trigger(`create:${storeId}`, new Error("You can call create only for collections!"));
        return;
      }

      // optimistic create, save previous value for error scenario
      const previousCollection = this.cached.cursor([storeId, cacheKey]).deref();
      this.cached.cursor([storeId, cacheKey]).update(collection => {
        const newItem = Immutable.fromJS(attrs);
        if (collection) {
          return collection.push(newItem);
        } else {
          return new Immutable.List([newItem]);
        }
      });

      store.create(attrs, {
        success: (model, response) => {
          if (this.autoClearCaches) {
            this.clearCache(storeId, store.storeOptions);
          }
          this.trigger(`create:${storeId}`, null, {
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
          this.cached.cursor([storeId, cacheKey]).update(() => previousCollection);
          this.trigger(`create:${storeId}`, error);
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
        this.trigger(`update:${storeId}`, new Error("You can call update only for models!"));
        return;
      }

      // optimistic update, save previous value for error scenario
      const previousModel = this.cached.cursor([storeId, cacheKey]).deref();
      if (previousModel) {
        this.cached.cursor([storeId, cacheKey]).merge(attrs);
      }

      store.save(attrs, {
        success: (model, response) => {
          if (this.autoClearCaches) {
            this.clearCache(storeId, store.storeOptions);
          }
          this.trigger(`update:${storeId}`, null, {
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
            this.cached.cursor([storeId, cacheKey]).merge(previousModel);
          }
          this.trigger(`update:${storeId}`, error);
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
        this.trigger(`delete:${storeId}`, new Error("You can call destroy only for models!"));
        return;
      }

      // optimistic delete, save previous value for error scenario
      const previousModel = this.cached.cursor([storeId, cacheKey]).deref();
      this.cached.cursor(storeId).delete(cacheKey);

      store.destroy({
        success: (model, response) => {
          if (this.autoClearCaches) {
            this.clearCache(storeId, store.storeOptions);
          }
          this.trigger(`delete:${storeId}`, null, {
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
          this.cached.cursor(storeId).set(cacheKey, previousModel);
          this.trigger(`delete:${storeId}`, error);
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
      this.trigger(`expire:${storeId}`, null, {
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
      if (this.cached.cursor().getIn([storeId, cacheKey])) {
        this.staleCaches.push({id: storeId, key: cacheKey});
      }
    } else {
      // mark all caches for store stale if cacheKey doesn't exist
      Object.keys(this.cached.cursor().getIn([storeId]).toJS()).forEach(key => {
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
          if (this.cached.cursor().getIn([id, key])) {
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

    return this.cached.cursor().update(() => {
      return Immutable.fromJS(JSON.parse(json));
    });
  }

  // export snapshot of current caches to JSON
  snapshot() {
    return JSON.stringify(
      this.cached.cursor().toJSON()
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
      const cachedStore = this.cached.cursor([storeId, cacheKey]);
      const ongoingFetch = this.ongoingFetch(storeId, cacheKey);

      if (!this.isCacheStale(storeId, cacheKey) && cachedStore.size) {
        return resolve(cachedStore);
      } else {
        if (instantResolve) {
          resolve(Cursor.from(Immutable.fromJS(store.toJSON())));
        }
        if (ongoingFetch) {
          return ongoingFetch.promise.then(() => {
            if (instantResolve) {
              return this.trigger(`fetch:${storeId}`, null, this.cached.cursor([storeId, cacheKey]));
            } else {
              return resolve(this.cached.cursor([storeId, cacheKey]));
            }
          });
        } else {
          const fetchPromise = store.fetch(fetchOptions).catch(err => {
            const allowedStatus = this.allowedStatusCodes.some(statusCode => {
              return statusCode === err.status;
            });
            if (allowedStatus) {
              const result = Cursor.from(Immutable.fromJS(store.toJSON()));
              if (instantResolve) {
                return this.trigger(`fetch:${storeId}`, null, result);
              } else {
                return resolve(result);
              }
            } else {
              // reject for other statuses so error can be catched in router
              if (instantResolve) {
                return this.trigger(`fetch:${storeId}`, err);
              } else {
                return reject(err);
              }
            }
          });

          this.markFetchOngoing(storeId, cacheKey, fetchPromise);

          return fetchPromise.then(() => {
            const result = this.cached.cursor([storeId, cacheKey]).update(previousStore => {
              // TODO: figure out to a way to use merge here, it's problematic
              // with updates where List item is deleted
              // if (previousStore) {
              //   return previousStore.merge(store.toJSON());
              // } else {
              //   return Immutable.fromJS(store.toJSON());
              // }
              return Immutable.fromJS(store.toJSON());
            });

            if (instantResolve) {
              this.trigger(`fetch:${storeId}`, null, result);
            } else {
              resolve(result);
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
