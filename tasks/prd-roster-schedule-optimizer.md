# Roster Schedule Optimizer — implementation plan

This document preserves the approved requirements and planning baseline. Implementation status and executed verification are recorded in [Prep List](tasks-prd-roster-schedule-optimizer.md).

Approved forecasting extension (September 28, 2026): keep detailed calendar-day coverage separate from next-N-team-games scopes. The initial comparison is 7/14/21 UTC calendar days, with 14 as a candidate, not a validated horizon. Baseline v1 uses an equal-source approved public projection consensus, 60/40 projection/history prior (available-source renormalization), up to 82 previous-season appearances, and up to 20 current-season appearances weighted by 0.9^age with a 20-appearance prior weight. Unknown observations are omitted, ratios are not averaged, and no extra role/opponent/form multiplier is added. This candidate remains unvalidated.

FE acceptance requires competitor-aware target coverage, joint position/UTIL assignments, explicit conditional/unconditional lineage with participation applied once, immutable source/input identifiers, and credited goalie minimum progress separate from forecasts. Missing or incompatible competitor evidence produces “Schedule-capacity assignment,” unavailable quality comparisons and explicit exclusion reasons. No name-based player rules are permitted. Public baseline release requires explicit owner-approved evaluation/review evidence and allowlisting; code readiness and passing fixtures do not constitute accuracy validation or activation. Shared manual and connected analysis retain the same forecast boundary.


## 1. Summary and current evidence

Build RSO as an in-season planning workspace centered on a streaming itinerary inside a game grid. Free/manual and premium/connected users will use the same engine. Premium adds supported synchronization, account persistence, and automatic upkeep.

Execution authorized by the owner on September 26, 2026; external release gates remain separate. This planning pass changed no files, created no coordination resources, and ran no application tests or live provider/database checks. The nine pre-existing Draft Dashboard modifications remain present.

### Repository findings

| Area | Current evidence | Implementation consequence |
|---|---|---|
| RSO page and state | [RosterScheduleOptimizer.tsx](/Users/tim/Code/fhfhockey.com/web/components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx) reads cached Yahoo snapshots directly, imports explicit IDs, uses seasonal projection preferences, and holds scenario edits in component state. Projected players are initialized as available. | Replace input/state orchestration for RSO; add reviewed manual import, explicit availability, persistence, and coherent snapshots. |
| Assignment engine | [matching.ts](/Users/tim/Code/fhfhockey.com/web/lib/rosterScheduleOptimizer/matching.ts) fills every feasible slot before optimizing value. [optimizer.ts](/Users/tim/Code/fhfhockey.com/web/lib/rosterScheduleOptimizer/optimizer.ts) supports daily matching, bench participation, and DUST; weekly mode reports an error. | Preserve this behavior for existing consumers. Introduce explicit RSO objectives, locks, and timeline evaluation. |
| Existing outcome-first logic | [starterBoardPersonalization.ts](/Users/tim/Code/fhfhockey.com/web/lib/projections/starterBoardPersonalization.ts) has weighted assignment with empty-slot choices and preservation of locked positions. | Extract the applicable pure assignment primitive instead of implementing another unrelated matcher. It does not yet solve category ratios or multi-day sequences. |
| Schedule | [rosterScheduleData](/Users/tim/Code/fhfhockey.com/web/lib/rosterScheduleData) already stores game IDs, start times, opponents, season, status, and provenance. RSO reduces this to dates/team games and Yahoo weeks. | Retain the richer fields; add provider-neutral date-range reads without breaking the existing week-based API. |
| Yahoo | [starterBoard.ts](/Users/tim/Code/fhfhockey.com/web/lib/integrations/yahoo/starterBoard.ts) already distinguishes free agents, waivers, rostered players, and unknown availability, and checks locks and response freshness. It covers today and at most 100 available-player candidates; acquisition limits remain unverified. | This expands the audit’s reuse inventory. Reuse bounded parsing/transport pieces, not its today-only orchestration or shortlist as complete league coverage. |
| Shared forecasts | [schedule.ts](/Users/tim/Code/fhfhockey.com/web/lib/player-forecasts/schedule.ts) defines the next **ten games per team**, not ten days. Forecast revisions and settlement infrastructure exist, but latest/accountability routes are admin-only. Inspected settlement handles selected skater targets, not complete goalie/category coverage. | Add a validated public serving response and extend shared evaluation where necessary. Do not expose admin payloads or claim current calibration. |
| FORGE and goalie inputs | [starterBoardScoring.ts](/Users/tim/Code/fhfhockey.com/web/lib/projections/starterBoardScoring.ts) explicitly reports means-only, unvalidated distributions. [goalieStarterMixtures.ts](/Users/tim/Code/fhfhockey.com/web/lib/projections/goalieStarterMixtures.ts) includes provenance and B2B heuristics, including a previous-starter adjustment. | Reuse issued forecasts and evidence, while retaining provisional labels. Heuristic confidence is not calibrated probability evidence. |
| Fantrax | Existing client methods cover linking/settings, draft results, identities, and ADP. The inspected implementation does not establish authoritative in-season roster, scoreboard, or availability feeds. | Supply capability-based integration and compatible identity/settings reuse; do not reconstruct current rosters from drafts. |
| Grid and layout | [DateRangeTeamGrid.tsx](/Users/tim/Code/fhfhockey.com/web/components/GameGrid/DateRangeTeamGrid.tsx) is a team grid with useful opponent/date presentation. Its loader fetches Monday-based blocks. The global layout only gives Draft Dashboard its desktop viewport treatment. | Extract suitable presentation primitives. Add a scoped RSO workspace layout; do not embed the existing page or inherit its calendar assumptions. |
| Access and persistence | Draft Pro has seasonal constants, capability enforcement, alternative grants, and versioned-save patterns. Existing Patreon qualification requires verified paid active membership. Relevant recent migrations are under repository-root `supabase/migrations`; the separate `web/supabase/migrations` tree also exists. | Add distinct in-season capabilities and RSO persistence. Preserve Draft Pro and ordinary account connection behavior; use the established root migration lineage. |

The historical 63-test result, 2,688 schedule rows, cache timestamp, and connected-empty-roster cause were **not reverified**. Yahoo’s full documentation pages returned HTTP 429 during inspection; exact provider counting/deadline semantics require fixture and authorized live-read evidence.

## 2. Proposed architecture and interfaces

### One engine, independent of access tier

Keep the new planning domain under `web/lib/rosterScheduleOptimizer`, with focused modules for timeline rules, objective evaluation, and sequence search. Preserve existing exports used by Draft Dashboard and `useRosterScheduleOptimizer`; use explicit adapters where their legacy inputs differ.

The engine receives canonical inputs and returns legal assignments, itinerary alternatives, metrics, limitations, and search coverage. It knows nothing about subscriptions, OAuth, React, or database clients.

Introduce these principal contracts:

| Contract | Responsibility |
|---|---|
| `PlanningContext` | Season, provider/manual context, league/team, matchup or custom dates, league time zone, and decision-as-of time. |
| `PlanningSnapshot` | Canonical players, roster occupancy, schedule, rules, acquisitions, optional opponent/scoreboard, availability, forecasts, and per-source provenance/completeness. |
| `LeagueRules` | Slots and reserves, scoring definitions, lineup/transaction locks, acquisition-effective timing, reset periods and counting rules, waiver constraints, and goalie-minimum semantics. |
| `PlanIntent` | Manager-selected steps, protected players, exclusions, preferences, goalie-risk choice, and timing preference. |
| `PlanEvaluation` | Assignments, baseline/comparison metrics, conditional dependencies, legality diagnostics, forecast coverage, and search completeness. |
| `RevisionProposal` | Changes suggested against a specific snapshot and intent revision; never an implicit replacement of intent. |

Use canonical FHFH identity with NHL/provider mappings where available. Keep unresolved imported entries visible outside the evaluated pool; never silently discard them or manufacture mappings.

Represent unknown values explicitly. In particular, availability must distinguish verified free agent, waiver, rostered, manager-supplied availability, and unknown. Ownership percentage remains a separate signal.

### Input and API boundaries

Proposed additions under the existing RSO API namespace:

- **Public planning data:** season/date-scoped schedule, player search/catalog, validated forecast fields, recent-form evidence, and source-health metadata. Available to manual users without Draft Pro.
- **Premium provider snapshot:** authenticated, authorized read of the selected league/team; capability checks precede provider fetching.
- **Account workspace read/save:** authenticated context lookup and revision-checked writes, with the approved expired-access read policy.
- **In-season access response:** capability-based eligibility and granting sources, separate from product branding.

Retain the existing schedule route’s week-based contract for Draft Dashboard. Add date-range support through a compatible query mode or sibling handler sharing the same reader.

Do not import admin forecast handlers into public routes. The public projection response must exclude research artifacts, credentials, internal conflicts, and unapproved outputs.

Provider adapters expose only read operations and a capability report. Reuse Yahoo’s authorized transport, game-context checks, settings parsing, identity mappings, and availability parsing. Extend them for matchup, opponent, transactions/counts, and deadline evidence after validating response contracts. Partial pagination cannot establish complete league availability.

Existing account connection, roster-loading, pickup, and Draft Pro routes retain their current purposes. RSO must enforce its capabilities at its own server boundary rather than globally making account connection premium.

## 3. Planning behavior and forecasting

### Legal roster timeline

Build an event timeline from league periods, locks, game starts, transaction-effective times, and waiver clearance.

Each search state contains actual roster occupancy, reserve occupancy, locked assignments, remaining period budgets, and conditional plan dependencies. A transition must validate the resulting roster and every affected lineup.

- Optimize the existing roster before generating acquisitions; include eligible bench players without requiring provider lineups to be prefilled.
- Preserve realized results and locked opportunities. An acquisition cannot gain a game before its effective time.
- Distinguish an empty active slot from spare roster capacity.
- Permit add-only moves when capacity exists. Show an eligible IR/IR+ move as an explicit prerequisite when it creates capacity.
- Never assume a future injury return or allow illegal reserve occupancy.
- Support holds and successive occupants in different streaming slots within one plan.
- Charge acquisitions to their actual reset periods and counting rules. Unknown allowance requires verified evidence or labeled manager input before declaring budget legality.
- Keep waiver claims conditional, with timing and spending constraints but no bid recommendation. Failed claims must have a valid no-claim continuation.
- Show the next actionable move separately from later legs. Recheck future availability during upkeep.
- Treat daily and weekly lock profiles separately. Weekly assignment remains fixed for the applicable lock window; additions can only improve permitted windows. Mixed or unrecognized rules produce specific limitations.

### Objectives and comparisons

Maintain two explicit objectives:

1. **AGP:** maximize legal active-game opportunities, with projected contribution as a tie-breaker.
2. **Outcome:** optimize supported league scoring, allowing an optional appearance to be benched when it harms the objective.

For each snapshot, calculate no-acquisition results for both objectives. Use one clearly identified optimized no-move plan as the common displayed comparison anchor: outcome-first when supported, otherwise AGP-first. Also expose the no-move AGP alternative, so lineup optimization cannot be misrepresented as acquisition gain.

For points, score game-level projected statistics using league weights. For categories:

- Combine realized totals with both teams’ remaining legal opportunities.
- Apply category direction, ties, and league matchup-scoring rules.
- Combine ratios from underlying components: for example saves/shots against and goals allowed/minutes. Never average displayed percentages.
- Evaluate complete plans because ratio objectives and minimum penalties are not independent player values.
- With validated joint forecasts, evaluate league outcome across shared scenarios.
- Without calibrated distributions, show provisional projected category results and sensitivity scenarios; do not label them win probabilities. When results are sensitive or materially incomplete, present alternatives without manufacturing a confident winner.
- Missing opponent inputs leaves schedule and individual contribution analysis usable while disabling verified matchup strategy.

For bounded sequence search, label the result **best found within the evaluated search**, not a proven global optimum. Fixed-roster assignment can retain exact guarantees where the algorithm supports them.

### Safe recommendations

Replace the legacy replacement thresholds as RSO’s governing rules while preserving them for legacy consumers.

- Honor provider cannot-drop restrictions and editable manager protections.
- Recommend drops only when both usable remaining contribution and projected value support the move against realistic replacements.
- Use longer-term hold value only as a protection signal, not as a game-level forecast.
- Keep ownership nullable. Use it as an explanation/tie-break signal; introduce no unsupported fixed ownership cutoff.
- Include no acquisition as a candidate at every stage.
- Default to ten alternatives, with five/ten/twenty display choices; return fewer when appropriate.
- Show candidate gross games, displaced starts, net roster AGP, move cost, and contribution tradeoffs separately.
- Label opponent-demand flags as inferred.
- Show recent-form chips with their game window, actual statistics, and whether the signal is already included in the forecast. Surface plausible form/matchup alternatives without adding the signal twice.

Preserve existing metric definitions. In particular, marginal player DUST is not additive; team DUST is bench/scheduled. Existing utilization counts schedule dates in `preparedSchedule.gamesByDate`, not every calendar date or only roster-playing dates. Keep that denominator explicit and consistent across comparisons.

### Goalies

Reuse shared goalie forecasts and starter evidence; add the missing league-aware planning layer.

- Separate credited minimum progress, confirmed upcoming starts, and projected opportunities.
- Determine whether the league counts starts, appearances, or another measure, and apply its actual minimum penalty.
- Warn first; reserve acquisition budget for coverage only after the manager chooses it.
- Coverage mode targets the remaining deficit using legal forecast opportunities, while clearly distinguishing projected coverage from a satisfied requirement.
- Default timing preference is Mon–Thu/Fri–Sun; offer Mon–Wed/Thu–Sun. Apply league-local dates and only remaining actionable opportunities. For atypical periods, show the explicit dates rather than silently forcing a standard week.
- If the preferred window cannot cover the deficit, report that and offer alternatives; do not silently spend outside it.
- Show skater opportunity cost and retain goalie outcome recommendations when minimum risk is accepted.
- Model possible starters for a team-game as mutually exclusive. B2B summaries show dates/opponents, unique available goalies, confirmed starts, and projected opportunities separately.
- Treat backup rotation and weaker-opponent assignments as hypotheses supported by team-specific evidence.
- Continue evaluating ratio and points downside after minimum coverage is achieved.

### Shared forecast readiness and evaluation

Use the shared FORGE/Player Forecasts infrastructure, including issued revision IDs, input capture, settlement, and existing validation policies.

The initial RSO reader should consume validated issued FORGE game revisions where supported. Player Forecast outputs can supplement or replace targets only when their serving/readiness gates permit it. Do not silently substitute season totals for missing per-game forecasts. The approved FE-01–FE-11 extension permits separately versioned, labeled, release-gated contribution-rate baselines applied lazily to actual games. Conditional rates without compatible participation may only break comparable schedule-capacity ties; they cannot establish unconditional totals or quality-based acquisition comparisons.

For custom horizons beyond available forecasts, retain schedule planning for the entire selected range. Mark uncovered games and suppress full-horizon outcome claims rather than extrapolating silently.

Extend shared evaluation only for missing supported targets, particularly goalie components and ratio denominators. Preserve forecasts as issued, model/input versions, conditioning, cutoff time, and corrections.

Evaluate separately:

- Projection errors and interval coverage by horizon/stat/player population.
- Starter/participation probability quality.
- Recommendation performance against optimized no-move and AGP alternatives.
- Paired differences between complete plans using the same game scenarios, retaining shared-player/game dependence.

Use time-ordered validation and respect existing protected holdouts. Existing validation infrastructure is not proof its release gates have passed. Until calibration is supported, comparisons remain provisional; no invented confidence percentage or “65%” target is introduced.

## 4. Workspace, persistence, and access

### Interface

Follow the canonical style guide and existing shared tokens: solid dark panels, neutral borders, compact spacing, restrained cyan, Train One accents, Roboto Condensed text, and Martian Mono numbers.

Desktop composition:

- Compact context controls and acquisition/AGP/outcome/goalie summary.
- Left roster panel with protections and defensible drop candidates.
- Dominant central itinerary grid.
- Right alternatives/detail panel linked to the selected date, player, or step.

Streaming rows show holds or player sequences, add/drop events, prerequisites, cost, active/bench opportunities, and conditional legs. Full suggested lineups are accessible within the workspace without pushing the itinerary below unchanged roster rows.

Reuse date/opponent/logo presentation from Game Grid where extraction is small and useful. Keep RSO timeline logic separate from its team-row loader.

Add an RSO-specific application-shell variant to the existing layout: site navigation participates in the height budget, desktop footer behavior follows the workspace precedent, and panel bodies scroll. Verify no document scrolling at **1440×900 and 1920×1080**.

Mobile defaults to **Itinerary**, with **Roster**, **Candidates**, and **Matchup** workspaces. Preserve selection and scroll context. Use a compact date selector and an optional seven-day comparison; do not stack desktop panels. Account for fixed site navigation and safe areas.

Provide keyboard operation, visible focus, text status beyond color, and distinct selected/proposed/comparison states.

### Persistence and reconciliation

Use a versioned local workspace envelope for one retained browser/device workspace. Store setup progress, reviewed identity mappings, roster, settings, intent, and compact snapshot metadata. Avoid storing the whole projection catalog or credentials. Surface storage failures and retain the in-memory workspace.

Account persistence uses one row per user/provider-or-manual-context/league/team/season/horizon. Store versioned intent and the last saved input snapshot separately from proposed revisions. No named itinerary collection.

Use optimistic concurrency: save with `expectedVersion`; conflicting cross-device edits return a conflict and preserve local intent instead of silently overwriting.

Server handlers verify ownership and capabilities on every operation. New tables need explicit grants/RLS and cross-account denial tests; service-role access remains server-only. This follows the distinction between table privileges and row policies in the [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security).

Premium upkeep:

- Refresh on open/resume and while the workspace is actively visible.
- Proposed starting cadence: five-minute freshness checks, reusing source caches and backing off on errors/rate limits.
- Cancel obsolete requests and worker calculations on context changes.
- Assemble a coherent snapshot before recomputing baselines and alternatives.
- Re-evaluate selected intent; flag invalid targets, altered budgets, changed goalie evidence, and obsolete steps.
- Present material repairs for acceptance. Refresh never replaces selected moves.
- Confirm actual roster changes from authoritative read evidence; local selection alone never means execution.
- Undo changes local planning intent, never provider transactions, realized results, or authoritative history.

### Free/premium matrix

| Capability | Free/manual | Active premium | Expired premium |
|---|---|---|---|
| Same optimizer, recommendations, sequences, goalie analysis | Yes | Yes | Yes through manual planning |
| Shared schedule/forecast reads during analysis | Yes | Yes | Yes |
| One local retained workspace and undo | Yes | Yes | Yes |
| Supported provider synchronization | No | Yes | No |
| Account saves and editable cross-device continuation | No | Yes | No |
| Automatic league-specific upkeep and proposed repairs | No | Yes | No |
| Previously saved account snapshot | Not included | Read/write | **Read-only; retained** |
| Ordinary account/provider connection | Existing behavior | Existing behavior | Existing behavior |

The expired-access policy above is now owner-approved. No automatic saved-plan deletion is introduced. Continuing the current device manually does not create account saves or resume premium upkeep.

### In-season entitlement design

Introduce shared internal capabilities such as `rso_sync`, `rso_account_save`, and `rso_auto_upkeep`, under an in-season product family independent of its eventual marketing name.

Resolve access as the union of independently valid grants: purchase, season grandfathering, common preview, and Patreon. Expiration or revocation of one grant cannot invalidate another.

Patreon qualification is now owner-approved: verified paid active membership in the configured FHFH campaign across all tiers, excluding free trials and ineligible charge states, following existing verification behavior.

Preserve existing Stripe/Draft Pro contracts. Add new commerce fulfillment only after commercial terms are confirmed. Grandfather/preview grants need distinct auditable source references so they cannot overwrite each other.

## 5. Dependency-ordered tasks and requirement traceability

Owners below are proposed execution responsibilities, not agents already created.

| Task | Stable requirements and work | Dependencies | Proposed owner / likely area |
|---|---|---|---|
| **T1 — Contracts and evidence fixtures** | **RSO-01:** canonical identity, manual inputs, provenance and degradation. **RSO-02:** calendar, supported rule profiles, locks, acquisition accounting and read-only provider boundary. Validate forecast/provider feasibility before freezing contracts. | None | Chef; RSO types, provider parsers, schedule readers, existing fixtures. |
| **T2 — Shared data and forecast serving** | **RSO-03:** season-aligned schedule, public player search, reviewed paste candidates, forecast/ownership/form evidence and truthful coverage. **RSO-04:** shared forecast evaluation and plan-difference uncertainty. | T1 | Bounded data/forecast worker; shared projections and forecast modules, RSO API readers. |
| **T3 — Free/manual vertical slice** | **RSO-05:** legal no-acquisition assignment, AGP/outcome objectives and metric definitions. **RSO-06:** manual setup, local recovery and undo. **RSO-07:** integrated itinerary/grid and responsive shell. Include safe single-step comparisons as the first itinerary form. | T1; usable T2 data contract | Engine worker and UI worker with separate ownership; Chef integrates shared matcher extraction. |
| **T4 — Joint acquisition search** | **RSO-08:** multiple streaming slots, holds, sequential moves, period budgets, capacity, reserve prerequisites, conditional waivers and future alternatives. **RSO-09:** safe drops, protections, ownership handling, ranked alternatives, no-move results, gross/net gains. | T3 | Engine worker; timeline, search and recommendation modules. |
| **T5 — Matchup and goalie intelligence** | **RSO-10:** opponent/category strategy, ratios, lower-is-better categories, inferred demand, form context. **RSO-11:** minimum progress, explicit coverage choice, timing splits, B2B evidence, goalie downside. | T2–T4 | Chef owns objective/minimum integration; bounded forecast work may run alongside T4. |
| **T6 — Connected inputs** | **RSO-12:** Yahoo authorized snapshots, availability, opponent/scoreboard and rule coverage; truthful Fantrax capabilities. Reuse shared parsing without altering Draft Pro access. | T1; integrates with T2–T5 | Provider worker; Yahoo/Fantrax adapters and RSO snapshot route. |
| **T7 — Access, account persistence and upkeep** | **RSO-13:** free/premium parity, alternative grants, approved expiry/Patreon policy, cross-account isolation, context-specific account plan. **RSO-14:** refresh/reconciliation and non-destructive repair proposals. | T1, T3, T6; policy configuration gates activation | Chef owns access/security; bounded persistence/UI work follows approved contracts. |
| **T8 — Daily beta validation** | **RSO-15:** performance, cancellation, real-layout checks, end-to-end workflows and accurate release labeling. Test both free/manual and premium/connected. | T2–T7 | Independent reviewer plus Chef integration review. |
| **T9 — Weekly locks and full launch** | **RSO-16:** fixed lineup windows, legal week-long acquisitions, goalie/category interactions and complete weekly verification. | Rules designed in T1; engine T4/T5; integration T6/T7 | Chef/engine worker, followed by independent review. |

T2 and provider feasibility in T6 begin early after T1. Weekly rule fixtures and algorithm design also begin in T1; T9 is the completion gate, not permission to postpone discovering incompatibilities.

## 6. Verification, performance, and release gates

### Acceptance matrix

| Evidence | Requirements/tasks | Required scenarios |
|---|---|---|
| **A — Input/access parity** | RSO-01/03/06/12/13; T1–T3/T6/T7 | Identical canonical snapshots produce identical free/premium results; ambiguous pasted names require review; local recovery; account resume; unauthorized sync/save and cross-account requests denied. |
| **B — Lineup correctness** | RSO-02/05/08; T1/T3/T4 | Unset lineups, bench participation, multi-position/UTIL, duplicate prevention, locks, roster capacity, IR prerequisites, jointly feasible sequences, coherent baselines. |
| **C — Time and rules** | RSO-02/08/16; T1/T4/T9 | Midweek/completed games, same/next-day effects, custom-range budget resets, waivers, actual matchup boundaries, time-zone/DST boundaries, unsupported mixed rules, weekly locks. |
| **D — Recommendations/outcomes** | RSO-04/09/10; T2/T4/T5 | Protected holds, unknown ownership/availability, no worthwhile move, fewer-than-requested safe alternatives, displaced starts, close plan comparisons, ratios, missing opponent data, inferred demand and no form double-counting. |
| **E — Goalies** | RSO-11; T5 | Credited versus projected progress, no automatic budget reservation, both timing splits, impossible preferred windows, mutually exclusive starters, minimum penalties, post-minimum ratio/points risk. |
| **F — Persistence/refresh** | RSO-06/13/14; T3/T7 | Undo, refresh/reload, context switches, stale responses, concurrent saves, unavailable future targets, preserved selections, actual-versus-selected transactions, overlapping grants and expiry. |
| **G — UI/performance** | RSO-07/15; T3/T8 | Both desktop sizes with navigation and expanded states; mobile workspace switching; keyboard use; large rosters/pools; stale/partial/empty/error states; responsive cancellation. |

Extend the existing optimizer, component, schedule API, Yahoo parsing, forecast, goalie, and access tests where relevant. Add focused sequence/reconciliation tests and one RSO Playwright workflow spec because those behaviors are new; do not create a test file for every component.

Use tiny exhaustive fixtures as an oracle for matching and sequence search. Test negative-value starts, beneficial sits, multi-step combinations that beat individually attractive swaps, and deterministic results.

Run checks from `web/` with Node **22.11.0** and npm:

- Focused Vitest: `npm test -- --run <affected-test-paths>`.
- Type-check/lint after relevant TypeScript integration.
- Targeted RSO Playwright execution for browser behavior; discovery alone is not a pass.
- Local database access tests for anonymous, owner, other account, active premium, expired premium, and alternate grants.

No routine full build, dependency installation, remote build, deployment, or data-update job is required.

### Bounded search and proposed performance budgets

Before tuning search, measure the existing baseline and candidate evaluation with fixtures covering:

- 25-player roster, 300 candidates, seven days, four acquisitions.
- 35-player roster, 1,000 candidates, 28 days crossing four budget periods.
- Multi-position congestion, two streaming slots, goalie uncertainty, and category objectives.

Place sequence search in a cancellable browser worker using the same engine for both tiers. Keep network/provider reads on the server. Use exact assignment where applicable and bounded beam search for sequences, retaining separate outcome/AGP frontiers and the no-move path.

Prune illegal transitions first, deduplicate equivalent timeline states, and remove dominated states only when future legal choices and dependencies are equivalent. Shortlisting must retain positional/date/goalie diversity and disclose candidate coverage.

Cache by complete relevant snapshot/rules/intent/objective identity; never cache outcome values solely by NHL team and eligibility.

Proposed targets, to validate rather than claim:

- Local edits visibly respond within 100 ms.
- Typical baseline calculation within 250 ms.
- Typical itinerary alternatives within two seconds.
- Stress cases return a feasible provisional result within five seconds.
- Cancellation/context replacement acknowledged within 100 ms.

Tune beam width and candidate limits against these fixtures. On budget exhaustion, return the best feasible result with search limitations. Never silently shorten the requested horizon, remove budget periods, or label heuristic output globally optimal.

### Release matrix

| Gate | Required completion |
|---|---|
| **Local manual milestone** | T1–T3 pass; usable setup, local retention, optimized baseline and itinerary interaction. This is not the full approved feature. |
| **Controlled daily beta** | T2–T8 pass for declared daily rule/scoring profiles, including both manual and Yahoo-connected workflows, sequences, goalie logic, persistence and access. Data limitations are visible. Weekly/mixed profiles cannot receive daily itineraries. |
| **Full launch** | Daily gates plus T9 weekly support and evidence B/C/E/F/G under weekly locks. Supported category/goalie primitives work; missing input degrades only dependent conclusions. No indefinite weekly deferral. |
| **Calibrated claims** | Shared validation evidence supports the specific target/horizon/claim. Until then, outcome comparisons remain provisional, including after launch. |
| **External release** | Separately authorized migrations/deployment and applicable commercial/grant operations; live provider readiness confirmed. Local tests do not satisfy this gate. |

The season-opening preview clock is independent of RSO readiness. If gates are incomplete at its approved start, report that conflict; do not shift the clock or claim full readiness.

## 7. Remaining owner decisions and operational approvals

The expired-plan and Patreon policies are resolved as described above. Remaining decisions are deliberately isolated from the core engine:

| Decision | Blocks |
|---|---|
| Final name, price, billing model and purchase term | New purchase flow, marketing and paid fulfillment activation. |
| Exact opening puck-drop timestamp, time zone, common preview boundaries, eligibility cutoff and late-purchase treatment | Preview grant activation. |
| Qualifying first-100 customer definition, duplicate/refund/complimentary handling, stable ordering and grandfather end-of-day time zone | Auditable grandfather cohort and grant activation. |

Do not inspect customer/billing records or publish grants as an implied implementation step. After authorization, prepare a read-only cohort report with qualifying source records, exclusions and proposed grant boundaries for owner review before mutation.

Production migrations, provider credential operations, data publishing/backfills, billing/grant mutations, remote builds and deployment require applicable separate authorization. Provider lineup changes, claims, bids and transactions remain excluded permanently from RSO.

## 8. Chef and Prep List setup after execution authorization

Follow the existing [mise-en-place.md](/Users/tim/Code/fhfhockey.com/mise-en-place.md) and task-list convention; create no additional playbook.

1. Inspect current chats/sections and repository identity. Prefer promoting this chat: rename it exactly **`CHEF — Roster Schedule Optimizer`** and place it in **`Roster Schedule Optimizer`**.
2. Requested lead settings are **GPT-6 Astra / High**. Actual runtime settings were not verified in this planning pass. Record requested and verified settings separately; keep work with the lead if delegation requirements cannot be verified.
3. Start one explicit execution goal without an invented token budget.
4. Save the approved requirements under `tasks/prd-roster-schedule-optimizer.md` and create `tasks/tasks-prd-roster-schedule-optimizer.md`, titled exactly **`Prep List`**, with Relevant Files, Notes, numbered tasks, requirements, owners, dependencies, gates and actual evidence.
5. Recheck user changes and attached worktrees. Preserve all unrelated work. If isolation is needed, use the managed worktree tool and a `chef/<descriptive-name>` branch.
6. Delegate only bounded independent work, with explicit file ownership. Proposed workers are Sol/Medium for substantive implementation and Luna/Low for narrow checks; verify actual settings and keep Chef’s effort higher. Respect the four-agent runtime limit, including Chef.
7. Chef owns coupled objective/rule/access decisions, integration, independent review and delivery. Workers cannot expand scope, recursively delegate or perform external actions without authorization.
8. Track local completion, daily beta, weekly/full-launch completion, and external release separately. A daily beta does not complete the approved scope.
