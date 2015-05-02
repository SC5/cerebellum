import 'native-promise-only';

export default new Promise((resolve, reject) => {
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
