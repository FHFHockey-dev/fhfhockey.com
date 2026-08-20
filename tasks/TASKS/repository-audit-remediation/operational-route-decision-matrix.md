# Operational route decision matrix

Status: **Approved by repository owner — 2026-08-19**  
Parent: `AUDIT-TASK-003` / `FIND-SEC-003`  
Current-source check: 2026-08-19

The repository owner approved the complete proposed matrix in the active Codex
goal on 2026-08-19. No endpoint, handler, scheduler, database, scraper, or
external service was invoked to record or implement that decision.

## Evidence boundary

- All 20 route files still match the frozen finding hashes exactly.
- All 20 are framework-addressable. None authenticates the request before its
  current handler or audit work.
- Eighteen routes use `withCronJobAudit`; that wrapper invokes the handler and
  then attempts a service-role `cron_job_audit` insert. Authentication therefore
  must be outside the audit wrapper to reject before either action.
- The current tracked Vercel and Supabase scheduler configurations contain none
  of these 20 route names. References in cron reports, benchmark notes, and
  remediation output are metadata or recommendations, not invocation evidence.
- An untracked/provider-side scheduler or manual operator may still exist. Any
  request to preserve mutation-capable GET must name that caller before the
  proposed method contract changes.

## Proposed contract vocabulary

- **Authenticated job:** retain the implementation behind outermost
  `adminOnly(...)`, then method enforcement, then `withCronJobAudit(...)` where
  audit ownership remains justified. Permit admin bearer tokens and the existing
  exact `CRON_SECRET` bearer contract. Default omitted `dryRun` to non-writing.
- **Authenticated diagnostic:** retain a GET-only read/status surface behind the
  same outer authentication boundary.
- **Inert compatibility:** retain an addressable response naming the canonical
  replacement or retirement state, but perform no audit, client, external, or
  database work.
- **GET exception:** preserve mutation-capable GET only after the owner records
  an actual scheduler that cannot use POST and its credential contract.

## Route matrix

| Route | Current method/effect | Current tracked consumer evidence | Proposed disposition | Proposed method/auth contract | Owner decision |
| --- | --- | --- | --- | --- | --- |
| `/api/v1/db/audit-nhl-xg-backfill` | GET; service-role read plus audit insert | No caller found | Retain as authenticated diagnostic | GET; outer admin/cron auth; audit only after auth | Approved |
| `/api/v1/db/check-missing-goalie-data` | GET; NST fetch plus service-role upserts | Benchmark/classification metadata only | Retain as authenticated job | POST; outer admin/cron auth; GET only with scheduler receipt | Approved |
| `/api/v1/db/skaterArray` | All methods; public reads plus audit insert | One stale DRM comment; no request found | Inert compatibility unless an owner confirms a consumer | If retained, GET-only public read with no service-role audit; otherwise inert | Approved — inert |
| `/api/v1/db/update-goalie-starter-mixtures` | GET/POST; service-role upserts; omitted `dryRun` writes | No caller found | Retain as authenticated job | POST; outer admin/cron auth; omitted `dryRun` must not write | Approved |
| `/api/v1/db/update-last-7-14-30` | All methods; NHL fetch plus service-role upserts | No caller found | Retain as authenticated job | POST; outer admin/cron auth; GET only with scheduler receipt | Approved |
| `/api/v1/db/update-nhl-edge-teams` | GET/POST; NHL Edge fetch plus upserts | No caller found; authenticated canonical sibling exists | Inert compatibility naming `/api/v1/db/update-nhl-edge-stats` | No work or audit; canonical route owns execution | Approved — inert |
| `/api/v1/db/update-nhl-xg-adjusted-impact` | GET/POST; compute plus service-role upserts; omitted `dryRun` writes | No caller found | Retain as authenticated job | POST; outer admin/cron auth; omitted `dryRun` must not write | Approved |
| `/api/v1/db/update-nhl-xg-created-xg` | GET/POST; compute plus service-role upserts; omitted `dryRun` writes | No caller found | Retain as authenticated job | POST; outer admin/cron auth; omitted `dryRun` must not write | Approved |
| `/api/v1/db/update-nhl-xg-qot-qoc` | GET/POST; compute plus service-role upserts; omitted `dryRun` writes | No caller found | Retain as authenticated job | POST; outer admin/cron auth; omitted `dryRun` must not write | Approved |
| `/api/v1/db/update-nhl-xg-rebound-control` | GET/POST; compute plus service-role upserts; omitted `dryRun` writes | No caller found | Retain as authenticated job | POST; outer admin/cron auth; omitted `dryRun` must not write | Approved |
| `/api/v1/db/update-nhl-xg-shot-assists` | GET/POST; compute plus service-role upserts; omitted `dryRun` writes | No caller found | Retain as authenticated job | POST; outer admin/cron auth; omitted `dryRun` must not write | Approved |
| `/api/v1/db/update-nhl-xg-shot-features` | GET/POST; service-role upserts and compute | Cron-report mapping and backfill recommendation; no scheduler | Retain as authenticated job | POST; outer admin/cron auth outside audit/lease wrappers | Approved |
| `/api/v1/db/update-nhl-xg-transitions` | GET/POST; compute plus service-role upserts; omitted `dryRun` writes | No caller found | Retain as authenticated job | POST; outer admin/cron auth; omitted `dryRun` must not write | Approved |
| `/api/v1/db/update-nhl-xg-travel-fatigue` | GET/POST; compute plus service-role upserts; omitted `dryRun` writes | No caller found | Retain as authenticated job | POST; outer admin/cron auth; omitted `dryRun` must not write | Approved |
| `/api/v1/db/update-nst-last-ten` | GET; long NST scrape plus service-role upserts | Benchmark/classification metadata only | Retain as authenticated job | POST; outer admin/cron auth; GET only with scheduler receipt | Approved |
| `/api/v1/db/update-nst-player-reports` | GET/POST; unawaited NST scrape/upsert job | Benchmark/classification metadata only | Retain as authenticated job | POST; outer admin/cron auth; GET only with scheduler receipt | Approved |
| `/api/v1/db/update-power-rankings` | GET/POST; 410 no-work stub plus audit insert | Cron report explicitly marks legacy disabled | Retain as inert compatibility | 410; no client, audit, or privileged work | Approved — inert |
| `/api/v1/db/update-team-power-ratings-new` | GET/POST; warning-only stub plus audit insert | Cron-report metadata; canonical route exists | Retain as inert compatibility naming `/api/v1/db/update-team-power-ratings` | No client, audit, or privileged work | Approved — inert |
| `/api/v1/db/update-nhl-ppt-replay-tracking` | GET/POST; external fetch, delete, and replacement upserts | No caller found | Retain as authenticated job only if owner confirms purpose | POST; outer admin/cron auth; omitted `dryRun` must not write | Approved — retain |
| `/api/v1/ml/create-materialized-view` | POST; three unauthenticated service-role DDL attempts | No caller found; incompatible with current schema authority | Retire as inert compatibility under AUDIT-TASK-008 | No DDL, RPC, client, or audit work | Approved — inert |

## Approval receipt

The repository owner approved the recommended bundle in the active Codex goal,
with only `AUDIT-TASK-026` expressly withheld for further explanation. That
exception is unrelated to this matrix. No mutation-capable GET exception was
approved; future exceptions still require a named caller and credential receipt.
