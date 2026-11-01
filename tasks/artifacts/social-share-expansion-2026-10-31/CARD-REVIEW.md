# Card review ledger

TJ approves each card individually (2026-10-31). Status is TJ's own answer, recorded against the real render at the commit shown.

| Card | Status | Render commit | TJ's note |
| --- | --- | --- | --- |
| Goalie of the Period, week | **Approved** | c2184d67d | |
| Goalie of the Period, month | **Approved** | c2184d67d | |
| GSAx (NST model) | **Approved** | c2184d67d | |
| Off-Night Edge, weekly | **Approved** | c2184d67d | "the 2nd of the 2 off night edge cards" |
| Crease Shift | **Approved** | 1860c6c57 | Running start share line, starter blocks, one-line legend, PREV N GP. TJ's VAN example is the test fixture |
| Off-Night Edge, rest of week | **Approved** | c2184d67d | |
| What Changed | **Approved** | 653d617fb | Bigger sparkline (ticket delivered) |
| Role Watch | **Approved** | 653d617fb | Bigger sparkline (ticket delivered) |
| BSH Board, leaders | **Approved** | c53d4f665 | Applied from the risers reference (Chef's call, TJ gave no separate leaders note): one segmented B, S, H bar per player, ticket sent to lane B |
| BSH Board, risers | **Approved** | c53d4f665 | TJ's reference image: "Line charts like this: one section for B one for S one for H". Replaces the per-game area chart; ticket sent to lane B |
| Category Blueprint | **Approved** | fbfaec133 | Now Multi Cat Monsters, straight and Points-First (P85 points floor), equal chips with percentile squares. Overrides the earlier no-combined-score rule by TJ's decision |
| Nightly Floor | Fix rendered at 189129504; not separately confirmed | 189129504 | Dynamic headline "GP% with >= {METRIC}/GP", prominent metric label, add metric/GP average, remove MISSING column (done). Third: rename MET / KNOWN to "# GP" (ticket sent to lane B) |
| Cardio Masters | Fix rendered at 189129504; not separately confirmed | 189129504 | Headline CARDIO MASTERS, prominent metric label, add metric/GP average, remove MISSING column (done). Third: rename MET / KNOWN to "# GP" (ticket sent to lane B) |
| Busy and Quiet Goalies | **Approved** | fa710a053 | Three labelled tiles, no truncation. TJ locked it with HD/GS kept; a separate diagnosis of the missing HD/GS data was requested |
| Goalie Category Rescue | Fix rendered at ed589915a; not separately confirmed | ed589915a | Narrower name column and better spacing as TJ asked. Lock unless TJ objects |
| Ratio Impact | **Approved** | 4589394f1 | First: before and after tiles, sensitivity as a small chart (delivered). Second: TJ didn't understand what the card conveys and chose a plain rewrite: real goalie, one-sentence headline, one what-if chart, no tables (built). TJ approved, including the 4-goal "bad" threshold |
| Risky Starts | **Approved** | 6421517ae | First: head-to-head rank bars in place of text lines (delivered). Second: TJ's mockup: HOME left and AWAY right, metric labels between the bars with a winner triangle, each team's goalies under its side (ticket sent to lane G). Odds: stored DraftKings first, NHL.com partner fallback (TJ's choice, built at 7834f2035). Third: TJ locks the card once the footer is trimmed and tiles get a clearer edge, rounder corners and a light shadow (built, confirmed in render at 4589394f1) |
| Start/Sit | **Approved** | 84a10edf2 | All-blue chips rejected. TJ's idea 1: team colours from teamsInfo.ts, green triangle between chips, green/red border for the tilt. Idea 2: no team colours, green/red chips for who wins each metric matchup. TJ chose idea 2 with both logos between the chips and the triangle pointing to the winning team's logo (built). Third: Game column logo vs/@ logo, goalie's team always left in every lens, columns Quality, Quantity, Win (ticket sent to lane G). TJ approved with Source Status and Forecast merged into one column (ticket sent to lane G) |
| Top Multi-Cat Stars of the Week | **Approved** | fbfaec133 | All four views. Ranking uses the fantasy week; table uses the last 7 days, as TJ asked |
| Player vs Player | Needs work | 435695923 | TJ's pair: Dahlin (8480839) vs Hughes (8480800), no source URL, so no candidate record. Add head-to-head bars, shrink "No consensus established" (ticket sent to lane C) |
| Team Games (example) | Not for review unless asked; about 190px empty | | |

## Last Nights Standouts (TJ, 2026-11-01; after the audit pin, not in that candidate)

Five cards, read as: under-X% rostered, no roster limit, goalies, top forwards, top defensemen. TJ listed four numbered items and said five, with item 4 naming forwards and defensemen. Cards 1 and 2 start blank and are built from a sidebar. Ticket to lane B; panel seam by Chef.

Reviewed so far: Forwards and Defensemen approved (points first). Goalies rank by GSAx, chips show last night, STD and change; TOI chip removed by TJ (ticket to lane B). Sidebar defaults to average % change: ±200% cap plus per-stat baseline floor, TJ's choice (ticket to lane B). PP writer fix at d793446f9; TJ will run the 2026-27 backfill locally.
