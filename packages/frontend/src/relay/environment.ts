import {
  Environment,
  Network,
  RecordSource,
  Store,
  FetchFunction,
} from 'relay-runtime';
import { getEndpoint } from '../utils/apiUrl.js';

const fetchFn: FetchFunction = async (request, variables) => {
  const response = await fetch(getEndpoint('/graphql'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({
      query: request.text,
      variables,
    }),
  });

  return response.json();
};

export const RelayEnvironment = new Environment({
  network: Network.create(fetchFn),
  store: new Store(new RecordSource()),
});
