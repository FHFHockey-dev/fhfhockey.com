## Relevant Files

- `tasks/TASKS/lines-gdl-ingestion/prd/prd-gdl-suite-ingestion.md` - Derived canonical initiative PRD covering the existing generic ingestion foundation and remaining first-arrival, mapping, parser, operations, and rollout scope.
- `tasks/TASKS/lines-ccc-ingestion/tasks-prd-lines-ccc-ingestion.md` - Existing CCC task plan and implementation context to reuse for the GDL suite.
- `tasks/TASKS/lines-gdl-ingestion/GDL-INGESTION-RUNBOOK.md` - IFTTT setup, bounded catch-up, cron recommendation, operator queries, and recovery checks.
- `web/lib/sources/linesCccIngestion.ts` - Current CCC parser, quote resolution, NHL filtering, row shaping, and source-specific config patterns.
- `web/lib/sources/linesCccIngestion.test.ts` - Existing parser test coverage to extend or use as the reference for GDL behavior.
- `web/lib/sources/tweetNewsPhraseDictionary.ts` - Evidence-backed news phrase allow/exclusion dictionary, including roster language and stat-recap suppression.
- `web/lib/sources/tweetNewsAutomation.test.ts` - Regression coverage for automated phrase decisions and top-performer/stat-recap exclusions.
- `web/scripts/analyze-tweet-news-phrases.ts` - Paginated harvested-tweet audit used to identify recurring accepted, rejected, ambiguous, and candidate phrases.
- `web/scripts/output/tweet-news-phrase-audit/tweet-corpus.json` - Current deduplicated harvested-tweet evidence corpus.
- `web/scripts/output/tweet-news-phrase-audit/phrase-analysis.json` - Current phrase-hit, review-candidate, and publish-decision evidence.
- `web/lib/sources/tweetLineupParsing.ts` - Shared tweet URL/oEmbed helper module already used by CCC and GDT paths.
- `web/lib/sources/lineupSourceIngestion.ts` - Existing GDT parsing/classification/roster matching helpers reused by CCC.
- `web/lib/sources/lineSourceProcessing.ts` - Shared source-processing helpers extracted from the CCC processor for query parsing, roster loading, tweet URL normalization, and unresolved-name queueing.
- `web/pages/api/v1/sources/ifttt/ccc-tweet.ts` - Current IFTTT receiver pattern that should be generalized for multiple tweet sources.
- `web/__tests__/pages/api/v1/sources/ifttt/ccc-tweet.test.ts` - Focused regression proving the legacy CCC receiver preserves raw-first retryability without returning downstream bodies or exception messages.
- `web/lib/sources/lineSourceIftttReceiver.ts` - Generic IFTTT receiver factory for GDL suite and future tweet-derived sources.
- `web/lib/sources/lineSourceIftttReceiver.test.ts` - Tests for generic IFTTT receiver source routing and upsert dedupe behavior.
- `web/pages/api/v1/sources/ifttt/gamedaygoalies-tweet.ts` - IFTTT receiver route for `GameDayGoalies` events.
- `web/pages/api/v1/sources/ifttt/gamedaylines-tweet.ts` - IFTTT receiver route for `GameDayLines` events.
- `web/pages/api/v1/sources/ifttt/gamedaynewsnhl-tweet.ts` - IFTTT receiver route for `GameDayNewsNHL` events.
- `web/pages/api/v1/db/update-lines-ccc.ts` - Current CCC processing route pattern to generalize or parallel for GDL.
- `web/pages/api/v1/db/update-line-sources.ts` - Generic protected processor for `line_source_ifttt_events` into `line_source_snapshots`.
- `web/pages/twitterEmbeds/index.tsx` - Local source display page that needs source-agnostic first-arrival selection.
- `web/pages/twitterEmbeds/index.module.scss` - Styling for first-arrival cards and expandable later-source evidence.
- `web/__tests__/pages/twitterEmbeds/index.test.ts` - Covers CCC/GDL attribution, bucket selection, and later-source metadata.
- `web/lib/sources/lineSourceFirstArrival.ts` - Shared deterministic bucket and first-arrival selector for display and downstream writers.
- `web/lib/sources/lineSourceFirstArrival.test.ts` - Covers bucket keys, timestamp fallback, tie-breaking, and rejected-row exclusion.
- `web/sql/ratings/007_create_lines_ccc.sql` - Existing `lines_ccc` schema to use as the baseline for GDL suite storage.
- `web/sql/ratings/008_create_lines_ccc_ifttt_events.sql` - Existing raw IFTTT event queue schema to mirror or generalize.
- `web/sql/ratings/012_create_line_source_ifttt_events.sql` - Generic raw IFTTT event queue for GDL suite and future tweet-derived sources.
- `web/sql/ratings/013_create_line_source_snapshots.sql` - Generic parsed snapshot table for GDL suite and future tweet-derived sources.
- `web/pages/api/v1/db/send-player-name-alias-review.ts` - Email alert endpoint for unresolved player-name review.
- `web/pages/db/player-aliases.tsx` - Existing manual alias resolution UI to verify remains usable across sources.
- `web/pages/api/v1/db/update-line-combinations/index.ts` - Canonical `lineCombinations` batch repair and orchestration route.
- `web/pages/api/v1/db/update-line-combinations/[id].ts` - Canonical Gamecenter writer for game/team player-ID arrays.
- `web/lib/sources/lineSourceLineCombinations.ts` - Paginated winner loading, eligibility mapping, and atomic canonical-write orchestration.
- `web/lib/sources/lineSourceLineCombinations.test.ts` - Covers complete/goalie-only mapping, exclusions, first arrival, pagination, and RPC writes.
- `supabase/migrations/20260716112909_add_line_combinations_source_provenance.sql` - Authoritative-root additive provenance fields and service-role-only atomic partial-array upsert RPC; supersedes the web-scoped draft.
- `web/lib/supabase/database-generated.types.ts` - Generated contract extended for canonical provenance columns and RPC.
- `web/pages/lines/index.tsx` - Existing line-combinations consumer surface that may need compatibility checks after source changes.

### Notes

- This task list originally treated the user request as the PRD source; the missing pair was repaired on 2026-07-11 at `tasks/TASKS/lines-gdl-ingestion/prd/prd-gdl-suite-ingestion.md` using this list and current implementation evidence.
- Keep source ingestion additive: CCC and GDL sources should all continue collecting, even when another source already produced the display winner.
- The display-selection rule is "first valid source wins" for a team/date/signal bucket, not "prefer CCC" or "prefer GDL".
- Preserve rejected rows and source metadata for audit/debugging.
- GDL suite accounts are `GameDayGoalies`, `GameDayNewsNHL`, and `GameDayLines`.
- Use mocked IFTTT/oEmbed responses in tests; do not depend on live X availability.
- Inventory for 1.1:
  - `lines_ccc` stores accepted and rejected tweet-derived rows with `capture_key` primary key, tweet/quote provenance, `classification`, `nhl_filter_status`, `status`, ordered line/pair/goalie fields, raw payload, and metadata.
  - `lines_ccc_ifttt_events` is the raw queue table with `source`, `source_account`, tweet fields, `processing_status` (`pending`, `processed`, `rejected`, `failed`), raw payload, and received/updated timestamps.
  - `POST /api/v1/sources/ifttt/ccc-tweet` is CCC-specific by env var (`IFTTT_CCC_WEBHOOK_SECRET`), queue table (`lines_ccc_ifttt_events`), and follow-up processor URL (`update-lines-ccc`), but its request parsing, secret check, tweet-id extraction, queue upsert, and `process=true` behavior are source-neutral.
  - `POST /api/v1/db/update-lines-ccc` is CCC-specific by route name, queue table, row table, raw-payload metadata keys (`linesCccOembed`, `linesCccQuote`, `linesCccProcessing`), row shaper, and unresolved-name source, but the batching, oEmbed cache/backoff, quote resolution, NHL filtering, row upsert, event status update, and summary shape are reusable.
  - `linesCccIngestion.ts` has reusable domain types and logic, but names and output row source are hard-coded to CCC (`ParsedLinesCccSource`, `LinesCccIftttEventInput`, `toLinesCccRow`, `source: "lines_ccc"`). Source account hints and handle maps are currently embedded in the CCC module.
  - Shared helpers already exist in `tweetLineupParsing.ts` for tweet id extraction, status URL normalization, status URL extraction, `t.co` extraction, and oEmbed HTML parsing with line-break preservation.
  - GDT helpers in `lineupSourceIngestion.ts` already expose reusable classification, keyword, structured group, roster-name, and row-provenance helpers used by the CCC path.
  - `/twitterEmbeds` currently reads only `lines_ccc`, orders by `observed_at`, dedupes by tweet id, and applies a card quality priority; it does not yet implement source-agnostic signal buckets or first-arrival display.
- Source model decision for 1.2:
  - Use the hybrid bridge approach: keep the existing CCC production path intact for now, add generic source tables/routes for GDL and future sources, and migrate CCC into the generic model later if/when the generic path is stable.
  - Do not add a hard CCC-vs-GDL preference layer. Source precedence should be derived from first-arrival ordering inside a team/date/signal bucket.
  - Avoid naming new tables as if GDL is the final source family. Prefer source-neutral names for new work, such as `line_source_ifttt_events` and `line_source_snapshots`, with `source_key` values like `gamedaygoalies`, `gamedaylines`, and `gamedaynewsnhl`.
- Reusable source config shape for 1.3:
  - `sourceKey`: stable lowercase key, e.g. `gamedaygoalies`, `gamedaylines`, `gamedaynewsnhl`.
  - `sourceGroup`: source family, e.g. `gdl_suite`, so related sources can be processed together.
  - `handle`: X/Twitter handle without `@`.
  - `displayName`: human label for UI/debug output.
  - `eventTable`: generic event table name for new sources, initially `line_source_ifttt_events`.
  - `snapshotTable`: generic parsed row table name for new sources, initially `line_source_snapshots`.
  - `routeSlug`: route-safe slug for source-specific receiver URLs when needed.
  - `secretEnvVar`: env var for the IFTTT receiver secret.
  - `enabledClassifications`: classifications expected from the source (`goalie_start`, `lineup`, `practice_lines`, `injury`, `other`, etc.).
  - `sourceHints`: optional handle/team/classification hints that tune parsing without forking the whole parser.
  - `processorPath`: optional protected processor route used by `process=true`; GDL receivers use `/api/v1/db/update-line-sources` after task 3.2.
- First-arrival bucket keys for 1.4:
  - Use accepted observed rows only for first-arrival display and downstream `line_combinations` writes.
  - Bucket by `snapshot_date`, `team_id`, `game_id` when present, and normalized signal type.
  - Initial normalized signal types should include `lineup`, `goalie_start`, `injury`, `practice_lines`, `power_play`, and later roster-move subtypes.
  - For multi-team tweets, row shaping should produce one row per resolved team when the signal is separable; first-arrival is evaluated per team bucket.
  - Rejected and ambiguous rows remain stored but do not win display buckets.
- First-arrival ordering rule for 1.5:
  - Sort winners by `tweet_posted_at` when it is exact enough to compare.
  - If `tweet_posted_at` is null or day-precision only, fall back to event `received_at`/row `observed_at`.
  - If timestamps tie, use a deterministic tie-breaker: `source_key`, then `tweet_id`, then `capture_key`.
  - Later sources are never discarded; they remain available for audit/comparison and can be displayed in a secondary detail/debug view later.
- Canonical downstream contract decision for 5.1:
  - Current UI, rolling-metric, projection, goalie, Start Chart, and deployment consumers read public `lineCombinations`, keyed by `gameId` + `teamId`, with flattened bigint arrays `forwards`, `defensemen`, and `goalies`.
  - `/api/v1/db/update-line-combinations/[id]` is the canonical Gamecenter writer; the batch route is its repair/orchestration surface.
  - The separate snake-case `line_combinations` table is stale historical tweet storage and has no verified active writer/consumer. GDL must not revive it as a parallel contract.
  - Tweet provenance therefore needs additive optional fields on `lineCombinations`; existing readers must remain compatible with the original arrays and keys.
- Eligible tweet classification decision for 5.2:
  - `lineup` and `practice_lines` may write only when the accepted winner resolves a game, team, and complete structured player-ID arrays for the units it replaces.
  - `goalie_start` may update only the goalie array when at least one canonical goalie player ID is resolved; it must preserve existing skater arrays.
  - `injury`, `power_play`, roster-move/news, ambiguous, rejected, and `other` signals do not write `lineCombinations`; they remain source snapshots or flow to their own domain contract.
- Event preservation check for 2.6:
  - `line_source_ifttt_events` preserves source family/account fields through `source`, `source_group`, `source_key`, `source_account`, and `username`.
  - It preserves tweet discovery fields through `text`, `link_to_tweet`, `tweet_id`, `tweet_embed_code`, `tweet_created_at`, and `created_at_label`.
  - It preserves operational state through `processing_status`, `received_at`, and `updated_at`.
  - It preserves the full IFTTT body in `raw_payload`.
  - The generic receiver maps flexible IFTTT body casing for `Text`, `UserName`, `LinkToTweet`, `CreatedAt`, and optional `TweetEmbedCode`.
- Reuse check for 3.3:
  - `update-line-sources` reuses shared tweet id and URL normalization from `lineSourceProcessing`.
  - It reuses the existing CCC/GDT parser stack for wrapper oEmbed fetch/cache/backoff, quote `t.co` expansion, classification, NHL filtering, roster matching, row shaping, unresolved-name queueing, rejected-row persistence, and source event status updates.
  - Generic rows are source-attributed in `line_source_snapshots` via `source_group`, `source_key`, and `source_account`, while all accepted and rejected candidates remain persisted.
  - Current generic oEmbed cache state still uses the legacy raw-payload key `linesCccOembed` because the shared helper reads that key; this should be renamed or abstracted after the generic route has test coverage.
- Source hint behavior for 3.4:
  - `GameDayGoalies` can upgrade otherwise-`other` rows to `goalie_start` when goalie/starter/confirmed wording is present.
  - `GameDayLines` can upgrade otherwise-`other` rows to `lineup` when lines/lineup/rushes/warmups/projected/practice wording is present.
  - `GameDayNewsNHL` can upgrade otherwise-`other` rows to `injury` when injury, return, scratch, IR, activation, recall, assignment, trade, or waiver wording is present.
  - Hints are conservative: they do not override explicit parser classifications, and they record metadata when applied.
- Source attribution check for 3.5:
  - `line_source_snapshots` has required `source_group`, `source_key`, and `source_account` columns.
  - `update-line-sources` prefixes generic `capture_key` values with `source_key` to avoid cross-source collisions.
  - `toLineSourceSnapshotRow(...)` sets top-level `source_group`, `source_key`, `source_account`, and `source`, and also mirrors the same values into `metadata`.
  - Accepted and rejected parsed candidates both persist through the same snapshot row path; only deferred oEmbed/backoff events are left pending.
- Route summary behavior for 3.6:
  - `update-line-sources` returns aggregate counts plus `summary.bySourceAccount` and `summary.bySourceKey`.
  - Each source summary includes total, processed, rejected, classification counts, and NHL filter status counts.

## Tasks

- [x] 1.0 Define the source-agnostic ingestion model
  - [x] 1.1 Inventory the existing CCC-specific tables, route names, parser config, event statuses, and `lines_ccc` row contract.
  - [x] 1.2 Decide whether to create parallel GDL tables (`lines_gdl_ifttt_events`, new GDL event route) or migrate toward generic source tables while preserving the current CCC path.
  - [x] 1.3 Define a reusable source config shape for `handle`, `source_key`, `event_table`, `line_table`, route slug, enabled classifications, and source display label.
  - [x] 1.4 Define source bucket keys for first-arrival display: snapshot date, team, game when known, classification/signal type, and signal subtype where needed.
  - [x] 1.5 Document the first-arrival rule: select the earliest accepted observed row by tweet posted timestamp when available, otherwise by received/observed time, while still storing later sources.

- [x] 2.0 Add GDL suite IFTTT receivers and event storage
  - [x] 2.1 Create SQL for raw GDL suite IFTTT event storage, either as one generic `line_source_ifttt_events` table or separate GDL event tables if the current schema makes that safer.
  - [x] 2.2 Add IFTTT receiver support for `GameDayGoalies`.
  - [x] 2.3 Add IFTTT receiver support for `GameDayNewsNHL`.
  - [x] 2.4 Add IFTTT receiver support for `GameDayLines`.
  - [x] 2.5 Reuse the shared-secret and optional `process=true` behavior from the CCC receiver.
  - [x] 2.6 Preserve source account, username, text, tweet URL, tweet id, created label, raw payload, received time, and processing status for every source.
  - [x] 2.7 Add focused tests for event upsert/dedupe and source-account routing.

- [x] 3.0 Build the GDL suite processing pipeline
  - [x] 3.1 Extract CCC route logic that is source-neutral into reusable helpers before adding GDL-specific route code.
  - [x] 3.2 Create a GDL suite processing route or a generic multi-source processing route that can process one source account, all GDL accounts, or all configured sources.
  - [x] 3.3 Reuse tweet id normalization, oEmbed fetch/cache behavior, quote/t.co expansion, classification, NHL filtering, roster matching, unresolved-name queueing, and rejected-row persistence.
  - [x] 3.4 Add GDL source account hints so `GameDayGoalies` emphasizes goalie-start signals, `GameDayLines` emphasizes lineup/practice-line signals, and `GameDayNewsNHL` emphasizes injury/return/transaction signals.
  - [x] 3.5 Keep every accepted and rejected row source-attributed so later consumers can compare CCC vs GDL without losing provenance.
  - [x] 3.6 Add route summary counts by source account and classification.
  - [x] 3.7 Add tests for GDL goalie, lines, news/injury, rejected non-NHL/ambiguous, duplicate tweet, and quote-resolution cases.

- [x] 4.0 Generalize first-arrival display on `/twitterEmbeds`
  - [x] 4.1 Update `web/pages/twitterEmbeds/index.tsx` to load accepted observed rows from all configured tweet-line sources.
  - [x] 4.2 Group rows by team/date/game/classification signal bucket instead of by hard-coded CCC assumptions.
  - [x] 4.3 Select the display row using first-arrival ordering, not source preference.
  - [x] 4.4 Keep source labels visible so the card clearly shows whether CCC, GameDayGoalies, GameDayLines, or GameDayNewsNHL fired first.
  - [x] 4.5 Keep non-winning source rows queryable in metadata or secondary debug surfaces without suppressing ingestion.
  - [x] 4.6 Preserve the existing page auto-refresh behavior.
  - [x] 4.7 Add tests or a small pure helper test for first-arrival grouping and tie-breaking.
    - Evidence (2026-07-11): the bounded preview queries accepted/observed CCC and GDL-suite rows, maps date/team/game/signal fields, and uses the shared `lineSourceFirstArrival` helper. Posted time wins with observed-time fallback and deterministic source/tweet/capture tie-breakers. Cards retain source labels, expose later sources in an expandable detail surface, and preserve the existing 60-second visible-page refresh. Focused helper/page tests pass 12/12 and `tsc --noEmit` passes.

- [x] 5.0 Wire tweet-derived rows into canonical `lineCombinations`
  - [x] 5.1 Audit the current lineup writers and consumers, including expected `forwards`, `defensemen`, `goalies`, game/team identity, provenance, and freshness semantics.
    - Evidence (2026-07-11): active consumers and the healthy Gamecenter writer consistently use `lineCombinations` (`gameId`, `teamId`, flattened player-ID arrays). Snake-case `line_combinations` is stale historical tweet data with no verified active consumer. The repaired PRD now reflects the canonical contract.
  - [x] 5.2 Define which tweet-derived classifications can update `lineCombinations` (`lineup`, `practice_lines`, and high-confidence goalie-only updates where applicable).
  - [x] 5.3 Implement first-arrival source selection for `lineCombinations` updates using the same source bucket rule as `/twitterEmbeds`.
  - [x] 5.4 Map structured tweet rows into the existing `lineCombinations` flattened player-ID arrays without breaking existing readers.
  - [x] 5.5 Preserve the winning tweet URL and source metadata in additive provenance fields while keeping source snapshots as full audit evidence.
  - [x] 5.6 Add tests for inserting/updating `lineCombinations` from tweet-derived lineup rows.
    - Evidence (2026-07-16): the generic processor pages all accepted CCC/GDL rows for the requested date until a short page, applies the shared first-arrival selector, accepts only complete 12-forward/6-defense lineup or practice rows and canonical goalie-only rows, and calls an atomic RPC that preserves untouched arrays. The production-applied additive migration records source kind/key/URL/capture/observation time; the Gamecenter writer overwrites provenance truthfully. Focused source/page/route suites pass 28/28, TypeScript passes, and production rollout/consumer verification are closed under 10.3/NEW 11.4.

- [ ] 6.0 Verify unresolved-name email alerts are live across sources
  - [x] 6.1 Confirm unresolved-name queue writes include source key, source URL, tweet id, team context, and parser reason for CCC and GDL sources.
    - Evidence (2026-07-11): queue rows persist source URL/tweet/team fields and now record `sourceGroup`, `sourceKey`, `sourceAccount`, `reason`, and `parserReason` in metadata for generic GDL rows, with a CCC account fallback. Focused processing/route/writer tests pass 13/13 and TypeScript passes.
  - [ ] 6.2 Confirm the alias review email route can be triggered in production with the configured admin secret/auth path.
    - Readiness evidence (2026-07-16): the route is POST-only behind `adminOnly`, selects at most 25 pending rows, uses the shared signed review-token flow, and the ignored local configuration has the required cron, recipient, and Resend variable names set. Outlook personal-account recent-message listing is connected and paginated; 70 messages since July 1 contain zero prior unresolved-player review subjects. Production variable-name presence, actual send/receipt, signed-link review, and event-bounded reprocess remain unperformed provider actions.
  - [x] 6.3 Ensure the review page can resolve aliases from any source without creating source-specific duplicate logic.
    - Evidence (2026-07-11): `/db/player-aliases` and `/api/v1/db/player-name-aliases` operate only on the shared unresolved/alias tables and review tokens; resolve/ignore/player filtering contains no CCC/GDL provider branch.
  - [x] 6.4 Add a test or manual verification checklist for a queued GDL unresolved name, email send, alias save, and reprocess.
    - Evidence (2026-07-11): the consolidated runbook now specifies one controlled-event checklist covering queue provenance, admin-authenticated email send and receipt, signed source-agnostic review, alias persistence, tweet-bounded reprocessing, canonical resolution, and duplicate prevention without recording secrets or review tokens.

- [x] 7.0 Analyze harvested tweet content for parser enhancements
  - [x] 7.1 Query existing CCC harvested rows and new GDL suite event rows for accepted, rejected, and ambiguous examples.
  - [x] 7.2 Identify recurring lineup formats not currently parsed cleanly, including separators, goalie labels, projected/warmup phrasing, and retweet text truncation.
  - [x] 7.3 Identify injury/return phrasing from `GameDayNewsNHL` and CCC that should map to structured `injured_player_*` or status metadata.
  - [x] 7.4 Convert high-confidence findings into regex/keyword fixtures before changing parser logic.
  - [x] 7.5 Tighten false positives from top-performer/stat-summary tweets so they do not queue large unresolved-name batches.
    - Evidence (2026-07-11): `npm run audit:tweet-news-phrases` paginated current Supabase sources and produced 6,016 raw records, 2,105 deduplicated records, 49 phrase hits, 1,961 review rows, and 1,473 review candidates (114 auto-publish; 1,319 ambiguous). The retained corpus/analysis outputs and phrase dictionary cover recurring lineup/goalie/projected/warmup/return/transaction language; the stat-recap/top-performers exclusion is protected by a focused regression so recap tweets cannot generate broad unresolved-name batches.

- [x] 8.0 Add roster-move signal handling
  - [x] 8.1 Define supported classifications or metadata fields for call-ups, sent-downs, healthy scratches, trades, waivers, activations, and returns.
  - [x] 8.2 Add keyword/regex extraction for call-ups and sent-downs.
  - [x] 8.3 Add keyword/regex extraction for healthy scratches and lineup removals.
  - [x] 8.4 Add keyword/regex extraction for trades, waivers, signings, activations, and IR changes where source text is explicit.
  - [x] 8.5 Cross-reference extracted player names against roster/player data and queue unresolved names honestly.
  - [x] 8.6 Store lower-confidence roster moves in metadata until a dedicated downstream table is defined.
  - [x] 8.7 Add tests for each supported roster-move signal type.
    - Evidence (2026-07-11): clause-scoped extraction maps explicit return, call-up, assignment/sent-down, healthy-scratch/removal, trade, waiver, signing, activation, and IR phrases to canonical roster names, dedupes signal/player pairs, and stores them only in snapshot metadata. Existing shared roster matching/unresolved queueing remains the source of truth for unresolved names. Focused CCC/parser/automation/queue tests pass 40/40 and `tsc --noEmit --pretty false` passes.

- [x] 9.0 Add operational scheduling and backfill support
  - [x] 9.1 Document the three new IFTTT applets and exact Webhooks URL/header/body for each GDL account.
  - [x] 9.2 Add a production-safe catch-up endpoint or route parameters to process all pending configured sources by date.
  - [x] 9.3 Add a cron recommendation as a safety net for pending events that were stored but not immediately processed.
  - [x] 9.4 Verify `process=true` immediate processing does not block raw event storage when oEmbed or parsing fails.
  - [x] 9.5 Add runbook queries for pending events, accepted rows, rejected rows, first-arrival winners, and `lineCombinations` updates.
    - Evidence (2026-07-11): the consolidated runbook documents account-specific routes, secret headers, JSON ingredients, bounded default/date/source/tweet catch-up, an inactive-until-migration 10-minute safety-net recommendation, and operator queries. Receiver control flow persists `pending` before the follow-up call; a new 503 regression test proves webhook success/raw retention when immediate processing fails. Receiver/processor/provenance tests pass 11/11 and TypeScript passes.

- [ ] 10.0 Validate end-to-end rollout
  - [x] 10.1 Run focused parser and route tests for CCC and GDL sources.
  - [x] 10.2 Run existing GDT/GDL lineup ingestion tests to ensure current `lines_gdl` behavior is not broken.
  - [x] 10.3 Apply SQL in Supabase and verify required indexes/constraints are present.
    - Evidence (2026-07-16): the supported baseline plus authoritative-root provenance and trigger-auth deltas replayed on a replacement data-less branch; catalog/constraint/index/policy/ACL/advisor fingerprints passed. Production now lists exact contiguous migrations `20260716112908`–`20260716112910`, all five provenance columns, the service-role-only RPC, and the unchanged canonical `(gameId, teamId)` conflict/index contract.
  - [ ] 10.4 Create and test the three IFTTT applets with one controlled event per GDL account.
    - Readiness evidence (2026-07-16): all three existing applets are Connected, watch the exact intended account through the `FHFHockey` X connection, target the exact account-specific route, use a nonblank `x-fhfh-ifttt-secret` header, and select `POST` plus `application/json`. All three omit the documented `tweet_embed_code` ingredient, and GameDayLines stores the literal `SOURCE_ACCOUNT` placeholder instead of `GameDayLines`; the owner-required existing-applet conflict pause was honored before editing, promotion, or events. Vercel lists all three variable names for Production and Preview, while value-free production checks return 401 without auth and 400 for authorized empty bodies.
  - [ ] 10.5 Process pending events and confirm rows land in source storage, first-arrival display, unresolved-name queue, and canonical `lineCombinations` where applicable.
    - Readiness evidence (2026-07-16): the runbook provides source/tweet/date-bounded processing and exact status/count queries. No live event, email, alias, snapshot, or canonical-lineup write was performed during preparation.
  - [x] 10.6 Verify rejected and ambiguous rows remain visible for audit but do not drive display or `lineCombinations`.
    - Evidence (2026-07-16): the refreshed combined CCC/generic-GDL/legacy-GDT parser, receiver, route, first-arrival, canonical-writer, and display suite passes 110/110 across 11 files; TypeScript passes. Route tests retain rejected non-NHL and ambiguous snapshots with rejection status/reasons, while first-arrival and canonical-write tests prove only accepted observed rows can win or mutate `lineCombinations`.

- [x] NEW 11.0 Reconcile stale snake-case `line_combinations` with canonical `lineCombinations` before enabling tweet-derived writes.
  - [x] NEW 11.1 Correct the derived GDL PRD/task wording and record current writer/consumer evidence for canonical `lineCombinations` ownership.
  - [x] NEW 11.2 Add non-breaking optional provenance columns for source kind/key/URL/capture and observation time to `lineCombinations`, then update generated types.
  - [x] NEW 11.3 Ensure Gamecenter and tweet-derived writers stamp truthful source ownership so a later canonical refresh cannot retain stale tweet provenance.
  - [x] NEW 11.4 Verify existing lines, rolling, projection, goalie, Start Chart, and deployment consumers remain compatible; apply/verify the additive migration only through the production checkpoint protocol.
    - Evidence (2026-07-16): authoritative-root migration `20260716112909` passed replacement-branch replay, exact catalog/ACL/ownership/static/consumer gates, and production apply. One bounded existing-game request for `2025030416` returned HTTP 200 and left exactly two distinct team rows, both with complete player arrays and truthful Gamecenter provenance; no second provider probe was run. Production recheck confirms five columns, one service-role-only RPC, two provenance-bearing rows, and unchanged NEW 56/57 routines. Guarded `octoberBranch` publication at `09c4d96` and exact rollout deployment `dpl_5LADmdbVfdJEzKubKkpR7Yr7zxzk` passed all five aliases plus 200/401/200 homepage/auth gates. Current customer aliases resolve READY Production `dpl_3rviF6Zfuyk9s2MqjC7myNGKA6i9` at verified descendant SHA `7d55088`; the homepage remains HTTP 200 and the five GDL/email routes have zero seven-day runtime error clusters.

- [x] NEW 12.0 **P2 raw downstream processor error passthrough:** replace the authenticated IFTTT receiver's raw non-2xx body/exception relay with a stable status-only failure contract while preserving raw-first retryability. Evidence (2026-07-16): non-2xx follow-up returns only the bounded status plus `Processor request failed`; the regression proves the raw body is absent from the webhook response, and the refreshed 11-file suite passes 110/110 plus TypeScript.

- [ ] NEW 13.0 **P0 IFTTT Webhooks provider-key exposure containment:** a read-only applet detail-page DOM snapshot rendered the Webhooks service credential into the private execution transcript. Never reproduce it. Before any controlled event, rotate that provider key, inventory and update every proven inbound Webhooks consumer value-free, verify retired-key rejection/current-key authorization without response bodies, and preserve unrelated outbound X-to-Webhooks applets.

- [ ] NEW 14.0 **P1 existing GDL applet payload drift:** repair the three existing Connected applets without recreating them. Replace the GameDayLines literal `SOURCE_ACCOUNT` with `GameDayLines`, add the documented `tweet_embed_code`/`TweetEmbedCode` ingredient to all three payloads, retain the exact watched accounts/routes/POST/JSON/nonblank-header contract, and re-audit the redacted field shapes before promotion or one-event-per-account proof.

- [ ] NEW 15.0 **P0 regenerated IFTTT Webhooks key remains authorized:** the provider issued a distinct current documentation key and the current key authorizes unique cache-busted probe events, but the retired key also remained accepted on two unique probes including a delayed retry. The single authorized signed-in repeat regeneration issued another distinct working replacement; unique cache-busted probes then proved that both prior generations still authorize. Official IFTTT guidance says regeneration invalidates all previous webhook URLs. Keep NEW 13/16 open and hold NEW 14, production promotion, and every controlled event pending NEW 17 resolution.

- [ ] NEW 16.0 **P0 current IFTTT Webhooks key exposed in retained probe URL:** automatic-continuation tab inventory rendered the current credential-bearing Maker probe URL and showed that the tab had been left on that URL after handoff. The tab was immediately navigated to the IFTTT login page without inspecting session/password state. Treat the current key as exposed, fold its replacement into the already-authorized repeat regeneration, and require post-proof navigation to a non-credential IFTTT page before any tab listing/finalization. Never reproduce the value.

- [ ] NEW 17.0 **P0 multi-generation IFTTT credential retirement resolution:** after a second successful regeneration, both prior credential generations still authorize unique cache-busted requests while the newest distinct credential also authorizes. The separately approved option-B remove/reconnect path completed without losing the five applets: the four production applets were restored Connected and the podcast applet was restored disconnected. However, a unique post-reconnect probe proved the immediately prior key still authorizes while the distinct replacement also authorizes, so the retirement gate failed again. Keep every downstream provider/deployment/event/email/data action held; provider-confirmed account-level revocation/support evidence is now required before closing NEW 13/15/16/17.

- [ ] NEW 18.0 **P0 Webhooks remove/reconnect does not retire the prior key:** IFTTT archived all five applets, accepted a fresh service connection with a distinct current key, and allowed the prior four-Connected/one-disconnected state to be restored, but the pre-reconnect key still authorized a unique bounded no-listener event after reconnection. Preserve the restored state, submit a value-free provider-support request for account-level invalidation, and require prior-key rejection plus current-key authorization before any downstream action. This is additional remediation evidence for the existing provider-retirement root finding, not a second severity count. Evidence (2026-07-21): support replied in the exact thread but could not locate the account from the originally supplied identity and requested an alternate account email or billing identifiers; it did not confirm account-level invalidation or historical-key rejection. Read-only signed-in account settings prove a different current account email and the expected username/Pro state. The owner sent the identity-only clarification with the existing settings screenshot, and bounded Sent Items verification confirms the reply is in the exact thread. NEW 22 tracks the pending provider response without storing the address or billing values. Owner-approved scheduling remains in force: keep this row bookmarked as a held external dependency, check the exact thread only at meaningful initiative checkpoints, and continue non-overlapping super-goal work without touching NEW 14/19 or held applet/event/email/data paths. Keep this row open until provider-side invalidation is proven by prior-key rejection and current-key authorization.

- [ ] NEW 19.0 **P2 disconnected podcast trigger drift after restore:** the restored podcast Webhooks applet remains disconnected, but its Spotify trigger now selects an unrelated show rather than `Five Hole Fantasy Hockey Podcast`. Keep it disconnected and correct/reverify the exact show/action contract only through a workflow that cannot leave the applet active unintentionally.

- [x] NEW 20.0 **P0 production IFTTT receiver-secret transcript exposure:** post-restore action inspection rendered the nonblank `X-FHFH-IFTTT-Secret` value into the private execution transcript. Never reproduce it. Evidence (2026-07-17): four distinct replacement receiver bindings were applied value-free to the exact Vercel Production-scoped variables and their four Connected applets; route, POST, JSON, body, header-name, nonblank, and one-to-one binding audits all pass while the podcast applet remains disconnected. Exact unchanged-source Production redeploy `dpl_43DPkUc3bVS2CVitR7vdiduf3CzJ` is READY on all five aliases at verified SHA `89ace52`. A one-use memory-only localhost relay proved retired/replacement status pairs of `401/400` for GameDayLines, GameDayNewsNHL, GameDayGoalies, and CCC on empty JSON; every request stopped before event persistence, the relay exited, and no value was output or persisted.

- [x] NEW 21.0 **P2 legacy CCC receiver still relays raw processor failures:** the generic GDL receiver is bounded, but `ccc-tweet` still returned the downstream response body or caught exception message inside its successful raw-first webhook response and warning payload. Both paths now use the stable `Processor request failed` classification while preserving bounded status and pending/retryable storage. Two focused non-relay regressions plus the 13-file/99-test ingestion selection, project TypeScript, Prettier, and scoped diff checks pass (verified 2026-07-17).

- [x] NEW 22.0 **P0 IFTTT support account-identification mismatch (same retirement root):** provider support found the account and escalated the still-valid historical Webhooks-key issue to engineering. The owner replied in the exact thread that the request is precautionary and there is no known leak. This closes only the value-free account-identification follow-up; no address, credential, or billing value is stored here. Keep NEW 13/15/16/17/18 and every downstream applet/promotion/event/email/alias/reprocess/data action held until engineering responds and direct retired-key rejection/current-key authorization are proved (verified 2026-07-21).
