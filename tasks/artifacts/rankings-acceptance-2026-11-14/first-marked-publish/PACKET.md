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
