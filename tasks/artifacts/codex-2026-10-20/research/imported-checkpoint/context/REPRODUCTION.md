# FHFH deep research reproductions

2026-10-20. Synthetic and offline only. No production connectivity, secrets or private league data are required. These files are research artifacts outside the application repository; they do not implement fixes.

## Exposure

`python exposure_synthetic.py --repo /path/to/fhfhockey.com`

Python standard library only. Reads named application files solely to record their SHA-256. Reimplements a declared neutral stage slice algebraically; does NOT execute the full model or fit historical labels. Writes exposure-synthetic-results.json beside the script. Ten checks validate counterexamples and reference invariants, not predictive improvement.

## Recovery

`python recovery_interleavings.py`

Python standard library only. Enumerates finite two-actor state-machine interleavings; no DB or application imports. Writes recovery-interleavings-results.json. Atomic server fencing is an assumption being compared, not verified PostgreSQL implementation. Unsafe schedule counts are not incident probabilities. Model assertions intentionally require counterexamples in weaker variants.

## Admission

Use existing project npm dependencies and Node 22.11.0. Adapt absolute imports and output/source-root paths in admission-matrix.ts to your checkout/research directory only. From web/:

`NODE_PATH=$PWD node --require=/path/to/no-network.cjs node_modules/ts-node/dist/bin.js --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' /path/to/admission-matrix.ts`

Imports actual development reader/normalizer/scoring functions and uses fictional checked-in-fixture-style data. Transcribes only the old hash formula from master b630e0767. Sixteen assertions pass across twelve reader cases, a changed-start control and three scoring checks. Results include source-file hashes. No old-reader execution or live acceptance is claimed.

The included no-network.cjs blocks Socket.connect, tls.connect and global fetch. Do not load environment files or add production credentials. No GIT_DIR is used.

## Evidence base and limitations

Application source base is octoberBranch392c02af; later cloud branch commits change only TASKLIST.md. Record fresh source hashes if using a different checkout. Existing npm modules are needed only for admission. This kit does not apply frozen native patches, perform runtime integration, simulate all distributed failures, evaluate real player outcomes, or authorize a deployment/repair.
