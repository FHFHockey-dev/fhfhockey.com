# 2026-11-06 Claude: /superstyle Lines (audit only)

## Scope
/superstyle on `web/pages/lines/*`: `/lines`, `/lines/[abbreviation]` (EDM sample), `/lines/line-combo/[gameId]` (2026020252 VGK@DET).
TJ chose **audit only, hand off** (pop-up 2026-11-06): the Lines IGA Chef lane (`2026-11-06-claude-lines-iga-chef.md`) owns `web/pages/lines/*`, `web/components/LineCombinations/*`, `web/lib/lines/*` and plans a restructure. No edits to those files. Findings go to a backlog for the Lines Chef.

## Where
- Branch `octoberBranch`. Only code edit: `web/components/Layout/Header/Header.module.scss` (bottom-nav radius).
- Scratch: `$SUPERSTYLE_OUT` = session scratchpad `/superstyle-lines`.
- Backlog: `tasks/artifacts/Lines-Superstyle-Audit-2026-11-06.md`.

## State / checks
- toenails.cjs: desktop clean on all 3; mobile 1 hit on all 3 = site Header bottom-nav active "Tools" (3px top rule vs 6px radius). Header is not Lines-lane.
- axe (local, both vps): /lines 2 serious (refreshed-time contrast 3.6-3.7); /lines/EDM 16 serious (sweater numbers 2.71:1) + heading-order, duplicate/nested main, region; line-combo: no h1, heading-order.
- focus.cjs: no indicator on /lines "SHOW ALL"; TeamSelect logos x32 + arrows.
- slop: tracked caps in PowerPlayCombos/labels, text-shadow on 51 card values, 3 gradient backgrounds.
- Full captures 390/1440 for all 3 routes, plus phone crops of the EDM top and cards. Read them all.
- Backlog written: `tasks/artifacts/Lines-Superstyle-Audit-2026-11-06.md` (6 High / 13 Medium / 10 Low).
- Handed off by SendMessage to session "Lines page three-layer redesign" [eff1db]. It confirmed the rows are folded into `tasks/artifacts/lines-iga-plan-2026-11-06.md`: High 2 + ProjectedLineups rows go to Lane B (snapshot UI); High 1/3/4/5/6 and the other L/S rows go to Lane C (page shells and legacy grid style fixes). The bottom-nav toenail (H) is not in that plan.

## Coverage ledger (audit-only: every lens applied as review, no fixes)
| page \ pass | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
| /lines | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| /lines/EDM | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| /lines/line-combo/2026020252 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

## Next
- Nothing in this lane until the Lines IGA lanes land; then a full /superstyle edit pass on the new pages.
- Bottom-nav toenail FIXED (TJ approved): `web/components/Layout/Header/Header.module.scss` `.bottomNavButton` radius 6px -> 3px 3px 6px 6px. scss-check pure OK; toenails.cjs mobile /lines + /stats clean. Uncommitted, pending TJ's commit decision.

## Gotchas
- `/api/v1/lines/projected` currently returns `enabled:false` (projected lineups feature off), so ProjectedLineups state shown is the disabled one.
