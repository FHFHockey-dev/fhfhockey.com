# C7 independent review — C1 STATS-S06-R1 (C1-F1/F2 repair) and STATS-S05

**Reviewer:** Claude C7 lane session (not the author). Read-only: no source edits, no Git, no server. Evidence is in `r5-evidence/c1-r2/`.

| Packet | Verdict |
| --- | --- |
| S06-R1 (`C1-S06-R1.patch` `f7c5bf62…b9`) | **Accepted.** C1-F1 and C1-F2 are fixed: each skater stays in their true group, overflow sits in labelled extras rows, and nobody is dropped at any shape. |
| S05 (`C1-S05.patch` `66a5e411…a4`) | **Accepted with limits.** The withheld-season retry, the narrow fallback team and the 1024px containment all hold. Two of the narrow screenshots are obscured, so those claims rest on the measured reports. |

## Pins

- Both patch hashes match.
- The canonical working tree holds exactly the candidates:
  - `LineCombinationsGrid.tsx` `fb5c6a3c…`
  - `TeamTabNavigation.test.tsx` `6312ca91…`
  - `GoalieShareChart/index.tsx` `b632a0ca…`
  - `GoalieShareChart.module.scss` `1352a815…`
  - `GoalieShareChart.pagination.test.tsx` `fef6ef9c…`
  - `Stats.module.scss` `e0dbf85f…`
- `GoalieShareChart.test.ts` (`250bfc55…`) and `TeamStatsPage.module.scss` (`95729a78…`) are unchanged.
- Both patches `git apply --check --reverse` cleanly.

## Executed

**Candidate (the canonical bytes): 75/75 pass** (`c1r2-after.json`).
- Owner tests: useShotData 16, TeamTabNavigation 22, teamAbbreviation 4, GoalieShareChart 4 + pagination 16. That is 62, reproducing C1's 62/62.
- My 13 controls.

**Base:** a scratch copy with S06-R1 and S05 reverse-applied, which leaves the grid at S06 `7ee607b7…`. **12 of my 13 controls fail** (`c1r2-base.json`). Two caveats:
- The base grid controls fail structurally, because the labelled `group`s don't exist yet. The actual cross-group placement failure at S06 is my ticket-3 L1 matrix (`c1-c4-evidence/c1-observed.json`): 13F/5D put F113 in Defense, and 13F/6D and 12F/7D dropped a player.
- R2-S3 (no selector while withheld) passes trivially on the base, because the old selector had no "Team" name. C1's before report is the real evidence: `selectValue: ''`, an empty selector shown.

## S06-R1: C1-F1/F2 (independent matrix R2-L)

These shapes were each rendered with the real grid:
- 12F/6D, 11F/7D, 13F/5D, 14F/4D, 10F/8D;
- 13F/6D and 12F/7D (19 skaters);
- 12F/6D with 3 goalies;
- 9F/9D, and 0F/0D.

Results for every shape:
- The Forwards, Defense and Goalies groups contain **only** their own players.
- No player is dropped, and the total card count equals the number dressed.
- Overflow appears in `role="group"` rows labelled "Extra F · {shape}", "Extra D · {shape}" and "Extra G", each with the tooltip "Dressed beyond the regular lines; no line or pair in the source".

The screenshot `TOR-lines-1440.png` shows F13 under "Extra F · 13F/5D" beneath Forwards, with Defense E3 left **empty**. That is the truthful presentation C1-F1 asked for.

**Observations (not blockers, for C1 / the CSS owner):**
- **Placeholder boxes:** extras rows render empty placeholder cards to fill the row (e.g. TOR "Extra F" shows 1 player and 2 empty boxes; MTL "Extra D" 1 and 1). These can read as vacant line slots. A suggested change is to render only filled cards in extras rows.
- **Horizontal scroll at 390px too:** at **390px**, not only 320px as C1 notes, the lines panel scrolls horizontally. `MTL-lines-390-extras-visible.png` shows the forward columns cut off. The cause is `.lineCombinationsFixedHeight`, which needs a lease on `TeamTabNavigation.module.scss`.

## S05

- **Withheld retry (R2-S1):**
  - The first run fails, with page 100 hitting a persistent 429, so the season is withheld: no charts and an alert with **Try again**.
  - A retry that fails again stays withheld and offers Try again again; no partial window ever appears.
  - Once pages succeed, a retry yields charts and clears the alert.
  - In the code, the button disappears while a run is in flight (`setLoadError(null)`), so runs can't overlap. Each run keeps the 2-attempt budget per request.
- **Narrow fallback team (R2-S2, at 390px):**
  - The default ANA has no data, so the view falls back to a team that does.
  - The `aria-label="Team"` selector lists only teams with data, its value is the team actually shown, and a chart renders.
  - The selector is hidden while withheld (R2-S3, and C1's report).
- **Screenshots and reports:**
  - `compare-1024-before-after.png` shows the clipped single partial column before and the 2-column grid after.
  - `after-report.json`: chart overflow at 1024px is 616 → **0**; at 1440 it is 200 → 0; at 320 it is 32 → 0. Document overflow is 0 at every width. no-ANA-390 goes from 0 charts to **1** (BOS). withheld-390: `selectValue` '' → none, `retryButtons` 1. after-retry-390: 1 chart.
- **C1-S05-O1 (evidence quality):** `after-withheld-390.png` and `after-no-ANA-390.png` are mostly covered by a dark band (a fixed header or overlay), which hides the team header, the selector and part of the alert text. They don't show the fallback team or the retry state; the measured JSON does. A re-capture after scrolling the element into view would fix that.

## Limits

- **Owner-disclosed gaps remain:** Key Metrics are tight at 1024px; long names crowd "GP"; tablet widths 768–1023px weren't covered; no real devices or real NHL data.
- **Typecheck:** C1's whole-project tsc logs show only the Luna errors, which are now fixed by C2 R1. I didn't rerun it.
