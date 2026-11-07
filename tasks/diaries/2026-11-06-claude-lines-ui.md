# 2026-11-06 · Claude · Lines IGA Lane B (Snapshot UI)

## Scope
Lane B of `tasks/artifacts/lines-iga-plan-2026-11-06.md`: entry panel, IGA rail, source feed, states and audit rows for the snapshot UI. Chef: local_3f3bae11-08af-4e4b-8198-488d12a385ea.

## Where
- Branch `octoberBranch`, canonical checkout. Contract base: 7f862a278. Lane B commit: ef694105a.
- Files: `web/components/LineCombinations/{GameLineSnapshots.tsx,.test.tsx,ProjectedLineups.tsx,ProjectedLineups.module.scss,SourceFeed.tsx,SourceFeed.test.tsx,reviewReasonCopy.ts}`.
- Screens + fixture/shoot scripts: side-session-notes/<chef>/lane-b-screens/.

## State
- Done and committed. Checks: Vitest 50/50 (components/LineCombinations + __tests__/pages/api/v1/lines); `npm run typecheck` exit 0; eslint clean on the 7 files; pure CSS Modules check OK; axe-core (wcag2a/aa/21aa/best-practice) 0 violations at 1440 and 390; no toenails; no horizontal overflow.
- Screens used Playwright route interception of `/api/v1/lines/projected` with a synthetic fixture against TJ's :3000 (flags are off). No second next dev.

## Next
- Chef review. Plan says Lane B runs /superstyle after the lane is done unless TJ prefers otherwise.

## Blockers / approvals
- None. Axe MCP server was down; used local axe-core instead.

## Gotchas
- zsh: `$F` with several paths is not word-split; list pathspecs literally.
- `web/lib/lines/types.ts` has uncommitted Lane A edits (ppSwap); read-only here.
- Disabled publishing now renders nothing (audit High 2); the page shells (Lane C) show no placeholder.

## Superstyle run (Chef relay of TJ's pop-up, 2026-11-06)
- Scope (TJ kickoff): /lines/TBL and /lines/line-combo/<id>, 390 + 1440, passes 0–8; Lane B files only. Backlog: tasks/artifacts/Lines-Snapshot-Superstyle-2026-11-06.md.
- Tooling: skill scripts wrapped by scratchpad `ss.sh` + `intercept.cjs` (NODE_OPTIONS preload adds a Playwright route for /api/v1/lines/projected → fixture.json). TJ's :3000 only.
- Pass 0: clean (rendered + SETUP-opened states + static).
- Pass 1 approved: goalie "Tandem confirmed"/"Starter not confirmed"; short dates (UTC); trimmed state line; shared group source; one-line claim meta + Observed chip; 52px phone label column + non-breaking names. TJ rule: relays/FHFHockey never shown as source; original-tweet links; relay chips removed. Lane A data note sent to Chef.
- Tests 48/48 after pass 1 changes. Commit 0c6590360 (passes 0–1).
- Pass 2 approved: panel-shell/panel-divider/accent-note tokenisation, visually identical. Commit 734b88a96. Relay-only rule fix (FHFHockey allowed): d47bd652d.
- Pass 3 approved: groups role=group (axe landmark-unique 0), $border-control on controls, 24px summaries. Focus sweep clean. Commit 590074499.
- Pass 4 approved: puck-drop wording, rail intro, Defense spelling, received-time dedupe. Commit 96765b807.
- Pass 5 (polish mode): only sign is canonical panel caps (kept); tabular-nums on times. Commit 34a29a6b4.
- Pass 6: lineup title Condensed 32/400. Sticky sidebar blocked by shared Container overflow-x:hidden; reverted; ticket to Chef → Lane C (overflow-x: clip on Lines shells). Re-apply `.rail { position: sticky; top: calc(68px + space-md); display:flex; flex-direction:column; max-height: calc(100vh - 68px - 2*space-md) }` + `.tabPanel { flex:1 1 auto; min-height:0 }` after their SHA (Chef: ticket sent to Lane C local_f0c5e29a). Pass 6 commit 5b742af8f.
- Pass 7: Derived chip folded into Projected blue (validator). Commit fab521e5a.
- Pass 6 sticky re-applied after Lane C 7af32ee7d (overflow-x: clip shells); verified pinned at 84px at 500px scroll on both routes.
- Pass 8 final sweep clean. Next: report SHAs to Chef. Nothing pushed.

| page \ pass | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
| /lines/TBL | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| /lines/line-combo/<id> | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
