# Vitest Artifact Exclusion

Date: `2026-03-14`
Task: `1.1`

## Problem

The full verification command:

- `npm test -- --run`

was failing because Vitest was discovering compiled `.next/server/**/*.test.js` artifacts as source suites.

That created false failures such as:

- `No test suite found`
- compiled-server module errors unrelated to the source tests
- noisy unhandled rejections from compiled artifacts

## Change

Updated [vitest.config.mts](/Users/tim/Code/fhfhockey.com/web/vitest.config.mts) to explicitly exclude compiled output directories, including:

- `.next/**`
- `dist/**`

This keeps full-suite verification limited to source test files.

## Verification

Command:

- `npm test -- --run`

Result:

- `51` test files passed
- `369` tests passed
- no compiled `.next` suite discovery failures remained
