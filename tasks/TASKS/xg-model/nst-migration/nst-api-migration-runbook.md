# NST API Migration Runbook

## TL;DR

All automated NST access must now use:

- host: `https://data.naturalstattrick.com`
- auth: `nst-key` header
- secret name: `NST_KEY`

The migrated FHFH paths now share one NST request contract, one redaction policy, and one shared key-budget coordination model.

Operational rules:

- never commit `NST_KEY`
- treat `NST_KEY missing`, `NST authentication failed`, and `NST token budget exhausted` as distinct operator states
- do not run concurrent direct NST repair jobs against the same key
- direct NST jobs now coordinate around one shared key budget with a 5-minute cooldown between direct job runs

## Local Setup

Add `NST_KEY` to local gitignored env:

```env
# /Users/tim/Code/fhfhockey.com/.env.local
NST_KEY=replace-with-your-active-natural-stat-trick-key
```

Required deployment locations:

- local `.env.local`
- deployed Next.js server environments
- deployed Python function environments for any live direct NST callers

Rules:

- `NST_KEY` must remain server-only
- do not use `NEXT_PUBLIC_NST_KEY`
- query-string `key=` auth is compatibility-only and must stay redacted anywhere it surfaces

## Manual Smoke-Test Matrix

Use one representative sample from each migrated NST family. Prefer local execution first. If legacy `www.naturalstattrick.com` scraping is already blocked, compare against the preserved fixture/test expectation and downstream shape instead of trying to force live legacy access.

| Family | Route / Script | Sample Input | Expected Check |
| --- | --- | --- | --- |
| `playerreport.php` | `/api/CareerAverages/8478402` | `GET` | response stays `success: true`; numeric fields like `IPP`, `S%`, `oiSH%`, `ixG`, `goals` remain present and typed the same |
| `playerteams.php` skater | `/api/SustainabilityStats/8478402` | `POST {"Season":"20242025","StartTime":null,"EndTime":null}` | response stays `success: true`; fields `S%`, `xS%`, `IPP`, `oiSH%`, `SOG/60`, `oZS%`, `ixG`, `goals` remain present |
| `playerteams.php` goalie | `/api/v1/db/update-nst-goalies?startDate=2025-10-01&maxUrls=1&maxDays=1` | `GET` with admin auth where required | route returns `200`; exactly one bounded NST fetch occurs; one goalie row upserts with the same conflict key shape `player_id,date_scraped` |
| `teamtable.php` | `/api/fetch_team_table?from_season=20242025&thruseason=20242025&sit=pk&rate=n&fd=2025-01-15&td=2025-01-15` | `GET` | response returns parsed rows with the same header-cleaning behavior and percentage normalization |
| Cron-backed DB writer | `/api/v1/db/update-nst-team-daily?runMode=forward&startDate=2025-10-01&endDate=2025-10-01` | `GET` with admin auth where required | route completes with no auth/rate error, writes through existing upsert keys, and logs the selected NST request plan |

For each smoke test, verify:

- the route still targets `data.naturalstattrick.com`
- no surfaced URL leaks a raw NST key
- request/query parameter shape matches the pre-migration contract
- parser output shape or DB upsert target matches the pre-migration contract
- failures are sanitized and operator-readable

## Comparison Method

Use this order of comparison:

1. Confirm the migrated route builds the same NST path and query parameters as the old implementation, except for host/auth changes.
2. Compare the migrated parser output or DB row shape to the preserved fixture/test expectation for the same input.
3. If legacy live access is still available for one sample, compare the legacy and migrated outputs directly for that sample.
4. If legacy live access is blocked, treat the fixture-backed parity tests and existing downstream contract as the reference baseline.

## Rollout Sequence

1. Local verification
   - add `NST_KEY` to `.env.local`
   - run targeted NST parity tests
   - run the manual smoke matrix locally
2. Preview or staging verification
   - confirm `NST_KEY` exists in the deployed server environment
   - run one bounded direct NST DB route
   - verify no auth errors, no key leakage, and sane request pacing
3. Production rollout
   - deploy with `NST_KEY` already present
   - start with bounded direct NST routes
   - then resume normal scheduled NST jobs
   - monitor auth, 429s, parse failures, and stale downstream tables after the first production cycle

## Rollback

Use rollback if production starts returning auth failures, repeated `429` token-budget exhaustion, parse drift, or stale-table incidents that cannot be corrected quickly.

Rollback actions:

1. Stop or avoid manual direct NST repair routes.
2. Disable scheduled direct NST jobs if they are repeatedly failing.
3. Preserve logs and redacted request metadata for diagnosis.
4. Restore the previous stable application deploy only if the failure is clearly introduced by the migration code rather than missing env/config.
5. Do not revert to scraping `www.naturalstattrick.com` as a long-term automation strategy.

## Monitoring And Triage

Watch for:

- `NST_KEY missing`
- `NST authentication failed`
- `NST token budget exhausted`
- upstream `5xx` spikes
- parse failures caused by HTML/table drift
- cron duration regressions
- stale downstream NST-backed tables

Triage sequence:

1. Config
   - confirm `NST_KEY` exists in the active environment
2. Auth
   - if errors map to `NST authentication failed`, validate the current key value and whether NST rotated or deactivated it
3. Budget
   - if errors map to `NST token budget exhausted`, stop concurrent manual jobs and wait for the NST window to refresh
4. Upstream
   - if errors map to `NST upstream failed`, retry later and inspect whether NST is having load issues
5. Parsing
   - if the route reaches NST but returns missing-table or parse errors, compare the HTML shape against the fixture-backed parity tests
6. Application logic
   - if NST responses are healthy but downstream rows are wrong, inspect the route mapper/upsert layer

## Final Migrated Inventory

Canonical direct migrated callers:

- `web/lib/nst/client.ts`
- `web/pages/api/Averages/helpers.ts`
- `web/pages/api/CareerAverages/[playerId].ts`
- `web/pages/api/SustainabilityStats/[playerId].ts`
- `web/pages/api/ThreeYearAverages/[playerId].ts`
- `web/pages/api/Teams/[teamAbbreviation].ts`
- `web/pages/api/fetch_team_table.ts`
- `web/pages/api/v1/db/update-nst-gamelog.ts`
- `web/pages/api/v1/db/update-nst-goalies.ts`
- `web/pages/api/v1/db/update-nst-team-daily.ts`
- `web/pages/api/v1/db/update-nst-current-season.ts`
- `web/pages/api/v1/db/update-nst-player-reports.ts`
- `web/pages/api/v1/db/update-nst-last-ten.ts`
- `web/pages/api/v1/db/check-missing-goalie-data.ts`
- `functions/api/fetch_team_table.py`
- `web/scripts/fetch_team_table.py`

Intentionally retained legacy or manual-only tools:

- `web/pages/api/v1/db/nst_gamelog_scraper.py`
- `web/pages/api/v1/db/nst_gamelog_goalie_scraper.py`
- `web/pages/api/ThreeYearAverages/nstgamelog.py`
- `web/pages/api/ThreeYearAverages/nsttest.py`

Known follow-up cleanup candidates:

- decide final ownership of `web/pages/api/v1/db/update-nst-player-reports.ts`
- decide final ownership of `web/pages/api/v1/db/update-nst-last-ten.ts`
- decide whether `web/pages/api/fetch_team_table.ts` should remain supported beside `functions/api/fetch_team_table.py`
- fix, replace, or retire `web/pages/api/Teams/[teamAbbreviation].ts`
- clean up stale copied route headers and old anti-bot comments still present in some NST routes
