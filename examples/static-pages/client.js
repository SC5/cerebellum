var React = require('react/addons');
var cerebellum = require('../../index');
var options = require('./options');

options.render = function render(opts) {
  if (opts == null) {
    opts = {};
  }
  window.scrollTo(0, 0);
  document.getElementsByTagName("title")[0].innerHTML = opts.title;
  React.render(opts.component, document.getElementById(options.appId));
};

options.initialize = function(client) {
  React.initializeTouchEvents(true);
};

var app = cerebellum.client(options);