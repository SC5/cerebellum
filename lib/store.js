require('native-promise-only');

var Store = (function() {
  function Store(collections) {
    var collection, id;
    this.collections = {};
    for (id in collections) {
      collection = collections[id];
      this.collections[id] = new collection();
    }
  }

  // set caches from initial JSON
  Store.prototype.import = function(json) {
    var collections, data, id;
    if (!json) {
      return;
    }
    collections = JSON.parse(json);
    for (id in collections) {
      data = collections[id];
      this.collections[id].reset(data);
    }
    return true;
  };

  // export current cached collections to JSON
  Store.prototype.export = function() {
    var collection, collections, id;
    collections = {};
    for (id in this.collections) {
      collection = this.collections[id];
      collections[id] = collection.toJSON();
    }
    return JSON.stringify(collections);
  };

  // get collection from cache or fetch from server
  Store.prototype.get = function(collectionId) {
    var self = this;
    return new Promise(function(resolve, reject) {
      var collection = self.collections[collectionId];
      if (!collection) {
        reject(new Error("Collection " + collectionId + " not registered"));
      }
      if (collection.length !== 0) {
        return resolve(collection);
      } else {
        return collection.fetch().then(function() {
          return resolve(collection);
        }).catch(function(err) {
          return reject(err);
        });
      }
    });
  };

  return Store;
})();

module.exports = Store;
