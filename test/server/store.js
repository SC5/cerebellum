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
    }
  }),
  car: Model.extend({
    cacheKey: function() {
      return "car/"+this.storeOptions.id;
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

    });

    it('should return cached value if found', function() {

    });

    it('should return store object even if error occurs', function() {

    });

    it('should cache store value after server fetch', function() {

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

    });
  });

  describe('export', function() {
    it('should export current cached stores to JSON', function() {

    });
  });

});
