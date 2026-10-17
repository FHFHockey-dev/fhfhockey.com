# Accepted local consumer checkpoint — October 16, 2026

Independent review closed R16/R17 and accepted the bounded default-off actual native consumer/outbox capability. The overall IFTTT goal remains incomplete. This checkpoint supersedes the pending/rejected consumer status in the historical v1/v2 handoff documents and the three “unimplemented” local consumer rows in `../offline-completion/REMAINING-PERSISTENCE-CONTRACTS.md`; those original documents and reports remain preserved.

## Exact accepted bytes and review

- Source/test/SQL manifest: `owned-source-v2-sha256.json`, **73 files**, SHA256 `9cba26d4e4617532c14d784b2d39038dce3ba9a085a0c337a0c68345532deefb`.
- Independent report: `../review-consumer-binding-v2/REVIEW.md`; its **122-file** artifact manifest SHA256 is `3300e05336fe8ed7f101f05f27e24c56d00dbaaed92dede01013c562e1f72b17`.
- Owner correction evidence: `correction-v2/checkpoint-artifacts-sha256.json`, **23 files**, SHA256 `5af94df3451b5c514c88c24c1b02b3f74996560777882aa7379124041bc04a4c`.
- After receiving the verdict, the implementation owner rechecked all 73 source pins, all 11 live/snapshot read-only dependencies and all 122 new reviewer artifact files. No application/test/SQL changes followed acceptance. Prior accepted 67 and runtime remain unchanged; reviewer also checked all 854 previous reviewer files plus the status addendum.

All review source holds are released. Keep the accepted bytes stable for any combined verification unless a concrete next increment requires a separately pinned change. No owner/reviewer compiler, test or private database remains active. Read-only forecast dependencies retain their existing ownership; no competing IFTTT source writer is known. Canonical octoberBranch checkout, dirty unrelated work and HEAD `a8f58de6178e282acd3a71851c66f4a56b119f14` remain preserved. No staging, commit, reset, synchronization, push or deployment occurred here.

## Implemented behavior and verified scope

The actual producer retains and reads back its exact parent. The real consumer prepares its capture/assignment/queue operations without dispatch, then an explicit existing action is bound to the exact original/report/parent, canonical/native effect and transition, complete supported plan and retained history/fence proof. Every permitted binding insert uses the same SQL validation, including direct service-role INSERT and ON CONFLICT. New application revalidates the source/report and schedule; actual capture, assignments, every queue scope, loaded news trigger and immutable native receipt commit atomically. Exact receipt recovery and outbox acknowledgment do not resend, including after later unsupported schedule changes or acknowledgment loss.

Acceptance covers **one confirmed injury/availability-out event and player, one retained original/report/derived parent, and at most ten future games with exactly two consistent FUT/PRE+OK schedule sides**. Discovery is bounded at 5,000 canonical rows. Unsupported statuses, versions and wider derivations hold. Typed nonempty history/fence fields are explicit supplied prerequisites, not independent proof of real production history. The SQL mirrors the current ten-scope/five-minute debounce contract and must be reviewed again if those consumer dependencies change.

Independent verification: **31 distinct cases passed: 30 actual private-PG and one default-off**. There were 36 executions because the unchanged five reviewer cases were also separately rerun; do not count that duplication as distinct coverage. The frozen 26-case suite, unchanged five-case block, five additional neighboring guards and scoped TypeScript all passed. All nine original CR042–044 assertions passed using their original clocks and explicit fixture prior-state/history inputs. Owner runtime lint passed; no aggregate compiler/build or browser suite was run for this correction.

Before repair, four independently reproduced invalid bindings committed actual native rows/receipts. After repair, omitted queues, relay attribution, contradictory source clauses and status-only direct bindings reject before native effects. Nearby tests also reject recomputed altered plans through ON CONFLICT, postponed/duplicate-side schedules, and source/report/schedule movement before apply. Partial actual history stays unknown. Original fixtures and assertion blocks were preserved.

The owner-only v1 atomic-probe replacement is disclosed in `correction-v2/CHECKPOINT.md` and independently checked in the review's `owner-evidence-disclosure-check.json`; the old owner artifact manifest is not represented as fully matching. The complete v1 results were restored byte-for-byte from retained results. All 109 independent v1 artifacts and all original failure evidence remain intact.

## Concise checklist and remaining gates

- [x] Durable extraction/qualification/global occurrence CAS, immutable history and held outbox: independently accepted local 59-file slice.
- [x] Full-parent conflict and lost-parent-ack recovery: independently accepted 63-file legacy producer slice.
- [x] Real native consumer binding, transactional partial-failure recovery, receipt reconciliation and outbox acknowledgment: independently accepted 73-file bounded slice, R16/R17 closed.
- [x] Default-off prospective registration/intake/capture/label/export/metric protocol prepared; historical discovery corpus remains development data.
- [ ] Full original 52-case acceptance. The unchanged pure runner still reports 41/43 cases, 194/196 assertions and nine pure persistence deferrals. Separate accepted durable/parent/consumer mappings do not rewrite that report or imply general consumer equivalence. Original ambiguous CR011/CR051 and separate versioned positive fixtures remain distinct.
- [ ] Raw IFTTT receiver-job and external queue/transport acknowledgment contracts; these are beyond the reviewed native consumer/outbox boundary. A next bounded local task can join the existing receiver/job lease and exact consumer receipt paths using disposable storage/faults, with no activation or live receipts.
- [ ] Authentic intake/source and dated identity/history/fence coverage, exact deployed schema/RPC/trigger/ACL compatibility and migration authority reconciliation. Earlier catalog reads are terminal; no additional hosted read is authorized implicitly.
- [ ] Genuine future cohort activation, natural sample capture, complete labels and performance metrics. No authentic future results exist from this work.
- [ ] Separate operational approvals for DDL, deployment/caller/flag/cohort activation, ingestion, dispatch, replay/correction, compensation or publication. None was performed or is pending execution here.

## Exact staged migration package for later coordination

All four SQL files remain task-local, outside the active migration tree. Their required dependency order is the sequence below, **not their timestamp-name sort order**. The migration inventory owner must reconcile names/order/deployed prerequisites before any publish request; this document does not authorize moving or applying them.

| Order | Staged SQL | SHA256 |
| --- | --- | --- |
| 1 | `../migrations/20261016024711_tweet_claim_registry.sql` | `7570300e3e6dfc6a899e2296fa20483ee02ad206c1e0e1f3a966ba1d29847ea7` |
| 2 | `../next-increment/20261016073000_tweet_claim_qualification.sql` | `510eae121f939ffe4e2c3ebd953df1d5206f5e423cdbd014c88e43812a4906bb` |
| 3 | `../durable-occurrence-increment/20261016044953_tweet_claim_occurrence_identity.sql` | `3a8815e5f8f9d6d49038dfa77c0ba7dfc09014b1775efffb70bf1f268c3ae16a` |
| 4 | `20261016060900_tweet_claim_forecast_delivery.sql` | `b030ca1b718cca895095ef798a494f085a197846c8833ef58e3a515a1654df00` |

SQL4 has two append-only tables and 11 functions/helpers/trigger functions. Current source remains uncommitted and excluded from the previously completed production release; there is no approved IFTTT deployment candidate SHA. The existing `ROLLOUT-PROPOSAL.md` and `../APPROVAL-PACKAGES.md` describe later action classes, with the exact current four-file package and reviewed consumer scope above superseding their older two-file/seven-function or unimplemented-consumer descriptions. No one package authorizes another action implicitly.
