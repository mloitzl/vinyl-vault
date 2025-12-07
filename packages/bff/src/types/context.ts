// GraphQL context type

import type { Request, Response } from 'express';
import type { SessionUser } from './session.js';

export interface GraphQLContext {
  req: Request;
  res: Response;
  user: SessionUser | null;
  activeTenantId: string | null;
}
