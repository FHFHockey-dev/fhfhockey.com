# Historical reported line combinations: source inventory

2026-11-12 · local source inspection at `525c647c713091bbb851c23b86221973dd72983a`, `octoberBranch` (working tree contains concurrent changes). No application edits, DB/provider/network requests, replays, tests, builds or deployments. Existing invalid-TOI chat retains DRM/shift ownership.

## Decision

The repository has historical tweet evidence and versioned claims; it does **not** currently expose a team/date-range archive. Actual requested-range coverage, deployed schema/flags and link availability remain unmeasured. Add a bounded archive reader only after that coverage check. A projected/practice/warmup report remains a source claim; it cannot establish observed on-ice units or validate shift-derived TOI by itself.

## Storage and reader map

| Layer | Actual contract | Historical use / limitation |
| --- | --- | --- |
| `line_source_ifttt_events`, `lines_ccc_ifttt_events` | Raw deliveries, tweet ID, text, original payload, `tweet_created_at`, `received_at`, processing status; duplicate intake ignored. `lineSourceIftttReceiver.ts:345` and baseline DDL. Names persist after provider cutover. | Discovery/processing evidence, not team-resolved or validated units. Do not infer team from queue text alone. |
| `x_timeline_shadow_posts` | Unique `(source_key,tweet_id)`; original/nested author, repost/quote IDs and text, URL, publication and first-seen clocks; private RLS migration `20261106012634`. | Provider intake archive without team ID. Repost ID can be original ID with wrapper ID in payload. First sighting wins; not complete X edit history. |
| `line_source_snapshots`, `lines_ccc` | `snapshot_date`, team/game, nullable best-effort `tweet_posted_at`, `observed_at`, `updated_at`, wrapper/quoted IDs and URLs, raw/enriched text, classification, filter/review status, player IDs/ordered units, raw payload/interpretation. | Historical source captures, **not immutable revisions**: processors upsert capture keys, update same-tweet/team collisions and supersede wrong-team rows (`update-line-sources.ts:245–320`, `update-lines-ccc.ts:130–195`). Keep rejected/superseded evidence in diagnostics. Reparse may overwrite a source snapshot. |
| `tweet_projection_reports` | Primary `report_key`; indexed `(team_id,report_date,published_at)` and game ID; JSON payload retains units, context/certainty/version, original/relay attribution and clocks. Persistence ignores duplicate keys. | Retained parser outputs, conditional on publishing (or separate shadow path). Key hashes original ID/team/date/text/interpretation and includes parser version. Latest public view collapses versions by team + original URL, or team + identical text when URL is missing. Report schema permits updates; do not call this DB-enforced immutable storage. |
| `line_source_captures`, `line_claim_revisions`, `line_claim_relations` | Immutable capture/claim IDs; raw text/time/provenance; team/game binding and evidence, identity-at-event status, parser/selector version, explicit supersedes/retracts links. `20261002134400_game_line_snapshots.sql` forbids UPDATE/DELETE; service role SELECT/INSERT only. | Best canonical versioned claim history **where populated**, preserving original/relay/ingest/interpret/effective clocks and unknown time precision. Semantic relations require eligible matching game/team and reviewed or original-author authority. |
| `line_entry_revisions`, `line_pp_decisions` | Immutable game/team revision chain, previous/replaces IDs, cutoff/frozen state, selected claims, conflicts and correction IDs. Atomic compare-and-append RPC. | Historical *entering lineup decisions* and PP defaults, not shift-observed truth. Carried units retain origin game and designation. |
| `/lines/[abbreviation]` → `ProjectedLineups.tsx` → `/api/v1/lines/projected` | UI sends team ID/optional game ID, polls every minute. API accepts no date-range parameters. Flags choose snapshots or legacy projection response. Observed lineup section stays separate. | Existing source link cards/embeds are reusable; current endpoint is not an archive contract. |

`tweetProjectionStorage.ts:276` reads one `report_date`, optional team/game, deterministic paginated `report_key` order, maximum 1,000 public rows **before** version deduplication; internal mode has no row cap. Public records strip internal identity/roster/evidence data and sanitize text. `projectedLineups.ts` selects complete units separately by ES/PP/PK and occasion; PP/PK cross-report pairing requires known original clocks within 90 minutes and no contradiction. A partial report remains useful evidence even when it yields no complete set.

Snapshot service (`lib/lines/service.ts`) defaults to games 21 days back/14 forward relative to **now**. Even an explicit old game ID still fetches claims with a `since` interpretation-time bound based on that current window. Historical entries may survive, while old raw claims/feed are absent. It also observes stale game state through the NHL reader; reuse would introduce external reads. Its feed collapses relays per original, includes game-bound claims and nearby unbound reports, and picks latest interpretations. Neither behavior is a full archive or cutoff-time evidence export.

## Attribution, time, corrections and access

- Original links are normalized/checked by `verifiedOriginalTweetUrl`; relay accounts and unknown anonymous identities are withheld. Snapshot `publicClaim` additionally checks author/ID/provenance consistency. Missing attribution stays explicitly linkless; do not manufacture URLs from author names or count relays as independent corroboration (`captureIdentity` in `lib/lines/reconcile.ts`). Stored URL validity does not prove the remote post still exists; no external links were opened here.
- Legacy `ProjectionReport.publishedAt` comes from best-effort source `tweetPostedAt`, Eastern date or fallback snapshot date; received time can be fallback-derived. Rich `SourceTime` separately preserves original/relay/ingestion/interpretation/effective time, precision and basis. Verified-publication and event-membership evidence are required for eligible claims (`sourceClaims.ts`, `reconcile.ts`). Unknown clocks must remain unknown in a historical view.
- `activeLineClaims` selects latest interpretation per original/unit and applies authorized corrections/retractions; storage retains all versions. An archive should expose revision/correction state, rather than silently select latest or revive retracted units. A true “known by cutoff” reconstruction must bound original publication **and ingestion/interpretation**, and preserve historical identity evidence.
- New report/claim/shadow tables have RLS and explicit private grants in their migrations. Baseline raw snapshot/queue tables enable RLS but also have broad table grants; no matching permissive policies were found in the inspected baseline. Grants alone do not prove exposure or safety. Validate actual live policies/grants before adding a public server projection. Existing API uses the server-only service-role client; browser raw-table access would bypass intended sanitization boundaries if enabled.
- Existing raw indexes: snapshots `(snapshot_date DESC,team_id,game_id,classification,status,nhl_filter_status)`; CCC `(snapshot_date DESC,team_id)` plus `(game_id,team_id)`; source/tweet/quoted IDs and accepted-row uniqueness. Claim index `(team_id,game_id,interpreted_at,claim_id)` supports exact game scopes; no typed/indexed original-publication archive column is established here. `20261109213000_line_source_observed_at_indexes.sql` is explicitly a draft; deployment/validity cannot be assumed.

## Proven gaps and coverage evidence limits

1. No range API/UI, range cursor/truncation contract, explicit coverage response or historical clock definition exists in the inspected path.
2. Source snapshots can be overwritten; current public projection/claim views collapse history. Missing immutable claims cannot be reconstructed honestly from today's mutable snapshots.
3. FxTwitter polling is limited to seven tracked accounts (`DFOFantasy`, `NHL_Rosters`, `CcCMiddleton`, GameDay Lines/News/Goalies, FHFHockey); it is not a team-wide or all-reporter archive. FHFHockey is excluded as lineup-author authority. The current gap helper reads at most four extra pages/account and the poller budgets sixteen extra pages/run; no arbitrary date-range backfill is established. Empty initial history skips backpaging; unresolved/abandoned gaps can persist.
4. The 2026-11-05 scraper diary's latest 11-08 check reports 36/38 CCC parity with IFTTT, including a known reply miss and another unexplained miss; earlier deleted posts were unavailable. It reports successful attribution for its narrow repost sample, not universal archive coverage. September release-note counts are older, different windows and cannot certify November/team-range coverage.
5. Local migrations/code do not establish present table population, earliest retained day, per-team/day completeness, flags, retention or reachable originals. No coverage rate is claimed.

## Smallest implementation proposal after diagnostics

1. New dedicated read-only history route, leaving `/projected` and DRM/shift paths alone: require valid team ID + inclusive Eastern `startDate/endDate`, initially cap 7 days, page 100 reports with stable `(date,source-kind,record-key)` cursor and explicit `hasMore/truncated`. Separate report-publication date from game/application date. Query historical stores directly, never call the live service, processor or source provider on GET.
2. Prefer versioned captures/claims when populated; retain snapshot-backed items as explicitly legacy/reparsed evidence. Preserve partial, ambiguous, corrected and linkless items with context/status and visible time basis. Collapse relay duplicates for display while retaining lineage internally. Return a narrow sanitized DTO with source URL, safe original author/text, clocks, context, units and correction references; no raw payload, private evidence, review operator data or browser service-role access. Reuse public sanitizers, but avoid public helpers' deliberate version collapse as the archive's storage selector.
3. First deliver list/filter/source links. Do not infer complete lineups, carry current units backward, silently cross-pair reports or run historical replays. Any shift comparison is a later view with separate “reported” and “observed” data and explicit game/strength/minimum-TOI definitions after the shift owner hands off.
4. Add only a demonstrated query index if a bounded EXPLAIN shows existing paths insufficient. A historical-publication claim query may need a typed column/index later; do not expand schema before measuring populated-source coverage and selecting the clock contract.
5. Extend nearest route/reader tests for date validation, range bound, cursor overlap, attribution gaps, revisions/retractions, missing clocks, partial units, midnight/DST boundaries, empty/partial coverage and zero external calls. No tests were run for this inventory-only artifact.

Pending product definitions: requested team(s)/first historical range, publication-date versus game-date filtering, latest corrected view versus all retained versions versus “known by cutoff,” and whether linkless/legacy evidence should be visible by default. Safe starting assumption: publication-date browse with visible context/time/attribution gaps and expandable versions; this is not a promise of full coverage.

## Bounded diagnostic proposal — NOT EXECUTED

After separate authorization for read-only DB access, one team, at most seven Eastern calendar days, concurrency one, read-only transaction, `statement_timeout='3s'`, `lock_timeout='500ms'`. Stop after one conclusive sample or the first timeout/schema mismatch; no automatic retry, writes, raw payload export, provider calls or ingestion. Inspect schema/grants/index validity before data. Counts below are **capped sample counts**, never total coverage when the cap is reached. The operator supplies numeric `:team_id` and validated `:start_date`/`:end_date`; placeholders are bound parameters, not shell interpolation.

```sql
BEGIN READ ONLY;
SET LOCAL statement_timeout = '3s';
SET LOCAL lock_timeout = '500ms';

-- 1. Presence + actual RLS; inspect policies/grants/indexes for these names next
-- only if present. pg_class output is bounded by the explicit relation list.
SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN
 ('line_source_snapshots','lines_ccc','tweet_projection_reports',
  'line_source_captures','line_claim_revisions','line_entry_revisions');

-- 2. Existing date-indexed source samples. No text or raw payload returned.
WITH sampled AS (
 (SELECT 'snapshot' AS store, snapshot_date AS d, status, nhl_filter_status,
         tweet_id, source_url, observed_at, tweet_posted_at
  FROM public.line_source_snapshots
  WHERE team_id=:team_id AND snapshot_date BETWEEN :start_date AND :end_date
  ORDER BY snapshot_date DESC, capture_key LIMIT 2001)
 UNION ALL
 (SELECT 'ccc', snapshot_date, status, nhl_filter_status,
         tweet_id, source_url, observed_at, tweet_posted_at
  FROM public.lines_ccc
  WHERE team_id=:team_id AND snapshot_date BETWEEN :start_date AND :end_date
  ORDER BY snapshot_date DESC, capture_key LIMIT 2001)
)
SELECT store,d,status,nhl_filter_status,count(*) AS sampled_rows,
       count(tweet_id) AS with_tweet_id,count(source_url) AS with_any_stored_url,
       count(tweet_posted_at) AS with_posted_time,min(observed_at),max(observed_at)
FROM sampled GROUP BY store,d,status,nhl_filter_status
ORDER BY store,d,status,nhl_filter_status;

-- 3. Reports: coverage and parser versions, not a line-completeness assertion.
WITH sampled AS (
 SELECT report_date,interpretation_version,published_at,payload
 FROM public.tweet_projection_reports
 WHERE team_id=:team_id AND report_date BETWEEN :start_date AND :end_date
 ORDER BY report_date DESC,report_key LIMIT 2001
)
SELECT report_date,interpretation_version,count(*) AS sampled_rows,
       count(published_at) AS with_posted_time,
       count(*) FILTER (WHERE nullif(payload->>'originalUrl','') IS NOT NULL)
         AS with_stored_original_url
FROM sampled GROUP BY report_date,interpretation_version ORDER BY report_date;

-- 4. Game-bound immutable-claim sample uses the existing scope index.
-- It does not establish coverage for unbound practice/projected posts.
WITH scoped_games AS (
 SELECT id FROM public.games
 WHERE date BETWEEN :start_date AND :end_date
   AND ("homeTeamId"=:team_id OR "awayTeamId"=:team_id)
 ORDER BY date,id LIMIT 10
), sampled AS (
 SELECT game_id,interpretation_version,payload
 FROM public.line_claim_revisions
 WHERE team_id=:team_id AND game_id IN (SELECT id FROM scoped_games)
 ORDER BY game_id,interpreted_at,claim_id LIMIT 2001
)
SELECT game_id,interpretation_version,count(*) AS sampled_rows,
       count(*) FILTER (WHERE payload->'time'->>'originalPublishedAt' IS NOT NULL)
         AS original_clock_present,
       count(*) FILTER (WHERE payload->>'sourceUrl' IS NOT NULL) AS stored_url_present
FROM sampled GROUP BY game_id,interpretation_version ORDER BY game_id;
ROLLBACK;
```

Before statements 2–4, inspect `pg_policies`, `information_schema.role_table_grants`, and `pg_index` for only the same explicit table list (plus `line_claim_relations`, `line_pp_decisions`, `x_timeline_shadow_posts` if those readers are selected). Run plain EXPLAIN, not EXPLAIN ANALYZE, for any unexpected plan before executing. No schema/policy query was executed here. Exact original-URL verification counts require the existing sanitizer, rather than treating any non-null stored URL as a verified original. Wider archive bounds, unbound-claim searches or provider backfills need a separate cost/coverage decision after these results.
