# R3 catch-up failure: "Invalid relationship roster scope for game 2026020001"

Date: 2026-10-19. Code-only diagnosis. No hosted DB, API or cron calls. Nothing committed. No edits to `update-PbP.ts`, `ingest-projection-inputs.ts` or any frozen FORGE file.

Chef's read, "R3 catch-up run 1": 53 of 87 regular-season games have roster spots, but none under the current `projection_game_materialization_status.pbp_raw_payload_hash`.

## Root cause

**Production `ingest-projection-inputs` re-captures PBP without re-normalising the Gamecenter tables.** The fix already exists on octoberBranch but has never been released.

**Writers of `pbp_raw_payload_hash`:**

1. `ingest-projection-inputs` calls `captureProjectionRawSourceSnapshots` (RPC `capture_projection_raw_source_snapshots_v1`).
   - This inserts the freshly fetched PBP into `nhl_api_game_payloads_raw`.
   - The raw-insert triggers (`20260720105524`, `advance_nhl_api_game_payload_snapshot_head`) advance the `play-by-play` snapshot head whenever the hash is new.
   - `persistProjectionGameInputs` (`persist_projection_game_inputs_v1`) then writes the status row with that new hash.
2. The head advance fires `invalidate_nhl_api_game_normalization_status` (`20260722010355:325`). This flips `nhl_api_game_normalization_status` to `stale`.
   - It does **not** rewrite `nhl_api_game_roster_spots`.
   - Only `persist_nhl_api_gamecenter_normalized_v1` writes roster spots, and it is called via `persistNormalizedGameScope` / `persistCapturedGameNormalization` in `nhlRawGamecenter.mjs`.
3. In **released** code (R3 `7294e3847`, and R2), `ingest-projection-inputs.ts` never calls that normaliser. I checked `git show 7294e3847:…`: 0 references.
   - Every game whose NHL PBP payload changed between the Gamecenter capture and the projection capture therefore ends up in this state:
     - status and head at the new hash H2;
     - normalisation `stale`;
     - roster spots under the older hash H1.
   - That matches "roster rows exist only under an OLDER hash".
   - The payload changing after the final horn is routine. `gameState` going FINAL→OFF, or late stat corrections, each produce a new hash.
4. Nothing in production completes those stale normalisations.
   - The DB-only safety net, `sweep-gamecenter-normalization.ts`, exists only on octoberBranch (`317f8f57e`) and is not scheduled anywhere.
   - The other Gamecenter writers re-fetch and normalise only when they themselves run for that game. These are `ingestNhlApiRawGame`, called by `update-nhl-play-by-play`, `update-nhl-shift-charts` and the underlying-stats routes.

**Not involved:** `update-PbP.ts` writes only the legacy `pbp_games` and `pbp_plays` tables (via `fetchPbP.ts`). It never touches raw snapshots, heads, status or roster spots.

**The octoberBranch fix:** TJ's `0de97e77d` (10-17) added a `normalize_gamecenter` stage to `ingest-projection-inputs.ts`.
- After persisting inputs, the stage calls `persistCapturedGameNormalization` from the same captured payloads whenever the normalisation status is not `complete`.
- If that fails, the game cursor is held.
- `nhlRawGamecenter.mjs` gained the shared `persistCapturedGameNormalization` export.

## Options considered

| Option | Verdict |
|---|---|
| **Write roster spots on every re-capture.** Release the existing `normalize_gamecenter` stage, then backfill the stale games with the sweep. | **Recommended.** It is the designed path, already written and tested, keeps hash binding fail-closed, and needs no NHL requests for the backfill. |
| Read roster rows by game when the hash differs but the content is identical | Rejected. `persist_shift_chart_relationships_v1` (`20260720105524:2290-2318`) also requires the PBP head to equal the status hash, and `persistShiftChartRelationships` re-checks the hash. Loosening the roster read alone would move the failure one step later. Comparing roster content across hashes also weakens the snapshot binding the whole pipeline relies on. |
| Skip stale-roster games in `shift-charts` with a recorded reason | Rejected as a fix. Skipped games stay pending and sort oldest-first, so 53 of them would fill every 16-game run and nothing would progress. |

## Proposed patch for TJ

**File:** `PROPOSED-gamecenter-renormalization-vs-R3.patch`. Apply with `git apply -p2`.

**Contents:** the octoberBranch normalisation delta, rebased to apply cleanly to released `7294e3847`. It touches 6 files, +877/−31:
- `web/lib/supabase/Upserts/nhlRawGamecenter.mjs`: extracts and exports `persistCapturedGameNormalization`.
- `web/types/nhlRawGamecenter.d.ts`: adds its declaration.
- `web/pages/api/v1/db/ingest-projection-inputs.ts`: adds the `normalize_gamecenter` stage.
- `web/__tests__/pages/api/v1/db/ingest-projection-inputs.test.ts`: adds 3 regression tests.
- `web/pages/api/v1/db/sweep-gamecenter-normalization.ts`: new, DB-only backfill.
- `web/__tests__/pages/api/v1/db/sweep-gamecenter-normalization.test.ts`: new.

**What it leaves out:**
- The only HEAD change to `ingest-projection-inputs.ts` not carried is the `withNhlOffSeasonSkip` wrapper (`79492e495`). Its module `lib/cron/nhlOffSeason.ts` is not in production, so it belongs to a separate release.
- The sweep's `lib/underlying-stats/*` dependencies and exports all exist in `7294e3847`.

**State on octoberBranch:** all 6 files already match HEAD. The patch only matters for building a minimal release from master.

## Verification

| Check | Result |
|---|---|
| `git apply --cached --check -p2` against a temporary index of `7294e3847` | **passed**: applies cleanly to R3 |
| R3 export + patch (scratchpad, `node_modules` symlinked), `npx vitest run` on the ingest-projection-inputs, sweep-gamecenter-normalization and `nhlRawGamecenter` tests | **passed**: 3 files, 64 tests |
| Mutation: R3's original `ingest-projection-inputs.ts` under the patched test | **failed as expected**: 2 failed / 26 passed ("completes a stale Gamecenter normalization from the captured payloads", "holds the game cursor when Gamecenter normalization fails") |
| Same 3 test files on octoberBranch | passed: 64 tests |
| `npx tsc --noEmit` | not run (8 GB heap and lock). The patch adds the `.d.ts` declaration whose absence caused the 10-18 TS2305 errors. |

## Production reads for Chef (read-only, not run)

**Q-1.** For the 53 games, confirm the direction of the mismatch. A row is the expected stale-normalisation case when `s.pbp_raw_payload_hash = h.payload_hash`, `n.status = 'stale'`, and `n.pbp_raw_payload_hash = roster_hash`.

```sql
select s.game_id,
       s.pbp_raw_payload_hash = h.payload_hash as status_matches_head,
       n.status as normalization_status,
       n.pbp_raw_payload_hash = s.pbp_raw_payload_hash as norm_matches_status,
       (select min(r.source_play_by_play_hash) from nhl_api_game_roster_spots r where r.game_id = s.game_id) as roster_hash,
       n.pbp_raw_payload_hash as norm_hash
from projection_game_materialization_status s
join nhl_api_game_payload_snapshot_heads h on h.game_id = s.game_id and h.endpoint = 'play-by-play'
left join nhl_api_game_normalization_status n on n.game_id = s.game_id
where s.game_id between 2026020001 and 2026029999
  and not exists (select 1 from nhl_api_game_roster_spots r
                  where r.game_id = s.game_id and r.source_play_by_play_hash = s.pbp_raw_payload_hash)
order by s.game_id;
```

**If Q-1 finds rows where `status_matches_head` is false:** a Gamecenter writer advanced the head after the projection capture, so the head is ahead of the status. The sweep cannot fix those. They need a bounded `ingest-projection-inputs` re-run for their dates, with the patched code, so the status catches up to the head. The relationship RPC refuses them until then, with `SHIFT_RELATIONSHIP_RAW_SNAPSHOT_STALE`.

## Release and recovery sequence (all steps need TJ's approval)

1. Release the patch. Its files are TJ's `ingest-projection-inputs.ts` plus the 5 files listed above. `update-PbP.ts` is not needed.
2. Run `POST /api/v1/db/sweep-gamecenter-normalization` with bounded calls.
   - Use the default 30-day lookback, which covers 09-19 onward, and limit ≤ 50.
   - The route is DB-only, so no NHL requests. It also refreshes underlying-stats summaries for those games.
   - About 3 calls would cover the 53 regular and 27 preseason stale games. Running it on a schedule is a separate decision.
3. Re-run `update-shift-charts` (`maxGames` ≤ 50). Relationships then materialise, and the derived build and run-projection-v2 follow.

## Files changed this round

None in the repository code. This round added only:
- `R3-ROSTER-HASH.md` (this note)
- `PROPOSED-gamecenter-renormalization-vs-R3.patch`
