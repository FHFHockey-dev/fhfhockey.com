# Game 2026020159 (2026-10-22, LAK at NYI, OT): strength v2 recovery plan

Status: **plan only.** The game is quarantined at v1 and nothing has been written. It runs only after TJ's approval, and only after the phase-C slow run has finished, so there are no concurrent writes.

## Why it is quarantined
On 2026-11-12 at 16:09Z, the single-game re-ingest (`update-nhl-play-by-play?gameId=2026020159`) was refused by the current coverage guard (`selectShiftRowsForGame`): "Shift payload for final game 2026020159 is truncated: team 26 period 4 ends at 0s, last event at 163s". The NHL JSON feed returned rows that didn't cover LAK's overtime.

At 16:2xZ the same feed returned **no rows** (`{"data":[],"total":0}`), so the feed is changing.

The refused call stored nothing: the guard runs before raw capture. The raw rows, snapshot heads and normalization status are unchanged:
- v1 complete;
- shift snapshot 88010 and play-by-play 88472;
- events 332/332, roster 40/40, shifts 789/789.

## Candidate sources (all checks run offline with the deployed code at master `631a00c19`)
| Source | Identity | Rows (after dedupe) | Overtime coverage | Current checks | Note |
|---|---|---|---|---|---|
| A. Saved JSON snapshot `nhl_api_game_payloads_raw` id 88010 (hash `c4bdecd652b1…`, fetched 2026-10-23 09:35Z, `json-api`) | All 791 rows have gameId 2026020159; teams NYI (2, home; 381 rows) and LAK (26, away; 410 rows) | 789 (2 exact duplicates dropped) | LAK 15 and NYI 10 OT rows, both through 2:43 (last PBP event 2:43) | `selectShiftRowsForGame` passes; `normalizeShiftRows` 789 | **Exactly the snapshot the current v1 normalization uses.** It contains an overlapping goalie interval: Kuemper (8475311) P2 11:36–20:00 inside P2 0:00–20:00, so 70:50 total vs official 62:26. Codex's DRM triage handles this with a physical interval union. |
| B. Official HTML reports TV020159/TH020159 (nhl.com, fetched 2026-11-12, strict parse) | Rosters resolved against PBP 88472 | 788 | LAK 15 and NYI 10 OT rows through 2:43 | Strict build passes; `selectShiftRowsForGame` passes | Same rows as A except A's overlapping Kuemper interval; Kuemper totals 62:26, which matches the official reports. Using it would create a new `shiftcharts` raw snapshot (`source: htmlreports`) and change one shift row versus today's data. |
| C. Fresh NHL JSON (now) | — | 0 | none | Would go to the lenient HTML fallback | Not used. |

Dry run of option A with the deployed code (no write): `buildNormalizedGameScope` produces events 332 (all `strength_version` 2), roster 40 and shifts 789. Payload hashes are unchanged (play-by-play `069ce1898710…`, shifts `c4bdecd652b1…`). The parser fingerprint goes from `c7c4c672…` to `a2031c79…` (strength v2).

## Recommended: option A (stored snapshots; no provider call; same shift data as today)
1. **Preconditions.**
   - The phase-C run has finished.
   - The DB preflight passes: probe under 1 s, no query over 5 s, no I/O or lock waits.
   - The game's status is still v1 complete with snapshot ids 88010/88472, re-read immediately before the write.
2. **The write.** One local script calls the deployed `persistCapturedGameNormalization` exactly as the route does after capture, using the service role key from `web/.env.local` (never printed).
   - Inputs: the stored play-by-play 88472 and shifts 88010 payloads read from the DB, with their exact hashes.
   - It reads the current manifest (optimistic check) and calls `persist_nhl_api_gamecenter_normalized_v2` **once**.
   - No raw snapshot is written, no provider is called, and the coverage guard isn't bypassed: the same `selectShiftRowsForGame` runs inside `normalizeShiftRows`.
3. **Readback.**
   - Status complete, `strength_version` 2, parser fingerprint `a2031c79…`.
   - Events 332/332, roster 40/40, shifts 789/789.
   - `shift_raw_payload_id` 88010 and `pbp_raw_payload_id` 88472 unchanged.
4. **On failure.** The RPC is atomic, so the game stays v1. Stop, report, and don't retry until the state is reconciled.
5. **Afterwards.** The game is included in the sweep and goalie refresh like the others. Kuemper's overlapping interval is the same as today: a source defect that downstream interval-union logic must handle, not a new one.

## Alternative: option B (official HTML)
This gives cleaner goalie time, but it switches source for one game. It needs a new raw snapshot capture (an `htmlreports` envelope), a head update, then normalization. Choose it only if TJ prefers matching the official reports over keeping today's data. Its plan would be written separately before any write.

## Code follow-up (not part of this recovery)
`fetchShiftChartsWithFallback` uses HTML only when the JSON is **empty**. A non-empty but incomplete JSON feed (this game at 16:09Z) is refused, which is safe, but leaves the game stuck.

Proposed safe handling, for whoever owns `nhlRawGamecenter.mjs` (released to Scout):
- When the game is final and the JSON is non-empty but fails the coverage check, try the **strict** HTML fallback.
- Accept it only if it passes the same `selectShiftRowsForGame` checks.
- Otherwise refuse and keep the prior complete normalization.
- Never trim or pad rows.

Optionally, also refuse a fresh shift payload that **regresses** from a stored complete snapshot (different hash with fewer covered seconds).
