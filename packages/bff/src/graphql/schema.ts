import { stitchSchemas } from '@graphql-tools/stitch';
import { RenameTypes } from '@graphql-tools/wrap';
import { buildASTSchema, parse } from 'graphql';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { typeDefs } from './typeDefs.js';
import { resolvers } from './resolvers.js';
import { backendExecutor } from './executor.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

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

  // Build the full, valid backend schema — no SDL stripping needed.
  // Stripping types from the SDL before buildASTSchema creates dangling references
  // (e.g. createTenant: Tenant! with no Tenant in the type map) which causes
  // stitchSchemas to crash when it walks the mutation type's fields.
  const backendSchema = buildASTSchema(parse(backendSDL));

  // BFF extensions (viewer, switchTenant, User session fields, Tenant/FeatureFlags types)
  // are added as top-level typeDefs/resolvers on the stitched schema.
  return stitchSchemas({
    subschemas: [
      {
        schema: backendSchema,
        executor: backendExecutor,
        // Rename the backend's Tenant type to avoid a shape conflict with the BFF's Tenant.
        // Backend Tenant: { tenantId, tenantType, databaseName, ... }  (internal model)
        // BFF Tenant:     { id, name, type, role }                     (client-facing model)
        // TenantType/TenantRole are identical in both schemas — stitcher merges them cleanly.
        // RenameTypes context generic defaults to Record<string,any>; cast avoids a
        // mismatch with GraphQLContext since schema transforms don't receive request context.
        transforms: [new RenameTypes((name) => (name === 'Tenant' ? 'BackendTenant' : name)) as any],
        // Type merge: viewer/switchTenant return only session-side User fields.
        // This tells the stitcher it can fetch missing backend User fields (githubId, role, …)
        // on demand via query { user(id: $id) } rather than returning null for them.
        merge: {
          User: {
            selectionSet: '{ id }',
            fieldName: 'user',
            args: ({ id }: { id: string }) => ({ id }),
          },
        },
      },
    ],
    typeDefs,
    resolvers,
  });
}
