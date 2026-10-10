# RSO goal handoff

Updated: 2026-10-10 03:33 UTC. Goal remains active; local implementation continues.

## Checkout and coordination

- Goal: `01a12382-025a-7cb3-a01e-5b9445de662d`.
- Working checkout: `/Users/tim/.codex/worktrees/rso-consolidated-execution/fhfhockey.com`.
- Branch: `chef/rso-consolidated-20261009`; base: `d75f8f916f8d7485433217cbad51cdb30c75070d`; committed HEAD: `ddab56c8a`.
- This checkout stays intact. Scout owns safe reconciliation with `octoberBranch`; coordinate before any overlapping edits or integration.
- Goal owns this handoff and the consolidated checklist/PRD. Scout owns `tasks/rso-goal-decisions.md` in this checkout. The decision file was absent at this checkpoint. Read it at subsequent checkpoints and before pausing.
- Human authorization permits Scout to coordinate routine engineering decisions/blocker fixes. New pricing, commercial commitments, destructive actions, provider writes, production changes and unapproved releases remain pending.

## Latest retained checkpoints

- `ef2bd08ab`: independent access grants survive another source's failure; source reads are paginated and fail closed on incomplete evidence; same-account refresh generation guards suppress stale results. Access tests: 19/19; component tests: 70/70. Focused lint passed with four inherited hook dependency warnings.
- `ddab56c8a`: undo persists across reopening, stays scoped to the matching league/context and restores manager intent against current provider inputs. Workspace/component tests: 79/79; provider-refresh/reopen/undo regression: 1/1; final reopen/context/manual-fork checks: 3/3. Focused lint passed with the same inherited warnings.
- Existing native cutoff repair independently verified: offline harness tests 56/56. This establishes mechanics, not genuine predictive quality.
- Goalie repair is locally verified and being committed: contribution/adapter tests 124/124, planner goalie cases 7/7, focused lint passed without warnings. Full TypeScript check reports only the inherited Game Grid diagnostic below. Task 12 local repairs are complete; genuine/live acceptance is still open.

## Current ownership and unfinished change

The goal remains the sole application writer here. Previous worker audits were read-only; actual worker runtime settings were not independently exposed, so additional staffing requires the repository's verification/coordination requirements.

- Latest completed local task: **12.4**, evidence-confirmed goalie consumption. Next checkpoint: **15**, minimal inherited TypeScript correction from the reviewed upstream source.
- Owned for this checkpoint: `web/lib/player-forecasts/planningContributions.ts`, its existing test file, `web/lib/player-forecasts/resolvedPlanningForecast.ts`, and the existing `web/lib/rosterScheduleData/planning.test.ts` regression surface. Producer/Start Chart files remain outside this repair.
- Both meaningful regressions failed before repair: a confirmed goalie with model probability `0.8` and already-weighted saves `16` was rejected as false/null/null, with and without baseline sources. Both now pass, including replay and stale evidence checks.
- Repair validates raw probabilities and full team-game starter mass, retains admitted confirmation independently of model probability, preserves the issued probability and applies participation exactly once. Invalid-probability, conflicting-starter, permission, cutoff, expiry and replay protections remain covered.
- Goal also owns the existing RSO component, workspace/access files and shared RSO/Start Chart E2E edits for later checklist work. Scout should announce any additional writer and exact paths before dispatching overlapping work.

## Exact blockers and questions

1. **Inherited TypeScript diagnostic:** this checkout still reports only `web/e2e/game-grid-previews.spec.ts:233:99`, `NodeResult.summary` (`TS2339`). Scout verified upstream correction `5b7bbe35b`. After retaining the goalie checkpoint, inspect that commit and coordinate a minimal source reconciliation without moving or discarding this checkout or advancing October HEAD. No duplicate patch worker is needed.
2. **Genuine forecast acceptance:** tasks 2.2–3.4 still require a lawful genuine player/goalie input path, real issued evidence and positive compatible consumption in both RSO and Start Chart. Fixtures and team-goal research cannot close these tasks. Question for Scout: identify the current forecast producer owner, exact evidence artifact/path and authorized read-only verification route, with no serving activation or production write implied.
3. **Routine proposals P6–P8:** measurement workloads, numerical latency/search limits and connected-refresh targets are not accepted. Question for Scout: review these as engineering proposals and record permitted measurement defaults separately from release/SLA claims; leave commercial P9–P12 pending.
4. **Planner equivalence:** user permits fewer acquisitions only for otherwise equivalent actual startable outcomes under a declared numerical tolerance. The tolerance remains open. Question for Scout: propose an explicit, unit-aware tolerance for review without introducing category weights, a category blend or a decision rule based on the provisional 5% label.
5. **Dependent live acceptance:** actual Yahoo profile, account saves, entitlement lifecycle, browser/layout/performance and weekly locks remain unverified at this revision. Continue independent engineering; do not mark dependent acceptance complete from unit receipts.

## Accepted policy boundaries

- P1: freshness is input-specific. Model-fit age is separate from schedule/roster/injury/goalie evidence. Six-/two-hour values are provisional warnings, not universal rejection limits. Recheck material news/status before issue; the PRD defines near puck drop as zero–120 minutes before a covered upcoming game.
- P2: complete players/games/categories for each claimed comparison; explicitly narrowed comparisons show exclusions; missing projections remain unknown and dependent recommendations are withheld.
- P3: 14 slates/500 skater player-games/100 goalie starts is an initial evaluation milestone, not an automatic pass/fail or universal beta gate. Predefine holdouts, cutoff-safe baselines and category-specific error/calibration; report uncertainty/coverage. Controlled beta still requires engineering/data integrity and genuine positive consumption. Model-weight changes need a larger untouched evaluation set.
- P4–P5: actual startable outcomes over the same horizon, per-category gains without a universal blend, vacancies/legal IR capacity before drops, manager protection and selected moves preserved, automatic must-keep off. Five percent is only a provisional similar-points display label with a defined safe denominator, never a confidence interval or automatic choice.
- Pricing, branding, exact commercial dates/cohorts and entitlement edge cases remain proposals. No remote builds, RSO release, provider transaction, grant publication or production mutation has occurred in this goal.
