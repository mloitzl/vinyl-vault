// GraphQL context shared by resolvers

export interface GraphQLContext {
  userId: string | null;
  username: string | null;
  avatarUrl?: string | null;
  tenantId: string | null;
  tenantRole: 'ADMIN' | 'CONTRIBUTOR' | 'READER' | null;
  githubLogin?: string | null;
}
