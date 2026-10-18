# S-16 diary, 2026-10-18

**Session:** S-16 (started by Chef `local_08a0bf1c`). Local and uncommitted throughout. There was no git mutation, database, Vercel, provider or dev-server use, and nothing was fitted or extracted.

## What happened

1. **Read the inputs.** Both handoffs, all nine bundled sources (the four PRD/task files match the repo byte-for-byte), the sprint register, the G6 audit findings and the sKO ownership contract. The sibling notes in the shared folder had nothing on SKO or BLSH.
2. **Reconciled the code.**
   - `/skoCharts` is a static quarantine notice.
   - `/buyLowSellHigh.js` reads retained season totals without paging and has a header/cell mismatch.
   - `lib/sustainability` is partial at the population level (per G6) and is S-07's lane.
   - FORGE `forge-game-expectations-v1` already gives exact `next_n` 5/10/20 team-game horizons, unconditional vs conditional values, participation, and goalie ratio-of-totals. That made it the natural reuse point: a type-only import with no edits.
3. **Sent Chef the owned-file list.**
4. **Wrote the shared contract and pure interpreter, then the synthetic fixtures** (12 players: every FR-25 scenario plus partial participation and conflicting rows). 22 tests passed first run.
5. **Wrote the BLSH market, trade and storage modules.** The first test run caught a real bug in `compareTrade`: a missing goalie primitive on one side was hidden whenever the other side had no goalies, so an incomplete trade looked complete. Fixed, with a regression test.
6. **Wrote the two fixture-fed preview components, the pages and the component tests.**
   - Pages: `getStaticProps` returns `notFound` in production builds, and the pages are noindex.
   - URL state: selections push history entries; search replaces the current one.
7. **Checks.**
   - Focused Vitest: 6 files, 68 tests, passing.
   - ESLint on all new files: clean.
   - Full `tsc`: the first run (behind the heavy lock) died at the default Node heap with exit 134. The retry with an 8 GB heap finished with 4 errors, all in other lanes' files and none in S-16 files: `GameGrid/LeagueWeek.test.tsx`, `rollingPlayerValidationPayload.test.ts`, `ingest-projection-inputs.ts` and `sweep-gamecenter-normalization.ts`.
8. **Docs.** Added a one-line status to each PRD. Annotated each task list: items marked `[x]` only where tests or code show them done, and partial items left unchecked with a note.

## Negative findings preserved

- No predictive score, threshold or weight is accepted. The fixture opportunity rule, staleness window and sparse threshold are labeled provisional.
- FORGE v1 has no intervals, scenarios, PP-role receipts or class references. The UI shows each of these as unavailable rather than inventing it.
- There is no VuDu gap: no goalie extract or adapter exists.

## Not done

- Screenshots (no dev servers allowed in the sprint).
- Flag-history first-detection time.
- PP/ES IPP split.
- Revised-source and season-boundary cases.
- BLSH per-player detail panel.
- Live adapter.

## Follow-up ticket from Chef: sKO quarantine registry (G6 P3, C0044 / sko-charts NEW 10.0)

**Inventory.**
- I found files by sKO name, by the "Legacy sKO-only" header and by import tracing. The quarantined set is 26 files in four groups:
  - **Writer and read API (compatibility-only):** 4 files.
  - **Reader/UI bundle:** the hook, all 10 `components/Predictions` files (including the scss) and `lib/trends/sko*`.
  - **Legacy formula family:** 5 files in `lib/supabase/utils` (calculations, statistics, dataFetching, types and constants), 2 in `GameScoreChart` and `SkoLineChart/LineChart`.
  - **The `/skoCharts` route.**
- Every other sKO-named file is in an explicit exclusion list with a reason: the operational `update-sko-stats` writer, the `fetchSKO*` scripts, the output-authority script, 6 legacy SQL files (classification open), and the new Sko Element paths.

**Registry and test.**
- Changed `web/lib/predictions/legacyQuarantine.ts` and its test.
- The three historical-only groups record the 2026-07-28 owner decision.
- The test scans `web/` and fails on any unregistered sKO-named or header-marked file. A throwaway probe file confirmed it fails. It also fails on a duplicate or missing path, or a stale exclusion.
- No quarantined file was edited.
