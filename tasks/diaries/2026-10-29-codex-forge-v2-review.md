# FORGE v2 independent review

- Scope: read-only review of core contracts/data/schedule/evaluation/model/qualification/storage and migration against approved PRD. No protected data, remote actions, code edits, or commits.
- Where: canonical octoberBranch, HEAD 18e52a481589a314dc6a67663dd98d1fa8c48454. Source hashes frozen in tasks/artifacts/forge-v2-implementation-2026-10-29/independent-review.json.
- Start: read repository instructions and PRD; reviewing actual implementation and tests in two bounded discovery passes.
- Checks: source inspection only so far; no test execution.
- Next: inspect chronology/publication/qualification invariants; promptly send substantive defects to lead.
- Evidence boundary: scientific acceptance requires real source audit and frozen independent protocol; synthetic implementation checks cannot qualify the model.

- Checkpoint: found five substantive issues; sent each to Chef promptly. Confirmed two storage failures in a private PostgreSQL 17 cluster: subtransaction commit-proof bypass and late-commit pagination omission. Server removed and shared heavy lock released. Initial vite-node invocation failed outside project root; installed esbuild bundling resolved it.
- Handoff: independent-review.json records findings, original source hashes, reproductions, scientific evidence blockers and remaining scope. Source-only findings: unknown-time play-begun reopening, future participation-bin replay, future prediction hashes in frozen qualification scope.
- Checks not run: application suites, remote calls, protected data reads, deployment/migration publication. No implementation edits or commit.
- Next: Chef repairs and reviews focused regression evidence; any rereview must identify repaired hashes. Scientific acceptance remains unpassed.

- Follow-up start: independently recheck five repairs and final pipeline/API/history guards against current frozen hashes in review-followup.json. Root owns changes; no heavy checks while other agents active. Known API profile-accountability and DTO sanitization changes excluded from duplicate findings.

- Follow-up checkpoint/handoff: all five original defects addressed in source; relevant regression bodies inspected, not executed. New F1 material-refresh revision equality reported and immediate source repair observed. New F2 archived-game initial history lookup remains reported. Native claimed-publication SQL placeholder issue flagged to Chef for confirmation during already-running native check. No heavy checks or code edits. Separate review-followup.json preserves initial/report hashes and concurrent drift.

- Follow-up final bounded inspection: F2 now uses readGame to find retained target context independently of active queue. Receipt SQL now explicitly types former parameter holes. All five original findings and both newly reported integration findings are addressed in source; no remaining blocker found in reviewed scope. Runtime confirmation remains Chef-owned; no independent test rerun or scientific acceptance claim. Final hashes recorded.

- Final seam review start: capturePreparedLedger append-only lineage/refusal and unclaimed publish stamp denial only; waiting for scope reconciliation helper readiness before reading that seam. No heavy checks.

- Final seam disposition: explicit worker readiness received. Reviewed scope reconciliation proposal and CAS-first orchestration, deterministic replacement plans, closure/reentry snapshot lineage, unclaimed queue-stamp refusal, repaired distinct lock/event IDs, and API scope/clock cutoff guards. No remaining actionable source blocker found in these bounded additions. Worker reports 16 pipeline + 7 integration tests and scoped TS/lint passed; not rerun by reviewer. Final seam hashes recorded; Chef owns final native/API checks.
