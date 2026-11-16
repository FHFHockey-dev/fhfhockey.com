# Completed local ingestion mathematical validation — 2026-11-12

## Result

The remaining PP/PK timing and simulator defects are fixed locally. The shared penalty clock now drives both strength totals and relationship segments. The final official-source replay matches **190 players × four clocks = 760 exact total/ES/PP/PK comparisons**, plus 3,420 directed teammate-pair checks. All ten team PP clocks pass per-game qualification. This is local end-to-end verification through the actual rows prepared for upsert, with persistence captured instead of executed.

The approved live cron correction remains applied: ingestion 09:45 UTC, relationships 09:55, derived 10:05. This turn did not change schedules, execute ingestion, deploy code, or rewrite historical rows. The next automatic cycle was not observed.

## Causes corrected

| Cause | Implemented correction |
| --- | --- |
| Sparse event-state carry-forward credited PP/PK after expiry | One pure penalty-context clock supplies every exact exposure boundary; event-time scoring classification stays separate. |
| Penalty-shot goal canceled an unrelated minor | Penalty-shot goals leave running penalties intact. |
| Same offender's additional penalty ran concurrently | Offender identity persists across stoppages; subsequent service is sequential. |
| Double-minor/single-minor goal release chose the wrong penalty | Compare remaining time within the assessed penalty, including its remaining double-minor half; do not combine unrelated serial penalties. |
| Captain's legal choices were decided by input order or player ID | Enumerate legal service/release alternatives, constrain them using interior event evidence, require one exposure result; unresolved ambiguity is unavailable, never a fabricated zero. |
| Coincidental timers disappeared too early or consumed OT slots | Preserve regulation clock slots and protected goal-release status; apply regular-season OT substitution and remove carried coincident timers from the manpower clock while preserving personal serial service. |
| Late-game major/minor differential omitted or applied before required cancellation | Apply Rule 19.4 and Table 13's prescribed cancellation/differential cases; differential service remains major-like through goals. |
| HTML fallback silently skipped nonnumeric OT labels | Parse OT and successive playoff OT labels; strict mode rejects unknown numbered physical-shift periods. |
| Incomplete/malformed data could appear qualified or throw outside the error boundary | Per-game qualification requires complete final period coverage, strict clocks/types/identities and event agreement. Malformed or ambiguous clocks return unavailable; ingestion fails before writes. |

Prior fixes remain: physical interval unions, bounded symmetric pair intersections, strict period lengths, numeric chronological payload ordering, and whole-game DRM exclusion for invalid relationship clocks. Input materializer is now `projection-input-materializer-v3-penalty-clock`; relationship algorithm is `shift_relationship_materializer_v5_penalty_clock`. Raw-source hashes and SQL ownership/CAS boundaries are preserved.

## Independent evidence and source reconciliation

The 2026–27 NHL rulebook was obtained from the official NHL link and inspected for Rules 16–20, 24, 26, 39 and 84 and their reference tables. Regression expectations were derived independently from those rules, including captain-choice cases. See `MATH-CLOCK-REVIEW.md` for source URLs, examples and final closed-findings disposition.

`official-player-clocks.json` contains independently parsed ES/GS facts for all 180 skaters and ten played goalies. Every join uses verified game/date/team and jersey-to-roster identity, never names. Source URLs and SHA-256 hashes are retained. Bench goalies with blank clocks are not fabricated as played zero-TOI records.

Original immutable JSON snapshots exposed 12 total/ES disagreements, although **all 190 PP/PK splits already match** under the repaired clock. Fresh JSON resolves five outdated player captures. Seven players in game 2026020205 still have 1–2 extra seconds in the JSON feed compared with the official printed intervals and ES/GS summaries. The printed intervals reconcile exactly; the total discrepancy is ten seconds. This is an upstream endpoint disagreement, not a remaining arithmetic defect, and it is not silently capped or removed from the original snapshot. See `source-discrepancies.json`.

For the fully reconciled replay, the actual production HTML parser builds new, complete source envelopes for games 2026020009 and 2026020205. This exposed and then verified the OT parsing fix. The other three games retain their captured JSON sources. These verified source candidates produce all 760 official clock values exactly. The two original snapshots remain unchanged; any production repair must explicitly publish the new source generation, not relabel the old JSON as repaired or use a JSON-only refresh for game 2026020205.

## End-to-end proof

- `LIVE-REPLAY-OFFICIAL-SOURCES.json`: production HTML parser → snapshot/source hashes → canonical physical unions → penalty-context strength totals → actual relationship route → payload arrays/percentages → captured persistence. 190 player rows, 760 exact official clock matches, ten qualified team clocks, 3,420 symmetric bounded pairs. Player total equals ES+PP+PK; relationship PP equals producer PP; legacy non-PP equals ES+PK.
- `PREPARED-REPAIR-ROWS.json`: concrete offline strength and relationship rows for the five validation games, with source hashes and the two replacement source envelopes. **Not published; not a complete historical backfill population.**
- `INTERVAL-ORACLE.json`: 250 seeded cases, 15,500 source intervals, 750 player totals and 500 directed pairs independently checked by enumerating occupied seconds rather than reusing interval algebra.
- Final focused run: 111 tests across penalty clock/qualification, strength ingestion and HTML fallback. Route/version/persistence/derived integration: 112 tests across ten files. Shared consumers: 78 tests passed across the four affected files after repairing malformed fixtures; raw capture parser: 46 passed. These groups are reported separately; broader earlier checks overlap.
- Whole-web TypeScript, scoped ESLint and final whitespace checks passed. Independent review closed all reported clock findings and separately checked held serial service and malformed-terminal behavior. No full build was run.

Replay: `node tasks/artifacts/drm-pipeline-triage-2026-11-12/replay-shift-calculations.cjs --official-shift-reports`. This uses the four cached TH/TV reports in `/tmp`; their identities/hashes are recorded in the source evidence, and the prepared envelopes are retained in `PREPARED-REPAIR-ROWS.json`. The harness blocks remote-capable application dependencies. Offline replay and mocked RPC tests do not certify a production transaction.

## Remaining operational work

Code and mathematical verification are complete locally; production still needs an approved release and bounded source-aware historical repair. The original 92-game list covered overlap/pending defects only. Strength-clock correction requires enumerating older materializer generations and validating source agreement before forming the final repair scope. Reuse the prepared five-game evidence, preserve immutable originals, and prefer the reconciled official report source where JSON conflicts. Do not claim that all historical games or every upstream source is corrected from this representative validation set.

Stored percentage remains shared/game time, while the DRM reader separately computes shared/player time. Existing greedy all-strength line labels and legacy non-PP array naming retain their documented meanings; this clock repair does not convert them into observed 5v5 units. Detailed formulas and approved contracts remain in `MATH-RELATIONSHIPS.md`.
