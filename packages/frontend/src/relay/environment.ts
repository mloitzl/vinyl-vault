import {
  Environment,
  Network,
  RecordSource,
  Store,
  FetchFunction,
  Observable,
  GraphQLResponse,
} from 'relay-runtime';
import type { RequestParameters } from 'relay-runtime';

/**
 * GraphQL error type from server response
 */
interface GraphQLError {
  message: string;
  locations?: Array<{
    line: number;
    column: number;
  }>;
  path?: (string | number)[];
  extensions?: Record<string, any>;
}

/**
 * GraphQL response structure
 */
interface GraphQLResponseData {
  data?: Record<string, any> | null;
  errors?: GraphQLError[];
  extensions?: Record<string, any>;
}

/**
 * Fetch function to execute GraphQL queries and mutations over HTTP.
 * Sends POST requests to the BFF GraphQL endpoint with proper error handling.
 */
const fetchGraphQL: FetchFunction = (request: RequestParameters, variables: any) => {
  return Observable.create((sink) => {
    (async () => {
      try {
        // Build request body
        const body = JSON.stringify({
          query: request.text,
          variables,
        });

        // Send POST request to BFF GraphQL endpoint
        const response = await fetch('/graphql', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include', // Send cookies for auth
          body,
        });

        // Handle HTTP errors
        if (!response.ok) {
          throw new Error(
            `HTTP ${response.status}: ${response.statusText}\nRequest: ${request.name}`
          );
        }

        // Parse response
        const data: GraphQLResponseData = await response.json();

        // Log GraphQL errors if present
        if (data.errors && data.errors.length > 0) {
          console.error(
            `[Relay GraphQL Error] ${request.name}`,
            data.errors.map((err) => ({
              message: err.message,
              path: err.path?.join('.'),
              locations: err.locations,
            }))
          );
        }

        // Send response to Relay
        sink.next(data as GraphQLResponse);
        sink.complete();
      } catch (error) {
        // Log and propagate network errors
        const networkError =
          error instanceof Error
            ? error
            : new Error(typeof error === 'string' ? error : 'Unknown network error');
        console.error(`[Relay Network Error] ${networkError.message}`);
        sink.error(networkError);
      }
    })();
  });
};

/**
 * Relay Environment configured with:
 * - HTTP network layer for GraphQL communication
 * - Normalized RecordSource for efficient caching
 * - Store for client-side state management
 */
export const RelayEnvironment = new Environment({
  network: Network.create(fetchGraphQL),
  store: new Store(new RecordSource()),
});
