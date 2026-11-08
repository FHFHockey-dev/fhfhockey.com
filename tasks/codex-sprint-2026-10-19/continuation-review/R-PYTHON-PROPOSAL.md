# R-PYTHON — exact local caller-auth proposal

Status: proposal only; **no source edits, Python/pytest/import execution, or network calls**. Own matching session runtime reconfirmed `gpt-6.1-sol/high` using the session's `turn_context` through `jq`. Canonical checkout remains `octoberBranch`.

## Confirmed paths and safety issue

- Retained finding: `tasks/sprint-2026-10-18/HANDOFF-2026-10-18.md:1085` identifies the missing caller check. Current source independently confirms it.
- `functions/api/fetch_team_table.py:252-309`: standalone `/`, `/api/fetch_team_table`, and trailing-slash alias invoke `_handle_fetch_team_table_request` without caller authentication. Missing season parameters reach `_get_current_and_last_season_ids` before missing required `sit/rate` is rejected.
- `functions/api/index.py:36-78`: aggregate `/fetch_team_table` independently calls the same provider helper without authentication. Its SKO-only `_check_auth` uses `SKO_PIPELINE_SECRET`; this does not establish a team-table caller contract.
- `web/pages/api/Teams/nst-team-stats.ts:336`: server-side web caller fetches the fixed functions URL without Authorization. Its existing C-F2 diff moves `adminOnly` outside cron auditing; that diff must be preserved.
- Existing Python tests: `functions/tests/test_fetch_team_table_contract.py`; existing web tests: `web/__tests__/pages/api/Teams/nst-team-stats.route.test.ts`.
- Concrete execution hazard: the Python invalid-request fixture supplies `from_season` but omits `thru_season`. Standalone discovery can call `get_conn`, which lazily invokes `ensure_loaded_for` and can read `web/.env.local` / connect a database. Synthetic `NST_KEY` alone does not prevent this. No Python command was run.

## Proposed behavior

1. Define one team-table-specific HTTP caller guard inside existing `functions/api/fetch_team_table.py`, imported and invoked first by the aggregate entry. Reuse `TeamTableResult` / the existing `{data: [], error: {code, message}, debug: ...}` error shape with generic non-secret text. No generic auth framework or new dependency.
2. Proposed shared server-only environment contract: **`NST_TEAM_TABLE_SECRET`**, the same operator-provisioned bearer secret in the web app and functions service. This is distinct from provider `NST_KEY` and SKO `SKO_PIPELINE_SECRET`; do not fall back to either. No live parity, presence, or rollout readiness is assumed. Read from injected process environment only; the HTTP auth guard never invokes the environment-file loader.
3. Validate a configured nonempty bearer credential on each HTTP request, with blank/whitespace configuration failing closed. Use constant-time comparison of the exact expected Bearer header (byte comparison handles arbitrary invalid non-ASCII headers without crashing). Missing/wrong/malformed credentials share a generic `401` / `caller_unauthorized`; missing/blank shared configuration yields generic `503` / `caller_auth_unavailable`. Never include supplied/expected credentials in bodies, debug payloads, logs, URLs, or exception text.
4. Run this guard before query extraction, dynamic season DB access, provider configuration loading, provider requests, or parsing at **both** Python HTTP entries. Standalone aliases share the same handler/guard. After authentication, reject missing `sit/rate` before season discovery while preserving the current `400 invalid_request` payload. Retain valid dynamic season discovery/default behavior and aggregate's existing valid-request semantics.
5. Keep direct `fetch_team_table(...)` / CLI use independent of HTTP caller authentication. Its existing `NST_KEY` requirement, parsing, and named error/status outcomes remain unchanged. No NST source query, pacing, timeout, season contract, or result-data changes.
6. In the authenticated web route, validate the shared secret before season/database/request work in its handler. Missing/blank local config returns generic `503` / `caller_auth_unavailable`, without fetching the functions service or writing team rows. Pass only a server-side `Authorization: Bearer ...` header on every existing functions request; preserve the current timeout/signal, request sequence, safe 21-second post-completion spacing, bounds, and sequential flow. Preserve C-F2's outer authentication composition.
7. Extend the existing route outcome classifier to recognize **only the two new explicit structured caller-auth codes** as fatal configuration/dependency failures, in addition to existing missing-provider-key cases. Match JSON code fields independent of whitespace. This stops a mismatched downstream secret after one failed request and returns the existing web `503` failure outcome; it must not loop through every situation/date or write failed-response data. Ordinary provider/source failures retain current outcome behavior.

## Exact implementation ownership requested

1. `functions/api/fetch_team_table.py`
2. `functions/api/index.py`
3. `functions/tests/test_fetch_team_table_contract.py`
4. `web/pages/api/Teams/nst-team-stats.ts` — preserve current C-F2 diff.
5. `web/__tests__/pages/api/Teams/nst-team-stats.route.test.ts`
6. `web/lib/cron/nstTeamStatsOutcome.ts`
7. `web/lib/cron/nstTeamStatsOutcome.test.ts`

The two outcome files keep fatal-failure classification in its existing owner and avoid route-local string matching or a new error framework. No manifest, dependency, lockfile, environment/config file, shared Python fixture file, scheduler, migration/schema, fenced path, hosted setting, or secret value changes are proposed. Notes/handoff remain under `tasks/codex-sprint-2026-10-19/continuation-review/`.

## Focused synthetic acceptance

Python existing test extension:

- All four standalone/aggregate route forms reject absent/blank config, missing bearer, wrong bearer, malformed scheme/credentials, and a provider key mistakenly used as caller credential. Assert no season discovery, DB connection, environment loading, provider fetch, or parsing before rejection, and no credential material in response/debug.
- Explicitly test missing `thru_season` and missing required params under rejection; authenticated missing-required requests remain `400` and make no season query after the ordering correction.
- Valid synthetic shared bearer plus independent synthetic `NST_KEY` preserves existing success parsing and named missing-provider-key/timeout/HTTP/parser outcomes at both canonical entries. Existing authorized fixtures receive the synthetic bearer by default; auth rejection cases explicitly override/remove it.
- An authenticated valid request lacking seasons uses a mocked static season resolver, proving order/behavior without DB access. Direct helper use with a mocked provider remains usable without the HTTP caller secret.

Web existing tests:

- Synthetic shared secret appears only in the Authorization header of every mocked functions request; no URL/response/log contains it.
- Missing/blank config: `503`, zero functions fetches, zero upserts, and no handler season discovery.
- Downstream explicit caller-auth `401` or config `503`: one request, no failed-response writes, no retry/fan-out. Existing current/date request pacing and provider-outcome tests remain passing, including the existing safe `21_000` ms contract.
- Narrow classifier tests cover both new auth codes with JSON whitespace variants and ensure unrelated provider/source errors remain nonfatal.

## Python check exception required before execution

Current authorization permits only web `npm test` / tsc / lint checks. **Do not execute the following command without a separate explicit, narrow Python-test exception.** Interpreter path was identified with `command -v` only (`/usr/local/bin/python3`); no interpreter/dependency check or import was performed. Installed pytest/dependency availability remains unknown; no install is proposed.

Before requesting that exception, implement the following **autouse test-local safety fixture in the owned contract test file**, with API imports delayed until these guards are installed (avoid new `conftest.py` edits):

- Patch `lib.env_loader.ensure_loaded_for` to a no-op/mock and `load_web_env_local` to raise on any attempt. After delayed module imports, also patch the endpoint's bound `ensure_loaded_for` (and the imported postgres loader reference if loaded). Supply only synthetic `NST_TEAM_TABLE_SECRET` / `NST_KEY` per case; absence cases delete only those synthetic keys.
- Patch endpoint `_get_current_and_last_season_ids` to a failing mock by default and `get_conn` to fail immediately; patch `lib.postgres.get_conn` / psycopg connection entry if present as defense in depth. Only the explicit valid dynamic-season test replaces the resolver with a static synthetic tuple. Existing missing-thru-season and invalid-request fixtures therefore cannot touch a real DB even if a regression changes validation order.
- Deny unmocked `requests.sessions.Session.request`, socket connect/connect_ex/create_connection and DNS resolution. Provider responses in existing success/failure tests are explicit `requests.get` mocks. Guard before delayed API imports; no local Flask socket server is used—only Flask `test_client` in-process dispatch.
- Restore all monkeypatches per test; keep plugin autoload disabled and the process environment scrubbed. These guards must be part of the concrete reviewable patch before execution is authorized.

Exact proposed exception command, from `/Users/tim/Code/fhfhockey.com`:

```sh
env -i PATH=/usr/local/bin:/usr/bin:/bin PYTHONPATH=functions PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 PYTHONDONTWRITEBYTECODE=1 /usr/local/bin/python3 -m pytest -q -p no:cacheprovider functions/tests/test_fetch_team_table_contract.py
```

This is one focused local test file, no server, no database, no environment-file loading, no dependency installation, and all unmocked network denied. An unavailable interpreter/dependency is a stop/report condition, not authorization to install or broaden execution. Python evidence remains **not run** until the exception is granted; web-only mocked checks can proceed under existing rules after source ownership is approved.

Permitted proposed web check, from `web/`:

```sh
npm test -- __tests__/pages/api/Teams/nst-team-stats.route.test.ts lib/cron/nstTeamStatsOutcome.test.ts
```

## External gate and handoff boundary

The new server secret requires separately authorized operator provisioning of matching values in both deployed services and a coordinated exact-candidate release. This proposal does not authorize reading, generating, accepting, transmitting, rotating, or setting real credentials, invoking/deploying hosted endpoints, or changing Vercel settings. A local fail-closed patch can be implemented with synthetic fixtures even while that external gate remains open; do not call the integration production-ready before configuration/release and separately authorized verification.

Next action: Chef reviews this exact seven-file behavior/scope, reserves it, and authorizes local edits. Python execution stays separately blocked pending the explicit narrowly scoped exception and review of the safety fixture.
