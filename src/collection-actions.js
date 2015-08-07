import findIndex from 'lodash/array/findIndex';
import remove from 'lodash/array/remove';
import {idOrRoot} from './utils';

function CollectionActions() {
  return {

    // optimistic create
    create(state, params, props) {
      const path = idOrRoot(params);
      return {
        ...(state || {}),
        [path]: [...(state[path] || []), {...props}]
      };
    },

    // optimistic update
    update(state, params, props) {
      const path = idOrRoot(params);
      const newCollection = [...(state[path] || [])];
      if (newCollection.length) {
        const index = findIndex(newCollection, (model) => {
          return model.id === params.id;
        });
        if (index !== -1) {
          newCollection[index] = {...newCollection[index], ...props};
        }
      }
      return {
        ...state,
        [path]: newCollection
      };
    },

    // optimistic delete
    remove(state, params) {
      const path = idOrRoot(params);
      const newCollection = [...(state[path] || [])];
      if (newCollection.length) {
        remove(newCollection, (model) => {
          return model.id === params.id;
        });
      }
      return {
        ...state,
        [path]: newCollection
      };
    },

    // replace state, fetch will call this
    // TODO: more intelligent replace with lodash's isEqual to avoid
    // component re-renders
    replace(state, params, props) {
      const path = idOrRoot(params);

      // replace single item inside collection
      if (typeof params === "object" && params.id) {
        const newCollection = [...(state[path] || [])];
        if (newCollection.length) {
          const index = findIndex(newCollection, (model) => {
            return model.id === params.id;
          });
          if (index !== -1) {
            newCollection[index] = props;
          }
        }
        return {
          ...state,
          [path]: newCollection
        };
      // replace whole collection
      } else {
        return {
          ...state,
          [path]: props
        };
      }
    },

    // expire does not modify state directly but we need it as an action
    // so we can perform side-effects elsewhere
    expire() {}
  };
}

export default CollectionActions;
