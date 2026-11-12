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

---

## TJ's choice (2026-11-12): official HTML, if it qualifies. Qualification and exact plan.
### Qualification (official reports fetched 2026-11-12; deployed code at `631a00c19`)
| Check | Result |
|---|---|
| Strict HTML build (`buildHtmlShiftReportPayload`, `strict: true`) | Passes: 788 rows, `source: htmlreports` |
| Current coverage guard (`selectShiftRowsForGame`) and `normalizeShiftRows` | Pass |
| Team and player identity | 788 rows, 38 players. Every row resolves to a PBP 88472 roster player on the same team (0 mismatches). |
| Overlapping intervals within a player and period | 0. The JSON snapshot has 1 (Kuemper P2 11:36–20:00). |
| Overtime | LAK and NYI both covered to 2:43 = 163 s, the last PBP event |
| Skater TOI vs the official Event Summary (ES020159) | 36 of 36 skaters within 1 s. All 40 ES rows resolve; every player with ES TOI has shifts. |
| Goalie TOI vs the official Game Summary (GS020159) | Kuemper 62:26 = GS 62:26 (JSON gives 70:50). Varlamov 62:17 = GS 62:17. Forsberg and Sorokin 0. |
| Full dry-run normalization | Events 332 (all `strength_version` 2), roster 40, shifts 788, fingerprint `a2031c79…`. Envelope hash `749be103fb3e…` (it varies with `upstream.json` and the HTML bytes at capture time). |

### Existing state the write must find, re-read first (stop on any difference)
- Normalization status: complete, v1, `shift_raw_payload_id` 88010, `pbp_raw_payload_id` 88472, shifts 789/789.
- Heads: shiftcharts version 1 → 88010 (`c4bdecd652b1…`); play-by-play version 3 → 88472 (`069ce1898710…`).
- Raw shiftcharts rows: exactly one (88010).

### The write (script `g159-recover.mjs`; without `--write` it only checks)
Preconditions: phase C has finished and the DB preflight passes.
1. Re-read and verify the existing state above.
2. Re-fetch the JSON feed and the official TV/TH/ES/GS reports. Build the strict HTML envelope. Re-run **every** qualification check on those exact bytes; any failure stops before a write.
3. **Insert** one raw row into `nhl_api_game_payloads_raw` with:
   - endpoint `shiftcharts` and source_url the JSON shiftcharts URL, as the route stores it;
   - the envelope with `source: htmlreports`, `upstream.json` set to the feed's current response, and the report URLs;
   - its sha256 hash and `fetched_at` set to now.

   The table refuses UPDATE and DELETE by trigger, so **88010 is never overwritten or removed.** The AFTER INSERT trigger moves the shiftcharts head to the new row (version 2), and the heads trigger marks the normalization status `stale`.
4. Check that the head now points at the captured hash.
5. Call the deployed `persistCapturedGameNormalization` once, with the play-by-play head 88472 and the new shift snapshot. It does an optimistic manifest check, then one `persist_nhl_api_gamecenter_normalized_v2` RPC.
6. **Readback:**
   - status complete, v2;
   - `shift_raw_payload_id` is the new row; `pbp_raw_payload_id` 88472;
   - events 332/332, roster 40/40, shifts 788/788;
   - both raw shiftcharts rows still exist (88010 and the new one).

### Partial-write handling (no retry until the state is reconciled)
- **Step 3 fails:** the statement is atomic, so nothing changed. Stop.
- **Step 3 succeeds but step 4 or 5 fails:** the head is on the HTML snapshot and status is `stale`. The normalized rows are still the v1 rows, unchanged, because the RPC is atomic.
  1. Re-read the status, heads and manifest.
  2. If they're consistent (head at the HTML hash, status stale, manifest unchanged), rerun step 5 once. It is DB-only and idempotent.
  3. If it fails again, stop and report.

  The game then stays stale, which means quarantined. A head revert to 88010 is **not** used, because it would carry the overlapping interval into v2 (TJ). Any revert would need its own plan.
- **Any provider fetch fails or a check differs:** stop before step 3, and the game stays quarantined at v1.

### After success
This game joins the summary sweep and goalie refresh with the others.

## Result (2026-11-12 18:22Z, TJ-approved, run after phase C ended)
- **Existing state matched the plan:** v1 complete; heads 88010 and 88472.
- **Re-qualified on the exact capture bytes:**
  - envelope hash `749be103fb3e…`, the same as the dry run;
  - 788 rows; 36/36 skaters match the ES; OT 163/163.
- **Captured:** raw row **97127**. The shiftcharts head advanced to version 2 → 97127.
- **Normalized:** one RPC.
  - Status complete, `strength_version` 2, normalization version 4.
  - Events 332/332, roster 40/40, shifts 788/788. 789 old shift rows pruned.
  - `idempotent: false` (a real write).
- **Snapshots kept:** 88010 (JSON) and 97127 (HTML).
- **Readback:**
  - Kuemper 3,746 s = 62:26 and Varlamov 3,737 s = 62:17, both matching the GS;
  - all 332 PBP events at v2.
- No retry was needed.

---

## Ten more overtime games, same defect (NHL JSON drops one team's OT shifts): official-HTML qualification, dry run 2026-11-12 (no writes)
The script `ot-qualify.mjs <gameId>` runs the approved 2026020159 steps for any game and refuses unless every condition holds:
- **Existing state:** v1 complete, with heads equal to the status ids.
- **Strict HTML build** passes.
- **Coverage guard:** every period for both teams reaches the last PBP event.
- **Identities:** every row resolves to a PBP roster player on the same team.
- **No overlapping intervals** within a player and period.
- **Event Summary (ES):** every skater's TOI within 1 s.
- **Game Summary (GS) goalies:** every goalie with ice time matches to within 1 s. Names are accent-folded; team totals and empty-net lines are ignored. Every goalie with HTML shifts must appear in the GS.
- **Full normalization dry run** passes.

The first dry run reported 7 false failures from a GS parser bug ("TEAM TOTALS" and "EMPTY NET" lines read as a backup goalie's name; Meriläinen not accent-folded). That is fixed. 2026020187's apparent 1:44 relief goalie was Detroit's empty-net time.

| Game | Qualified | HTML rows | Old v1 rows | Goalie TOI (= GS) |
|---|---|---|---|---|
| 2026020161 | yes | 798 | 798 | 8479973:63:47, 8479979:63:03 |
| 2026020163 | yes | 859 | 859 | 8483548:65:00, 8482221:64:12 |
| 2026020172 | yes | 761 | 761 | 8477424:63:44, 8481668:61:29 |
| 2026020173 | yes | 802 | 802 | 8480045:63:42, 8479292:63:42 |
| 2026020174 | yes | 798 | 798 | 8479394:60:59, 8475660:60:59 |
| 2026020177 | yes | 878 | 879 | 8483710:61:44, 8478872:61:44 |
| 2026020187 | yes | 811 | 811 | 8485545:63:16, 8477465:65:00 |
| 2026020188 | yes | 753 | 753 | 8475660:62:22, 8478435:61:11 |
| 2026020192 | yes | 767 | 767 | 8473575:63:10, 8477424:65:00 |
| 2026020197 | yes | 765 | 765 | 8482447:62:47, 8480843:64:49 |

2026020177's HTML has one row fewer than its JSON (878 vs 879), likely an overlap like 2026020159's. Its HTML still passes every check.

**Write plan:** identical to 2026020159, one game at a time, run as `ot-qualify.mjs <gameId> --write`.
1. Verify the existing state.
2. Re-fetch the official reports and re-qualify on the exact capture bytes.
3. Insert one raw `shiftcharts` row (the old JSON row is kept; the head advances by trigger and the status goes stale).
4. Check the head advanced.
5. One `persistCapturedGameNormalization` RPC.
6. Readback: status complete v2 with expected = observed, and both raw shift rows kept.

**Pacing:** after phase E, 60 s between games, with the same DB preflight. Stop on any failure; a partial write gets one DB-only rerun after reconciling.
