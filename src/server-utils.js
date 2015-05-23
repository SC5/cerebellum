import fs from 'fs';
import path from 'path';
import cheerio from 'cheerio';
import pathToRegexp from 'path-to-regexp';
import 'babel/polyfill';

function loadHTML(path) {
  return cheerio.load(fs.readFileSync(path, {encoding: "UTF-8"})).html();
}

const ServerUtils = {

  loadEntries(entries, staticFiles) {
    const entryPath = entries.path ? entries.path : staticFiles;

    // always fallback to index.html
    const defaultEntry = {
      "*": {
        regExp: null,
        html: loadHTML(path.join(entryPath, "index.html"))
      }
    };

    const routeEntries = Object.keys(entries.routes).reduce((result, route) => {
      const entry = path.join(entryPath, entries.routes[route]);
      result[route] = {
        regExp: pathToRegexp(route),
        html: loadHTML(entry)
      };
      return result;
    }, {});

    return {...defaultEntry, ...routeEntries};
  },

  entryHTML(entryFiles, req) {
    const entryPath = Object.keys(entryFiles).find(path => {
      if (path === "*") {
        return false;
      }
      return entryFiles[path].regExp.test(req.path);
    });

    // always fallback to index.html if route not matched
    if (entryPath) {
      return entryFiles[entryPath].html;
    } else {
      return entryFiles["*"].html;
    }
  }

};

export default ServerUtils;
