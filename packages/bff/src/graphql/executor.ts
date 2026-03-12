import { buildHTTPExecutor } from '@graphql-tools/executor-http';
import { config } from '../config/env.js';
import type { GraphQLContext } from '../types/context.js';

export const backendExecutor = buildHTTPExecutor({
  endpoint: config.backend.url,
  headers: (executorRequest): Record<string, string> => {
    const context = executorRequest?.context as GraphQLContext | undefined;
    if (context?.jwt) {
      return { Authorization: `Bearer ${context.jwt}` };
    }
    return {};
  },
});
