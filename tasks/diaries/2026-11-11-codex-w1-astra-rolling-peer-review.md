# W1-3 rolling-player audit peer review

- Scope: independently vet Fable's W1-3 findings and proposed fixes; append corrections/context in `tasks/artifacts/calculation-inventory-2026-11-10/master/W1-Astra-PR/rolling-players.md` only. No application code changes, database writes, provider requests, deployment, commit or push.
- Where: canonical checkout `/Users/tim/Code/fhfhockey.com`, `octoberBranch`, starting HEAD `f6cdee012b8c16d330362cb88f81435d17f975ff`. Existing dirty files and other workers' audit output preserved.
- Start: read repository instructions, W1-3 prompt/audit, owner decisions and relevant triage. Local source and deterministic calculations are primary evidence; original audit's stored-data observations are not independently re-proven.
- Next: trace major findings and proposed fixes against producer, reader and test contracts; write review with exact evidence and limits.
- Blockers/approvals: none for local read-only review and requested review artifact. No DB/provider access needed yet.

## Checkpoint
- Reproduced current regular-season shots/60 factor-of-60 error; current playoff adapter instead cancels the rate error while corrupting TOI. Confirmed zero-shot ixG omission, zero-PP denominator omission, cumulative trade denominator, short-game TOI heuristic and results-luck rate/count mix using pure functions transpiled in memory. No network, provider or database operations were invoked.
- Existing focused tests passed: 5 files, 58 tests. Tests encode some disputed assumptions, including minutes in trend fixtures. They are not correctness acceptance.
- Fix-plan corrections: FORGE total-TOI switch cannot meet the proposed 3-game/0.22 call-up assertion without calibration; current-team availability is an explicit existing contract; tied raw percentiles can differ after sample shrinkage; expected-SH has three denominators, not two. Broader support-pair coverage and pruned streak inputs also need attention.
- Next: save the separate review, check references and diff, report findings and remaining production-evidence limits.

## Handoff
- Saved `master/W1-Astra-PR/rolling-players.md` under the calculation inventory. Verified it is readable, has no trailing whitespace, and principal source references exist.
- Final scope check: no application/source/package changes from this worker; HEAD remains `f6cdee012b8c16d330362cb88f81435d17f975ff`. Only the assigned report and this diary were written.
- Review completed; no implementation or production work. Parent to consolidate and deliver. Production prevalence and the audit's historical DB sample remain unverified in this review, explicitly documented.
