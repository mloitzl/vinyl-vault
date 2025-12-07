// GraphQL context shared by resolvers

import { Db } from 'mongodb';

export interface GraphQLContext {
  userId: string | null;
  username: string | null;
  avatarUrl?: string | null;
  tenantId: string | null;
  tenantRole: 'ADMIN' | 'MEMBER' | 'VIEWER' | null;
  githubLogin?: string | null;
  db?: Db | null; // tenant database connection
  registryDb?: Db | null; // central registry database connection
}
