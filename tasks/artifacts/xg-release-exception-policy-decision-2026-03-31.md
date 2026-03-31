# XG Release Exception Policy Decision - 2026-03-31

## Scope

This artifact records the decision for task `1.2` in `tasks/tasks-xg-release-exception-resolution.md`.

Question decided:

- should approved-exception classes still count as blocking parity failures in the formal release artifact?

## Decision

- `not blocking`

## Meaning Of The Decision

If a parity mismatch falls into a class that is already covered by an explicit approved-exception document, it should:

- remain visible in the validation artifact
- remain documented and versioned
- not count as a release-blocking parity failure by itself

## What Still Counts As Blocking

The following still count as release-blocking parity failures:

- any mismatch class not covered by an approved-exception document
- any mismatch where normalized NHL rows are wrong
- any mismatch where parity output disagrees with direct included-event reconstruction from the same normalized rows
- any mismatch caused by inconsistent inclusion or classification rules

## Why This Decision Was Chosen

This decision is consistent with the already adopted project policy:

- NHL-derived correctness wins over frozen NST edge-case behavior

It avoids treating already-adjudicated NHL-correctness divergences as if they were still unresolved bugs.

## Consequence For The Validation Contract

The formal release-validation runner and release artifact now need to distinguish between:

- true blocking failures
- approved exceptions

They should not collapse both into a single `FAIL` conclusion.

## Consequence For Training Use

This decision does not automatically approve the release gate.

It changes the interpretation contract so the next formal release artifact can answer the right question:

- are there any true blockers left after approved exceptions are separated out?
