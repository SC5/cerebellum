var request = require('supertest');
var should = require('should');
var cheerio = require('cheerio');
require('native-promise-only');

var Server = require('../lib/server');
var options;

var storeId = "app";

describe('Server', function() {

  beforeEach(function() {
    options = {
      storeId: storeId,
      render: function render(document, options) {
        document("#"+storeId).html( options.value );
        return document.html();
      },
      routes: {
        "/": function() {
          return new Promise(function(resolve, reject) {
            resolve({value: "index content"});
          });
        }
      },
      stores: {},
      staticFiles: __dirname+"/public"
    };
  });

  it('should throw error if options.staticFiles not defined', function() {
    options.staticFiles = null;
    (function() { new Server(options) }).should.throw();
  });

  it('should render route handler\'s response to #app', function(done) {
    var app = new Server(options);
    request(app).get("/").expect(function(res) {
      cheerio("#"+storeId, res.text).text().should.equal("index content");
    })
    .end(done);
  });

});
