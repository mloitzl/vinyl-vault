#!/usr/bin/env node
/**
 * Merges the backend domain schema with the BFF auth/session extensions into a
 * single schema.graphql for the Relay compiler.
 *
 * Replicates what the BFF does at runtime via @graphql-tools/stitch — without
 * requiring a live server. Both static .graphql files are the source of truth;
 * no committed artifact or live server needed.
 *
 * Usage:
 *   node scripts/generate-schema.mjs
 * or via pnpm script:
 *   cd packages/frontend && pnpm update-schema
 */

import { parse, buildASTSchema, printSchema } from 'graphql';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../../..');

const backendSDL = readFileSync(join(root, 'packages/backend/src/schema.graphql'), 'utf-8');
const bffSDL = readFileSync(join(root, 'packages/bff/src/schema.graphql'), 'utf-8');
const out = join(root, 'packages/frontend/schema.graphql');

// Tenant has a different shape in the BFF (id/name/type/role for the frontend) vs
// the backend (tenantId/databaseName/...). Strip the backend version so the BFF
// definition wins. TenantType/TenantRole are identical in both schemas and come
// from the backend SDL now (they were removed from the BFF SDL to avoid duplication).
// FeatureFlags is BFF-only.
const BFF_OWNED = new Set(['Tenant', 'FeatureFlags']);

const backendDoc = parse(backendSDL);
const bffDoc = parse(bffSDL);

// Remove BFF-owned type definitions from the backend so the BFF versions win.
// The backend's references to these types (e.g. createTenant: Tenant!) remain and
// will resolve to the BFF's definitions in the merged document — that's fine since
// the frontend never queries those backend-internal mutations.
const filteredBackendDefs = backendDoc.definitions.filter(
  (def) => !('name' in def && def.name && BFF_OWNED.has(def.name.value))
);

// Combine into one document: filtered backend definitions first, then BFF definitions
// (which include `type Tenant/TenantRole/TenantType/FeatureFlags` and
//  `extend type Query/Mutation/User`).
const mergedDoc = { ...backendDoc, definitions: [...filteredBackendDefs, ...bffDoc.definitions] };
const stitchedSchema = buildASTSchema(mergedDoc, { assumeValidSDL: true });

writeFileSync(out, printSchema(stitchedSchema));
console.log(`schema.graphql written (${printSchema(stitchedSchema).split('\n').length} lines)`);
