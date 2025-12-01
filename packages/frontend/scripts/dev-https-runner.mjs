#!/usr/bin/env node
import { createServer } from 'vite';
import fs from 'fs';

async function main() {
  const [
    ,
    ,
    host = 'localhost',
    certPath = './certs/localhost.pem',
    keyPath = './certs/localhost-key.pem',
  ] = process.argv;

  if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
    console.error('Certificate or key not found:', certPath, keyPath);
    process.exit(1);
  }

  const https = {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),
  };

  const server = await createServer({
    server: {
      host,
      https,
    },
  });

  await server.listen();
  server.printUrls();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
