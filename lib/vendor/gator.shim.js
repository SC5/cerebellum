// this shim can be removed when proper browserify support is merged
// see: https://github.com/ccampbell/gator/pull/15
require('./gator');
module.exports = global.Gator;