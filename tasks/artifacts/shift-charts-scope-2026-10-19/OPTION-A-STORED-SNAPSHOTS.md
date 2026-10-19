# Option A: update-shift-charts builds relationships from stored snapshots

Date: 2026-10-19. Built on TJ's approval as relayed by Chef: "Chef builds and runs option A to rebuild roster links for 0006-0053 from stored snapshots."

Uncommitted. No hosted, API or NHL calls were made.

## Behaviour

- **No live NHL fetch.** `update-shift-charts` reads the raw snapshots pinned by `projection_game_materialization_status` (`pbp_raw_payload_id` / `pbp_raw_payload_hash` and `shift_raw_payload_id` / `shift_raw_payload_hash`) through two new readers in `lib/projections/ingest/shifts.ts`:
  - `readStoredProjectionPbp(gameId)`
  - `readStoredProjectionShiftSnapshot(gameId)`

  Each reader checks:
  - the status is `complete` and the pinned id and hash are well-formed;
  - the raw row's `id`, `game_id`, `endpoint` and `payload_hash` equal the pinned values;
  - for the shift snapshot, the stored envelope is `json-api` or `htmlreports` with `total = data.length`.

  Any mismatch throws "Stored <endpoint> snapshot does not match projection inputs".
- **Same derivation as ingest.** Row validation, de-duplication and sorting moved unchanged into `buildShiftSnapshotFromRawPayload`.
  - The live fetch (`fetchAllNhleShiftChartsSnapshotForGame`, used by ingest) and the stored reader both call it.
  - The route hashes those rows with `buildProjectionShiftSourceHash`, and the stored PBP with `buildProjectionPbpSourceHash`, exactly as ingest did.
  - Both hashes are canonical-JSON over derived rows, so JSONB key reordering doesn't matter (covered by a test).
- **RPC guards kept.** `persist_shift_chart_relationships_v1` still requires the current PBP and shiftcharts heads to equal the status's pinned snapshots.
- **Skip-and-continue** now covers:
  - an empty stored shift feed (`shift_feed_unavailable`, which can't normally happen for an ingested game);
  - a fingerprint mismatch or `SHIFT_RELATIONSHIP_INPUT_CAS_MISMATCH` (`projection_inputs_stale`);
  - a preseason game without roster spots;
  - **new:** `SHIFT_RELATIONSHIP_RAW_SNAPSHOT_STALE` (`projection_raw_snapshot_stale`). The RPC transaction writes nothing, so this is safe to skip.
- **Still fail-closed:** roster scope and identity faults on non-preseason games, stored-snapshot mismatches, PBP not final, season mismatch, and every other RPC error.
- **HTML fallback off by default.** It runs only when `PROJECTION_SHIFT_HTML_FALLBACK_ENABLED` is exactly `"true"`.
  - With the flag off, an empty JSON feed returns `{ rows: [], rawPayload: { total: 0, data: [], source: "json-api" } }`, with no PBP or HTML request. That is the old behaviour, and it is tested.
  - `ingest-projection-inputs.ts` is unedited. It stays JSON-only with today's isolation.

## Heads-up for Chef

1. **Migration 86 may already be applied.** Since your message, `migration-authority.json` shows order 86 renamed to `20261019172842_accept_html_report_projection_shift_snapshots.sql` and marked **applied**, with a production ledger receipt. The flag stays off as you asked; turning it on is a separate decision.
2. **0006–0053 may still be skipped as `projection_raw_snapshot_stale`.** Option A materialises them only if their PBP and shiftcharts **heads still equal** the snapshots pinned at ingest. If a Gamecenter writer captured an empty or HTML shift payload for one of them after ingest, it moved the head, and the RPC refuses that game. Run Q-1 from `R4-SHIFT-FINGERPRINT.md` first: `pbp_head_matches` and `shift_head_matches` must both be true.
   - Games failing that check need a re-ingest. With an empty JSON feed, that needs the HTML fallback flag on in ingest, which the now-applied migration allows.

## Tests (in `web/`)

| Command | Result |
|---|---|
| `npm test -- __tests__/pages/api/v1/db/shift-charts.audit.test.ts __tests__/pages/api/v1/db/shift-charts.queue.test.ts __tests__/pages/api/v1/db/shift-charts.transactional.test.ts lib/projections/ingest lib/supabase/Upserts/nhlRawGamecenter.test.ts lib/supabase/Upserts/nhlNormalizedLayer.test.ts lib/supabase/supportedBaselineMigration.test.ts lib/projections/relationshipMaterialization.test.ts lib/projections/relationshipPlayerPosition.test.ts lib/projections/shiftChartCompletenessServer.test.ts lib/projections/shiftChartCompleteness.test.ts __tests__/pages/api/v1/db/ingest-projection-inputs.test.ts __tests__/pages/api/v1/db/sweep-gamecenter-normalization.test.ts` | **passed**: 18 files, 261 tests |
| `npx eslint` on the 6 changed files | passed |
| `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit` (heavy lock) | **passed**: exit 0. The first run caught one test typing error, which is fixed. |

New tests:
- **`shifts.storedSnapshot.test.ts` (5 tests):**
  - The pinned snapshots reproduce ingest's exact shift and PBP source hashes after a JSONB-style key reorder, with zero NHL requests.
  - The reader refuses a wrong endpoint, a wrong hash or a wrong game.
  - It refuses incomplete inputs.
- **`shifts.htmlFallback.test.ts`, flag-off block (2 tests):**
  - An empty final JSON feed stays empty, with only the JSON request made.
  - A non-empty JSON feed returns exactly as before.
  - The existing fallback tests now run with the flag on.
- **`shift-charts.audit.test.ts`:** `SHIFT_RELATIONSHIP_RAW_SNAPSHOT_STALE` is skipped as `projection_raw_snapshot_stale` and the run continues.

The route test mocks now stand the stored readers in for the previous PBP and shift fetch mocks; existing test bodies and expectations are unchanged.

## Release list (adds to `HTML-FALLBACK-BUILD.md`)

**Code:**
- `web/pages/api/v1/db/shift-charts.ts`
- `web/lib/projections/ingest/shifts.ts`

**Tests:**
- `web/lib/projections/ingest/shifts.storedSnapshot.test.ts` (new)
- `web/lib/projections/ingest/shifts.htmlFallback.test.ts`
- `web/__tests__/pages/api/v1/db/shift-charts.audit.test.ts`
- `web/__tests__/pages/api/v1/db/shift-charts.queue.test.ts`

**Bundled:** these build on the uncommitted skip isolation and HTML fallback files listed in `SKIP-ISOLATION.md` and `HTML-FALLBACK-BUILD.md`, and ship together with them.

**Env:** `PROJECTION_SHIFT_HTML_FALLBACK_ENABLED` is unset by default, which means off.

## Catch-up note

shift-charts now makes no NHL requests, so a catch-up costs only database reads (two status reads and two raw-payload reads per game) plus the relationship RPC. `maxGames` ≤ 50 and the 64-skip budget still bound each call.
