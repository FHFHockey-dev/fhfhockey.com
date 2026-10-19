# HTML shift fallback: blocked before build

Date: 2026-10-19. Code-only work. No code was changed for this, and no hosted, API, cron or NHL calls were made.

Before building, I checked the capture path the ingest uses. **The ingest cannot store the HTML payload without a database migration**, and the capture path also needs a code file outside this change's scope. Per Chef's instruction to ask before touching out-of-scope files, I stopped here.

## The gates that reject an HTML shift payload

1. **The SQL RPC `capture_projection_raw_source_snapshots_v1`.** Its live definition is in `supabase/migrations/20261011115124_preserve_projection_raw_shift_occurrences.sql`, lines 80–135.
   - It requires `p_shift_payload->>'source' = 'json-api'`. Otherwise it raises `INVALID_PROJECTION_RAW_SHIFT_PAYLOAD`.
   - It requires every row to carry `gameId` equal to the game, and a non-null integer `typeCode`. Otherwise it raises `INVALID_PROJECTION_RAW_SHIFT_ROWS`.
2. **The TypeScript guard in `web/lib/projections/ingest/rawSnapshotPersistence.ts:186-194`.** It applies the same rule (`source !== "json-api"` and `row.gameId !== gameId`) and throws "Projection raw shift snapshot is incomplete" before the RPC is called.
3. **The Gamecenter HTML payload (`parseHtmlShiftReportRows`).** Its rows have **no `gameId`** and set **`typeCode: null`**, and the envelope is `source: "htmlreports"`.

**So:**
- Byte equality with the Gamecenter writer is impossible: its payload fails gates 1 and 2.
- Even a projection-specific payload with `gameId` and `typeCode: 517` added fails gate 1 on `source`, unless it claims `json-api`. That would be false provenance and would collide with real JSON payloads.
- The naming question (`"htmlreports"` vs TJ's `"html-report"`) doesn't change any of this. The RPC rejects every value except `json-api`.

## What the build would actually need

1. **A new migration**, which is a database change that needs TJ's approval to push. It would redefine `capture_projection_raw_source_snapshots_v1` to accept `source = 'htmlreports'`, keeping the row identity checks.
2. **One shared HTML payload shape that passes the row checks:** `gameId` on each row and `typeCode: 517`, built by one exported function in `nhlRawGamecenter.mjs` and used by both writers.
   - This changes what the Gamecenter writer stores for HTML games. Their raw hash changes once, so on the next Gamecenter capture the head advances, the normalisation goes stale, and it is re-normalised.
   - `normalizeShiftRows` would then store `type_code = 517` where it now stores null.
   - The preflight player manifest (`nhl_api_shift_rows` via `fetchNhlApiShiftPlayerRows`) does not filter on `type_code`, so it is unaffected.
3. **`rawSnapshotPersistence.ts`** (outside this change's scope): allow `htmlreports` in the guard.
4. **`shifts.ts`, `shift-charts.ts`, `.d.ts` and the tests,** as in `HTML-SHIFT-FALLBACK.md`: strict resolution, padded clocks and `shiftSource`.
5. **`ingest-projection-inputs.ts` stays unedited.** `shifts.ts` can fetch the PBP itself on fallback, at 1 extra request per HTML game. The ingest receipt cannot show `shiftSource` without an edit there; provenance stays in the raw payload's `source`.

## Effect on the 0006–0053 backlog: Option A is still needed

Those games were ingested with **non-empty JSON**; they can't be input-complete otherwise. Their status fingerprints are therefore JSON-based.

With the HTML fallback live, `shift-charts` would fetch HTML rows for them. The shift hash would differ from the stored JSON-based one, so each game would be skipped as `projection_inputs_stale`. Clearing them would then need the migration, a release, and a re-ingest of about 48 games. That costs 1 JSON request, 2 HTML requests and 1 PBP request per game for the ingest, plus 2–3 per game for shift-charts.

Option A, building relationships from the stored snapshots that the status pins, clears the backlog with no migration, no re-ingest and no NHL requests. **I still recommend A for the backlog.** The HTML fallback covers future games whose JSON is empty at ingest time.

## Decision needed (Chef or TJ)

- **Option 1:** approve the migration plus `rawSnapshotPersistence.ts` and the shared-shape change to the Gamecenter writer. I then build the full fallback with offline fixtures and the requested tests, and draft the migration locally for TJ to push.
- **Option 2:** build Option A first, for the backlog, inside `shift-charts.ts` and `shifts.ts` only. Plan the HTML fallback later as the migration-backed change.
- **Option 3:** the fallback in `shift-charts` only, without ingest. Not viable: shift-charts must match the ingest's stored fingerprint, so HTML rows there would always be skipped as stale.

The skip isolation (`SKIP-ISOLATION.md`) is unaffected and still ready.
