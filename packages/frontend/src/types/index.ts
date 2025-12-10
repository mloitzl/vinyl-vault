// Frontend types
// TODO: Add shared types

export interface User {
  id: string;
  githubLogin: string;
  displayName: string;
  avatarUrl?: string;
  role: 'ADMIN' | 'MEMBER' | 'VIEWER';
}

export interface Record {
  id: string;
  releaseId: string;
  userId: string;
  purchaseDate?: string;
  price?: number;
  condition?: string;
  location?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Release {
  id: string;
  barcode: string;
  artist: string;
  title: string;
  year?: number;
  format?: string;
  label?: string;
  country?: string;
  coverImageUrl?: string;
  externalId?: string;
  source?: 'discogs' | 'musicbrainz' | 'manual';
}
