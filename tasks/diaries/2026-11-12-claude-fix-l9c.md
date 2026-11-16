# Diary: fix lane L9c (FORGE coverage path) — 2026-11-12

## Scope
Brief `tasks/artifacts/calculation-inventory-2026-11-10/master/fix-lanes/L9c.md`. W1 P0 #27 root cause (eligible skaters with no FORGE line), decision 132.2–132.4 (if-plays line for every eligible player, availability separate, time-away decay, coverage report). Chef = local_78a99adf. Consumer = L11 (local_005d799e).

## Where
octoberBranch, sole checkout. Claim appended (CLAUDE-FIX-L9c-CLAIM-20261112). Codex tail checked: no claim on L9c paths.

## State
- Read _COMMON, L9c brief, RULES-DIGEST, decisions 3/24/31/47/59/132, BC W1-7 / W1-11 B (D2), L9a brief+diary.

## Root cause trace (rule 18 reach) — 2026-11-12
Path: preflight (roster events → availability multiplier) → skater-stage per team: line combos (≤18) ∩ current roster (`rosters.is_current`) → `filterActiveSkaterCandidateIds` (missing metrics / hard stale >45 d excluded) → availability ≤0 dropped → lineup rows `forge_player_projections` → reserve pass `selectReserveSkaters` + `buildReserveSkaterLine` (Codex file) → `forge_reserve_projections` → RSO bridge (L11).
- R1 live (production state): reserve pass is behind `FORGE_RESERVE_PASS_ENABLED` (default off) and `forge_reserve_projections` is unapplied (decision 52). So every current-roster skater outside a team's projected lineup (scratches, injured/IR/LTIR, call-ups, depth beyond the pool, >45 d stale, no metrics) gets no FORGE line. Plus held runs since 11-09 (bridge reads only each team's latest run). This is the main cause of 101/673.
- R2 code (conditional on R1 on): rolling reads keep a 365-day lower bound, so a long absence (>1 y) has no ev/pp row → `buildReserveSkaterLine` null → no row.
- R3 code: no NHL usage at all → builder null (Codex file); stays unknown, reason `no_nhl_history`.
- R4 code: team loop `continue` (line-combo hard failure, empty pool) skips the reserve pass for the whole roster, silently.
- R5 code live: lineup line × unqualified DTD 0.55 (non-board mode) × fixed-rate recency decline (1 → 0.15 over 21–45 d). Mixes availability and time away into the line (decision 132.2/132.3 defect).
- R6: no coverage report anywhere.

## Implementation (uncommitted → first commit)
- `queries/skater-queries.ts`: `fetchRollingRows(..., options.lookbackDays)` (default 365, max 1100).
- New `skaterCoverage.ts`: `skaterAvailabilityForGame` (projected_lineup / confirmed_out → expected 0 for that game / uncertain / unknown; participation_probability always null), `buildTeamSkaterCoverage`, `recordTeamSkaterCoverage`, `FORGE_LONG_ABSENCE_LOOKBACK_DAYS = 1095` (read scope).
- New `timeAwayDecay.ts`: evidence + disclosure (unvalidated → applied false, widened_unquantified), fit harness (`buildReturnObservations`, `fitTimeAwayDecay`, `fitAndValidateTimeAwayDecay`: per-bin Poisson MLE ratio + Pearson dispersion vs control, time-ordered holdout, pass = deviance gain − 2 SE > 0). `VALIDATED_TIME_AWAY_FIT = null`.
- `stages/skater-stage.ts`: lineup line no longer × DTD 0.55 / soft-stale recency decline (recency_multiplier kept as evidence, `recency_multiplier_applied: false`); lineup + reserve rows carry `uncertainty.availability` and `uncertainty.time_away`; reserve pass reads long absences (1095 d); per-team coverage in `metrics.skater_coverage` + data_quality totals, incl. reserve pass off and lineup-failure paths.
- Tests: `stages/skater-stage.coverage.test.ts` (7, all fail on HEAD stage/queries, pass now), `timeAwayDecay.test.ts` (7), `skaterCoverage.test.ts` (4). lib/projections 80 files / 1580 pass; lib/rosterScheduleData + forge API tests 11 files / 354 pass; eslint 0.
- Notes: side-session `L9c-coverage-row-contract.md` (L11 contract), `L9c-time-away-fit-read.md` (bounded export for the fit). Codex proposal CLAUDE-FIX-L9c-RESERVE-COVERAGE-20261112.
- Gotcha: bridge (L11) selects no `uncertainty`; DTD lineup rows now carry the full if-plays line → L11 must read `availability.state` before release (release together).

## Checkpoint: commit 22f67eb9f (2026-11-12)
Typecheck exit 0 (full repo, at time of run). Mailbox: my claim had already been committed by L11's c231c05be; only my proposal hunk staged (L20/L21 claims left unstaged). Report sent to Chef.
Next: L11 to adopt the availability selector (release together); TJ decisions on production steps (reserve migration + env, FORGE rerun, fit export). Blockers: none local.

## Reader inventory (Chef request, read-only) — sent
Team totals: TOI and shots pinned to team targets; goals are the sum of reconciled heads (redistribution only). Readers: RSO bridge (L11, ticketed), ledger via bridge (L10), forge/players + FORGE pages/Top Adds/trends (L12), deprecated projections/players, start-chart skaters, run-projection-accuracy (Codex; conditions on playing, so improved), game-prediction team features (L22, no action), count-only readers, no social-share reader.

## Closed by Chef (2026-11-12)
Inventory routed: L11 (bridge, ledger follows), L12 reopened (forge/players, Top Adds), Codex (Start Chart skater path, optional accuracy stratum; mailbox ddef2b05c). Production steps queued for TJ: reserve migration, then FORGE_RESERVE_PASS_ENABLED; FORGE rerun; optional decay-fit export. Keep this diary until the debrief.
