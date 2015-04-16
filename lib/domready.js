require('native-promise-only');

module.exports = new Promise(function(resolve, reject) {
  if (document.readyState === 'complete') {
    resolve();
  } else {
    function onReady() {
      resolve();
      document.removeEventListener('DOMContentLoaded', onReady, true);
    }
    document.addEventListener('DOMContentLoaded', onReady, true);
  }
});