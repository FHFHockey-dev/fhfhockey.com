# Rolling Player Pass-2 Diagnostics Classification

Date:

- March 12, 2026

Related artifacts:

- `/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-pass-2-refresh-execution-2026-03-12.md`
- `/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-pass-2-reconstruction-evidence-2026-03-12.md`
- `/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-pass-2-helper-contract-map.md`

## Purpose

This artifact records the diagnostics-driven trust classification for task `3.4`.

It uses the current diagnostics contract in:

- [rollingPlayerPipelineDiagnostics.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerPipelineDiagnostics.ts)

to classify:

- stale-tail blockers
- coverage gaps
- mixed-source ambiguity
- suspicious outputs
- derived-window completeness issues

before treating a stored-versus-reconstructed comparison as trustworthy.

## Diagnostics Surfaces Used

The March 12 pass used these diagnostics helpers directly:

- `summarizeSourceTailFreshness(...)`
- `summarizeCoverage(...)`
- `summarizeDerivedWindowDiagnostics(...)`
- `summarizeSuspiciousOutputs(...)`

Live inputs used:

- `npm run check:rolling-player-validation-freshness`
  - existing scripted source-tail classification
- an ad hoc file-based `ts-node` snapshot executed on March 12, 2026
  - this used the same Supabase fetch pattern as the freshness script and ran the four diagnostics helpers against the retained validation players and their stored `rolling_player_game_metrics` rows

Observed live diagnostics snapshot time:

- `2026-03-12T15:12:17.299Z`

Validation players included:

- Brent Burns (`8470613`)
- Corey Perry (`8470621`)
- Jesper Bratt (`8479407`)
- Seth Jones (`8477495`)

## Summary Classification

### 1. Stale-tail blockers

Real blockers remained only in PK-sensitive scopes.

- Corey Perry:
  - `pk` strength
  - `countsTailLag = 1`
  - `ratesTailLag = 1`
  - `countsOiTailLag = 1`
  - classification: `BLOCK comparison`
  - cause bucket: `unresolved verification blocker`
- Seth Jones:
  - `pk` strength
  - `countsTailLag = 1`
  - `ratesTailLag = 1`
  - `countsOiTailLag = 1`
  - classification: `BLOCK comparison`
  - cause bucket: `stale source`

All other inspected strength states for Burns, Perry, Bratt, and Jones showed:

- `countsTailLag = 0`
- `ratesTailLag = 0`
- `countsOiTailLag = 0`
- `ppTailLag = 0`
- `lineTailLag = 0`

Classification rule applied:

- any non-zero tail lag blocks comparison for the affected metric family
- zero tail lag permits comparison, but does not override coverage or component-completeness warnings

### 2. Coverage gaps

Coverage warnings remained present even where tail freshness was healthy.

Observed non-blocking March 12 coverage warnings:

- Brent Burns:
  - `all` and `pp`
    - `missingPpShareGameIds` samples: `2025020003`, `2025020018`, `2025020034`
  - `ev`
    - `missingCountsOiDates` sample: `2025-11-23`
  - `pp`
    - `missingRatesDates` sample: `2025-11-04`
  - `pk`
    - `missingCountsOiDates` sample: `2025-11-13`
- Corey Perry:
  - `all` and `pp`
    - `missingPpGameIds` sample: `2025020666`
    - `missingPpShareGameIds` samples: `2025020104`, `2025020119`, `2025020137`
  - `ev`
    - `missingCountsDates` sample: `2025-10-30`
  - `pp`
    - `missingRatesDates` sample: `2025-11-04`
- Jesper Bratt:
  - `all` and `pp`
    - `missingPpShareGameIds` samples: `2025020014`, `2025020026`, `2025020045`
  - `ev`
    - `missingCountsDates` sample: `2025-10-30`
- Seth Jones:
  - `all` and `pp`
    - `missingPpShareGameIds` samples: `2025020001`, `2025020012`, `2025020027`
  - `pp`
    - `missingRatesDates` sample: `2025-11-04`
  - `pk`
    - `missingCountsOiDates` sample: `2025-11-13`

Observed non-issues:

- `unknownGameIds` was empty for every player and strength in the March 12 snapshot
- no line-context coverage warning surfaced in the retained validation set

Classification rule applied:

- missing coverage with zero tail lag is a `CAUTION`, not an automatic blocker
- PP-share comparisons remain trustable only if the selected window can still be reconstructed from builder rows or explicit fallback logic
- source-input inspection remains required when a warning shows missing PP share or missing split date coverage

### 3. Mixed-source ambiguity

Current state:

- the diagnostics module does not emit a dedicated mixed-source-window summary
- `summarizeCoverage(...)` and `summarizeSourceTailFreshness(...)` can show that source availability is uneven
- they do not show, per selected rolling window, whether numerator and denominator components were mixed across authoritative and fallback sources

March 12 classification:

- no comparison in the ready set was reclassified as `BROKEN` because of proven mixed-source ambiguity
- Jesper Bratt’s live `pp_share_pct_total_lastN` reconstruction still passed
- however, mixed-source ambiguity remains an `observability caution`, especially for PP-share windows and fallback-sensitive weighted-rate rows

Trust rule applied:

- where live reconstruction passes, mixed-source ambiguity is a `CAUTION`, not a blocker
- where a comparison depends on source-precedence interpretation and the page cannot show per-game source trace, treat the result as lower-confidence until the debug payload adds that trace

### 4. Suspicious outputs

Observed result:

- `suspiciousIssueCount = 0` for every inspected player and strength state

This means the March 12 stored rows showed no diagnostics evidence of:

- scaled snapshot fields outside their valid bounds
- GP / availability ratios disagreeing with their raw support counters
- impossible ratio states that the diagnostics contract knows how to detect

Classification rule applied:

- suspicious-output diagnostics did not block any March 12 comparison
- no ratio family was reclassified as suspicious in the ready set

### 5. Derived-window completeness

#### GP windows

Observed result:

- every inspected player and strength state had empty `gpIssueScopes`
- no `partial` or `invalid` GP support summaries were found in the March 12 snapshot

Interpretation:

- canonical GP / availability / participation support counters were internally coherent in the stored rows that were inspected
- GP-window completeness did not block trust for any March 12 comparison

#### Ratio windows

Observed result:

- `primary_points_pct` and `ipp` showed widespread `valuePresentWithoutComponents` counts across many strengths and windows
- `pdo` showed recurring `partial` component windows in `pp` and `pk`
- `pp_share_pct` showed only isolated `valuePresentWithoutComponents` in the ready cases

Representative March 12 examples:

- Brent Burns `pp`:
  - `primary_points_pct.last20`
    - `complete = 20`
    - `absent = 41`
    - `valuePresentWithoutComponents = 41`
  - `ipp.last20`
    - `complete = 37`
    - `absent = 24`
    - `valuePresentWithoutComponents = 24`
  - `pdo.last20`
    - `complete = 54`
    - `partial = 7`
- Corey Perry `pk`:
  - `primary_points_pct.last20`
    - `complete = 0`
    - `absent = 51`
    - `valuePresentWithoutComponents = 51`
  - `ipp.last20`
    - `complete = 0`
    - `absent = 51`
    - `valuePresentWithoutComponents = 51`
- Jesper Bratt `pp`:
  - `pdo.last3`
    - `complete = 43`
    - `partial = 18`
- Seth Jones `pk`:
  - `pdo.last3`
    - `complete = 34`
    - `partial = 2`
    - `absent = 4`

Interpretation:

- GP support completeness is healthy
- ratio-support completeness is materially weaker than GP completeness
- these diagnostics are primarily flagging support-column visibility gaps and denominator-absent windows, not proven arithmetic defects
- this matches the live reconstruction evidence, where active ready-scope ratio families still matched recomputed values even though support coverage was not complete on every row

Classification rule applied:

- `partial` or `valuePresentWithoutComponents` ratio windows are a `CAUTION`
- they do not automatically block stored-versus-reconstructed comparison if the family-level reconstruction has already passed from source rows
- they do block any attempt to trust support columns alone as complete proof for those windows

## Player-by-Player Trust Outcome

### Brent Burns

- comparison-ready:
  - `all`
  - `ev`
  - `pp`
  - `pk`
- trust level:
  - `READY WITH CAUTIONS`
- cautions:
  - PP-share coverage warnings on builder share population
  - ratio-support completeness gaps in `primary_points_pct`, `ipp`, and `pdo`

### Corey Perry

- comparison-ready:
  - `all`
  - `ev`
  - `pp`
- blocked:
  - `pk`
- trust level:
  - `READY WITH CAUTIONS` outside PK
  - `BLOCKED` in PK
- cautions:
  - one PP builder row missing in all/pp coverage
  - PP-share coverage warnings
  - ratio-support completeness gaps in `primary_points_pct`, `ipp`, and `pdo`

### Jesper Bratt

- comparison-ready:
  - `all`
  - `ev`
  - `pp`
  - `pk`
- trust level:
  - `READY WITH CAUTIONS`
- cautions:
  - PP-share coverage warnings
  - ratio-support completeness gaps in `primary_points_pct`, `ipp`, and `pdo`

### Seth Jones

- comparison-ready:
  - `all`
  - `ev`
  - `pp`
- blocked:
  - `pk`
- trust level:
  - `READY WITH CAUTIONS` outside PK
  - `BLOCKED` in PK
- cautions:
  - PP-share coverage warnings
  - ratio-support completeness gaps in `primary_points_pct`, `ipp`, and `pdo`

## Comparison Trust Rules for the Next Validation Steps

- If `summarizeSourceTailFreshness(...)` reports any non-zero lag for the relevant strength and family, the comparison is blocked.
- If `summarizeCoverage(...)` reports missing PP rows, missing PP share rows, or missing split-date coverage, the comparison can proceed only with explicit source-row inspection.
- If `summarizeSuspiciousOutputs(...)` reports any issue, treat the affected row as untrusted until the ratio arithmetic is manually reconstructed.
- If `summarizeDerivedWindowDiagnostics(...)` reports GP partial or invalid windows, do not trust GP-based availability claims until support counters are reconciled.
- If `summarizeDerivedWindowDiagnostics(...)` reports ratio `partial` or `valuePresentWithoutComponents`, treat support columns as incomplete evidence and prefer direct source reconstruction.
- If source reconstruction passes and suspicious-output diagnostics are clean, ratio-support incompleteness is a caution rather than a correctness blocker.

## Main Diagnostic Findings from March 12

- stale-tail blockers are now isolated to PK-sensitive Perry and Jones scopes
- no suspicious-output issues were found in the retained validation set
- GP support windows are internally coherent in the stored rows inspected on March 12
- ratio support windows are materially less complete than GP windows and should not be treated as sufficient proof by themselves
- PP-share comparison remains reconstruction-trustable in the ready heavy-PP case, but coverage warnings confirm that the debug surface still needs better per-window source trace visibility

## Conclusion

Task `3.4` status:

- diagnostics were sufficient to classify real stale-tail blockers
- diagnostics showed no evidence of scale-bound suspicious outputs in the retained validation set
- diagnostics showed that GP-window support is stable
- diagnostics also showed that several ratio families still need caution labels because support completeness is weaker than arithmetic correctness
- mixed-source ambiguity remains only partially observable with the current diagnostics contract and should be treated as an observability gap rather than a proven correctness defect
