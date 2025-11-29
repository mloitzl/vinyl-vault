# Vinyl Vault Infrastructure

This directory contains Docker and infrastructure configuration for deploying Vinyl Vault.

## Files

- `docker-compose.yml` - Multi-container Docker setup
- `Caddyfile` - Caddy reverse proxy configuration (for production)
- `Dockerfile.*` - Individual service Dockerfiles

## Quick Start (Development)

```bash
# Start MongoDB only
docker-compose up -d mongodb

# Or start all services
docker-compose up -d
```

## Production Deployment

See the deployment guide in the main README for production setup on Raspberry Pi 5.
