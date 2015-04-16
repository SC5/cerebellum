var ajax = require('vertebrae/adapters/axios');
var Sync = require('vertebrae/sync')({ajax: ajax});
module.exports = require('vertebrae/model')({sync: Sync});
