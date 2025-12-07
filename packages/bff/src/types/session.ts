// Session type declarations

import 'express-session';

export interface SessionUser {
  id: string;
  githubId: string;
  githubLogin: string;
  displayName: string;
  avatarUrl?: string;
  email?: string;
  role: 'ADMIN' | 'CONTRIBUTOR' | 'READER';
  createdAt: string;
  updatedAt: string;
}

declare module 'express-session' {
  interface SessionData {
    user?: SessionUser;
  }
}
