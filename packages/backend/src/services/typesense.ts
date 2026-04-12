/**
 * Typesense client service.
 *
 * Owns all Typesense interactions: collection schema, upsert, delete, and search.
 * The single shared collection "records" holds every tenant's documents; tenant
 * isolation is enforced by a mandatory filter_by on every query (see typesense-query.ts).
 */

import Typesense from 'typesense';
import { ObjectId } from 'mongodb';
import type { Db } from 'mongodb';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import type {
  RecordDocument,
  RecordSearchFilter,
  SearchFacetBucket,
  SearchFacets,
  SearchHighlight,
  SearchRecordsResult,
} from '../models/record.js';
import { buildTypesenseSearchParams } from './typesense-query.js';
import { mapTypesenseHighlights } from './typesense-highlights.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TypesenseRecord {
  id: string;              // MongoDB _id as string (globally unique)
  tenantId: string;        // mandatory filter + facet field
  releaseArtist: string;
  releaseTitle: string;
  releaseLabel: string;
  releaseGenre: string[];
  releaseStyle: string[];
  releaseTrackTitles: string[];
  releaseFormat: string;
  releaseCountry: string;
  releaseYear: number;
  condition: string;
  location: string;
  notes: string;
  updatedAt: number;       // Unix ms timestamp — used for default sort
}

type TypesenseClientInstance = InstanceType<(typeof Typesense)['Client']>;

const COLLECTION_NAME = 'records';

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

let _client: TypesenseClientInstance | null = null;

export function getTypesenseClient(): TypesenseClientInstance {
  if (!_client) {
    _client = new Typesense.Client({
      nodes: [
        {
          host: config.typesense.host,
          port: config.typesense.port,
          protocol: config.typesense.protocol,
        },
      ],
      apiKey: config.typesense.apiKey,
      connectionTimeoutSeconds: 5,
      retryIntervalSeconds: 0.1,
      numRetries: 3,
    });
  }
  return _client;
}

// ---------------------------------------------------------------------------
// Collection management
// ---------------------------------------------------------------------------

let _collectionEnsured = false;

export async function ensureCollection(): Promise<void> {
  if (_collectionEnsured) return;

  const client = getTypesenseClient();

  try {
    await client.collections(COLLECTION_NAME).retrieve();
    _collectionEnsured = true;
    logger.info({ collection: COLLECTION_NAME }, 'Typesense collection already exists');
    return;
  } catch (err: any) {
    if (err?.httpStatus !== 404) throw err;
  }

  await client.collections().create({
    name: COLLECTION_NAME,
    fields: [
      { name: 'id',                 type: 'string'   },
      { name: 'tenantId',           type: 'string',   facet: true  },
      { name: 'releaseArtist',      type: 'string',   facet: true  },
      { name: 'releaseTitle',       type: 'string',   facet: true  },
      { name: 'releaseLabel',       type: 'string',   facet: false },
      { name: 'releaseGenre',       type: 'string[]', facet: true  },
      { name: 'releaseStyle',       type: 'string[]', facet: false },
      { name: 'releaseTrackTitles', type: 'string[]', facet: false },
      { name: 'releaseFormat',      type: 'string',   facet: true  },
      { name: 'releaseCountry',     type: 'string',   facet: true  },
      { name: 'releaseYear',        type: 'int32',    facet: true,  optional: true },
      { name: 'condition',          type: 'string',   facet: true  },
      { name: 'location',           type: 'string',   facet: true  },
      { name: 'notes',              type: 'string',   facet: false },
      { name: 'updatedAt',          type: 'int64'    },
    ] as any,
    default_sorting_field: 'updatedAt',
  });

  _collectionEnsured = true;
  logger.info({ collection: COLLECTION_NAME }, 'Typesense collection created');
}

// ---------------------------------------------------------------------------
// Document operations
// ---------------------------------------------------------------------------

/** Map a MongoDB RecordDocument to a Typesense document. */
export function toTypesenseDoc(tenantId: string, record: RecordDocument): TypesenseRecord {
  return {
    id:                 record._id!.toString(),
    tenantId,
    releaseArtist:      record.releaseArtist      ?? '',
    releaseTitle:       record.releaseTitle        ?? '',
    releaseLabel:       record.releaseLabel        ?? '',
    releaseGenre:       record.releaseGenre        ?? [],
    releaseStyle:       record.releaseStyle        ?? [],
    releaseTrackTitles: record.releaseTrackTitles  ?? [],
    releaseFormat:      record.releaseFormat       ?? '',
    releaseCountry:     record.releaseCountry      ?? '',
    releaseYear:        record.releaseYear         ?? 0,
    condition:          record.condition           ?? '',
    location:           record.location            ?? '',
    notes:              record.notes               ?? '',
    updatedAt:          record.updatedAt ? new Date(record.updatedAt).getTime() : Date.now(),
  };
}

export async function upsertRecord(tenantId: string, record: RecordDocument): Promise<void> {
  await ensureCollection();
  const doc = toTypesenseDoc(tenantId, record);
  await getTypesenseClient().collections(COLLECTION_NAME).documents().upsert(doc as any);
}

export async function deleteRecord(mongoId: string): Promise<void> {
  try {
    await getTypesenseClient().collections(COLLECTION_NAME).documents(mongoId).delete();
  } catch (err: any) {
    // 404 means already absent — not an error for delete operations
    if (err?.httpStatus !== 404) throw err;
  }
}

export async function deleteTenantRecords(tenantId: string): Promise<void> {
  await getTypesenseClient()
    .collections(COLLECTION_NAME)
    .documents()
    .delete({ filter_by: `tenantId:=\`${tenantId}\`` } as any);
  logger.info({ tenantId }, 'Deleted all Typesense records for tenant');
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export async function search(
  tenantDb: Db,
  tenantId: string,
  query: string,
  filter: RecordSearchFilter,
  perPage: number,
  after?: string,
): Promise<SearchRecordsResult> {
  await ensureCollection();

  // Decode Relay cursor → skip offset
  let skip = 0;
  if (after) {
    try {
      const decoded = Buffer.from(after, 'base64').toString('utf8');
      const match = decoded.match(/^cursor:(\d+)$/);
      if (match) skip = parseInt(match[1], 10);
    } catch {
      // ignore invalid cursor
    }
  }
  const page = Math.floor(skip / perPage) + 1;

  const params = buildTypesenseSearchParams(query, filter, page, perPage, tenantId);
  const result = await getTypesenseClient()
    .collections(COLLECTION_NAME)
    .documents()
    .search(params as any) as any;

  const hits: any[] = result.hits ?? [];
  const totalCount: number = result.found ?? 0;

  // Fetch full records from MongoDB preserving Typesense ranking order
  const ids = hits.map((h: any) => new ObjectId(h.document.id as string));
  const collection = tenantDb.collection<RecordDocument>('records');
  const docs = await collection.find({ _id: { $in: ids } }).toArray();
  const recordMap = new Map<string, RecordDocument>(docs.map((d) => [d._id!.toString(), d]));

  // Map highlight snippets per document id
  const highlightMap = new Map<string, SearchHighlight[]>(
    hits.map((h: any) => [h.document.id as string, mapTypesenseHighlights(h)])
  );

  const makeCursor = (offset: number) => Buffer.from(`cursor:${offset}`).toString('base64');

  const edges = ids
    .map((id, i) => {
      const record = recordMap.get(id.toString());
      if (!record) return null;
      return {
        cursor:     makeCursor(skip + i + 1),
        node:       record,
        highlights: highlightMap.get(id.toString()) ?? [],
      };
    })
    .filter((e): e is NonNullable<typeof e> => e !== null);

  const facets = mapTypesenseFacets(result.facet_counts ?? []);

  return {
    edges,
    pageInfo: {
      hasNextPage:     totalCount > skip + perPage,
      hasPreviousPage: skip > 0,
      startCursor:     edges[0]?.cursor,
      endCursor:       edges[edges.length - 1]?.cursor,
    },
    totalCount,
    facets,
  };
}

// ---------------------------------------------------------------------------
// Facet mapping
// ---------------------------------------------------------------------------

function mapTypesenseFacets(facetCounts: any[]): SearchFacets {
  const byField = new Map<string, SearchFacetBucket[]>();
  for (const fc of facetCounts) {
    byField.set(
      fc.field_name as string,
      (fc.counts as any[]).map((c) => ({ value: c.value as string, count: c.count as number })),
    );
  }
  return {
    artist:    byField.get('releaseArtist')  ?? [],
    title:     byField.get('releaseTitle')   ?? [],
    genre:     byField.get('releaseGenre')   ?? [],
    format:    byField.get('releaseFormat')  ?? [],
    condition: byField.get('condition')      ?? [],
    location:  byField.get('location')       ?? [],
    country:   byField.get('releaseCountry') ?? [],
  };
}
