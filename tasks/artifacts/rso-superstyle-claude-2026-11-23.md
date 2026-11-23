# /roster-schedule-optimizer — superstyle backlog (Claude lane, 2026-11-23)

Fixture: anonymous manual workspace, 16 rostered stars (4 with no FORGE line) or 12 all-known, Yahoo-like points weights; local dev :3120. Desktop 1440×900, mobile 390×844.

| page | element (file) | finding and suggested fix | Status | pass |
|---|---|---|---|---|
| RSO | navigation toast `.navigation` (RsoLoading.module.scss) | 4px blue rule on 6px radius curled at both left corners → `::before` rail (TJ: 3px) | Done | 0 |
| RSO | toggle pills: Lineup goal, Best Fit sort, Candidate views (RosterScheduleOptimizer.module.scss) | 6px buttons in 6px pill with 3px inset → 3px buttons (nested corners) | Done | 0 |
| RSO | rail card radius (RsoLoading.module.scss) | box left radius = 3px rail (3px 6px 6px 3px), per §2.7 | Done | 0 |
| RSO | settings menu panel `.navMenuPanel` | 6px items in 10px panel with 9px inset (would want 1px); stacked menu list, not a pill cluster — left as is | Low, judged n/a | 0 |
| RSO | pressed toggles (7 rules) | solid blue + dark text → s.toggle-on (40% fill, white 9.7:1, 2px ring) | Done | 2 |
| RSO | action buttons + Optimize + primaryAction + streaming 'Use' | neutral / solid blue / dead gradient → s.house-button; Remove in coral (TJ edit) | Done | 2 |
| RSO | stacked override layers in RosterScheduleOptimizer.module.scss | rules re-declared across UI-pass media blocks; consolidation = no visible change | Low, logged (recommend leave) | 2 |
| RSO | Protect (useRosterPlanning, RosterScheduleOptimizer.tsx) | re-read /data, blanked all projections, 10.7 s → plan retained, DROP in 0.25 s, quiet re-plan, "Updating swaps…" cue | Done (54f37d87f) | functional |
| RSO | first load (planning.ts scheduleFits, bridge skaters read, rosterScheduleData/planning.ts) | 11.4 s → ~4.2 s dev warm | Done (54f37d87f) | functional |
| RSO | workspace (RosterScheduleOptimizer.module.scss) | runs edge to edge; §2.1.6 caps at 90% — measured: cap at 1440 re-truncates 5/12 names + grid surnames | Declined by TJ (keep full width for RSO) | 1 |
| RSO | roster rows | names cut to ~3 letters at 1440 → panel split 27/1fr/24 (12/12 → 0/12 truncated) | Done | 1 |
| RSO | DROP chip | clipped to "DRO" → whole (wider name column) | Done | 1 |
| RSO | Best Fit input gate | side-by-side slivers, overlap, clipped → stacked, one Edit button per editor | Done | 1 |
| RSO | roster Pts column | "11.955" → one fixed decimal | Done | 1 |
| RSO | paste roster | ~~"Review pasted names" enabled before data loads → every name marked unresolved~~ → disabled until players load, reason "Player names are still loading." (+ test) | Done | 4 |
| RSO | Best Fit copy | ~~"Rankings appear once projections and schedules load." persists after they loaded (manual roster, no free agents)~~ → "No one is marked available yet…" (TJ wording) | Done | 4 |
| RSO | week header | wrapped to 2 rows at 1440 → one row, short visible words (TJ: everywhere) | Done | 1 |
| RSO | week grid cells | names 1–2 letters, goalie values overlapped → name on top, goalie 3rd line, start mark on opp line, padding fix | Done | 1 |
| RSO | type ladder (_scale.scss) | 10/11/12 px below style-law floors → 11/12/13 | Done | 1 |
| RSO | drop-safety display (ticket from RSO lane, TJ yes) | ownership on rows, DROP tooltip facts, no-drop reason, Best Fit drop line, Net Pts unknown/partial, Streaming drop facts, ranking note | Done | functional |
| RSO | 'Plan from' slider | invisible track (Sass inside custom property) → one-line grey strip, day-window handle 'MON 23', caption right/left, strip focus ring | Done | 1 |
| RSO | mobile ownership note | wrapped to 3rd line / clipped '42% own' → '96%' on phones | Done | 1 |
| RSO | mobile stream-slot table | names cut mid-letter → 'N. Kucherov' + ellipsis on inner lines | Done | 1 |
| RSO | Top five team schedules (mobile) | collapsed details had no triangle (read as an empty card) → triangle drawn | Done | 1 |
| RSO | Best Fit 'Rankings appear once…' | duplicate of the row above | Done | 4 |
| RSO | Best Fit toolbar (mobile) | 50 vs 44 px → both 50, then both 44 with the Week header (TJ height pass) | Done | 2/4 |
| RSO | Optimize contrast | 4.45:1 on panel head → opaque tint 5.0:1 | Done | 3 |
| RSO | status rail | aria-label on role-less div → role=group | Done | 3 |
| RSO | phone touch targets | disclosures 15–16px → 32px (TJ edit); goal toggles/Undo/Matchup/source/search → 44px | Done | 3 |
| RSO | LW/RW band labels | axe contrast 1.25–1.28 = painted-band false positive (verified visually) | n/a | 3 |
| RSO | phone command bar (round 2) | inner box removed; source + week stepper half/half (‹ Week N ›, current-week dot, TJ edit); dates own row; ☰ 44px centred blue | Done | 4 detour |
| RSO | Week header | goal pill = Optimize (44 phone / 32 desktop); Streaming plan collapsed 50 → 34px | Done | 4 detour |
| RSO | Best Fit (phone) | gate button beside reason; pill/Filters 44; cards 132 → 93px: action beside name, box score in notes, 10px sides, 8px border-to-name + 4px row rhythm, 8px between cards (TJ edits) | Done | 4 detour |
| RSO | line/PP chips | one square chip, tier colours (L1 green … L4 orange, none coral; PP1 green, PP2 yellow, none coral), coloured outlines, text centred (TJ) | Done | 4 detour |
| RSO | hot/cold cards | COLD/HOT outlined in own colour; whole card outlined + 6% wash (TJ) | Done | 4 detour |
| RSO | Optimize column pulse (SlotWeekGrid) | 2px ring + 14px blue glow → ring only | Done | 5 |
| RSO | tracked caps / bold data / ✓✗ marks | sanctioned by style law (titles, meta labels), brand data emphasis, meaningful glyphs | n/a (judged) | 5 |
| RSO | phone stream table | 'Planned hold · no active ga…' truncated → 'Held · no game' (tooltip keeps full) | Done | 6 |
| RSO | zero-game day column (SlotWeekGrid) | full 1/7 column of dashes on e.g. Thanksgiving; narrowing breaks the Plan-from slider's equal-day alignment; rare | Low, judged trade-off (TJ approved plan) | 6 |
| site tokens | $draft-position-colors | RW #A78BFA vs D #07AAE2 ΔE 3.3 (deutan), adjacent in the week grid; letters keep identity readable; #F472B6 passes 8.3 | Logged for a site-wide token decision (TJ) | 7 |
| RSO | points tiers / line-PP tier chip | brand traffic-light colours, every mark printed (validator: CVD 9.2 for points; ordinal one-hue fail by TJ's spec) | n/a (judged) | 7 |
| RSO | phone view switch (pass 8 regression from the icon views) | pressed 'Stream' label grey on blue 3.43:1 → takes button ink (white); axe phones clean | Done | 8 |
| site | page bottom (mobile) | lighter grey band below the RSO workspace (site layout / bottom nav spacer) | Other lane (Layout) | – |
| data | ownership | 0 of 1,065 players carry Yahoo ownership this week (data/ETL, not this lane) | Other lane (ownership ETL) | – |
| FORGE | projections | 1,119 / 3,306 rows `no_forge_line`; healthy stars missing — parked by TJ (notes: FORGE-COVERAGE-EVIDENCE.md) | Parked by TJ | – |

## Coverage ledger

| page \ pass | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|---|---|
| /roster-schedule-optimizer 1440 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| /roster-schedule-optimizer 390 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
