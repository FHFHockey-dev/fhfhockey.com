# Tweet pipeline implementation and release report

## Scope and controls

Local implementation for GameDayLines, GameDayNewsNHL, GameDayGoalies and CcCMiddleton. No remote migration, deployment/build, production roster refresh, live replay or email was executed.

Both flags default to false:

- `TWEET_PIPELINE_INTERPRETATION_ENABLED=true`: versioned roster-informed parsing, typed player events, claims, review reasons and bounded reconciliation. Legacy canonical-lineup writes stop in this mode.
- `TWEET_PIPELINE_PUBLISHING_ENABLED=true`: also requires interpretation enabled. Enables the public projection API, new forecast observations and automatic news publication. With interpretation enabled but publishing disabled, new interpretations remain unpublished.

Turning both flags off restores the legacy interpretation/publishing path. Additive tables and retained raw events remain available for diagnosis. Roster targeting, safer identity resolution and public attribution checks remain fixes rather than optional behavior.

The new canonical projection view uses `tweet_projection_reports`; it does not overwrite historical `lineCombinations` rows. Complete situations are selected independently, so a PP/PK update preserves ES and the other special-team situation. Historical observed lineups and shared-ice-time components remain separate.

## What changed

| Surface | Implementation |
| --- | --- |
| Identity | `playerIdentity.ts`: paginated directory, normalized full names/aliases/initials/unique surnames; explicit ambiguity and membership conflicts. No first-surname or final-word fallback. |
| Rosters | Explicit upcoming roster season, separate from statistical season selection. `/api/v1/db/update-players` defaults to dry-run and accepts `seasonId`. Conflicting/failed official roster responses fail the refresh. Existing roster-history RPC is retained. |
| Camp coverage | Evidence-bearing `tweet_player_memberships` supplements rosters. Manual review can record a verified NHL camp source for 30 days; it does not rewrite historical rosters or infer a trade. |
| Interpretation | `tweetInterpretation.ts` preserves evidence spans, sections, compound names, whitespace rows, ES/PP/PK/goalie/scratch/injury units and camp groups. Unknown compact rows become parsing review rather than invented person aliases. |
| Player events | `tweetPlayerEvents.ts` extracts subject-specific goalie/injury evidence, certainty, durations and relative dates. Prior published injury history can distinguish new/ongoing injury. Reassessment and return targets remain distinct. AI output is bounded by canonical candidates and copied subject evidence; parser/identity revisions invalidate its cache. |
| Publishing | `projectedLineups.ts` selects complete situations by publication time within their occasion. Single ES lines stay in the rail. PP/PK pairing requires explicit complementary units, matching team/session/game/group/Eastern date, known original times within 90 minutes and no conflicts. |
| Forecasts | Game-bound validated situations use existing atomic forecast observation RPCs. Cross-report special-team pairs enter together. Camp/practice reports and historical shadow replay never become live game forecasts. |
| Provenance | Public projections/news suppress relay accounts and anonymous wrapper links. Text cards can publish without an original URL. A bounded X API retweet-reference retry verifies original identity and matching text; it never manufactures a link from an author name. |
| Processing | Shared IFTTT receiver, immutable duplicate raw delivery, five-event gated batches, processing leases, timeouts, failure stages and bounded retries. Exhausted raw events move to `failed` for explicit operator review. |
| Review | All-player/NHL-ID search; identity aliases do not silently repair missing membership. Saving schedules checkpointed reconciliation. Current-day processing is bounded; historical rows only reconcile review status. |
| Notifications | New queue counts use actual inserted rows. Digests exclude notified rows, claim their batch and use an email-provider idempotency key. No email was sent during implementation. |

Public routes: `/lines`, `/lines/[abbreviation]`, `/lines/line-combo/[gameId]`, with `/api/v1/lines/projected` supplying the gated projection view and original-tweet rail. The game view places observed shared ice time below projections. Review lives at `/db/player-aliases` and `/db/tweet-pattern-review`.

## Read-only reconciliation evidence — 2026-09-18

The live queue changed independently during the audit: 921 initially, 926 in the first replay and 929 in the final measured replay. None of these rows was updated by the audit script.

- Database roster baseline: **zero** rows for 2026–27; 1,198 rows for 2025–26, including 1,147 current memberships.
- Baseline 926-row replay against the database's empty upcoming roster: **909 review, 17 invalid extraction, zero automatic resolutions**.
- Official NHL 2026–27 roster preview: **1,299 players**. This data replaced only the replay's in-memory roster directory.
- Final 929-row preview: **431 proposed resolutions, 18 invalid extractions, 480 remaining reviews**.
- Remaining reviews: **241 missing memberships, 120 ambiguous identities, 119 missing players**.
- Trocheck **8476389** appears as **Vincent Trocheck, Utah team ID 68, season 20262027** in the official preview. The database's previous membership was NYR/20252026. An alias cannot fix that missing roster refresh.
- **197 distinct tweet/team contexts**, **116 verified original links**, **81 attribution gaps** in the queue evidence.
- Shadow interpretation proposed **9 complete situation sets containing 53 units**. These are historical hypothetical outputs, not a proposed replacement for today's lineups. No game binding was inferred from date alone.
- Full read-only replay, including database and NHL reads, took **7,141 ms**. This is an offline audit measurement, not a live processing-latency comparison.

The 431 figure is a provisional identity-match count, not a promise of automatically publishable lineups. Team/date/occasion validation, extraction completeness and source attribution remain separate checks. `Dower Nilsson` is preserved as a compound surname; it must not be split merely because it contains a space.

Reproduce from `web/` using existing dependencies and configured server credentials:

```sh
NODE_PATH=. ./node_modules/.bin/ts-node --transpile-only \
  --compiler-options '{"module":"commonjs","moduleResolution":"node"}' \
  scripts/audit-tweet-pipeline.ts --season=20262027 --limit=1000 \
  --nhl-rosters=true --output=/tmp/tweet-pipeline-shadow.json
```

Omit `--nhl-rosters=true` to measure existing database coverage. Resume with `--after=<nextCursor>` when returned. The JSON records dispositions, review reasons, proposed situation outputs, attribution gaps, roster evidence and elapsed time. It cannot call a receiver, send mail, write rosters or publish forecasts. Raw row-level audit output was kept outside the repository.

## Verification

- **200 targeted unit/API tests across 15 files passed** (affected files rechecked after the final changes). They cover supplied false-name and compound-name examples, pagination, preseason identity/membership, PP/PK/camp parsing and pairing, injury certainty/timeframes, original attribution, history-safe replay, gated storage and forecast adapters.
- **Both Playwright scenarios passed.** Playwright verifies projection-first DOM order, the separate observed-TOI section, original links and linkless camp cards, and all-player NHL-ID review/save. Requests are intercepted with fixtures, including review writes. The external Twitter widget script is blocked; the fallback/embedding markup is verified, not third-party widget availability.
- The additive migration was executed in an isolated local PostgreSQL 15 container with dependency-table fixtures. Checks cover private table permissions, exclusive claims, lease expiry, explicit replay, retry limits and original-tweet uniqueness. This is not a full production-schema migration rehearsal.
- **TypeScript passed; touched-file ESLint passed with zero errors and two existing image warnings.** Existing `<img>` warnings in the team page are unrelated to this change. No production build was used as verification.

## Authorized release steps to prepare, not execute automatically

1. Review and apply `supabase/migrations/20260919005608_tweet_pipeline_reports_and_review.sql` through the repository's root migration tree. Confirm prerequisite forecast RPCs `capture_starter_board_goalies` and `capture_starter_board_lineup` are present. Verify RLS and service-role-only access to the new tables/functions.
2. Review the explicit **20262027** roster dry-run. After separate authorization, run the roster updater with `seasonId=20262027&dryRun=false`. Historical-season writes are rejected. The endpoint now defaults to dry-run; intentionally configure any existing scheduled refresh to write only after approving this behavior.
3. Re-run the shadow audit against refreshed database coverage. Review missing camp/prospect evidence rather than creating aliases for missing roster membership. Resolve genuine ambiguities manually.
4. Enable interpretation with publishing still off in the authorized test/canary environment. Inspect typed reports, `tweet_pipeline_jobs.failure_stage`, exhausted raw events, review reasons and processing times. No resolution-rate target is asserted before this review.
5. After validation, separately authorize enabling publishing. Check latest-source ordering, complete situation replacement, camp separation, original/linkless attribution and forecast captures on current-day reports. Check original-ID deduplication in news.
6. The scheduled `/api/v1/db/replay-player-aliases` worker runs every ten minutes only when interpretation is enabled. It processes one review job page, at most two current-day processor calls, at most three attribution lookups, and one pending digest request per invocation. Recipient claims prevent overlapping digest batches. Attribution lookup requires configured X API credentials; unresolved links remain text cards without them. Do not copy credentials into requests, reports or logs.
7. Authorize live reconciliation independently. Do not send the historical backlog through current-day processors. Compare accepted automatic matches, invalid extractions, remaining review, attribution coverage and received-to-processed latency during the canary before widening rollout.

Rollback: disable both flags. Retain new report/event/job tables and raw evidence; do not delete roster history or the review queue. A feature rollback does not undo already authorized roster refreshes or sent notifications.

## Prospect coverage correction — 2026-09-18

The initial completion assessment missed a material integration gap: roster feeds are not a complete player directory, and the existing `fhfh_player_identities` registry was disconnected from tweet matching. Local implementation now includes the following additions. **This remains a local release candidate, not an operational production rollout.**

- Official NHL draft records (`records.nhl.com/site/api/draft`) supply exact NHL IDs and draft history. The draft tracker does not supply those IDs. Imports preserve compound names and paginate the source; forfeited picks are excluded.
- `nhl_draft_selections` records year, round, round pick, overall pick, drafting team, amateur club/league, source and verification time, linked to the existing identity registry. The transactional `import_nhl_prospect_identity` RPC links existing verified identities and creates compatible NHL-ID rows in `players` without changing active team/roster fields. It never substitutes registry IDs for NHL IDs.
- Fresh individual NHL profiles supply separately expiring organization evidence. Draft ownership never establishes current membership. Profile refresh preserves organization history; contradictory current roster/camp/organization evidence remains unresolved. Unavailable profiles retain draft identity evidence only; HTTP 429 stops the batch for backoff and cursor-based resumption.
- Tweet ingestion, news and review include verified registry aliases. Prospects without an NHL ID remain in the registry and appear as unlinked prospects in review; they cannot be published under invented NHL IDs.
- `/db/player-aliases` now provides **Look up NHL ID**, verifies against NHL, shows the source, and offers **Import NHL player and save alias**. Lookup GETs do not write. Save re-fetches evidence server-side. Imports schedule bounded reconciliation for matching pending names. Identity conflicts enter the existing identity review queue instead of blocking an entire draft class.
- `/api/v1/db/update-drafted-prospects` defaults to dry-run. Its scheduled mode refreshes six recent classes in resumable batches of at most 25, every two hours, using a processing lease and bounded retries. Both `TWEET_PIPELINE_INTERPRETATION_ENABLED=true` and the new, default-off `NHL_PROSPECT_REFRESH_ENABLED=true` are required for background/script writes. Explicit `dryRun=true` overrides scheduled mode. Manual review imports require interpretation enabled and an authenticated or signed review action.

### Evidence and limitations

- A read-only production query confirmed Cloutier was absent from both `players` and `fhfh_player_identities`; this is missing identity coverage, not a spelling/alias failure.
- Cloutier **8485689**: official 2025 draft record confirms round 7, pick 28, overall 220, Winnipeg, Saginaw/OHL. Neither the Winnipeg season roster nor its prospects feed returned him during this check; his individual profile verified current Winnipeg organization. The focused five-player preview including Cloutier completed without warnings: `/tmp/fhfh-cloutier-draft-preview.json`.
- 2025 full source preview: **224 player records with NHL IDs**; current profile enrichment succeeded for 50 and encountered 174 rate-limit warnings. This exposed the missing backoff behavior, which has since been corrected and regression-tested. The full profile-enriched class has **not** been reverified after that correction. `/tmp/fhfh-draft-2025-preview.json` records the original evidence.
- 2026 draft-only preview: **223 player records with NHL IDs**, zero source warnings, one forfeited pick excluded. Draft-only mode makes no current-organization assertions. `/tmp/fhfh-draft-2026-records-preview.json`.
- Local PostgreSQL 15 execution verifies registry linking, repeat-import idempotence, draft history, no active-team mutation, organization changes, identities without NHL IDs, conflict rejection, private permissions, and queued replay. Uses the real registry migration and player column definitions with dependency fixtures; not a full production-schema rehearsal.
- **74 targeted tests across eight files passed**, including source pagination, verified registry aliases beyond the first page, profile lookup, draft-only import, rate-limit backoff, conflicting membership, scheduled write gates, cursor resumption, existing processors and inference. TypeScript and touched-file ESLint passed.
- Browser verification passed for existing out-of-team ID search and the new missing-prospect lookup/import workflow. API requests and writes were intercepted with fixtures. Live NHL reads were verified separately by source previews; no production import occurred.
- Existing backlog figures above predate prospect imports. They are **not** a measured resolution rate for the new prospect coverage. Re-run shadow reconciliation after the authorized import before enabling publication.

### Additional release steps

Apply `supabase/migrations/20260919005622_nhl_draft_identity_ingestion.sql` after the earlier tweet-pipeline migration. Verify the service-only RPC/table permissions. Review draft source previews before authorizing imports. From `web/`, use existing dependencies:

```sh
NODE_PATH=. ./node_modules/.bin/ts-node --transpile-only \
  --compiler-options '{"module":"commonjs","moduleResolution":"node"}' \
  scripts/import-nhl-draft-identities.ts --year=2025 --all=true \
  --profiles=false --output=/tmp/nhl-draft-2025-preview.json
```

Omit `--profiles=false` to enrich with individual profiles. Omit `--all=true` for one batch; use `--after=<nextCursor>` to resume. Explicit historical years support older prospect backfills. The script checkpoints each completed batch. Writes require the two flags and explicit `--write=true`; do not run that mode without production-write authorization. After importing identities and refreshing roster/organization evidence, re-run the shadow queue audit. Authorize deployment, flags and live reconciliation separately. Disabling `NHL_PROSPECT_REFRESH_ENABLED` stops background imports without deleting identity/draft history. Genuine identity conflicts, unlinked NHL IDs and missing/contradictory membership remain manual review items.

## Production release — authorized 2026-09-18

The user authorized production release. Applied the pipeline and draft migrations, plus `20260919005852_nhl_prospect_verification_actor.sql` to satisfy the production registry's verification-actor constraint. Local migration assertions were rerun with that actual constraint and passed. Migration filenames match production migration history. The 2026–27 roster refresh wrote 1,301 players and current memberships. Initial deployment enables interpretation and prospect refresh while keeping publishing off for live validation. Source imports, live verification and activation are recorded in the release task. Earlier no-production-write statements describe the implementation/audit phase only.
