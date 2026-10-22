# NST reverse calendar date repair

- Scope: preserve requested YYYY-MM-DD values while building reverse queues; add focused UTC regressions and prepare a read-only §5.3 catch-up recipe.
- Where: `octoberBranch` at `9695a2fe6`; assigned route/test only, plus this diary and `tasks/artifacts/codex-2026-10-20/NST-DATE.md`.
- Settings: Chef verified this worker session as GPT-6 Luna / low. Initial target diff was clean; shared checkout contains unrelated dirty files that remain untouched.
- State: reverse formatting fix and three UTC tests are in place; §5.3 read-only SQL proposal is written in `tasks/artifacts/codex-2026-10-20/NST-DATE.md`. Initial full-file run: 7 passed, 3 failed; two existing expectations conflict with D1's concurrent one-date pacing. The three new reverse tests passed in the filtered run (3 passed, 7 skipped); `git diff --check` passed.
- Next: hand off for Chef review; full test file must be rerun after pacing expectation integration.
- Constraints: no production reads, route calls, or NST requests; no staging/commit; preserve D1 pacing ownership.
