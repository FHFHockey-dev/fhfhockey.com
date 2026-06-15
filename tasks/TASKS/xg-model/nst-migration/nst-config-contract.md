# NST Configuration Contract

Last updated: 2026-04-08

## Purpose

This document defines the canonical configuration contract for all Natural Stat Trick automated access in this repository.

It is the source of truth for:

- the approved NST host
- the required secret name
- the primary authentication method
- local development expectations
- deployed environment expectations
- safe logging and redaction behavior

## Canonical Upstream

- Base host: `https://data.naturalstattrick.com`
- Approved automated-access surfaces:
  - `playerreport.php`
  - `playerteams.php`
  - `teamtable.php`
  - `game.php` if later required
- Legacy hosts that must not remain in automated request code after migration:
  - `https://www.naturalstattrick.com`
  - `https://naturalstattrick.com`

## Canonical Secret

- Environment variable name: `NST_KEY`
- Secret type: server-only credential
- Exposure rule:
  - never expose `NST_KEY` in client bundles
  - never add it to `NEXT_PUBLIC_*`
  - never log the raw value
  - never commit it to source control
  - never store it in fixtures, snapshots, or task artifacts

## Authentication Contract

- Primary authentication method: request header
  - header name: `nst-key`
  - header value: `process.env.NST_KEY`
- Compatibility fallback:
  - allow query-string `key=<NST_KEY>` only where a caller cannot set custom headers
  - any such fallback must be explicit, not implicit
  - any logged or surfaced URL must redact the `key` value before storage or display

## Environment Expectations

### Local development

- `NST_KEY` must exist in the local gitignored `.env.local`.
- Local setup should treat `NST_KEY` the same way current server-only secrets such as `SUPABASE_SERVICE_ROLE_KEY` are treated.
- If a local developer does not have `NST_KEY`, NST-backed routes should fail fast with a sanitized configuration error.

Suggested local entry:

```env
NST_KEY=replace-with-your-nst-key
```

### Deployed environments

- `NST_KEY` must be configured in every deployed server environment that executes NST-backed routes or hosted functions.
- This includes:
  - the Next.js server environment for `web/pages/api/**` routes
  - the hosted Python functions environment for `functions/api/**` routes that fetch NST directly
- Deploy configuration must keep `NST_KEY` server-side only.
- Production rollout is blocked until `NST_KEY` is present in all active server runtimes that own canonical NST paths.

## Runtime Behavior

- Missing `NST_KEY` must produce a fast-fail configuration error before any NST request is attempted.
- Configuration errors must be sanitized and operator-readable.
- Recommended message shape:
  - `NST_KEY missing`
  - `NST auth rejected`
  - `NST token budget exhausted`
  - `NST parse failed`
- Route responses, audit rows, and logs must never include the raw secret.

## Logging And Redaction Rules

- Safe to log:
  - endpoint family such as `playerreport.php`
  - redacted URL
  - upstream status code
  - retry count
  - request pacing decision
  - route or job name
- Unsafe to log:
  - raw `NST_KEY`
  - unredacted URLs containing `key=...`
  - copied request headers that contain `nst-key`

## Ownership Rules

- Canonical `teamtable.php` production path:
  - `functions/api/fetch_team_table.py`
- Canonical `playerteams.php` production path:
  - TypeScript Next.js routes under `web/pages/api/v1/db/**`
- Canonical `playerreport.php` production path:
  - TypeScript API routes and shared helper path under `web/pages/api/**`

## Migration Guardrails

- New NST code must target `data.naturalstattrick.com` by default.
- New NST code must read `NST_KEY` from environment configuration only.
- Any new helper introduced during migration must preserve header-first auth as the default.
- Any route still using query-string auth after migration should be treated as an exception and documented.

## Python Integration Pattern

### Canonical Python runtime scope

- Production-reachable Python NST code is limited to the hosted `teamtable.php` path under:
  - `functions/api/fetch_team_table.py`
- Python scraper files under `web/pages/api/v1/db/` are not canonical production owners and should be treated as legacy or manual utilities unless explicitly reactivated later.

### Python environment-loading contract

- Python code under `functions/` must prefer real environment variables injected by the platform.
- For local development only, Python code under `functions/` may use:
  - `from lib.env_loader import ensure_loaded_for`
  - `ensure_loaded_for(["NST_KEY"])`
- Python code must not hardcode absolute local `.env.local` paths.
- Legacy Python files that still use `load_dotenv('C:/.../.env.local')` should be considered out of contract and migrated or retired before they are trusted again.

### Python authentication contract

- Python direct NST requests must use:
  - base host `https://data.naturalstattrick.com`
  - header `nst-key: <NST_KEY>`
- Query-string `key=` fallback is allowed only as an explicit exception and must follow the same redaction rules as the TypeScript path.

### Python logging and redaction contract

- Python debug payloads and error messages must never include the raw `NST_KEY`.
- If a Python caller stores or returns a request URL, it must redact any `key=` value before doing so.
- Python callers should prefer logging endpoint family, status code, and redacted URL rather than raw request objects.

### Python migration stance for this project

- `functions/api/fetch_team_table.py` should be brought into contract and kept as the canonical Python NST path.
- These files should be treated as legacy/manual until a later explicit decision says otherwise:
  - `web/pages/api/v1/db/nst_gamelog_scraper.py`
  - `web/pages/api/v1/db/nst_gamelog_goalie_scraper.py`
  - `web/scripts/fetch_team_table.py`
