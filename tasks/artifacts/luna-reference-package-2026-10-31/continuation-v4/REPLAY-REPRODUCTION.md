# Replay version selection correction

The original `omission-diagnosis/replay.ts baseline` argument chooses an **output label/file name only**. It does not load v3. The saved baseline was produced before the v4 edit, while v3 was live. Running that script now with `baseline` would use the current v4 module, and its exclusive output write also refuses to overwrite the historical baseline artifact. Do not delete that artifact or restore v3 over the active checkout to rerun it.

The new `verify-saved-replay.cjs` explicitly loads archived v3 source into a process-local module at its original virtual location for the baseline, then clears the relevant module cache and loads current v4 for the candidate. It compares both variants and their explicit synthetic positive controls against the saved requests/results. Source files, historical outputs and the real ledger are read-only; only temporary synthetic ledgers are written and removed. This mirrors the independent auditor's successful reproduction. It does not ask a model to answer again.

From `web/`:

```sh
env -i PATH="$PATH" TMPDIR=/tmp NODE_PATH=. NODE_OPTIONS='--require=/Users/tim/Code/fhfhockey.com/tasks/artifacts/luna-reference-package-2026-10-31/deny-network.cjs' TS_NODE_COMPILER_OPTIONS='{"module":"CommonJS","moduleResolution":"node","allowJs":false}' node --experimental-require-module -r ts-node/register/transpile-only ../tasks/artifacts/luna-reference-package-2026-10-31/continuation-v4/verify-saved-replay.cjs
```

The expected baseline observed answer matches the paid result and both request hashes. Candidate replay matches its saved v4 metadata but deliberately reuses the old omission; it still fails the goalie label. The synthetic positive controls pass. None of these outcomes measures v4 model performance or authorizes E01 to be sent again.

For the separately frozen E02–E16 continuation, run `verify-continuation.ts` under the same offline environment. It takes no arguments, sends no requests, refuses to overwrite saved verification outputs, and simulates five cases in disposable ledgers seeded with the two existing attempts: the full sequence, first-call uncertainty, first-report label mismatch, disabled admission and insufficient reservation headroom. The real ledger remains disabled. A full16-report rehearsal is regression evidence only and cannot be substituted for the continuation.
