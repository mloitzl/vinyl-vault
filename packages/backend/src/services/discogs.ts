// Discogs API service
// TODO: Implement Discogs API integration

const DISCOGS_API_BASE = 'https://api.discogs.com';

export interface DiscogsSearchResult {
  id: number;
  title: string;
  year?: string;
  format?: string[];
  label?: string[];
  country?: string;
  barcode?: string[];
  cover_image?: string;
}

export async function searchByBarcode(_barcode: string): Promise<DiscogsSearchResult[]> {
  // TODO: Implement Discogs barcode search
  // See: https://www.discogs.com/developers/#page:database,header:database-search
  return [];
}

export async function getReleaseDetails(_releaseId: number): Promise<unknown> {
  // TODO: Implement Discogs release details fetch
  return null;
}
