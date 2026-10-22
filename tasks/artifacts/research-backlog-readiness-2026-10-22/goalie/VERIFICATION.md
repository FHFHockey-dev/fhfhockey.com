# Goalie research packet verification

2026-10-22; canonical `octoberBranch`; source snapshot HEAD `d3f057c6c849d5d5474bc912a6f461f617c65b15` plus the exact file bytes in [SOURCE-REFERENCES.json](SOURCE-REFERENCES.json). Relevant goalie/sKO source paths had no working diff at audit start. Other lanes had extensive unrelated WIP and were preserved.

## Executed

From the repository root:

```sh
node --test tasks/artifacts/research-backlog-readiness-2026-10-22/goalie/audit.test.cjs
```

Final result: **15 tests passed; 0 failed, skipped or cancelled**, Node **v22.11.0**, existing TypeScript **5.7.3**; 344.385333 ms reported by the test runner. [Full final TAP](TEST-RESULTS.tap); [machine-readable observations](OBSERVATIONS.json).

After the parent explicitly requested P02 overlap, a separate `p02-overlap.test.cjs` ran once: **5 passed, 0 failed/skipped/cancelled**, same runtime/compiler, 193.658 ms. [Supplement](P02-OVERLAP.md) documents its scope, exact command, additional unchanged-source slices and limitations; [TAP](P02-TEST-RESULTS.tap) and [outputs](P02-OBSERVATIONS.json) are retained. The completed core/SOG tests were not rerun. The source receipt now includes 37 files, with the original 24 hashes verified unchanged before adding inspected P02 paths and supporting documents.

An initial run passed 14/15. Its single failure was this research harness's overly specific error-message assertion: the native VuDu function rejects a negative shot denominator via the saves-exceed-shots guard before the nonnegative guard. The accepted behavior was already rejection. The assertion was corrected to accept either applicable guard message; no application file changed. The initial [TAP](TEST-RESULTS-initial.tap) is retained. Before the final run, the population fixture was strengthened to compare both actual producers on the same three fictional event identities. The final successful check was not rerun for extra confidence.

## What ran, and what did not

[actual-source.cjs](actual-source.cjs) reads pinned, explicitly allowlisted source files. It uses the already installed TypeScript compiler to transpile their actual code and executes pure modules in an isolated VM. The module context has no supplied process, filesystem, fetch, timer, socket or real service client. Controlled imports can load only the allowlisted pure local modules. No package installation, environment loader, application bootstrapping or new dependency was used.

Queries are tested using AST-extracted **unchanged function bodies** plus their selected local helpers, with a fictional table-response client injected. Calls and filters are recorded. These mocks do not implement a database or independently evaluate SQL predicates. The future-fallback test both supplies an empty bounded response followed by a future row and asserts the actual fallback omits its date filter. The in-house team-prior dependency is explicitly stubbed unavailable; that provider path is not tested. Query failures are separately exercised.

The goalie-stage probe executes its unchanged context block (`let contextPct = 0` through before `const adjustedTeamGoalsFor`) with fictional bindings and the actual constants/utilities. It does **not** execute starter selection, storage, bootstrap, serving, or the whole pipeline. Other call-site/SQL findings are source inspection, clearly identified in the audit. SQL guards were not run against any database.

The tests characterize present behavior, including defects. They are reusable local audit probes, **not application regression tests asserting those defects should remain**. A future fix may correctly fail these characterization assertions; inspect and convert the relevant case to the intended admission/abstention expectation with the file owner. Source hash changes fail closed; review drift rather than blindly refreshing hashes.

The fixture IDs, teams, dates and observations are fabricated or taken from the repository's existing explicitly synthetic SKO fixture module. No raw session-store, private league, account, player dataset or production row was read. No network, paid/production call, message, commit, build or deployment occurred. Full unit/type/lint suites were not appropriate for artifact-only work and were not run.

## Coverage and handoff

- Exercised native gap guards, valid model count conservation and probability conditioning, impossible preview ratios, missing count coercion, query errors, nested-window mass, relief-as-start workload, unknown rest, future team-prior fallback, NST consumer time units, matched on-net/unblocked producers, team-xGA effect paths, team SV context and malformed nonfinite model input.
- Not established: live incidence, provider units/completeness, original historical availability, effectiveness of any alternative coefficient/formula, empirical calibration, accepted goalie adapter, full pipeline/serving behavior, or production readiness.
- Deliverables are confined to this research directory and its parent readiness report/context diary. Canonical registers and application/worker files remain untouched by this task.
- No permission denial, pending approval or uncertain execution outcome. Remaining blockers are missing source qualifications/empirical evidence and separately scoped implementation decisions, not a failed tool action.

Final artifact integrity: all **37 source hashes** remained unchanged and all **25 local Markdown links** resolved. `git diff --check` passed for owned paths, but these artifacts are untracked, so a direct authored-text/final-newline and JSON check was also used. An initial blanket whitespace check found only whitespace in the preserved failing test runner's raw TAP output; that receipt was left intact and excluded from authored-text normalization. No application test or source hash was changed to hide a failure.
