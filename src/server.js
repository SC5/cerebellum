import 'native-promise-only';
import cheerio from 'cheerio';
import express from 'express';
import fs from 'fs';
import path from 'path';
import Store from './store';
import utils from './utils';
import validateOptions from './validate-options';

function Server(options={}, routeContext={}) {
  validateOptions(options);

  const {
    app: appSettings = [],
    middleware = [],
    render,
    routes,
    staticFiles,
    storeId,
    stores,
    autoToJSON = true,
    initStore = true,
    allowedStatusCodes = null
  } = options;

  if (!staticFiles || typeof staticFiles !== "string") {
    throw new Error("You must define staticFiles path for index.html");
  }

  const app = express();

  // useful for delaying the static middleware injection
  app.useStatic = () => {
    app.use( express.static(staticFiles) );
  };

  const indexHTML = cheerio.load(
    fs.readFileSync(path.join(staticFiles, "index.html"), {
      encoding: "UTF-8"
    })
  ).html();

  appSettings.forEach(key => {
    app.set(key, appSettings[key]);
  });

  middleware.forEach(mw => {
    if (mw.constructor === Array) {
      app.use.apply(app, mw);
    } else {
      app.use(mw);
    }
  });

  Object.keys(routes).forEach(route => {

    app.get(route, (req, res) => {
      const context = (typeof routeContext === "function")
        ? routeContext.call({}, req)
        : routeContext;

      // return array of params in proper order
      const params = utils.extractParams(route, req.params);

      // add parsed query string object as last parameter for route handler
      params.push(req.query);

      Promise.resolve(context).then(context => {
        if (initStore) {
          const options = {
            autoToJSON: autoToJSON,
            allowedStatusCodes: allowedStatusCodes
          };

          if (req.headers.cookie) {
            options.cookie = req.headers.cookie;
          }

          context.store = new Store(stores, options);
        }

        // don't invoke route handler directly if it provides title & stores as properties / functions
        // this is an optimization for React to keep routes pretty
        const routeHandler = (routes[route].title && routes[route].stores)
          ? routes[route]
          : routes[route].apply(context, params);

        return Promise.resolve(routeHandler).then(options => {
          const document = cheerio.load(indexHTML);

          // store state snapshot to HTML document
          if (context.store) {
            document(`#${storeId}`).text(context.store.snapshot());
          }

          return Promise.resolve(
            render.call(context, document, options, {
              params: req.params,
              query: req.query
            })
          ).then(response => {
            return res.send(response);
          });
        }).catch(error => {
          if (app.routeError && typeof app.routeError === "function") {
            app.routeError(error);
          }
          if (error.status && error.data) {
            return res.send(`Error ${error.status}: ${error.data}`);
          } else {
            return res.send(`Error: ${error.stack}`);
          }
        });
      });

    });
  });

  return app;
};

export default Server;
