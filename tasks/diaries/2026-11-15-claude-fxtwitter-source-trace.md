# 2026-11-15 · Claude · FxTwitter source-coverage trace (Chef, single lane)

- **Scope:** trace one retained line or goalie post end to end, offline. Check the xPollerHealth correction. Time box:
  20 min. No X/Browserless, production DB, capture-key, schedule or deploy actions.
- **Where:** octoberBranch. f42acc8aa (first fix), cd5ab85b2 (opposite-side gate, version `2026-11-15.1`), 65b620299 (chaining guard, claim test); not pushed.
  This diary stays uncommitted.
  - `web/lib/sources/tweetPlayerEvents.ts`: goalie "vs" coordination, +4/-1 lines.
  - `web/lib/sources/tweetInterpretation.test.ts`: one regression test.
  - Report: `tasks/artifacts/fxtwitter-source-trace-2026-11-15/GAP.md`.
- **State:** confirmed gap, fixed locally.
  - In "A vs B in goal", only B was confirmed. A now is too; skaters are unaffected.
  - The test fails on HEAD and passes with the fix.
  - 10 event-consuming test files: 589 passed, 0 failed. Scoped eslint: exit 0. Typecheck: exit 0.
  - The production roster is league-wide. The consumer filters events by team, so the VGK row is safe.
  - xPollerHealth correction: on master since 0e6fd60a8.
- **Follow-up (review):** f42acc8aa let two same-team goalies both be confirmed. Now "vs" shares only across opposite
  sides of the bound game; same-team and unresolved regressions added; version bumped; old/new report coexistence tested.
  108 files / 3008 tests passed; eslint and typecheck exit 0.
- **Next:** TJ decides release. Whether a BUF row exists in production is unproven (needs a production read).
- **Gotchas:**
  - FORGE pregame packets are blind to tweets while compute is off.
  - Use the existing scratch-test approach for offline traces. Never set GIT_DIR.
