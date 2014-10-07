var should = require('should');

var Utils = require('../lib/utils');

describe('Utils', function() {
  describe('extractParams', function() {

    it('should return empty array without any params', function() {
      Utils.extractParams("/", {}).should.eql([]);
    });

    it('should return single item with single param', function() {
      Utils.extractParams("/:id", {id: "123"}).should.eql(["123"]);
    });

    it('should support multiple params and return params in correct order', function() {
      Utils.extractParams("/:lib/:id", {id: "123", lib: "cerebellum"}).should.eql(["cerebellum", "123"]);
    });

  });
});
