import invariant from 'invariant';
import any from 'lodash/collection/any';
import without from 'lodash/array/without';
import omit from 'lodash/object/omit';
import APIClient from './api-client';
import {createCacheKey, idOrRoot} from './utils';
import {createActions} from './store';
import CollectionActions from './collection-actions';
import 'native-promise-only';

function createFetch(store, state, userConfig={}) {

  const config = {
    allowedStatuses: [401, 403],
    retries: 1,
    retryAgainAfter: 5000,
    stores: {},
    ...userConfig
  };

  invariant(
    store,
    "No store provided"
  );

  function ongoingFetch(storeId, params={}) {
    const state = store.cursor(["_cerebellum"]).deref();
    return state.ongoingFetches[createCacheKey(storeId, params)];
  }

  function markFetchOngoing(storeId, params={}, promise) {
    return store.cursor(["_cerebellum"]).update(previousState => {
      return {
        ...previousState,
        ongoingFetches: {
          ...previousState.ongoingFetches,
          [createCacheKey(storeId, params)]: promise
        }
      };
    });
  }

  function markFetchCompleted(storeId, params={}) {
    return store.cursor(["_cerebellum"]).update(previousState => {
      return {
        ...previousState,
        ongoingFetches: omit(
          previousState.ongoingFetches,
          createCacheKey(storeId, params)
        )
      };
    });
  }

  function isInitialFetchDone(storeId, params={}) {
    const state = store.cursor(["_cerebellum"]).deref();
    return state.initialFetchDone.indexOf(createCacheKey(storeId, params)) !== -1;
  }

  function markInitialFetchDone(storeId, params={}) {
    return store.cursor(["_cerebellum"]).update(previousState => {
      const key = createCacheKey(storeId, params);
      if (previousState.initialFetchDone.indexOf(key) === -1) {
        return {
          ...previousState,
          initialFetchDone: [
            ...previousState.initialFetchDone,
            key
          ]
        };
      } else {
        return previousState;
      }
    });
  }

  function isErrorLimited(storeId, params={}) {
    const state = store.cursor(["_cerebellum"]).deref();
    const errorsLog = state.errorsLog[createCacheKey(storeId, params)];
    const lastErrors = (errorsLog || []).slice(-config.retries);

    if (lastErrors.length === config.retries) {
      return ((Date.now() - lastErrors[0]) < config.retryAgainAfter);
    } else {
      return false;
    }
  }

  function logError(storeId, params={}) {
    return store.cursor(["_cerebellum"]).update(previousState => {
      const key = createCacheKey(storeId, params);
      return {
        ...previousState,
        errorsLog: {
          ...previousState.errorsLog,
          [key]: [...(previousState.errorsLog[key] || []), Date.now()]
        }
      };
    });
  }

  function isCacheStale(storeId, params={}) {
    const state = store.cursor(["_cerebellum"]).deref();
    const key = createCacheKey(storeId, params);
    return any(state.staleCaches, (cacheKey) => {
      return cacheKey === key;
    });
  }

  function markCacheFresh(storeId, params={}) {
    return store.cursor(["_cerebellum"]).update(previousState => {
      return {
        ...previousState,
        staleCaches: without(
          previousState.staleCaches,
          createCacheKey(storeId, params)
        )
      };
    });
  }

  function isAllowedStatus(statusCode) {
    return config.allowedStatuses.some(status => {
      return status === statusCode;
    });
  }

  function fetchAPI(storeId, fetchOptions) {
    const apiPromise = new Promise((resolve, reject) => {
      const {url} = config.stores[storeId];
      const options = {
        url: url(fetchOptions),
        method: 'get',
        headers: config.headers || {}
      };
      APIClient(options).then(response => {
        return resolve(response);
      }).catch(err => {
        const currentState = store.get(storeId);

        if (Array.isArray(currentState)) {
          return reject(new Error(`Store ${storeId} should be an object, is array`));
        }

        if (!err.status) {
          return reject(err);
        }

        if (isAllowedStatus(err.status)) {
          return resolve(
            currentState[idOrRoot(fetchOptions)]
          );
        } else {
          return reject();
        }
      });
    });
    markFetchOngoing(storeId, fetchOptions, apiPromise);
    return apiPromise;
  }

  function fetch(storeId, fetchOptions={}) {

    // immediately resolve for stores without config (non-persisted stores)
    if (!config.stores[storeId]) {
      const currentState = store.get(storeId);
      if (currentState) {
        return Promise.resolve(currentState);
      } else {
        return Promise.reject(
          new Error(`Store ${storeId} not found`)
        );
      }
    }

    // immediately resolve if fetchOptions is a function
    if (typeof fetchOptions === "function") {
      return Promise.resolve(fetchOptions(store.get(storeId)));
    }

    return new Promise((resolve, reject) => {
      let result;
      const currentState = store.get(storeId)[idOrRoot(fetchOptions)];
      const ongoingFetchPromise = ongoingFetch(storeId, fetchOptions);

      if (
        isCacheStale(storeId, fetchOptions) ||
        !isInitialFetchDone(storeId, fetchOptions)
      ) {
        if (ongoingFetchPromise) {
          result = ongoingFetchPromise;
        } else {
          result = fetchAPI(storeId, fetchOptions)
          // handling side-effects
          .then((response) => {
            // replace whole collection after fetch
            const actions = createActions(state, {[storeId]: CollectionActions()});
            actions[storeId].replace(fetchOptions, response);

            markCacheFresh(storeId, fetchOptions);
            markInitialFetchDone(storeId, fetchOptions);

            // wait 50ms before marking fetch completed to prevent
            // multiple fetches within small time window
            setTimeout(() => {
              markFetchCompleted(storeId, fetchOptions);
            }, 50);
            return response;
          }).catch((err) => {
            logError(storeId, fetchOptions);

            if (isErrorLimited(storeId, fetchOptions)) {
              markCacheFresh(storeId, fetchOptions);
              markInitialFetchDone(storeId, fetchOptions);
            }

            markFetchCompleted(storeId, fetchOptions);
            return currentState;
          });
        }
      } else {
        result = Promise.resolve(currentState);
      }

      return resolve(result);
    });
  }

  function fetchAll(options={}) {
    const storeIds = Object.keys(options);
    return Promise.all(storeIds.map(storeId => {
      return fetch(storeId, options[storeId]);
    })).then(results => {
      return results.reduce((result, props, i) => {
        result[storeIds[i]] = props;
        return result;
      }, {});
    });
  }

  return {
    fetch,
    fetchAll
  };

}

export default createFetch;
