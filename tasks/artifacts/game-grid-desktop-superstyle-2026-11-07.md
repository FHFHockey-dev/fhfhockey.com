# Game Grid desktop /superstyle backlog (2026-11-07)

| page | element (file) | finding and suggested fix | Medium/Low/Done | pass |
|---|---|---|---|---|
| /game-grid | legend (GameGrid.tsx:807) | ~~Legend says green = ≤8 GP, but cells use ≤6 green / 7–8 yellow / 9+ red. Show three swatches.~~ Light / Mid / Heavy swatches | Done | pre |
| /game-grid | PREV/NEXT (GameGrid.module.scss dateButton*) | Outlined accent font, blue on blue fill reads hollow. White ink tried (12.4:1). | Declined by TJ ("Keep blue") | pre |
| /game-grid | SCORE header (GameGrid.module.scss) | Bright sky fill: kept as intentional primary-metric emphasis (TJ "keep blue"). | Declined by TJ | pre |
| /game-grid | summary row label (DesktopMasterTable.tsx:1109) | ~~"GP/Day AVG" mislabels totals.~~ "GP/Day"; label cell no longer display:flex (gap fix) | Done | pre |
| /game-grid @1024 | master table (DesktopMasterTable.tsx sizeMasterTableColumns) | ~~7-day table 1022px in a 922px column: Total cut, Weekly sparklines off-screen.~~ Day columns narrow toward min before scrolling | Done | 1 |
| /game-grid @1024 10-day | master table | 10-day still overflows 40px at 1024 (days at 50px min). Lowering min to 46 offered. | Declined by TJ (approved without the Edit) | 1 |
| /game-grid @1024 | header subtitle (GameGrid.tsx, .titleBlock/.subTitle) | ~~Title width:100% squeezed subtitle to 358px; "OFF-"/"NIGHTS" split.~~ Title sizes to text ≥981px; "off-nights" nowrap | Done | 1 |
| /game-grid @1024 | legend (.legendMeta) | ~~2-2-1 wrap orphaned "Bottom 10 score".~~ Days column + score column below 1200px | Done | 1 |
| /game-grid | Weekly key dots (.matchupKey) | ~~#00f5a0/#ff557c differ from the sparkline's tokens.~~ $success-color / $danger-color | Done | 2 |
| /game-grid | private ramp (GameGrid, OpportunitySparkline, PlayerPickupTable, palette, DateRangeTeamGrid) | ~~24 unnamed hex values, 54+ uses.~~ Named in GameGrid/_surfaces.scss (CSS byte-identical) | Done | 2 |
| /game-grid | date-range error notices | ~~Tailwind red rgba(239,68,68).~~ rgba($danger-color) | Done | 2 |
| /game-grid | excluded-day header dates (.masterDayHeaderExcluded) | ~~#656565 at 2.5:1.~~ opacity .7 + $text-primary date, ≥4.5:1 | Done | 3 |
| /game-grid | GP / OFF header ink (.masterBlueHeader) | ~~#0fc0f6 on #0f5f83 3.3:1.~~ $color-blue-100, 5.7:1 | Done | 3 |
| /game-grid | sort header focus (.masterSortButton) | ~~3% tint focus, invisible.~~ 2px inset primary ring | Done | 3 |
| /game-grid drawer | positions row (.filterRowPositions) | ~~G label scrolled out (255 in 246px).~~ gap 6px | Done | 3 |
| /game-grid drawer | Score uses presets (.inBottomDrawer) | ~~None wrapped alone.~~ 4 equal columns (TJ edit) | Done | 3 |
| /game-grid drawer | error state (PlayerPickupTable.tsx .errorState) | ~~Retry left, message centred.~~ centred column | Done | 3 |
| /game-grid drawer | populated BPA table | Not verified: player data fails to load on the isolated dev server. | Not verified | 3 |
| /game-grid drawer | RESET / RETRY (.toolbarButton) | ~~White on blue gradient 2.7–2.9:1 (axe skips gradients).~~ Flat primary + $text-on-primary 6.4:1, condensed bold | Done | 3 |
| /game-grid | WEEK SCORE popover (GameGrid.tsx) | ~~Raw formula and internal notes.~~ Plain three-paragraph explanation; dialog "How Week Score works" | Done | 4 |
| /game-grid | ATK/DEF meter tooltips (RatingMeter.tsx) | ~~"Opp defense · 97th pct (xGA/GP, inverted)".~~ Spelled out | Done | 4 |
| /game-grid | Info panel (DesktopMasterTable.tsx) | ~~Nine formula paragraphs, ISO dates.~~ Phone panels' plain wording; unused constants removed | Done | 4 |
| /game-grid | drawer bar (.bottomDrawer*, GameGrid.tsx) | ~~Cyan wash, glows, gradient neon rail; "POOL \| Player Candidates".~~ Flat blue handle, neutral body; "Best Players Available" (B, P, A blue; TJ edit); e2e selectors updated | Done | 5 |
| /game-grid | title / subtitle / WEEK badge glows | ~~Text-shadow and drop-shadow glows.~~ Removed (matches mobile) | Done | 5 |
| /game-grid | ATK/DEF meter fills (RatingMeter.module.scss) | ~~6px neon glow ×64.~~ Removed (also 390) | Done | 5 |
| /game-grid | hover states (week nav, 7/10, presets, sparkline card, date-range submit) | ~~Coloured glows, gradient overlays, transition:all.~~ Flat colour steps; submit flat primary + dark ink | Done | 5 |
| /game-grid | nested radii (week nav, 7/10 toggle, WEEK SCORE) | ~~4px buttons in 12px/4px-padded pills.~~ 8px (TJ edit); rule added to /superstyle skill | Done | 5 |
| /game-grid | PREV/NEXT hover ink | ~~Near-black on dark blue hover, 1.7:1.~~ White 9.8:1 | Done | 5 |
| /game-grid e2e | web/e2e/player-pickup.spec.ts | Pre-existing failures: line 37 expects "Availability in your league…" (signed-out copy changed by d3e76b3a0), connected-pool test fails on premium-auth fixture (line 120). Not fixed here; for Chef. | Other lane / follow-up | 5 |
| /game-grid | table header labels (.masterSectionLabel, eyebrows, key, day dates) | ~~8.3–9.6px labels.~~ 10–11px (narrower below 1200); "Opponent strength" → "Opponents", clear of the 24px corner (TJ caught the clip) | Done | 6 |
| /game-grid | table width (sizeMasterTableColumns) | ~~1200px table inside a 1296px column at 1440.~~ Side/summary columns take the spare; edges match the header card at 1024/1440/1920 | Done | 6 |
| /game-grid | day intensity colours | Validator: green/yellow protan ΔE 6.1 (floor band); legal, as each day prints its game count. Shared tokens. | No change | 7 |
| /game-grid | 4-week sparklines (OpportunitySparkline.module.scss) | ~~Blended gradient line, glow stroke, glowing dots.~~ Neutral line, per-week dots and bands at every width | Done | 7 |
| /game-grid | Score digits (DesktopMasterTable data-rank) | ~~Blue for every middle team.~~ Phone's 1–32 rank ramp (TJ edit) | Done | 7 |
| /game-grid | day switches (Toggle.module.scss, 1440 + 390) | ~~Glossy gradients, blur, hover lift.~~ Flat track, flat blue on, flat thumb | Done | 8 |
| /game-grid | WEEK SCORE "i" (.weekScoreHelp) | ~~Blue glow.~~ Removed | Done | 8 |
| /game-grid @390 | grid container top edge | toenails.cjs flags a 1px top rule vs 12px radius; hidden under the sticky header, not visible. | No change | 0, 8 |

Final sweep (pass 8): axe 0 at 1440 and 390 (7- and 10-day), desktop toenails clean, nested-radius probe clean (drawer closed/open), focus sweep 220 stops all visible.
