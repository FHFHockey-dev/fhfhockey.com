# FORGE projection improvements: research, FP audit and streamlining leftovers (2026-10-22)

**Sources** (in place of a PRD):
- `tasks/artifacts/deep-research/reports/NHL player projection best practices.md`: the gap checklist and P0–P3 recommendations.
- `tasks/artifacts/fantasy-point-audit-2026-10-22/REPORT.md`: findings F1–F10 and production Appendix C.
- The open items of `tasks-forge-projection-audit-streamlining-2026-10-21.md`.

**Status:** list only. No code, database or cron work has started. Each task starts only when TJ assigns it.

## Relevant Files

- `web/lib/projections/stages/skater-stage.ts`: skater heads, priors, hit/block fallbacks, assists (tasks 2–5, 9).
- `web/lib/projections/calculators/skater-adjustments.ts`: conversion and assist rates, shrinkage (tasks 3–5).
- `web/lib/projections/queries/skater-queries.ts`: history hydration (task 2). **Pinned by Codex P08.**
- `web/lib/projections/goalieModel.ts`, `web/lib/projections/stages/goalie-stage.ts`: save %, wins and shutouts (task 7).
- `web/lib/projections/uncertainty.ts`: Poisson quantiles to replace (task 8).
- `web/lib/projections/utils/market-output-builders.ts`: mean-versus-line flags (task 6).
- `web/scripts/forge-reconstruction-backtest.ts`, `web/scripts/forge-counterfactual-backtest.ts`, `web/scripts/capture-forge-reconstruction.ts`: the frozen-cohort gate for every model change.
- `web/lib/player-forecasts/servedForecastLedger.ts`, `web/pages/api/v1/forge/scoreboard.ts`: the paired scoreboard (task 1). **Pinned by Codex P08.**
- `web/lib/rosterScheduleData/forgeDailyBridge.ts`: the duplicate win model (task 7). **Pinned by Codex P08.**
- `web/components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx`, `SlotWeekGrid.tsx`: display findings F7/F8 (task 10). Codex P07 has uncommitted RSO planning edits next to these.
- `supabase/migrations/20261020211500_forge_league_skater_physical_totals.sql`: migration 88, the league physical totals RPC (task 2).
- `web/pages/api/v1/db/run-projection-v2.ts`, `web/lib/projections/run-forge-projections.ts`: the finalization overrun (task 11).
- `web/lib/routeRunner/registry.ts`, `web/lib/routeRunner/options.ts`: runner follow-ups (task 11).

### Notes

- **Gate for every model change:** a frozen-cohort reconstruction backtest scored on bias, RMSE and forecast-binned decile calibration per head (G, A, PPP, SOG, HIT, BLK, FP), never MAE alone. That's the existing harness and TJ's 10-21 gate rule. After the change ships, confirm it on the served-forecast ledger (dressed only).
- **Collision map (Codex sprint, 2026-10-22).** Before starting a task, re-read `tasks/artifacts/fhfh-sprint-ledger-2026-10-22/WORK-PACKETS.md` and `BATCH-SOURCE-PINS.json`.
  - **Pinned by Codex P08 (FORGE producers):**
    - `skater-queries.ts` (+test);
    - `servedForecastLedger.ts` (+test), `scoreboard.ts`, `forge-served-forecast-snapshot.ts`, `forge-served-forecast-settle.ts`;
    - `forgeDailyBridge.ts` (+test);
    - `run-rolling-forge-pipeline.ts`, `projectionPipelineState.ts`;
    - `update-nst-gamelog.ts` and `lib/nst/*`.
  - **Pinned by Codex P07 (approval boundary), uncommitted in the tree now:**
    - `lib/rosterScheduleData/planning*.ts`;
    - `lib/rosterScheduleOptimizer/planning*.ts`;
    - `lib/player-forecasts/{planningContributions,gameExpectationReader,rsoUsePolicy,contributions,sourceSnapshot}.ts`;
    - `lib/integrations/yahoo/rosterPlanning.ts`;
    - `pages/api/v1/roster-schedule-optimizer/data.ts`;
    - `lib/projections/{consumerRevisionAdmission,calibrationEligibility,evidenceTime,gameRevisions,issuedContext,starterBoardScoring}.ts`.
  - **Not pinned by Codex:** `skater-stage.ts`, `skater-adjustments.ts`, `goalieModel.ts`, `goalie-stage.ts`, `uncertainty.ts`, `market-output-builders.ts`, the backtest scripts, `run-projection-v2.ts`, `run-forge-projections.ts`, `lib/routeRunner/*`.
  - **The FORGE audit session** (`local_f4058d3f`, idle since 10-21 23:50Z) last held the hydration + F3/F4 port (export "c"). Hand that lane to whoever takes task 2.
- **Leases:**
  - **Only one worker edits `skater-stage.ts` at a time.** Tasks 2–5 and 9 all touch it, so they're sequenced: 2 first, then 3 and 4 (the order is TJ's call), then 5 and 9.
  - **Tasks 1, 6, 7, 8 and 11 own separate files** and can run beside the `skater-stage.ts` lane once their Codex pins clear.
- **Release path:** releases go out as master candidates (commit-tree, gate in a clean export, TJ approves the push), never octoberBranch → master. FORGE select changes must update the offline fixture `scripts/fixtures/native-player-offline-synthetic.json` and its checksum.
- **Tests:** `npm test -- <file>` from `web/`; `npx tsc --noEmit` under the shared heavy lock; `npm run lint` on changed files.

## Tasks

- [ ] 1.0 Make the served-forecast ledger the standing gate (research P1; FP audit F10). **Waits on the Codex P08 lease** for the ledger and scoreboard files.
  - [ ] 1.1 Pair the scoreboard by player-game across sources (bridge exact and re-aimed, naive last-5 and season), instead of comparing unpaired samples.
  - [ ] 1.2 Report dressed-only FP and per-head bias, Σactual/Σpredicted by **expected-FP** decile × position (F/D/G) × head, RMSE skill versus naive, the Mincer–Zarnowitz slope, and an opportunity-versus-rate split (TOI and PP TOI versus per-60).
  - [ ] 1.3 Add Brier/reliability bins for goalie start, win and shutout.
  - [ ] 1.4 Run FP audit Q3/Q4 once about a week of settled games exists (around 2026-10-29), each with TJ's approval. Record the R23 baseline that tasks 2–5 are gated against.

- [ ] 2.0 Ship history hydration together with the F/D-prior hits/blocks model (research P0; FP audit F3). It needs `skater-queries.ts` (**Codex P08 lease**) and `skater-stage.ts`.
  - [ ] 2.1 Resume the audit session's export "c": master plus hydration `6767073ea`, plus the F3/F4 hits/blocks hunks (`b8fe1072e` FORGE parts and `34a5588db`), on current master (R23).
  - [ ] 2.2 Decide with TJ whether to apply migration 88 (league skater physical totals) first. Without it F4 runs without the league rescale.
  - [ ] 2.3 Rerun the 62-game reconstruction backtest for variant "c" on post-R19 inputs. Clear the release only if FP, HIT and SOG bias and the top-decile ratios are back within ±10%.
  - [ ] 2.4 Bring S-F (streamlining task 3.0) to full: the RPC reader with sidecar hydration replaces S-F-lite. Update the offline fixture and checksum.
  - [ ] 2.5 Run streamlining 7.5 as this release's verification: a row-identical recompute for 20 players × 5 strengths, plus the rankings and trends tests.
  - [ ] 2.6 Release with TJ's approval, then rerun FP audit Q5/Q6 to confirm zero hit/block projections stay below 10%.

- [ ] 3.0 Rebuild assists and PPP on on-ice goals × point share (research P0; FP audit F2 and F4). Waits for task 2 because of the `skater-stage.ts` lease.
  - [ ] 3.1 Measure in-house IPP baselines (ES and PP, F and D) from `nst_gamelog_*_oi` on-ice goals versus individual points for 2023-24 onward, and shrinkage k by split-half. Read-only, run once with TJ's approval.
  - [ ] 3.2 Model assists as team on-ice goals (by strength) × the player's assist share, shrunk to F/D priors. Remove the 0.4–3.4 assist-per-goal clamp and the per-two-goals PP scale.
  - [ ] 3.3 Reconcile Σ team assists / Σ team goals to the observed ES and PP ratios (~1.8 PP A per PP G).
  - [ ] 3.4 Backtest A and PPP bias, RMSE and top decile by position (defencemen separately). Clear only if top-decile PPP is not over-predicted (the pp2 failure mode).
  - [ ] 3.5 Release with TJ's approval. Confirm PP A per PP G ≈ 1.8 on production rows (FP audit Q6).

- [ ] 4.0 Position-specific, season-current priors (research P2; FP audit F1: forwards ×1.48, D ×0.94). Waits for task 2.
  - [ ] 4.1 Fit F and D priors for ES and PP SOG/60 and shooting %, re-estimated each season from the current season to date. Fit the stat-specific k by split-half.
  - [ ] 4.2 Retest removing the second conversion shrink (Q7) on hydrated inputs.
  - [ ] 4.3 Backtest G and SOG by position. Target an MZ slope near 1, flat decile ratios, and fewer D in the top FP decile.

- [ ] 5.0 Shorthanded points and PK minutes (FP audit F5: about −0.04 FP per game; TJ's other league scores SHP). Waits for task 2.
  - [ ] 5.1 Add SH goals and assists as shrunk season-rate terms to G and A, with PK TOI allocated per player instead of folded into ES.
  - [ ] 5.2 Backtest G/A bias for PK-heavy players. Release with the next model batch.

- [ ] 6.0 Market probabilities instead of mean-versus-line flags (research P1). Owns `market-output-builders.ts`, which Codex hasn't pinned.
  - [ ] 6.1 Compute P(over line) from the model distribution, using task 8's distributions when ready and Poisson until then.
  - [ ] 6.2 De-vig the stored prices (Shin, or equal-margin for "Yes"-only markets) and flag edges in probability space.
  - [ ] 6.3 Add a `market` source to the ledger (waits on task 1's lease). Score model versus market Brier on closing lines.
  - [ ] 6.4 Separate follow-up for TJ to decide: blend team goals with de-vigged implied team totals (research P1 team reconciliation, size L).

- [ ] 7.0 Goalie model: save %, wins and shutouts (research P2; FP audit F6). Owns `goalieModel.ts` and `goalie-stage.ts`. Retiring the bridge win model waits on the Codex P08 lease.
  - [ ] 7.1 Model save % as one beta-binomial over all evidence, with k fitted (expect 3,000–11,000 shots) toward the season-current league or tier mean. Drop the 300-shot recency layer. B2B −0.005 to −0.010.
  - [ ] 7.2 Make wins three-outcome and normalized per game: both teams' win probabilities sum to about 1. Use the de-vigged moneyline when present; otherwise a calibrated model × P(start) × P(not pulled).
  - [ ] 7.3 Retire the bridge's separate Poisson-xG win model, so one win model serves.
  - [ ] 7.4 Derive shutouts from a shots-against mixture. Validate with Brier and reliability over the ledger.

- [ ] 8.0 Count distributions (research P2). Owns `uncertainty.ts`.
  - [ ] 8.1 Fit negative-binomial dispersion α per stat × position for shots, hits, blocks and saves, compounded with TOI uncertainty.
  - [ ] 8.2 Serve the mean, P(≥k) and quantiles. Score RPS, log score and PIT against the current Poisson.

- [ ] 9.0 Context terms sized to evidence (research P3; FP audit F9). Waits for tasks 2–4 (the `skater-stage.ts` lease).
  - [ ] 9.1 Give each context effect a single owner: home ±4% at team level, rest about 3–4%, opponent goalie GSAx shrunk and damped 50%. Do not ship Q8 as written.
  - [ ] 9.2 Express role stability as uncertainty, not a cut to the mean (F9).
  - [ ] 9.3 Run per-effect toggle backtests, checking SOG decile ratios.
  - [ ] 9.4 Later: rink-adjusted hits and blocks; an aging curve and rookie prior; news-tier snapshots with a label → P(start) mapping fitted from history.

- [ ] 10.0 RSO display fixes (FP audit F7 and F8). The RSO component files sit next to Codex P07's uncommitted planning edits, so start only after P07 lands.
  - [ ] 10.1 Show "—" or a partial flag when a weighted stat key is missing, instead of summing the known keys (F7).
  - [ ] 10.2 Show goalie "if starts" FP beside the expected value (F8).

- [ ] 11.0 Operations follow-ups from 2026-10-22. They're independent of each other and of tasks 1–10.
  - [ ] 11.1 `run-projection-v2` overran its 210 s budget during finalization (504 at about 3¾ min). This stranded a run until the lease expiry plus the 2-minute takeover grace. Measure post-game finalization time, and make the budget cover finalization or checkpoint before it.
  - [ ] 11.2 Add `run-projection-v2` (single date) to the route runner allowlist with a resume contract: 207 replays the same query, and `run_in_progress_elsewhere` waits about 2.5 min. Then production reruns never need the console.
  - [ ] 11.3 Route runner: surface rolling HTTP 422 freshness blocks as "blocked" with a one-click re-queue that adds `bypassFreshnessBlockers=true` and `resumeFrom`, instead of a plain failure.
  - [ ] 11.4 Hand to Codex (already in the job 79 note):
    - release the job 79 constant and `cron-schedule.md` records with the advisory burst clearance (`e89dfdde5`);
    - consider an index or narrower filter for the NST progress read on `cron_job_audit`.
  - [ ] 11.5 Supabase disk: 40 GB provisioned, about 26 GB used after the vacuum, spend cap on. Decide with TJ whether to leave it as is or reduce provisioned size later.
