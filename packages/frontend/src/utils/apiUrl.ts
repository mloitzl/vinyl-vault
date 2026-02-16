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
  // Production: use full URL (normalize to avoid double slashes and duplicate segments)
  const normalizedBase = baseUrl.replace(/\/+$/, '');
  let normalizedPath = path.startsWith('/') ? path : `/${path}`;

  if (normalizedBase.endsWith('/auth') && normalizedPath.startsWith('/auth/')) {
    normalizedPath = normalizedPath.replace('/auth', '');
  }

  if (normalizedBase.endsWith('/graphql') && normalizedPath.startsWith('/graphql')) {
    normalizedPath = normalizedPath.replace('/graphql', '');
  }

  return `${normalizedBase}${normalizedPath}`;
}
