# Syncline - Docker Deployment Guide

Deploy the entire Syncline distributed system with a single command! 🐳

## Prerequisites

- **Docker Desktop** installed
  - Windows: https://docs.docker.com/desktop/install/windows-install/
  - Mac: https://docs.docker.com/desktop/install/mac-install/
  - Linux: https://docs.docker.com/desktop/install/linux-install/

- Verify Docker is installed:
  ```bash
  docker --version
  docker-compose --version
  ```

## Quick Start

### Option 1: One Command Deployment

```bash
# From the syncline root directory
docker-compose up --build
```

This will:
1. Build all 4 services (API, Frontend, Worker, Notifier)
2. Start them in the correct order
3. Set up networking between services
4. Mount the database volume

Wait 2-3 minutes for everything to build and start.

### Option 2: Background Mode

```bash
# Start in background (detached mode)
docker-compose up -d --build

# View logs
docker-compose logs -f

# View logs for specific service
docker-compose logs -f api
docker-compose logs -f worker
```

### Option 3: Build Then Run

```bash
# Build images first
docker-compose build

# Then run
docker-compose up
```

## Access the Application

Once running, access:

- **Frontend:** http://localhost:3000
- **API:** http://localhost:3001
- **Notifier:** http://localhost:8080

## File Placement

Place the Docker files in these locations:

```
syncline/
├── docker-compose.yml           ← Root directory
├── api/
│   ├── Dockerfile              ← api-Dockerfile (rename)
│   └── .dockerignore           ← api-dockerignore (rename)
├── web/
│   ├── Dockerfile              ← web-Dockerfile (rename)
│   ├── .dockerignore           ← web-dockerignore (rename)
│   └── nginx.conf              ← nginx.conf
├── worker/
│   ├── Dockerfile              ← worker-Dockerfile (rename)
│   └── .dockerignore           ← worker-dockerignore (rename)
└── notifier/
    ├── Dockerfile              ← notifier-Dockerfile (rename)
    └── .dockerignore           ← notifier-dockerignore (rename)
```

## Managing Containers

### View Running Containers
```bash
docker-compose ps
```

### Stop All Services
```bash
docker-compose down
```

### Stop and Remove Volumes (Clean Slate)
```bash
docker-compose down -v
```

### Restart a Single Service
```bash
docker-compose restart api
docker-compose restart worker
```

### Rebuild a Single Service
```bash
docker-compose up -d --build api
```

## Troubleshooting

### Port Already in Use

If you get "port already in use" errors:

```bash
# Windows - Stop processes on ports
Get-Process -Id (Get-NetTCPConnection -LocalPort 3001).OwningProcess | Stop-Process
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process

# Or change ports in docker-compose.yml
ports:
  - "3002:3001"  # Use 3002 instead of 3001
```

### Container Won't Start

```bash
# View detailed logs
docker-compose logs [service-name]

# Example
docker-compose logs api
docker-compose logs worker

# Rebuild from scratch
docker-compose down
docker-compose build --no-cache
docker-compose up
```

### Database Issues

```bash
# Reset database
docker-compose down -v
rm -rf database/syncline.db
docker-compose up --build
```

### Check Container Health

```bash
# See health status
docker ps

# Inspect specific container
docker inspect syncline-api
docker inspect syncline-worker
```

## Production Deployment

For production deployment:

### 1. Update Environment Variables

Edit `docker-compose.yml`:

```yaml
environment:
  - NODE_ENV=production
  - JWT_SECRET=CHANGE_THIS_TO_SECURE_VALUE
```

### 2. Use External Database

Replace SQLite with PostgreSQL:

```yaml
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: syncline
      POSTGRES_USER: syncline
      POSTGRES_PASSWORD: secure_password
    volumes:
      - postgres-data:/var/lib/postgresql/data
```

### 3. Add Reverse Proxy (Nginx/Traefik)

Add SSL certificates and domain routing.

### 4. Enable Monitoring

Add logging and monitoring services:
- Prometheus
- Grafana
- ELK Stack

## Development vs Production

### Development (Current Setup)
- Uses local volumes
- Hot reload (if configured)
- Debug logging
- All ports exposed

### Production Recommendations
- Use environment-specific configs
- Enable SSL/TLS
- Use secrets management
- Set up CI/CD pipeline
- Add monitoring and alerts
- Use external database
- Implement backup strategy

## Common Commands Reference

```bash
# Start everything
docker-compose up

# Start in background
docker-compose up -d

# Stop everything
docker-compose down

# View logs
docker-compose logs -f

# Restart a service
docker-compose restart api

# Rebuild and restart
docker-compose up -d --build api

# Remove everything including volumes
docker-compose down -v

# Check status
docker-compose ps

# Execute command in container
docker-compose exec api sh
docker-compose exec worker python -c "print('test')"

# Scale a service (if stateless)
docker-compose up -d --scale worker=3
```

## Architecture Diagram

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │ :3000
       ▼
┌─────────────────┐
│  React Frontend │ (Nginx)
└────────┬────────┘
         │ :3001
         ▼
┌─────────────────┐      ┌──────────────┐
│   Node.js API   │◄─────┤   Database   │
│   + WebSocket   │      │   (SQLite)   │
└────────┬────────┘      └──────────────┘
         │                       ▲
         │                       │
         ▼                       │
┌─────────────────┐      ┌──────┴───────┐
│ Java Notifier   │◄─────┤Python Worker │
│   (Port 8080)   │      │  (Background)│
└─────────────────┘      └──────────────┘
```

## Next Steps

1. **Test the deployment** - Access http://localhost:3000
2. **Check logs** - Ensure all services started successfully
3. **Create a task** - Test the complete workflow
4. **Monitor** - Watch logs across all services

## Support

For issues:
1. Check logs: `docker-compose logs -f`
2. Verify all files are in correct locations
3. Ensure Docker Desktop is running
4. Check port availability

## License

Part of the Syncline project.
