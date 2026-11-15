# First marked publish — packet (proposed; each write needs TJ's pop-up)

**Where:** isolated `next dev :3110` served from a clean export of master `089a6a771` (#450), using local-loopback trust. No secret is handled. Every route call writes its normal cron-audit row, dry runs included.

## Steps (sequential; stop on any failure)
1. **Rankings dry run:** `update-entity-metric-rankings?season=20262027&dryRun=true`, with defaults: 4 windows, 5v5, all_skaters, floors 1/300.
   - Pass:
     - `publication.marked=true`;
     - every window has no blockers;
     - every `writtenEntities` equals `expectedEntities`;
     - a single `snapshotDate` **D, later than 2026-11-13**.
   - If D is 2026-11-13, stop. The era would start at 11-13 and live would fall back to the 740-skater 11-11 pair while it rewrites.
2. **Composites dry run** at `as_of_date=D`. Pass if `publication.ready`, its `snapshotDate` is D, and the row count equals `expectedPlayerCount`.
3. **Rankings write:** `dryRun=false&as_of_date=D`.
   - Pass:
     - HTTP 200;
     - `publication.complete=true`;
     - every window `complete`;
     - `dbWrittenRows` is not null and equals the built rows.
   - If `dbWrittenRows` is null, stop: real PostgREST did not return a count. Live stays at 11-13, because the markers stay at `writing`.
4. **Composites write:** `dryRun=false&as_of_date=D`. Pass if HTTP 200 and `completion.status=complete`.
5. **Readback** (1 SQL, 5 s timeout): `ranking_publications` for 20262027 should show 4 Rankings windows and 1 composites row at D, all `complete`, with counts equal.
6. **Deployed smoke** (2 GETs): the page-default matrix and team=EDM should be at D, with 769+ / EDM rows and 0 null composites.

## While it runs
- **Before step 4:** live keeps 11-13. The #449 match runs below the era start D.
- **After step 4:** live moves to D in one step, within the reader's 30 s cache.

## Run 1 (2026-11-15, TJ: "Dry runs, then publish")
1. **Rankings dry run:** 200 in 20.3 s. Marked; D = **2026-11-14**; 4 windows × 13,175 rows, 775 skaters, no blockers, 0 unavailable metrics.
2. **Composites dry run** at as_of 2026-11-14: 200 in 11.5 s; 775 rows, ready, coverage verified (775).
3. **Rankings write** at 20:29:34Z: 200 in 85.4 s. 52,700 built = 52,700 upserted = **52,700 reported by the database**; all 4 windows `complete` (775/775).
4. **Composites write** at 20:31:05Z: **409, nothing written.** The composites writer looked up the Rankings marker under the composite rows' own peer key `"all_skaters"`. Rankings and the reader key the cohort as `"all"`. This is a key mismatch in #450, and its test fixture had used `"all"`.
5. **Readback SQL:** 4 Rankings markers complete at 11-14 (key `"all"`); no composites marker.
6. **Live GET:** 200, still **11-13**, 769 ranked, 0 null composites. The guard held the last complete pair, as designed.

**Fix (local):** composite markers now key the all-skater cohort as `"all"` on both surfaces, and the fixture uses the real `"all_skaters"` row key. Next: release the hotfix, then rerun step 4 and steps 5–6.
