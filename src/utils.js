import pathToRegexp from 'path-to-regexp';

export function createCacheKey(storeId, params={}) {
  return [storeId, params.collectionId].join("_");
}

export function extractParams(route, params) {
  return pathToRegexp(route).keys.map(key => {
    return params[key.name];
  });
}

export function idOrRoot(params) {
  return typeof params === "object" && params.collectionId
    ? params.collectionId
    : "/";
}

export default {
  createCacheKey,
  extractParams,
  idOrRoot
};
