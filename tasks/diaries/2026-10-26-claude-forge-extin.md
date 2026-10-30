# FORGE-EXTIN diary (Claude, 2026-10-26)

## Scope
Audit every live FORGE run input for external fantasy sources. If clean, claim the exclusion contract (+ allowlist test, modelIdentity type); if not, stop and report.

## Outcome
- External fantasy input FOUND: skater-stage loadSeasonBootstrap(..., true) at :1559/:1713 reads 4 default-selected PROJECTIONS_20262027_*_SKATERS tables (A&G, Cullen, DTZ, 5v5) and blends them into the skater heads incl. SOG (fantasyShare 0.6 × (1 − GP/20)). Gate: STARTER_BOARD_SEASON_BOOTSTRAP_ENABLED on a live h1 run. Goalies pass false.
- Per ticket rule 3: STOPPED, no code changed. Audit: tasks/artifacts/rso-wave2-2026-10-25/FORGE-QUAL/EXTERNAL-INPUT-AUDIT.md.
- Recommended option for TJ: derive the label from the run's captured reads (claim only when no PROJECTION_SOURCES_CONFIG table was read).

## Gaps
Derived-table writers not traced; production bootstrap env unknown.

## Next
TJ decision (options 1-4 in the audit). No RECEIPT-2 (no code change).

## Step 2 (TJ option 1), done
- Live snapshot claims the exclusion iff readsExcludeExternalFantasy(capture.reads); reconstruction and metrics never claim (keeps the qualify-native-players-offline premise; not leased).
- New test file (13) failed on baseline, now passes; the local-attempt real-producer run confirms the allowlist covers actual reads.
- 1894/1901 (7 pre-existing skips); scoped + whole tsc 0; eslint 0. RECEIPT-2.md written. Not committed.

## Redirect (TJ: no fantasy projection tables in FORGE), done
- Removed the fantasy branch from loadSeasonBootstrap (param, config imports, fantasySourcePerGame); skater/goalie calls take 4 args; history keeps its 0.4×(1−p) weight; disclosure keeps fantasyWeight 0 / sourceIds [] for readers.
- Version: TJ pop-up = rely on codeVersion (no modelMode/disclosure bump).
- Tests: boundary test over all lib/projections; dynamic zero-fantasy-read tests; startChartPipeline bootstrap cases updated. 3287 passed / 8 skipped across 110 files; scoped + whole tsc 0; eslint 0.
- Found: lib/player-forecasts/baselinePolicy.ts native baselines also use the 4 fantasy sources (out of lease) → reported.
- RECEIPT-2.md rewritten with before/after. Not committed. Keep this diary until the orchestrator records the commit.
