/**
 * Get the API URL from environment variables or relative path.
 * In development, uses relative URLs (/graphql, /auth).
 * In production (Vercel), uses the VITE_API_URL env var.
 */
export function getApiUrl(): string {
  // Vite exposes env vars as `import.meta.env.VITE_*`
  const apiUrl = (import.meta as any).env?.VITE_API_URL;
  return apiUrl || '';
}

/**
 * Construct a full API endpoint URL
 */
export function getEndpoint(path: string): string {
  const baseUrl = getApiUrl();
  if (!baseUrl) {
    // Development: use relative URLs
    return path;
  }
  // Production: use full URL
  return `${baseUrl}${path}`;
}
