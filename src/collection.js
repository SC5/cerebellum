var ajax = require('vertebrae/adapters/axios');
var Sync = require('vertebrae/sync')({ajax: ajax});
var Model = require('vertebrae/model')({sync: Sync});
module.exports = require('vertebrae/collection')({sync: Sync}, Model);
