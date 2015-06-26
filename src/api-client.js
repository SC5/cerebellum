import axios from 'axios';

function APIClient(opts={}) {
  const options = {
    ...opts,
    responseType: "text",
    headers: {
      'Content-Type': 'application/json;charset=utf-8'
    }
  };

  if (opts.headers) {
    options.headers = {...options.headers, ...opts.headers};
  }

  return axios(options).then(response => {
    return response.data;
  });
}

export default APIClient;
