# xG Approval-Grade Test Split Policy

Date: `2026-03-31`
Task: `tasks-xg-baseline-follow-ups.md` `2.3`
Scope: require a non-empty dedicated `test` split for future approval-grade benchmark artifacts.

## Policy

- approval-grade benchmark artifacts must have a non-empty dedicated `test` split

## What This Changes

Exploratory artifacts may still exist with:

- `train`
- `validation`
- `test = 0`

But those artifacts are now explicitly ineligible for approval-grade benchmarking.

Generated training and model artifacts now carry approval-grade eligibility metadata.

The benchmark runner can now be invoked in approval-grade mode and will fail if any supplied artifact does not meet this requirement.

## Current Blocking Rule

An artifact is not approval-grade eligible when:

- `testExampleCount <= 0`

Current blocking reason text:

- `Dedicated test split is empty; approval-grade benchmark artifacts require at least one test example.`

## Why This Rule Exists

The repaired rerun removed contract leakage, but the benchmark still remained too weak for approval because:

- there was no dedicated `test` split
- holdout positives were sparse
- important slices were under-covered

This step closes the first of those approval-grade gaps by turning the `test` split requirement into an enforceable contract instead of a soft warning.

## Consequence For The Next Steps

- future approval-grade benchmark attempts must be built on datasets that actually produce test rows
- the next remaining contract hardening step is minimum acceptance rules for positive coverage and slice coverage
