// Release model types and repository
// TODO: Implement release data access

import { ObjectId } from 'mongodb';

export interface Track {
  position?: string;
  title: string;
  duration?: string;
}

export interface ReleaseDocument {
  _id: ObjectId;
  barcode: string;
  artist: string;
  title: string;
  year?: number;
  format?: string;
  genre?: string[];
  style?: string[];
  label?: string;
  country?: string;
  coverImageUrl?: string;
  trackList?: Track[];
  externalId?: string;
  source: 'DISCOGS' | 'MUSICBRAINZ' | 'MANUAL';
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateReleaseInput {
  barcode: string;
  artist: string;
  title: string;
  year?: number;
  format?: string;
  genre?: string[];
  style?: string[];
  label?: string;
  country?: string;
  coverImageUrl?: string;
  trackList?: Track[];
  externalId?: string;
  source: 'DISCOGS' | 'MUSICBRAINZ' | 'MANUAL';
}

// TODO: Implement ReleaseRepository class
