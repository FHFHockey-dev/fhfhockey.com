# Integrated candidate v3 — historical, changes required

Review v3 completed and released all 41 pins. It accepted R1–R7 within tested scope and required R8 partial-schedule-cache and R9 quoted-post-ID repairs. Its exact report/failures remain in `../review-v3/`. The corrected candidate is described in [IMPLEMENTATION-V4.md](IMPLEMENTATION-V4.md); review-pending statements below record the earlier checkpoint.

Frozen manifest: [owned-source-v3-sha256.json](owned-source-v3-sha256.json), **41 source/test/SQL files**, SHA256 `13a20c3f995e20a299e0f51d05fa871e81e125814aa788b3b2864719c927c903`. All 41 hashes were checked again after freezing. Canonical branch is `octoberBranch`, base HEAD `a8f58de6178e282acd3a71851c66f4a56b119f14`; changes are uncommitted. No production candidate exists.

Reviewer owns only `../review-v3/`; all 41 paths remain pinned until its release. Original `../review/` and `../review-v2/` reports, failing logs and frozen copies remain intact. The v2 implementation note and manifests describe historical rejected candidates.

## Changes since v2

- **R5, global material rebind:** a durable occurrence-meaning ledger records exact lexical occurrence meanings across scopes. Different scope/fact/modality for one occurrence becomes a global dispute, blocks both affected scopes' reservations, and cannot be cleared by an A–B–A replan. Original observations and qualification versions remain immutable.
- **R6, retained canonical state:** qualification reads the durable prior canonical adapter state explicitly. Exact replans reuse immutable derivations, occurrence allocations, reservation clocks and effects, including `plannedAtAsOf`. Newly proved identity versions append to that state. Previously seen legacy effect rows remain in the evidence ledger even if a later current-table read omits them. Rejected canonical changes remain held exceptions.
- **R7, incomplete history:** only explicit `status: complete` with dated retention/writer-fence coverage can establish clear history. The latest incomplete/unknown audit stays unresolved; it cannot fall back to an older complete entry.
- **Actual source-hint integration:** the shadow storage hook uses dated verified single-team source-directory coverage only to select a candidate. A read-only exact-game roster RPC must independently prove source-time player/team/game/league/role identity. Reparsing is automated; unsupported or ambiguous events remain exceptions. Explicit league/team conflicts are preserved. Metadata identifies directory context as `bindingAuthority: false`.
- **Actual bounded raw intake:** both processing routes filter a configured future cohort's pending receipts and call a shared serialized admission RPC before roster loads, enrichment, leases or publishers. A pass admits at most 25 candidates; the shared cohort budget covers both raw tables. Before start, after end or after exhaustion, routes return a shadow stopped result and retain pending raw receipts. There is no automatic legacy fallback or replay.
- **Broader legacy inventory:** 14 concrete sinks now include `news_feed_items`, the actual `player_forecast_inference_queue`, lineup assignments and claim relations. Exact aliases, source receipts, matching rows and payload fingerprints are retained. Missing schema, capped reads, present effects or incomplete history hold action. This conservative detector is not authenticated adoption of every legacy receipt or proof of a consumer's idempotency.

R1–R4 full-payload retry, public original-source consistency and causal capture-clock fixes remain. The reviewed r3 registry is byte-identical; its adapter retains only two import substitutions. Extraction version is `2026-10-16.4`.

## Verification actually run

| Check | Result | Evidence |
| --- | --- | --- |
| Focused extraction/evidence/lineage/hint/intake/evaluation/public DTO/DOM and both route files, including original seven reviewer assertions | 132/132 passed, 12 files | `v3-local-focused.log` |
| Actual registry and qualification RPC/storage tests with both staged migrations | 30/30 passed, 2 files | `v3-local-postgres.log` |
| Aggregate TypeScript, 8 GB Node heap | Exit 0 | `v3-local-tsc.log` (empty, no diagnostics) |
| Scoped ESLint | Exit 0 | `v3-local-eslint.log` (empty, no diagnostics) |
| `git diff --check` | Passed | Lead execution result |

Postgres ran in disposable PG17 clusters with private Unix sockets and TCP disabled. Hosted database environment variables were scrubbed; clusters were stopped and removed. Tests exercise the actual replacement context/commit RPCs and storage hook, concurrency/CAS, rollback, commit/settle/raw-status acknowledgement loss, owner fencing, global disputes, retained canonical cutoff, legacy partial effects, incomplete history, source-time roster hints, invalid capture rejection and shared raw count/time bounds. Dated identity and history audits are synthetic fixture evidence only.

Independent v3 review has reported 135 focused assertions and the current 14-case qualification PG suite passing. It is completing bounded reruns. One legacy test fixture can mismatch Eastern game dates within the minute after midnight because it combines `Date.now()-60s` publication with the current day's end; the reviewer retained the initial failure and is rerunning only the affected file outside that boundary. This is a test-fixture limitation under review, not evidence that the application should admit a mismatched game date. No independent acceptance is claimed yet.

No full unit suite, browser execution, hosted schema/history read, authentic inbound source check, live pipeline, actual sink dispatch, build or deployment was run. Historical fixture names containing `holdout_candidate` do not establish an untouched holdout. Zero real future samples, labels or performance scores are claimed.

## Remaining gates

1. Independent v3 findings and release; fix any reproduced implementation or fixture defect, then pin the exact correction before another bounded review.
2. Genuine deployed schema, dated official identity availability, exact applicable sink/writer inventory and retention/fencing evidence. Mutable empty tables alone cannot clear history. No production audit row is seeded.
3. Authenticated natural DFOFantasy/NHL_Rosters configuration/activity/receipt evidence under a separately approved finite read budget.
4. A fresh future cohort registered before its start, approved raw intake/count/time bounds, authenticated export and complete adjudicated labels. The discovery corpus is development data.
5. Reviewed specific consumer idempotency/readback contracts and a separately approved exact release candidate. All outbox candidates remain held; ingestion never calls the generic fixture delivery adapter. No exactly-once external-effects guarantee.

Prepared SQL remains outside the active migration tree. Production reads/DDL, migration promotion, deployment, environment changes, live processing, replay/correction, dispatch, credentials and cron activation require their own approvals. See [../APPROVAL-PACKAGES.md](../APPROVAL-PACKAGES.md).
