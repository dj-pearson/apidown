# APIdown.net

> Real API status. From real traffic.

Crowd-sourced, neutral, real-time third-party API health monitoring from production traffic.

## Architecture

```
                    ┌─────────────────┐
                    │   Cloudflare    │  CDN + DDoS + SSL
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │     Traefik     │  Reverse Proxy (Coolify)
                    └───┬─────────┬───┘
                        │         │
               ┌────────▼──┐  ┌──▼──────────┐
               │  SvelteKit │  │   Fastify   │
               │  Frontend  │  │   Ingest    │
               │  :3000     │  │   :3001     │
               └────────┬───┘  └──┬──────────┘
                        │         │
                    ┌───▼─────────▼───┐
                    │      Redis      │  Queue
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │    Supabase     │  PostgreSQL + TimescaleDB
                    │    + Realtime   │
                    └─────────────────┘
```

## Project Structure

```
├── database/
│   ├── migrations/        # SQL migration files (001-008)
│   └── seeds/             # Seed data for 30 launch APIs
├── services/
│   ├── ingest/            # Fastify signal ingest API
│   └── worker/            # Aggregation + anomaly detection + alerts
├── packages/
│   └── sdk-js/            # JavaScript SDK (npm: apidown-monitor)
├── frontend/              # SvelteKit dashboard
│   └── src/
│       ├── routes/        # Pages: /, /api/[slug], /incidents, /docs
│       └── lib/           # Supabase client, components
├── docker/                # Dockerfiles for each service
├── docker-compose.yml     # Full stack compose file
└── .env.example           # Required environment variables
```

## Getting Started

### 1. Database Setup

Run migrations in order against your Supabase SQL editor:

```
database/migrations/001_enable_timescaledb.sql
database/migrations/002_create_apis_table.sql
...through...
database/migrations/008_create_rpc_functions.sql
```

Then seed the APIs table:
```
database/seeds/001_seed_apis.sql
```

### 2. Environment Variables

```bash
cp .env.example .env
# Fill in your Supabase and SMTP credentials
```

### 3. Run with Docker Compose

```bash
docker compose up --build
```

- Frontend: http://localhost:3000
- Ingest API: http://localhost:3001
- Health check: http://localhost:3001/health

### 4. Install the SDK

```bash
npm install apidown-monitor
```

```javascript
import apidown from 'apidown-monitor';
apidown.init({ key: 'YOUR_SDK_KEY' });
// All fetch() and axios calls are now automatically monitored
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| Frontend | 3000 | SvelteKit dashboard with real-time updates |
| Ingest | 3001 | Fastify API — receives SDK signals, queues to Redis |
| Worker | — | Drains Redis → Supabase, runs anomaly detection, sends alerts |
| Redis | 6379 | Signal queue + alert queue + rate limiting |

## License

Proprietary — Pearson Media LLC
