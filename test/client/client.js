(function() {

  var cerebellum = window.Cerebellum;
  var Collection = cerebellum.Collection;
  var appId = "app";
  var storeId = "store_state_from_server";
  var appContainer = document.getElementById(appId);
  var options;

  describe('Client', function() {

    beforeEach(function() {

      document.getElementById(storeId).innerHTML = '{"movies": {"/": [{"name": "Interstellar"}, {"name": "Inception"}, {"name": "Insomnia"}]}}';

      options = {
        appId: appId,
        storeId: storeId,
        initialize: function(client) {},
        render: function(document, options) {
          appContainer.innerHTML = options.value;
        },
        routes: {
          "/": function() {
            return new Promise(function(resolve, reject) {
              resolve({value: "index content"});
            });
          },
          "/second_route": function() {
            return {value: "second view"};
          },
          "/third_route/:category_id/:id": function(categoryId, id) {
            return {value: [categoryId, id]};
          },
          "/fourth/:optional?": function(optional) {
            return {value: optional};
          },
          "/movies": function() {
            return this.store.fetch("movies").then(function(movies) {
              return {value: movies.map(function(movie) { return movie.get("name"); }).join(",")};
            });
          }
        },
        stores: {
          movies: Collection.extend({})
        }
      };
    });

    it('should render index route handler\'s response to #app after initialization', function(done) {
      var clientEvents = cerebellum.client(options);
      clientEvents.on("render", function(route) {
        route.should.equal("/");
        appContainer.innerHTML.should.equal("index content");
        clientEvents.off();
        done();
      });
    });

    it('should route to another url and render it\'s content', function(done) {
      options.initialUrl = "/second_route";
      var clientEvents = cerebellum.client(options);

      clientEvents.on("render", function(route) {
        route.should.equal("/second_route");
        appContainer.innerHTML.should.equal("second view");
        clientEvents.off();
        done();
      });

    });

    it('should handle route parameters', function(done) {
      options.initialUrl = "/third_route/1/2";
      var clientEvents = cerebellum.client(options);

      clientEvents.on("render", function(route) {
        route.should.equal("/third_route/:category_id/:id");
        appContainer.innerHTML.should.equal("1,2");
        clientEvents.off();
        done();
      });

    });

    it('should render view without optional route param', function(done) {
      options.initialUrl = "/fourth";
      var clientEvents = cerebellum.client(options);

      clientEvents.on("render", function(route) {
        route.should.equal("/fourth/:optional?");
        appContainer.innerHTML.should.equal("undefined");
        clientEvents.off();
        done();
      });

    });

    it('should render view with optional route param', function(done) {
      options.initialUrl = "/fourth/123";
      var clientEvents = cerebellum.client(options);

      clientEvents.on("render", function(route) {
        route.should.equal("/fourth/:optional?");
        appContainer.innerHTML.should.equal("123");
        clientEvents.off();
        done();
      });

    });

    it('should bootstrap from initial JSON', function(done) {
      options.initialUrl = "/movies";
      var clientEvents = cerebellum.client(options);

      clientEvents.on("render", function(route) {
        route.should.equal("/movies");
        appContainer.innerHTML.should.equal("Interstellar,Inception,Insomnia");
        clientEvents.off();
        done();
      });

    });

    it('should be possible to render asynchronously with context and query params', function(done) {

      var asyncOptions = {
        appId: appId,
        storeId: storeId,
        initialize: function(client) {},
        render: function(document, response, request) {
          var context = this;
          return new Promise(function(resolve, reject) {
            setTimeout(function() {
              appContainer.innerHTML = JSON.stringify({
                response: response,
                request: request,
                storeExists: !!context.store
              });
              resolve(response);
            }, 10);
          });
        },
        routes: {
          "/async/:id": function() {
            return "async render";
          }
        },
        stores: {},
        initialUrl: "/async/1?q=hello"
      };

      var clientEvents = cerebellum.client(asyncOptions);

      clientEvents.on("render", function(route) {
        route.should.equal("/async/:id");
        var result = JSON.parse(appContainer.innerHTML);
        result.response.should.equal("async render");
        result.request.params.should.eql({id: "1"});
        result.request.query.should.eql({q: "hello"});
        result.storeExists.should.equal(true);
        clientEvents.off();
        done();
      });
    });

  });

})();