// GraphQL context type

import type { Response } from 'express';
import type { Session } from 'express-session';
import type { SessionUser } from './session.js';

export interface GraphQLContext {
  req: any;
  res: Response;
  user: SessionUser | null;
  session: Session;
  activeTenantId: string | null;
  /** Pre-computed JWT for the current user's active tenant. Undefined when unauthenticated. */
  jwt?: string;
}
