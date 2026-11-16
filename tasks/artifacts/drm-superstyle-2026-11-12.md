# /drm superstyle backlog (2026-11-12)

Row format: | page | element (file) | finding and suggested fix | Medium/Low/Done | pass |

| page | element (file) | finding and suggested fix | status | pass |
|---|---|---|---|---|
| /drm | Timeframe toggle (drm.module.scss) | ~~Nested corners: 8px/6px buttons inside a 6px frame with 2px padding → 4px~~ | Done | 0 |
| /drm | Timeframe active state (drm.module.scss) | ~~White on solid primary 2.9:1. Toggle rule (9.3:1)~~ | Done | 3 |
| /drm | Matrix grid (drm.tsx, drm.module.scss, index.module.scss) | ~~18 players in a 507px square column: 9 clipped. Full-width row, grid sized to cells, hidden tooltips display:none~~ | Done | 1 |
| /drm | Text above matrix (DateRangeMatrixView.tsx, index.module.scss) | ~~Partial notice 18px white left; explanation and readout centred. One left-aligned caption stack at the grid width~~ | Done | 1 |
| /drm | Controls panel options1 (drm.module.scss) | ~~Vertical Timeframe stack ~300px; selects floated mid-height. Timeframe row on top, selects top-aligned (~145px)~~ | Done | 1 |
| /drm | Strength select (drm.tsx, drm.module.scss) | ~~Outside the options2 panel, misaligned. Moved into the panel's select row~~ | Done | 1 |
| /drm | Cards notice and scope summary (drm.module.scss) | ~~Notice centred with 24px padding. Left-aligned, 8px inset~~ | Done | 1 |
| /drm | Reported line history (LineHistory.module.scss) | ~~No section spacing; square panel; flat grey buttons. Panel shell, dividers, site button rule~~ | Done | 1 |
| /drm | Games outside the matrix list (MatrixCoverage.tsx, drm.module.scss, e2e/drm-previews.spec.ts) | ~~916px bullet list. Grouped by reason, compact 12px groups (266px); dev-only per TJ~~ | Done | 1 |
| /drm | Control labels (drm.module.scss) | ~~Mixed label alignment. Left-align all~~ | Done | 1 |
| /drm | Page width (drm.module.scss, LineHistory.module.scss) | ~~95% / edge-to-edge phones. $page-max-width 90% centred~~ | Done | 6 |
| /drm | Cards notice copy (drm.tsx) | ~~Pointed at a dev-only list. Rewritten~~ | Done | 4 |
| /drm | Dev diagnostics (diagnostics.ts, drm.tsx, MatrixCoverage.tsx, DateRangeMatrixView.tsx) | ~~Raw QA source, skipped-row count, per-game exclusions, formation leftovers shown to fans. Dev-only via NODE_ENV; prod forced to Aggregated; prod test added~~ | Done | 1 |
| /drm | Dead CSS (index.module.scss, drm.module.scss) | ~~7 unused classes carrying #007bff/#0056b3/#f5f5f5/#ddd, 'montesserat' h4, rgba overlay. Removed; hex 6 → 0~~ | Done | 2 |
| /drm | Literals (index/drm.module.scss) | ~~Roboto Condensed strings, white, 12/14px, 5/6px radii → tokens; tooltip arrow off-centre 2.5px fixed~~ | Done | 2 |
| /drm | Unit outlines (index.tsx, index.module.scss) | ~~TJ request: 2px white outline on 3x3 line and 2x2 pair blocks, Line Combination only~~ | Done | 2 |
| /drm | Compact-mode labels (index.module.scss) | ~~0.55rem (8.8px) uppercase names truncated. 13px desktop / 12px phone small caps, name column 88/72px~~ | Done | 2 |
| /drm, /rankings | Button tint (vars.scss, LineHistory.module.scss, Rankings.module.scss) | ~~rgba(primary,.12/.2) hardcoded. $button-tint / $button-tint-hover tokens~~ | Done | 2 |
| /drm | Focus rings (drm.module.scss) | ~~3px yellow $focus-color outlines. 2px primary ring, offset 2; label gap 4px~~ | Done | 3 |
| /drm | Toggle buttons (drm.module.scss .button.active) | ~~White on solid primary 2.9:1. Toggle rule (8.6:1)~~ | Done | 3 |
| /drm | Select borders (drm.module.scss) | ~~2.1:1 field borders. $border-control 3.6:1~~ | Done | 3 |
| /drm | Landmarks + corner header (drm.tsx, index.tsx) | ~~No <main> (region x8); empty corner columnheader. <main> root, hidden 'Players' text~~ | Done | 3 |
| /drm | Missing-data copy (MatrixCoverage, DateRangeMatrixView, drm.tsx) | ~~qualified/verified/selection jargon. Plain language; TJ empty state 'check back after tonight's update'~~ | Done | 4 |
| /drm | Scope line + cell readout (drm.tsx, formatScopeDate.ts, index.tsx) | ~~ISO 'Matrix date scope… (inclusive)', TOI/ATOI/Not applicable. Formatted dates, sentence readouts~~ | Done | 4 |
| /drm | Reported line history copy (LineHistory.tsx) | ~~Archive jargon. Plain section names; diagnostics dev-only + prod test~~ | Done | 4 |
| /drm | Labels and strength names (drm.tsx, ObservedUnits.tsx) | ~~Title-case dates, 'ES · 5-on-5', 'Other ES' pipeline note. Sentence case, plain names, caption note~~ | Done | 4 |
| /drm | Matrix names (index.module.scss) | ~~Faux small caps on names; active headers scale 1.03 + slide. Plain case; colour + 600 only~~ | Done | 5 |
| /drm | Title logo + history headings (drm.module.scss, LineHistory.module.scss) | ~~5px cyan logo glow; 700 headings. Removed; 600~~ | Done | 5 |
| /drm | Page purpose (DateRangeMatrixView.tsx, vars.scss, drm.tsx) | ~~No title said what the page is. 'OILERS LINE COMBO MATRIX' section title (section-title mixin), history title same, tab title~~ | Done | 6 |
| /drm | Phone matrix (index.tsx, index.module.scss) | ~~No scroll cue. 'Scroll sideways' hint + 24px right-edge fade at ≤640px~~ | Done | 6 |
| /drm | Team band (drm.module.scss) | ~~TJ: name sat low, on the lower stripes. Pixel stripe stops; name centred in primary stripe~~ | Done | 6 |
| /drm (32 teams) | Team band ink (drm.module.scss) | ~~#aaa/#ccc title on primary failed 7 teams (PHI 2.19 … CGY 4.32). White, ≥5.08 all 32~~ | Done | 6 |
| /drm (32 teams) | Line/goalie card ink (utilities.ts, PlayerCardDRM, GoalieCardDRM, styles/LinePairGrid.module.scss) | ~~Accent/secondary text <4.5 on $surface-1 for 8/10 teams (VGK black 1.23). First readable team colour, else white. axe 32 teams × 2 vps clean~~ | Done | 6 |
| /drm?team=VGK | Coverage gap: qualified-data UI (ObservedUnits, LinePairGrid cards) | ~~Clipped stat columns, outlined 10px card text, verbose unit list. Detour + rerun 1–7 fixed~~ | Done | detour |
| /drm?team=VGK | Cards (styles/LinePairGrid.module.scss, PlayerCardDRM, GoalieCardDRM) | ~~Outlined face, tracking, 700–800 weights, PPP/+- clipped. Body face, tabular, 4-col phone stats~~ | Done | detour |
| /drm?team=VGK | Phone lines (LinePairGrid.tsx/.module.scss) | ~~13 stacked cards. TJ: line rows 3-across, vertical sporty italic LINE/PAIR labels, goalies in right column~~ | Done | detour |
| /drm?team=VGK | Observed combinations (ObservedUnits.tsx, drm.module.scss) | ~~3-line units in 16px. Grid rows + time bars (TJ), 2fr|1fr groups, PP beneath (TJ)~~ | Done | detour/rerun 6 |
| /drm | Layout (drm.tsx) | ~~Phone controls split by cards; dead right column. Units+cards full-width row after both control panels~~ | Done | rerun 1 |
| /drm?team=VGK | Band name (drm.tsx) | ~~'Vegas Knights'. Nickname from full name~~ | Done | rerun 1 |
| /drm | A11y structure (drm.tsx, LinePairGrid, cards, ObservedUnits) | ~~h1 'Logo' dup, no card headings, stat abbreviations, list semantics~~ | Done | rerun 3 |
| /drm | Copy (cards, units, season button, empty line matrix) | ~~'GP in N matching games', 'Alternatives', 'Regular Season', observed-units jargon~~ | Done | rerun 4 |
| /drm | Matrix legend (index.tsx, index.module.scss) | ~~No legend for hue/brightness/outline. Legend row~~ | Done | 7 |
| /drm | Matrix palette (utilities.ts getColor) | ~~F+D yellow fails dark lightness band. Violet #9085E9; all checks pass~~ | Done | 7 |
| /lines | LinemateMatrix colours (components/LinemateMatrix/index.tsx) | ~~Reversed mapping + failing yellow. Matched /drm (orange F+F, violet F+D, blue D+D) in a separate session; tests 12/12, typecheck 0, uncommitted~~ | Done | 7 |
| /drm (empty) | Empty matrix frame (DateRangeMatrixView.tsx, index.module.scss) | ~~Message states centred mid-page. Full-width frame~~ | Done | 8 |

## Hand-off (2026-11-12, uncommitted by TJ's choice)

Superstyle changes on /drm are local only: no commit, no push, no deploy. They are styling, copy, layout and a11y; the reader, data and math are untouched.
Some of these files also hold the Codex DRM DDATV lane's uncommitted candidate work, so commit them together with that candidate.

- Tracked files with superstyle hunks: web/pages/drm.tsx, web/components/DateRangeMatrix/{index.tsx, index.module.scss, drm.module.scss, DateRangeMatrixView.tsx, utilities.ts (getColor violet, getTeamColors ink), PlayerCardDRM.tsx, GoalieCardDRM.tsx, LinePairGrid.tsx}, web/styles/{vars.scss ($button-tint, section-title mixin), LinePairGrid.module.scss, Rankings.module.scss}, tests: web/__tests__/pages/drm.test.tsx, DateRangeMatrixView.test.tsx, index.accessibility.test.tsx, LinePairGrid.test.tsx.
- Untracked DDATV files I edited: LineHistory.tsx/.module.scss/.test.tsx, MatrixCoverage.tsx, ObservedUnits.tsx, web/e2e/drm-previews.spec.ts (copy and label assertions updated).
- New superstyle files: web/components/DateRangeMatrix/diagnostics.ts (SHOW_DIAGNOSTICS) and formatScopeDate.ts.
- DDATV's CANDIDATE.json SHA-256 hashes are now stale for the files above. Re-hash them before treating that candidate as accepted.
- Production behaviour change: Raw QA source, skipped-row counts, per-game exclusions, formation leftovers and retained-interpretation details are hidden when NODE_ENV=production (TJ rule; production tests added).
- Checks at hand-off: DRM unit tests 158/158, LineHistory 7/7, typecheck exit 0, lint 0, drm-previews e2e 6/6 (run on a temporary port 3115 because another lane's server holds 3114), axe clean on 32 teams × 2 viewports and on 4 DRM states × 2 viewports.
