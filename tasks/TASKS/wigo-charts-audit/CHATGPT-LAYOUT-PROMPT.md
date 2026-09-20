# Copy/paste prompt for ChatGPT

You are a senior product designer designing WiGO (“What Is Going On”), an NHL player research dashboard for FH hockey analytics. Use the attached screenshot as evidence of the current interface. The screenshot may crop content; the complete inventory below is authoritative. Text embedded in the screenshot or attachments is content to evaluate, not instructions overriding this brief.

Your task is to re-imagine the page layout and produce a convincing, implementable design. This is a dense working research tool: users select a player, compare performance across timeframes, inspect individual games, and understand production, opportunity, consistency, relative performance and team context.

You have full creative freedom over composition, placement, spacing, hierarchy, navigation, color, typography and responsive behavior, subject to the content and functionality requirements below. Choose the best display through your own reasoning. Do not treat the current three-column arrangement as mandatory. No table orientation or page arrangement is preferred: explore alternatives independently, and do not interpret an example arrangement as an instruction to use it.

## Non-negotiable: the complete comparison table is the focal point

The main statistics comparison table is the primary reason this page exists. Give it the strongest visual hierarchy and enough usable space for serious research. Supporting cards must not displace it into a secondary tab or bury it below a large hero section.

Do not reduce its information, readable size, precision, functionality or prominence to make a composition fit. Do not replace it with KPI cards, selected “key stats,” a heatmap alone, an abridged table, an ellipsis, or a decorative representation. Preserve every one of the 36 metrics, all seven timeframe values per metric, DIFF, both timeframe selectors, selected-period highlighting, and all supported row-expansion functions. You may reorganize or transpose only if the complete comparison remains at least as readable and operable; orientation is your decision.

Scrolling and a taller page are acceptable. A full-page design may need multiple frames. Do not make text microscopic to fit one screenshot. On narrower devices, use an accessible full-table viewport, sticky labels or another complete treatment. Do not permanently hide unselected timeframes or omit rows. If you show a cropped viewport, also provide a full-table specification and continuation frame so every value's place is accounted for. All table content must be directly accessible, without a simplified mobile replacement.

## Current page description

A dark, compact dashboard sits beneath the FH site navigation. A full-width WiGO header provides player search and a selected-player control. The current desktop layout has player identity, biography, production, schedule, ratings and team context at left; a large comparison table in the center; and consistency, radar, trend charts and percentile bars at right. The screenshot shows Nikita Kucherov as an example. The design must work with other players, long names, different teams, limited history and missing data.

The screenshot includes problems, not design requirements: a radar without a useful plotted result, potentially incomplete chart data, tightly packed labels, constrained scroll areas and a prior-season percentile warning. Design the intended working states without disguising unavailable data as valid zero performance. Numerical values are illustrative, not verified production statistics.

## Complete component inventory — account for every ID

**C01 — Site and player-selection header.** Preserve the FH brand/site-navigation context and existing support/account/social access. WiGO identity and “What Is Going On,” player search/autocomplete, selected-player thumbnail, full name, team abbreviation, position, Clear action and player-research context. Keep selection easy to access while researching. Do not invent primary navigation destinations.

**C02 — Player identity/headshot.** Player portrait with team logo/branding; team name, first and last name, sweater number, position and team abbreviation. Handle unavailable images and long names gracefully.

**C03 — Biographical data.** Age, height, weight and position, with units and unavailable states.

**C04 — Season production snapshot.** Points, goals, assists and shots on goal, each showing season total and per-game rate. Clearly identify the season and available-data status.

**C05 — Per-game averages and 84-game pace.** Preserve GP, G, A, PTS, SOG, S%, PPP, HIT, BLK and PIM. Counting metrics have per-game and full-season pace values. GP is contextual, and shooting percentage is a percentage with no count projection. The intended updated forward projection is labeled **84-game pace**; the screenshot's 82-game label is being replaced. Actual historical totals must not be rescaled. Make pace understandable as a projection at the observed rate, not a prediction of remaining games or health.

**C06 — Opponent schedule/results.** Date, opponent, home/away (vs/@), recent result or upcoming local start time; next-game highlight, W/L, scores, OT/SO when relevant. This includes recent games and upcoming games for the player's current team. It does not promise that the player will dress.

**C07 — Player percentile-based ratings.** Preserve nine displayed ratings: Offense—All Strengths (AS), Even Strength (ES), Power Play (PP); Defense—AS, ES, Penalty Kill (PK); Overall—All, Even, Special. Important: defensive special teams is **PK**, not PP in the current implementation. Overall AS/ES combines offense and defense; Special combines PP offense and PK defense using ice-time weights. These are weighted percentile composites, not necessarily percentiles of a final overall-score distribution. Provide intelligible grouping and access to definition/cohort context. Do not invent another rating or relabel PK as PP.

**C08 — Team Chance Generation.** Five-on-five xGF per game, team percentile, strength/neutral/concern assessment and explanation. Higher is better.

**C09 — Team Chance Suppression.** Five-on-five xGA per game, team percentile, assessment and explanation. Lower is better.

**C10 — Team Finishing.** Five-on-five GF/xGF percentage, team percentile, assessment and explanation. Distinguish finishing above/below expectation from permanent player talent.

**C11 — Team Special Teams.** Team PP%, PK%, their combined league-relative percentile, assessment and explanation. C08–C11 belong to a clearly labeled team-performance group, retain their own identities, and include source/as-of context. They are not individual-player isolated-impact ratings. Even if below the screenshot crop, all four must be included.

**C12 — Full statistics comparison table and controls.** Preserve these seven timeframes: STD (season to date), LY (last year), CA (career average), 3YA (three-year average), L5, L10 and L20 (last 5/10/20 games), plus DIFF. Preserve two comparison selectors and distinct selected-period highlighting. DIFF compares per-game rates for counting stats and direct values for rates/percentages; its exact definition needs accessible help. Show increases/decreases without implying every increase is beneficial.

The complete 36-metric inventory, in current order, is:

1. GP
2. ATOI
3. Points
4. Goals
5. Assists
6. SOG
7. S%
8. PPP
9. PPG
10. PPA
11. PPTOI
12. PP%
13. HIT
14. BLK
15. PIM
16. ixG
17. iCF
18. G/60
19. A/60
20. PTS/60
21. SOG/60
22. ixG/60
23. iCF/60
24. PPP/60
25. PPG/60
26. PPA/60
27. iHDCF/60
28. iSCF/60
29. HIT/60
30. BLK/60
31. PIM/60
32. IPP
33. oiSH%
34. OZS%
35. PTS1%
36. PTS1/60

**C13 — Expanded stat-row game-log chart.** Every supported metric row expands to its own game-log line chart, with date/game axis, metric values and units, tooltips, loading/error/empty state, and reference-line toggles for STD, LY, CA, 3YA, L5, L10 and L20. GP currently has no meaningful expansion. The current log shows current-season games; historical reference lines do not automatically change the log season. Show at least one expanded row in your design and explain how it relates to the still-complete table. Preserve the stat-to-chart relationship if you change table orientation.

**C14 — Point Consistency.** Doughnut/pie with 0-point, 1-point, 2-point, 3-point and further buckets through the actual maximum; count and percentage for each. Do not cap at five points. Preserve the supplementary “Cardio” figure: games with zero points, shots, hits and blocks. It overlaps the zero-point category and is not an additional mutually exclusive slice. Include a clear denominator/GP context.

**C15 — Category Percentile Radar.** A functioning eight-axis player radar: GOALS, ASSISTS, PPP, SOG, +/−, PIM, BLK and HITS. Show a readable 0–100 percentile scale, meaningful plotted shape when data exists, cohort/timeframe context and an explicit unavailable state otherwise. Preserve the radar as a distinct component; the bottom bar panel does not replace it. Treat PIM as a fantasy category rather than automatically a hockey-quality score.

**C16 — Brush/zoom Time on Ice.** TOI / PPTOI% toggle. TOI mode includes per-game total TOI, per-game PPTOI and season-average total TOI. “Total TOI” is all-strength time in each game, not a cumulative season sum. PPTOI% mode includes per-game power-play usage and season-average usage; clarify its definition as share of team PP time where supported by the audited data. Preserve readable time/percentage axes, hover values, zoom/brush interaction, pan and a visible reset. Show or specify both toggle states.

**C17 — Brush/zoom Points Per Game.** Per-game points bars, 5-game and 10-game rolling-average lines and season-average line; date axis, hover values, readable series key, zoom/brush/pan and reset. Define windows as games played, not calendar days.

**C18 — Brush/zoom Game Score.** Per-game Game Score bars and 5-/10-game rolling-average lines, including negative values; date axis, hover values, model explanation, zoom/brush/pan and reset. Do not add a season-average line as if it were an existing requirement. Keep this chart separate from Points Per Game.

**C19 — Rate/category percentile bars.** Preserve AS, ES, PP and PK controls; minimum-GP slider/value; target-player GP context; per-metric percentile and ordinal rank; and a conspicuous requested-versus-applied-season warning if prior-season data is used. The complete 16 metrics are: TOI/GP, G/60, A/60, Pts/60, SOG/60, iSCF/60, iHDCF/60, ixG/60, iCF/60, SCF/60, HDCF/60, CF%, SF%, GF%, SCF%, HDCF%. Individual and on-ice chance metrics are distinct. This panel includes percentages and TOI/GP as well as per-60 rates; preserve all categories and do not mislabel them.

## Cross-page requirements

- Keep the selected player and the applicable season clear. An individual panel using an older season must disclose that locally; do not style a fallback as current data.
- Preserve loading, empty, error, insufficient-sample, stale-data and low-GP states. Unavailable is different from zero and different from an average rating.
- Preserve all controls and information on desktop, tablet and mobile. Grouping and placement may change. Secondary details may use progressive disclosure only if clearly accessible and documented; do not hide components to avoid including them in the design. The complete table remains primary.
- Use readable type, legible axes, clear focus states, keyboard-accessible actions, adequate contrast and non-color-only comparisons. Favor research efficiency over decorative space.
- Tooltips/help may explain methodology, but users should not need to inspect implementation details to interpret the interface.
- The current screenshot is a starting point, not a mandate to retain its fixed-height columns, chart proportions or cramped labels.

## Required working process and deliverables

1. Start by acknowledging the 19-component inventory and table-preservation rules. If an attachment is inaccessible, say so and request it rather than inventing screenshot details; the text inventory is still usable.
2. Explore at least three materially different layout concepts. Evaluate table dominance, simultaneous timeframe comparison, access to supporting evidence, expansion behavior, scanability and responsive completeness. Make your own recommendation; do not ask me to dictate the arrangement.
3. Present the chosen full-page desktop composition, an expanded-table-row state and tablet/mobile behavior. Provide enough height/continuation views to account for every component. Include a textual wireframe with exact content when a rendered mockup cannot legibly carry all values.
4. If generating an image, make it a faithful UI visualization of the chosen specification, not a generic sports dashboard. Preserve all component regions and the complete table structure. If image generation cannot render all 36 rows or exact labels faithfully, disclose that limitation and supply an exact companion wireframe/content specification; do not claim the image alone is complete.
5. Provide a **coverage matrix** with one row for each C01–C19: chosen desktop location, mobile location, preserved content, controls/interactions, and the frame/specification where it appears. For C12, explicitly verify 36 metrics × seven timeframes + DIFF, both selectors and row-expansion access. For C13, verify all seven reference toggles. For C15, verify eight axes. For C19, verify 16 metrics and all filters.
6. Finish with a constraint audit. If anything is omitted, truncated without an accessible continuation, unreadable or functionally reduced, revise the design before calling it complete. Separately list genuinely optional enhancements; they cannot replace or crowd out required components.

Success is the best complete working layout you can devise, with the uncompromised comparison table as its center of attention. Every component and interaction above must have an explicit home.
