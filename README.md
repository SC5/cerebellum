## Cerebellum.js

Cerebellum.js is a powerful set of tools that help you structure your isomorphic apps, just add your preferred view engine.

With Cerebellum you can fully share the code for your GET routes, same code works on server and client, perfect for single-page apps.

Cerebellum is still under heavy development, expect breaking changes between 0.x releases.

### What does it do?

* Fully shared GET routes between server and client
* Fully shared data stores between server and client, uses [Exoskeleton's](http://exosjs.com/) Collection & Model with [Axios](https://github.com/mzabriskie/axios) adapter, so you can use the same REST APIs everywhere
* Stores the server state to JSON, browser client will automatically bootstrap from that, so you don't need to do any extra requests
* Uses [express.js](http://expressjs.com/) router on server and [page.js](https://github.com/visionmedia/page.js) on browser, both use same route format, so you can use optional parameters and regexps in your routes
* Automatic SEO, no hacks needed for server side rendering and you can easily make apps that work even when JavaScript is disabled in browser
* Fast initial load for mobile clients, browser can bootstrap from server state and continue as Single-page app without any extra steps
* Can be used with any framework that provides rendering for both server and client, [React.js](http://facebook.github.io/react/) recommended.

## Data flow

Cerebellum's data flow is in many ways similar to [Flux architecture](https://facebook.github.io/flux/), but it has some key differences.

![cerebellum data flow](http://i.imgur.com/S6M9wiS.png "Cerebellum data flow")

### Server and Client

1) User requests a page, first server/client will ask from router to check for matching route.

2) When router finds a matching route handler, it will query Store's stores (models & collections) for data.

3) Store will either call APIs (always on server) or use cached data (never on server). Store returns data to route handler and route handler returns view component with data to client.

4) Server/client renders the returned view component.

### Client only (green arrows)

Only router can ever update views in Cerebellum, every data refresh requires invoking route handler.

Views can trigger change events to stores (create, update, delete) which will be handled by Store. Store calls corresponding store API and invokes success callback (createSuccess, updateSuccess or deleteSuccess).

Client can listen for success callbacks. In callbacks you can clear caches and refresh route (or invoke another route). There's also an option to automatically clear caches for stores.

## Store

Store is a singleton that handles all data operations in Cerebellum.
You register your collections and models to Store by passing them to server and client constructors in **options.stores** (see "Stores (stores.js)" section below for more details).

Store will automatically cache its state on server and bootstrap client from that state. Client will also cache all additional API requests, but you can easily clear caches when needed.

### Models, Collections === read only

Your should treat your models and collections as ready only, all mutations are handled by Store with **create**, **update** and **delete** events.

### Fetching data

You can retrieve data from a store using **fetch(storeId, options)**.

If your store needs to fetch dynamic data, pass options to **fetch** as second parameter. For example, if you need to fetch model by id, your options would be `{id: id}`.

```javascript
this.store.fetch("post", {id: id});
```

### Caches and cacheKeys

Store caches are populated when calling **fetch()**.

Your models and collections should have `cacheKey` method, it defines where data will be cached in Store's cache.

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
call `store.trigger` with **create**, **update** or **delete**.

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
Store will execute the API call and fire a success callback when it finishes.

### Expiring caches and reloading routes

You can listen for store success callbacks in your client.js, like:

```javascript
store.on("create:posts", function(err, data) {
  console.log(data.store) // => posts
  console.log(data.result); // => {id: 3423, title: "New post", body: "Body text"}

store.clearCache("posts", data.cacheKey); // clear client cache for posts, so new data will be fetched when route is reloaded
  router("/posts"); // navigate to posts index, will re-fetch posts from API as cache was cleared
});

store.on("update:post", function(err, data) {
  store.clearCache("post", data.cacheKey); // clear individual model
  store.clearCache("posts", "posts") // clear posts collection as well
  router("/posts/" + data.options.id ); // reload route data
});
```

## Usage

You can define all options in both server.js & client.js, but usually it makes sense to create a shared `options.js` for shared options.

### Options (options.js)

example `options.js`, these options are shared with client & server constructors.

```javascript
var stores = require('./stores');
var routes = require('./routes');

module.exports = {
  routes: routes,
  storeId: "store_state_from_server",
  stores: stores,
  autoToJSON: true
};
```

#### routes

Object of route paths and route handlers. Best practice is to put these to their own file instead of bloating options.js, see "Routes (routes.js)" documentation below.

#### storeId

DOM ID in index.html where server generates the JSON that client will use for bootstrapping Store.

#### stores

Object containining store ids and stores. Best practice is to put these to their own file as well, see "Stores (stores.js)" documentation below.

#### autoToJSON

Call **toJSON()** automatically for **fetch** results. Defaults to true, set to false if you need to modify your stores in route handlers before passing them to views as JSON (not encouraged, you should override **toJSON** instead).

### Routes (routes.js)

Example `routes.js`

```javascript
var Index = require('./components/index');
var Post = require('./components/post');

module.exports = {
  '/': function() {
    return this.store.fetch("posts").then(function(posts) {
      return {
        title: "Front page",
        component: React.createElement(Index, {
          posts: posts.toJSON()
        })
      };
    });
  },
  '/posts/:id': function(id) {
    return this.store.fetch("post", {id: id}).then(function(post) {
      return {
        title: post.get("title"),
        component: React.createElement(Post, {
          post: post.toJSON()
        })
      };
    });
  }
};
```

Your routes will get picked by **client.js** and **server.js** and generate exactly same response in both environments.

You need to wrap your route handlers to promises as router expects all handlers to return promises.

In route handler's **this** scope you have **this.store** which is the reference to Store instance. It contains all your stores.

On the server Store is initialized for every request and on the client it's created only once, in the application's initialtialization phase.

Server exports store contents to JSON at the end of request and client bootstraps itself from that data.

### Stores (stores.js)

example `stores.js`

```javascript
var PostsCollection = require('./stores/posts')
var AuthorModel = require('stores/author')

module.exports = {
  posts: PostsCollection,
  author: AuthorModel
};
```

Return an object of store ids and stores. These will be registered to be used with Store.

### Server (server.js)

Server is responsible for rendering the first page for the user. Under the hood server creates express.js app.

Server is initialized by calling **cerebellum.server(options)**

See "Options (options.js)" section for shared options **(routes, storeId, stores)**, options below are server only.

#### options.render(document, options={})

Route promise will call server's render with document and its options when it gets resolved. document is a cheerio instance containing the staticFiles/index.html content.

Example render function:

```javascript
options.render = function(document, options) {
  document("title").html(options.title);
  document("#app").html(React.renderToString(options.component));
  return document.html();
}
```

#### options.staticFiles

Path to static files, index.html will be served from there.

```javascript
options.staticFiles = __dirname + "/public"
```

#### options.middleware

Array of middleware, each of them will be passed to express.use

```javascript
var compress = require('compression');
options.middleware = [compress()];
```

#### useStatic

Instance method for cerebellum.server instance. Register express.js static file handling, you usually want to call this after executing cerebellum.server constructor, so Cerebellum routes take precedence over static files.

```javascript
var app = cerebellum.server(options);
app.useStatic();
```

### Client (client.js)

Client is responsible for managing the application after getting the initial state from server.

Client is initialized by calling **cerebellum.client(options)**

See "Options (options.js)" section for shared options **(routes, storeId, stores)**, options below are client only.

#### options.render(options={})

Route promise will call client's render with its options when it gets resolved.

```javascript
options.render = function(options) {
  document.getElementsByTagName("title")[0].innerHTML = options.title;
  return React.render(options.component, document.getElementById("app"));
};
```

#### options.initialize(client)

This callback will be executed after client bootstrap is done.
Returns client object with **router** and **store** instances.

You can listen for store callback events, expire caches and reload routes here.

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

[LiigaOpas](http://liiga.pw)
Stats site for Finnish hockey league (Liiga)

[urls](https://bitbucket.org/SC5/cerebellum-urls)
Sample app for saving & tagging urls, demonstrates CRUD & authorization

## Future improvements

- Replace exoskeleton models & collections with something that does not provide anything extra, we don't really need setters & event system, they are handled by Store.
- More examples, example app with authentication & real API usage
- Find out if APIs could be queried on server side with same interface but less overhead (HTTP request overhead could be eliminated if API server is on the same machine)

## License
MIT, see LICENSE.

Copyright (c) 2014 Lari Hoppula, [SC5 Online](http://sc5.io)