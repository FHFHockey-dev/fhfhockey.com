# Parity oracle diff from the trend-band reader integration (2026-11-15)

**Why:** `parity.test.ts` and `computeOff.test.ts` compare the writer with oracles recorded on the unmodified writer (1216f6e17, 52c3b6919). They say an oracle "must never be re-recorded to fit a change". The trend-band integration changes reads and writes on purpose, so this note records exactly what moved before any re-record.

**Method:**
- A temporary dump test (scratch only, not committed) ran every scenario on the same fixture world twice:
  - on a `git archive 863fab152 web` export (before the integration);
  - on the working tree (after it).
- It dumped full read results and full write payloads, then deep-diffed them.

## Writer scenarios (`parity.test.ts`, 9 scenarios)
In every scenario, read and write counts are unchanged. The differences are:
- **Reads:** only the trend-band read, once per projected team, at the same position. It went from `from sustainability_trend_bands …` to `rpc forge_latest_trend_bands`.
- **Writes:** only `forge_runs.metrics.data_quality`. `trend_adjustment_rows_eligible` (N) became `trend_adjustment_candidate_rows` (N, the same value here, because the world's history is below the old cap).
- **Everything else is byte-identical:** every projection row, the per-player `trend_adjustment` block, and the candidates.

| scenario | changed reads | write diff |
|---|---|---|
| normal-one-game | 2 (trend) | counter rename, 12 → 12 |
| skater-pool-recovery | 2 | 12 → 12 |
| season-bootstrap | 2 | 14 → 14 |
| reserve-pass-on | 2 | 12 → 12 |
| target-pbp-pregame | 2 | 12 → 12 |
| goalie-override-multi-candidate | 2 | 12 → 12 |
| opponent-shots-gate | 1 | 6 → 6 |
| goalie-model-reorders-candidates | 2 | 12 → 12 |
| lineup-evidence-gate | 2 | 12 → 12 |

## Compute-off scenarios (`computeOff.test.ts`, 5 scenarios, 6 invocations)
- Same pattern: the trend reads become the RPC, and the counter is renamed (12 → 12, or 0 → 0).
- The resumed run's second invocation also reads back its own `forge_runs` row. That row now carries the renamed key, and that is the read's only difference.

## Result
The only changes are the two approved ones: the read path (TJ: integrate, third RPC) and the counter rename (TJ). Re-recording the oracles at the integration commit would fix exactly these, and nothing else is masked.

## Re-record (TJ-approved 2026-11-15)
- **What was run:** `RECORD_FORGE_ORACLE=1` for `parity.test.ts` and `computeOff.test.ts` on the integration working tree. A structural check of every re-recorded file against the committed oracle found:
  - **Reads:** only the trend-band read changes (table → RPC), with counts unchanged.
  - **Writes:** only `forge_runs` hashes change.
  - **Unchanged:** candidates and invocation results.
  - **Resumed run:** its `forge_runs` read-back also changes, which is the renamed counter.
- **Two files patched, not re-recorded:** `goalie-model-reorders-candidates.json` and its compute-off twin.
  - Those tests require the writer's goalie-input reads to differ from the pre-split writer's order, the one tolerated difference (Chef decision e3b2a0beb). A full re-record would have baked the post-split order into the baseline and broken that check.
  - So each file keeps its original oracle, with only the approved delta applied mechanically:
    - the trend-band read entries are replaced by the re-recorded RPC entries at the same positions;
    - the writes are taken from the re-recording, asserted identical except `forge_runs`;
    - the `outputHash` is taken from the re-recording.
  - Candidates and invocation results were asserted unchanged.
- **Result:** all projections tests pass (96 files, 1,901 tests), including the parity and compute-off suites unrecorded.
