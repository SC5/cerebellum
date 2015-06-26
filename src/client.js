import 'html5-history-api';
import 'native-promise-only';
import DOMReady from './domready';
import Events from 'vertebrae/events';
import page from 'page';
import qs from 'qs';
import API from './api';
import {createState, createStore} from './store';
import utils from './utils';
import validateOptions from './validate-options';

function defaultRouteHandler(handler, params) {
  return handler.apply(this, params);
}

function createAPIConfig(options={}) {
  const apiConfig = {};

  if (typeof options.allowedStatusCodes !== "undefined") {
    apiConfig.allowedStatuses = options.allowedStatusCodes;
  }

  apiConfig.stores = options.stores;

  return apiConfig;
}

function Client(options={}, routeContext={}) {
  validateOptions(options);

  // ensure proper initial state for page.js
  page.stop();
  page.callbacks = [];
  page.exits = [];

  const {
    actions = {},
    initialize: initializeCallback,
    initialState = {},
    initStore = true,
    initialUrl,
    render,
    routes,
    routeHandler = defaultRouteHandler,
    storeId,
    stores = {}
  } = options;

  const clientEvents = {...Events};
  let store = null;
  let api = null;

  if (initStore) {
    store = createStore(
      createState(initialState),
      actions
    );
    api = API(store, createAPIConfig(options));
  }

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

        Promise.resolve(context).then(renderContext => {
          if (initStore) {
            renderContext.store = store;
            renderContext.api = api;
          }

          return Promise.resolve(
            routeHandler.call(renderContext, routes[route], params)
          ).then(routeOptions => {
            return Promise.resolve(
              render.call(
                renderContext,
                document,
                routeOptions,
                {
                  params: ctx.params,
                  query: query
                }
              )
            ).then(result => {
              clientEvents.trigger("render", route);
              return result;
            });
          }).catch(error => {
            // log error as user hasn't handled it
            console.error(
              `Render error while processing route ${route}:, ${error.stack}`
            );
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
}

export default Client;
