import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [
    react({
      babel: {
        // Enable Babel Macros so `babel-plugin-relay/macro` is transformed at build time
        plugins: ['babel-plugin-macros'],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/graphql': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/auth': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  // @ts-expect-error: Vitest extends Vite config with a `test` key
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
    reporters: process.env.CI ? ['default', 'json'] : ['default'],
    outputFile: process.env.CI ? { json: './test-results.json' } : undefined,
  },
});
