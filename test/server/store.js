var should = require('should');
var nock = require('nock');
var Immutable = require('immutable');
require('native-promise-only');

var Store = require('../../store');
var Collection = require('../..').Collection;
var Model = require('../..').Model;

// Mocks
nock('http://cerebellum.local')
.get('/collection/1')
.reply(401);

nock('http://cerebellum.local')
.get('/collection/1')
.reply(500, "Internal server error");

nock('http://cerebellum.local')
.get('/collection/1')
.reply(403);

nock('http://cerebellum.local')
.get('/collection/1')
.reply(401);

nock('http://cerebellum.local')
.get('/cars/Ferrari')
.times(12)
.reply(200, {
  manufacturer: "Ferrari"
});

nock('http://cerebellum.local')
.get('/model')
.times(2)
.reply(200, {});

nock('http://cerebellum.local')
.get('/nocachekeycollection')
.reply(200, []);

nock('http://cerebellum.local')
.post('/cars/Ferrari')
.times(3)
.reply(200, {
  manufacturer: "Ferrari",
  model: "F40"
});

nock('http://cerebellum.local')
.post('/cars/Lotus')
.reply(500, "Internal server error");

nock('http://cerebellum.local')
.delete('/cars/Lotus')
.reply(401, "Unauthorized");

nock('http://cerebellum.local')
.delete('/cars/Maserati')
.reply(200);

nock('http://cerebellum.local')
.post('/cars/Pagani')
.reply(200, {
  manufacturer: "Pagani",
  model: "Zonda"
});

nock('http://cerebellum.local')
.get('/cars/Lotus')
.reply(200, {
  manufacturer: "Lotus"
});

nock('http://cerebellum.local')
.post('/cars')
.times(2)
.reply(500, "Internal server error");

nock('http://cerebellum.local')
.post('/cars')
.reply(200, {
  manufacturer: "Bugatti"
});

nock('http://cerebellum.local')
.get('/cars')
.times(3)
.reply(200, [
  {manufacturer: "Bugatti"},
  {manufacturer: "Ferrari"},
  {manufacturer: "Lotus"},
  {manufacturer: "Maserati"},
  {manufacturer: "Pagani"}
]);

// Stores
var stores = {
  model: Model.extend({
    url: "http://cerebellum.local/model"
  }),
  collection: Collection.extend({
    cacheKey: function() {
      return "collection/1";
    },
    url: "http://cerebellum.local/collection/1"
  }),
  car: Model.extend({
    relatedCaches: function() {
      return {"cars": "/"};
    },
    cacheKey: function() {
      return this.storeOptions.id;
    },
    url: function() {
      return "http://cerebellum.local/cars/" + this.storeOptions.id;
    }
  }),
  cars: Collection.extend({
    url: function() {
      return "http://cerebellum.local/cars";
    }
  }),
  noCacheKeyCollection: Collection.extend({
    url: "http://cerebellum.local/nocachekeycollection"
  })
};

describe('Store', function() {

  describe('constructor', function() {

    it('initializes values', function() {
      var store = new Store();
      store.should.have.properties('cached', 'stores');
    });

    it('stores and caches should be initialized', function() {
      var store = new Store(stores);
      should.exist(store.stores.model);
      should.exist(store.stores.collection);
      should.exist(store.cached.get("model"));
      should.exist(store.cached.get("collection"));
    });

    it('options are handled', function() {
      var store = new Store([], {cookie: "test"});
      store.should.have.property("cookie", "test");
    });

  });

  describe('events', function() {
    it('should work as event bus', function() {
      var store = new Store();
      store.should.have.properties('on', 'off', 'trigger', 'once', 'listenTo', 'stopListening', 'listenToOnce');
    });
  });

  describe('fetch', function() {
    it('should fetch from server if cache not found', function() {
      var store = new Store(stores);
      return store.fetch("car", {id: "Ferrari"}).then(function(result) {
        result.get("manufacturer").should.be.equal("Ferrari");
      });
    });

    it('should return cached value if found', function() {
      var store = new Store(stores);

      var lambo = store.get("car");
      lambo = lambo.set("manufacturer", "Lamborghini (not set by fetch)");
      lambo = lambo.set("model", "Aventador");
      store.cached = store.cached.setIn(["car","Lamborghini"], Immutable.fromJS(lambo.toJSON()));

      return store.fetch("car", {id: "Lamborghini"}).then(function(result) {
        result.get("manufacturer").should.be.equal("Lamborghini (not set by fetch)");
        result.get("model").should.be.equal("Aventador");
      });

    });

    it('should return store object even if error occurs (statuses 401 & 403)', function() {
      var store = new Store(stores);
      var original = store.get("collection");
      original.storeOptions = {};
      var originalJSON = original.toJSON();
      return store.fetch("collection").then(function(result) {
        result.toJSON().should.eql(originalJSON);
      });
    });

    it('should reject promise with error if error occurs (other statuses)', function() {
      var store = new Store(stores);
      var original = store.get("collection");
      original.storeOptions = {};
      return store.fetch("collection").catch(function(err) {
        err.status.should.equal(500);
        err.data.should.equal("Internal server error");
      });
    });

    it('should reject 40x response statuses if explicitly passing empty array for allowedStatusCodes', function() {
      var store = new Store(stores, {allowedStatusCodes: []});
      var original = store.get("collection");
      original.storeOptions = {};
      return store.fetch("collection").catch(function(err) {
        err.status.should.equal(403);
      });
    });

    it('should cache store value after server fetch', function() {
      var store = new Store(stores);
      return store.fetch("car", {id: "Ferrari"}).then(function(result) {
        Immutable.is(store.cached.getIn(["car","Ferrari"]), result).should.equal(true);
      });
    });

    it('should throw error if store is not registered', function() {
      var store = new Store(stores);
      return store.fetch("nonExistingId").catch(function(error) {
        error.message.should.equal("Store nonExistingId not registered.");
      });
    });

    it('should throw error if there\'s no cacheKey', function() {
      var store = new Store(stores);
      return store.fetch("model").catch(function(error) {
        error.message.should.equal("Store model has no cacheKey method.");
      });
    });

    it('should use model\'s storeOptions.id as fallback cacheKey', function() {
      var store = new Store(stores);
      return store.fetch("model", {id: "example"}).then(function() {
        should.exist(store.cached.getIn(["model","example"]));
      });
    });

    it('cacheKey should be optional for collections', function() {
      var store = new Store(stores);
      return store.fetch("noCacheKeyCollection").then(function() {
        should.exist(store.cached.getIn(["noCacheKeyCollection","/"]));
      });
    });

    it('should not modify original placeholder instance', function() {
      var store = new Store(stores);
      var original = store.get("car");
      return store.fetch("car", {id: "Ferrari"}).then(function(result) {
        result.get("manufacturer").should.be.equal("Ferrari");
        original.should.not.have.property("storeOptions");
        (original.manufacturer === undefined).should.be.true;
      });
    });

    it('should reuse first fetch request if multiple concurrent fetches', function(done) {
        var store = new Store(stores);
        var firstFetch = store.fetch("car", {id: "Ferrari"});
        var secondFetch = store.fetch("car", {id: "Ferrari"});
        var thirdFetch = store.fetch("car", {id: "Ferrari"});

        store.ongoingFetches.length.should.equal(1);
        store.ongoingFetches[0].id.should.equal("car");
        store.ongoingFetches[0].key.should.equal("Ferrari");

        Promise.all([firstFetch, secondFetch, thirdFetch]).then(function(results) {
          Immutable.is(results[0], results[1]).should.equal(true);
          Immutable.is(results[1], results[2]).should.equal(true);
          done();
        });
    });

  });

  describe('fetchAll', function() {
    it('should fetch all given stores with fetchAll', function() {
      var store = new Store(stores);
      return store.fetchAll({
        "cars": {},
        "car": {id: "Ferrari"}
      }).then(function(result) {
        var resultJSON = Object.keys(result).reduce(function(obj, key) {
          obj[key] = result[key].toJSON();
          return obj;
        }, {});
        resultJSON.should.eql({
          cars: [
            { manufacturer: 'Bugatti' },
            { manufacturer: 'Ferrari' },
            { manufacturer: 'Lotus' },
            { manufacturer: 'Maserati' },
            { manufacturer: 'Pagani' }
          ],
          car: { manufacturer: 'Ferrari' }
        });
      });
    });
    it('should fail with invalid store id', function() {
      var store = new Store(stores);
      return store.fetchAll({
        "motorcycles": {},
        "car": {id: "Ferrari"}
      }).catch(function(err) {
        err.message.should.equal("Store motorcycles not registered.");
      });
    });
  });

  describe('get', function() {
    it('should return empty placeholder instances', function() {
      var store = new Store(stores);
      store.get("model").should.be.instanceOf(Model);
      store.get("collection").should.be.instanceOf(Collection);
      store.get("model").toJSON().should.be.empty;
      store.get("collection").toJSON().should.be.empty;
    });
  });

  describe('bootstrap', function() {
    it('should set caches from initial JSON', function() {
      var store = new Store(stores);
      var json = JSON.stringify({
        model: {},
        collection: {},
        car: {
          "Ferrari": {manufacturer: "Ferrari"},
          "Lotus": {manufacturer: "Lotus"}
        }
      });
      store.bootstrap(json);

      store.cached.get("car").size.should.be.equal(2);
      store.cached.get("model").size.should.be.equal(0);
      store.cached.get("collection").size.should.be.equal(0);
      store.cached.getIn(["car","Ferrari"]).get("manufacturer").should.be.equal("Ferrari");
      store.cached.getIn(["car","Lotus"]).get("manufacturer").should.be.equal("Lotus");
    });
  });

  describe('snapshot', function() {
    it('should export snapshot of currently cached stores to JSON', function() {
      var store = new Store(stores);
      var expectedJSON = JSON.stringify({
        model: {},
        collection: {
          "collection/1": []
        },
        car: {
          "Ferrari": {manufacturer: "Ferrari"},
          "Lotus": {manufacturer: "Lotus"}
        },
        cars: {},
        noCacheKeyCollection: {}
      });

      store.snapshot().should.be.eql(JSON.stringify({
        model: {},
        collection: {},
        car: {},
        cars: {},
        noCacheKeyCollection: {}
      }));

      return Promise.all([
        store.fetch("car", {id: "Ferrari"}),
        store.fetch("car", {id: "Lotus"}),
        store.fetch("collection")
      ]).then(function() {
        store.snapshot().should.be.eql(expectedJSON);
      });
    });
  });

  describe('clearCache', function() {
    it('should clear cache automatically when passing autoClearCaches = true', function() {
      var store = new Store(stores, {autoClearCaches: true});

      return store.fetch("car", {id: "Ferrari"}).then(function() {
        store.on("update:car", function(err, options) {
          should.not.exist(store.cached.getIn(["car","Ferrari"]));
        });
        should.exist(store.cached.getIn(["car","Ferrari"]));
        store.dispatch("update", "car", {id: "Ferrari"}, {
          manufacturer: "Ferrari",
          model: "F40"
        });
      });
    });

    it('should mark cache as stale when calling with storeId and cacheKey', function() {
      var store = new Store(stores);

      return store.fetch("car", {id: "Ferrari"}).then(function() {
        store.on("update:car", function(err, options) {
          should.exist(store.cached.getIn(["car","Ferrari"]));
          store.clearCache("car");
          should.exist(store.staleCaches.car.Ferrari);
        });
        should.exist(store.cached.getIn(["car","Ferrari"]));
        store.dispatch("update", "car", {id: "Ferrari"}, {
          manufacturer: "Ferrari",
          model: "F40"
        });
      });
    });

    it('should clear related caches when using relatedCaches', function(done) {
      var store = new Store(stores, {autoClearCaches: true});

      store.on("update:car", function(err, data) {
        if (err) {
          done(err);
        }
        should.exist(store.cached.getIn(["car","Ferrari"]));
        store.cached.get("cars").should.not.be.empty;
        var carIsStale = store.staleCaches.some(function(cache) {
          return cache.id === "car" && cache.key === "Ferrari";
        })
        carIsStale.should.equal(true);
        var carsIsStale = store.staleCaches.some(function(cache) {
          return cache.id === "cars" && cache.key === "/";
        })
        carsIsStale.should.equal(true);
        done();
      });

      return Promise.all([
        store.fetch("car", {id: "Ferrari"}),
        store.fetch("cars")
      ]).then(function() {
        should.exist(store.cached.getIn(["car","Ferrari"]));
        store.cached.get("cars").should.not.be.empty;
        store.dispatch("update", "car", {id: "Ferrari"}, {model: "F40"});
      });
    });
  });

  describe('instantResolve', function() {
    it('should resolve fetch promise instantly when passing instantResolve = true', function(done) {
      var store = new Store(stores, {instantResolve: true});
      store.on("fetch:cars", function(err, cars) {
        if (err) {
          done(err);
        }
        cars.toJSON().should.eql([
          {manufacturer: "Bugatti"},
          {manufacturer: "Ferrari"},
          {manufacturer: "Lotus"},
          {manufacturer: "Maserati"},
          {manufacturer: "Pagani"}
        ]);
        done();
      });
      store.fetch("cars").then(function(cars) {
        cars.toJSON().should.eql([]);
      });
    });
  });

  describe('create', function() {
    it('should trigger error when triggering create for model', function(done) {
      var store = new Store(stores);
      store.on("create:car", function(err, data) {
        err.message.should.equal("You can call create only for collections!");
        done();
      });
      store.dispatch("create", "car", {manufacturer: "Mercedes-Benz"});
    });

    it('should trigger error when create fails', function(done) {
      var store = new Store(stores);
      store.on("create:cars", function(err, data) {
        err.message.should.equal("Creating new item to store 'cars' failed");
        done();
      });
      store.dispatch("create", "cars", {manufacturer: "Mercedes-Benz"});
    });

    it('should reject dispatch return promise when create fails', function() {
      var store = new Store(stores);
      return store.dispatch("create", "cars", {manufacturer: "Mercedes-Benz"}).catch(function(err) {
        err.message.should.equal("Creating new item to store 'cars' failed");
      });
    });

    it('should trigger success with proper object when create succeeds', function(done) {
      var store = new Store(stores);
      store.on("create:cars", function(err, data) {
        should.not.exist(err);
        data.cacheKey.should.equal("/");
        data.store.should.equal("cars");
        data.options.should.eql({});
        data.result.get("manufacturer").should.equal("Bugatti");
        done();
      });
      store.dispatch("create", "cars", {manufacturer: "Bugatti"});
    });
  });

  describe('update', function() {
    it('should trigger error when triggering update for collection', function() {
      var store = new Store(stores);
      store.on("update:collection", function(err, data) {
        err.message.should.equal("You can call update only for models!");
      });
      store.dispatch("update", "collection", {title: "Updated collection"});
    });

    it('should trigger error when update fails', function(done) {
      var store = new Store(stores);
      store.on("update:car", function(err, data) {
        err.message.should.equal("Updating 'car' failed");
        done();
      });
      store.dispatch("update", "car", {id: "Lotus"}, {manufacturer: "Lotus", model: "Exige"});
    });

    it('should reject dispatch return promise when update fails', function() {
      var store = new Store(stores);
      return store.dispatch("update", "car", {id: "Lotus"}, {manufacturer: "Lotus", model: "Exige"}).catch(function(err) {
        err.message.should.equal("Updating 'car' failed");
      });
    });

    it('should trigger success with proper object when update succeeds', function() {
      var store = new Store(stores);
      store.on("update:car", function(err, data) {
        should.not.exist(err);
        data.cacheKey.should.equal("Pagani");
        data.store.should.equal("car");
        data.options.should.eql({id: "Pagani"});
        data.result.get("manufacturer").should.equal("Pagani");
        data.result.get("model").should.equal("Zonda");
        done();
      });
      store.dispatch("update", "car", {id: "Pagani"}, {manufacturer: "Pagani", model: "Zonda"});
    });
  });

  describe('delete', function() {
    it('should trigger error when triggering delete for collection', function() {
      var store = new Store(stores);
      store.on("delete:collection", function(err, data) {
        err.message.should.equal("You can call destroy only for models!");
      });
      store.dispatch("delete", "collection");
    });

    it('should trigger error when delete fails', function(done) {
      var store = new Store(stores);
      store.on("delete:car", function(err, data) {
        try {
          err.should.be.instanceOf(Error);
          err.message.should.equal("Deleting 'car' failed");
          done();
        } catch (error) {
          done(error);
        }
      });
      store.dispatch("delete", "car", {id: "Lotus"});
    });

    it('should reject dispatch return promise when delete fails', function() {
      var store = new Store(stores);
      return store.dispatch("delete", "car", {id: "Lotus"}).catch(function(err) {
        err.message.should.equal("Deleting 'car' failed");
      });
    });

    it('should trigger success with proper object when delete succeeds', function(done) {
      var store = new Store(stores);
      store.on("delete:car", function(err, data) {
        should.not.exist(err);
        data.cacheKey.should.equal("Maserati");
        data.store.should.equal("car");
        data.options.should.eql({id: "Maserati"});
        done();
      });
      store.dispatch("delete", "car", {id: "Maserati"});
    });

  });

  describe('expire', function() {
    it('should trigger success with proper object when expire succeeds', function(done) {
      var store = new Store(stores);
      store.on("expire:car", function(err, data) {
        should.not.exist(err);
        data.cacheKey.should.equal("Ferrari");
        data.store.should.equal("car");
        data.options.should.eql({id: "Ferrari"});
        done();
      });
      return store.fetch("car", {id: "Ferrari"}).then(function(result) {
        store.cached.getIn(["car","Ferrari"]).get("manufacturer").should.be.equal("Ferrari");
        store.dispatch("expire", "car", {id: "Ferrari"});
      });
    });
  });

});
