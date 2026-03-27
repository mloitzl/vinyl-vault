/**
 * Helper to execute GraphQL operations via the Relay environment
 * Used in contexts where hooks cannot be used (like AuthContext)
 */

import { getEndpoint } from './apiUrl.js';
import { getSessionURL } from '../logrocket.js';

interface GraphQLResponse {
  data?: Record<string, any> | null;
  errors?: Array<{ message: string }>;
}

/**
 * Execute a GraphQL mutation without using Relay hooks
 * Useful for auth-related operations in context providers
 */
export async function executeGraphQLMutation(
  query: string,
  variables: Record<string, any>
): Promise<any> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const lrSession = getSessionURL();
  if (lrSession) headers['X-LogRocket-Session'] = lrSession;

  const response = await fetch(getEndpoint('/graphql'), {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const data: GraphQLResponse = await response.json();

  if (data.errors) {
    throw new Error(data.errors[0]?.message || 'GraphQL error');
  }

  return data.data;
}
