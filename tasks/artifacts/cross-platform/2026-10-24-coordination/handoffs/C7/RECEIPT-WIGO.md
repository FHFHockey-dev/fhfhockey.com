# C7 independent review — WiGO one-page redesign, logic fixes and spec replacement (uncommitted)

**Verdict: accepted with limits.**
- **Holds:**
  - the one-page, no-scroll layout at ≥ 1280×800, by its measurements, its e2e and my viewing of the screenshot;
  - the five logic fixes, which match the audit;
  - the released reader fix, which is preserved;
  - the fixtures, which are fictional;
  - the old spec's deletion, which is justified.
- **Limits:** one low data-source finding (W1) and two receipt-text inconsistencies.

**Reviewer:** Claude C7 lane session (not the author). Read-only: no edits, no Git, no live reads, and no server. Unit tests ran under the outbound network-deny preload. Evidence is in `r18-evidence/wigo/`.

## Pins

- **Commit paths:** all **32** entries in `COMMIT-PATHS.txt` match the canonical tree (27 modified and 4 added match their hashes; 1 deleted, `e2e/wigo-single-viewport.spec.ts`, is absent).
- **Patch:** `WIGO-ONE-PAGE.patch` = `3f056f08…`, which `git apply --check --reverse` accepts cleanly against the tree.
- **Untouched:** `lib/navigation/siteSurfaceLinks.ts` (`getWigoSurfaceLinks` is now unused).
- **No references left** to the deleted spec in `web/` or `.github/`.

## Layout: one page, nothing hidden or truncated

- **Screenshot:** I viewed `screenshots/after/after-1280x800.png`. Every panel is visible on one screen inside the ~90% workspace, with no cut-off text:
  - identity, season production, pace, schedule, ratings, team drivers;
  - the transposed 36-metric matrix, point consistency, category percentiles;
  - the selected-stat log, TOI, P/GP, game score, and rate percentiles.
- **Measurements** (`after-measurements.json`, 1440×900): document = viewport; all 15 coverage blocks, C01–C19, inside; `overflowing: 0`; `smallTextUnder11: 0`.
- **E2E** (`e2e-canonical.txt`): **7/7** on the canonical spec.
  - At 1280×800, 1440×900 and 1920×1080, the measure function checks:
    - document = viewport;
    - every `[data-coverage]` panel inside it;
    - no element with `scrollWidth > clientWidth` or `scrollHeight > clientHeight`, which catches ellipsis truncation;
    - no `th`/`td` text outside its cell;
    - no text under 11px.
  - It ignores only visually-hidden text and closed `<details>`, which are the ⓘ methodology popovers, not components.
  - Also covered: 1024×768 and 1280×700 flow without clipping; matrix selection; the long-name and no-player states.

## Logic fixes against `AUDIT-REPORT.md`

| ID | Audit claim | Code | Result |
| --- | --- | --- | --- |
| B-01 (P0) | S%, PP% and PTS1% logs were 0–1 against 0–100 reference lines | WGO `percent_decimal` values go through `normalizeWigoAggregateValue`; PTS1% is ×100; NST percentages are untouched (scale unverified) | Holds |
| B-02 (P0) | Ratings showed 50.0 when the cohort was only the target | `minCohortPeers = 20`; below that the rating shows "-" and the ⓘ text says so. A **visible behaviour change** early in the season, as disclosed | Holds |
| B-09 (P1) | PP/60 charts read non-existent NST columns | Per game, the WGO PP count × 3600 / PP seconds; no PP time gives `null`, not 0 | Holds, with **W1** |
| A-04 (P1) | A major penalty (PPG > PPO) wiped season PP% and PK% | The per-game ≤ checks are dropped; integer and non-negative checks stay | Holds |
| C-06 (P1) | The TOI axis was capped at 30:00 | `suggestedMax` (a floor) | Holds |

Each fix has a focused test. **My unit run: 168/168 in 22 files** (`wigo.json`): `components/WiGO/**`, the page test, `fetchWigoPlayerStats`, `calculateWigoRatings`, `fetchWigoPercentiles`, `calculatePercentiles` and `usePercentileRank`.

## Released `fetchWigoPlayerStats` fix preserved

- The fix released in `cb8ed5217` made recent rates come from the `wigo_recent` snapshot, authoritative over the legacy fields. Its code is intact (`:284` "Recent rates and their coverage come from the same wigo_recent snapshot", `:618`).
- The working-tree diff of `fetchWigoPlayerStats.test.ts` **removes no lines**, so the released `it.each` "keeps supported recent rates authoritative…" test is unchanged.

## Fixtures are fictional

`e2e/fixtures/wigo/wigoFixtures.ts`:
- Player ids are 9900001–9900005, cohort ids 9910000+ and game ids 990000001+. A grep for 84xxxxx/847xxxx/848xxxx NHL-range ids finds none.
- Names are "Alex Fictional", "Jean-Christophe Beauvillier-Johnson" (the long-name case) and the "Sam Sample" default.
- Headshot and URL columns return `null`.
- `schema.json` holds only column names and types.
- Team names and ids are public NHL values, used for colours and the schedule.

## Deleting the old spec is justified

At HEAD, `wigo-single-viewport.spec.ts` routed `**/rest/v1/**` GET and HEAD with `route.continue()`, meaning live Supabase. It also left the other reads unrouted, and it asserted the retired 1920-only layout with a 12px floor. It could not run without production reads.
- **Coverage it held still exists elsewhere:** the radar timeout and retry behaviour stays covered by `hooks/usePercentileRank.test.tsx` ("recovers from a transient timeout with one bounded retry", "exposes a persistent source failure after two attempts") and by `RateStatPercentiles.test.tsx`.
- **Superseded by the new spec:** the layout and matrix checks.

## Findings (to the WiGO owner)

| # | Severity | Finding |
| --- | --- | --- |
| **W1** | Low | **B-09 reads a different PP-time column than the writer it claims to match.** The reader divides by `wgo_skater_stats.pp_toi_per_game`, from NHL's goals-for/against report. `calculate-wigo-stats` builds its per-60s from `wgoGame.pp_toi` (`:386` → `wgo_pp_toi`, from the power-play report). `fetchRollingPlayerAverages` also prefers `pp_toi ?? pp_toi_per_game`. Both should be per-game PP seconds, but the audit's "same definition as the writer" isn't literally true, and if `pp_toi_per_game` is unpopulated live the charts show nulls. It fails safe, with no false values. Suggested change: read `pp_toi ?? pp_toi_per_game`, as the rolling pipeline does. |
| **W2** | Doc | `RECEIPT.md` contradicts itself on the patch hash. The top section says `3f056f08…`, which matches the file; the "Delivery" section still says `14a81825…`, an earlier snapshot patch. Use `3f056f08…`. |
| **W3** | Doc | The canonical Vitest figure is "23 files, 182/182", but `vitest-summary.txt` (and my run of the listed scope) show 22 files, 168/168. The 23rd file isn't named. Name it or correct the count. |
| **W4** | Info | The canonical whole-project `tsc` had **1 error outside WiGO** (`lib/player-cards/evidenceLoader.ts(106,46)`, another lane's in-progress file). There are 0 in WiGO or e2e files. |
| **W5** | Info | Open audit items (A-01/02, B-03–B-08, B-10–B-13, C-01–C-05, the P2 fetch redundancy, the blank first paint B-24) stay open as listed; some need ask-first writer recomputes. The disclosed process slips (one read-only `git rev-parse`, and an aborted heredoc mishap followed by a 28-hash re-verification) did not change any file. |
