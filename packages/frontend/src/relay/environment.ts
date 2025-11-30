import {
  Environment,
  Network,
  RecordSource,
  Store,
  FetchFunction,
} from 'relay-runtime';

const fetchFn: FetchFunction = async (request, variables) => {
  const response = await fetch('/graphql', {
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
