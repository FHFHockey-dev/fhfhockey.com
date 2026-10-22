# D4 harness independent review

- Scope: named harness/test matrix repair only; read-only source review and bounded preflight tests. No application audit, edits, SQL replay, initdb retry or sandbox bypass.
- Where: octoberBranch HEAD d3f057c6c849d5d5474bc912a6f461f617c65b15; input tasks/artifacts/d4-grants-2026-10-20/repair-2026-10-22.
- Start: current AGENTS and packet report/verification read; inspecting harness.py, test_harness.py, data_api_grants.sql and authority.
- Next: independently hash all 97 migrations, reconcile matrix with migration 90 and historical 66 failures, run six read-only preflight tests.
- Blocker: historical initdb denied by sandbox shmget; must not retry. Real SQL/PostgREST/hosted gates stay open.

- Checkpoint: all 3 candidate hashes and all 97 authority migration hashes match; direct preflight output equals the repair receipt (106 input hashes). Six provided preflight tests passed.
- Reconciliation: 1,596 table-operation assertions match migration 90 and saved v7 ACLs; exactly 64 table expectations plus denied promotion EXECUTE and sequence SELECT explain 66 old failures. No browser expectation change or privilege expansion.
- Failure gate: eight pure TAP classifier probes passed, including rejection and retention of all 66 historical failures; no exemption remains. Reviewer parser initially overmatched SQL statements, corrected its semicolon boundary; this was a review-helper issue, not a candidate finding.
- No SQL/initdb/network executed. End hash check stable. Next: save qualified acceptance and explicit unresolved runtime/PostgREST/hosted gates.

- Final: qualified local harness repair acceptance saved in tasks/artifacts/d4-grants-independent-review-2026-10-22/REVIEW.md with commands, reconciliation, hashes and blocked-runtime limits. All 106 source hashes plus candidate test hash and HEAD stable at delivery. Review complete; real SQL/PostgREST/hosted gates remain open. No initdb retry, SQL, app edit, production action or new approval attempt.
