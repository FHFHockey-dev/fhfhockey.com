> Compiled 2026-10-20 from the session transcript by the orchestrator's helper; not written by the session itself.

# Diary: v2-prerollout-gates (local_c44fc688-5f44-44a9-adfe-49020dba5503)
Session title: "FORGE v2 pre-rollout gates patch (A-13 to A-18)". 541 messages, 55 turns, one task. Status when read: idle, last turn done.

## 1. Scope
- Task: one more ordered patch (06) for the staged native FORGE v2 stack that fixes audit findings A-13 to A-18 (`tasks/artifacts/sprint-audit-2026-10-19/CROSS-CHECK-AUDIT.md`), without editing frozen files in the real checkout.
- Why: native FORGE v2 (fresh means, rolling 14-day participation, Yahoo universe) is staged as patches to apply after the 2026-10-20 17:00Z freeze; TJ approved the v2 policies; first rolling issuance planned around Oct 27. A 10-19 audit found six gates that fail open or are missing.
- Gates: A-13 `universe_previous_required` when `universeThresholds` is on and no previous universe exists; A-14 offline bound check `participation_inputs_exceed_materialization_bound` (62 skaters x 20 + 7 goalies x 40 = 1,520 > limit 1,500); A-15 new `capture-v2` stage planning the rolling capture from the universe's clubs, and the means CLI reads `universe.json`; A-16 restore v1's `capture_differs_from_plan` in `inputs-v2`; A-17 means freshness and binding (cutoff on run date, complete plan, coverage equals universe or an explicit approved ceiling); A-18 pin approval ref `tj-standing-approval-2026-10-17:forge-daily` and per-policy terms hash, `fresh_means_policy_template_ambiguous` on duplicate templates.

## 2. Where
- Branch octoberBranch for the artifacts only; all code work was in a scratch copy under `/private/tmp/claude-501/` (not persisted for the next session).
- Artifacts (committed on octoberBranch in 5ae65fc13): `tasks/artifacts/forge-v2-prerollout-gates-2026-10-19/06-v2-prerollout-gates.patch`, `README.md`, `SHA256SUMS`. Patch sha256 `6e24aaaaa05ee016585aa2c54ed8cb2c8c79c86809f6ee311308a10e5092766e` (I re-computed it: matches SHA256SUMS). 8 files, +428/-22, 255 added lines are tests.
- Shared-notes copy: `forge-v2-prerollout-gates-a13-a18-2026-10-19.md`.
- Apply order (from the README): v2 01, 02, 03, 04 (`forge-v2-integration-2026-10-18/`, correct 03 sha `806ef0ec...c539`), then 01b, 03b, 02 from `forge-target-scope-fix-2026-10-19/`, then 06. Patch 05 (`forge-v2-target-scope-fix-2026-10-19/`) is superseded by 03b and not used.

## 3. State
- Patch written; NOT applied to the real tree. Apply only after 2026-10-20 17:00Z (it edits frozen files such as `forge-daily.ts`). Chef's register lists it as an earmarked (post-freeze) item, "Not in R6".
- Checks in scratch only: patch applies cleanly after the rest of the stack; focused Vitest 22 files, 998 passed/7 skipped; full `tsc` exit 0; ESLint on the 8 changed files exit 0. Without 06, all 15 new tests fail and the 12 existing ones pass; with 06, all 27 pass.
- NOT run: the offline replays (they read the private folder); they will stop until updated because they use a placeholder approval ref and build `means.json` without plan status.
- Base blobs in the README come from HEAD b47c512fb; octoberBranch has since moved (rebuild, R5/R6 syncs), so they must be re-checked right before applying (unverified whether they still match).

## 4. Next
- Stated milestones: before the first live v2 run, A-16, A-17, A-18 and the means-CLI change (in practice all of 06, one patch); before enabling `universeThresholds`, A-13; before `rollingFirstIssuance` on Oct 27, A-14 (plus TJ's decision) and A-15.

## 5. Blocked / needs TJ (decisions the session raised)
1. A-14: the gate stops the run but does not fix it. Recommended: split into two materializations (skaters and goalies); the request is already 40 MB of the 64 MiB byte limit, so raising the count limit alone would likely fail on bytes. Alternative: shorter horizon, which changes the approved "next 20 games".
2. A-18: pins assume all 6 policies were approved with uses assignment, totals, comparison, conditionalTieBreak; the session could not read the private templates. If different, the first live `outputs-v2` fails safe (stops).
3. A-17: is any standing ceiling acceptable, or must an approval ref accompany every smaller means set?
4. A-15: boxscore budget is about 100 boxscores, just inside the default 120 requests / 2 MB limit.

## 6. Insights
- After applying 06, live commands change: `outputs-v2 --approval-ref` must be exactly `tj-standing-approval-2026-10-17:forge-daily`, and `means assemble` must be re-run with the patched CLI against a complete final plan.
- The rolling parent count sits close to its 1,024 limit and is not pre-checked (noted in the README).
- Gotcha: zsh does not have bash's `PIPESTATUS`; a verify run printed no exit codes and tsc/ESLint had to be re-run without pipes to get real codes. Full tsc here needed `NODE_OPTIONS=--max-old-space-size=12288` under the heavy lock (`/private/tmp/fhfh-heavy.lock`).
- A test using the real clock failed because capture stamps receipts with `Date`; the fix was faking `Date` in that test.
