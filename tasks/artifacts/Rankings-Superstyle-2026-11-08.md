# Rankings superstyle backlog (2026-11-08)

Source: /superstyle on web/pages/rankings.tsx. Fix order High → Medium → Low; rows stay open only if TJ declines them or another lane owns the file.

| page | element (file) | finding and suggested fix | Medium/Low/Done | pass |
|---|---|---|---|---|
| all | segmented toggles, rank-mode toggle, active tab (Rankings.module.scss .segmentedControl/.rankModeToggle) | white text on solid `$primary-color` fill ≈2.9:1 (fails 4.5); use `$text-on-primary` per fhfh-styles §7.1 | Medium | 0→3 |
| all | Dataset snapshot box (Rankings.module.scss .metaPanel) | ~~1px white inset top highlight on 6px radius curls into corners; removed~~ | Done | 0 |
| splits, war, source pending | header snapshot box + action-bar "Snapshot …" (rankings.tsx latestSnapshotDate) | date reads "Loading" forever when the tab has no snapshot (war, unsupported tabs) — pass 1 | Medium | 1 |
