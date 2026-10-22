# F3 implementation prerequisite: paired SOG evidence is lost before compaction

Later validation: `exposure-writer-roundtrip.md` confirms the emission-loss finding by executing actual writer exports under explicitly scoped inert module mocks. The source-only trace below remains the implementation contract; it is no longer the strongest available evidence.

Source-only checkpoint, 2026-10-20 UTC, HEAD `855b9dfe`. No guarded writer import, code patch, historical read, fit, service call or dependency change. This narrows the previous reader finding: **adding a missing query field is insufficient. The inspected writer never emits the required paired SOG all/last-N support.**

## Exact field trace

1. `fetchRollingPlayerAverages.ts:1153–1166` resolves SOG from raw shots plus TOI, or a supplied /60 rate plus TOI. `rollingPlayerMetricMath.ts:3–34` returns the same untagged numerator/denominator shape for observed and reconstructed contributions.
2. Actual ratio accumulators retain matched component sums/counts. `deriveOutputs`, `:2797–2836`, obtains both rolling and historical component snapshots, but its scalar SOG outputs contain only **rates**. In particular, sog_per_60_total_all and sog_per_60_total_last5 are rate aliases, not shot counts or exposure totals.
3. `applyRatioSupportOutputs` has a matched-component `setWindowPair` helper (`:2032–2082`), but the SOG branch does not call it. Instead, its simpleSupportPairs branch (`:2331–2337`, `:2404–2448`) writes sog_per_60_shots_{season,3ya,career} and sog_per_60_toi_seconds_{season,3ya,career} from **independently accumulated simple metrics**, not the ratio component snapshots. No paired SOG _all/_last5 numerator/exposure is emitted there. The current source may contain enough matched sums in memory, but they are discarded at this output boundary.
4. Generic shots_total_{all,last5} and toi_seconds_total_{all,last5} are emitted separately. They have independent missingness and can differ from rate support; their names do not establish a shared observation frame.
5. The compactor (`:451–543`) can move emitted scalar fields into historicalCompatibility. It cannot recover omitted information. Its only special structured support is aligned_count_support, which covers conversion count pairs, not SOG/TOI. The sidecar schema also exposes scalar dictionaries, not a versioned SOG exposure/source frame (`rollingPlayerSupportPayload.ts:9–21`).
6. Reconstruction counts exist in `summarizeSourceTracking` (`:3480–3487`), but are run/player-strength diagnostics, not persisted anchor/window-bound rate provenance. The per-row output (`:3953–3979`) spreads metricOutputs and optional aligned conversion support, not this source-classification summary.
7. Finally, the reader's scalar allowlist omits paired SOG numerator/TOI and cumulative TOI (`skater-queries.ts:81–131`). The actual injected-reader harness already proved that hypothetical extra sidecar fields are not restored. This is a second gap, after producer emission.

## Why historical averages cannot honestly repair this

Two five-appearance histories yield the same **checked summary values**: SOG rate 3/60, raw-known-shot sum 1, generic TOI 100 minutes and five selected appearances. `exposure_nonidentifiability.cjs` verifies this with the actual resolver, ratio aggregator and public historical simple accumulators; results are in `exposure-nonidentifiability-results.json`. Reproduce with `bash run_exposure_nonidentifiability.sh`:

- One observed shot/20 minutes; four missing counts and missing rates: matched exposure is 20 minutes.
- The same observed shot/20 minutes; four missing raw counts supplied as 3/60 rate: reconstructed numerator equivalents add four, so matched exposure is 100 minutes.

Those checked summaries do not identify the difference. **No equality claim is made for entire writer rows, conversion payloads or run diagnostics**, which were not executed in this fixture. This is an identifiability example, not a production occurrence. Inverting a rounded rate, multiplying mean TOI by games, or declaring generic totals “paired” cannot establish original exposure, reconstruction status or source timing. Legacy rows from other producer versions were not queried; do not claim they universally lack support. Recompute only from retained, identity-qualified original observations and their correct as-of versions, under a separately scoped repair.

## Smallest explicit contract and next action

Start with **SOG, separately EV and PP, recent five positive-TOI appearances**. Persist:

- Version, player/strength, anchor game/date/season, exact window-selection policy and source-availability watermark.
- The bounded selected five game/source identities, including missing slots; per-frame count/TOI source and observed/reconstructed/missing status.
- Separate observed and reconstructed numerator, TOI **seconds**, and valid-observation count; exclusion counts. Observed zeros remain observations. A reconstructed real-valued numerator is not an observed Poisson count.
- Aggregates validated against those frames, with an ordered identity/content hash. If historical scope is later consumed, declare its actual start/season filter rather than naming it merely “all.”

Compatibility proposal: use an **optional, separately versioned rate-support object** inside the existing JSON payload, not invented wide columns. The inspected reader accepts only global payload_schema_version=1 but ignores unknown top-level payload members; that suggests an additive route preserving existing v1 rows. It does not prove compatibility with every writer/reader or database constraint. A new consumer must treat absent/unsupported rate-support versions as unqualified support, never observed zero or generic rate×TOI evidence. Do not blindly bump the global version and thereby reject legacy rows; verify both old/new payload behavior in the full round trip. No schema/migration-free claim is made.

Implementation order: make the existing compactor import-safe; preserve source status before resolution erases it; emit the typed support from matched ratio components; explicitly carry/validate it through sidecar storage and reader reconstruction; then add synthetic round-trip and missing/reconstructed/zero identity regressions. A structured payload needs explicit writer/parser handling, not just scalar allowlist additions. Only afterward choose target-specific rate/workload weight semantics. No new model or historical backfill is implied.

Import-safe extraction is the recommended engineering route, not the only theoretically possible test route. Existing writer tests expose __testables under mocks; a tightly isolated mocked-module fixture could be scoped separately. This checkpoint kept the stricter existing guard and did not bypass dotenv/client initialization.

Task-list wording: “F3 producer gap confirmed: matched SOG all/last-N components are not emitted; similarly named historical fields are independent totals. Preserve versioned paired exposure/provenance before compaction, then prove writer→sidecar→reader identity/support round trip. Query-only or average-TOI substitution is insufficient.”
