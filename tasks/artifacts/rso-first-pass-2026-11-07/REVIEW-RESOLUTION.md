# RSO independent review corrections

Candidate v1: `50766b2d31d6f5a6b9cbbcc3565be91152080c9e`.
Candidate v2: `4ba9b5dd1c6feb613f2f8e526fb280bb4b35c54e`.

## Findings and correction

1. A non-reserve O/IR roster member was excluded before missing started-game lock certification, permitting a later player to take a potentially locked slot. The correction gathers started-game occupants regardless of injury status. Explicit active and bench locks remain authoritative; unstarted out players and reserve occupants remain excluded.
2. A future acquisition effective exactly at puck drop was counted for the started game. Game-time ownership now requires strictly earlier effective time. The transaction may remain legal, but the game is not credited.

The focused delta is `REVIEW-CORRECTION.patch`, affecting only planning.ts and planning.test.ts. Canonical application files remain untouched.

## Regression evidence

Nine added cases cover O/IR with missing, explicit active and explicit bench locks; acquisition one millisecond before, exactly at, and one millisecond after puck drop.

- Before runtime correction: 3 failures, 6 passes. The O and IR missing-lock cases and exact-start acquisition case reproduced the findings.
- After runtime correction: all 9 pass.
- Full revised suite: 2,301 tests in 104 files pass; full TypeScript and scoped ESLint pass. Chromium verification is recorded in HANDOFF.md and its receipt.

See `review-regressions-red*.json/log`, `review-regressions-green*.json/log`, and current `CHECKS.json`.

## Independent re-review

The same reviewer independently executed ten in-memory cases under the outbound guard: O/IR × missing/active/bench locks; acquisition -1 ms/exact/+1 ms; and an unstarted out-player exclusion case. All passed. The reviewer also rechecked all 16 source/blob pins, full patch checksum and reconstructed v2 tree. Both findings were closed, with no further actionable issue found in the focused correction. This was a focused code and regression review, not live league acceptance or release authorization.
