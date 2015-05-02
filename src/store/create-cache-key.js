export default function createCacheKey(store) {
  const storeOptions = store.storeOptions || {};

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
