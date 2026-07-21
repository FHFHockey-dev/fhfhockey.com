# PRD: Date Range Matrix (DRM) Refactor

> **Implementation task list:** `tasks/TASKS/dead-code-cleanup/tasks-prd-drm-refactor.md`

Generated: 2025-09-12 13:27:53 UTC

## Overview
The DRM visualizes player-to-player time-on-ice relationships for a team over a date range. This refactor unifies data fetching and derivation into a single hook and separates rendering into a presentational component, reducing drift and simplifying future changes.

## Goals
- One data source of truth for DRM (raw shifts or aggregated inputs)
- Stable API (team abbreviation in, presentational props out)
- Easier to validate, test, and optimize
- Preserve current functionality with minimal UI changes

## Scope
- Add unified data hook to power DRM for both sources (raw and aggregated)
- Create a presentational, props-only DRMV (view) component
- Wire `web/pages/drm.tsx` to use the hook and view
- Refactor specialized component to use the unified hook (`DateRangeMatrixForGames`)

## Architecture
- Hook: `useDateRangeMatrixData(teamAbbreviation, startDate, endDate, mode, source, seasonType?, aggregatedData?)`
  - Returns: `{ loading, status, error, stale, source, coverage, teamId, teamName, roster, toiData, homeAwayInfo, playerATOI, lines, pairs }`
  - `source: 'raw'` → uses `getTOIDataForGames` from Supabase `shift_charts`
  - `source: 'aggregated'` → selects the explicit regular-season/playoff bucket and maps existing aggregated rows to typed `PlayerData`
  - Computes `lines` and `pairs` via `calculateLinesAndPairs` consistently in both paths
- View: `DateRangeMatrixView` → thin wrapper around `DateRangeMatrixInternal`
  - Renders grid given props, no fetching/derivation inside
- Page: `web/pages/drm.tsx`
  - Calls `useDateRangeMatrixData` with `source: 'aggregated'`
  - Owns canonical team ID, selected season ID/type, and exact date-window resolution before making one aggregate-reader request
  - Tags resolved aggregate/card results with the exact team/season/type/timeframe/date/game-ID/venue/opponent scope and masks any result whose identity no longer matches
  - Renders `DateRangeMatrixView` with results
- Cards: `LinePairGrid` and its skater/goalie cards are pure scoped consumers
  - Use the same mapped roster as the matrix and exact `skatersGameStats`/`goaliesGameStats` rows limited to post-filter matched game IDs
  - Hide unsupported or incomplete values instead of reading player-global buckets or retaining independent async state
- Specialized: `DateRangeMatrixForGames`
  - Simplified; now calls unified hook with `source: 'raw'`

Visible hook results are keyed to the exact request identity. A team/date/source/season transition synchronously masks prior roster and derived data before passive effects run, late completions cannot overwrite newer requests, invalid inputs reset to `idle`, and failed/empty last-N resolution clears the prior date range instead of reusing it.

## Updated Files
- `web/components/DateRangeMatrix/useDateRangeMatrixData.ts` (new)
- `web/components/DateRangeMatrix/useTOIData.tsx` and focused test (typed complete raw reader and partial-coverage contract)
- `web/components/DateRangeMatrix/DateRangeMatrixView.tsx` (new)
- `web/pages/drm.tsx` (updated to use hook + view)
- `web/components/DateRangeMatrix/DateRangeMatrixForGames.tsx` (refactored to hook)
- `web/components/DateRangeMatrix/fetchAggregatedData.ts` and focused test (complete fail-closed aggregate reader)
- `web/components/DateRangeMatrix/LinePairGrid.tsx`, `PlayerCardDRM.tsx`, `GoalieCardDRM.tsx`, and focused grid test (pure canonical-scoped card rendering and synchronous reset)
- `web/styles/LinePairGrid.module.scss` (supported goalie-card layout and explicit unavailable state)
- `web/components/DateRangeMatrix/utilities.ts` and focused test (date-owner error propagation)
- `web/lib/cron/combinedCronInventory.ts` and focused test (canonical pg_cron-plus-Vercel dependency, collision, and runtime-cap inventory)
- `web/lib/rollingPlayerOperationalPolicy.ts` and `web/pages/api/v1/db/run-projection-v2.ts` (one shared projection-route default budget contract)

## API Contracts
- Input (hook):
  - `teamAbbreviation: string` (canonical identifier)
  - `startDate, endDate: YYYY-MM-DD`
  - `mode: 'line-combination' | 'full-roster' | 'total-toi'`
  - `source: 'raw' | 'aggregated'`
  - `seasonType: 'regularSeason' | 'playoffs'` (required by the active aggregated caller; defaults only for compatibility)
  - `aggregatedData?: AggregatedMatrixPlayer[]` (only required for aggregated)
- Output (hook):
  - `loading, status, error, stale, source, coverage, teamId, teamName, roster, toiData, homeAwayInfo, playerATOI, lines, pairs`
- View component props mirror hook result values (minus `homeAwayInfo` optional)
- Aggregate durations, relationship maps, identities, metadata, and pair-game observations are strictly normalized before entering the typed `AggregatedMatrixPlayer`/`PlayerData` contract. Invalid or duplicate player identities reject the complete result; no row is silently dropped, coerced, or materialized as synthetic ID `0`.
- Raw reads select only generated `shift_charts` fields, constrain canonical team ID/abbreviation plus exact inclusive dates and either the selected regular/playoff game type or a null game type that must remain visible as incomplete coverage, and use deterministic `id`-ordered inclusive short pages until the first short page. Any page error rejects the complete request. Positive row/game/player identities and unique player-game rows are mandatory; team/date/type conflicts, malformed clocks/JSON/partner identities, impossible appearance TOI beyond game length, and contradictory mirrors reject.
- A raw game is included only when all player rows provide season, selected game type, appearance TOI, game length, and both relationship maps and every unordered player pair has two equal mirrored observations in one persisted relationship category. `home_or_away` is optional because both full relationship writers currently omit it; non-null values must agree, and a home/away row is published only when the game supplies that metadata. Incomplete nullable coverage excludes that entire game and increments genuine skipped-row coverage; observed `00:00` remains a valid zero fact. After bounded player fallback resolves canonical player types, persisted same/mixed category drift is normalized using the writers' forward-versus-non-forward rule, so one pair cannot split across buckets. The reducer publishes one roster row per player, one pair/game fact counted once, exact GP/total TOI/ATOI/line-pair counts, player-relative shared percentages, and canonical team/franchise identity. Unresolved identity metadata rejects.
- Aggregated reader input is one explicit `{ teamId, seasonId, seasonType, startDate, endDate, gameIds?, homeOrAway?, opponentTeamAbbreviation? }` object. The reader does not recalculate last-N dates. It filters the generated `shift_charts` schema by exact team, season, game type, dates, and optional fixed game IDs; reads all rows through deterministic `id`-ordered short pages; rejects page errors or invalid player/game identities; revalidates every returned row against the exact fixed-game, venue, and normalized-opponent scope; and returns unique post-filter `matchedGameIds` for truthful coverage copy and card ownership.
- Player-master fallbacks use the shared Supabase helper with deterministic `id` ordering and 200-ID filter chunks. A failed chunk rejects the complete request. Last-N schedule lookup database errors also reject so the page can distinguish `error` from a legitimate empty/insufficient schedule.
- Visible card stats use only the aggregate reader's unique post-filter `matchedGameIds` and the players' exact appearance IDs. Both game and player filters are bounded to 200 IDs, every chunk uses inclusive short-page pagination ordered by compound primary-key identity plus `created_at`, and a later-page error rejects the complete request. A player is published only when there is exactly one valid stat row for every expected appearance and no extra row. Missing, duplicate, malformed, unsafe-identity, or internally contradictory rows produce an explicit unavailable state rather than fabricated zeroes.
- Supported skater values are exact sums of goals, assists, points, power-play points, shots, hits, blocks, and plus/minus. Supported goalie values are appearance count, saves, weighted save percentage, and TOI-weighted GAA. Goalie record, quality-start percentage, shutouts, and starts are hidden because the exact game-stat source cannot prove those semantics.
- Last-N resolution input is explicit `{ teamId, seasonId, seasonType, gamesBack, scopeStartDate, scopeEndDate }`. It reads the completed `wgo_team_stats` ledger through exact team/season/type bounds, deterministic `date DESC, game_id DESC NULLS LAST, id DESC` ordering, and one hard `0..N-1` range; invalid/missing/duplicate candidates and database errors reject, fewer than N rows return `null`, and exact newest-first IDs plus start/end dates are returned.
- A focused DRM verification rerun passes 9 files/115 tests, including later-page failures, stable request identities and rerenders, explicit idle/loading/success/empty/partial/error plus source/coverage states, and wrapper inventory. This evidence closes task-list rows 2.2, 2.3, 2.6, and 5.1 without closing their still-open parent groups or the wrapper-disposition decision.

### Approved NEW 12 last-N and manual-date contract

- Repository history establishes the compatibility baseline: `586ff3fc3` introduced L7/L14/L30 as the selected team's unfiltered last N games, and `01ef182fd` later added Home/Away and Opponent filters after that range was resolved. The original PRD also requires preservation of current functionality with minimal UI change.
- **Approved Option A — fixed team window, then filters:** L7 means the selected team's exact last seven completed games in the selected season/type. Home/Away and Opponent narrow those same seven IDs, the resolved dates/IDs remain stable when filters change, and the UI reports `x matching games within last 7 team games`, including zero. The owner supplied the exact approval on 2026-07-18; filters-first Option B is retained only as rejected decision history.
- **Manual-date contract:** editing either date switches the timeframe to visible `Custom`; paired calendar-date parsing/formatting preserves the exact inclusive dates across time zones; team and Home/Away/Opponent changes preserve those dates and apply within them; changing season/type exits Custom to that type's full Season bounds; clicking L7/L14/L30/Season exits Custom and recalculates; active-preset re-clicks are no-ops; and missing or reversed ranges fail closed before any aggregate request. NEW 16 separately owns complete URL persistence/restoration and sanitization.
- **Card boundary:** `LinePairGrid` remains unmounted for Custom, loading, error, and empty scopes. NEW 17/18 now also make the consumer pure, exact-scope keyed, and synchronously empty for changed/incomplete/failed/zero-game identities; Custom intentionally uses the exact-date matrix while hiding unsupported cards.

### Displayed-card scope mismatch (NEW 17 — resolved 2026-07-18)

- The aggregate request now fetches exact skater/goalie game-stat rows only for post-filter matched game IDs and the scoped roster's player IDs. Exact per-player appearance coverage is required; missing, duplicate, malformed, unsafe, or contradictory rows remain unavailable, including valid distinction between true zero totals and absent coverage.
- Skater cards retain all eight supported box-score totals. Goalie cards retain only GP, saves, weighted SV%, and weighted GAA; Record, QS%, SO, and GS are hidden because their semantics are not provable from the exact source. Custom hides all cards while the matrix continues to honor its selected exact-inclusive dates.
- Focused filtered, sparse-opponent, injured-player, Custom-hide, exact aggregation, unavailable, and query-bound regressions pass. No player-global `/skaterArray` or date-only goalie read remains in the card tree.

### Stale LinePairGrid retention (NEW 18 — resolved 2026-07-18)

- The page owns one canonical scope key and exposes aggregate/card data only when the resolved key equals the active key. `useDateRangeMatrixData` independently masks changed request identities, and sequence ownership prevents late aggregate completions from overwriting a newer scope.
- `LinePairGrid` has no retained result or independent fetch state: it derives lines/pairs/goalies from current props and returns nothing unless status is success/partial, roster is nonempty, and the matching-game count is positive. Focused first-render A-to-B loading, nonzero-to-zero, empty, error, and page-level filter-invalidation regressions pass.

### Raw/aggregate parity and producer findings (NEW 19–51)

- **NEW 19 resolved 2026-07-18:** the active aggregate path now uses generated row types and one fail-closed reducer for safe positive identities, strict integer/`M:SS`/`H:MM:SS` clocks, non-array relationship maps, unique row/player-game identities, exact mirrored pair observations, appearance bounds, canonical post-fallback same/mixed buckets, one symmetric pair-game fact, player-relative percentages, exact GP/game IDs, rounded ATOI, and direct typed mapper projection. Every active request filter is revalidated on returned rows before fallback/card work, so an escaped backend row cannot expand `matchedGameIds` or card scope. Exact zero observations remain distinct from missing coverage.
- `shift_charts` has two full relationship-writer implementations plus the projection strength producer. Local NEW 20 containment now makes their field ownership disjoint, uses generated-schema completeness and the exact raw-shift player manifest, normalizes numeric assignments and game types, deterministically pages position rows, calculates playoff overtime correctly, validates every shift interval against a complete PBP timeline, and invalidates only strength-owned columns before current-player replacement. The bounded inventory still identifies 14,976 relationship-incomplete rows across 392 games and 12,279 current-season strength-incomplete rows across 329 games. One authoritative relationship materializer, versioned/transactional producer boundary, bounded history repair, deployment, and rollback proof remain before closure; raw/aggregate partial behavior stays explicit meanwhile.
- The legacy standalone writer logged the service-role credential and Supabase URL before self-executing. NEW 22 removes those value-bearing calls without accessing the secret and changes local write failures to stop. Exact committed runtime/config/history inventory finds no invoker; all known automation and manual surfaces use the independent authenticated route. The self-executing entry remains, and only the untracked/manual/external execution plus retained-log history still gates conditional credential rotation or entry-point retirement.
- Local NEW 23 derived builders now reject incomplete clocks, identities, situations, PBP, and raw-player coverage; clear prior exact player/team game scopes before replacement; short-circuit dependent stages; and retain the failed date. A durable exact status/source-version gate plus transactional serialization, production deployment, and stale-history verification remain necessary because multi-game/date work can still expose an in-flight missing scope.
- Local NEW 24 routes now default to the prior completed UTC slate, process more than six same-date games, accept deterministic date/game cursors, and retain exact failed cursors. Production jobs still need durable cursor storage/commands, coordinated deployment, bounded retry/runtime proof, and a natural-run verification.
- NEW 25 now has final metadata/nonterminal/unique-event/terminal validation, prevalidated shifts, exact PBP replacement, immutable-source fingerprints, a shared per-game lock/versioned RPC, rollback/concurrency proof, deployed one-game production publication, and physical no-DML replay. It remains open because active job 104 can still bypass the canonical manifest through NEW 27 and no bounded historical/backfill verification has run.
- The active relationship writer uses an upsert-only current batch plus a creation-time watermark. A corrected snapshot can therefore retain withdrawn players' relationship-owned fields. NEW 26 requires exact relationship-field replacement under the shared game lock while preserving projection strength columns, with source fingerprint/count receipts and bounded correction repair.
- Exact authoritative checkpoint `58cca4e31e44981df3e3089b6ebd6f0cb1d20139` publishes NEW 27's authenticated/audited `update-PbP` compatibility adapter. Scheduled `recent`, exact game, bounded/start-only, and current-day modes invoke the named unwrapped canonical input transaction; exact IDs are resolved through the authorized request client and selected alone. The deliberately unbounded `games=all` contract remains an authenticated legacy path for one release. Deployment, value-free manual/untracked caller inventory, replacement backfill semantics, and final legacy retirement remain open. Job 104 must be temporarily deactivated for bounded auth/non-writing/timing probes because its 100-second caller timeout is shorter than the canonical handler's 270-second default.
- The goalie-derived builder is upsert-only, silently skips malformed or empty facts, does not prove the current input generation, and can overstate games processed. NEW 28 requires player/team/goalie exact replacement and terminal status in one expected-version transaction, including an explicit justified no-goalie state and stale-goalie rollback/race evidence.
- Immutable Gamecenter payloads already preserve source hashes, but the normalized roster/PBP/shift tables are updated additively. Removed upstream rows can survive and make even the local completeness manifest stale. NEW 29 binds normalized exact-scope replacement to the latest immutable raw fingerprints and verifies correction/removal plus xG, underlying-stats, and team-unit-TOI consumers.
- The activated input, derived, and rolling coordinator routes initially had audit wrappers but no authentication boundary. NEW 30 adds the shared fail-closed cron/admin wrapper locally and requires anonymous-rejection plus current-secret authorization evidence after deployment.
- The three transactional writers initially labeled same-identity replays idempotent while still rewriting rows and completion timestamps. NEW 31 is resolved: exact input/relationship/derived replays return before DML with unchanged owner scopes, versions, and completion timestamps; versioned drift repair/stale pruning, three late-failure rollbacks, A→B→A reversion, and a real shared-lock winner/loser race pass.
- Fingerprint-only dependent CAS could not reject an input-version ABA. NEW 32 carries and verifies the expected input version through relationship and derived transactions under the shared lock; legacy writers that bypass status remain blocked under NEW 27/29.
- The relationship queue's private season lookup selected the prior season after the newest season end date. NEW 33 now uses the authoritative latest-started season contract; direct server and implicit-route tests exclude a future season and carry the latest-started ID into the paginated game query. A deployed bounded offseason proof remains.
- Completed durable operations, client/SQL key grammar drift, and null transition fallthrough could break safe replay. NEW 34 is resolved: client and RPC return an exact completed no-op, validators align, null states fail closed, success/failure recovery paths pass, and a real two-session revision race commits only one advance.
- Mixed producer rows could block derived reads, one-team strength payloads could publish complete, first manifest adoption could retain stale legacy output, and input invalidation could leave unowned rows. NEW 35 is complete: strength ownership filtering, two-team enforcement, first-adoption invalidation, and transactional debris cleanup pass disposable-branch withdrawn-row correction/removal, A→B→A, forced rollback, and derived-continuity proof. The bounded production canary adopted 38 legacy strength-only rows across two teams, completed all three manifests at v1, changed no other game, and exact replays performed zero DML with unchanged digests and timestamps.
- Independent review found two duplicate SQL column declarations that would have prevented the additive migration from compiling. NEW 36 is resolved: the corrected whole migration compiles and applies against the supported public-schema baseline, passes the complete behavioral/type/security/advisor suite, leaves zero probe residue, and the disposable branch is deleted. B-CRON-NST NEW 60 separately owns the missing authoritative `analytics` baseline.
- A relationship algorithm bump could remain permanently skipped because queue identity ignored the stored algorithm. NEW 37 adds version-aware queue selection, and the shared-selector route test proves a completed older-algorithm row reaches per-game processing; a legitimate bounded deployed v3 queue/materialization proof remains.
- Local `run-projection-v2` already executes canonical input → relationship → derived with fail-stop/status gating, and job 16's `update-shifts?action=all` target is a compatibility adapter rather than a separate relationship implementation. NEW 38 remains open because the deployed schedules still place job 16 before input and cross-provider ownership must be reconciled under NEW 49/50 before one authoritative cutover and natural-order proof.
- Implicit coordinator runs now preserve the input durable queue, resume the oldest unfinished input backlog, avoid explicit date/`maxGames` bypass, and stop downstream stages on failure. NEW 39 remains open for an explicit decision on whether per-game manifest recovery satisfies the required cross-stage lifecycle, followed by deployed next-day recovery and natural-run proof.
- Transaction clients hash freshly fetched source payloads. NEW 40 is resolved: all three locked materialization RPCs verify the exact latest snapshot-head/raw ID, hash, and version; stale or mismatched provenance rejects unchanged, while A→B→A correction/removal and current-version relationship/derived publication pass. NEW 29 retains bounded history and broader downstream compatibility.
- Early 400/405 exits in the canonical relationship route can leave the finally-written cron audit marked successful. NEW 41 requires failure-state assignment or shared-wrapper ownership plus focused and natural audit-truth evidence.
- Executable branch probes exposed SQLSTATE 42702 because positional `ON CONFLICT (...)` identifiers inside table-valued RPCs collided with output-column variables. NEW 42 is now resolved: all four affected functions use eight exact named constraints and zero positional targets; capture/input/relationship/derived initial and exact-replay paths, forced late rollback, stale raw/version rejection, correction/reversion, ABA rejection, and a real two-session winner/loser race pass on the isolated branch.
- The next executable state-machine probe found that the TypeScript client preserved completed operations as terminal while the SQL RPC could reopen one. NEW 43 is resolved: a same-range direct acquire returns the exact stored completed receipt without mutation, a changed range fails closed, and the full success/failure/two-session suite passes.
- Catalog ACL proof then found that Supabase default privileges gave `service_role` destructive rights on all three newly created state tables despite narrower grants in the migration. NEW 44 is resolved: explicit revoke-before-grant leaves only read/insert/update, browser/table/RPC denial and service RPC execution pass, raw update/delete are denied and trigger-protected, and no probe lease remains running.
- The branch performance advisor then flagged the exact four-column snapshot-head foreign key as uncovered because its child index included only `raw_payload_id`. NEW 45 is resolved: the migration and isolated branch now use the exact ordered `(raw_payload_id, game_id, endpoint, payload_hash)` child index, the static/catalog guards pass, and the targeted unindexed-foreign-key finding is absent. Fresh data-less-branch unused-index notices remain informational until workload.
- The resulting producer graph is: authoritative immutable snapshot identity and exact normalized scope (`NEW 25/27/29`; NEW 40 binding complete) → canonical locked relationship replacement (`NEW 20/26`) → one cross-provider schedule owner and platform-safe runtime (`NEW 38/49/50`) → atomic player/team/goalie derived publish (`NEW 23/28`) → stable cross-day durable backlog (`NEW 24/39`; NEW 34/43 terminal-state controls complete) → one truthful audit owner (`NEW 41/51`) → bounded repair/canary → natural cron evidence → legacy-owner retirement. Supported-baseline compilation, exact no-DML replay, immutable binding, ACL/index, executable rollback/concurrency, final cleanup/advisors, and branch deletion are complete under NEW 31/36/40/42/44/45. Status and cursor advancement cannot precede the corresponding game transaction.
- The reviewed 54-path transactional-materialization implementation and synchronized controls are published on `octoberBranch` at checkpoint `fe8d039b9cb601bb0422a180c3a8103da9e94ff8`. The exact 23-file/170-test group, full TypeScript, scoped lint, diff/parity, staged-scope, and fast-forward publication gates passed; production remains unchanged pending the authorized guarded migration/deployment/canary sequence.
- The first guarded production CLI apply selected only canonical migration `20260720105524` and failed closed before creating any target object or history row because the top-level table lock lacked an explicit transaction boundary under `db push`. NEW 46 is resolved: exact published commit `d8e98d9570989e4840a9172980ccb3abf36fb9ce` adds the static-guarded full-file transaction; the subsequent canonical apply records the exact history version and passes all table/head/index/trigger/function/RLS/ACL/advisor/log postconditions before canary work.
- The isolated Production-environment artifact built from exact authoritative commit `a2af6daa24e8f7e5f49990437a93c35650e39151` is READY without customer-domain movement. NEW 30 is resolved by value-free 401/401/405 authorization and matching audit evidence for all three materialization routes; NEW 47 now keeps the frozen cron-auth inventory reconciled through the local `update-PbP` hardening at 20 admin-or-cron / 1 exact-cron-only / 31 unprotected. These prior production probes executed no materialization work; the new adapter is not yet deployed.
- A newer isolated Production-environment artifact from exact authoritative commit `aae815bc26ea9a8bcddb3811603ce27ee48bd6d5` is READY with zero custom aliases. Read-only strict canary selection found one otherwise eligible first-adoption game, but three of its 38 shift players lack exact Yahoo-name position matches even though the current normalized roster has exact player/team/source-bound positions for all 38. The active client and SQL RPC would accept null relationship position/type and mark the generation complete. NEW 48 therefore precedes every production write: use exact current-roster identity as the deterministic fallback, reject incomplete/stale/ambiguous evidence before RPC invocation, and enforce non-null relationship position/type at the database boundary before redeploying and repeating the one-game gate.
- NEW 48 is complete. Exact commit `4f8ba12ae7d7622299f3fccf6ec2cfbf2b63cd64` publishes the raw-PBP-bound roster fallback, exact client serialization, algorithm v3, and column-specific execute-revoked invoker trigger. Production migration `20260721013821` preserves all 32,397 legacy-invalid relationship rows while enforcing new relationship writes. A repeated strict selector and zero-overlap gate led to one unique-date first-adoption canary: input verified 382 rows, relationship verified 38 rows with exactly three deterministic roster fallbacks and zero invalid position metadata, and derived verified 38 player plus two team plus two goalie rows. Each exact replay returned a physical no-DML receipt with unchanged digests, versions, fingerprints, and timestamps; no non-candidate row changed in the bounded canary window and all manifests are complete at v1. The exact-SHA Production target is READY without alias error, all five project domains resolve it, live missing/invalid/current auth returns 401/401/405, and bounded build/runtime error evidence is empty. The focused 5-file/57-test and broader 42-file/321-test groups, full TypeScript, scoped lint, independent reviews, disposable-branch trigger/rollback/advisor proof, zero residue, and branch deletion remain green. NEW 20/26/29 retain their separate history, writer-retirement, correction/removal, and broader compatibility gates.
- NEW 49 records a P1 cross-provider scheduler collision. The local fail-closed inventory now reconciles all 64 active canonical pg_cron rows with 20 Vercel rows, validates provider grammar/calendar semantics, classifies shared pipeline domains, and proves the rolling-coordinator/job-308 same-minute collision without retaining host or credential material. Authoritative owner selection, rollback metadata, deployed zero-overlap proof, and one natural ordered run remain required before activation.
- NEW 50 records a P1 runtime-contract mismatch across naturally scheduled projection work. A shared runtime constant and the combined inventory prove that both the coordinator and the direct projection route default to 270 seconds while the Vercel Pages cap is 240 seconds; the active coordinator and direct jobs 308/393 therefore lack audit-flush headroom absent an exact bounded override. The affected work must be bounded/split with headroom or removed from natural Vercel execution, then verified through nontrivial completed audits.
- NEW 51 records a P2 duplicate-audit contract. Exact local checkpoint `3e74ac295373af6dfe8efea1c8983403b4531cac` keeps the outer audited/authenticated `update-shifts` adapter as job 16's sole owner and calls an explicit caller-owned-audit `shift-charts` delegate, while the default direct route preserves its existing authorization and manual-audit behavior. Success and invalid compatibility regressions each assert exactly one truthful insert; the six-file/29-test audit/queue/transaction/coordinator group, full TypeScript, Prettier, and diff integrity pass. The task remains open for exact deployment and bounded/natural one-call/one-row proof downstream of NEW 49/50.
- NEW 52 closes a P1 ambiguous-control boundary: repeated `gameId`, `startDate`, `endDate`, or `games` query values now fail before either the canonical or legacy writer is selected.
- NEW 53 closes a P2 input-validation boundary: malformed, nonexistent, and reversed calendar ranges now fail before materialization database/source work while retaining the outer authorization and audit record.
- NEW 54 closes a P2 scheduled-route alias boundary: every raw whitespace character and every direct, parent, or percent-encoded dot-segment pathname that WHATWG URL dispatch would normalize now fails before scheduler-domain classification. Exact regressions pass in the final four-file/66-test scheduler group; full TypeScript and Prettier pass, diff integrity is clean, and independent re-review found no residual P0–P3 issue.
- NEW 55 closes a P2 scheduled-runtime evidence boundary: every coordinator schedule now requires exactly one supported mode and derives its budget from the shared daily-incremental, overnight, or targeted-repair pipeline policy. Missing, repeated, and unsupported modes fail closed; exact mode regressions preserve NEW 50's current daily 270-second-versus-240-second finding and pass the same final four-file/66-test, type, format, integrity, and review gates.
- The published NEW 27/33/37/52/53 verification group passes 7 files/55 tests plus full TypeScript, Prettier, and diff integrity. Expected fail-closed test branches emit only their intentional diagnostic logs. No production schedule, database, deployment, credential, provider, or customer alias changed.

### Raw boundary hardening (NEW 21 — resolved 2026-07-18)

- Unified-hook team metadata uses the same optional-safe trimmed uppercase identity accepted by the raw reader. Duration parsing rejects a reduced clock total that is not a safe integer, and a present game length must be positive. Player-master fallback derives `lastName` from every token after the given name so surname particles match the aggregate fallback contract.

## UI/UX & Styling
- Current DRM page uses custom styles (`drm.module.scss`). To align with site-wide design:
  - Typography: apply site typography scale and consistent font weights
  - Spacing: use standard spacing tokens for paddings, grid gaps, margins
  - Colors: inject theme variables (primary/secondary/accent) via CSS vars and reference shared palette in `styles/`
  - Buttons/toggles: replace ad-hoc styles with reusable button/select components used elsewhere
  - Responsiveness: ensure grid and header scale on small screens; add horizontal scroll affordance
  - Accessibility: increase contrast for matrix cells; add aria labels/tooltips; ensure keyboard focus styles are visible
  - Loading/empty states: standardized skeletons/placeholders

Deliverables for UI polish (follow-up tasks):
- Replace local button styles with shared `Button` component
- Replace `Select` usage with shared select wrapper (consistent spacing, focus)
- Normalize header layout to match page headers (logo size, title casing)
- Audit CSS variables used in DRM and map to global variables in `web/styles/vars.scss`

## Newly Discovered Issues (2025-09-12)

- DatePicker clipping within controls panel:
  - The `react-datepicker` popper gets clipped due to `overflow: hidden` on the panel container. Fix: set `overflow: visible` on the datepicker group and apply a high z-index to `.react-datepicker-popper`, or use `withPortal` to render outside the flow. We’ll do both for robustness.

- Preference for dual team selectors:
  - Keep both the horizontal team navbar (TeamSelect) and the physical dropdown (TeamDropdown) on the DRM page for different workflows. Ensure both are present and accessible.

- Maximum update depth exceeded in DRMPage:
  - Cause: Passing a non-memoized `aggregatedData` (via `Object.values(...)`) to `useDateRangeMatrixData` causes the hook’s effect dependency to change on every render, creating a render loop.
  - Fix: Memoize the `aggregatedData` that’s passed to the hook with `useMemo(() => Object.values(...), [seasonType, regularSeasonData, playoffData])`. Also ensure the hook’s effect list is stable and only recomputes when the actual data changes.

## Action Items (Hotfixes)

- Restore `TeamDropdown` alongside `TeamSelect` on DRM page (both paths available).
- Update datepicker container styles to `overflow: visible` and add `.react-datepicker-popper { z-index: 10000 }`.
- Pass `withPortal` to `DatePicker` to avoid clipping within overflow contexts.
- Memoize `aggregatedData` object array before passing into `useDateRangeMatrixData` to stop infinite re-renders.

## Performance Considerations
- Memoize heavy transforms (`calculateLinesAndPairs`, roster mapping)
- Avoid re-renders by stabilizing prop identities and using `useMemo`
- Consider virtualization for large rosters (if row/col > ~30)
- Defer non-critical logs and dev-only computations

## Risks & Mitigations
- Data parity between sources: use a temporary QA toggle (query param) to compare raw vs aggregated outputs
- Dynamic imports or edge cases: keep hook boundary minimal and typed; add guards for missing data

## Rollout Plan
1) Ship unified hook + view (done)
2) Validate parity with existing outputs on key teams and date ranges
3) Optional: enable `?drm-source=raw` QA toggle for internal verification
4) Remove specialized component if unused (or keep as thin wrapper)
5) UI polish tasks to align with site design

## Appendix: Re-run/Dev Notes
- Types: `cd web && npx tsc -p tsconfig.json --noEmit`
- Dead code scan: see `tasks/prd-dead-code-report.md`
- Inventory: see `tasks/prd-file-inventory.md`
