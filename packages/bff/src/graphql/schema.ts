import { stitchSchemas } from '@graphql-tools/stitch';
import { schemaFromExecutor, FilterTypes } from '@graphql-tools/wrap';
import { typeDefs } from './typeDefs.js';
import { resolvers } from './resolvers.js';
import { backendExecutor } from './executor.js';
import type { GraphQLContext } from '../types/context.js';

// Types owned exclusively by the BFF. The backend has its own internal versions
// (e.g. Tenant has tenantId/databaseName; BFF Tenant has id/type/role for the
// frontend), so we strip the backend copies to avoid field conflicts at stitch time.
const BFF_OWNED_TYPES = new Set(['Tenant', 'TenantType', 'TenantRole', 'FeatureFlags']);

const RETRY_DELAYS_MS = [2000, 5000, 10000, 20000]; // ~37s total before giving up

export async function createStitchedSchema() {
  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      // Introspect the remote backend schema over HTTP
      const remoteSchema = await schemaFromExecutor(backendExecutor);

      // The BFF extensions (viewer, switchTenant, User session fields, Tenant/FeatureFlags
      // types) are added as top-level typeDefs/resolvers on the stitched schema.
      // This avoids calling makeExecutableSchema with orphan `extend type` definitions —
      // stitchSchemas applies these extensions AFTER the remote schema (which defines
      // Query, Mutation, User) is already in place.
      return stitchSchemas({
        subschemas: [
          {
            schema: remoteSchema,
            executor: backendExecutor,
            // Strip types owned by the BFF so there are no conflicting definitions.
            transforms: [new FilterTypes<GraphQLContext>((type) => !BFF_OWNED_TYPES.has(type.name))],
          },
        ],
        typeDefs,
        resolvers,
      });
    } catch (err) {
      lastError = err;
      if (attempt < RETRY_DELAYS_MS.length) {
        const delay = RETRY_DELAYS_MS[attempt];
        console.error(`[schema] Backend introspection failed (attempt ${attempt + 1}), retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}
