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
