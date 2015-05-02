import ajax from 'vertebrae/adapters/axios';
import Sync from 'vertebrae/sync';
import Model from 'vertebrae/model';
import Collection from 'vertebrae/collection';

export default Collection(
  {
    sync: Sync({
      ajax: ajax
    })
  },
  Model({
    sync: Sync({
      ajax: ajax
    })
  })
);
