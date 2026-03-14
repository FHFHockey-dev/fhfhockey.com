# Verification Script Normalization

Date: `2026-03-14`
Task: `1.3`

## Problem

The verification script surface in `web/package.json` mixed:

- one implicit full-suite command
- several rolling-player `check:*` commands

but had no explicit top-level distinction between:

- source test verification
- targeted rolling validation
- broader rolling validation sweeps

That made the workflow harder to communicate and easier to misuse during closeout.

## Changes

Added normalized script entrypoints:

- `npm run test:full`
  - source-only Vitest full suite
- `npm run verify:full`
  - alias for the full-suite verification path
- `npm run verify:rolling-player:targeted`
  - current targeted rolling validation path:
    - freshness
    - family reconstruction
- `npm run verify:rolling-player:extended`
  - broader rolling validation sweep:
    - targeted validation
    - coverage
    - context labels
    - disputed metrics
    - optional additions

Existing `check:rolling-player:*` scripts remain in place as low-level building blocks.

## Verification

- `npm run verify:full`
  - passed
- `npm run verify:rolling-player:targeted`
  - executed successfully and surfaced current retained-player freshness / backfill blockers as expected

## Result

- full-suite verification is now explicit and separate from rolling validation
- rolling validation has a clear targeted entrypoint for frequent use
- the script surface is more organized without adding a large number of new commands
