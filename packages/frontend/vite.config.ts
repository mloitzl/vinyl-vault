import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

// Relay's @refetchable directive generates `require()` calls in __generated__ files,
// which fail in Vite's ESM dev server. This plugin hoists them to static imports.
function relayRequireToImport(): Plugin {
  return {
    name: 'relay-require-to-import',
    transform(code, id) {
      if (!id.includes('__generated__') || !code.includes('require(')) return;
      const requireRe = /require\(['"]([^'"]+)['"]\)/g;
      const hoisted: string[] = [];
      let idx = 0;
      const replaced = code.replace(requireRe, (_match, p: string) => {
        const name = `__relayReq${idx++}`;
        hoisted.push(`import ${name} from '${p}';`);
        return name;
      });
      return hoisted.join('\n') + '\n' + replaced;
    },
  };
}

export default defineConfig({
  envDir: '../../',
  plugins: [
    relayRequireToImport(),
    react({
      babel: {
        plugins: [['babel-plugin-relay', { artifactDirectory: './src/__generated__' }]],
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
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
    reporters: process.env.CI ? ['default', 'json'] : ['default'],
    outputFile: process.env.CI ? { json: './test-results.json' } : undefined,
  },
});
