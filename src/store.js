import immstruct from 'immstruct';
import invariant from 'invariant';

function bootstrap(stateCursor, json) {
  if (!json) {
    return;
  }

  stateCursor.update((previousState) => {
    let parsed;
    try {
      parsed = JSON.parse(json);
    } catch (e) {
      parsed = null;
    }

    if (parsed) {
      return Object.keys(parsed).reduce((newState, storeId) => {
        newState.set(storeId, parsed[storeId]);
        return newState;
      }, previousState);
    } else {
      return previousState;
    }
  });
}

function logAction(actionsLog, {storeId, action, args}) {
  return actionsLog.update(log => {
    return log.push({
      storeId,
      action,
      args,
      timestamp: Date.now()
    });
  });
}

function logEvent(eventsLog, storeId, title, ...args) {
  return eventsLog.update(log => {
    return log.push({
      storeId,
      title,
      args,
      timestamp: Date.now()
    });
  });
}

export function createActions(state, actions={}) {
  return Object.keys(actions).reduce((actionFns, storeId) => {
    actionFns[storeId] = Object.keys(actions[storeId]).reduce((storeActions, action) => {
      storeActions[action] = (...args) => {
        state.cursor(["stores", storeId]).update(oldState => {
          return actions[storeId][action].call(
            null,
            oldState,
            ...args
          );
        });
        logAction(state.cursor(["log"]), {storeId, action, args});
      };
      return storeActions;
    }, {});
    return actionFns;
  }, {});
}

export function createStore(state, actions={}) {

  invariant(
    state,
    "No state provided, state must be an instance of immstruct"
  );

  return {

    // TODO: replay, go back to initial state and apply n amount steps of
    // state.get("log"), call action with action.call({replay: true}, ...args)
    // if user modifies state, remove all actions from log after current step
    // and replace log
    travel() {
      console.log("TODO");
    },

    bootstrap(json) {
      return bootstrap(state.cursor(["stores"]), json);
    },

    snapshot() {
      return JSON.stringify(state.cursor(["stores"]).toJSON());
    },

    get(path) {
      return state.cursor(["stores"]).get(path);
    },

    cursor(...args) {
      return state.cursor(...args);
    },

    get log() {
      return state.cursor().get("log");
    },

    // TODO: optimize
    events(filter=()=>true) {
      return state.cursor(["events"]).filter(filter).toArray();
    },

    logEvent(storeId, title, ...args) {
      return logEvent(state.cursor(["events"]), storeId, title, ...args);
    },

    observeEvents(callback) {
      return state.reference(["events"]).observe((newEvents) => {
        return callback(newEvents.last());
      });
    },

    observe(storeId, callback) {
      return state.reference(["log"]).observe((newLog) => {
        const lastLog = newLog.last();
        if (lastLog.storeId === storeId) {
          callback(lastLog);
        }
      });
    },

    onSwap(callback) {
      state.on('swap', callback);
      return [state, callback];
    },

    actions: createActions(state, actions)
  };
}

export function createState(initialState={}) {
  const state = (new immstruct.Immstruct()).get({
    events: [],
    log: [],
    stores: {}
  });
  Object.keys(initialState).forEach(storeId => {
    state.cursor(["stores"]).set(storeId, initialState[storeId]);
  });
  return state;
}

export default {
  createActions,
  createState,
  createStore
};
