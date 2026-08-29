# Team Form (CTPI) Formula Audit and Validation

## Status and boundary

- [x] The read-only audit is complete and rejects the current series as fit for the Recent Team Form claim. Evidence: `ctpi-formula-audit-report.md` and `web/scripts/audit-ctpi-formula.ts`.
- [ ] Candidate activation remains approval-gated; no writer/reader switch, applied schema, persisted-row, backfill, schedule, model, or Production change is authorized by this task. The inactive candidate reuses the pre-specified no-PDO weights and cannot be treated as trusted data until approval and replay/persistence gates pass. One local nullable-component migration is staged but unapplied.
- [x] A controlled three-season provider audit now closes the earlier source-history limitation without writing Production: `web/scripts/audit-ctpi-multiseason.ts` evaluates `20222023` and `20232024` as development seasons and `20242025` as the untouched holdout.
- [x] `web/lib/trends/recentTeamFormV2.ts` implements the inactive candidate with source-null preservation, documented weight renormalization, effective sample size, confidence, separate PDO context, sparse-league unavailability, and a bounded logistic display transform.
- The user-facing product name is **Recent Team Form**. `CTPI`, `ctpi_raw`, `ctpi_0_to_100`, and `team_ctpi_daily` remain internal compatibility names unless a later approved migration changes them.
- Formula selection remains deliberately separate from the Start Chart presentation pass. Public readers now require an explicit approved-publication marker, exclude the rejected series even when legacy version fields exist, and explain its absence in plain language.

## Intended signal

Recent Team Form should answer one plain-language question:

> How strongly has this team been playing lately, relative to the rest of the league?

It should summarize recent all-around team performance across offense, defense, goaltending, and special teams. A score of 50 is intended to represent league-average form; higher should mean stronger recent form and lower should mean weaker recent form. It is contextual evidence, not a game prediction, win probability, rest-of-season power rating, or direct Starter Board ranking input.

## Authoritative implementation surfaces to trace

- `web/lib/trends/ctpi.ts` — rolling metrics, league-relative standardization, component weights, and score transform.
- `web/lib/trends/recentTeamFormV2.ts` — inactive, versioned replacement candidate; not used by any writer or public reader.
- `web/lib/trends/recentTeamFormV2Provenance.ts` — inactive strict-pregame fingerprint, watermark, and replay-planning boundary.
- `web/lib/trends/recentTeamFormV2Materialization.ts` — inactive, non-writing candidate-to-compatibility-row boundary.
- `web/pages/api/v1/db/update-team-ctpi-daily.ts` — source reads, as-of loop, persistence, and schedule ownership.
- `web/pages/api/v1/trends/team-ctpi.ts` — public reader, fallback, pagination, and freshness contract.
- `web/pages/api/v1/start-chart.ts` and `web/pages/start-chart.tsx` — dated reader and Recent Team Form presentation.
- `web/components/forge-dashboard/TeamPowerCard.tsx`, `web/components/forge-command-center/TeamPowerTerminal.tsx`, and `web/lib/dashboard/teamContext.ts` — downstream interpretation and momentum deltas.
- `web/lib/game-predictions/featureBuilder.ts`, `web/lib/game-predictions/baselineModel.ts`, and their tests — predictive-model consumption.
- `web/scripts/audit-game-prediction-team-form.ts` — read-only reconciliation of legacy v6 snapshots, distinct-game holdout size, repaired-contract metrics, and the no-Production gate.
- `team_ctpi_daily`, NST all-situations/PP/PK source tables, WGO/team-power dependencies, migrations, generated types, cron records, and existing audit artifacts.

## Audit tasks

- [x] 1.0 Establish the current mathematical contract and the target required for a replacement.
  - [x] 1.1 Trace every active writer, reader, fallback, test, and downstream consumer; classify legacy or duplicate paths.
  - [x] 1.2 Write the implemented equation in human-readable and symbolic form, including game weighting, rate derivation, z-score population, component weights, PDO treatment, and the `50 + 15 × raw` transform.
  - [x] 1.3 Record units, directionality, observed/theoretical ranges, null/default behavior, missing minimum samples, and the non-normalized `1.10` top-level weight total.
  - [x] 1.4 Fix the audit target as descriptive, league-relative recent form; forward association is diagnostic rather than the product definition.

- [x] 2.0 Audit data lineage and historical integrity; the current data fails this gate.
  - [x] 2.1 Demonstrate that same-date results can enter 2,534 pregame team-date contexts and that strict-prior serving is required.
  - [x] 2.2 Recompute the representative `2026-02-05` slate from current NST inputs; corrected one-game inputs shift scores by median `5.06`, maximum `24.10`, and ranks by median six places.
  - [x] 2.3 Verify bounded source reads and expose failed grain/replay behavior: 2,432 aggregate rate rows across 76 all-team dates, plus historical source corrections not replayed into CTPI.
  - [x] 2.4 Record the unverified season-opening/sparse/playoff/offseason/identity cases as replacement requirements; the single persisted season cannot prove them.

- [x] 3.0 Vet whether the formula measures the intended signal; it does not currently do so reliably.
  - [x] 3.1 Quantify sensitivity/redundancy across active z-score components; the report records correlations up to `0.778` among related chance/against inputs.
  - [x] 3.2 Quantify PDO/result overlap (`PDO~GF = 0.662`) and recommend moving PDO outside the score pending approval.
  - [x] 3.3 Verify component/top-level weights and prove the advertised 20% goaltending component is zero in all 8,064 persisted rows.
  - [x] 3.4 Inspect the observed distribution (`26.95`–`70.30`) and prove the claimed 0–100 transform is theoretically unbounded and not cross-season validated.
  - [x] 3.5 Trace missing/null coercion and require explicit availability, effective sample size, and documented renormalization in v2.
  - [x] 3.6 Record linear recency and the intended season/recent goalie blend; alternative decay selection remains a multi-season model experiment, not an inferred fix.

- [x] 4.0 Audit blind spots and misleading conditions; each is recorded in the report with a measured impact or an explicit unable-to-measure reason.
  - [x] 4.1 Opponent strength and schedule quality, home/away splits, score effects, rest/back-to-backs, travel, and strength-state mix.
  - [x] 4.2 Injuries, trades, roster/line changes, starting-goalie changes, coaching/system changes, and sample continuity.
  - [x] 4.3 Special-teams opportunity volume versus efficiency, empty-net/shootout handling, playoff context, and era/season comparability.
  - [x] 4.4 Uncertainty, effective sample size, confidence/freshness disclosure, and regression-to-mean for early or sparse samples.
  - [x] 4.5 Relative-rank instability: a team score can move because the league distribution changed even when that team's own play did not.
  - [x] 4.6 Downstream leakage/double counting is traced; the game-prediction reader is strict-prior but also consumes overlapping team sources.

- [x] 5.0 Complete multi-season controlled validation before selecting replacement weights.
  - [x] 5.1 Freeze matched, strict-pregame team-game observations across `20222023` and `20232024`, retaining `20242025` as a final holdout. The legacy weights and no-PDO ablation were pre-specified; no fitting or selection occurred.
  - [x] 5.2 Measure concurrent validity against recent xG and goal differential plus each offense, defense, goaltending, and special-teams component. The candidate correlates `0.882` with recent xG differential in development and `0.837` on holdout; holdout component correlations range `0.837–0.880`.
  - [x] 5.3 Measure unadjusted forward association over the next 1, 3, 5, and 10 games with 1,926–2,214 observations; opponent/venue/rest controls and confidence intervals remain unavailable in the one-season audit.
  - [x] 5.4 Compare persisted, corrected-input, no-PDO, last-10 goal-differential, and last-10 xG-differential signals; the composite does not consistently beat the simple xG baseline.
  - [x] 5.5 Test rank stability, calibration by score band, monotonicity, outliers, and known failure cases. Holdout bands are monotonic for recent and next-five xG differential; consecutive-date rank correlation has median `0.959`, median absolute movement is one place, and 6,910 of 6,912 possible scores fall in `23.24–73.39`. The candidate correctly withholds the other two for an insufficient league comparison and guarantees the public range; no weights were selected on holdout.

- [x] 6.0 Deliver evidence and an approval-ready recommendation.
  - [x] 6.1 Report findings by severity with formula term, sample date/team, reproduction command, and user impact.
  - [x] 6.2 Reject the current formula for the Recent Team Form claim and require a versioned replacement.
  - [x] 6.3 Propose the smallest maintainable repair, provenance/replay/backfill boundary, compatibility strategy, validation gates, and rollback boundary.
  - [x] 6.4 Keep formula/database mutation approval-gated; the audit command performed reads only, and the local forward guards do not mutate existing rows.

- [x] 7.0 Prepare a non-served replacement contract without changing user-visible or persisted data.
  - [x] 7.1 Preserve source nulls, observation counts, rejected aggregate counts, source-through date, and recency effective sample size.
  - [x] 7.2 Remove PDO from the score while exposing value, league z-score, observation count, and high/neutral/low sustainability context.
  - [x] 7.3 Renormalize only documented available metric/component weights, require at least five recent games and `0.65` component weight, distinguish missing source data from an insufficient league population, and report stable warnings/confidence.
  - [x] 7.4 Replace the unbounded linear display with `100 / (1 + exp(-0.6 × raw))`; focused tests prove neutral 50, strict `0–100`, PDO independence, missingness, source-grain rejection, and sparse-population unavailability.
  - [x] 7.5 Prepare and test the inactive strict-pregame provenance boundary: hash every score-affecting source value, record the latest joined-source update watermark, and deterministically plan replay for missing, inconsistent, version-changed, cutoff-changed, fingerprint-changed, or watermark-changed snapshots. The read-only representative audit proves 1,802 exact source team-games through `2026-02-04`, 32/32 candidate scores, and the expected legacy replay reasons without writing data.
  - [x] 7.6 Require explicit publication approval in the shared trust reader, stamp the legacy calculator `legacy_unapproved`, resolve the public reader's season from its requested date, and remove its on-the-fly legacy fallback. Version fields alone cannot accidentally restore a rejected score.
  - [ ] 7.7 After product approval, promote the candidate version name, wire it into the writer/readers, and prove a no-look-ahead raw→persisted→API trace before any backfill.
    - [x] 7.7.1 Add a non-writing materialization contract that requires numeric score columns, preserves nullable partial components, omits unavailable scores with reasons, keeps PDO payload-only, rejects non-finite JSON values, and forcibly stamps `candidate_unapproved`.
    - [x] 7.7.2 Stage—but do not apply—a minimal migration that makes only the five component/context columns nullable. The existing primary key, RLS, grants, payload, and required score columns are unchanged. SHA-256: `f8354ceafd0d230cba8ed2259aeffdfa24e6aa4bdab4526a5a7ef6584e3a5332`.
    - [x] 7.7.3 Extend the representative read-only audit with exact in-memory materialized readback: 32/32 rows match candidate score, component, cutoff, fingerprint, and publication fields; persistence remains false.
    - [x] 7.7.4 Resolve the game-prediction feature reader and selected-model contract before any candidate write.
      - [x] 7.7.4a Select publication/formula/input/game-count provenance, apply the shared trust predicate before strict-as-of selection, fall back only to an older approved row, and mark CTPI unavailable when none exists. New snapshots retain that provenance and the model vector independently requires an approved pair. The focused feature-builder/v6 baseline cohort passes 2 files/32 tests.
      - [x] 7.7.4b The read-only snapshot audit finds 133 numeric v6/v4 CTPI pairs and zero approved pairs, excludes all 133 without mutation, and corrects the playoff denominator from 31 prediction rows to seven distinct completed games. The repaired-contract diagnostic loses to the goal-differential baseline on accuracy, Brier, and log loss and fails the minimum-sample gate, so the no-Production exception remains. No snapshot, model, prediction, or metric was rewritten.
    - [ ] 7.7.5 Obtain product approval, promote the version, apply/regenerate the schema contract, switch the writer and approved readers, and complete the database/API trace.

## Acceptance evidence

- [x] Formula specification and source-to-score lineage are complete; the evidence proves persisted history is not reproducible after late source corrections.
- [ ] Representative raw-to-persisted-to-API traces pass with no look-ahead.
- [x] Multi-season descriptive, predictive, ablation, stability, and missingness results are recorded with 6,910 scored and two honestly unavailable observations out of 6,912 possible samples, plus 95% Fisher intervals. The report explicitly retains repeated-team dependence as an uncertainty limitation.
- [x] Every identified blind spot has a measured impact or an explicit unable-to-measure reason.
- [x] The final recommendation distinguishes copy/presentation fixes from formula/data changes and names all required approvals.

## Evidence

- `tasks/TASKS/three-pillars-analytics/trends/ctpi-formula-audit-report.md`
- `web/scripts/audit-ctpi-formula.ts`
- `web/scripts/audit-ctpi-multiseason.ts`
- `web/lib/trends/recentTeamFormV2.ts`
- `web/lib/trends/recentTeamFormV2Provenance.ts`
- `web/lib/trends/recentTeamFormV2Materialization.ts`
- `supabase/migrations/20260828142331_recent_team_form_nullable_components.sql` (staged, not applied)
- Command: `NODE_PATH=. npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/audit-ctpi-formula.ts --season=20252026 --date=2026-02-05`
- Result: read-only success on 2026-08-27; 8,064 persisted rows and 2,214 forward-evaluation observations inspected; no mutation performed.
- Materialization result on 2026-08-28: the representative strict-pregame candidate produces 32 candidate-unapproved compatibility rows, 32 exact in-memory readbacks, 32 payload-only PDO contexts, zero score nulls/omissions, and no write. The 14-test focused CTPI suite preserves `special_teams = NULL`, omits the unavailable case with reasons, rejects non-finite payloads, and proves the score columns remain required. The full 7-file Start Chart cohort passes 77 tests; TypeScript, scoped ESLint/Prettier, and diff integrity pass. Chrome at 660×1049 shows 100 player links, the plain-language hidden-data explanation, no candidate version, no overflow, and zero error/warning logs.
- Command: `NODE_PATH=. npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/audit-ctpi-multiseason.ts --seasons=20222023,20232024,20242025 --holdout-season=20242025`
- Result: read-only success on 2026-08-28; 7,872 exact team-game source rows, 6,910 candidate scores from 6,912 possible observations, two development seasons, and one untouched holdout; no mutation performed.
