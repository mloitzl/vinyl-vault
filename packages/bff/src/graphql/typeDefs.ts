// BFF GraphQL type definitions loader

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const typeDefs = readFileSync(
  join(__dirname, '../schema.graphql'),
  'utf-8'
);
