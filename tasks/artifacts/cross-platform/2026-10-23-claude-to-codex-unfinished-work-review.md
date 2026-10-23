# Unfinished work review for the 10-23 Codex sprint (Claude → Codex)

- **Snapshot:** 2026-10-23 at about 12:15Z. octoberBranch `86ddf9f58` (6 commits ahead of origin/octoberBranch `782805fee`); origin/master `d4c2632d3` (Release C). The local `master` ref is stale (`457435eb3`), so don't use it as a base.
- **Method:** six read-only sweeps covering your sprint register, FORGE, RSO/in-season/billing, the other product task lists, git state and all 104 diaries. Each item was checked against git and current files. Nothing was edited, committed or fetched, and no production system was touched.
- **Purpose:** inputs for your register (`tasks/artifacts/fhfh-sprint-ledger-2026-10-22/LEDGER.md`). This is not a second register. `LEDGER.md` was last refreshed 10-22 at about 17:15Z (HEAD `b9f993b35`), so it predates Releases A/B/C, R25, `1a9c48975` and `59daabf00`. Reconcile it from section 1 before dispatching.
- IDs here are `CR-*` so they can't clash with yours. Where an item already has a ledger or task ID, it's given in brackets.

## 0. Already in flight: don't dispatch twice

- **The release/integration lane** (owner `01a1637a…`, diary `tasks/diaries/2026-10-23-codex-release-integration.md`) owns:
  - all git refs;
  - the `P07-CORRECTION-LEASE.json` lease on `web/lib/rosterScheduleOptimizer/currentPlanningRead.ts` and `executionAdapter.test.ts`;
  - `migration-authority.json` and the dirty accepted packets.
- **The ledger lane** owns `tasks/artifacts/fhfh-sprint-ledger-2026-10-22/*` and needs a single writer.
- **Reserved, don't touch:**
  - the uncommitted Game Grid redesign: `web/components/GameGrid/**`, `web/e2e/game-grid-previews.spec.ts` and its fixtures (three stacked lanes, see CR-TJ-07);
  - TJ's dev server on :3000.
- **Claude** has no lane running. All Claude sessions are idle. This file is untracked: please commit it with your register update when convenient.

## 1. Register reconciliation (docs only, READY)

| ID | Item | Evidence |
|---|---|---|
| CR-DOC-01 | Mark released: FPI-01..04, 06..08, 11.1–11.3 (A `9d789c372`, B `40b17b572`, C `d4c2632d3`) and FPI-11.4/job 79 (R25 `27751818b`). | `tasks/TASKS/forge-projections/tasks-forge-projection-improvements-2026-10-22.md` release notes |
| CR-DOC-02 | Close the held items. The 13-failure hold is fixed by `1a9c48975` (`current-boundary-tests.json` 340/340). The task 2 goalie-cache hold is fixed by `59daabf00` + `cbb4f6836` (394/394). SITE-ESPN odds 403 is fixed by `fd749a459` (not yet on master; rides the release). Task 3 pilot materialization is superseded by Release C: do not re-query. | RESUME-CHECKPOINT:13, 26, 34-55 |
| CR-DOC-03 | Retire 76 likely-done diaries. 14 of them are oB-only and retire only after the release lands. The list is in section 7. | `tasks/diaries/` |
| CR-DOC-04 | Tick the stale FORGE boxes and fix the stale headers. Main list: header line 8 and 1.0 lease note line 69 are stale; tick 2.0–2.5, 3.0–3.4, 4.2–4.3 and 8.0. Streamlining list: tick parents 1.0/2.0/3.0/7.0. Also `tasks-goalie-forge.md:94` NEW 10.0 and start-chart NEW 19.0 (`b47c512fb`). | FORGE sweep |
| CR-DOC-05 | Mark superseded, don't dispatch: `tasks/tasks-prd-rso.md`, `tasks/tasks-prd-roster-schedule-optimizer.md` FE rows (FE-07b targets the deleted `planComparison.ts`), compact-layout 8.2 (TJ ran it on real data on 10-22), and game-grid PRD 1.0–3.3 / 5.1 and execution 16.x (on master since 10-09/10-12). | RSO and other sweeps |
| CR-DOC-06 | Cron rows to close: cron-email NEW 12.0, NST-CATCHUP-21S (superseded by job 79 retirement and `/db/runner`), DRM NEW 86.0 (only a natural-run read remains). Super-goal 5.3 (L492) and 5.3.4 (L496) can roll up. | other sweep |
| CR-DOC-07 | WiGO checkbox reconciliation. `tasks/tasks-README.md:160-202` records 7.x, 9–12, 2.x and 3.x as done and shipped in `26f04ef88`, but the boxes are still unchecked. Rows 13.2–13.4, 13.7 and 17.x moved to IST-D 4.0–4.2. | ledger sweep |
| CR-DOC-08 | Re-point the RSO completion checklist. 1.1/1.4/1.5/1.7 now live in FORGE lanes; 3.x moved to the FORGE improvements list. Re-home the IST trust/clarity residuals (last edited 10-03). | RSO sweep |

## 2. TJ decisions that unblock the most work (ask first)

| ID | Decision | Why it matters |
|---|---|---|
| CR-TJ-01 [MASTER-D4] | Hosted apply of migration 89, then 90 (Data API grants), **before 2026-10-30**. | Supabase stops auto-granting on 10-30. The local replay is BLOCKED in the Codex sandbox (`initdb` shmget denied) and needs an unsandboxed Postgres, e.g. a Claude lane. Reconcile the harness chain check with 99 registry entries. Confirm whether the file versions need renumbering after hosted head `20261022181002`. |
| CR-TJ-02 [REL-1] | Approve the sandbox billing SQL relocation (`20261021210000` out of `supabase/migrations`). | Committed HEAD fails `supportedBaselineMigration.test.ts` (100 files vs 99 rows). The uncommitted relocation is accepted and byte-identical. |
| CR-TJ-03 [REL-2] | Yahoo goalie marks (`9a9c914f5`): badge only, or server-side apply with a same-day freshness check. | Your P07 correction already removes the forecast effect (73/73 fixed). Option (b) adds one Yahoo roster read per data request. Update the e2e goalie case to match whichever is chosen. |
| CR-TJ-04 [REL-3/PAID-SYNC] | Ship the paid-sync paywall gated, add a kill flag, or exclude those paths from the release. | Once shipped, free Yahoo/Fantrax sync stops working, and production billing is rejected, so there is no purchase path. `InSeasonPanel` would show $4.99/$24.99 with disabled buttons. |
| CR-TJ-05 | FORGE gate approvals (production GETs, about 7.5k per variant, per-gate). In priority order: PPP + compression as one variant (CR-FORGE-01/02); a HIT/BLK lever (CR-FORGE-05); ES dilution (CR-FORGE-06). | These are the only model levers left. Build on master `d4c2632d3` + `0dd535e0d`, not on octoberBranch's `skater-stage.ts`, which still carries HOLD code. |
| CR-TJ-06 | Disposition of the HOLD FORGE commits (`65fc4b9ee`, `07c7f71af`, `f0ab2b9fd`, `e316db4c0`, skater part of `6e14053ff`): revert, or keep behind flags. Also keep or discard the untracked skater-candidate research (`web/lib/projections/research/skater-candidates/`, `scripts/forge-assist-export*`, `*ablation*`). | They make octoberBranch's `skater-stage.ts` differ from master by about 278 lines, so every model release has to carve around them. The untracked ablation script reportedly breaks a full-tree tsc. |
| CR-TJ-07 | Review the uncommitted Game Grid redesign: codex ui-corrections, codex opportunity/lag fix and claude side-columns polish, about +1.2k/−1.1k plus 8 new files. | Highest collision hotspot; nothing is pinned. |
| CR-TJ-08 | Release timing for `0dd535e0d` (k re-fit): ship alone or with the next variant. Avoid splitting the first Release C ledger week (10-23..10-30). | FORGE sweep |

## 3. READY queue (no approval needed)

The "Owner/lease" column says who must sequence it.

### Release-adjacent (sequence through the release lane)
| ID | Outcome | Files | Accept | Owner/lease |
|---|---|---|---|---|
| CR-REL-01 | Commit the accepted, still-uncommitted packets as one unit: P01 calendar, P02+R1, P04 prefetch, P05 R1 + pickup expiry, S08 (+ untracked `__tests__/pages/statsGame.test.tsx`, `PlayerGoalieSummaries.test.tsx`), Luna R1. Add the billing relocation after CR-TJ-02. | 21 web files (see WP:17-21) | Hashes match `sprint-integration-checkpoint-2026-10-22/CANDIDATE-PINS.json`; named tests pass | release lane |
| CR-REL-02 | Include in the next master release: draft-ranker homepage hide gate (`cc3be5c09`, `pages/index.tsx` `&& isOffseason`), cron briefing `fd749a459`, CTPI de-dup fix (prod CTPI still failing), NST step resume on by default (master still has `enabled: false` at `run-rolling-forge-pipeline.ts:429`), D2 WGO goalie dates `88a1282d7`, `goalie-power.ts` PAGE_SIZE, `rebuild-baselines` partialWrite, NST team-daily deadline. | various | each file byte-identical on master after release | release lane |
| CR-REL-03 | Untrack the committed dependency cache (478 files under `approved-dependency-audit/cache/`), tracked `output/**` and 9 `supabase/.temp` files (NEW 127.0). No history rewrite. | `.gitignore` + `git rm --cached` | clean status, nothing lost | release lane |
| CR-REL-04 | Browser acceptance for P07, task 10 and P04: desktop and mobile screenshots of slot-grid "—"/partial states and if-starts values. | e2e | screenshots + receipt | **Claude lane.** Codex Chromium fails with MachPort 1100; Claude's Playwright works with `PLAYWRIGHT_ISOLATED_NEXT=1` on :3100 |

### RSO / in-season
| ID | Outcome | Files | Accept |
|---|---|---|---|
| CR-RSO-01 | A healthy player in IR gets one message, not two (drop notice + IR alert). Suppress the drop-notice reserve line and chip title for `healthyReserves` players. Keep both for injured players without IR eligibility and for manual rosters. | `RosterScheduleOptimizer.tsx:1039-1046`, `lineupGaps.ts:83-87` | lineupGaps / HealthyReserveAlert / RSO tests show exactly one message |
| CR-RSO-02 | e2e data-route mocks echo the current-read nonce and `evaluatedAt`, so projected points render under P07. | `web/e2e/roster-schedule-optimizer.spec.ts` + fixtures | nonzero points; withheld on nonce mismatch |
| CR-RSO-03 [P07-DEF-1] | Carry the issued `codeVersion` on the participation receipt and in the save schema. | `planningContributions.ts`, `rsoUsePolicy.ts`, `in-season/workspaceSchema.ts` | `planningReproducibility.test.ts:179` `it.fails` becomes a passing test (P07 owner) |
| CR-RSO-04 | Delete the unreferenced `web/hooks/candidateMetrics.worker.ts`. If CR-TJ-03 = badge only, `providerGoalieStarts.ts` becomes test-only. | — | `rg` shows no consumers; tsc passes |
| CR-RSO-05 | Healthy-IR follow-ups: a "DTD in IR+, may play" note; an activation plan step; current-period locks in weekly leagues. | `healthyReserves.ts`, `planningTypes.ts`, `HealthyReserveAlert.tsx` | unit cases (`executionAdapter.ts` is leased; sequence) |
| CR-RSO-06 | Tick CHK-2.4 (owned-roster optimization) after confirming the games-vs-points text. | checklist :41 | tick or recorded gap |
| CR-BILL-01 | A cancellation request keeps its ID across page reload; sign-out or owner change clears it. | `InSeasonPanel.tsx` + test | lost response + reload → same ID |
| CR-BILL-02 | Offline test matrix for the next service verification: payment response lost, decline recovery, draft cleanup, refund/dispute readback. Includes the draft owner-lookup RPC (`subscriptions.ts:20`). | `tasks/artifacts/in-season-billing-2026-10-21/` | disposable-Postgres receipt (running it live is NEEDS-TJ) |

### FORGE (offline)
| ID | Outcome | Files | Accept |
|---|---|---|---|
| CR-FORGE-06a | Diagnose ES dilution offline from the existing captures: about 2 non-dressed projected skaters per team take ES TOI and shot share before `reconcileTeamToPlayers`. Captures (12 GB) are in volatile `/private/tmp/.../d6739ede.../scratchpad/recon`; `run-captures-v.sh:6` hard-codes that root. | `skater-stage.ts` (read), new analysis | a diagnosis note sized for the CR-TJ-05 gate |
| CR-FORGE-13 | 7.3 remainder: move the xG `teamWinProbability` out of the bridge into the ledger snapshot as an explicitly **naive** control. Don't switch the control to FORGE's win model: it would no longer be naive. | `forgeDailyBridge.ts:168-171`, `forge-served-forecast-snapshot.ts:9,76-77` | bridge no longer exports it; naive values byte-identical |
| CR-FORGE-16 | Add the missing `lib/projections/reconcile.test.ts`. | test only | Σ player TOI/shots per strength = team targets |
| CR-FORGE-15 | Prepare the season-current prior refresh script (reuse `forge-priors-2026-10-22/priors-aggregate.sql` + `derive.py`). Running it is NEEDS-TJ. | scripts | dry output shape |
| CR-OPS-01 | Cron report wording for `stage_killed` / `attempts_exhausted`, and the NST "incomplete → continued" classification Claude handed over. | `pages/api/v1/db/cron-report.ts`, `CronAuditEmail.tsx` (`fd749a459` touched it) | fixture-driven report test |
| CR-OPS-02 | NST progress read: the 10-22 14:02 run failed with "NST explicit progress read is unconfirmed" (`update-nst-gamelog.ts:2697`). That is the real evidence the held index/progress-read proposal waited for. | NST lane files | Codex NST lane; NST limits 40/1m, 80/5m, 100/15m, 180/h |
| CR-OPS-03 | Audit-qualify `yahoo-live-draft` and `update-drafted-prospects` (cron NEW 7.0). | those routes + `cron-audit-wrappers.test.ts` | inventory test updated |
| CR-OPS-04 | Barometer NEW 18.0: add a finalize step (distribution, quintiles, drift are only written when `runAll` is set), and make health show partial snapshots. Scheduling it is NEEDS-TJ. | `sustainability/rebuild-score.ts:61-69,147`, `internal/sustainability/health.ts` | unit test |

### Stats / site
| ID | Outcome | Notes |
|---|---|---|
| CR-STATS-01 [P05] | Persisted RSO ownership aging + real browser check. | after CR-REL-01 |
| CR-STATS-02 [P06/S06] | Lines and Shot Map tabs. Keep line normalization separate from the Shot Map slice; inactive tabs make no reads. | A9 committed |
| CR-STATS-03 [P02] | Goalie QS/time/numeric-TOI typed contract, or a precise unavailable-field blocker. Don't invent starts. | after CR-REL-01 |
| CR-STATS-04 [P01] | Zero-score display and RW/ROW. Finality/OT and WGO grain are NEEDS-TJ (source authority). | |
| CR-STATS-05 [P03/S08] | H2H timezone fixture. | S11 needs scoping |
| CR-STATS-06 | S05 (after S02 cohort), S07. | S12–S14 chain after S07 |
| CR-SITE-01 [NEW20] | Amend the start-chart contract/docs to match shipped behaviour (`start-chart.tsx:53` limit 5, `startChartFantasyScoring.ts:60` categoryMode, `perfBudget.ts:18` 300_000), or ask TJ to restore it. | |
| CR-SITE-02 [SITE-NPM] | Read-only reachability triage. Upgrades (next 15.5.22 → 15.5.28, axios, vitest 4 major) are NEEDS-TJ. | |
| CR-SITE-03 | WiGO workflow links: wire `getWigoSurfaceLinks` into `web/pages/wigoCharts.tsx` (it has no consumers today). | render test |
| CR-SITE-04 | WiGO local remainder rows (`tasks/tasks-README.md` 1.2, 1.4–1.7, 2.x, 3.x, 5.2–5.4, 8.1/8.4/8.5, 10–12, 13.1/13.5/13.6, 14.x, 15.x, 16.2–16.5, 18.x, 19.x, 20.x). | no WiGO files dirty |
| CR-SITE-05 | SKO: two interpretation cores. `web/lib/sko/gap.ts` has zero consumers; `skoElement` is used by BLSH and the preview. Port or retire its 19 cases and record the decision. | |
| CR-SITE-06 | SKO/BLSH fixture mechanics (`tasks-prd-sko-element.md:44,51,55,60,61`; `tasks-prd-buy-low-sell-high.md:27,33`), then the milestone receipt (screenshots of `/sko-element/preview` and `/buy-low-sell-high/preview` on an isolated server + independent review). | add-only dirs |
| CR-SITE-07 | Run `web/e2e/social-share.spec.ts` on an isolated server. | |
| CR-SITE-08 | PlayerPickupTable raw colours (`PlayerPickupTable.module.scss:1748-1763`). | after P05 commit |
| CR-SITE-09 | Hockey-update classification 3.1/3.2/6.2/6.3/7.1. Reconcile against `a9359ab33`, `8aa26a299` and `90ae40f01` first. | needs a file lease (Luna/IFTTT overlap) |
| CR-SITE-10 | IFTTT review-sidecar recovery re-review: reproduce 41/41 + scoped tsc against `source-pins.json`. | read-only |
| CR-SEC-01 | Draft (don't apply) the browser-role grant gaps that D4 migration 90 doesn't cover: `user_entitlements`, `user_provider_preferences`, and INSERT/UPDATE/DELETE/TRUNCATE for anon/authenticated on `entity_metric_rankings`, `metric_definitions`, `skater_composite_ratings`. | disposable-Postgres harness |

## 4. NEEDS-TJ (beyond section 2)

- **FORGE production / time-gated:**
  - The Release C ledger week: 7 settled days around **10-30** (not 10-29). Then the FP audit Q3/Q4 and Q5/Q6. Split by run `git_sha` and record the Release C baseline (the "R23 baseline" wording is stale).
  - The early-season rolling refresh 09-29..10-06 on `/db/runner`, then rerun row identity (about 1k GETs).
  - Release of 6.3 market ledger (`64b6bb8db`, `6f2f3ac58`; migration 99 is applied but master has no market code).
  - Task 1.2 F/D + TOI slices (migration).
  - Task 9 per-effect gates.
  - 6.4 team-goal market blend.
  - 11.5 disk (40 GB provisioned, about 26 GB used).
  - Task 5 SH/PK (deferred; needs native goal accounting ES+PP+PK).
- **Data owned by Codex:**
  - Decimal odds stored in `price_american` (veikkaus/tipsport). The code fix is READY; repairing rows is NEEDS-TJ.
  - Empty `prop_market_prices_daily` (needs a provider/cost choice).
  - About 250k season-mistagged `wgo_skater_stats` rows.
  - `wgo_goalie_stats` 20252026 includes playoffs. Check `forge-goalie-backtest.ts` before any goalie re-fit.
- **Migrations and ledger drift:** a read-only hosted `list_migrations` reconciliation for orders 76 and 80–82 (`20260927104934` unknown-but-applied, `20261011115124` applied as `20261019172738`, `read_forge_game_revisions` version drift, `20261011160000` unknown). Then 88 (kept off), D4-SCHEDULE-RPC (`commit_recurring_roster_schedule` is defined in no migration), A3/A4 ledger universe storage, game-line snapshots order 78. Apply one at a time; never `supabase db push`.
- **RSO real-account:** acceptance A1–A11 (all open; the 10-12..10-18 window expired), Yahoo rules (`rosterPlanning.ts:576` returns `rules: false`), the goalie credited minimum, the drop policy when one player is unprojected, the empty P07 review catalog (no native numeric use until targets are reviewed), and the commercial terms (package name, first-100 cohort, legacy $5.99 grants, tax/legal).
- **Billing:** a read-only outcome check of the pending $1 sandbox refund (never resubmit); the live gates (worker host, reviewed production schema, catalog, credentials, webhook).
- **Ops:**
  - Natural-run receipts: PIPE-NATURAL (first natural settlement 10-23 11:00Z), sustainability chain, cron C0076, DRM.
  - The cron 3:00 AM floor (13 schedules; refresh the list after job 79).
  - The NST four-window ledger design (cross-job ledger is a `tmpdir()` file).
  - Prediction forecast cron (no model rows in production) and xG scheduling.
  - Rankings cost model; CTPI candidate activation; Three Pillars live props (`PARLAY_API_KEY` absent).
  - The 105-row WGO label correction (unauthorized).
- **Credentials and auth (agents must not act):** rotations (Supabase service role, Yahoo, Resend, DB, Google), the legacy mailbox, PKCE completion, and IFTTT `?secret=` query auth (waits on key retirement).
- **Product:**
  - SKO/BLSH decisions: route/slug, thresholds, F/D IPP source, live adapter owner.
  - Social-share rights R1/R2 and O1–O4.
  - Draft Pro operator checklist (some rows probably stale since the 10-19 approvals).
  - WiGO live validations / aggregate republish (9-19 found `l5_g_per_60` 60× too small).
  - TR 8.3 defense PP vs PK.
  - Repository-audit owner decisions (11 docs, `fetchWGOskaterStats.js` active or not).

## 5. BLOCKED

- **D4 local replay:** Codex sandbox shmget → run in a Claude lane.
- **GDL/IFTTT key retirement:** IFTTT support case open since 07-21. The GDL applet repair waits behind it.
- **P07 catalog → native activation → RSO planner genuine acceptance (5.x), beta (10.x), weekly (11.x).**
- **SKO live integration:** waits on CR-SITE-06 + decisions. Releases A/B/C may now satisfy the "shared forecast release" prerequisite, so re-check SKO 7.1.
- **Game Grid 4.x / S-14 adapter in UI:** needs qualified as-of history, market permissions and native serving.
- **Sustainability model backtest:** no historical coverage until the ledger matures.

## 6. Collision hotspots

1. `web/components/GameGrid/**`, `e2e/game-grid-previews*`: three uncommitted lanes, reserved.
2. `currentPlanningRead.ts`, `executionAdapter.test.ts`, `planning.ts`, `planningTypes.ts`, `integrations/yahoo/rosterPlanning.ts`: P07 lease, R2/task 10/goalie marks.
3. The billing migration chain: `supabase/migrations/20261021210000…`, `monthlyIntegration.test.ts`, `supportedBaselineMigration.test.ts`, `migration-authority.json`.
4. FORGE model files: `skater-adjustments.ts`, `skater-stage.ts`, `projection-weights.ts`, `runProjectionV2.test.ts` (HOLD commits + `0dd535e0d` + master's Release C port + untracked research).
5. Sprint ledger and diaries: docs only, single writer.

Shared-state hazards:
- Large untracked binaries (`forge-task2` 106 MB, `sprint-integration-checkpoint` 27 MB, `combined-audit-nst/fixed-source.tar.gz` 11 MB) mean **no `git add -A`**.
- About 125 untracked SQL proposal/review copies under `tasks/` look like migrations but aren't.

## 7. Diaries recommended for retirement (likely done, with evidence in the diary sweep)

**Retire now:**
- 10-20: claude-chef-orchestrator, claude-forge-f1, claude-forge-reliability, claude-native-v2, claude-player-page, claude-rso-ownership-evidence, claude-rso-r5-r8, claude-rso-r6, claude-schedule-cron, codex-cron-report, codex-d1-policy, codex-d1, codex-d2, codex-d4, codex-i1, codex-luna-identity-offline, codex-nst-date, codex-ops-memos, codex-orchestrator, codex-research-kits, codex-wgo-skater-startdate-query.
- 10-21: claude-capture-compute-only, claude-forge-pipeline-repair, claude-forge-projection-audit, claude-pipeline-sources, claude-rso-drop-chip, claude-served-ledger-s-b1, claude-sg-rolling-column-drop, claude-wb-rolling-correctness, claude-wc-q12-q14-pipeline-hygiene.
- 10-22:
  - claude-research-sportsbook-props, codex-research-backlog-readiness;
  - the a5-a10 and a7-a9 independent reviews; codex-a5-a10-yahoo, codex-a7-a9-stats;
  - codex-billing-migration-relocation-review, codex-claude-audit-fix-queue;
  - codex-ctpi-independent-review, codex-d4-harness-independent-review;
  - the forge-ledger-lease, forge-task1, task2 and job79 reviews; codex-forge-task2-hydration-physical; codex-fpi-11-4-job79;
  - the luna-application-contracts, luna-contract-review, luna-dated-contracts and luna-ifttt-readiness diaries; nst-continuation-review; nst-review-fixture-types;
  - the p01 calendar and date-identity reviews, plus p01-calendar-points;
  - p02-goalie-review, p03-timeline-review, p03-timeline-xg, p04-search-review;
  - the p07 architecture, r1, r2 and task10 reviews;
  - codex-paired-forecast-scoreboard, s08-review.

**Retire after the release lands (oB-only):** 10-20 codex-draft-status, codex-f10, codex-f9; 10-21 claude-stats-load-time, claude-stats-s01, codex-provider-sync-paywall; 10-22 claude-cron-briefing-fixes, codex-ctpi-duplicate-upsert-audit, codex-p07-rso-use-policy, codex-task10-display.

**Keep open:**
- Release, ledger, D4 grants and readiness, in-season billing, audit-fixes, daily-pipeline evidence, skater candidates, the three Game Grid lanes, wgo-labels.
- The accepted-but-uncommitted packets (p01-calendar-semantics, p02-goalie-correctness, p04-search, p05-ownership, p05-pickup, s08-game-route, luna-r1-slot-fix, billing-migration-authority, draft-ranker-homepage).
- claude-yahoo-goalie-starting-status, plus the six Claude 10-21/10-22 lane diaries until CR-DOC-04 is done.

## Sprint rules worth restating to every worker

- **External actions:** no production writes, migrations, cron/env changes, deploys or credential handling without TJ's explicit approval. Production reads for gates need per-gate approval.
- **Data limits:** NST windows 40/1m, 80/5m, 100/15m, 180/h. Never commit TJ's league evidence. No Yahoo transactions.
- **Local testing:** never set `GIT_DIR` in test runs. A second `next dev` must use `PLAYWRIGHT_ISOLATED_NEXT=1` (never :3000/:3105). Run the CSS Modules pure-selector check after any `.module.scss` edit.
- **Commits:** commit with explicit pathspecs only. Never use `git add -A`.
- **Builds:** run tsc under `lockf /private/tmp/fhfh-heavy.lock` with `NODE_OPTIONS=--max-old-space-size=10240`.
- **UI:** page workspaces stay at most 90% wide.
