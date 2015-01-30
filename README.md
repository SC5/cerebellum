## Cerebellum.js

[![Gitter](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/SC5/cerebellum?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

Cerebellum.js is a powerful set of tools that help you structure your isomorphic apps, just add your preferred view engine.

Cerebellum is designed for single-page apps that need search engine visibility. Same code works on server and client.

### What does it do?

* Fully shared GET routes between server and client
* Fully shared data stores between server and client, uses [Vertebrae's](https://github.com/hoppula/vertebrae/) Collection & Model with [Axios](https://github.com/mzabriskie/axios) adapter, so you can use the same REST APIs everywhere.
* Stores the server state snapshot to JSON and browser client will automatically bootstrap from that, so you don't need to do any extra requests on client side.
* Uses [express.js](http://expressjs.com/) router on server and [page.js](https://github.com/visionmedia/page.js) router on browser. Both use same [route format](https://github.com/pillarjs/path-to-regexp), so you can use named parameters, optional parameters and regular expressions in your routes.
* Automatic SEO, no hacks needed for server side rendering. 
* You can easily make apps that work even when JavaScript is disabled in browser
* Fast initial load for mobile clients, browser bootstraps from server state and continues as a single-page app without any extra configuration.
* Can be used with any framework that provides rendering for both server and client. [React.js](http://facebook.github.io/react/) recommended, see [examples/static-pages](https://github.com/SC5/cerebellum/tree/master/examples/static-pages).

## Data flow

Cerebellum's data flow is in many ways similar to [Flux architecture](https://facebook.github.io/flux/), but it has some key differences.

![cerebellum data flow](http://i.imgur.com/S6M9wiS.png "Cerebellum data flow")

### Server and Client

1) User requests a page, first server/client will ask from router to check for matching route.

2) When router finds a matching route handler, it will query Store's stores (models & collections) for data.

3) Store will either call APIs (always on server) or use cached data (never on server). Store returns data to route handler and route handler returns view component with data to client.

4) Server/client renders the returned view component.

### Client only (green arrows)

**All rendering happens through router in Cerebellum, every data refresh requires invoking route handler.**

Views can trigger change events to stores (create, update, delete, expire) which will be handled by Store. Store calls corresponding store API and triggers an event (create:storeName, update:storeName, delete:storeName or expire:storeName).

Client can listen for these events. In store event callbacks you can clear caches and re-render current route (or invoke another route handler). There's also an option to automatically clear caches for stores.

## Store

Store is responsible for handling all data operations in Cerebellum.

You register your collections and models (stores) to Store by passing them to server and client constructors in **options.stores** (see "Stores (stores.js)" section below for more details).

Store will automatically snapshot its state on server and client will bootstrap Store from that state. Client will also cache all additional API requests, but you can easily clear caches when fresh data is needed.

### Models, Collections === read only

You should treat your models and collections as read only, all mutations are handled by Store with **create**, **update**, **delete** and **expire** events.

### Fetching data inside routes

You can retrieve data from a store using **fetch(storeId, options)**. Route's **this** context includes Store instance (**this.store**) that is used for all data retrieval.

When fetching collections, you don't usually need any parameters, so you can do:

```javascript
this.store.fetch("posts").then(...);
```

If your store needs to fetch dynamic data (models usually do), pass options to **fetch** as second parameter. For example, if you need to fetch model by id, your options would be `{id: id}`.

```javascript
this.store.fetch("post", {id: id}).then(...);
```

### Caches and cacheKeys

Store will populate its internal cache when calling **fetch()**. So when you request same data in different route on client, Store will return the cached data.

Your models and collections can have `cacheKey` method, it defines the path where data will be cached in Store's cache. Store will automatically generate the `cacheKey` for collections and models if you don't provide one. Note that the model needs to be fetched with `id` parameter for automatic `cacheKey` generation. 

If you want to use **fetch** options as part of `cacheKey`, you can access them using `this.storeOptions`.

```javascript
var Model = require('cerebellum').Model;

var Post = Model.extend({
  cacheKey: function() {
    return "posts/" + this.storeOptions.id;
  },
  url: function() {
    return "/posts/" + this.storeOptions.id + ".json";
   }
});
```

### Triggering changes

Pass router's store instance to your view components and
call `store.trigger` with **create**, **update**, **delete** or **expire**.

For example, you would create a new post to "posts" collection by calling:

```javascript
store.trigger("create", "posts", {title: "New post", body: "Body text"});
```

You can update a model with:

```javascript
store.trigger("update", "post", {id: id}, {
  title: "New post",
  body: "New body text"
});
```

Store will then execute the API call to url defined in given store and fire an appropriate callback when it finishes.

### Expiring caches and re-rendering routes

You can listen for store events in your client.js. Make sure to wait for client's initialize callback to finish before placing event handlers.

```javascript
options.initialize = function(client) {
  var store = client.store;
  var router = client.router;
  store.on("create:posts", function(err, data) {
    console.log(data.store) // => posts
    console.log(data.result); // => {id: 3423, title: "New post", body: "Body text"}
    router("/posts"); // navigate to posts index, will re-fetch posts from API as cache was cleared
  });

  store.on("update:post", function(err, data) {
    // explicitly clear posts collection in addition to automatically cleared post model
    store.clearCache("posts", "posts");
    router.replace("/posts/" + data.options.id); // re-render route, posts collection & post model will be re-fetched
  });

};

// clear caches automatically after create, update & delete
options.autoClearCaches = true;

cerebellum.client(options);
```

## Options

You can define all options in both server.js & client.js, but it usually makes sense to create a shared `options.js` for shared options.

### Options (options.js)

example `options.js` with default values, these options are shared with client & server constructors.

```javascript
var stores = require('./stores');
var routes = require('./routes');

module.exports = {
  routes: routes,
  storeId: "store_state_from_server",
  stores: stores,
  autoToJSON: true,
  autoClearCaches: false,
  initStore: true,
  instantResolve: false
};
```

#### routes

Object of route paths and route handlers. Best practice is to put these to their own file instead of bloating options.js, see **"Routes (routes.js)"** documentation below.

#### storeId

DOM ID in index.html where server stores the JSON snapshot that client will use for bootstrapping Store.

#### stores

Object containining store ids and stores. Best practice is to put these to their own file as well, see **"Stores (stores.js)"** documentation below.

#### autoToJSON

Call **toJSON()** automatically for **fetch** results. Defaults to true, set to false if you need to mutate your stores in route handlers before passing them to views as JSON (not encouraged, you should override **toJSON** instead).

#### autoClearCaches

Automatically clear the client Store cache for affected collection or model. Defaults to false. If this is not enabled you need to explicitly clear the caches in event handlers.

#### initStore

Initialize store for route handlers (**this.store**). Defaults to true. Disable if you want to perform the data retrieval elsewhere. For example, when using framework like [Omniscient](https://github.com/omniscientjs/omniscient) you would perform the data fetching in server.js & client.js and pass cursor to immutable data structure in routeContext.

#### instantResolve

With instantResolve you can make the **fetch** promises to resolve immediately with empty data. When **fetch** calls actually finish, they will fire **fetch:storeId** events that you can use to re-render the routes. This is really useful when you want to render the view skeleton immediately and show some loading spinners while the data retrieval is ongoing. instantResolve will only affect client side **fetch** calls, it has no effect on server side.

### Routes (routes.js)

Example `routes.js`

```javascript
var Index = React.createFactory(require('./components/index'));
var Post = React.createFactory(require('./components/post'));

module.exports = {
  '/': function() {
    return this.store.fetch("posts").then(function(posts) {
      return {title: "Front page", component: Index({posts: posts})};
    });
  },
  '/posts/:id': function(id) {
    return this.store.fetch("post", {id: id}).then(function(post) {
      return {title: post.get("title"), component: Post({post: post})};
    });
  }
};
```

Your routes will get picked by **client.js** and **server.js** and generate exactly same response in both environments (provided you implement your **render** functions in that manner).

Your route handlers can return either promises or strings, cerebellum will handle both use cases.

In route handler's **this** scope you have **this.store** which is the reference to Store instance. It contains all your stores and **fetch** for getting the data.

On the server Store is initialized for every request and on the client it's created only once, in the application's initialization phase.

Server serializes all Store content to a JSON snapshot at the end of a request and client then deserializes that JSON and bootstraps itself.

### Stores (stores.js)

Example `stores.js`

```javascript
var PostsCollection = require('./stores/posts');
var AuthorModel = require('stores/author');

module.exports = {
  posts: PostsCollection,
  author: AuthorModel
};
```

Return an object of store ids and stores. These will be registered to be used with Store.

### Server (server.js)

Server is responsible for rendering the first page for the user. Under the hood server creates an express.js app and server constructor returns reference to that express app instance.

Server is initialized by calling **cerebellum.server(options)**

See **"Options (options.js)"** section for shared options **(routes, storeId, stores ...)**, options below are server only.

#### options.render(document, options={})

Route handler will call server's render with document and its options. document is a cheerio instance containing the `index.html` content.

Example server render function:

```javascript
options.render = function(document, options) {
  document("title").html(options.title);
  document("#app").html(React.renderToString(options.component));
  return document.html();
}
```

#### options.staticFiles

Path to static files, `index.html` will be served from there.

```javascript
options.staticFiles = __dirname + "/public"
```

#### options.middleware

Array of middleware functions, each of them will be passed to express.use().
You can also include array with route & function.

```javascript
var compress = require('compression');
var auth = require('./lib/auth');
options.middleware = [
  compress(),
  ["/admin", auth()]
];
```

#### useStatic

Instance method for cerebellum.server instance. Registers express.js static file handling, you usually want to call this after executing cerebellum.server constructor, so Cerebellum routes take precedence over static files.

```javascript
var app = cerebellum.server(options);
app.useStatic();
```

### Client (client.js)

Client is responsible for managing the application after getting the initial state from server.

Client is initialized by calling **cerebellum.client(options)**

See **"Options (options.js)"** section for shared options **(routes, storeId, stores ...)**, options below are client only.

#### options.render(options={})

Route handler will call client's render with its options when it gets resolved.

```javascript
options.render = function(options) {
  document.getElementsByTagName("title")[0].innerHTML = options.title;
  return React.render(options.component, document.getElementById("app"));
};
```

#### options.initialize(client)

This callback will be executed after client bootstrap is done.
Returns client object with **router** and **store** instances.

You can listen for store events, expire store caches and render routes here.

```javascript
options.initialize = function(client) {
  React.initializeTouchEvents(true);
};
```

#### options.autoClearCaches

With this option Store will automatically clear cache for matching cacheKey after **create**, **update** or **delete**. Defaults to false.

```javascript
options.autoClearCaches = true;
```

### Usage with React

Cerebellum works best with [React](http://facebook.github.io/react/).

React makes server side rendering easy with **React.renderToString** and it can easily initialize client from server state. All code examples in this documentation use React for view generation.

## Running tests

Start test server for client tests

    npm start

Running client tests (requires test server to be up and running)

    npm run test_client

Running server tests

    npm run test_server

Running all tests (server & client)

    npm run test

## Browser support

Internet Explorer 9 and newer, uses ES5 and needs pushState.

## Apps using Cerebellum

### [urls](https://github.com/SC5/cerebellum-urls)
Sample app for saving & tagging urls, demonstrates CRUD & authorization

### [LiigaOpas](http://liiga.pw)
Stats site for Finnish hockey league (Liiga)

Source available at: [https://github.com/hoppula/liiga](https://github.com/hoppula/liiga)

## License
MIT, see LICENSE.

Copyright (c) 2014-2015 Lari Hoppula, [SC5 Online](http://sc5.io)