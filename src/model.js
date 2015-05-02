import ajax from 'vertebrae/adapters/axios';
import Sync from 'vertebrae/sync';
import Model from 'vertebrae/model';

export default Model({
  sync: Sync({
    ajax: ajax
  })
});
