// with node-jsx we can require our .jsx from components/*.jsx
require('node-jsx').install({extension: ".jsx"});

var React = require('react/addons');
var compress = require('compression');
var favicon = require('serve-favicon');

var cerebellum = require('../../index');
var options = require('./options');

// document is a cheerio instance with public/index.html content
options.render = function render(document, opts) {
  if (opts == null) {
    opts = {};
  }
  document("title").html(opts.title);
  document("#"+options.appId).html( React.renderToString(opts.component) );
  return document.html();
};

// pass your middleware to express with options.middleware
options.middleware = [
  favicon(options.staticFiles + '/favicon.ico'),
  compress()
];

var app = cerebellum.server(options);

// always register static files middleware after defining routes
app.useStatic();

app.listen(Number(process.env.PORT || 4000), function() {
  console.log("static-pages development server listening on port "+ (this.address().port));
});