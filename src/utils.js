import pathToRegexp from 'path-to-regexp';

const Utils = {

  extractParams(route, params) {
    return pathToRegexp(route).keys.map(key => {
      return params[key.name];
    });
  }

};

export default Utils;
