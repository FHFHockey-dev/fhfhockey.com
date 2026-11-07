# Beat-reporter review lane (Claude, 2026-11-07)

## Scope
Infer beat reporters + team associations from stored tweet/source tables (read-only), review page
`/db/beat-reporter-review` (trainer swipe/keyboard pattern), decisions persisted to `web/lib/lines/beatReporters.ts`
via a dev-only API route. authority.ts is read-only (lines-followups lane wires the import).

## Where
octoberBranch, sole checkout. Own files only (new page/component/API/data/lib files).

## Read-only queries (pre-approved bounded SELECTs; logged before running)
Q1 schema: `select table_name, column_name, data_type from information_schema.columns where table_schema='public' and table_name in ('lines_ccc','line_source_snapshots','tweet_pattern_review_items','line_source_ifttt_events','lines_ccc_ifttt_events','line_source_captures') order by table_name, ordinal_position;`

Q2 profile: `select count(*) total, count(distinct source_handle) handles, count(distinct coalesce(metadata->'sourceProvenance'->>'originalAuthor', raw_payload->'fx'->'author'->>'screen_name', quoted_author_handle, source_handle)) authors, min(snapshot_date), max(snapshot_date) from line_source_snapshots;` plus `select source_group, classification, count(*) from line_source_snapshots group by 1,2 order by 3 desc limit 40;`
Result Q2: 7,045 rows, 64 source handles, 95 author candidates, 2026-04-30..2026-11-07.

Q3 author x team: `select lower(coalesce(metadata->'sourceProvenance'->>'originalAuthor', raw_payload->'fx'->'author'->>'screen_name', case when primary_text_source='quoted_oembed' then quoted_author_handle end, substring(raw_text from '^\s*RT @([A-Za-z0-9_]{1,15}):'), source_handle)) author, team_abbreviation, count(*) n from line_source_snapshots where classification in ('lineup','goalie_start','practice_lines','power_play') group by 1,2 order by 3 desc limit 300;`
Result Q3: clear per-author team clustering (e.g. stefen_rosner NYI 76, davidalter TOR 67, sheng_peng SJS 63); null authors and relays present.

Q4 (route GET, read-only, bounded 6 x 1000 rows, 10-min in-process cache): PostgREST `line_source_snapshots.select(source/quoted/text cols, raw_payload->>provider, raw_payload->fx, raw_payload->quote, metadata->sourceProvenance, metadata->>iftttSourceAccount).in(classification, [lineup, goalie_start, practice_lines, power_play]).order(capture_key).range(...)`. Attribution via authority.sourceAttribution (same as the engine).

## State
- Commit 1a5218be6: inference lib + tests, writer + tests, empty data file, route, page, component.
- Checks: vitest 13/13 pass (beatReporterInference, beatReporterFile); typecheck exit 0; eslint clean on own files; CSS pure check OK.
- Isolated dev (:3107, PLAYWRIGHT_ISOLATED_NEXT=1) served the API (4,237 rows read, 171 candidates with >=3 posts); page gate needs sign-in there, so the screenshot was taken on TJ's signed-in :3000 (view only, no clicks). :3107 stopped by PID.
- Screenshot: side-session-notes/<chef>/beat-reporters/beat-reporter-review-desktop.jpg

- Commit 7ee41022a: TJ reviewed all 171 candidates: 170 beat, 1 not_beat ("source_account", a bad source_handle value in the data).
- TJ follow-up (pop-up answer): page stays usable anytime for new names; a reassigned reporter must re-flag as a conflict.
- Commit 066713288: findTeamConflicts (>=5 team-tagged posts after reviewedAt day, <50% on assigned teams) first in queue with Move to / Keep (K); route read now newest-first. Vitest 15/15, typecheck exit 0, eslint clean, CSS pure OK. Live API on :3000: 4,244 rows, 0 candidates, 0 conflicts (expected). Conflict UI not seen live (no conflict data yet).

- Commit cb5e98a33: candidate rows cached 24 h (TJ: once a day is enough).
- Chef verified all four commits, HEAD typecheck exit 0. TJ: penguinspr/chgo_blackhawks treated as club in authority.ts (Lines lane); beatReporters.ts unchanged.

## Next
Done. Lines lane (lines-followups) wires BEAT_REPORTER_HANDLES into authority.ts.

## Notes for TJ/Chef
- Confirmed list includes team-adjacent accounts (penguinspr, chgo_blackhawks, tsn1200 radio): TJ's call, flagged only.
- swhyno is the only multi-team entry (NYR+NJD+NYI).
## Gotchas
- POST only writes when NODE_ENV=development (403 otherwise). Undo (U) removes the last saved decision.
- Confidence = top-team share x min(1, ln(1+n)/ln(31)); not_beat entries persist so they are not re-offered.
