# Game Grid desktop /superstyle backlog (2026-11-07)

| page | element (file) | finding and suggested fix | Medium/Low/Done | pass |
|---|---|---|---|---|
| /game-grid | legend (GameGrid.tsx:807) | ~~Legend says green = ≤8 GP, but cells use ≤6 green / 7–8 yellow / 9+ red. Show three swatches.~~ Light / Mid / Heavy swatches | Done | pre |
| /game-grid | PREV/NEXT (GameGrid.module.scss dateButton*) | Outlined accent font, blue on blue fill reads hollow. White ink tried (12.4:1). | Declined by TJ ("Keep blue") | pre |
| /game-grid | SCORE header (GameGrid.module.scss) | Bright sky fill: kept as intentional primary-metric emphasis (TJ "keep blue"). | Declined by TJ | pre |
| /game-grid | summary row label (DesktopMasterTable.tsx:1109) | ~~"GP/Day AVG" mislabels totals.~~ "GP/Day"; label cell no longer display:flex (gap fix) | Done | pre |
