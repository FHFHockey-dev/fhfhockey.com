BEGIN REPOSITORY AUDIT
Authority and audit basis
Product authority: [product-strategy.md](/Users/tim/Code/fhfhockey.com/tasks/TASKS/draft-ranker/product-strategy.md)
Execution contract: [goal-prompt.md](/Users/tim/Code/fhfhockey.com/tasks/TASKS/draft-ranker/goal-prompt.md)
Architecture authority: repository code, canonical migrations, generated types, and the linked Supabase project as inspected on July 14, 2026.
No files, migrations, or database records were changed during planning.
Existing architecture
Application and state
Next.js 15 Pages Router with React 18.
Global authentication and TanStack Query providers are established in [\\_app.tsx](/Users/tim/Code/fhfhockey.com/web/pages/_app.tsx).
[AuthProviderContext](/Users/tim/Code/fhfhockey.com/web/contexts/AuthProviderContext/index.tsx) provides the current Supabase user and account state.
Server state conventions are mixed between TanStack Query, SWR, and direct fetches. The ranker should standardize on TanStack Query, already globally installed.
Local interaction state can remain in component hooks or reducers. No major state-management architecture is required.
Framer Motion is available for list movement and homepage-preview animation.
Canonical player identity
The live players table has 3,533 rows. Its id bigint is the NHL player ID, not an internal FHFH-generated identity.
Evidence:
[update-players.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-players.ts) writes player.id from NHL roster responses directly into players.id.
[NHL server access](/Users/tim/Code/fhfhockey.com/web/lib/NHL/server/index.ts) joins players, rosters, teams, and seasons using that identity.
[player API](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/player/index.ts) exposes current-season roster players.
upsert_current_roster_membership and numerous statistics/projection tables use NHL IDs.
Consequences:
players is the correct NHL-linked analytics record.
It cannot represent a prospect without an NHL ID safely.
Reassigning its primary key would require widespread destructive migration.
Nine duplicate full-name groups currently exist. Names cannot be identity keys.
Approximately 897 records currently have no team, so team is not a reliable identity attribute.
Existing identity bridges
rosters: 4,075 rows, including roughly 3,900 current memberships.
yahoo_players: 2,827 seasonal/provider records.
yahoo_nhl_player_map: 1,857 mappings.
Existing unmatched Yahoo population: approximately 370 records.
[yahooMapping.ts](/Users/tim/Code/fhfhockey.com/web/lib/draftDashboard/yahooMapping.ts) resolves multiple Yahoo candidates using player type, positions, current team, and current Yahoo-game details. Ties remain unresolved.
[projectionRowSelection.ts](/Users/tim/Code/fhfhockey.com/web/lib/draftDashboard/projectionRowSelection.ts) handles duplicate source rows using current team, games played, and stable tie-breaking.
[projectionSourcesConfig.ts](/Users/tim/Code/fhfhockey.com/web/lib/projectionsConfig/projectionSourcesConfig.ts) describes existing projection tables and NHL-ID mappings.
[nameStandardization.ts](/Users/tim/Code/fhfhockey.com/web/lib/standardization/nameStandardization.ts) contains extensive manual name normalization, including acknowledged same-name ambiguity. It is useful for candidate generation, not automatic identity merging.
lineup_player_name_aliases and lineup_unresolved_player_names provide an existing review-queue pattern.
[player-name-aliases.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/player-name-aliases.ts) and [player-aliases.tsx](/Users/tim/Code/fhfhockey.com/web/pages/db/player-aliases.tsx) provide reusable administrative review conventions.
There is no comprehensive canonical prospect table or ingestion system.
Yahoo ADP seed
For Yahoo season 2025:
1,494 rows have draft_analysis.
Approximately 1,327 have usable scalar ADP.
draft_analysis.preseason_average_pick is the authoritative preseason value where it parses as a positive number.
Invalid values such as "-", null, and zero must be classified explicitly and never treated as real ADP.
player_key is provider/game-specific and should not become the permanent identity.
The 2026–27 initial seed can use the verified 2025 preseason ADP in ascending order.
Every valid mapped Yahoo ADP player may populate the continuous ordered list, not only the first 250.
Authentication and ownership
Reusable account infrastructure is strong:
[requireApiUser.ts](/Users/tim/Code/fhfhockey.com/web/lib/api/requireApiUser.ts) validates bearer sessions.
[Supabase browser utilities](/Users/tim/Code/fhfhockey.com/web/lib/supabase/index.ts) can create a user-token client.
[server.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/server.ts) exposes a lazy service-role client.
[ensureUserRecords.ts](/Users/tim/Code/fhfhockey.com/web/lib/user-settings/ensureUserRecords.ts) establishes account profile/settings rows.
[auth baseline migration](/Users/tim/Code/fhfhockey.com/supabase/migrations/20260713055508_auth_user_settings_platform_baseline.sql) establishes UUID ownership, cascading deletion, provider accounts, league settings, sync runs, and entitlements.
Existing user-owned tables consistently reference auth.users(id) ON DELETE CASCADE.
user_settings already stores league type, scoring categories, category weights, roster configuration, UI preferences, and active provider context.
The ranker does not require an authentication-model change.
Supabase conventions and risks
supabase/migrations/ is the documented canonical migration path.
Historical SQL also exists under root migrations/ and web/supabase/migrations/. This fragmentation must not be expanded.
Generated types live in [database-generated.types.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/database-generated.types.ts).
Existing owner policies use auth.uid() = user_id; newer optimized policies use init-plan-friendly forms.
Public analytical data commonly uses RLS-enabled service-only storage exposed through APIs.
New ranker tables require explicit authenticated grants and RLS. New public views should use security_invoker=true where applicable.
The current Supabase security advisor reports substantial pre-existing warnings, including publicly executable SECURITY DEFINER functions such as public.execute_sql. These are not created by the ranker, but they are a launch-security risk that must be triaged before exposing additional write RPCs.
The live database is Postgres 15 and has an outstanding patch-upgrade advisory.
Existing ranking and draft functionality
The existing /rankings feature is an analytics workstation, not a personal draft list:
[rankings.tsx](/Users/tim/Code/fhfhockey.com/web/pages/rankings.tsx)
[Rankings components](/Users/tim/Code/fhfhockey.com/web/components/Rankings)
[contextual-rankings API](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/contextual-rankings.ts)
[rankings browser tests](/Users/tim/Code/fhfhockey.com/web/e2e/rankings.spec.ts)
Reusable systems include:
Dense, accessible table presentation.
URL-restorable filters.
Confidence/sample-state formatting.
Explanation panels.
Snapshot/history conventions.
Performance-check scripts.
The personal draft ranker should not take over /rankings. Recommended routes:
/draft-rankings for the account-backed personal ranker.
/community-draft-rankings for the public aggregate.
The existing [DraftDashboard](/Users/tim/Code/fhfhockey.com/web/components/DraftDashboard) supplies useful projections, scoring utilities, table styles, comparison presentation, CSV parsing, and draft interactions. Its state is local/session-oriented and must not become authoritative ranker persistence.
Search and autocomplete
[PlayerAutocomplete](/Users/tim/Code/fhfhockey.com/web/components/PlayerAutocomplete/PlayerAutocomplete.tsx) downloads the current NHL roster pool and searches names client-side.
[Predictions SearchBox](/Users/tim/Code/fhfhockey.com/web/components/Predictions/SearchBox.tsx) performs a direct ilike search against players.fullName.
Neither implementation supports the required universe, archived states, stable disambiguation, prospects, or identity review. A server-side FHFH identity search contract is required.
Homepage
The homepage is already undergoing substantial work and has its own dashboard/component architecture. The ranker must enter through a contained, feature-flagged module boundary. It must not replace the homepage wholesale.
The approved behavior is:
Blind-by-default pairwise card.
Ten-player animated personal preview.
Existing transaction/offseason module boundaries preserved.
No broad homepage architecture rewrite.
Exports
Papa Parse and json2csv are installed.
Draft Dashboard supports CSV import and JSON/image exports.
No XLSX library is installed.
The product authority places CSV and JSON at launch and XLSX in phase two.
Testing and observability
Vitest is the main unit/integration framework.
Playwright provides real-browser coverage.
The repository contains roughly 661 test/spec files.
npm run test:full, npm run build, and targeted ranking performance scripts are established gates.
[withCronJobAudit.ts](/Users/tim/Code/fhfhockey.com/web/lib/cron/withCronJobAudit.ts) records status, duration, affected/failed rows, and bounded response/error details into cron_job_audit.
[vercel.json](/Users/tim/Code/fhfhockey.com/vercel.json) owns HTTP cron scheduling.
Provider sync runs demonstrate dedupe keys, cooldowns, status transitions, and structured result/error summaries.
Planning-document conventions
Repository planning commonly uses:
A PRD or strategy document.
A task list with “Relevant Files,” dependencies, checkboxes, notes, and verification evidence.
Goal/progress documents that persist decisions, blockers, current phase, and next task.
Separate audit, runbook, and QA artifacts under tasks/artifacts/.
References:
[create-prd.mdc](/Users/tim/Code/fhfhockey.com/tasks/TASKS/rules/create-prd.mdc)
[generate-tasks.mdc](/Users/tim/Code/fhfhockey.com/tasks/TASKS/rules/generate-tasks.mdc)
[auth task plan](/Users/tim/Code/fhfhockey.com/tasks/TASKS/auth-user-settings-platform/tasks-prd-auth-user-settings-platform.md)
[contextual rankings task plan](/Users/tim/Code/fhfhockey.com/tasks/TASKS/contextual-hockey-rankings/tasks-prd-contextual-hockey-rankings.md)
Reusable systems
Existing Supabase Auth and UUID ownership.
Owner-scoped RLS patterns.
Bearer-authenticated Pages API routes.
Lazy service-role access for controlled aggregation and administration.
Yahoo-to-NHL mapping diagnostics.
Projection-source configuration and duplicate-row selection.
Alias-review administration.
Account scoring and league-setting snapshots.
TanStack Query, TanStack Table, and Framer Motion.
Ranking table, explanation, confidence, and snapshot UI patterns.
Vitest, Playwright, cron auditing, performance scripts, and structured sync runs.
Missing capabilities
Stable FHFH identity independent of NHL and Yahoo IDs.
Canonical prospects without NHL IDs.
Provider/season-aware external identity mappings.
Account-owned ranking sets and entries.
Atomic sparse ordering and repair.
Immutable ranking/comparison evidence.
Candidate bench, watchlist, and placement sessions.
Server-side canonical search.
Pairwise queue and consent handling.
Community aggregation and public snapshots.
Explainable ranker discovery.
Ranker-specific exports.
Ranker monitoring, repair tools, abuse controls, and rollout flags.
Conflicts and risks
players.id cannot become the universal identity without destructive migration.
Name normalization is not safe as identity resolution.
Existing Yahoo mappings contain unresolved and duplicate cases.
No comprehensive prospect source exists.
/rankings is already occupied by a separate product.
Draft Dashboard persistence is local, not account-backed.
Migration directories are fragmented.
The worktree is heavily dirty, including auth, homepage, generated types, and draft-ranker documents. Execution must preserve unrelated changes.
Current Supabase security-advisor warnings require triage before ranker write RPC rollout.
Only about 14 accounts currently exist. Community outputs will initially be market-seeded or “building evidence”; they cannot honestly claim broad consensus.
Public community behavior must remain distinct from private personal order.
Projection, ownership, and roster sources have different freshness and season semantics.
Previously undrafted players require explicit missing-ADP representation, not zero or fabricated values.
Existing rate-limiter-flexible dependency is not a demonstrated distributed rate-limit convention; serverless-safe limits need database-backed or platform-backed enforcement.