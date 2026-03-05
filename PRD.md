**APIdown.net**

Full Product Requirements Document

Includes SDK Implementation Guide | v1.0 | March 2026

**_"Is the API actually down - or is it my code?"_**

Crowd-sourced. Neutral. Real-time. Third-party API health from real production traffic.

| **Prepared By** | **Platform** | **Stack** | **Hosting** |
| --- | --- | --- | --- |
| Pearson Media LLC | APIdown.net | SvelteKit + Supabase + Redis + Fastify | Self-hosted / Coolify / Contabo VPS |

# **Table of Contents**

**1\.** Executive Summary

**2\.** Problem Statement

**3\.** Solution Overview

**4\.** Target API Coverage

**5\.** Product Features

**6\.** Technical Architecture & Stack

**7\.** Database Schema

**8\.** Signal Ingest Pipeline

**9\.** SDK - JavaScript (npm)

**10\.** SDK - Python (pip)

**11\.** SDK Integration Guide for End Users

**12\.** Anomaly Detection & Incident Engine

**13\.** Dashboard - Frontend Specification

**14\.** Alerting System

**15\.** Business Model & Pricing

**16\.** Go-To-Market Strategy

**17\.** Success Metrics

**18\.** MVP Scope & 8-Week Build Timeline

**19\.** Risks & Mitigations

**20\.** Competitive Landscape

**21\.** Appendix

| **1** | **Executive Summary** |
| --- | --- |

APIdown.net is a crowd-sourced, neutral, real-time API health monitoring platform answering the single most frustrating question in software development: Is this third-party API broken - or is it my code?

Every developer, IT team, and SaaS operator has lost hours debugging their own application only to discover Stripe, OpenAI, Twilio, or AWS was degraded. Vendor status pages are self-reported, delayed, and routinely understated. APIdown.net collects passive anonymized signal data from real production traffic via a lightweight SDK and surfaces the truth - neutrally, publicly, and instantly.

**The Billion-Dollar Parallel**

Speedtest.net and Downdetector both sold for ~\$1B each. Both did one thing: answered one clear question with crowd-sourced data. APIdown.net follows the same playbook - one question, one answer, one defensible data moat. The difference: we target developers and IT teams, a higher-value audience with enterprise monetization potential.

This document covers the full product specification including the backend architecture, SDK implementation instructions for both JavaScript and Python, the frontend dashboard spec, alerting system, and business model - tuned for a self-hosted Coolify/Contabo VPS deployment using SvelteKit, Supabase, and Redis.

| **2** | **Problem Statement** |
| --- | --- |

## **2.1 The Developer Debugging Loop**

When a third-party API degrades, the following sequence plays out across thousands of engineering teams simultaneously:

- API calls start failing or slowing in production
- Developer suspects their own code - spends 30-120 minutes in logs and debuggers
- Checks vendor status page - reads "All Systems Operational"
- Posts on Slack, Stack Overflow, or Twitter/X looking for confirmation
- Opens a support ticket with the vendor - waits hours for a response
- Eventually confirms: the vendor had a degraded incident in a specific region
- 2-4 hours of engineering time wasted. Revenue potentially impacted.

**The Status Page Problem**

Vendor status pages are operated by the vendor. They have financial and reputational incentive to underreport, delay disclosure, or minimize severity. There is no neutral third party collecting ground truth from real traffic at scale. APIdown.net is that third party.

## **2.2 Audience Pain by Role**

| **Role** | **Problem** | **Current Workaround** | **Cost** |
| --- | --- | --- | --- |
| Software Developer | Wastes hours debugging own code during vendor outages | Google + Twitter/X + Reddit | 2-4 hrs per incident |
| DevOps / SRE | Paged for incidents caused by third-party degradation | PagerDuty + manual vendor checks | False escalations, burnout |
| IT Administrator | Can't distinguish app failure from vendor failure | Support tickets, phone calls | Hours + vendor SLA disputes |
| Engineering Manager | No single source of truth during incidents | Internal Slack chaos | Team coordination overhead |
| Non-Technical User | App is broken, no explanation or ETA | No recourse - just wait | Lost trust, churn |

| **3** | **Solution Overview** |
| --- | --- |

## **3.1 How APIdown.net Works**

APIdown.net is a three-layer platform:

**Layer 1 - Signal Collection (SDK)**

Developers install a lightweight SDK (npm or pip). The SDK passively intercepts outbound API calls with no code changes beyond a single init() call. For each call it records: target domain, HTTP status code, response duration, approximate region, and timestamp. No payloads, no credentials, no PII ever leave the application.

**Layer 2 - Aggregation & Intelligence**

Incoming signals are queued in Redis, processed by a Fastify ingest service, and written to Supabase with TimescaleDB. A worker aggregates per-API / per-region metrics on 1-minute intervals, runs anomaly detection against 30-day rolling baselines, and fires incident creation when thresholds are breached across multiple independent reporters.

**Layer 3 - Public Dashboard**

A SvelteKit frontend displays real-time API status for all monitored vendors. No login required. Green/yellow/red status, latency sparklines, regional breakdown, incident history, and manual report button. Supabase Realtime pushes live updates to all connected clients instantly.

## **3.2 Data Privacy Principles**

- No request payloads ever captured or transmitted
- No authentication headers, API keys, or credentials
- No user identifiers - signals are anonymized at the SDK level before transmission
- Only: target domain, status code, duration (ms), region hint, timestamp
- SDK users can configure an allowlist or denylist of domains to monitor
- All signal data stored with no reverse-linkability to source application

| **4** | **Target API Coverage** |
| --- | --- |

Launch with the 30 highest-traffic, highest-developer-mindshare APIs. Expand organically based on signal volume from SDK contributors.

| **Category** | **APIs - Phase 1 (Launch)** |
| --- | --- |
| Payments | Stripe, PayPal, Square, Braintree |
| AI / LLM | OpenAI, Anthropic, Google Gemini, Cohere, Replicate, Groq |
| Communications | Twilio, SendGrid, Mailgun, Postmark |
| Cloud - AWS | S3, Lambda, RDS, SES, CloudFront, API Gateway |
| Cloud - GCP / Azure | Cloud Run, Cloud SQL, Azure Functions, Azure Blob |
| Auth & Identity | Auth0, Okta, Firebase Auth, Clerk, Supabase Auth |
| Database / Storage | Supabase, PlanetScale, MongoDB Atlas, Airtable, Upstash |
| Dev Tools & Hosting | GitHub API, Vercel, Netlify, Cloudflare, Railway |
| Commerce & Shipping | Shopify, Stripe Billing, ShipBob, EasyPost |

**Phase 2 Additions (Month 3+)**

HubSpot, Salesforce, Zendesk, Intercom, Plaid, Finix, Algolia, Elastic, Datadog API, Segment, Mixpanel - added based on SDK signal volume from contributor base.

| **5** | **Product Features** |
| --- | --- |

## **5.1 Public Dashboard (Free - No Login)**

- Real-time status grid - all monitored APIs with green/yellow/red indicators
- Per-API detail page: uptime %, P50/P95 latency trend, active incidents, 90-day history
- Regional breakdown: degradation isolated by cloud region (us-east-1, eu-west-1, etc.)
- Incident feed: auto-created with severity, start time, affected regions, resolution time
- Manual report button - crowd-source for developers not using the SDK
- Shareable incident URLs - link directly to an outage for team or customer communication
- Latency sparklines - 24-hour mini chart per API on the grid view

## **5.2 SDK - Signal Collection**

- npm package: apidown-monitor - Node.js, auto-patches fetch, axios, http.request
- PyPI package: apidown - Python, auto-patches requests, httpx, urllib
- One-line init: apidown.init({ key: 'YOUR_KEY' })
- Zero dependencies in the JS SDK - vanilla fetch for beacon transmission
- Configurable allowlist / denylist of domains
- Batched async transmission every 30 seconds - zero synchronous overhead
- Automatic region detection via CloudFlare headers or IP geolocation fallback

## **5.3 Alerting (Free Tier)**

- Subscribe to any API for email alerts - no account required
- Alert triggers: status change (up → degraded → down → up)
- Slack webhook (free: 3 APIs), unlimited on Pro
- Alert digest mode: hourly summary vs. immediate notification (user preference)

## **5.4 Pro Features (Paid)**

- Unlimited Slack, PagerDuty, Microsoft Teams, and Discord webhook alerts
- REST API access - query current and historical status data programmatically
- SLA export reports - CSV/PDF uptime reports per API per time period
- Private monitoring - monitor your own internal services (not just public APIs)
- Team seats with role-based access
- SSO (SAML / Okta)

| **6** | **Technical Architecture & Stack** |
| --- | --- |

**Stack Philosophy**

Self-hosted on Contabo VPS via Coolify. Every component runs as a Docker container. No paid cloud services required beyond Cloudflare free tier. Stack chosen for minimal memory footprint on a shared VPS, maximizing performance per container.

## **6.1 Stack Selection**

| **Layer** | **Technology** | **Why This Choice** |
| --- | --- | --- |
| Frontend | SvelteKit | Compiles to near-vanilla JS. No persistent SSR process. Reactive model ideal for real-time status dashboards. Fraction of Next.js memory footprint. |
| Ingest API | Node.js + Fastify | Fastest Node.js HTTP framework. Handles high-throughput signal bursts. Schema-based validation built in. Runs as a single lightweight container. |
| Database | Self-hosted Supabase (PostgreSQL) | Already running on your VPS. Provides Realtime subscriptions, Row Level Security, and REST API out of the box. |
| Time-Series | TimescaleDB extension | PostgreSQL extension - no separate service. Efficient hypertable queries for latency aggregations and downsampling. |
| Queue | Self-hosted Redis (Coolify) | Lightweight container. Absorbs SDK signal bursts before DB writes. Also used for rate limiting and alert deduplication. |
| CDN / Proxy | Cloudflare (Free) | DDoS protection, SSL termination, global edge caching for status pages. Critical for a service people check during outages. |
| Reverse Proxy | Traefik (via Coolify) | Already your proxy layer. Handles routing to SvelteKit and Fastify containers. |
| Container Orchestration | Coolify | Already your deployment platform. Manages Docker containers, SSL certs, env vars. |

## **6.2 Container Architecture**

Four Docker containers total (three new, one reused):

| ┌─────────────────────────────────────────────────────┐ |
| --- |
| │ Cloudflare (DNS + CDN + DDoS + SSL) │ |
| └──────────────────────┬──────────────────────────────┘ |
| │   |
| ┌──────────────────────▼──────────────────────────────┐ |
| │ Traefik (Coolify reverse proxy) │ |
| │ apidown.net → SvelteKit container │ |
| │ ingest.apidown.net → Fastify container │ |
| └────────┬───────────────────────┬────────────────────┘ |
| │ │ |
| ┌────────▼──────┐ ┌──────────▼──────────┐ |
| │ SvelteKit │ │ Fastify Ingest API │ |
| │ (Frontend) │ │ (Signal Processor) │ |
| │ Port 3000 │ │ Port 3001 │ |
| └────────┬──────┘ └──────────┬───────────┘ |
| │ │ |
| └──────────┬────────────┘ |
| │   |
| ┌──────────▼────────────┐ |
| │ Redis (Queue) │ |
| │ Port 6379 │ |
| └──────────┬────────────┘ |
| │   |
| ┌──────────▼────────────┐ |
| │ Self-hosted Supabase │ |
| │ PostgreSQL + │ |
| │ TimescaleDB + │ |
| │ Realtime │ |
| └───────────────────────┘ |

## **6.3 Environment Variables**

| \# Fastify Ingest Service |
| --- |
| REDIS_URL=redis://redis:6379 |
| SUPABASE_URL=<https://your-supabase.yourdomain.com> |
| SUPABASE_SERVICE_KEY=your-service-role-key |
| INGEST_API_KEY=your-internal-ingest-key |
| PORT=3001 |
|     |
| \# SvelteKit Frontend |
| PUBLIC_SUPABASE_URL=<https://your-supabase.yourdomain.com> |
| PUBLIC_SUPABASE_ANON_KEY=your-anon-key |
| PRIVATE_SUPABASE_SERVICE_KEY=your-service-role-key |
|     |
| \# Worker Service |
| REDIS_URL=redis://redis:6379 |
| SUPABASE_URL=<https://your-supabase.yourdomain.com> |
| SUPABASE_SERVICE_KEY=your-service-role-key |
| ALERT_FROM_EMAIL=<alerts@apidown.net> |
| SMTP_HOST=your-smtp-host |
| SMTP_PORT=587 |
| SMTP_USER=your-smtp-user |
| SMTP_PASS=your-smtp-password |

| **7** | **Database Schema** |
| --- | --- |

All tables live in your existing self-hosted Supabase PostgreSQL instance. TimescaleDB extension must be enabled. Run these migrations in the Supabase SQL editor.

## **7.1 Enable TimescaleDB**

| \-- Run once in Supabase SQL editor |
| --- |
| CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE; |

## **7.2 APIs Table**

| CREATE TABLE apis ( |
| --- |
| id UUID PRIMARY KEY DEFAULT gen_random_uuid(), |
| slug TEXT UNIQUE NOT NULL, -- e.g. 'stripe', 'openai' |
| name TEXT NOT NULL, -- e.g. 'Stripe' |
| category TEXT NOT NULL, -- e.g. 'payments' |
| base_domains TEXT\[\] NOT NULL, -- e.g. ARRAY\['api.stripe.com'\] |
| logo_url TEXT, |
| status_page TEXT, -- vendor's own status page URL |
| current_status TEXT DEFAULT 'operational' -- operational\|degraded\|down |
| CHECK (current_status IN ('operational','degraded','down')), |
| created_at TIMESTAMPTZ DEFAULT now() |
| );  |

## **7.3 Signals Table (Hypertable)**

| CREATE TABLE signals ( |
| --- |
| time TIMESTAMPTZ NOT NULL DEFAULT now(), |
| api_id UUID REFERENCES apis(id), |
| region TEXT NOT NULL DEFAULT 'unknown', |
| status_code INT NOT NULL, |
| duration_ms INT NOT NULL, |
| is_error BOOLEAN GENERATED ALWAYS AS (status_code >= 400) STORED, |
| sdk_version TEXT, |
| reporter_hash TEXT -- SHA256 of SDK key, for dedup - not reversible |
| );  |
|     |
| \-- Convert to TimescaleDB hypertable (partition by time) |
| SELECT create_hypertable('signals', 'time'); |
|     |
| \-- Indexes |
| CREATE INDEX ON signals (api_id, time DESC); |
| CREATE INDEX ON signals (region, time DESC); |
|     |
| \-- Continuous aggregate: 1-minute rollups |
| CREATE MATERIALIZED VIEW signals_1min |
| WITH (timescaledb.continuous) AS |
| SELECT |
| time_bucket('1 minute', time) AS bucket, |
| api_id, |
| region, |
| COUNT(\*) AS total_signals, |
| SUM(is_error::int) AS error_count, |
| ROUND(AVG(duration_ms)) AS avg_duration_ms, |
| PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_ms) AS p50_ms, |
| PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) AS p95_ms |
| FROM signals |
| GROUP BY bucket, api_id, region; |
|     |
| \-- Refresh policy: keep 1-min aggregate fresh |
| SELECT add_continuous_aggregate_policy('signals_1min', |
| start_offset => INTERVAL '10 minutes', |
| end_offset => INTERVAL '1 minute', |
| schedule_interval => INTERVAL '1 minute' |
| );  |
|     |
| \-- Retention: drop raw signals older than 90 days |
| SELECT add_retention_policy('signals', INTERVAL '90 days'); |

## **7.4 Incidents Table**

| CREATE TABLE incidents ( |
| --- |
| id UUID PRIMARY KEY DEFAULT gen_random_uuid(), |
| api_id UUID REFERENCES apis(id), |
| severity TEXT NOT NULL CHECK (severity IN ('minor','major','critical')), |
| status TEXT NOT NULL DEFAULT 'investigating' |
| CHECK (status IN ('investigating','identified','monitoring','resolved')), |
| title TEXT NOT NULL, |
| regions TEXT\[\] DEFAULT '{}', |
| started_at TIMESTAMPTZ DEFAULT now(), |
| resolved_at TIMESTAMPTZ, |
| auto_created BOOLEAN DEFAULT true, |
| created_at TIMESTAMPTZ DEFAULT now() |
| );  |

## **7.5 Manual Reports Table**

| CREATE TABLE manual_reports ( |
| --- |
| id UUID PRIMARY KEY DEFAULT gen_random_uuid(), |
| api_id UUID REFERENCES apis(id), |
| reporter_ip TEXT, -- hashed, for rate limiting only |
| created_at TIMESTAMPTZ DEFAULT now() |
| );  |
|     |
| \-- Rate limit: max 3 reports per IP per API per hour |
| CREATE INDEX ON manual_reports (api_id, reporter_ip, created_at); |

## **7.6 Alert Subscriptions Table**

| CREATE TABLE alert_subscriptions ( |
| --- |
| id UUID PRIMARY KEY DEFAULT gen_random_uuid(), |
| api_id UUID REFERENCES apis(id), |
| channel TEXT NOT NULL CHECK (channel IN ('email','slack','pagerduty','teams','discord')), |
| destination TEXT NOT NULL, -- email address or webhook URL |
| token TEXT UNIQUE DEFAULT gen_random_uuid()::text, -- for unsubscribe |
| verified BOOLEAN DEFAULT false, |
| tier TEXT DEFAULT 'free' CHECK (tier IN ('free','pro','team')), |
| created_at TIMESTAMPTZ DEFAULT now() |
| );  |

| **8** | **Signal Ingest Pipeline** |
| --- | --- |

## **8.1 Flow Overview**

| SDK (browser/node/python) |
| --- |
| │ POST /v1/signals (batch, every 30s) |
| ▼   |
| Fastify Ingest Service |
| │ 1. Validate API key |
| │ 2. Anonymize (strip reporter identity) |
| │ 3. Resolve domain → api_id |
| │ 4. Push to Redis queue: signals:raw |
| ▼   |
| Redis Queue (signals:raw) |
| ▼   |
| Aggregation Worker (runs every 60s) |
| │ 1. Drain Redis queue → batch INSERT to signals table |
| │ 2. TimescaleDB continuous aggregate auto-refreshes signals_1min |
| │ 3. Anomaly detector reads signals_1min |
| │ 4. If threshold breached → incident engine |
| ▼   |
| Incident Engine |
| │ 1. Create/update incident in incidents table |
| │ 2. Update apis.current_status |
| │ 3. Publish to Supabase Realtime channel: api-status |
| │ 4. Push alert jobs to Redis queue: alerts:pending |
| ▼   |
| Alert Worker |
| │ 1. Drain alerts:pending queue |
| │ 2. Deduplicate (same incident, same subscriber) |
| │ 3. Send email / Slack / webhook |
| ▼   |
| SvelteKit Dashboard |
| Subscribes to Supabase Realtime → live UI updates |

## **8.2 Ingest API Endpoint**

| POST <https://ingest.apidown.net/v1/signals> |
| --- |
| Content-Type: application/json |
| X-APIdown-Key: sdk_key_here |
|     |
| Body: |
| {   |
| "signals": \[ |
| {   |
| "domain": "api.stripe.com", |
| "status": 200, |
| "duration": 142, |
| "ts": 1710000000000 |
| },  |
| {   |
| "domain": "api.openai.com", |
| "status": 503, |
| "duration": 5021, |
| "ts": 1710000001000 |
| }   |
| \]  |
| }   |
|     |
| Response 202 Accepted: |
| { "queued": 2 } |

## **8.3 Domain → API ID Resolution**

The ingest service maintains an in-memory map (refreshed every 5 minutes from Supabase) of known API domains to their UUID. Example:

| const DOMAIN_MAP = { |
| --- |
| "api.stripe.com": "uuid-stripe", |
| "js.stripe.com": "uuid-stripe", |
| "api.openai.com": "uuid-openai", |
| "api.anthropic.com": "uuid-anthropic", |
| "api.twilio.com": "uuid-twilio", |
| "api.sendgrid.com": "uuid-sendgrid", |
| "cognito-idp.\*.amazonaws.com": "uuid-aws-cognito", |
| // ... pattern matching for wildcard domains |
| };  |

| **9** | **SDK - JavaScript (npm)** |
| --- | --- |

**Package Name**

npm package: apidown-monitor GitHub: github.com/yourusername/apidown-monitor-js Zero production dependencies. Works in Node.js 16+ and modern browsers.

## **9.1 Installation**

| npm install apidown-monitor |
| --- |
| \# or |
| yarn add apidown-monitor |
| \# or |
| pnpm add apidown-monitor |

## **9.2 Initialization**

| // CommonJS |
| --- |
| const apidown = require('apidown-monitor'); |
|     |
| // ESM |
| import apidown from 'apidown-monitor'; |
|     |
| // Initialize once at app startup (before any API calls) |
| apidown.init({ |
| key: 'YOUR_SDK_KEY', // Required: get from apidown.net/dashboard |
| endpoint: '<https://ingest.apidown.net/v1/signals>', // Optional: default shown |
| flushInterval: 30000, // Optional: ms between batched sends (default: 30000) |
| maxBatchSize: 100, // Optional: max signals per batch (default: 100) |
| allowlist: \[ // Optional: only monitor these domains |
| 'api.stripe.com', |
| 'api.openai.com' |
| \], |
| denylist: \[ // Optional: never monitor these domains |
| 'my-internal-api.com' |
| \], |
| debug: false // Optional: log to console (default: false) |
| }); |

## **9.3 Full SDK Source - index.js**

| /\*\* |
| --- |
| \* apidown-monitor |
| \* Lightweight passive API health signal collector |
| \* Zero dependencies \| Node.js 16+ \| Browser compatible |
| \*/ |
|     |
| 'use strict'; |
|     |
| const DEFAULT_ENDPOINT = '<https://ingest.apidown.net/v1/signals>'; |
| const DEFAULT_FLUSH_INTERVAL = 30000; |
| const DEFAULT_MAX_BATCH = 100; |
|     |
| let \_config = null; |
| let \_queue = \[\]; |
| let \_flushTimer = null; |
| let \_originalFetch = null; |
| let \_originalRequest = null; |
|     |
| function shouldMonitor(url) { |
| let hostname; |
| try { hostname = new URL(url).hostname; } catch { return false; } |
| // Never self-monitor |
| if (hostname === new URL(\_config.endpoint).hostname) return false; |
| if (\_config.allowlist && \_config.allowlist.length > 0) { |
| return \_config.allowlist.some(d => hostname.endsWith(d)); |
| }   |
| if (\_config.denylist && \_config.denylist.length > 0) { |
| if (\_config.denylist.some(d => hostname.endsWith(d))) return false; |
| }   |
| return true; |
| }   |
|     |
| function record(domain, status, duration) { |
| if (!\_config) return; |
| \_queue.push({ domain, status, duration, ts: Date.now() }); |
| if (\_queue.length >= \_config.maxBatchSize) flush(); |
| }   |
|     |
| async function flush() { |
| if (!\_config \| \_queue.length === 0) return; |
| const batch = \_queue.splice(0, \_config.maxBatchSize); |
| if (\_config.debug) console.log('\[apidown\] flushing', batch.length, 'signals'); |
| try { |
| await fetch(\_config.endpoint, { |
| method: 'POST', |
| headers: { |
| 'Content-Type': 'application/json', |
| 'X-APIdown-Key': \_config.key |
| },  |
| body: JSON.stringify({ signals: batch }), |
| // Use keepalive for page unload scenarios |
| keepalive: true |
| }); |
| } catch (e) { |
| if (\_config.debug) console.warn('\[apidown\] flush failed:', e.message); |
| // Silently discard - never block application flow |
| }   |
| }   |
|     |
| function patchFetch() { |
| if (typeof fetch === 'undefined') return; |
| \_originalFetch = fetch; |
| const monitoredFetch = async function(input, init) { |
| const url = typeof input === 'string' ? input : input?.url \| ''; |
| let hostname; |
| try { hostname = new URL(url).hostname; } catch { return \_originalFetch(input, init); } |
| if (!shouldMonitor(url)) return \_originalFetch(input, init); |
| const start = Date.now(); |
| try { |
| const res = await \_originalFetch(input, init); |
| record(hostname, res.status, Date.now() - start); |
| return res; |
| } catch (e) { |
| record(hostname, 0, Date.now() - start); // 0 = network error |
| throw e; |
| }   |
| };  |
| // Preserve fetch.bind and other properties |
| Object.assign(monitoredFetch, fetch); |
| globalThis.fetch = monitoredFetch; |
| }   |
|     |
| function patchAxios() { |
| // Axios interceptor - only runs if axios is present |
| try { |
| const axios = require('axios'); |
| axios.interceptors.request.use(config => { |
| config.\_apidown_start = Date.now(); |
| return config; |
| }); |
| axios.interceptors.response.use( |
| response => { |
| const url = response.config?.url \| ''; |
| let hostname; |
| try { hostname = new URL(url, response.config?.baseURL).hostname; } catch { return response; } |
| if (shouldMonitor(url)) { |
| record(hostname, response.status, Date.now() - (response.config.\_apidown_start \| Date.now())); |
| }   |
| return response; |
| },  |
| error => { |
| const url = error.config?.url \| ''; |
| let hostname; |
| try { hostname = new URL(url, error.config?.baseURL).hostname; } catch { return Promise.reject(error); } |
| if (shouldMonitor(url)) { |
| record(hostname, error.response?.status \| 0, Date.now() - (error.config?.\_apidown_start \| Date.now())); |
| }   |
| return Promise.reject(error); |
| }   |
| );  |
| } catch { /\* axios not installed - skip \*/ } |
| }   |
|     |
| const apidown = { |
| init(config = {}) { |
| if (!config.key) throw new Error('\[apidown\] key is required'); |
| \_config = { |
| key: config.key, |
| endpoint: config.endpoint \| DEFAULT_ENDPOINT, |
| flushInterval: config.flushInterval \| DEFAULT_FLUSH_INTERVAL, |
| maxBatchSize: config.maxBatchSize \| DEFAULT_MAX_BATCH, |
| allowlist: config.allowlist \| \[\], |
| denylist: config.denylist \| \[\], |
| debug: config.debug \| false |
| };  |
| patchFetch(); |
| patchAxios(); |
| \_flushTimer = setInterval(flush, \_config.flushInterval); |
| // Flush on process exit (Node.js) |
| if (typeof process !== 'undefined') { |
| process.on('exit', flush); |
| process.on('SIGINT', () => { flush(); process.exit(0); }); |
| }   |
| if (\_config.debug) console.log('\[apidown\] initialized'); |
| },  |
|     |
| shutdown() { |
| if (\_flushTimer) clearInterval(\_flushTimer); |
| flush(); |
| if (\_originalFetch) globalThis.fetch = \_originalFetch; |
| \_config = null; |
| \_queue = \[\]; |
| },  |
|     |
| // Manual signal - for frameworks with custom HTTP clients |
| record(domain, statusCode, durationMs) { |
| if (!\_config) return; |
| if (shouldMonitor('https://' + domain)) { |
| record(domain, statusCode, durationMs); |
| }   |
| }   |
| };  |
|     |
| module.exports = apidown; |
| module.exports.default = apidown; |

## **9.4 package.json**

| {   |
| --- |
| "name": "apidown-monitor", |
| "version": "1.0.0", |
| "description": "Passive API health signal collector for APIdown.net", |
| "main": "index.js", |
| "module": "index.mjs", |
| "exports": { |
| ".": { |
| "require": "./index.js", |
| "import": "./index.mjs" |
| }   |
| },  |
| "files": \["index.js", "index.mjs", "index.d.ts"\], |
| "keywords": \["api", "monitoring", "health", "uptime", "status"\], |
| "license": "MIT", |
| "dependencies": {} |
| }   |

## **9.5 TypeScript Definitions - index.d.ts**

| export interface APIdownConfig { |
| --- |
| key: string; |
| endpoint?: string; |
| flushInterval?: number; |
| maxBatchSize?: number; |
| allowlist?: string\[\]; |
| denylist?: string\[\]; |
| debug?: boolean; |
| }   |
|     |
| export interface APIdown { |
| init(config: APIdownConfig): void; |
| shutdown(): void; |
| record(domain: string, statusCode: number, durationMs: number): void; |
| }   |
|     |
| declare const apidown: APIdown; |
| export default apidown; |

| **10** | **SDK - Python (pip)** |
| --- | --- |

**Package Name**

pip package: apidown GitHub: github.com/yourusername/apidown-monitor-py Pure Python. No dependencies beyond stdlib. Works with Python 3.8+.

## **10.1 Installation**

| pip install apidown |
| --- |
| \# or |
| poetry add apidown |
| \# or |
| uv add apidown |

## **10.2 Initialization**

| import apidown |
| --- |
|     |
| \# Initialize once at app startup |
| apidown.init( |
| key='YOUR_SDK_KEY', |
| endpoint='<https://ingest.apidown.net/v1/signals>', # optional |
| flush_interval=30, # seconds between batched sends (default: 30) |
| max_batch_size=100, # max signals per batch (default: 100) |
| allowlist=\[ # optional: only monitor these domains |
| 'api.stripe.com', |
| 'api.openai.com', |
| \], |
| denylist=\[ # optional: never monitor these |
| 'my-internal-api.com', |
| \], |
| debug=False # optional: print debug logs |
| )   |

## **10.3 Full SDK Source - apidown/\__init_\_.py**

| """ |
| --- |
| apidown - Passive API health signal collector for APIdown.net |
| Pure Python \| No dependencies \| Python 3.8+ |
| """ |
|     |
| import threading |
| import time |
| import json |
| import urllib.request |
| import urllib.error |
| import hashlib |
| import atexit |
| from urllib.parse import urlparse |
| from typing import Optional, List |
|     |
| \_config: Optional\[dict\] = None |
| \_queue: list = \[\] |
| \_queue_lock = threading.Lock() |
| \_flush_timer: Optional\[threading.Timer\] = None |
|     |
|     |
| def \_should_monitor(url: str) -> bool: |
| try: |
| hostname = urlparse(url).hostname or '' |
| except Exception: |
| return False |
| ingest_host = urlparse(\_config\['endpoint'\]).hostname |
| if hostname == ingest_host: |
| return False |
| if \_config\['allowlist'\]: |
| return any(hostname.endswith(d) for d in \_config\['allowlist'\]) |
| if \_config\['denylist'\]: |
| if any(hostname.endswith(d) for d in \_config\['denylist'\]): |
| return False |
| return True |
|     |
|     |
| def \_record(domain: str, status: int, duration_ms: int): |
| if not \_config: |
| return |
| with \_queue_lock: |
| \_queue.append({'domain': domain, 'status': status, |
| 'duration': duration_ms, 'ts': int(time.time() \* 1000)}) |
| if len(\_queue) >= \_config\['max_batch_size'\]: |
| \_flush() |
|     |
|     |
| def \_flush(): |
| global \_queue |
| if not \_config or not \_queue: |
| return |
| with \_queue_lock: |
| batch = \_queue\[:\_config\['max_batch_size'\]\] |
| \_queue = \_queue\[\_config\['max_batch_size'\]:\] |
| if not batch: |
| return |
| if \_config\['debug'\]: |
| print(f'\[apidown\] flushing {len(batch)} signals') |
| try: |
| data = json.dumps({'signals': batch}).encode('utf-8') |
| req = urllib.request.Request( |
| \_config\['endpoint'\], |
| data=data, |
| headers={ |
| 'Content-Type': 'application/json', |
| 'X-APIdown-Key': \_config\['key'\] |
| },  |
| method='POST' |
| )   |
| urllib.request.urlopen(req, timeout=5) |
| except Exception as e: |
| if \_config and \_config\['debug'\]: |
| print(f'\[apidown\] flush failed: {e}') |
| \# Silently discard - never raise |
|     |
|     |
| def \_schedule_flush(): |
| global \_flush_timer |
| if not \_config: |
| return |
| \_flush() |
| \_flush_timer = threading.Timer(\_config\['flush_interval'\], \_schedule_flush) |
| \_flush_timer.daemon = True |
| \_flush_timer.start() |
|     |
|     |
| def \_patch_requests(): |
| try: |
| import requests |
| from requests import Session |
| original_send = Session.send |
|     |
| def patched_send(self, request, \*\*kwargs): |
| if not \_config or not \_should_monitor(request.url): |
| return original_send(self, request, \*\*kwargs) |
| hostname = urlparse(request.url).hostname |
| start = time.time() |
| try: |
| resp = original_send(self, request, \*\*kwargs) |
| \_record(hostname, resp.status_code, |
| int((time.time() - start) \* 1000)) |
| return resp |
| except Exception as e: |
| \_record(hostname, 0, int((time.time() - start) \* 1000)) |
| raise |
|     |
| Session.send = patched_send |
| except ImportError: |
| pass # requests not installed |
|     |
|     |
| def \_patch_httpx(): |
| try: |
| import httpx |
| original_send = httpx.Client.send |
|     |
| def patched_send(self, request, \*\*kwargs): |
| if not \_config or not \_should_monitor(str(request.url)): |
| return original_send(self, request, \*\*kwargs) |
| hostname = request.url.host |
| start = time.time() |
| try: |
| resp = original_send(self, request, \*\*kwargs) |
| \_record(hostname, resp.status_code, |
| int((time.time() - start) \* 1000)) |
| return resp |
| except Exception as e: |
| \_record(hostname, 0, int((time.time() - start) \* 1000)) |
| raise |
|     |
| httpx.Client.send = patched_send |
| except ImportError: |
| pass # httpx not installed |
|     |
|     |
| def init( |
| key: str, |
| endpoint: str = '<https://ingest.apidown.net/v1/signals>', |
| flush_interval: int = 30, |
| max_batch_size: int = 100, |
| allowlist: Optional\[List\[str\]\] = None, |
| denylist: Optional\[List\[str\]\] = None, |
| debug: bool = False |
| ):  |
| global \_config |
| if not key: |
| raise ValueError('\[apidown\] key is required') |
| \_config = { |
| 'key': key, |
| 'endpoint': endpoint, |
| 'flush_interval': flush_interval, |
| 'max_batch_size': max_batch_size, |
| 'allowlist': allowlist or \[\], |
| 'denylist': denylist or \[\], |
| 'debug': debug |
| }   |
| \_patch_requests() |
| \_patch_httpx() |
| \_schedule_flush() |
| atexit.register(\_flush) # flush on clean shutdown |
| if debug: |
| print('\[apidown\] initialized') |
|     |
|     |
| def shutdown(): |
| global \_config, \_flush_timer |
| if \_flush_timer: |
| \_flush_timer.cancel() |
| \_flush() |
| \_config = None |
|     |
|     |
| def record(domain: str, status_code: int, duration_ms: int): |
| """Manual signal - for custom HTTP clients not auto-patched.""" |
| if not \_config: |
| return |
| if \_should_monitor('https://' + domain): |
| \_record(domain, status_code, duration_ms) |

| **11** | **SDK Integration Guide for End Users** |
| --- | --- |

This section is the public-facing documentation published at apidown.net/docs. It is written for the developers integrating the SDK into their own applications.

## **11.1 Node.js / Express**

| // server.js or app.js - add BEFORE any other imports |
| --- |
| const apidown = require('apidown-monitor'); |
| apidown.init({ key: process.env.APIDOWN_KEY }); |
|     |
| // Your normal app code below... |
| const express = require('express'); |
| const axios = require('axios'); |
| const app = express(); |
|     |
| // All axios and fetch calls are now automatically monitored |
| app.get('/charge', async (req, res) => { |
| const result = await axios.post('<https://api.stripe.com/v1/charges>', ...); |
| res.json(result.data); |
| }); |

## **11.2 Next.js**

| // pages/\_app.js or app/layout.js |
| --- |
| // Use a server-side singleton to avoid re-init on hot reload |
|     |
| // lib/apidown.js |
| import apidown from 'apidown-monitor'; |
|     |
| if (typeof window === 'undefined') { // Server-side only |
| if (!global.\_apidownInit) { |
| apidown.init({ key: process.env.APIDOWN_KEY }); |
| global.\_apidownInit = true; |
| }   |
| }   |

## **11.3 SvelteKit**

| // src/hooks.server.js |
| --- |
| import apidown from 'apidown-monitor'; |
|     |
| // Runs once on server startup |
| apidown.init({ key: import.meta.env.APIDOWN_KEY }); |
|     |
| export const handle = async ({ event, resolve }) => { |
| return resolve(event); |
| };  |

## **11.4 Python / Django**

| \# manage.py or wsgi.py - add at the very top |
| --- |
| import apidown |
| apidown.init(key=os.environ\['APIDOWN_KEY'\]) |
|     |
| \# All requests library calls are now automatically monitored |
| import requests |
|     |
| def charge_customer(amount): |
| resp = requests.post('<https://api.stripe.com/v1/charges>', ...) |
| \# ↑ duration and status automatically reported to apidown.net |
| return resp.json() |

## **11.5 Python / FastAPI**

| \# main.py |
| --- |
| import apidown |
| import os |
|     |
| apidown.init(key=os.environ\['APIDOWN_KEY'\]) |
|     |
| from fastapi import FastAPI |
| import httpx |
|     |
| app = FastAPI() |
|     |
| @app.on_event('startup') |
| async def startup_event(): |
| pass # apidown already initialized above |
|     |
| @app.get('/send-email') |
| async def send_email(): |
| \# httpx.Client is auto-patched |
| with httpx.Client() as client: |
| resp = client.post('<https://api.sendgrid.com/v3/mail/send>', ...) |
| return {'status': resp.status_code} |

## **11.6 Manual Signal Recording (Custom HTTP Clients)**

| // JavaScript - for undici, got, node-fetch v2, or other clients |
| --- |
| const apidown = require('apidown-monitor'); |
| apidown.init({ key: process.env.APIDOWN_KEY }); |
|     |
| const start = Date.now(); |
| try { |
| const res = await myCustomClient.get('<https://api.stripe.com/v1/charges>'); |
| apidown.record('api.stripe.com', res.statusCode, Date.now() - start); |
| } catch (e) { |
| apidown.record('api.stripe.com', 0, Date.now() - start); |
| throw e; |
| }   |
|     |
| \# Python - for aiohttp or custom urllib usage |
| import apidown, time |
| start = time.time() |
| try: |
| resp = await session.get('<https://api.stripe.com/v1/charges>') |
| apidown.record('api.stripe.com', resp.status, int((time.time()-start)\*1000)) |
| except Exception: |
| apidown.record('api.stripe.com', 0, int((time.time()-start)\*1000)) |
| raise |

**Privacy Reminder for Docs**

APIdown.net never captures request payloads, headers, authentication tokens, or any user data. Only domain, HTTP status code, response duration (ms), and timestamp are transmitted. All data is anonymized at the SDK level before transmission. You can verify this by reading the open-source SDK code.

| **12** | **Anomaly Detection & Incident Engine** |
| --- | --- |

## **12.1 Detection Algorithm**

The worker runs every 60 seconds and evaluates the last 5-minute window against a 30-day rolling baseline per API per region. Two metrics are evaluated independently:

- Error Rate: (errors / total_signals) in the last 5 minutes vs. baseline
- P95 Latency: percentile 95 duration in the last 5 minutes vs. baseline

## **12.2 Threshold Definitions**

| **Severity** | **Error Rate** | **P95 Latency** | **Min Reporters** |
| --- | --- | --- | --- |
| Minor / Degraded | \> 5% above baseline | \> 2x baseline P95 | 5+ independent SDKs |
| Major | \> 20% error rate OR > 5x baseline P95 | Either threshold | 10+ independent SDKs |
| Critical / Down | \> 50% error rate | Any | 5+ independent SDKs |

## **12.3 Worker Pseudocode**

| // runs every 60 seconds |
| --- |
| async function runAnomalyDetection() { |
| const apis = await supabase.from('apis').select('\*'); |
|     |
| for (const api of apis) { |
| const window = await supabase.rpc('get_api_window', { |
| p_api_id: api.id, |
| p_minutes: 5 |
| }); |
|     |
| const baseline = await supabase.rpc('get_api_baseline', { |
| p_api_id: api.id, |
| p_days: 30 |
| }); |
|     |
| if (window.total_signals < 5) continue; // Not enough data |
|     |
| const errorRate = window.error_count / window.total_signals; |
| const latencyRatio = window.p95_ms / (baseline.p95_ms \| 200); |
| const uniqueReporters = window.unique_reporters; |
|     |
| const severity = getSeverity(errorRate, latencyRatio, uniqueReporters); |
|     |
| if (severity && api.current_status === 'operational') { |
| await createIncident(api, severity, window); |
| } else if (!severity && api.current_status !== 'operational') { |
| await resolveIncident(api); |
| }   |
| }   |
| }   |
|     |
| function getSeverity(errorRate, latencyRatio, reporters) { |
| if (reporters < 5) return null; |
| if (errorRate > 0.50) return 'critical'; |
| if (errorRate > 0.20 \| latencyRatio > 5) return 'major'; |
| if (errorRate > 0.05 \| latencyRatio > 2) return 'minor'; |
| return null; |
| }   |

| **13** | **Dashboard - Frontend Specification** |
| --- | --- |

Built with SvelteKit. Deployed as a Docker container via Coolify. Uses Supabase Realtime for live updates - no polling.

## **13.1 Pages & Routes**

| **Route** | **Page** | **Description** |
| --- | --- | --- |
| /   | Status Grid | Real-time grid of all monitored APIs with status indicators and latency sparklines |
| /api/\[slug\] | API Detail | Full detail: uptime %, P50/P95 chart (24h/7d/30d), regional breakdown, incident history |
| /incidents | Incident Feed | All active and recent incidents across all APIs, sorted by recency |
| /incidents/\[id\] | Incident Detail | Single incident: timeline, affected regions, status updates, shareable URL |
| /docs | SDK Docs | Integration guide for JavaScript and Python SDKs |
| /dashboard | Account Dashboard | Pro users: manage subscriptions, API keys, alert config |
| /api-status | JSON Status API | Public JSON endpoint: GET /api-status returns current status for all APIs |

## **13.2 Status Grid - Component Spec**

- Group APIs by category (Payments, AI/LLM, Communications, etc.)
- Each card: API logo, name, status badge (Operational/Degraded/Down), 24h uptime %, latency sparkline
- Status badge uses Supabase Realtime subscription - updates without page refresh
- Click any card → navigates to /api/\[slug\]
- Top bar: total APIs monitored, active incidents count, last updated timestamp
- Search/filter bar to find specific APIs

## **13.3 Realtime Subscription (SvelteKit)**

| // src/routes/+page.svelte |
| --- |
| &lt;script&gt; |
| import { onMount, onDestroy } from 'svelte'; |
| import { supabase } from '\$lib/supabase'; |
|     |
| export let data; // server-loaded initial API statuses |
| let apis = data.apis; |
| let channel; |
|     |
| onMount(() => { |
| channel = supabase |
| .channel('api-status-changes') |
| .on('postgres_changes', { |
| event: 'UPDATE', |
| schema: 'public', |
| table: 'apis' |
| }, (payload) => { |
| apis = apis.map(a => |
| a.id === payload.new.id ? { ...a, ...payload.new } : a |
| );  |
| })  |
| .subscribe(); |
| }); |
|     |
| onDestroy(() => { |
| supabase.removeChannel(channel); |
| }); |
| &lt;/script&gt; |

| **14** | **Alerting System** |
| --- | --- |

## **14.1 Alert Flow**

- Incident engine writes new incident → publishes to Redis queue: alerts:pending
- Alert worker drains queue, deduplicates by (incident_id, subscriber_id)
- Sends email via SMTP / Slack via webhook / PagerDuty via Events API v2
- Marks alert as sent in alert_log table to prevent duplicate sends
- On incident resolution: sends all-clear notification to same subscribers

## **14.2 Email Alert Templates**

Two template types: Incident Opened and Incident Resolved. Plain-text + HTML multipart.

| Subject: \[APIdown\] Stripe - Degraded Performance Detected |
| --- |
|     |
| Stripe is showing degraded performance as of 2:47 PM UTC. |
|     |
| Severity: Minor |
| Affected Regions: us-east-1 |
| Error Rate: 8.3% (baseline: 0.4%) |
| P95 Latency: 1,240ms (baseline: 180ms) |
|     |
| View live status: <https://apidown.net/api/stripe> |
| View incident: <https://apidown.net/incidents/abc-123> |
|     |
| You are subscribed to alerts for Stripe. |
| Unsubscribe: <https://apidown.net/unsubscribe?token=TOKEN> |

## **14.3 Slack Webhook Payload**

| {   |
| --- |
| "text": ":red_circle: \*Stripe\* - Degraded Performance", |
| "blocks": \[ |
| {   |
| "type": "section", |
| "text": { |
| "type": "mrkdwn", |
| "text": "\*Stripe\* is showing degraded performance.\\nSeverity: Minor \| Region: us-east-1\\nError Rate: 8.3% \| P95: 1,240ms" |
| }   |
| },  |
| {   |
| "type": "actions", |
| "elements": \[ |
| {   |
| "type": "button", |
| "text": { "type": "plain_text", "text": "View Status" }, |
| "url": "<https://apidown.net/api/stripe>" |
| }   |
| \]  |
| }   |
| \]  |
| }   |

| **15** | **Business Model & Pricing** |
| --- | --- |

## **15.1 Pricing Tiers**

| **Tier** | **Price** | **Target** | **Key Features** |
| --- | --- | --- | --- |
| Free | \$0/mo | Individual devs, public users | Dashboard, email alerts, 3 Slack hooks, SDK (unlimited signals) |
| Pro | \$29/mo | Startups, indie hackers, SaaS founders | Unlimited alerts all channels, REST API access, SLA reports, 5 private monitors |
| Team | \$99/mo | Engineering teams 2-20 people | 5 seats, SSO, unlimited private monitors, PagerDuty, audit log |
| Enterprise | Custom | Large orgs, API vendors | Dedicated support, white-label, SLA guarantee, custom retention, audit, invoicing |

## **15.2 Secondary Revenue Streams**

- Vendor Verified Badges - API vendors pay \$499/mo to appear as Verified with enriched status detail and custom incident communication
- Status Data API - enterprise teams pay for programmatic access to historical latency and uptime data
- Embedded Status Widget - white-label widget vendors can embed on their own status pages, powered by APIdown data

**Revenue Projection (Conservative)**

Month 6: 50 Pro (\$1,450 MRR) + 5 Team (\$495 MRR) = ~\$2K MRR Month 12: 200 Pro (\$5,800) + 25 Team (\$2,475) + 3 Enterprise (\$3,000) = ~\$11K MRR Month 24: Scale to \$50K+ MRR with enterprise motion and vendor badge program.

| **16** | **Go-To-Market Strategy** |
| --- | --- |

## **16.1 Launch Sequence**

| **Phase** | **Timeline** | **Focus** | **Goal** |
| --- | --- | --- | --- |
| 0 - Build | Weeks 1-8 | MVP: dashboard + JS SDK + 30 APIs + ingest pipeline | Soft launch ready |
| 1 - Seed | Weeks 9-12 | ProductHunt, HackerNews Show HN, Dev.to post | 1,000 SDK installs, 500 DAU |
| 2 - SEO | Months 3-6 | '\[API\] down' keyword capture, Twitter/X incident monitoring | Organic traffic spike during real outages |
| 3 - Monetize | Month 6+ | Email Pro tier to free users, vendor badge outreach | \$5K MRR |
| 4 - Scale | Month 12+ | Enterprise sales, API marketplace listings, Python SDK | \$25K+ MRR |

## **16.2 SEO Strategy - The Outage Traffic Flywheel**

The single highest-value SEO opportunity: during every real outage, thousands of developers Google '\[vendor name\] down' or '\[vendor name\] outage'. APIdown.net needs to rank for these queries.

- Create a static page for every monitored API: apidown.net/api/stripe, apidown.net/api/openai
- Each page auto-generates an SEO title: 'Stripe Status - Is Stripe Down Right Now?'
- During an active incident the page updates in real-time - Google indexes fresh content
- Target long-tail: 'stripe webhooks slow', 'openai api 503', 'twilio sms not sending'
- Build 90-day incident history - evergreen content that ranks for past outage searches

| **17** | **Success Metrics** |
| --- | --- |

| **Metric** | **Week 8 (Launch)** | **Month 3** | **Month 12** |
| --- | --- | --- | --- |
| SDK Installs (npm) | 0   | 1,000 | 50,000 |
| Daily Signals Processed | 0   | 500K | 20M+ |
| Daily Active Dashboard Users | 50  | 1,000 | 30,000 |
| APIs Monitored | 30  | 75  | 250+ |
| Free Accounts | 0   | 300 | 5,000 |
| Paying Customers | 0   | 15  | 350 |
| MRR | \$0 | \$500 | \$12,000+ |
| Avg Incident Detection Time | N/A | < 5 min | < 2 min |

| **18** | **MVP Scope & 8-Week Build Timeline** |
| --- | --- |

## **18.1 In Scope - v1.0**

- Public status dashboard (SvelteKit) - 30 APIs, real-time updates
- Per-API detail pages with latency charts and incident history
- Manual report button with IP-based rate limiting
- JavaScript SDK (npm: apidown-monitor) - fetch + axios interception
- Signal ingest API (Fastify) - validation, anonymization, Redis queue
- Aggregation worker - TimescaleDB rollups, anomaly detection, incident engine
- Email subscription alerts - no account required
- Supabase Realtime - live dashboard updates

## **18.2 Out of Scope - v1.0**

- Python SDK - v1.1
- Paid billing (Stripe) - v1.1
- PagerDuty / Teams / Discord integrations - v1.1
- Private internal API monitoring - v1.2
- SLA export reports - Pro tier
- SSO / SAML - Team tier
- Mobile app - not planned

## **18.3 8-Week Build Plan**

| **Week** | **Deliverable** | **Owner Layer** |
| --- | --- | --- |
| 1   | Supabase schema, TimescaleDB extension, seed APIs table with 30 APIs | Database |
| 2   | Fastify ingest service: validation, anonymization, Redis queue write | Backend |
| 3   | JavaScript SDK: fetch/axios patch, batching, flush, init() API | SDK |
| 4   | Aggregation worker: TimescaleDB rollups, rolling baseline calculation | Backend |
| 5   | Anomaly detection engine: Z-score evaluation, incident create/resolve/update | Backend |
| 6   | SvelteKit dashboard: status grid, Realtime subscription, per-API pages | Frontend |
| 7   | Email alert system: subscription flow, SMTP templates, unsubscribe tokens | Backend |
| 8   | QA, load testing ingest endpoint, Coolify deployment, Cloudflare DNS, soft launch | DevOps |

| **19** | **Risks & Mitigations** |
| --- | --- |

| **Risk** | **Likelihood** | **Impact** | **Mitigation** |
| --- | --- | --- | --- |
| Cold start - no signal data at launch | High | High | Bootstrap with manual reports and public API RSS/atom status feeds. Show 'Seeding data' state transparently. |
| VPS resource pressure from signal bursts | Medium | High | Redis queue absorbs bursts. Ingest service is stateless and can be rate-limited. TimescaleDB hypertable handles insert throughput efficiently. |
| SDK adoption friction | Medium | High | One-line init, zero dependencies, open source, prominent README with copy-paste examples for top frameworks. |
| False positives damage credibility | Medium | Critical | Require 5+ independent reporters before auto-incident. Manual review mode for top-tier APIs. Show reporter count on incident page. |
| Vendor legal pressure | Low | Medium | Monitor only public API endpoints. No scraping of vendor dashboards. Neutral framing - report facts, not blame. |
| Competitor replication | Medium | Low | Data moat takes 12+ months to replicate. First-mover SEO advantage on outage keywords is hard to displace once established. |

| **20** | **Competitive Landscape** |
| --- | --- |

| **Product** | **What They Do** | **Gap APIdown.net Fills** |
| --- | --- | --- |
| Vendor Status Pages (Stripe, etc.) | Self-reported uptime | Not neutral. Delayed. Incentive to underreport. APIdown is third-party ground truth. |
| Downdetector | Consumer app/service outage crowd-reports | No API focus. No latency data. No developer SDK. No regional breakdown. |
| IsItDownRightNow | Synthetic HTTP pings from fixed locations | Synthetic ≠ real traffic. Not crowd-sourced. No developer SDK or data moat. |
| Better Uptime / UptimeRobot | Synthetic monitoring for YOUR services | Monitors apps you own, not third-party APIs. Not public or neutral. |
| Datadog / New Relic | Full APM platform for your own infrastructure | Enterprise, expensive, complex. Not public. Not neutral. Not focused on third-party APIs. |
| StatusPage.io (Atlassian) | Vendor-hosted status pages | Operated by the vendor - same problem as vendor status pages. |

**The Defensible Position**

APIdown.net is the only product combining: (1) passive real-traffic SDK signal collection, (2) crowd-sourced neutrality with no vendor affiliation, and (3) a free public dashboard optimized for developer SEO traffic during live outages. This combination creates a flywheel no competitor can replicate without the contributor base.

| **21** | **Appendix** |
| --- | --- |

## **Comparable Exits**

- Speedtest.net (Ookla) - acquired by Ziff Davis ~\$1B (2020). Single function: measure internet speed. Crowd-sourced data moat.
- Downdetector (Ookla) - acquired ~\$500M (2019). Single function: is this app down? Consumer crowd-reports.
- Both: free consumer product, one question, data flywheel, monetized via enterprise/B2B.

## **Coolify Deployment Notes**

- Deploy SvelteKit as a Docker container using the official Svelte adapter-node
- Deploy Fastify ingest service as a separate Docker container on ingest.apidown.net subdomain
- Deploy Redis as a Coolify-managed service (official Redis Docker image)
- Enable TimescaleDB on existing Supabase instance via SQL editor
- Cloudflare: proxy both apidown.net and ingest.apidown.net - enable caching for status pages, bypass cache for /v1/signals
- Set Cloudflare cache TTL to 60 seconds for status grid page - reduces server load significantly

## **Domain & Brand**

- Domain: APIdown.net
- Tagline: "Real API status. From real traffic."
- Secondary: "Not your code. Not this time."
- Color: Blue (#1A56A0) primary - trust, reliability, technical
- Font: Inter or Geist - clean developer aesthetic

_- End of Document - APIdown.net PRD v1.0 - Pearson Media LLC -_