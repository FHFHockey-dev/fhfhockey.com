# Goalie workload and FORGE: frozen local checkpoint

> Acceptance update: the unchanged six-file packet is now **accepted locally with limits** at reconciled `1ee5127d`. See [final receipt](acceptance/FINAL.md) and [independent review](acceptance/independent/REVIEW.md). Predictive use remains dormant. The original checkpoint below retains its historical freeze status.

The chart measures **past appearances, including relief**, while the study concerns **official starts**. Reusing its chart percentages as future start chances would mix different events. Bounded chart correctness fixes and an offline FORGE evidence seam are now locally implemented and tested. The seam is dormant; it changes no production forecast or confirmation policy. **This packet is frozen for parent review and local commit custody, not independently accepted or released.**

## What exists

| Path | Existing responsibility and audit finding |
| --- | --- |
| `web/components/GoalieShareChart/index.tsx` | Used by Stats and Trends. Reads NHL regular-season per-game summary rows through the CORS proxy; 100-row pages, eight concurrent, two attempts, fixed totals/length checks and withheld failures. L10/L20/L30 select distinct recorded team games. Numerators were appearances; the summed appearances were also labeled team GP. Team abbreviation binds a traded goalie's old appearances to his old club. Complete pages alone cannot certify an independently complete team schedule. |
| `web/pages/api/v1/db/update-goalie-projections-v2.ts` | Existing canonical goalie-start table writer. Uses explicit NHL `gamesStarted`, divides by observed distinct team dates for L10/season, and writes L10 share to `start_probability` with `confirmed_status=false`. Its intentional rolling stats use `gameDate <= target date`, including that game's result when present. Logs are retrieved in one bounded request without pagination/total validation or original availability clocks. This retrospective tally is not a qualified pregame probability dataset. No writer invocation or change occurred. |
| `web/lib/projections/queries/goalie-queries.ts` | Legacy recent-start context chooses maximum TOI per date from `forge_goalie_game`, not an official starter flag. `derived/buildGoalieGameV2.ts` produces null TOI, so a tie can select the first row; longer-playing relief is also not proof of starting. Last-played dates omit relievers not selected as that day's starter. The L10 frame is observed dates, without an independent completed schedule or season bound. Workload rows count appearances despite names saying starts. |
| `web/lib/projections/calculators/goalie-starter.ts`, `stages/skater-stage.ts`, `stages/goalie-stage.ts` | FORGE already combines recent share, priors, season support, goalie ability, staleness, opponent and B2B heuristics. Season support uses a games/(games+10) factor; there is no evidence here for copying the study's coefficients. Prior ingestion calls Number on nullable season values, so null becomes numeric zero. Scoped evidence, rather than a probability endpoint or legacy boolean, establishes confirmation in the producer. |
| `web/lib/player-forecasts/rollingWindowParticipation.ts` and `modeledGoalieParticipation.ts` | Canonical evidence-checked, separate official-start and positive-minute appearance kernels. They bind season/team/player/game, complete team opportunities, dated eligibility, source identity/hash and microsecond cutoffs. Relief can be an appearance without a start. Missing labels withhold estimates; known availability conflicts withhold them. Fourteen New York calendar days precede cutoff date. Results are explicitly uncalibrated; endpoints do not confirm future participation. |
| `web/lib/rosterScheduleData/forgeDailyBridge.ts` and `web/pages/api/v1/start-chart.ts` | Existing downstream consumers already distinguish confirmed evidence and projected status. RSO uses an exact FORGE game when present, otherwise normalized historical shares, with its own rest/news policy. Its fallback share map is keyed by player and its read omits team/season identity, leaving a trade-binding gate. Start Chart's revision branch binds supplemental rows to game/team/player and uses admitted confirmation. These consumers were not edited. |

Conditional stopping remains separate: `goalieModel.ts`, `goalie/goalieOutcomes.ts` and the goalie stage handle shot volume, saves/GA, save-rate/rest adjustments, wins and shutouts. Changing start share must not silently reweight appearance-conditioned rates or apply context twice. This task changes none of those formulas.

## What changed locally

1. Extracted the existing chart aggregation to `web/lib/goalieWorkload.ts`; the component re-exports its old helper/type surface. Forecasting does not import React or Chart.js. This is reuse/extraction, not a newly fitted share model or a measured speed improvement.
2. Split distinct **team GP** from **total goalie appearances**. One game with starter plus reliever is one team game and two appearances. Pie labels retain the appearance denominator; visible wording identifies relief and descriptive history.
3. Preserve missing/nonfinite/negative rate components as unavailable. Undefined zero-denominator SV%/GAA are null; measured zero remains zero. The tooltip handles unavailable values.
4. Reject duplicate team/game/player identities across otherwise full, stable-length pages, withholding the season instead of double-counting it. The existing retry, empty-season, pagination and mobile work is retained.
5. Added `web/lib/projections/goalie/workloadEvidence.ts`: a pure, dormant FORGE seam that calls the canonical rolling start and appearance kernels. It returns separate historical counts/shares, eligible-team-game denominator, clocks, scope, method versions, reasons and evidence hashes. Missing start labels can withhold starts while supported appearance history survives. Its future start/appearance probabilities stay null and confirmation stays unconfirmed. No stage, database reader, RSO or Start Chart selects it.

The chart's denominator is all recorded goalie appearances. The seam's denominator is selected **eligible team opportunities**, which can exclude known ineligible games. Neither should be relabeled as the other or as an independently complete all-team-game season share.

## Study assessment and activation gates

Read [Stas Pupkov's October 23 article](https://dobberhockey.com/2026/10/23/analytics-advantage-opportunity-knocks-week-four-which-october-goalies-keep-the-net/). The author reports 720 goalie-seasons over ten seasons. At nine team games, the two-thirds-start group finished top-24 in remaining-season starts 70% of the time; the reported figure reaches 78% at 21 games. Remaining starts include subsequent teams. Adding a role-opening narrative failed the author's two-history-halves improvement gate. These are author-reported findings, not an independent replication, a probability of starting the next game, a relief-appearance probability, or conditional stopping evidence. No reported percentage or weight was imported.

Before predictive use:

- Obtain an independently complete team schedule, original official starter/nonstarter labels, real appearance/zero/nonappearance labels, dated club/season membership and eligibility, including trades, injuries and suspensions. Replace maximum-TOI inference only under that authoritative source contract. Do not infer bench/nonappearance from an absent row.
- Separate same-date retrospective share columns from strictly pregame, immutable source clocks; verify pagination and snapshot completeness. Repair null-versus-zero prior transport and team/season binding through the exact producer/consumer boundary.
- Compare canonical baselines with proposed workload/shrinkage candidates on time-ordered held-out seasons with reliable pregame availability, including sparse samples, B2Bs, rest, injuries, confirmations and trades. Evaluate starts and appearances separately using calibration/Brier/log loss; separately evaluate remaining-season start rank if testing the article's claim. A three-game synthetic example proves semantics, not predictive improvement. Reserve protected holdouts and obtain required capture/fitting permissions.
- Only after evidence/review should a separately scoped candidate change weights or serving. Preserve confirmed/projected distinctions and verify RSO/Start Chart admission and conditional/unconditional populations together. No activation is approved by this checkpoint.

## Verification actually performed

Node 22.11.0, installed npm dependencies, one Vitest worker, dedicated artifact configuration/cache. Tests used synthetic data, blocked outbound networking and inert service variables; no local environment files, GIT_DIR, provider/database calls or servers. The shared heavy lock was acquired exclusively for each successful check group and only our own lock was released. One initial acquisition deferred because the lock existed; it subsequently disappeared without intervention. No blocked action was routed around.

| Check | Result |
| --- | --- |
| Changed chart math, component/page-set and new seam tests | 37 passed in three files |
| Existing canonical rolling participation tests | 116 passed |
| Existing goalie producer/confirmation controls | 30 passed |
| Existing RSO daily bridge controls | 42 passed |
| Existing Start Chart controls | 111 passed, one existing opt-in skip |
| Scoped TypeScript, six changed source/test paths plus imports | Passed, exit 0 |
| Scoped ESLint on six source/test paths | Passed, zero errors, two pre-existing img warnings |
| Focused diff whitespace check | Passed |
| Actual Chart.js canvas/browser/visual layout, full-app suites/build, live/provider completeness, empirical calibration | Not run |

Commands and raw results: `focused-results.json`, `controls-results.json`, `static-results.json`, their logs and `verify.py`. Total executed: **336 passed, one existing skip**. Component tests mock Chart.js; they establish data/DOM behavior, not visual browser acceptance.

## Frozen handoff and limitations

- Canonical `octoberBranch` HEAD remains `2a5092d37cb863ec92a2a4e609999cf226bfa4a5`. Local master remains the earlier observed `457435eb3010c5b3dd92d2e1a46d9c75d851780a`. No synchronization occurred. The four inspected read-only legacy/canonical/RSO modules still match locally available released `0619f912`; this is not whole-checkout synchronization evidence.
- The parent reports an owner pull aborted safely on overwrite protection. After that notice, HEAD was unchanged and all three chart deltas matched this task's saved patches exactly. No source drift detected in the owned unit.
- Exact six source paths and SHA-256 pins are in `CHECKPOINT.json`. `task-only.patch` applies on the preserved dirty baseline, not blindly on HEAD. `BASELINE.json`, `existing-chart.patch` and three `before-*` copies preserve that baseline. Existing Sass and other dirty work are not part of this task's delta.
- Frozen for release coordinator `01a16e23-72b5-76ee-8ade-2d209d0e7002`; no further writes/tests after this checkpoint. No staging, commit, push, merge, reset, stash, checkout, deployment, database repair, model activation or port operation was performed. Other lanes were not restarted.
- Remaining action: parent reviews the frozen six-file packet and chooses local commit composition. **Pending**, not denied or uncertain; worker checks are not independent acceptance. Predictive activation and broader legacy correction remain **pending evidence and scoped review**, not attempted. No automatic approval rejection occurred in this task.
- Keep diaries, cache, baseline copies and test harness out of application release composition unless the coordinator explicitly needs selected evidence artifacts. The report and pin manifest are handoff evidence; the diary is working context only.
