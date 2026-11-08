# Rankings superstyle (2026-11-08, Claude)

## Scope
/superstyle on web/pages/rankings.tsx — 9 views (TJ kickoff 11-08): default order, fix every severity, backlog in
tasks/artifacts/Rankings-Superstyle-2026-11-08.md. Axe MCP failed to connect → local scripts/axe.cjs.

Views: /rankings · ?entity=goalies · ?entity=teams · ?tab=metric_explorer · ?tab=deployment_tiers · ?tab=trending ·
?tab=splits · ?tab=war · ?entity=goalies&tab=trending (Source Pending)

## Where
Branch octoberBranch. Files: web/pages/rankings.tsx, web/styles/Rankings.module.scss, web/components/Rankings/*.
No other lane touched these since 11-01 (git log). Commits: none yet.

## Coverage ledger
| view \ pass        | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
| skaters            | ✓ |   |   |   |   |   |   |   |
| goalies            | ✓ |   |   |   |   |   |   |   |
| teams              | ✓ |   |   |   |   |   |   |   |
| metric_explorer    | ✓ |   |   |   |   |   |   |   |
| deployment_tiers   | ✓ |   |   |   |   |   |   |   |
| trending           | ✓ |   |   |   |   |   |   |   |
| splits             | ✓ |   |   |   |   |   |   |   |
| war                | ✓ |   |   |   |   |   |   |   |
| source pending     | ✓ |   |   |   |   |   |   |   |

## State / checks
- Pass 0 done: toenails.cjs 9 views × 390/1440 → 1 hit (.metaPanel inset 1px white top highlight on 6px radius), removed, TJ approved.
  SETUP sweeps (methodology popover open; controls collapsed) clean. scss-check pure OK. Nested corners on toggles: flush fills in clipped parent, OK.

## Next step
Pass 1 critique: start with the header snapshot box stuck on "Loading" for splits/war/source-pending.

## Gotchas
- scss-check.cjs paths are relative to web/ (styles/..., not web/styles/...).
