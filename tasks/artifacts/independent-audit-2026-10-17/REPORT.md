# FHFH independent optimization audit, 2026-10-17

This is a read-only audit of `/Users/tim/Code/fhfhockey.com` on `octoberBranch` at `ceceb407a`. It made no source edits, commits, deploys, Vercel changes or production writes. It ran one isolated compile-only build and six bounded read-only production database reads. The Decisions API and Luna are excluded. **This report is not a full audit.** COVERAGE-MATRIX.md shows what was inspected, sampled, exercised or left unreviewed.

Companion files:

- [BASELINE.md](BASELINE.md): every measurement and the command that reproduces it.
- [BACKLOG.md](BACKLOG.md): ranked, with metrics and acceptance tests.
- [CLEANUP-MANIFEST.md](CLEANUP-MANIFEST.md) and [cleanup-manifest.csv](cleanup-manifest.csv).
- [PATCH-PROPOSAL-01.md](PATCH-PROPOSAL-01.md) and [its diff](patch-01-scope-global-providers.diff).
- [COVERAGE-MATRIX.md](COVERAGE-MATRIX.md).
- `data/`: raw outputs and scripts.

**Evidence labels.** *Measured* means a number was produced here by a reproducible command. *Verified in code* means the behavior follows from the cited lines, with no runtime check. *Suspicion* means a plausible lead without proof.

## Headline

1. **Every page ships about 91 kB gz (291 kB raw) of JavaScript that only three routes use.** That is 35% of the 263 kB shared bundle. Apollo serves blog comments, and notistack, which pulls in MUI, serves two admin `/db` pages. Both are provided globally in `_app`. *Measured.* Patch 01 fixes it in 4 files.
2. **Two latent truncation bugs will silently drop data.**
   - Goalie trends page at 2,000 rows, but PostgREST returns at most 1,000. Once a season passes about 1,000 goalie-games, whole goalies disappear.
   - Prediction accountability and backtests read a season's games unpaged, so they evaluate only the first 1,000 of 1,312 regular-season games.
   - *Verified in code*. The volumes are estimates.
3. **The per-minute Starter Board cron fans out 6 idle HTTP invocations a minute.** Each one writes an audit row into an unindexed, never-pruned table. *Measured*: the table takes ≈6,170 inserts a day, about 95% of them from these idle processors, and is fully scanned ≈84 times a day.
4. **The day-of (h0) game forecast is issued twice daily,** by pg_cron at 11:38 and Vercel at 11:45. Both runs append history and the later one overwrites the published output. *Measured config*.
5. **A 4.9 GB ignored nested repository holds 532 commits that are not in the main repo.** It is `web/.next-codex-reconcile`, and the 2026-10-15 cleanup review did not cover it. It must be protected and archived before any cleanup.

## Ranked findings

Impact is H/M/L for user-visible or cost effect. Confidence is in the finding itself. Effort is XS (<1 h), S, M or L. Each item gives source, evidence, a bounded change, an acceptance test and a rollback. Owner flags mark overlap with active sessions.

### F1. Global shell ships Apollo and notistack/MUI to every visitor

Impact H · confidence high · effort S · risk low.

- **Source.**
  - [`_app.tsx:7-8,14,79-92`](../../../web/pages/_app.tsx#L7) wraps every page in `ApolloProvider` and `SnackbarProvider`.
  - The only Apollo consumer is [`Comments.tsx:1,47`](../../../web/components/Comments/Comments.tsx#L47), used by `pages/blog/[slug].tsx:167`.
  - The only `useSnackbar` callers are [`pages/db/index.tsx:83`](../../../web/pages/db/index.tsx#L83) and [`pages/db/upsert-projections.tsx:146`](../../../web/pages/db/upsert-projections.tsx#L146).
  - notistack 2.0.8 depends on `@mui/material` and Emotion.
- **Evidence (measured).**
  - The `_app` chunk is 176 kB gz of the 263 kB shared JS. esbuild attribution: Apollo plus graphql is 161 kB raw (48.9 kB gz), and notistack plus MUI is 129 kB raw (43.3 kB gz).
  - The patched `_app` measures −91.1 kB gz and −290.6 kB raw. See BASELINE M2.
  - The 2026-10-15 page audit (P05) named Apollo but did not measure it, and missed notistack/MUI.
- **Change.** Patch 01: move each provider into its only consumer. Same singleton Apollo client, same `hasGql` guard, same snackbar options.
- **Acceptance.**
  - In an isolated compile build, the `_app` chunk falls by ≥ 80 kB gz.
  - The `_app` chunk contains 0 `MuiCollapse`, `InMemoryCache` or `go.apollo.dev` signatures.
  - Blog comments load and refetch after posting.
  - The `/db` snackbars show at the same anchor.
  - `npx tsc --noEmit` and lint pass on the touched files.
- **Rollback.** Revert 4 files. There is no data or schema change.

### F2. Goalie trend loader stops after the first 1,000 rows

Impact M, rising to H after the threshold · confidence high on code · effort XS · risk very low.

- **Source.**
  - [`goalie-power.ts:110`](../../../web/pages/api/v1/trends/goalie-power.ts#L110) sets `PAGE_SIZE = 2000`.
  - The loop at [`:432-458`](../../../web/pages/api/v1/trends/goalie-power.ts#L432) breaks when `data.length < PAGE_SIZE`.
  - PostgREST `max_rows = 1000` ([`supabase/config.toml:18`](../../../supabase/config.toml)). The repo's own test [`skater-queries.test.ts:205`](../../../web/lib/projections/queries/skater-queries.test.ts#L205) assumes the same cap.
- **Evidence.**
  - *Verified in code*: the first response holds at most 1,000 rows, which is less than 2,000, so the loop ends. Rows are ordered by `player_id`, so goalies with higher ids drop out entirely. No error is raised.
  - *Estimate*: one row per goalie appearance per metric means about 15 rows per day of play, so the cap is reached roughly 65–70 days into the season (around mid-December 2026). Row counts were not queried.
- **Change.** Set the page size to 1,000, or reuse `fetchAllSupabasePages` ([`lib/supabase/pagination.ts:100`](../../../web/lib/supabase/pagination.ts#L100)), with a stable order of `player_id`, `game_date`.
- **Acceptance.** Add a Vitest case beside `__tests__/pages/api/v1/trends/*.test.ts`: a fake client that caps each response at 1,000 rows, given 2,500 rows, must return all 2,500 in order.
- **Rollback.** One-line revert.

### F3. Prediction accountability and backtests evaluate at most 1,000 games per season

Impact M (evaluation integrity: model promotion evidence) · confidence high on code · effort S · risk low.

- **Source.** [`accountability.ts:2587-2606`](../../../web/lib/game-predictions/accountability.ts#L2587). `fetchCompletedSeasonGames` selects `games` for a season, ordered by date, with no range. Its callers are:
  - market-odds expected ids (`:2924`)
  - accuracy-loop readiness (`:3032`)
  - feature-signal analysis (`:3489`)
  - walk-forward backtest (`:3802`)
- **Evidence.** *Verified in code*: a regular season has 1,312 games, and more with preseason or playoffs when `gameType` is unset. Ordered by date ascending, the last ~24% of the season is silently excluded. The prospective-evaluation path ([`evaluation.ts:193-217`](../../../web/lib/player-forecasts/evaluation.ts#L193)) already fails loudly at its cap, which is the house pattern this function lacks.
- **Change.** Page with `fetchAllSupabasePages`, ordered by `date`, `startTime`, `id`. Optionally assert `count: "exact"` equals the rows read.
- **Acceptance.** Extend `lib/game-predictions/accountability.test.ts`: a fake client capped at 1,000 with 1,312 games must yield 1,312, and a backtest fixture's game count must equal the season count.
- **Rollback.** Revert one function.
- **Semantic note.** Historical backtest numbers produced before the fix were computed on partial seasons. Label them rather than rewriting them.

### F4. Per-minute Starter Board fan-out produces idle invocations and unbounded audit growth

Impact M (cost and DB load; it grows linearly) · confidence high (measured) · effort S–M per sub-item · risk medium (freshness). **Owner overlap:** the IFTTT session (line sources) and the ops-cron-health session (cron audit/report). Coordinate before any edit.

- **Source.**
  - [`starter-board.ts:26-27`](../../../web/pages/api/internal/starter-board.ts#L26) runs every minute ([`vercel.json:11`](../../../web/vercel.json#L11)) and calls `retryPendingLineSourceEvents` ([`lineSourceIftttReceiver.ts:138-155`](../../../web/lib/sources/lineSourceIftttReceiver.ts#L138)). That function POSTs 6 processor routes (5× `update-line-sources`, 1× `update-lines-ccc`) without first checking for pending events.
  - Each processor is wrapped by `withCronJobAudit`, which inserts unconditionally ([`withCronJobAudit.ts:335`](../../../web/lib/cron/withCronJobAudit.ts#L335)).
  - The table has no index ([schema `:7247`](../../../supabase/migrations/20260716112908_production_schema_baseline.sql#L7247)).
  - `cron-report` pages it with `count: "exact"` and `ORDER BY ... details` ([`cron-report.ts:1498-1504`](../../../web/pages/api/v1/db/cron-report.ts#L1498)), so each 1,000-row page is a full scan and a jsonb sort.
- **Evidence (measured).**
  - ≈6,170 audit inserts/day, about 95% from the two processors.
  - Sampled recent runs had 0 teams loaded and took 133–176 ms.
  - 0 deletes, 320.8 MB, ≈84 full scans/day. See BASELINE M5.
- **In-progress change (seen at about 20:30 UTC, uncommitted, IFTTT session).** `retryPendingLineSourceEvents` gains an early return while `iftttIntakePilotConfigured()` is true. Line references in this item are shifted by +2. That suppresses the fan-out only during the controlled pilot. Change (a) below remains relevant once the pilot ends.
- **Latent amplifier.** If `lineSnapshotFlags().observations` is enabled, [`processor.ts:14-21`](../../../web/lib/lines/processor.ts#L14) reconciles every scheduled team **in each of the 5 `update-line-sources` calls** per minute.
- **Bounded changes**, each separately approvable:
  - **(a)** In the scheduler, one query per events table selects source keys with `processing_status='pending'` for today. POST only those sources. If any reconciliation must still run on empty queues, call it at a lower, explicit cadence.
  - **(b)** Migration: `create index concurrently` on `cron_job_audit (run_time)` and `(job_name, run_time desc)`. This needs DB-change approval.
  - **(c)** A retention policy, for example archive and delete rows older than 90 days. This is destructive and ask-first.
- **Acceptance.**
  - (a) A Vitest case for the scheduler: with no pending rows, 0 processor POSTs. With one pending `gamedaylines` row, exactly 1 POST. Freshness check: a pending event is still processed within ≤ 1 minute.
  - (b) `EXPLAIN` (not ANALYZE) of the cron-report window query shows an index range scan.
  - Production metric: daily audit inserts fall from ≈6.2k to < 1k, read from `pg_stat_user_tables.n_tup_ins` deltas.
- **Rollback.** (a) is a revert. (b) is `drop index concurrently`. (c) cannot be undone without the archive, hence ask-first.
- **Security lead (handed off, not assessed here).** `cron_job_audit` has RLS `SELECT USING (true)`, and `anon` holds SELECT ([schema `:39827`, `:43638`](../../../supabase/migrations/20260716112908_production_schema_baseline.sql#L39827)). Response previews of up to 4 KB, including account-sync jobs, may therefore be readable with the public key.

### F5. h0 game forecast issued twice per day

Impact L–M (forecast semantics, duplicate history) · confidence high · effort XS · risk low, but it needs a decision.

- **Source and evidence.** Live pg_cron `386 game-predictions-forecast-h0` runs at 11:38 UTC, and [`vercel.json:91`](../../../web/vercel.json#L91) runs the same window at 11:45 UTC. `generatePregamePredictionsForWindow` ([`workflow.ts:1136-1180`](../../../web/lib/game-predictions/workflow.ts#L1136)) has no skip-existing guard. Each run:
  - inserts `game_prediction_history` ([`:898`](../../../web/lib/game-predictions/workflow.ts#L898)),
  - writes a feature snapshot keyed by a new cutoff,
  - upserts `game_prediction_outputs` (`:911-913`). The 11:45 run therefore replaces the 11:38 issuance.
- **Change.** Keep one issuer. The recommendation is the pg_cron series, so h7/h3/h1/h0 run on one mechanism; delete the Vercel entry. **Decision needed from TJ**, because the published h0 cutoff moves by 7 minutes.
- **Acceptance.** One `game_prediction_history` row per game per h0 day, and the accountability report is unchanged in structure.
- **Rollback.** Restore the entry.

### F6. Sustainability chain has a fixed 750/1,000-id ceiling and idle offset jobs

Impact L now, M later in season · confidence high on code, population measured today · effort S · risk low.

- **Source.** Vercel window-z and score run offsets 0/250/500 only ([`vercel.json:39-59`](../../../web/vercel.json#L39)), and trend-bands runs 0–750. Ids come from [`windows.ts:253-283`](../../../web/lib/sustainability/windows.ts#L253) and are sliced in [`rebuild-window-z.ts:64-81`](../../../web/pages/api/v1/sustainability/rebuild-window-z.ts#L64). The inactive pg_cron jobs 370–372 used `runAll`.
- **Evidence.**
  - Today's F/D population is ≤ 400 (*measured*). Nothing is truncated now, and the offset-500 window-z/score jobs and offset-500/750 trend-bands jobs are no-ops.
  - Above 750 F/D ids, later players are skipped silently.
  - Last season's peak population was not measured.
  - The old pg_cron design covered offset 750 for window-z and score; the current Vercel set does not.
- **Change.**
  - Return `totalIds`, `coveredThrough` and `remaining` in each response. `cron-report` or health already reads response previews.
  - Add offset 750 for window-z and score so coverage matches trend-bands, or make the last batch loop until it runs out of time budget.
  - The schedule change needs approval.
- **Acceptance.** A unit test showing that `remaining > 0` produces a failure signal, and a schedule test showing that coverage is at least the largest observed population.
- **Rollback.** Revert.

### F7. Homepage parses 784 kB of moment and moment-timezone

Impact M (mobile parse and compile on the highest-traffic route) · confidence high (measured chunks) · effort M · risk medium (DST and time-zone semantics).

- **Source.** [`homepageGameFormatting.ts:43-60`](../../../web/components/HomePage/homepageGameFormatting.ts#L43) uses `moment.tz.guess()` and `"h:mm A z"`. [`HomepageGamesSection.tsx:13-14,527-531`](../../../web/components/HomePage/HomepageGamesSection.tsx#L527) has the `America/New_York` opening-night logic, and [`pages/index.tsx:9-10`](../../../web/pages/index.tsx#L9) imports moment and moment-timezone.
- **Evidence (measured).** The route carries a 725 kB raw / 33 kB gz zone-data chunk plus 59 kB / 19 kB of moment core.
- **Change.** Use `Intl.DateTimeFormat` or the existing `date-fns-tz` dependency in the client homepage components only. Server code can stay as it is.
- **Acceptance.**
  - Parity tests across 2026-11-01 and 2027-03-14 for New York, Los Angeles and London.
  - US abbreviations (EDT/EST/PDT/PST) match.
  - The non-US zone abbreviation policy is decided explicitly, because Intl prints `GMT+1` where moment prints `CET`.
  - The homepage route-only JS falls by ≥ 45 kB gz.
- **Rollback.** Revert.

### F8. Large route bundles without attribution

Impact M · confidence medium (sizes measured, causes not) · effort M · risk low.

- **Evidence.** `/draft-dashboard` is 648 kB First Load JS with a single 178 kB gz page chunk. `/wigoCharts` is 540 kB, `/stats/team/[abbr]` 504 kB and `/trends` 502 kB. The chart.js (52 kB gz) and recharts/d3 (73 kB gz) chunks load eagerly on these routes. Only 7 `dynamic()` calls exist app-wide.
- **Change.** First attribute the draft-dashboard chunk with the M2 esbuild method. Then `dynamic()`-load panels that sit below the fold or behind tabs.
- **Acceptance.** Route-only JS drops by an amount set after attribution, with no behavior change in existing Draft Dashboard tests.

### F9. Tracked artifacts weigh 341 MB at the tip

Impact L–M (every clone, including each Vercel build clone, checks out the whole tip tree) · confidence high (measured) · effort S per candidate · risk low if handled as a reversible untrack.

- **Evidence.** 718 MB tracked tip; `tasks/` is 341 MB. Commit `7f094c8e6` added the 78.6 MB npm `_cacache`. Most large items are **protected or uncertain**, and the security sprint diary states that its artifacts are "intentionally preserved".
- **Change.** Follow the cleanup manifest. Untracking keeps history and local files, and needs no history rewrite. It does not shrink `.git` (1.2 GB).

### F10. Unreviewed 4.9 GB nested repository with unique history

Impact L for runtime, H for data-loss risk if someone "cleans" it · confidence high.

- **Evidence.** `web/.next-codex-reconcile/` is a standalone repo on branch `local-snapshot` with HEAD `6fcfa862` (2026-08-04). That commit is absent from the main repo, and 532 commits are not in its own remote refs. It has a `.vercel/project.json`, 1.4 GB `.next` and 1.1 GB `node_modules`. It is not referenced in any 2026-10-15 cleanup file. It is ignored by git, excluded by Vitest and ignored by the dev watcher.
- **Change.** After approval, fetch `local-snapshot` into the main repo as `refs/heads/archive/next-codex-reconcile-local-snapshot`. Then handle it as a protected checkout under the existing cleanup gates.

### F11. Unused direct dependencies

Impact L (supply-chain surface and install time; no bundle effect) · confidence medium · effort S.

- **Evidence.** formidable, immer, use-immer, json2csv (an alpha), jstat, ml-pca and react-flip-move have no string references anywhere in `web/`. @emotion/\*, graphql, react-transition-group, punycode, hammerjs and minimist are peer, transitive or override needs, so keep them.
- **Change.** Remove them in one manifest and lockfile change, under the dependency-change approval.
- **Acceptance.** `npm ci`, `npx tsc --noEmit` and lint pass, and `npm ls` shows no missing peers.

### F12. Duplicate index example (validates the DB lead, small payoff)

Impact L · confidence high · effort XS · risk low.

- **Evidence.** `idx_baselines_player_date` (6.6 MB) duplicates `player_baselines_pkey` (6.5 MB) column for column, and the planner splits scans 18.5k to 12.0k (measured).
- **Change.** Include it in one reviewed "duplicate indexes" migration, sized per index first. Do not chase the 36 groups individually.

### F13. The documented typecheck command runs out of memory at Node's default heap

Impact L (developer and agent time, false "failure" signals) · confidence high (measured) · effort XS · risk none.

- **Evidence.** While verifying Patch 01, `npx tsc --noEmit` (the command in AGENTS.md) aborted with a heap OOM: exit 134 at about 4.0 GB after 34 s. With `NODE_OPTIONS=--max-old-space-size=8192` it passed in 57 s at a 5.8 GB peak RSS. `npm run build` already sets a 6 GB heap.
- **Change.** Add a `typecheck` script with an explicit heap, or update the AGENTS.md command. This touches the manifest or the instructions, so it needs approval.
- **Acceptance.** The documented command exits 0 on a clean checkout.

## Unverified leads (from a delegated sweep; code shape only)

These were not prioritized, because volume or production `max_rows` effects were not checked one by one:

- **Limits above the 1,000-row cap.** `.limit()` values above 1,000 appear in `lib/projections/queries/skater-queries.ts:331,391,466` (5,000 and 12,000), `lib/player-forecasts/dashboard.ts:37,149,195`, `lib/sustainability/entitySurfaceServer.ts:1147,1244` and `lib/fantasy-projections/readiness.ts:115`. Each is effectively capped at 1,000 unless paged.
- **Client-side unpaged read.** `pages/teamStats/[teamAbbreviation].tsx:161-164` selects `*` from `wgo_team_stats` for a franchise across all seasons, on the client. Verified in code; volume not measured.
- **Swallowed read errors.** `pages/api/v1/start-chart.ts:569,584,642` sends large `.in()` lists and swallows read errors as empty rows, a provenance risk.
- **N+1 count query.** `pages/api/v1/forge/players.ts:160-162` runs a count query per row.

## Corrections to delegated or earlier claims

- **Duplicate cron-report: not supported.** Delegated analysis read the 2026-10-04 snapshot and called `cron-report` double-scheduled. Live pg_cron shows job 234 is **inactive** (data/db-readonly-reads.md R5).
- **Sustainability truncation: latent, not current.** "Players beyond 750 are skipped" is true of the code. With ≤ 400 ids today, nothing is skipped yet.

## Reconciliation with existing evidence

- **`output/page-optimization-audit-20261015.md`**: 12 findings, 78 entries, 354 API candidates.
  - R01 (test files under `pages/api`) is **fixed**: there are 0 test files under `pages/` today.
  - P01 (homepage SSR still has no `Promise.all`), P02 (`lines/index.tsx:77` per-team `getLineCombinations`), P03 (no `Promise.all` in `stats/player/[playerId].tsx`) and P04 (5 `fonts.googleapis` lines in `_document` plus 5 `@import`s in `globals.css`) are **still open** and unchanged. They are not re-measured here.
  - P05 is now **measured and extended** by F1.
  - A01–A06 (accessibility) were not re-reviewed; this audit is cost-focused.
- **Codex task-2 reconciliation** (14 retained, 21 unmatched, 1 duplicate; 87 protected paths; 11.16 GiB): **not redone**, and its protections are kept. It has a gap: `web/.next-codex-reconcile` (F10) is absent from every task-2 file and should join the protected set. "Unmatched does not mean obsolete" applies there too.
- **Commit `7f094c8e6` (about 313 MB under `tasks/`).**
  - The npm `_cacache` measures **78.6 MB in 478 files**, of which 76 MB is `_cacache` and 140 KB is `_logs`.
  - The committed `.npmrc` files are **0 bytes**, so no credentials were committed.
  - The security sprint diary marks the folder "intentionally preserved". The manifest therefore lists it as **uncertain, needing owner sign-off**, not "safe".
- **DB audit leads** (28.8 GiB, 36 duplicate-index groups, 196 unindexed FKs). One duplicate group is confirmed and sized (F12). The cancelled statistics query was not retried. `cron_job_audit` (F4) is a concrete unindexed hot table that the lead list may not cover, because it has no foreign keys.

## Not worth changing (now)

- **Serverless function size.** Median 6.9 MB, max 40 MB (googleapis on one admin route). No route traces `tasks/`, `docs/` or `output/` beyond the intended cron schedule.
- **Yahoo live-draft per-minute cron.** It is suspended in code until 2027-08-01 and returns before any DB call. Removing the schedule saves little and risks forgetting to restore it.
- **The 4.8 MB `nhlscraper-contracts` JSON.** Imported only by one admin route.
- **Draft Dashboard table virtualization.** The table is already paginated at 50 rows ([`ProjectionsTable.tsx:1129`](../../../web/components/DraftDashboard/ProjectionsTable.tsx#L1129)).
- **Consolidating chart.js, recharts and d3.** Route-scoped chunks; a large refactor for small per-route gains. Revisit only with F8 attribution.
- **supabase-js in the shell (about 165 kB raw).** Auth is needed on every page.
- **`web/web/` nested SKO outputs.** Pinned as a historical set by `SKO_OUTPUT_AUTHORITY` and its test.
- **Root one-off scripts** (`check_db.js`, `fix_templates.py` and five others): about 33 KB in total.

## Semantic regression watch (applies to every backlog item)

- **Time zone and DST:** F7, plus F4(a) "today" boundaries, which must use America/New_York as the existing code does.
- **Partial provider data and freshness labeling:** F4(a) must not delay pending-event processing. F6 must surface partial coverage instead of hiding it.
- **Forecast issuance and readback:** F5 changes which h0 cutoff is published. F3 changes historical backtest denominators, so label old results.
- **Identity:** F2 currently drops goalie identities by id order, and the fix must preserve `player_id`/`game_date` ordering.
- **Concurrency:** F4(b) must use `CONCURRENTLY` on a table that is written every minute.
- **Account isolation and scoring and lineup legality:** untouched by Patch 01. The `/db` pages stay behind their existing admin checks.

## Method and limits

- Read-only on source. Three delegated read-only sweeps, each at lower effort than the lead, covered pagination, schedules and client imports. Their key claims were re-verified here, and two were corrected.
- One compile-only isolated build. Six production catalog or sampled reads, each with an 8 s timeout. Zero application HTTP requests, browsers, dev servers or deployments.
- Not measured: Web Vitals, API latency, Vercel usage or billing, query plans, and the full test suite. No monetary savings are claimed.
