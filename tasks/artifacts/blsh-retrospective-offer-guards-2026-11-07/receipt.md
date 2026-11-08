# BLSH retrospective offer guard receipt

Local candidate only on `octoberBranch`, based on HEAD `f123bf3d1f12bf40f5db3282e6a64c45377469c5`.

## Change

- `web/components/blshTrade/retrospective.ts` rejects empty sides, repeated IDs within either side, and an ID shared by both sides. Rejected offers retain their player rows but have an explicit reason and null give/receive totals and net.
- Evidence is read only through own properties. Inherited names such as `constructor`, `toString`, and `__proto__` are treated as missing evidence rather than causing a crash. Own entries with these names remain valid.
- FHFH Standard scoring restrictions, valid totals, and missing-player side withholding remain unchanged. Inputs and prototypes are not mutated; unknown IDs are not silently removed.

## Verification

- Passed: `npm test -- --run components/blshTrade/retrospective.test.ts` from `web/`, Node `v22.11.0`, 2026-11-07 at 17:28:58 UTC. One file, 22 tests passed; duration 439 ms. [Raw log](vitest.log). Only an existing `punycode` deprecation warning appeared.
- Passed: scoped `git diff --check` for both owned source/test files.
- Not run by this worker: full types, lint, browser, build, network requests, holdout/model work, deployment, or publication. Persistence owner owns final shared verification.

## Frozen file hashes (SHA-256)

- `web/components/blshTrade/retrospective.ts`: `9c5869cce3b6ce1ce961dab2ab9272917a84e5ed0a463e29e280ed5d4185fba1`
- `web/components/blshTrade/retrospective.test.ts`: `2b588c6bdd8a1ea49eea671414c13d5ee7061695f6451d3ca49f2da7f3b7c4d4`

Checkpoint and test result sent to the persistence implementation owner and independent reviewer. No further source edits are planned.
