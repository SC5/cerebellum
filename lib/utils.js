var Utils = {
  extractParams: function(params) {
    return Object.keys(params).reduce(function(arr, key) {
      arr.push(params[key]);
      return arr;
    }, []);
  }
};

module.exports = Utils;
