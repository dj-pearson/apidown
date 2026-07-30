# apidown

Check whether a third-party API is actually down — or whether it's your code — from your terminal.

```bash
npx apidown stripe
```

```
  Stripe  OPERATIONAL

  p50 / p95 (24h)  118ms / 305ms
  error rate (24h)  0.04%
  uptime (24h)     100%
  uptime (30d)     99.982%   1 incidents

  https://apidown.net/api/stripe
```

No install, no account, no API key. Data comes from [APIdown.net](https://apidown.net), which
measures API health from real client-side production traffic rather than vendor status pages.

## Install

Nothing to install — use `npx`:

```bash
npx apidown openai
```

Or install it globally if you reach for it often:

```bash
npm install -g apidown
apidown openai
```

Requires Node 18 or newer (it uses the built-in `fetch`).

## Commands

| Command | What it does |
| --- | --- |
| `apidown <slug>` | Status, 24h latency and error rate, 30-day uptime, and any open incident |
| `apidown list` | Every tracked API with its current status |
| `apidown list --down` | Only APIs currently down or degraded |
| `apidown incidents [slug]` | Recent incidents, newest first |

## Options

| Flag | Effect |
| --- | --- |
| `--json` | Machine-readable JSON instead of the formatted view |
| `--limit <n>` | How many incidents to show (default 10, max 100) |
| `--down` | With `list`, show only impaired APIs |
| `-h`, `--help` | Usage |
| `-v`, `--version` | Version |

## Exit codes

The exit code reflects the API's status, so you can gate scripts on it:

| Code | Meaning |
| --- | --- |
| `0` | Operational |
| `2` | Degraded |
| `3` | Down |
| `1` | Usage error, unknown API, or the request failed |

```bash
# Don't start the deploy if the payment API is having a bad day
npx apidown stripe || exit 1
```

```bash
# Is anything in the world broken right now?
npx apidown list --down
```

```bash
# Pull one field out
npx apidown openai --json | jq -r .status
```

## Configuration

| Variable | Purpose |
| --- | --- |
| `APIDOWN_API_BASE` | Point at a different APIdown instance (default `https://apidown.net`) |
| `NO_COLOR` | Disable colour output |

Colour is also disabled automatically when stdout is not a TTY, so piping stays clean.

## What the numbers mean

Everything reported here is APIdown's own measurement, aggregated from anonymised signals sent
by applications running the APIdown SDK. It is not the vendor's reported uptime, and the two
will differ — client-side measurement includes the network path, so DNS, routing, and CDN edge
failures count against an API here. A dash means we had no signals in that window, not that the
API was down.

The same data is available over HTTP at [`/v1`](https://apidown.net/docs#v1-api).

## Licence

MIT
