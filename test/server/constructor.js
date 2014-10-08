var should = require('should');

var cerebellum = require('../../index');
var options;

describe('Constructor', function() {

  beforeEach(function() {
    options = {
      storeId: "app",
      render: function() {},
      routes: {},
      stores: {},
      staticFiles: __dirname+"/public"
    };
  });

  it('should initialize server with proper options', function() {
    (function() { cerebellum.server(options) }).should.not.throw();
  });

  it('should throw exception when missing storeId', function() {
    options.storeId = null;
    (function() { cerebellum.server(options) }).should.throw();
  });

  it('should throw exception when missing render', function() {
    options.render = null;
    (function() { cerebellum.server(options) }).should.throw();
  });

  it('should throw exception when missing routes', function() {
    options.routes = null;
    (function() { cerebellum.server(options) }).should.throw();
  });

});
