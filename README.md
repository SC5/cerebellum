# cerebellum

Controls your isomorphic apps

## What does it do?

* Fully shared GET routes between server and client
* Fully shared data collections between server and client, uses Exoskeleton's collection for data (basically standalone Backbone collection)
* Has Axios adapter for collection, so you can use same collection AJAX methods on both server and client
* Stores the server state to JSON and client automatically bootstraps from that, no extra requests needed

## Store

* Store is still under evaluation for best practices

* Pass your collections in options as object (option.collections, see sample app for example). Store needs to have knowledge of all available collections for **import()** method.

* You can retrieve data from collection using **@store.get("collectionId")**, it fetches the data from server or uses cached data.

* Collection caches get populated after each **get()** or when calling **import()**

## Routes

* Pass your GET routes in options as object (options.routes, see sample app for example). They get picked by **client.js** and **server.js** and generate exactly same response in both environments.

* Currently you need to wrap your route handlers to promises, router expects all handlers to be promises.

* In route handler's **this** scope you have **this.store** which is the reference to Store instance, which contains all your collections. On server the store is initialized for every request and on client it's created once in the application's initialization phase. Server exports store contents to JSON at the end of request and client bootstraps itself from that data.

## TODO

* Add store observers to support updates, add support for single models as well
* Finish template app
* Better documentation & blog post