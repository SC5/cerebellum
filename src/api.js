import APIClient from './api-client';
import createFetch from './fetch';
import {createCacheKey} from './utils';
import observers from './observers';

function API(store, state, config={}) {

  function markCacheStale(storeId, params={}) {
    return store.cursor(["_cerebellum"]).update(previousState => {
      return {
        ...previousState,
        staleCaches: [
          ...previousState.staleCaches,
          createCacheKey(storeId, params)
        ]
      };
    });
  }

  const actions = {

    create(storeId, params, props) {
      const {url} = config.stores[storeId];
      return APIClient({
        url: url(params),
        data: props,
        method: 'post'
      }).then(() => {
        markCacheStale(storeId, params);
        store.logEvent(storeId, "create success", params, props);
      }).catch(err => {
        markCacheStale(storeId, params);
        store.logEvent(storeId, "create fail", params, props, err);
      });
    },

    update(storeId, params, props) {
      const {url} = config.stores[storeId];
      return APIClient({
        url: url(params),
        data: props,
        method: 'post'
      }).then(() => {
        markCacheStale(storeId, params);
        store.logEvent(storeId, "update success", params, props);
      }).catch(err => {
        markCacheStale(storeId, params);
        store.logEvent(storeId, "update fail", params, props, err);
      });
    },

    remove(storeId, params) {
      const {url} = config.stores[storeId];
      return APIClient({
        url: url(params),
        method: 'delete'
      }).then(() => {
        markCacheStale(storeId, params);
        store.logEvent(storeId, "remove success", params);
      }).catch(err => {
        markCacheStale(storeId, params);
        store.logEvent(storeId, "remove fail", params, err);
      });
    },

    expire(storeId, params) {
      markCacheStale(storeId, params);
      store.logEvent(storeId, "expire success", params);
    }
  };

  // ensure that cerebellum namespace exists in state
  store.cursor(["_cerebellum"]).update((previousState) => {
    if (!previousState) {
      return {
        errorsLog: {},
        initialFetchDone: [],
        ongoingFetches: [],
        staleCaches: {}
      };
    } else {
      return previousState;
    }
  });

  const unobserves = Object.keys(config.stores).map(storeId => {
    return store.observe(storeId, (log) => {
      if (actions.hasOwnProperty(log.action)) {
        actions[log.action](storeId, ...log.args);
      }
    });
  });

  const {fetch, fetchAll} = createFetch(store, state, config);
  // we need to keep track of observers so that previous observers
  // are unsubscribed on hot reload
  const observe = observers.init("cerebellum/api");
  observe.addMany(unobserves);

  return {
    unobserve: () => unobserves.forEach(fn => fn()),
    fetch,
    fetchAll
  };
}

export default API;
