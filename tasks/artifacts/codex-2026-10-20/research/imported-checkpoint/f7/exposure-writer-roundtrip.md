# Checkpoint: actual writer emission → compactor → injected reader

2026-10-20 UTC. **PASS: six grouped checks.** This supersedes the earlier “writer compactor not executed” limitation for these specific pure exports under the explicitly scoped inert-module setup. It does not qualify the full writer or projection pipeline.

Reproduce: `bash /workspace/shared/fhfh-research-2026-10-20/run_exposure_writer_roundtrip.sh`.

Artifacts: `exposure_writer_roundtrip.cjs`, `exposure_writer_mock_guard.cjs`, `exposure-writer-roundtrip-results.json`, and `exposure-writer-roundtrip-run.txt`. Results retain hashes for every loaded app module and the harness/guard.

## Exactly what ran and what was mocked

Actual unchanged repository exports executed: `__testables.deriveOutputs`, `splitRollingUpsertRowForDurableStorage`, `fetchRollingRows`, ratio/resolver/historical accumulator helpers and `initAccumulator`.

The process used explicit Node22.11.0, existing ts-node, and env -i. Only exact synthetic `.invalid` URL/key placeholders satisfied the writer's import-time presence checks. A recording no-op dotenv module intercepted the import before the real package loaded: three config calls, **no files read**. A recording inert createClient replacement likewise intercepted before the real client package loaded: one mock factory call, returning a proxy that throws on every operation. **No inert-client operation occurred.** The original socket/TLS/HTTP/DNS/fetch/UDP blocks stayed active.

Verified: zero real dotenv/client package modules loaded, zero environment-file read attempts, zero real client initialization, zero client operations and zero network attempts. Ordinary source/dependency file reads for compilation are not counted as environment-file reads. No real credentials, historical data, application patches or dependency changes.

## Discriminating result

Two synthetic five-appearance inputs use 20 minutes each. Their only observed raw shot is in the last appearance. In A, the other four counts and supplied rates are missing. In B, those raw counts remain missing but supplied rates are 3/60. Placing the observed event last keeps the other emitted last-N rates equal too.

1. Actual resolver/ratio accumulation retains A's matched recent support as **1 shot / 1,200 seconds** and B's as **5 numerator-equivalents / 6,000 seconds**.
2. Actual `deriveOutputs` returns **identical output objects under these controlled minimal accumulator states**. Both contain rate3/60, raw count1 and generic TOI6,000. Historical SOG-prefixed totals are also independent count1/TOI6,000; paired SOG all/last5 fields are absent.
3. The actual compactor produces identical compacted results for A/B and preserves player/game/date/season/strength identities. The matched-support distinction is already gone; compaction cannot restore it.
4. The actual reader, with an in-memory query double, restores the selected emitted data and matching snapshot identities. It still has no paired SOG exposure to expose.

This upgrades the loss-at-emission finding from source trace to actual-function execution. Equality is claimed only for the tested deriveOutputs/compactor outputs, **not full writer runs, all metrics or source diagnostics**.

## Remaining boundary and next action

The private simple rolling updater is not exported: its input accumulator shapes were seeded from the fixture, using actual `initAccumulator`. The real metric-source extraction loop, processPlayer, history selection, database persistence, all projection stages and prospective performance remain unexecuted.

The implementation prerequisite is now specific: preserve matched numerator/exposure **and observed-versus-reconstructed status before it is erased**, carry an optional separately versioned SOG-support object through producer/compactor/reader, and verify old/new payload behavior. A query-only fix cannot recover the distinction. Import-safe extraction remains good engineering, but is no longer a research blocker for this tested slice because the explicitly authorized inert module mocks worked.

Task-list checkpoint: “Actual deriveOutputs→compactor→injected reader reproduces paired-SOG support loss while retaining snapshot identity. Controlled inputs with paired1/1200 versus5/6000 yield equal emitted/compacted outputs. Next implement versioned matched support/provenance and compatibility regressions; full writer/DB/predictive qualification still open.”
