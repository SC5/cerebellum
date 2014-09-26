require('native-promise-only');
var axios = require('axios');

var Sync = {
  ajax: function(settings) {
    return new Promise(function(resolve, reject) {
      var options = {
        method: settings.type.toLowerCase(),
        url: settings.url,
        responseType: "text"
      };
      if (settings.headers) {
        options.headers = settings.headers;
      }
      if (settings.processData) {
        options.params = settings.data;
      } else {
        options.data = settings.data;
      }
      return axios(options).then(function(response) {
        settings.success(response.data);
        return resolve(response);
      }).catch(function(response) {
        settings.error(response.data);
        return reject(response);
      });
    });
  }
};

module.exports = Sync;
