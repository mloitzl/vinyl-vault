import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { fork } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const PORT = process.env.PORT || 8080;

// Since this is an ESM module, we handle __dirname manually
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Paths relative to packages/demo-server/dist/index.js
// We go up three levels: dist -> src -> packages -> root
const BACKEND_PATH = path.resolve(__dirname, '../../backend/dist/index.js');
const BFF_PATH = path.resolve(__dirname, '../../bff/dist/index.js');

console.log(`[Demo-Orchestrator]: Targeting Backend at ${BACKEND_PATH}`);
console.log(`[Demo-Orchestrator]: Targeting BFF at ${BFF_PATH}`);

// 1. Launch Services
const backend = fork(BACKEND_PATH, {
  env: { ...process.env, BACKEND_PORT: '4001', NODE_ENV: 'production' },
});

const bff = fork(BFF_PATH, {
  env: {
    ...process.env,
    BFF_PORT: '3001',
    BACKEND_URL: 'http://localhost:4001/graphql',
    NODE_ENV: 'production',
    // Forward COOKIE_DOMAIN so the BFF session cookie is scoped to the
    // shared parent domain (e.g. '.vinylvault.example.com').
    ...(process.env.COOKIE_DOMAIN ? { COOKIE_DOMAIN: process.env.COOKIE_DOMAIN } : {}),
  },
});

// 2. Gateway Routes
app.use(
  createProxyMiddleware({
    target: 'http://localhost:3001',
    changeOrigin: true,
    pathFilter: ['/graphql', '/auth'],
  })
);

// Health check endpoint that aggregates health from backend and bff
app.get('/health', async (_, res) => {
  try {
    const [backendHealth, bffHealth] = await Promise.all([
      fetch('http://localhost:4001/health').then((r) => r.json()),
      fetch('http://localhost:3001/health').then((r) => r.json()),
    ]);

    const allHealthy = backendHealth.status === 'ok' && bffHealth.status === 'ok';

    res.status(allHealthy ? 200 : 503).json({
      status: allHealthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        backend: backendHealth,
        bff: bffHealth,
      },
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.listen(PORT, () => console.log(`[Gateway]: Unified endpoint ready on port ${PORT}`));

process.on('SIGTERM', () => {
  backend.kill();
  bff.kill();
  process.exit(0);
});
