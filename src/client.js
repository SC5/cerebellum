import 'html5-history-api';
import 'native-promise-only';
import DOMReady from './domready';
import Events from 'vertebrae/events';
import page from 'page';
import qs from 'qs';
import Store from './store';
import utils from './utils';
import validateOptions from './validate-options';
import {extend} from 'vertebrae/utils';

function defaultRouteHandler(handler, params) {
  return handler.apply(this, params);
}

function createStoreOptions(options={}) {
  const storeOptions = {};

  if (options.autoClearCaches) {
    storeOptions.autoClearCaches = true;
  }

  if (typeof options.autoToJSON !== "undefined") {
    storeOptions.autoToJSON = options.autoToJSON;
  }

  if (typeof options.instantResolve !== "undefined") {
    storeOptions.instantResolve = options.instantResolve;
  }

  if (typeof options.allowedStatusCodes !== "undefined") {
    storeOptions.allowedStatusCodes = options.allowedStatusCodes;
  }

  return storeOptions;
}

function Client(options={}, routeContext={}) {
  validateOptions(options);

  // ensure proper initial state for page.js
  page.stop();
  page.callbacks = [];
  page.exits = [];

  const {
    initialize: initializeCallback,
    initStore = true,
    initialUrl,
    render,
    routes,
    routeHandler = defaultRouteHandler,
    storeId,
    stores
  } = options;

  const clientEvents = extend({}, Events);
  const store = initStore ? new Store(stores, createStoreOptions(options)) : null;

  DOMReady.then(() => {

    if (initStore) {
      const storeState = document.getElementById(storeId);
      store.bootstrap( storeState.innerHTML );
      storeState.innerHTML = "";
    }

    // register page.js handler for each route
    Object.keys(routes).forEach(route => {

      page(route, ctx => {
        const context = (typeof routeContext === "function")
          ? routeContext.call({})
          : routeContext;

        // return array of params in proper order
        const params = utils.extractParams(route, ctx.params);

        // add parsed query string object as last parameter for route handler
        const query = qs.parse(ctx.querystring);
        params.push(query);

        Promise.resolve(context).then(context => {
          if (initStore) {
            context.store = store;
          }

          return Promise.resolve(
            routeHandler.call(context, routes[route], params)
          ).then(options => {
            return Promise.resolve(
              render.call(context, options, {params: ctx.params, query: query})
            ).then(result => {
              clientEvents.trigger("render", route);
              return result;
            });
          }).catch(error => {
            // log error as user hasn't handled it
            console.error(`Render error while processing route ${route}:, ${error}`);
          });
        });

      });
    });

    // initialize page.js route handling
    page(initialUrl);

    // invoke initialize callback if it was provided in options
    if (initializeCallback && typeof initializeCallback === "function") {
      initializeCallback.call(null, {
        router: page,
        store: store
      });
    }

  });

  return clientEvents;
};

export default Client;
