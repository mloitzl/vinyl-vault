/**
 * Helper to execute GraphQL operations via the Relay environment
 * Used in contexts where hooks cannot be used (like AuthContext)
 */

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
  const response = await fetch('/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
