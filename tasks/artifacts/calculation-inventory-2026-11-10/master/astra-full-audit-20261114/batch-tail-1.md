# Remaining styles, scoreboard tests and raw-game types

Seven complete frozen `89da739cb` reads / 6,596 lines: five stylesheets, `web/tests/api/forge-scoreboard.test.ts`, and `web/types/nhlRawGamecenter.d.ts`. No source edit, supplied Vitest, app build, browser or production operation. `tail1-checks.json` records the in-memory Sass and static version checks.

## AFULL-RAWTYPE1-01 — P2: declared event rows still claim strength v1

- **Location/claim:** `web/types/nhlRawGamecenter.d.ts:205` declares `NormalizedEventInput.strength_version:1`, inherited by the return type of `normalizePbpEvents`. The current normalized scope and implementation use strength v2.
- **Evidence/scenario:** frozen implementation `web/lib/supabase/Upserts/nhlRawGamecenter.mjs:7,727` defines 2 and assigns that constant to every normalized event. The declaration's own exported constant and scope at lines 10 and 242 already say 2. A consumer trusting the declared event type therefore receives a runtime 2 where the type permits only 1. Static frozen comparison passed; no raw ingestion was run.
- **Fix/readers:** bind the input row field to the exported current strength literal, then extend the existing raw-layer type/contract check. Affects typed normalizer callers and version discrimination; this is a declaration mismatch, not proof of a wrong stored row.

Styles reviewed include all responsive branches, sticky columns, horizontal scrolling, overflow/ellipsis, numeric font settings, color bands, missing/stale/zero states and chart/bar geometry. LinePairGrid intentionally suppresses secondary phone statistics per its documented owner decision; Rankings intentionally shows compact caveat dots with accessible names/tooltips and retains horizontal scrolling on phones. No additional source-proven numeric defect was found. Actual clipping/layout and those accessibility names still require the approved page pass; this is not visual acceptance.

`vars.scss`'s rank-to-hue function is inventoried separately: it clamps rank, uses a nonzero denominator, and maps first to green/last to red. Exact frozen Sass compiled in memory verifies lower/upper clamps and max-rank-one without division by zero. Decorative palette/channel/mixin arithmetic is not a statistical percentile calculation. No stylesheet or generated CSS was written and no CSS-module edit check was needed.

The scoreboard test covers settled-only date/source pools, conditional versus unconditional basis mismatch, partial independent-universe coverage, default-disabled market reads, paired market proper scores, unknown/invalid numerics, empty results and invalid methods/parameters. Its mock ignores order/range and supplies small fixtures, so it does not prove pagination or hosted cost. All assertions were read; none were run here. The declaration file's retry/timeout/count/nullable payload contracts were compared with the already-audited raw-layer boundaries; existing runtime findings remain in their original reports.
