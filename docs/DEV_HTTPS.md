## Local HTTPS for Frontend (dev)

When testing camera features on mobile devices (iOS Safari requires HTTPS), you can serve the Vite dev server over HTTPS using simple locally-trusted certificates created with `mkcert`.

This document shows two approaches:

- Quick manual commands (recommended)
- A convenience `npm` script (provided) that runs `mkcert` and starts Vite with `--https` for a given host.

Prerequisites
- macOS / Linux: install `mkcert` (https://github.com/FiloSottile/mkcert). On macOS with Homebrew:

  ```sh
  brew install mkcert
  brew install nss # optional if you use Firefox
  mkcert -install
  ```

Quick manual commands

1. Create a directory for certs inside the frontend package:

   ```sh
   mkdir -p packages/frontend/certs
   cd packages/frontend
   ```

2. Generate a cert for the host you will use (replace `HOST` with `localhost` or your LAN IP, e.g. `192.168.1.102`):

   ```sh
   HOST=192.168.1.102
   mkcert -key-file certs/$HOST-key.pem -cert-file certs/$HOST.pem "$HOST" "127.0.0.1" localhost
   ```

3. Start Vite with HTTPS and the generated certs:

   ```sh
   vite --host --https --cert packages/frontend/certs/$HOST.pem --key packages/frontend/certs/$HOST-key.pem
   ```

4. Open `https://$HOST:3000` on your mobile device. Accept the locally-trusted certificate if prompted (mkcert installs a local CA so modern browsers will trust it).

Convenience npm script

The repository includes an npm script `dev:https` in `packages/frontend/package.json` that wraps the steps above.

Usage (from repo root):

```sh
# Set HOST to the interface you want to serve on (default: localhost)
# Example for LAN testing (replace with your machine IP):
HOST=192.168.1.102 pnpm --filter @vinylvault/frontend run dev:https

# Or from the frontend package:
cd packages/frontend
HOST=192.168.1.102 pnpm run dev:https
```

Notes and troubleshooting
- Make sure the host you request in `mkcert` matches exactly the URL you open in the browser (including IP vs hostname).
- On iOS Safari the device must reach the site over HTTPS (localhost works for simulators but not for devices on the LAN unless you use a trusted cert).
- If you see certificate errors, ensure `mkcert -install` succeeded and that the device trusts the root CA (mkcert handles this automatically for the local machine).
- If you prefer not to install mkcert, you can use `ngrok http 3000` and open the provided HTTPS URL on your device.

Security reminder
- These certs and the mkcert root CA are for local development only. Do not use them in production. For production use a proper CA (Let's Encrypt / Caddy).
