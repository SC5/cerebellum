# cerebellum
Copyright (C) SC5 Online 2014

Controls your isomorphic apps. 

Still under heavy development, expect breaking changes between 0.x releases.
This repository will be moved to Github soon.

## What does it do?

* Fully shared GET routes between server and client
* Fully shared data collections between server and client, uses Exoskeleton's collection & model
* Has Axios adapter for Exoskeleton, so you can use same AJAX methods on both server and client
* Stores collection/model state on server to JSON and browser client automatically bootstraps from that, no extra requests needed

## Store

* Store is still under evaluation for best practices

* Pass your collections and models in options as object (option.stores, see [sample app](https://bitbucket.org/SC5/cerebellum-app) for example). Store needs to have knowledge of all available collections&models for **import()** method.

* You can retrieve data from store using **@store.fetch("storeId")**, it fetches the data from server or uses cached data.

* Store caches are populated with **fetch()** or when calling **import()**

## Routes

* Pass your GET routes in options as object (options.routes, see [sample app](https://bitbucket.org/SC5/cerebellum-app) for example). They get picked by **client.js** and **server.js** and generate exactly same response in both environments.

* Currently you need to wrap your route handlers to promises, router expects all handlers to return promises.

* In route handler's **this** scope you have **this.store** which is the reference to Store instance, which contains all your stores. On the server Store is initialized for every request and on client it's created once in the application's initialization phase. Server exports store contents to JSON at the end of request and client bootstraps itself from that data.

## TODO

* Example app with authentication & real API usage
* Better documentation & introduction blog post