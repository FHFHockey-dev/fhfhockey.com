# Offline reproduction

From `/Users/tim/Code/fhfhockey.com` with the existing Node 22.11.0 installation/dependencies:

```sh
packet=tasks/artifacts/research-backlog-readiness-2026-10-22/p02-correctness/r1-extension
/usr/local/bin/node "$packet/stage.cjs"
# Pass the emitted absolute snapshot/web path below.
sh "$packet/RUN-CHECK.sh" focused /absolute/snapshot/web
sh "$packet/RUN-CHECK.sh" tsc /absolute/snapshot/web
sh "$packet/RUN-CHECK.sh" lint /absolute/snapshot/web
```

Omit the second argument to use the recorded green snapshot, if still available. No packages are installed and no app server is started. The staging script copies only explicit files and local import closure; it excludes environment files, credentials and session stores. The unmodified independent reviewer fixture is copied to the isolated PlayerStats test directory, with its source hash in `ORACLE.json`. Vite environment loading and network access are disabled.

For the red reproduction, create a fresh snapshot, replace only its two summary consumers with this packet's `before/web/components/PlayerStats/` copies, and run `focused` against that snapshot. Expect 13 failures / 13 passes, including both original independent caller failures and all six original controls passing. Leave the canonical checkout and original nine-file packet untouched.

Actual receipts: `RED.log`, `GREEN.log`, `TYPECHECK.log`, `LINT.log`. `RED-initial-fixture.log` preserves the preliminary bad skater-label expectation, corrected before application edits. `TESTED-SOURCE.json` records the final imported closure; `CANDIDATE.json` records the three-file lease, new pins and separate extension patch hash. The original owner suite's prior 96-pass result belongs to the independent review, not to this extension's 26-test run.
