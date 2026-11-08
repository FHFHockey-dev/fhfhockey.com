# WIGO design review after the UI pass (2026-10-30)

Design plugin skills: design-critique, ux-copy, design-system. Reviewed after steps 1–9 on the fictional fixture at 1280×800, 1440×900 and 390 px, with and without a player selected. Review only: nothing was edited. Accessibility is in `A11Y-2026-10-30.md`.

## 1. Critique (design-critique)

**First impression.** With a player selected, the page now reads in clear order: identity at top left, the matrix as the centre, and charts along the bottom. The selected metric row and the two column headers are the only strong colour in the matrix, so the comparison stands out. It looks calm for 600 text nodes.

| Finding | Severity | Recommendation |
| --- | --- | --- |
| Help notes clip or hide at 1280 (game score invisible, comparison paragraphs overlap, ratings cut off). It predates this pass: panels have had `overflow: hidden` since the 10-25 layout. | 🔴 Critical | Show help in a popover above the page. |
| **No player selected:** the page shows 11 separate prompts in four text styles (large white, italic, small grey, bold). "Please select a player.", "Select player for ratings", "Select a player to view chart." and more. The game log says "No game log data available for this season", which is wrong when no player is chosen. | 🟡 Moderate | One prompt in the top bar, with quiet panels showing the same small grey line. This is the first screen a new visitor sees. |
| Game mean label sits over the chart lines (now small, still overlapping). | 🟢 Minor | Accept for now. Moving it means changing where the reference label anchors, and it stays readable. |
| Radar "100" and "50" axis labels overlap the shape. | 🟢 Minor | `CategoryCoverageChart` is outside this lease. |

**Hierarchy that works.** The team-colour rail is the single brand accent, plus today's game in the schedule. The wordmark and tagline stay as the page's identity. Panels share one title style.

**Consistency.** Help is always ⓘ, titles are one style, seasons one format. Strength pills and TOI / PP TOI % use similar active states but different shapes; that's small enough to leave.

## 2. Copy (ux-copy)

| Where | Now | Suggested | Pinned by tests? |
| --- | --- | --- | --- |
| Loading placeholders | "Loading Game Score…", "Loading TOI Chart...", "Loading PPG Chart...", "Loading Consistency..." | "Loading time on ice…", "Loading points…", "Loading game score…", "Loading consistency…": one ellipsis, words not abbreviations. | No. Safe. |
| Empty prompts | 11 variants (see above) | "Select a player" everywhere, with one fuller line in the top bar. | Some, checked at implementation. |
| Search errors | "Failed to load players." | "Couldn't load players. Try again." | Test strings exist for some "Failed to load" lines; would need updating. |
| Game log error | "Failed to load game log for Goals." | "Couldn't load the Goals game log." | Yes, several tests. |
| Team drivers | "Team driver context is temporarily unavailable." | "Team drivers aren't available right now." | Check at implementation. |
| Consistency | "No game data found..." | "No games found for this season." | Check at implementation. |

**Voice.** The good lines are short and specific ("2024–25 values and cohort, not 2025–26"). "Unable to load this chart right now." in `errorMessages.ts` is fine and is the pattern to follow.

## 3. Design-system audit (design-system)

| Category | State |
| --- | --- |
| Font size and weight | From `_scale.scss`, named by size. Exceptions: the wordmark, the player name, and the `--wigo-*` variables. |
| Radii | From the scale. |
| Text colour | Role tokens, plus data colours in the chart components. |
| Canvas fonts | Set in each chart component, not from the scale. |
| Structure | `styles/wigoCharts.module.scss` is about 2,470 lines of stacked base, one-page and phone rules. Fixing this means consolidating rules by component. It's larger, separate work and not proposed here. |
| Spacing | Mixed tokens and literal values, not touched. |

**Score:** about 75/100. Type, radius and colour are tokenised. The gaps are the stylesheet structure and spacing.

## Suggested next steps (each its own approve/edit step)

1. **Help notes that open fully** (critical).
2. **One empty state** for no player selected, including the safe copy edits.
3. **Accessibility fixes:** contrast, phone targets, headings, tab state, chart labels.
