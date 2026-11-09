# Rankings superstyle backlog (2026-11-08)

Source: /superstyle on web/pages/rankings.tsx. Fix order High → Medium → Low; rows stay open only if TJ declines them or another lane owns the file.

| page | element (file) | finding and suggested fix | Medium/Low/Done | pass |
|---|---|---|---|---|
| all | segmented toggles, rank-mode toggle, active tab (Rankings.module.scss .segmentedControl/.rankModeToggle) | white text on solid `$primary-color` fill ≈2.9:1 (fails 4.5); use `$text-on-primary` per fhfh-styles §7.1 | Medium | 0→3 |
| all | Dataset snapshot box (Rankings.module.scss .metaPanel) | ~~1px white inset top highlight on 6px radius curls into corners; removed~~ | Done | 0 |
| splits, war, source pending | header snapshot box + action-bar "Snapshot …" (rankings.tsx latestSnapshotDate) | date reads "Loading" forever when the tab has no snapshot (war, unsupported tabs) — pass 1 | Medium | 1 |
| all (390 + 1440) | filter grid (Rankings.module.scss .filters/.filtersSideRail, RankingsFilters.tsx) | ~~explicit grid-row never reset below 1240px → View/Season/Deployment stacked under Search/Tools on phones; absolute Tools rail overflowed Teams onto tab bar; goalie Min Shots ran under rail. Rows reset, 2 cols on phones, rail = grid column 4, Min Shots row 3; Quick Info (dup of subtitle) removed, preset text → ⓘ popover (TJ edits)~~ | Done | 1 |
| goalies | goalie matrix name column (GoalieMatrixTable.tsx) | ~~shows "high sample · m…" instead of name: flex row squeezed name; header lacked sticky name class → 105px column. Stacked identity + sticky 350px header~~ | Done | 1 |
| teams | team matrix name + Style cells (TeamMatrixTable.tsx) | ~~names truncated; Style label hidden. Sticky name column; Style cell redesigned: pace×control glyph, short label, xGF line, green/red tint by control (TJ edits)~~ | Done | 1 |
| skaters 1440×900 | workstation height (rankings.tsx, Rankings.module.scss) | ~~viewport-fit layout left the matrix 3 rows. Filters start collapsed on desktops <1100px tall (tabs stay out of the collapsible), footer one line (121→45px), caveats moved into Legend & Methodology; band key pills were all grey (cascade bug) → solid tone fills + dark ink (TJ edits). 3 → ~6¾ rows~~ | Done | 1 |
| goalies, teams | matrix pagination (Goalie/TeamMatrixTable) | ~~raw browser-default Prev/Next/select → shared paginationControls~~ | Done | 1 |
| trending, splits | panel heading (.panelHeading undefined) | ~~heading flush to panel edge with browser defaults → shares Deployment Tiers header~~ | Done | 1 |
| trending | inner table (Rankings.module.scss .tableWrap inside .trendingPanel) | table draws its own rounded border inside the panel (panel-in-panel); offered flush edit | Declined (TJ approved without it) | 1 |
| splits | splits API (lib/rankings/splits.ts) | /api/v1/contextual-rankings/splits takes 29.6s locally (200 OK); tab shows "Loading…" that long. Performance, outside style scope → follow-up | Medium (follow-up) | 1 |
| deployment tiers | tier cards | every tier ≈50% percentile (mean of percentiles) — reads as no signal; dataviz pass | Low | 7 |
| skaters | default filters (lib/rankings/rankingUrlState.ts) | ~~Season + Min 1 GP put 1-game players on top (0/100% tiles) → Min GP default scales with window: 10/5/3/2, follows window switches~~ | Done | 1 |
| all | page shell (Rankings.module.scss .page) | ~~min(1880px, 100%−32px) → $page-max-width 90%; phones calc(100%−20px) (TJ edit)~~ | Done | 2 |
| skaters/goalies/teams (390) | sticky name column (Rankings.module.scss, PlayerMatrixTable.tsx) | ~~350px name column filled the phone → 170px, headshots hidden, team abbr, deployment as tone text in meta line (TJ edits)~~ | Done | 1 |
| skaters | matrix footer count (matrix API meta.totalRankedRows) | "Showing 10 of 776" while comparison says "rank 1 of 711" with Min 10 GP; total seems to count pre-Min-GP rows. Data question, not style → follow-up | Medium (follow-up) | 1 |
| splits | empty split cells (SplitsPanel.tsx) | "- - Rk -" placeholder in empty cells | Low | 4 |
| all | radii / weights / fonts / tones (Rankings.module.scss) | ~~36 radius + 44 weight literals → tokens; controls inherited Arial → Roboto; Train One toggle/tab labels (TJ edits); tone triplets off-token → rgb-triplet(); tile gloss + drop shadow removed~~ | Done | 2 |
| all | score tile numbers (Rankings.module.scss text-shadow 0 0 8px) | coloured glow on percentages | Low | 5 |
| all | spacing literals (Rankings.module.scss) | ~~83 on-scale spacings → $space-* (compiled CSS byte-identical)~~; ~120 off-scale values (3/5/6/7/9/10/12/14/18px) left unchanged | Done / off-scale Declined (TJ) | 2 |
| skaters/goalies/teams (desktop) | matrix layout (detour; rankings.tsx, 3 matrix tables, Rankings.module.scss, vars.scss) | ~~2200px tables scrolled sideways (6–7 of 21 metrics visible) → compact heatmap default (all metrics fit at 1440), snapshot drawer, muted R→O→Y→G percentile palette tokens, Martian Mono numbers, two-row goalie role (TJ-designed)~~ | Done (Teams visual verify pending) | 3 (detour) |
| all | percentile palette | validate the new $percentile-band-* set with the dataviz validator (ordinal/CVD) | Low | 7 |
| trending | TREND column (TrendingPanel.tsx) | null trend renders red "-" (negative class on null) → neutral | Medium | 7 |
| goalies, teams | caveat/stale chips on nearly every cell; goalie metrics N/A after Codex lane goalieMatrix patch | root cause in data/flag rules → proposed session "rankings-warnings" (card task_1fcede72) | Open (other session) | 3 |
| all | caveat keys in tooltips/notices/panels (caveatLabels.ts + 6 render sites) | ~~raw snake_case keys and table names shown to fans → plain-language formatter, grouped NST gaps, plain notice lead-ins~~ | Done | 4 |
| skaters | metric descriptions (lib/rankings/matrixMetricRegistry.ts) | ~~"from skater_composite_ratings", "verified ICF source data", "live PP points where PP rows are available" → plain copy; test assertions updated~~ | Done | 4 |
| goalies | goalie metric descriptions (lib/rankings/goalieMatrix.ts) | "from WGO goalie game logs", "from NST goalie counts" leak source names; file has uncommitted Codex lane patches (2026-11-09-codex-rankings-matrix-integration) → that lane | Open (other lane) | 4 |

## Pass 6 follow-ups (other lane: rolling ETL writer)
- `rolling_player_game_metrics` leaves `toi_seconds_avg_last10`, `toi_seconds_avg_last20` and `career_games_played` empty (0 of 212 rows on 2026-11-07, 5v5+all); only `toi_seconds_avg_last5` is filled. Rankings now infer Last-10/20 window games from TOI (`skaterWindowAggregation.ts` `resolveGamesPlayed`). Filling these columns in the writer (then a bounded recompute, with approval) would make window game counts exact for players with few prior-season games.
- Composite ratings 2026–27: only Season · 5v5 · all_skaters published (2026-11-07, 732 rows, TJ-approved 11-08). The other 15 contexts last season had (Last 20 × all_skaters; Season + Last 20 × L1–L4, P1–P3) are unpublished; each build is ~7 min of DB reads — run overnight one at a time with approval. `update-skater-composite-ratings` is not on a cron.
