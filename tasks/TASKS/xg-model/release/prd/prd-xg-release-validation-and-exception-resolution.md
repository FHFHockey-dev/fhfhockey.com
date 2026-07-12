# PRD: NHL xG Release Validation, Remediation, and Exception Resolution

## Introduction/Overview

This initiative owns the correctness and policy gate between the NHL API normalization/parity foundation and any downstream xG training or production adoption. It repairs true raw-identity, parsing, shift/on-ice, and parity bugs; records explicitly approved NHL-correctness divergences from frozen NST behavior; produces a repeatable versioned release-validation artifact; and issues an auditable training-use verdict.

The PRD pairs two existing source lists: `tasks-xg-release-remediation.md` and `tasks-xg-release-exception-resolution.md`. Earlier validation correctly failed while exceptioned drift was indistinguishable from unresolved blockers. The resolved contract must keep raw mismatches visible while separating true blockers from approved exceptions; it must never force a pass or hide disagreement.

## Goals

1. Preserve upstream NHL event identity exactly through raw and normalized layers.
2. Fix verified parser, inclusion, shift, TOI, strength, zone-start, and on-ice attribution defects.
3. Distinguish true correctness bugs from documented NHL-vs-frozen-NST methodology differences.
4. Produce repeatable release validation with explicit versions, data scope, environment, commit, samples, results, and evidence.
5. Report raw failures, approved exceptions, and true blocking failures separately.
6. Issue a dated training-use verdict and permit model work only when no unapproved blocker remains.
7. Preserve release evidence and exception provenance so later changes can invalidate or re-test assumptions safely.

## User Stories

- As a model developer, I want a trustworthy release verdict before training so model quality is not built on corrupted events or hidden parity bugs.
- As a reviewer, I want every mismatch visible and classified so approved methodology differences are not confused with implementation defects.
- As an operator, I want one repeatable command and structured artifact that identifies versions, scope, partial failures, and exact next actions.
- As a future maintainer, I want exceptions tied to metrics, families, evidence, and policy decisions so they cannot silently expand.

## Functional Requirements

1. Normalized `event_id` must preserve the upstream raw NHL `eventId`; validation must compare identity as well as row counts.
2. Representative re-ingestion must prove raw archival, normalized rows, event identity, ordering, and version metadata remain aligned.
3. Exact-subset validation must cover individual shots/attempts, faceoffs, hits, takeaways/giveaways, assists/points, penalties, TOI, strength segmentation, and on-ice count/rate families.
4. Each mismatch must be traceable to parsing, event inclusion, player credit, shift/stint reconstruction, strength boundaries, on-ice attribution, legacy data shape, or an approved methodology difference.
5. True bugs—including the corrected zone-start overcount—must receive focused regression tests and post-fix rerun evidence.
6. Frozen NST conventions may be retired only through an explicit policy record showing why the NHL-derived behavior is more correct or supportable.
7. Approved exceptions must specify family, metric, scope, rationale, evidence artifacts, and whether they affect training, evaluation, or publication.
8. Exceptions must remain visible in raw validation counts and samples but must not count as training-use blockers when the approved policy says they are acceptable.
9. Any mismatch outside an approved exception must remain a blocker; approximate families must not be promoted into exact parity by tolerance alone.
10. Null-versus-zero comparison rules must be explicit per metric. `NULL` and `0` may compare equal only when the frozen source semantics demonstrate unset exact-count values represent zero, with regression coverage.
11. The release runner must capture parser, strength, feature, parity, and validation-contract versions; environment; season/sample range; game IDs/counts; commit SHA; command/config; and artifact references.
12. The release report must separate raw failures, true blocking failures, approved-exception failures, pass counts, sampled evidence, and unresolved infrastructure/data gaps.
13. Per-game results must expose success/failure, stage, failure class, status when available, rows written, and whether the batch is partial.
14. Retryable upstream failures may retry with bounded backoff; deterministic parser/schema/config failures must fail fast, and systemic failures must stop noisy batch continuation.
15. Raw payloads must remain archived when downstream normalization/validation fails.
16. A release batch is successful only when required raw payloads, normalized rows, validation checks, and exception reconciliation all complete for the intended sample.
17. The blocker review must list every unapproved failure or state explicitly that none remain; absence of a listed blocker without a complete run is not evidence.
18. The dated verdict must be one of satisfied, blocked, or satisfied-with-approved-exceptions and link the exact validation artifact and policy evidence.
19. Baseline/model tasks may resume only after a satisfied verdict; an older failed verdict must remain historical rather than being overwritten.
20. Production reader cutover is separate from training-use approval and requires explicit surface/storage/consumer decisions plus relevant release verification.
21. Every checked source task must be reconciled against current code, tests, and dated artifacts before its parent is closed; child checkmarks alone do not close parents.

## Non-Goals (Out of Scope)

- Training, selecting, calibrating, or promoting a model inside the release-validation task itself.
- Forcing exact NST parity when a documented NHL-derived method is intentionally authoritative.
- Hiding approved exceptions from reports or converting broad unknown drift into exceptions.
- Treating sampled validation as proof for untested versions or data scopes.
- Switching production readers solely because training-use approval passes.
- Deleting historical failed reports or verdicts.

## Design Considerations

- Validation artifacts should lead with a concise verdict and counts, followed by blocker/exception tables and reproducible metadata.
- Raw failures, approved exceptions, and blockers need visually distinct labels that are not color-only.
- Operator output must give exact rerun and remediation paths without leaking credentials or raw sensitive configuration.
- Historical artifacts should be append-only and date/version named.

## Technical Considerations

- Current implementation centers on `run-nhl-xg-release-validation.ts`, `nhlXgValidation.ts`, parser/raw ingest, parity metrics, on-ice attribution, and shift stints.
- Exception classification must use stable metric/family identifiers rather than free-text substring matching alone.
- Release reports should be generated deterministically from machine-readable results even when a Markdown artifact is the human review surface.
- Complete validation reads must use verified pagination/server-side queries and record the covered row/game counts.
- Version changes invalidate prior verdict applicability unless compatibility is explicitly proven.

## Success Metrics

- Raw-to-normalized event identity validation passes for the intended release sample.
- Every exact-family mismatch is fixed, an approved scoped exception, or an explicit blocker.
- Release output separates blocker and exception counts deterministically and tests cover interpretation rules.
- The formal rerun includes all required metadata and produces a dated artifact plus blocker review.
- The final training-use verdict links the exact run and contains no hidden unapproved blocker.
- Source remediation and exception lists, policy docs, validation checklist, and master ledger agree.

## Open Questions

1. Any new exception family discovered during rerun must be reviewed as a material release-policy decision; it cannot inherit approval by similarity.
2. Production cutover ordering remains a later explicit decision even after training-use approval.
3. If live release validation requires credentials or production data not accessible to Codex, the exact command/output manual-verification protocol applies.
