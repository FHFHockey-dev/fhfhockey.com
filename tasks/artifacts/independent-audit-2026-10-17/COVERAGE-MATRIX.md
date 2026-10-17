# Coverage matrix

**Legend.**

- **Exercised**: the audit ran or measured it with a command (build output, bundle analysis, traces, DB reads).
- **Inspected**: the cited code paths were read in full for the specific question.
- **Sampled**: the entry structure or a subset was read, or a delegated grep sweep ran and a subset of its hits was spot-verified.
- **Unreviewed**: inventoried at most.

Nothing here is claimed to be fully audited. "Delegated" means the work came from a read-only subagent sweep, re-verified by the lead only where the REPORT says so.

## Surfaces

| Area | Count | Status | What was actually covered | Not covered |
| --- | ---: | --- | --- | --- |
| Client bundles, all page routes | 79 routes | **Exercised** | First Load JS per route from a compile build (gzip per manifest). Library signatures in the top 8 routes' chunks. `_app` attribution and the Patch 01 delta (esbuild). | Runtime timings (LCP, INP, CLS). Request waterfalls. Attribution inside the draft-dashboard page chunk. |
| `_app`, `_document`, Layout, Comments, the two `/db` pages | 6 files | **Inspected** | Providers, consumers, snackbar call sites. | Accessibility of these components. |
| Homepage client date handling | 6 files | **Inspected** | moment and moment-timezone call sites. | SSR data chain (prior P01 is still open, not re-measured). |
| Other page entries | ~73 | **Sampled** (bundle size only) | Size ranking. | Source logic. The 2026-10-15 page audit's per-page review is kept as the reference. |
| Serverless function weight | 437 traces | **Exercised** | Traced bytes per route; files outside `web/` flagged. | Cold-start time. |
| API routes, per-minute and scheduled handlers | `starter-board`, `yahoo-live-draft`, `update-line-sources` (entry, empty-queue path), `update-lines-ccc` (entry), `forecast`, `rebuild-window-z`, `rebuild-score` | **Inspected** | Idle paths, fan-out, write semantics, paging. | Full processor logic, about 1,700 lines. |
| Other scheduled handlers (Patreon, Fantrax, ESPN, odds, `replay-player-aliases`, `auto-news`, draft-ranker, drafted-prospects, `cron-report`) | 12 | **Sampled** (delegated) | Early-exit and lease presence. | Per-run query counts, early exits of the sync libraries. |
| Remaining API routes | ~340 | **Sampled** (delegated grep for paging, IN lists, N+1) | About 25 spot reads by the sweep. The lead verified `goalie-power`, `accountability` and the `teamStats` page. | Security, auth and response-size review. |
| Shared libraries (`lib/`) | 799 files | **Sampled** | Pagination helpers, `withCronJobAudit`, `starterBoardQueue`, `lines/processor`, `sustainability/windows`, `game-predictions/workflow` and `accountability`. | Most of `lib/`. |
| Ingestion: NHL, NST, Yahoo, IFTTT | — | **Sampled** | IFTTT line-source retry path. NST spacing untouched and not exercised. | NST and NHL ingestion handlers, Yahoo sync internals. |
| Scheduled work: Vercel crons | 27 | **Inspected** (config), **Exercised** (audit volume) | Every entry listed. Two per-minute crons traced. Duplicate h0 confirmed. | Vercel invocation and usage data. |
| Scheduled work: pg_cron | 69 per snapshot | **Sampled** (snapshot doc), **Exercised** (13 jobs read live) | Duplicates and sustainability jobs checked live. | All 59 active jobs' live commands. |
| GitHub workflows | 1 | **Inspected** | No schedule trigger. | — |
| Database access and indexes | — | **Exercised** (6 reads) | `cron_job_audit` size, scans and inserts; `player_baselines` indexes; pg_cron rows. | Plans, other tables, the 36 duplicate-index groups and 196 unindexed FKs (leads only). |
| Tests and test config | 762 test files | **Sampled** | Vitest exclusions (the `.next-codex-reconcile` copy is excluded). Nearest tests located for each backlog item. | No test suite was run. |
| Build config | `next.config.js`, `web/vercel.json`, root `vercel.json` | **Inspected** | `distDir` isolation, `cleanDistDir`, traces include list, crons, `ignoreCommand`. | Vercel project settings, which are outside the repo. |
| Dependencies | 80 + 33 | **Exercised** | Zero-reference scan; `npm ls` for candidates. | Vulnerability audit (owned by the security sprint). |
| Repository weight and cleanup | 10,767 tracked files | **Exercised** | Bytes per tree, references, ownership notes, git object stats, ignored directory sizes. | Contents of each artifact folder. |
| `cms/`, `functions/`, `supabase/functions` | — | **Unreviewed** | — | Everything. `webhooks/` is named in AGENTS.md but absent from this checkout. |
| Decisions API and Luna | — | **Excluded by scope** | — | — |

## Prior evidence reconciled

| Source | Status here |
| --- | --- |
| `output/page-optimization-audit-20261015.md` (8 F / 70 S page entries, 354 API candidates, 12 findings) | R01 fixed. P01–P04 open, not re-measured. P05 measured and extended (F1). A01–A06 not reviewed. |
| `/Users/tim/Documents/Codex/2026-10-15/task-2/*` | Read the plan, outcome and CSV headers. Protections kept. Gap found: F10. |
| 2026-10-15 cleanup review (87 protected paths, 11.16 GiB) | Policy adopted. Not re-measured. |
| Commit `7f094c8e6` weight | Measured the npm cache (78.6 MB) and other trees. See the cleanup manifest. |
| Read-only DB audit leads | One duplicate group sized. The cancelled statistics query was not retried. |
| Sibling note `consumer-test-fixes-2026-10-17.md` | Read. Its files are untouched, and none overlap Patch 01. |
