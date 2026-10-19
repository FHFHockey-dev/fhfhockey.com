# HTML shift-report fallback for the projection path: assessment

Date: 2026-10-19. Code-only work. No hosted, API, cron or NHL calls. No code changed for this note.

Skip-and-continue (`SKIP-ISOLATION.md`) stays as the safety net. The full `tsc` passed for it: 8 GB heap, heavy lock, exit 0.

## The key fact for 0006–0053

`ingest-projection-inputs` cannot complete a game with an empty shift feed:
- `normalizeShiftSourceRows` rejects 0 rows.
- The snapshot fetch rejects rows whose `typeCode` is not an integer.

So every one of those games that has `input_status = 'complete'` (R3's read counted 87 regular-season games) **had non-empty NHL JSON at ingest time**. The feed went empty later. For those games the exact shift payload the inputs were built from is already stored:
- `projection_game_materialization_status.shift_raw_payload_id` and `shift_raw_payload_hash` point to it in `nhl_api_game_payloads_raw`, endpoint `shiftcharts`, `source: "json-api"`.
- `pbp_raw_payload_id` points to the stored PBP in the same way.

The HTML fallback therefore matters only for **future** games whose JSON is empty when they are ingested. For the current backlog, the better fix is to materialise relationships from the stored snapshots (option A below). No HTML parsing is needed for it.

## Answers to the three questions

### 1. Do the parsed HTML rows carry the fields `normalizeShiftSourceRows` hashes?

The parser is `parseHtmlShiftReportRows` in `nhlRawGamecenter.mjs`, around lines 300–375. Field by field:

| Hashed field | HTML row | Gap |
|---|---|---|
| `game_id` | **missing** (the row has no `gameId`) | Set it from the request |
| `player_id` | resolved from the PBP `rosterSpots`: a unique sweater match, else an exact name match, else a last-name match, **else `namePool[0]`, which is a guess** | Must be strict for projections: a unique match or refuse. Unresolved headings are currently dropped silently (`continue`) |
| `team_id`, `team_abbreviation` | from the PBP home/away teams | OK |
| first and last name | from the roster spot | OK |
| `shift_number`, `period` | integers from the table | OK |
| `start_time`, `end_time` | the elapsed part of "elapsed / remaining" | Format risk: likely unpadded (`0:45`), where JSON uses `00:45`. `parseStrictShiftClock` accepts both, but it is a different string from JSON |
| `duration` | text | Same padding risk |
| `type_code` | **`null`** | The projection validators require an integer. Map shift rows to `517`. HTML has no separate event rows (JSON's 505 goal rows); projection consumers only filter on 517 (`shifts.ts:439` and `:664`) |

**Consistency.** The fingerprint only has to match between `ingest-projection-inputs` and `shift-charts`, never between HTML and JSON. It stays consistent as long as both derive rows through one shared function from the same captured payload.

A second constraint is stricter, because both writers share the `shiftcharts` snapshot head:
- The Gamecenter writer (`fetchNhlApiRawGamePayloads`) already stores the HTML fallback as `{ total, data, source: "htmlreports", upstream: { json }, htmlReports: { visitorUrl, homeUrl } }`.
- The projection path must store a **byte-identical** raw payload.
- If it builds a different object, each writer advances the head over the other's version. The normalisation then goes stale and relationships hit `SHIFT_RELATIONSHIP_RAW_SNAPSHOT_STALE`, which is the R3 failure class again.
- In practice the projection path must call the same parser, not a copy of it.

### 2. Provenance

- Use the `source` already in the raw payload: `"json-api"` or `"htmlreports"`. The status row's `shift_raw_payload_id` joins to it, so derived data can tell HTML-sourced shifts apart without any schema change: `status → nhl_api_game_payloads_raw.payload->>'source'`.
- Do **not** add a source field to `ProjectionShiftSourceRow`. That would change the shift fingerprint of every existing JSON game and requeue the whole season.
- Optionally, add `shiftSource` to the per-game receipts of ingest and shift-charts so audits show it. That is a response-only change.

### 3. What it takes for both routes to share the fallback

1. **`nhlRawGamecenter.mjs`** (outside my scope): export the fallback as a function that takes the PBP payload instead of `landing`. The game state can come from the PBP. Also make player resolution strict, through an option or a separate export: no `namePool[0]` guess, and every heading resolved, otherwise throw. Strict mode can change the payload the Gamecenter writer stores, so the Gamecenter normaliser and preflight manifest should be checked against it in the same change. Add the declaration to `types/nhlRawGamecenter.d.ts`.
2. **`lib/projections/ingest/shifts.ts`** (in scope): when the JSON total is 0 and the game is final, `fetchAllNhleShiftChartsSnapshotForGame` calls the export. The PBP comes from an optional argument, or is fetched when absent; the ingest call site passes only `gameId`, so `ingest-projection-inputs.ts` needs no edit. The function returns `rawPayload` exactly as the export built it, plus derived `rows` with `gameId` set, `typeCode: 517` and zero-padded clocks.
3. **`ingest-projection-inputs.ts` and `shift-charts.ts`**: no change; both already go through `shifts.ts`. The ingest has to pass the PBP, or accept one extra PBP request per fallback game.
4. **Tests:**
   - a recorded `TV`/`TH` fixture: rows, hash stability, strict refusal on an ambiguous sweater, typeCode and clock mapping;
   - raw-payload byte equality with what the Gamecenter writer stores for the same inputs;
   - ingest and shift-charts producing the same `shift_source_hash`.
5. **Cost:** 2 extra NHL HTML requests per empty-JSON game, in each route.

**Size:** this spans two owners' files plus a strictness change to a shared parser, so it is a design note, not a `shifts.ts`-only patch. I'd do it as one owned change across `.mjs`, `.d.ts`, `shifts.ts` and the tests.

## Recommendation for the current backlog: option A

**A. `shift-charts` builds relationships from the stored snapshots the status pins, instead of live NHL fetches.**
- **Scope:** `shift-charts.ts`, plus a small pure helper in `shifts.ts` that turns a stored raw shift payload into the validated, sorted rows. That logic would be pulled out of `fetchAllNhleShiftChartsSnapshotForGame`.
- **Steps:**
  1. Read the status (already done).
  2. Load `nhl_api_game_payloads_raw` by `shift_raw_payload_id` and `pbp_raw_payload_id`, checking each row's id, endpoint and `payload_hash` against the status.
  3. Derive the shift rows and the source hash with the same functions ingest used.
  4. Persist.
- **Why the hashes match:** the PBP and shift source hashes are canonical-JSON hashes over derived rows, so they are unaffected by `jsonb` key reordering.
- **Effects:**
  - The fingerprint matches by construction.
  - `projection_inputs_stale` and `shift_feed_unavailable` can no longer occur for ingested games.
  - shift-charts makes no NHL requests.
  - It would work for 0006–0053 today.
- **Kept guards:** the RPC's raw-snapshot-current guard still applies. A game whose head moved after ingest still fails closed until it is re-ingested.
- **Cost:** two reads of up to about 1 MB each per game from `nhl_api_game_payloads_raw`, inside the route's normal runtime, and no extra NHL requests.
- **Size:** roughly 60–90 lines in `shift-charts.ts`, about 40 lines moved in `shifts.ts`, and tests. Nothing in `ingest-projection-inputs.ts` or `nhlRawGamecenter.mjs`.

**B. The HTML fallback above.** This is for games whose JSON is empty at ingest time. Plan it separately after A, with the parser owner.

**Release suggestion:**
1. Ship skip isolation (done, uncommitted) now, as the safety net.
2. Build A next, if TJ approves.
3. Take B as its own change.

## Read-only SELECT for Chef (confirms the premise)

```sql
select s.game_id,
       raw.payload->>'source'                         as stored_shift_source,
       pg_catalog.jsonb_array_length(raw.payload->'data') as stored_shift_rows,
       raw.payload_hash = s.shift_raw_payload_hash    as stored_hash_matches
from projection_game_materialization_status s
join nhl_api_game_payloads_raw raw on raw.id = s.shift_raw_payload_id
where s.game_id between 2026020006 and 2026020053
order by s.game_id;
```

This reads JSON fields of about 48 rows of up to about 1 MB each. Expected: `json-api`, rows > 0 and `true` for every row. If any row shows `htmlreports`, the Gamecenter writer has already stored an HTML payload for that game, and the head-sharing constraint in question 1 applies today.
