var should = require('should');
var cheerio = require('cheerio');
require("babel/polyfill");
require('native-promise-only');

var Server = require('../../server');
var Store = require('../../store');
var Collection = require('../..').Collection;
var Model = require('../..').Model;

var appId = "app";
var storeId = "store_state_from_server";

var options;

describe('Server', function() {

  beforeEach(function() {
    options = {
      storeId: storeId,
      render: function render(document, options) {
        document("#"+appId).html( options.value );
        return document.html();
      },
      routes: {
        "/": function() {
          return new Promise(function(resolve, reject) {
            resolve({value: "Index content"});
          });
        },
        "/person": function() {
          return this.store.fetch("person").then(function(person) {
            return {value: person.get("value")};
          });
        }
      },
      stores: {
        person: Model.extend({
          cacheKey: function() {
            return "person";
          },
          fetch: function() {
            this.set("value", "Example person");
            return new Promise(function(resolve, reject) {
              resolve();
            });
          }
        })
      },
      staticFiles: __dirname+"/public"
    };
  });

  it('should throw error if options.staticFiles not defined', function() {
    options.staticFiles = null;
    (function() { new Server(options) }).should.throw();
  });

  it('should render route handler response without store calls but the exported JSON should be empty', function() {
    var app = new Server(options);

    var res = {
      setHeader: function() {},
      send: function(html) {
        cheerio("#"+appId, html).text().should.equal("Index content");
        cheerio("#"+storeId, html).text().should.be.empty;
        done();
      }
    };

    app({ url: '/', method: 'GET', headers: {} }, res);
  });

  it('should render store.fetch return value and exported JSON should not be empty', function(done) {
    var app = new Server(options);

    var res = {
      setHeader: function() {},
      send: function(html) {
        cheerio("#"+appId, html).text().should.equal("Example person");
        cheerio("#"+storeId, html).text().should.not.be.empty;
        done();
      }
    };

    app({ url: '/person', method: 'GET', headers: {} }, res);
  });

});
