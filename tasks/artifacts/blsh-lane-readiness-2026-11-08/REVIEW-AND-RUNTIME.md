# BLSH capture review and runtime checkpoint — November 9, 2026

The implementing lane reproduced and corrected a pre-dispatch timing defect. The successor passes **63 runner + 29 actual-adapter tests**, scoped ESLint and full TypeScript. Local runtime imports and TLS behavior are now observed. **Fresh-context independent acceptance and the actual capture execution environment remain open.** No live capture or ledger operation occurred.

## Candidate and correction

- Runner: `web/scripts/blsh/nativeProcessCaptureRunner.ts`, SHA-256 `f0cad82ee881c9b7c9900527910410c83311017a57479a8df76cbe50813ed8a8`.
- Runner test: `c98006c5a66b27ef705380945a683f18d72d49273216940d273297ffb6721624`.
- Adapter remains `0162fb52fe3df0b3c1b70f11b0739792a5b0f32b8dbd35b92255597a506c5368`. Shared NST/sKO files and all other 14 pins are unchanged. Full current pins are in [ADAPTER-CHECKS.json](ADAPTER-CHECKS.json).
- The original runner `c8474d7…` and test/check receipt are preserved in [review-baseline-2026-11-09](review-baseline-2026-11-09/MANIFEST.json). That candidate must not execute.

The runner checked expiry before flushing the private STARTED receipt, then invoked transport after that synchronous write. [The original reproduction](REVIEW-PREDISPATCH-REPRO.json) used the real adapter/client with synthetic fetch and a substituted local budget: a 1.1-second fsync delay dispatched NST **1,115 ms after admission**, beyond the 1,000 ms permit; a separate wall-clock advance during the write dispatched after **121,089 ms**, beyond the 120-second work deadline. No provider request was made.

The successor rechecks stop state, permit and operation deadlines immediately before invoking the action. Both wall and monotonic clocks constrain permit/operation expiry. Durable-write time is deducted from the original timeout; it cannot buy another full timeout. The 22-second spacing starts at action dispatch. A concurrent refusal also cancels the queued action before it starts. [The same actual-adapter reproduction against the successor](REVIEW-PREDISPATCH-RECHECK.json) records **zero provider dispatches** in both cases.

Eight added regressions cover write-time permit/operation/work expiry, clock rollback, actual spacing, remaining timeout, and monotonic expiry when wall time understates elapsed time. They failed before their respective fixes. One existing concurrency assertion was strengthened from one request to zero because the new final check closes that pending action too. The final 92-test run passed in 8.05 seconds; earlier failed runs are not counted as passing verification. Unchanged UI/composer evidence remains historical at its own pins.

## Observed runtime and TLS

[RUNTIME-IMPORT-RECHECK.json](RUNTIME-IMPORT-RECHECK.json) records the actual nine module paths, loader and dependency entry hashes. Node **22.23.4** matches `.nvmrc`; executable SHA-256 is `daa77e22e1b8778361b392461e9921a6d292d0382ebf4ae872a0081f02f01fef`. The tested loader is installed **ts-node 10.9.2**, CommonJS/Node resolution with `NODE_PATH=.` from `web/`, and **TypeScript 5.7.3**. The factory refuses a missing project, then binds its sourcePath correctly with synthetic values. Capture methods were not invoked by this import probe; network/write guards saw zero attempts.

[RUNTIME-POST-IMPORT-TLS.json](RUNTIME-POST-IMPORT-TLS.json) records four loopback tests after importing the actual pinned runner/adapter through that loader. Built-in fetch rejected an untrusted certificate, a trusted-CA certificate with the wrong hostname, and an expired trusted-CA certificate. The valid trusted fixture returned its expected body over **TLS 1.3**. Node uses OpenSSL **3.5.9** and built-in Undici **6.29.1**; executable, trust-store and fixture-certificate hashes are recorded. The separate OpenSSL **4.1.0** executable only generated synthetic fixtures.

The ambient probe process had no `NODE_OPTIONS`, TLS bypass, custom-CA or proxy environment entries. No `.env` file was loaded. Only presence/classification was recorded for sensitive configuration names. **Project URL and capture credentials were absent**, so the observed disabled lifecycle classification is not evidence of production activation or a configured capture process.

The earlier [standalone TLS result](RUNTIME-PROBE.json) and [import result](RUNTIME-IMPORT-PROBE.json) are retained as historical observations; the original standalone probe source is preserved with the baseline. Across both successful TLS rounds there were **eight loopback TLS attempts and two accepted local HTTP requests**, zero external requests. Synthetic private keys were deleted. A sandbox bind refusal was resolved through the allowed local-only escalation; harness defects in frozen-array sorting and nested regex escaping were corrected before the successful runs. No automatic approval-review rejection remains open.

These checks prove the stated local behavior. They do not attest a provider certificate chain or the future capture process. `TLSVerified` remains null in capture observations; no acceptance policy, score, baseline weight or live configuration changed.

## Remaining actions

1. **Coordinating Chef / fresh-context reviewer:** review this exact successor, especially the changed dispatcher and preserved reproduction. The lane cannot verify its actual active model/effort; local defaults are not runtime proof. [AGENTS.md](../../../AGENTS.md) and [mise-en-place.md](../../../mise-en-place.md) require verified staffing before delegation. A reviewer has been requested through the parent and mailbox `CODEX-BLSH-RUNTIME-REVIEW-20261109-08`; none has been launched or acknowledged here. This is author-side review and correction, not independent acceptance.
2. **Execution owner with NST custodian:** identify the actual intended invocation/environment, public project, existing lifecycle mode, Node/loader/dependency pins and non-secret TLS configuration. No capture CLI exists. Reconcile those facts with this local evidence without printing or changing credentials or production flags.
3. **TJ:** only after those gates, separately approve the exact bounded candidate in [FRESH-CAPTURE-PROPOSAL.md](FRESH-CAPTURE-PROPOSAL.md): fixed November 7 date, one schedule GET, two NST GETs, one admission per page, at most eight application HTTP operations including lifecycle cleanup, and the stated admission-ledger effects. No live execution is authorized by this checkpoint.

Complete current membership, original official per-player/goalie evidence, qualification and real application serving remain subsequent work. Baseline weight **1.0 stays settled**; the two-page pilot cannot clear those gates.
