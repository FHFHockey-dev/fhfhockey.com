# C7 independent review — C4 SITE-WIGO R1 (C4-F2)

**Reviewer:** Claude C7 lane session (not the author). Read-only: no source edits, no Git, no server, no production. Evidence is in `r6-evidence/c4-wigo-r1/`.

**Verdict: accepted.** C4-F2 is fixed. With a player selected and the team unresolved, the heading names the player and the description now reads "Team HQ and lines appear once this player's team is known; these league-wide views open now." It no longer says "Select a player". Links and the other two states are unchanged. The regression fails on the base.

## Pins

- **Patch:** `C4-WIGO-R1.patch` `65dddc93…c7f`, which matches and `git apply --check --reverse` cleanly against the working tree.
- **Canonical tree equals R1:** `pages/wigoCharts.tsx` `7ee8ff57…`, `__tests__/pages/wigoCharts.test.tsx` `6ca27777…`.
- **Base for comparison:** in a scratch copy I reversed R1, giving the page `fd3e6b7f…`, which is the accepted SITE-WIGO candidate.

## Executed

| Run | Result |
| --- | --- |
| R1 (canonical): owner `wigoCharts.test.tsx` + my 2 controls | **8/8 pass** (`wigo-r1.json`) |
| Base, both files reversed: old owner test + my controls | 7/8. **My W3-R1 fails**: "Select a player" text is present while a player is selected (`wigo-r1-base.json`) |
| Base page with C4's **R1 test file** + my controls | 6/8. The owner's "keeps team links hidden while the selected player's team is unresolved" **fails**, as C4 reported, and so does my W3-R1 (`wigo-r1-base2.json`) |

**My controls:**
- **W3-R1** (player selected, team unresolved): the heading names the player; no "Select a player"; the description contains "appear once this player's team is known"; hrefs are exactly `/trends`, `/game-grid/7-Day-Forecast`, `/start-chart`.
- **W3-R1b:** the no-player state keeps "Select a player…", and the resolved-team state keeps "Open TOR team context…".

**Screenshot:** `wigo-r1-390-player-team-unresolved.jpg` shows the new heading and description with only the three league-wide links.

## Notes for the owners (not blockers)

- **C4-F1 is still open:** the league-wide link descriptions promise player and team context they don't carry. That copy lives in read-only `siteSurfaceLinks.ts` and goes to that file's owner as a boundary request.
- **Same contradiction elsewhere (outside R1):** the same 390px screenshot shows the "Team performance drivers" panel saying "Select a player to load team drivers." while a player *is* selected and only the team is unresolved. It is the same class of copy contradiction in another WiGO section. Source: `web/components/WiGO/TeamPerformanceDrivers.tsx:45`. Owner: whoever holds that component.
- **Not run:** browser (C4's 1280/390 evidence is the owner's). tsc was not rerun for a string-only change.
