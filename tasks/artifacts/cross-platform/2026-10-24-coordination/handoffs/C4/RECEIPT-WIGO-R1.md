# C4 receipt — SITE-WIGO R1 (C7 finding C4-F2)

Lane: C4 (Claude). Stable ID: SITE-WIGO. Input: C7 `handoffs/C7/RECEIPT-C1-C4.md`, finding C4-F2 (Low, copy). Status: **fixed, unit-verified and browser-verified. The :3110 slot is released** (server stopped; no listener on 3110 at 2026-10-24T17:02:09Z). No Git writes. This was the same network-guarded run as BLSH (see `RECEIPT-BLSH.md`, "Browser evidence"): zero outbound application requests, and TJ's :3000 was not contacted.

## Browser evidence (R1 page `7ee8ff57…`, isolated :3110)

- **Setup:** an in-page `window.fetch` stub returned one synthetic row for `players?id=eq.999002` with `team_id: null` ("Fixture Unresolved-Team Skater"), and `[]` for every other cross-origin request or `/api/cors` call. The player was selected by client-side navigation to `/wigoCharts?playerId=999002`.
- **What the page did:**
  - 14 Supabase-style calls were answered by the stub. None left the browser; the network list shows only `localhost:3110`.
  - `/api/v1/season` came from the browser's HTTP cache (`max-age=86400`, from the first WiGO run). The server log shows no such request this run.
- **Result at both 1280 and 390:**
  - Heading: "Take the Fixture Unresolved-Team Skater read further".
  - Description: "Team HQ and lines appear once this player's team is known; these league-wide views open now."
  - Hrefs: `/trends`, `/game-grid/7-Day-Forecast`, `/start-chart`, with no team links.
  - One section; document width equals the viewport.
- **Screenshots:**
  - `handoffs/C4/screenshots/wigo-r1-1280-player-team-unresolved.jpg` `c8c426d315e95e74f50c835d6e7b5c16be7898e22b21fce3b06678c48f133b62`
  - `handoffs/C4/screenshots/wigo-r1-390-player-team-unresolved.jpg` `22fd7cb509f9e6e002511d05ecd30f11de2815571f49ffea4f2182d0a0101886`

## Finding and fix

C4-F2: with a player selected but the team unresolved, the heading said "Take the {player} read further" while the description said "Select a player to add their team HQ and lines…".

The description in `web/pages/wigoCharts.tsx` now branches on `selectedPlayer` as well as `teamAbbreviation`:

| State | Heading | Description |
| --- | --- | --- |
| team resolved | Take the {player} read further | Open {ABBR} team context or a league-wide decision view. Back returns to this player. (unchanged) |
| **player selected, team unresolved** | Take the {player} read further | **Team HQ and lines appear once this player's team is known; these league-wide views open now.** |
| no player | Keep exploring | Select a player to add their team HQ and lines; these league-wide views open now. (unchanged) |

Links, hrefs, layout and placement are unchanged. C4-F1 (the shared league-wide link copy in read-only `siteSurfaceLinks.ts`) is not touched here; per the orchestrator it goes to that file's owner as a boundary request.

## Hashes

R1 is applied on top of the accepted SITE-WIGO candidate (`C4-SITE-WIGO.patch` `2266893f…`).

| Path | preimage (SITE-WIGO candidate) | R1 |
| --- | --- | --- |
| web/pages/wigoCharts.tsx | `fd3e6b7fbaa7a27f97063123b7ab03c384f2fedba07c5a69d9eb3cf35b703469` | `7ee8ff5779ac2f686b3fa45e7f1415dcafa25879422938b7a8e0f69cd1833151` |
| web/__tests__/pages/wigoCharts.test.tsx | `ee8f00a8bcd70ef2ab80b03feb831d3550bffd5b3fa0b2966553dc9508046064` | `6ca27777fe011e1ee44d7b390fab62da882e2202446bdc5107bca1e1c81bd01b` |

- Patch `handoffs/C4/C4-WIGO-R1.patch`: `65dddc937aa83739926b5df810a6fd2f8ed03f406c4d50955d9817314f048c7f`. It is incremental (SITE-WIGO candidate → R1) and covers 2 paths. `git apply --check --reverse` passes against the working tree.
- Apply order from HEAD `2a5092d37`: first `C4-SITE-WIGO.patch`, then `C4-WIGO-R1.patch`.
- I rebuilt both preimages in the scratchpad and checked their hashes against the values above before diffing.
- Read-only dependencies are unchanged from `RECEIPT.md`.

## Checks (actually run)

- `npm test -- __tests__/pages/wigoCharts.test.tsx` on R1: **6/6 pass**.
- **Regression control:** the R1 test run against the prior page `fd3e6b7f…` fails exactly the partial-state case ("keeps team links hidden while the selected player's team is unresolved"); the other 5 pass.
  - The new assertions in that case are: heading "Take the Connor McDavid read further"; description contains "appear once this player's team is known"; no "Select a player" text.
  - The no-player case now also asserts the "Select a player…" description.
- `npx eslint` on both files: pass.
- tsc was not rerun: this is a string-only branch inside an existing expression, and the earlier full-tree run had no C4 errors.

## Pending

- C7 re-check of this R1 delta, if wanted.
- Integration stays with Codex.
