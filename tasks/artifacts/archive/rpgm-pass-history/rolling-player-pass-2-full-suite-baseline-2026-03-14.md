# Full Suite Baseline

Date: `2026-03-14`
Task: `1.2`

## Verified Command

- `npm test -- --run`

## Baseline Assertion

This command now executes source Vitest suites only.

It no longer discovers compiled `.next/server/**/*.test.js` artifacts, and it is now the trustworthy default full-suite verification command for the current pass.

## Passing Baseline

- test files: `51`
- tests: `369`
- result: `pass`

## Notes

- Deprecation warnings for `punycode` still appear during the run, but they do not affect suite discovery or pass/fail status.
- The intentionally logged error in `update-rolling-player-averages.test.ts` remains part of a passing negative-path test and is not a suite failure.
