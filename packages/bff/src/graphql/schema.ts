import { stitchSchemas } from '@graphql-tools/stitch';
import { FilterTypes, wrapSchema } from '@graphql-tools/wrap';
import { buildASTSchema, parse } from 'graphql';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { typeDefs } from './typeDefs.js';
import { resolvers } from './resolvers.js';
import { backendExecutor } from './executor.js';
import type { GraphQLContext } from '../types/context.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Types owned exclusively by the BFF. The backend has its own internal versions
// (e.g. Tenant has tenantId/databaseName; BFF Tenant has id/type/role for the
// frontend), so we strip the backend copies to avoid field conflicts at stitch time.
const BFF_OWNED_TYPES = new Set(['Tenant', 'TenantType', 'TenantRole', 'FeatureFlags']);

function resolveBackendSchemaPath(): string {
  // __dirname differs between environments:
  //   tsx dev:  .../packages/bff/src/graphql  → 3 levels up = packages/
  //   compiled: /app/dist/graphql              → 2 levels up = /app/
  const candidates = [
    join(__dirname, '../../../backend/src/schema.graphql'), // tsx dev
    join(__dirname, '../../backend/src/schema.graphql'),   // compiled prod (/app/backend/...)
  ];
  const found = candidates.find(existsSync);
  if (!found) {
    throw new Error(
      `Backend schema not found. Tried:\n${candidates.map((p) => `  ${p}`).join('\n')}`
    );
  }
  return found;
}

export async function createStitchedSchema() {
  // Read the backend schema from the static file shipped in the same Docker image.
  // This avoids a runtime introspection HTTP call, which fails in production
  // because the backend disables GraphQL introspection (introspection: false).
  const backendSDL = readFileSync(resolveBackendSchemaPath(), 'utf-8');
  const backendDoc = parse(backendSDL);
  const filteredDoc = {
    ...backendDoc,
    definitions: backendDoc.definitions.filter(
      (def) => !('name' in def && def.name && BFF_OWNED_TYPES.has(def.name.value))
    ),
  };
  const backendSchema = buildASTSchema(filteredDoc, { assumeValidSDL: true });

  // Wrap the static schema with the HTTP executor so queries are proxied to the
  // real backend at runtime, while the schema shape is known statically at startup.
  const remoteSchema = wrapSchema({
    schema: backendSchema,
    executor: backendExecutor,
    transforms: [new FilterTypes<GraphQLContext>((type) => !BFF_OWNED_TYPES.has(type.name))],
  });

  // The BFF extensions (viewer, switchTenant, User session fields, Tenant/FeatureFlags
  // types) are added as top-level typeDefs/resolvers on the stitched schema.
  return stitchSchemas({
    subschemas: [remoteSchema],
    typeDefs,
    resolvers,
  });
}
