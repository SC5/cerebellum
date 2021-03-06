import 'native-promise-only';
import cheerio from 'cheerio';
import express from 'express';
import Store from './store';
import utils from './utils';
import serverUtils from './server-utils';
import validateOptions from './validate-options';

function defaultRouteHandler(handler, params) {
  return handler.apply(this, params);
}

function Server(options={}, routeContext={}) {
  validateOptions(options);

  const {
    app: appSettings = [],
    entries = {
      path: null,
      routes: {}
    },
    middleware = [],
    render,
    routes,
    routeHandler = defaultRouteHandler,
    staticFiles,
    storeId,
    stores,
    identifier,
    autoToJSON = true,
    initStore = true,
    allowedStatusCodes = null
  } = options;

  if (!staticFiles || typeof staticFiles !== "string") {
    throw new Error("You must define staticFiles path for index.html");
  }

  // preload all entry files on startup
  const entryFiles = serverUtils.loadEntries(entries, staticFiles);
  const app = express();

  // useful for delaying the static middleware injection
  app.useStatic = () => {
    app.use( express.static(staticFiles) );
  };

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
            allowedStatusCodes: allowedStatusCodes,
            identifier: identifier
          };

          if (req.headers.cookie) {
            options.cookie = req.headers.cookie;
          }

          context.store = new Store(stores, options);
        }

        return Promise.resolve(
          routeHandler.call(context, routes[route], params)
        ).then(options => {
          const document = cheerio.load(serverUtils.entryHTML(entryFiles, req));

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
          if (error.status && error.stack) {
            return res.send(`Error ${error.status}: ${error.stack}`);
          } else {
            return res.send(`Error: ${error.stack} ${JSON.stringify(error)}`);
          }
        });
      });

    });
  });

  return app;
};

export default Server;
