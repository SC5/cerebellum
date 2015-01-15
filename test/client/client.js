(function() {

  var cerebellum = window.Cerebellum;
  var appId = "app";
  var storeId = "store_state_from_server";
  var appContainer = document.getElementById(appId);
  var options;

  describe('Client', function() {

    beforeEach(function() {
      options = {
        appId: appId,
        storeId: storeId,
        initialize: function(client) {},
        render: function(options) {
          appContainer.innerHTML = options.value;
        },
        routes: {
          "/": function() {
            return new Promise(function(resolve, reject) {
              resolve({value: "index content"});
            });
          }
        },
        stores: {}
      };
    });

    it('should initialize client with proper options', function() {
      (function() { cerebellum.client(options) }).should.not.throw();
    });

    it('should render index route handler\'s response to #app after initialization', function(done) {
      options.initialize = function(client) {
        // TODO: better way to ensure this runs after render has finished
        setTimeout(function() {
          appContainer.innerHTML.should.equal("index content");
           done();
        }, 10);
      };
      cerebellum.client(options);
    });

  });

})();