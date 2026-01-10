import '@testing-library/jest-dom';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {}, // deprecated
    removeListener: () => {}, // deprecated
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// Mock babel-plugin-relay/macro for tests
// Provide a ConcreteRequest-like shape with params.operationKind
vi.mock('babel-plugin-relay/macro', () => ({
  graphql: (strings: TemplateStringsArray) => {
    const text = strings[0] ?? '';
    const isMutation = /\bmutation\b/.test(text);
    const isQuery = /\bquery\b/.test(text);
    const operationKind = isMutation ? 'mutation' : isQuery ? 'query' : 'unknown';
    return {
      kind: 'Request',
      text,
      params: {
        name: 'MockOperation',
        operationKind,
        id: null,
        metadata: {},
        text,
      },
    };
  },
}));

// Provide a default fetch mock for tests that don't override it
if (!(globalThis as any).fetch) {
  (globalThis as any).fetch = vi.fn(async (input: any) => {
    const url = typeof input === 'string' ? input : input?.url;
    if (url && url.startsWith('/auth/me')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ user: null }),
      } as any;
    }
    // Default GraphQL response
    if (url && url.startsWith('/graphql')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: {} }),
      } as any;
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({}),
    } as any;
  });
}
