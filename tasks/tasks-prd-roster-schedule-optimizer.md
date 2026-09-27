# Prep List

## Relevant Files

- `tasks/prd-roster-schedule-optimizer.md` — approved requirements, RSO-01–16 and evidence A–G.
- `web/lib/rosterScheduleOptimizer/` — existing daily optimizer plus new planning domain, timeline, objectives and search.
- `web/components/RosterScheduleOptimizer/` — itinerary workspace and manual setup.
- `web/pages/api/v1/roster-schedule-optimizer/` — public data, authorized provider snapshots and account persistence.
- `web/lib/in-season/` — distinct capabilities and access policy.
- `supabase/migrations/` — established schema lineage; local migration files only until separately authorized.
- Existing optimizer/component/schedule/forecast/provider/access tests and focused new sequence/workspace tests.

### Notes

- Execution authorized; no provider writes, remote builds, deployments, grants, billing mutations, customer billing inspection, or production migrations/backfills.
- Chef requested **gpt-6-astra/high**, verified from this chat's latest runtime turn_context on 2026-09-26. Thread `01a0e107-0dfe-7951-8953-0a39b4c33841`, section `62347826-8119-4289-ac09-76368e01588a`.
- Managed workspace: `/Users/tim/.codex/worktrees/roster-schedule-optimizer/fhfhockey.com`, branch `chef/roster-schedule-optimizer`, base `db9c935352ca0a1c5b3f322abf2d7ea2db3e4de9`. Original checkout's nine Draft Dashboard modifications are untouched.
- Existing Node 22.11.0 dependencies reused through a local node_modules symlink; no install or lockfile change.
- Workers verified from runtime turn_context as `gpt-6-sol/medium`: planning engine `01a0e111-7837-75f2-b3a9-aeb3befd44bd`; workspace UI `01a0e111-c6e5-7683-b2b1-9e017938972b`; access/persistence `01a0e112-106b-7c23-a3af-b06acc99d0c9`. Chef remains `gpt-6-astra/high`; no recursive delegation or external actions.
- Test commands run from `web/`: `npm test -- --run <paths>`, then warranted type/lint checks and targeted Playwright. No current test pass is implied by historical audit.
- Approved policies: expired account plans retained read-only, no sync/save/upkeep; local manual use continues. Patreon uses existing verified paid active campaign membership across tiers, excluding trials/ineligible charges.
- Open external policy gates: product name/price/term/billing; preview timestamp/timezone/eligibility; first-100 qualifying cohort/edge cases and grandfather end timezone. No guessed grant activation.

## Tasks

- [x] 1.0 Contracts and fixtures — Chef; RSO-01/02; evidence A/B/C
  - [x] 1.1 Confirm authorization, preserve user changes, establish isolated checkout and coordination.
  - [x] 1.2 Define canonical snapshot/rules/intent/results and provider capabilities; cover daily and weekly semantics from the start.
  - [x] 1.3 Validate boundaries with focused fixtures; preserve legacy Draft Dashboard interfaces.
- [x] 2.0 Shared data and forecast serving — Chef; depends 1.2; RSO-03/04; A/D/E
  - [x] 2.1 Public date-range schedule/catalog/forecast reader with explicit season/provenance/coverage; no admin leakage. League-zone date normalization includes padded source reads.
  - [x] 2.2 Shared issued-revision/goalie evidence integration and evaluation gaps; never manufacture calibration.
- [x] 3.0 Free/manual workspace — UI worker + engine worker; depends 1.2/2.1; RSO-05/06/07; A/B/F/G
  - [x] 3.1 Reviewed paste/search, settings, local retention and undo.
  - [x] 3.2 Optimized no-move objectives and common baseline, itinerary/grid, mobile workspaces and desktop viewport shell.
- [x] 4.0 Joint search — engine worker; depends 3.2; RSO-08/09; B/C/D/G
  - [x] 4.1 Legal occupancy, reserve prerequisites, conditional waivers, reset budgets, multiple streaming slots and no-move alternative.
  - [x] 4.2 Safe protection/drop rules, ranked alternatives, gross/net starts and bounded cancellable search.
- [x] 5.0 Matchup and goalies — engine worker with Chef review; depends 2/4; RSO-10/11; D/E
  - [x] 5.1 Points/categories including ratios, opponent context and uncertainty limitations.
  - [x] 5.2 Minimum progress/choice, timing windows, mutually exclusive starts, downside and B2B evidence.
- [x] 6.0 Connected inputs — Chef; depends 1.2; RSO-12; A/C/D
  - [x] 6.1 Yahoo read-only adapter using authorized transport and explicit capability/freshness/identity limits.
  - [x] 6.2 Fantrax supported identity/settings boundary, no draft-derived current roster claims.
- [x] 7.0 Access/persistence/upkeep — access worker + Chef/UI integration; depends 1.2/3/6; RSO-13/14; A/F
  - [x] 7.1 Alternative in-season grants and server capabilities without altering Draft Pro/OAuth behavior. Activation records remain unconfigured.
  - [x] 7.2 Version-checked context workspace saves, expired reads, owner isolation and local migration/SQL test files. API denial/CAS and isolated PostgreSQL role/CAS tests pass.
  - [x] 7.3 Visible-session refresh, coherent snapshots and proposed repairs preserving selected intent.
- [x] 8.0 Daily beta verification — Chef + independent review; depends 2–7; RSO-15; A–G
  - [x] 8.1 Focused unit/API tests, type/lint, worker measurements and tiny exhaustive oracle checks.
  - [x] 8.2 Playwright real-layout/workflow checks at 1440×900, 1920×1080 and mobile, both input/access modes.
  - [x] 8.3 Independent diff/security/correctness review and documented live-data release gaps.
- [x] 9.0 Weekly/full scope — engine worker + Chef; depends 4/5/6/7; RSO-16; B/C/E/F/G
  - [x] 9.1 Fixed lock-window assignments and additions, mixed-rule detection, goalie/category integration.
  - [x] 9.2 Weekly fixtures/browser checks; distinguish local completion, daily beta and full launch.

## Verification and release evidence

- Chef's final shared-data/forecast/access batch: **55 distinct tests passed across six files** (54 in the combined run, then seven schema tests after adding one DST regression) (`rosterScheduleData/planning`, `planComparison`, `playerForecasts`, Yahoo `rosterPlanning`, in-season `access` and `workspaceSchema`). Public serving tests include league-local dates, canary rollout, forecast sanitization and mutually exclusive goalie probability mass. These use fixtures, not live providers.
- Chef's final legacy/core persistence batch: **47 tests passed across five files** (`optimizer`, `workspace`, `providerRules`, `reconciliation`, `workspaceRoutes`). Anonymous/other-account reads and writes, optimistic concurrency, alternative grants, expired access and provider authorization precede fetches in mocked API tests.
- Shared paired-plan sensitivity uses identical game draws for both fixed complete lineups. Counting-stat stresses are explicitly not probability/calibration claims. Goalie settlement records observed components and ratio denominators; missing actual starter flags remain unsupported. No settlement or publishing job was run.
- Chef's targeted ESLint passed for shared schedule, Yahoo integration, forecast/evaluation and data/provider routes. Engine and E2E lint pass; UI lint has zero errors and five dependency-array warnings. Final diff whitespace check passes.
- Engine: **39 planning tests passed**, including whole-window midpoint/bench locks, UTC+14 period boundaries, New York DST bench release, both goalie timing splits, mutually exclusive starters and post-minimum downside. Six shared-matcher/legacy today-assignment tests passed. Tiny exhaustive assignment and two-slot sequence oracles pass. Shared league-local date helpers live in `planningDates.ts`. Category refinement and sequence search remain bounded heuristics.
- Chromium: **6/6 tests passed** with `npx playwright test e2e/roster-schedule-optimizer.spec.ts --project=chromium` (14.6 seconds). Includes realistic Alpha→Bravo→Charlie itinerary, authenticated mocked provider refresh preserving intent, local recovery, mobile workspace switching, weekly midpoint lock and expanded layouts at 1440×900 and 1920×1080. Browser mocks do not establish live Yahoo readiness. Component/helper tests pass (eight component tests plus the five workspace/rules/reconciliation tests already counted above).
- Independent screenshot review caught fixed-navigation overlap missed by the original height-only test. The scoped desktop shell now constrains the ClientOnly wrapper and gives panel bodies their own scroll area; tests check header/setup/summary bounds and window/body scroll. Chef inspected the corrected expanded 14-day screenshot. Independent browser review also found the weekly midpoint lock, now fixed and passing.
- Full TypeScript **passed** with `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --pretty false`; the default 4 GB heap was insufficient. No production build, npm dependency installation or remote build occurred.
- **Local SQL verification passed.** Initially blocked by stopped Docker and missing native postgres; resolved by starting the existing Colima profile and using cached `public.ecr.aws/supabase/postgres:15.8.1.085` in an isolated `--network none` container with temporary storage. Applied the existing `update_updated_at_column` function and the new migration, then executed `supabase/tests/in_season_access_workspace.sql` with `ON_ERROR_STOP=1`: anonymous/authenticated denial, RLS/privileges, independent grant references, owner isolation and stale-version CAS all passed. Test rows rolled back. No existing database was touched; the test container was removed and Colima restored to its prior stopped state. No image download or production migration occurred.
- Bounded sequence fixtures: 25 roster / 300 candidates / seven days / four acquisitions reached depth >1 in approximately 446 ms; 35 / 1,000 / 28 days / four periods returned at depth 2 after approximately 2,041 ms and 112 evaluations under a two-second budget. These measurements disclose incomplete search; they are not global-optimum or release-latency guarantees.
- **Local implementation milestone complete:** canonical data/engine, daily and weekly profiles, manual workspace, account/access persistence, reconciliation and local verification are implemented. Controlled daily beta and full launch are **not cleared**: authorized live provider contract/freshness/count/deadline evidence and production forecast/readiness checks remain release gates. Supported engine profiles are daily and fixed weekly windows; unknown/mixed provider semantics produce limitations or require labeled manager input. Yahoo acquisition rules remain manager-supplemented until verified. Fantrax current-roster/availability synchronization is explicitly unsupported; existing account identity/settings behavior is preserved.
- External release remains separately unauthorized. Marketing/purchase fulfillment, preview/grandfather grant activation and calibration claims remain gated by the approved owner decisions and evidence; no clock or entitlement cohort was invented.

## October branch integration — September 27

- The reported stale-cache/Week 1 controls were confirmed in `origin/octoberBranch`; the implementation had only existed locally.
- Preserved implementation in `chef/roster-schedule-optimizer` at `b39ac7c8c`. Created `chef/rso-october-integration` from `origin/octoberBranch` (`ac5728222`) and cherry-picked only RSO (`fb0da3b2d`), avoiding 32 unrelated master commits. Resolved Layout conflicts by retaining October's navigation/footer and adding only the scoped RSO shell.
- Access verification failures now display an explicit provider-sync explanation instead of silently disabling refresh. No access rules were bypassed.
- October-based verification: 31 focused Vitest tests and six Chromium workflows pass. Full TypeScript and targeted lint verification recorded with the integration commit.
- GitHub reports Vercel integrations on the destination branch. Push/build approval is distinct from the still-unapplied remote RSO migration and grant activation; no production database changes have been made.
