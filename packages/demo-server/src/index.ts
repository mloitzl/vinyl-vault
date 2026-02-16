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
const BACKEND_PATH = path.resolve(__dirname, '../../../backend/dist/index.js');
const BFF_PATH = path.resolve(__dirname, '../../../bff/dist/index.js');

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
  },
});

// 2. Gateway Routes
app.use('/graphql', createProxyMiddleware({ target: 'http://localhost:3001', changeOrigin: true }));
app.use('/auth', createProxyMiddleware({ target: 'http://localhost:3001', changeOrigin: true }));

app.get('/health', (_, res) => res.status(200).json({ status: 'ok', source: 'demo-package' }));

app.listen(PORT, () => console.log(`[Gateway]: Unified endpoint ready on port ${PORT}`));

process.on('SIGTERM', () => {
  backend.kill();
  bff.kill();
  process.exit(0);
});
