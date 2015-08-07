const _observers = {};

const observers = {
  init(key) {

    // unobserve previous observers
    if (_observers[key]) {
      _observers[key].forEach(function(observer) {
        if (typeof observer === "function") {
          return observer();
        } else if (Array.isArray(observer)) {
          return observer[0].removeListener("swap", observer[1]);
        }
      });
    }

    // reset state
    _observers[key] = [];

    return {
      add(fn) {
        _observers[key].push(fn);
      },
      addMany(fns) {
        fns.forEach(fn => _observers[key].push(fn));
      }
    };
  }
};

export default observers;
