# R20 bounded intake correction v2

Freeze: `owned-source-v2-sha256.json`, SHA256 `81b41d7841a72c12cdb2824a7483cb81a0a13a61d40b916c4b218447cbd0b9fb`, 148 pins plus15 read-only dependencies. All previous139 source/test/SQL pins and25 v1 evidence artifacts unchanged; all2224 earlier reviewer files verified unchanged. Runtime unchanged from v1. Hold exact source/dependency pins until independent release. Only new report/artifact paths may be written while held.

Select replacement SQL7 `supabase/migrations/20261016085537_ifttt_bounded_receipt_intake.sql`, SHA256 `ab5d686589f78815326b1b0c942975206cfc1cc4e6288fdfa64646e4289f8c5e`. The rejected v1 SQL7 is preserved evidence: never apply both alternatives. Accepted replacement SQL6 remains unchanged and is required first. No active migration tree, database or production flag modified.

R20 fix: take current-policy full admission rows/count before attempt UPDATE; verify unchanged before inner retention. A counter-trigger admission mutation fails outside the inner savepoint and rolls back the complete faulty attempt. Already-over-cap state fails closed. Preserve ordinary inner storage/cap failure attempt charging. Stop UPDATE must preserve admissions, and a new owner registration must have no admissions.

Checks:109/109 pass (77 actual disposable-PG+20 pure policy+12 nearest mocked), scoped TypeScript exit0. Includes byte-identical original two R20 assertion bodies plus3 nearby whole-state rollback/recovery controls. Existing104 bodies retained; original v1 reproduced104pass/2independentfail is preserved, not overwritten. No reviewer correction accepted yet. No running test/compiler/privatePG process.

Original v1 `POLICY-AND-ROLLOUT-GATES.md` remains applicable, with this selected SQL7 replacement. No production caps/window/source tuples chosen. Full deployed schema/ACL/triggers/writer/fence proof, caller-wide RPC deadline, authentic source/history/identity, external queue, future metrics, full52/operational acceptance remain open. No broad81/full compiler/build/hosted action.
