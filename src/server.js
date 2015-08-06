import 'native-promise-only';
import cheerio from 'cheerio';
import express from 'express';
import API from './api';
import {createState, createStore} from './store';
import utils from './utils';
import serverUtils from './server-utils';
import validateOptions from './validate-options';

function defaultRouteHandler(handler, params) {
  return handler.apply(this, params);
}

function Server(state, options={}, routeContext={}) {
  validateOptions(options);

  const {
    actions = {},
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
    stores = {},
    initStore = true,
    allowedStatusCodes = [401, 403]
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

      Promise.resolve(context).then(renderContext => {
        if (initStore) {
          const apiConfig = {
            allowedStatuses: allowedStatusCodes,
            stores: stores
          };

          if (req.headers.cookie) {
            apiConfig.headers = {'Cookie': req.headers.cookie};
          }

          renderContext.store = createStore(
            createState(state),
            actions
          );
          renderContext.api = API(renderContext.store, apiConfig);
        }

        return Promise.resolve(
          routeHandler.call(renderContext, routes[route], params)
        ).then(routeOptions => {
          const document = cheerio.load(serverUtils.entryHTML(entryFiles, req));

          // store state snapshot to HTML document
          if (renderContext.store) {
            document(`#${storeId}`).text(
              renderContext.store.snapshot()
            );
          }

          return Promise.resolve(
            render.call(renderContext, document, routeOptions, {
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
      }).catch(routeErr => {
        return res.send(`Error: ${routeErr.stack}`);
      });

    });
  });

  return app;
}

export default Server;
