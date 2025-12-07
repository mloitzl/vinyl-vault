// Backend client for proxying requests from BFF

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000/graphql';

export interface BackendClientOptions {
  jwt?: string;
}

export async function queryBackend<T>(
  query: string,
  variables: Record<string, unknown>,
  options: BackendClientOptions = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (options.jwt) {
    headers['Authorization'] = `Bearer ${options.jwt}`;
  }

  const response = await fetch(BACKEND_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
  });

  const result = await response.json();
  
  if (result.errors) {
    throw new Error(result.errors[0]?.message || 'Backend error');
  }

  return result.data as T;
}
