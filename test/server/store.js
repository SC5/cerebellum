var should = require('should');
require('native-promise-only');

var Store = require('../../lib/store');
var exoskeleton = require("../../lib/wrapper/exoskeleton");
var Collection = exoskeleton.Collection;
var Model = exoskeleton.Model;

var stores = {
  model: Model.extend({

  }),
  collection: Collection.extend({
    cacheKey: function() {
      return "collection";
    },
    fetch: function() {
      return new Promise(function(resolve, reject) {
        reject(new Error("Not authorized"));
      });
    }
  }),
  car: Model.extend({
    cacheKey: function() {
      return this.storeOptions.id;
    },
    fetch: function() {
      this.set("manufacturer", this.storeOptions.id);
      return new Promise(function(resolve, reject) {
        resolve();
      });
    }
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
      should.exist(store.cached.model);
      should.exist(store.cached.collection);
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
        result.storeOptions.should.have.property("id", "Ferrari");
        result.get("manufacturer").should.be.equal("Ferrari");
      });
    });

    it('should return cached value if found', function() {
      var store = new Store(stores);

      var lambo = store.get("car").clone();
      lambo.set("manufacturer", "Lamborghini (not set by fetch)");
      lambo.set("model", "Aventador");
      store.cached["car"]["Lamborghini"] = lambo;

      return store.fetch("car", {id: "Lamborghini"}).then(function(result) {
        result.get("manufacturer").should.be.equal("Lamborghini (not set by fetch)");
        result.get("model").should.be.equal("Aventador");
      });

    });

    it('should return store object even if error occurs', function() {
      var store = new Store(stores);
      var original = store.get("collection").clone();
      original.storeOptions = {};
      return store.fetch("collection").then(function(result) {
        original.should.eql(result);
      });
    });

    it('should cache store value after server fetch', function() {
      var store = new Store(stores);
      return store.fetch("car", {id: "Ferrari"}).then(function(result) {
        store.cached["car"]["Ferrari"].should.equal(result);
      });
    });

    it('should throw error if store is not registered', function() {
      var store = new Store(stores);
      return store.fetch("nonExistingId").catch(function(error) {
        error.message.should.equal("Store nonExistingId not registered.");
      });
    });

    it('should throw error if cacheKey method is not implemented', function() {
      var store = new Store(stores);
      return store.fetch("model").catch(function(error) {
        error.message.should.equal("Store model has no cacheKey method.");
      });
    });

    it('should not modify original placeholder instance', function() {
      var store = new Store(stores);
      var original = store.get("collection");
      return store.fetch("car", {id: "Ferrari"}).then(function(result) {
        result.storeOptions.should.have.property("id", "Ferrari");
        result.get("manufacturer").should.be.equal("Ferrari");
        original.should.not.have.property("storeOptions");
        (original.get("manufacturer") === undefined).should.be.true;
      });
    });

    it('should set storeOptions', function() {
      var store = new Store(stores);
      return store.fetch("car", {id: "Ferrari"}).then(function(result) {
        result.storeOptions.should.have.property("id", "Ferrari");
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

  describe('import', function() {
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
      store.import(json);

      Object.keys(store.cached["car"]).length.should.be.equal(2);
      Object.keys(store.cached["model"]).length.should.be.equal(0);
      Object.keys(store.cached["collection"]).length.should.be.equal(0);
      store.cached["car"]["Ferrari"].should.be.instanceOf(Model);
      store.cached["car"]["Lotus"].should.be.instanceOf(Model);
      store.cached["car"]["Ferrari"].get("manufacturer").should.be.equal("Ferrari");
      store.cached["car"]["Lotus"].get("manufacturer").should.be.equal("Lotus");
    });
  });

  describe('export', function() {
    it('should export current cached stores to JSON', function() {
      var store = new Store(stores);
      var expectedJSON = JSON.stringify({
        model: {},
        collection: {},
        car: {
          "Ferrari": {manufacturer: "Ferrari"},
          "Lotus": {manufacturer: "Lotus"}
        }
      });

      store.export().should.be.eql(JSON.stringify({
        model: {},
        collection: {},
        car: {}
      }));

      return Promise.all([
        store.fetch("car", {id: "Ferrari"}),
        store.fetch("car", {id: "Lotus"}),
        store.fetch("collection")
      ]).then(function() {
        store.export().should.be.eql(expectedJSON);
      });
    });
  });

});
