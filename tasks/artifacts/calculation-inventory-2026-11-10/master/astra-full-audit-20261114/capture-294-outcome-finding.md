# Separate successor finding: witness after terminal outcome

Candidate `29451c57304866d54abd2a3302625f0696472ab0`; source-confirmed control flow, PostgreSQL interleaving not executed.

## CAP-294-02 — P1: a qualified witness can arrive after a terminal nonqualified outcome
- **Claim checked:** exactly one terminal outcome stays consistent with the claim's custody state.
- **Location:** `supabase/migrations/20261115000000_forge_pregame_capture_custody.sql:251–293,350–369`.
- **Evidence:** exact candidate SQL. `record_witness_v1` validates hashes and supplied historical acknowledgement/read times, then inserts without locking the claim or checking an existing outcome. The sweeper locks the claim and records `saved_without_valid_witness` when an artifact exists without a committed qualified witness. Source unchanged candidate→currentHEAD at review.
- **Minimal scenario:** packet saved and final committed readback completed before deadline00:00; the valid witness request is delayed. At00:01:01, sweep(grace60) observes no witness and commits immutable `saved_without_valid_witness`. The delayed witness call then passes its historical time checks and inserts `qualified`. The database now reports witness qualified and outcome saved_without_valid_witness for the same claim. The runner's later qualified outcome conflicts with the existing primary key and cannot repair it. This does not require forged timestamps or a second save.
- **Problem:** a terminal disposition can be contradicted by a later qualifying insert; row locks used by outcome/sweep do not protect against this path. Even sequential delayed arrival can reproduce the ordering, so a simultaneous race is not required. No claim that this happened to Pilot3.
- **Suggested fix:** serialize witness admission with outcome closure under a consistent lock order and explicitly decide/refuse witness insertion after a terminal outcome. Add a real local PostgreSQL regression for delayed witness after sweep and a two-connection interleaving. Preserve append-only terminal records.
- **Affected readers:** custody read/lookup, pilot receipt reconciliation, slate reports and downstream qualification decisions. P1 reachable wrong custody state/missing write guard.
- **Test boundary:** existing custody tests exercise lost responses and single-process outcome consistency, but fake sweeper is `async () => []`; they do not cover this order. No fresh database read or SQL execution.
