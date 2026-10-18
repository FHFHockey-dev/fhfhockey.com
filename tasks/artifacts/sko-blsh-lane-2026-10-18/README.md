# S-16: The Sko Element and Buy Low/Sell High, first diagnostic slice

Lane S-16, sprint 2026-10-18. Inputs:
- the handoffs `planned/01-sko-element-vudu-handoff.md` and `planned/02-buy-low-sell-high-handoff.md`;
- the bundled sources in `planned/sources/` (the four PRD and task files are byte-identical to the repo copies);
- `tasks/artifacts/super-goal-audit-2026-10-17/findings/G6-sustainability-variance-sko.md`.

Everything here is local, fixture-fed and uncommitted. There was no database, provider, Vercel, dev-server or empirical work, and nothing was fitted.

## 1. Reconciliation (current checkout, octoberBranch, HEAD `0de97e77d` plus a dirty tree)

| Surface | What is there now | Decision |
|---|---|---|
| `web/pages/skoCharts.tsx` | A static quarantine notice. It is noindex in both the page and `lib/seo.js`, runs no calculations or reads, and links only to FORGE and Trends. This matches the PRD's snapshot claim. | **Unchanged.** It stays the quarantined lineage route. Nothing is revived. |
| `web/pages/buyLowSellHigh.js` | Legacy page. It reads `select("*")` from `wgo_skater_stats_totals` straight from the browser, with no paging, and has only F/D tabs. It also `console.log`s the data. The 16 header columns don't match the 17 cells (a `plus_minus` cell has no header). A `LegacySurfaceNotice` points to `/underlying-stats`. | **Unchanged and not reused.** Season totals are neither a forecast nor a comparable recent window. Whether to redirect or retain it is a route decision (see section 6). |
| `web/lib/sustainability/*` (score `s_100`, barometer) | Hand-weighted sustainability score family. G6 found the scheduled score chain loses the offset-250 and offset-500 batches, and the drift/quintile `runAll` jobs are inactive, so stored snapshots are partial. Lane S-07 owns `incremental.ts` and `rebuild-score.ts`. | **Not imported** (FR-24). The legacy identity, weights and thresholds are not inherited. The "inconsistent high-score meaning" finding was not re-verified because nothing consumes it. |
| Quarantined sKO writers and readers (`update-predictions-sko`, `get-predictions-sko`, `PredictionsLeaderboard` bundle) | Quarantined per `tasks/TASKS/sko-charts/sko-ownership-contract.md` | **Untouched**, with no imports. |
| `web/lib/player-forecasts/gameExpectations.ts` (`forge-game-expectations-v1`) | Canonical FORGE view. It has `next_n` scheduled-team-game horizons of 1–20 games, with exact game IDs, dates and schedule revision. Each target carries an unconditional (already marginalized) `expected` and a `conditional` value, plus `allowedUses`, source clocks, `expectedAppearances` and `expectedStarts`. Goalies get SV%/GAA as ratio-of-expected-totals. `powerPlayRole` is always `unavailable`. It has **no** intervals, scenarios or class references. | **Reused** as the forecast input through a type-only import. It was not edited, and it is not in the frozen list. Nothing is reweighted or multiplied again. |
| Trends (`/trends`, rolling metrics) | The supported movement surface | Used as a visual reference only. Nothing was copied. |

## 2. Shared contract (`web/lib/skoElement/contract.ts`, `sko-interpretation-v0.1`)

`ObservedEvidence` + FORGE player view + `InterpretationConfig` → `InterpretationRecord` (`interpret.ts`, pure and deterministic).

- **Observed.** Recent completed team games, each with a status of `appeared`, `confirmed_absent` or `unknown`.
  - Per-team-game rates count only confirmed absences as zero. Any `unknown` withholds the rate.
  - Per-appearance rates are kept separate.
  - Rows available after the as-of time are excluded. Invalid or negative rows are rejected. Identical duplicates are dropped. Contradictory duplicates are reported and become `unknown`; they are never summed.
- **Expectation.**
  - Per team game, it is the FORGE unconditional horizon total divided by the scheduled team games.
  - It is gated on horizon match, completeness, `count` unit and forecast expiry.
  - The FORGE conditional per-appearance mean is shown and labeled conditional.
  - `forecastTotals` passes through unchanged for the trade arithmetic.
- **Gap.** `D = expected − recent`, both per team game. The labels are rebound, cooling, level or unavailable. Stale evidence withholds the gap but keeps the observed values.
  - Outlook change against a prior FORGE issuance is a separate field.
  - A league-points view, `weightedPointsGap`, applies explicit weights.
- **Opportunity.**
  - Fields: TOI and PP TOI per appearance for the recent block and the prior block, the dates and appearance counts of both blocks, the change, and the observed duration (history only).
  - Labels: exactly "Opportunity rising; durability uncertain", its falling counterpart, steady, mixed or unknown.
  - With no accepted rule the change is shown as `unclassified`. The fixture rule is marked `provisional_fixture`.
  - The PP role is shown only from dated `roleEvidence`; otherwise it is "unavailable".
  - Scenarios are `not_supplied`.
- **Uncertainty.** Observed game-to-game SD is computed. Predictive spread and mean uncertainty are explicitly `not_supplied_by_forge_v1`.
- **F/D/G.**
  - IPP comes only from matched games and the all-situations strength.
  - It is compared with a separate F or D class reference. A missing reference, a zero denominator or the G class makes it unavailable.
  - VuDu: SV% and GAA from summed primitives, plus FORGE ratios and expected starts passed through. The gap status is `pending_goalie_adapter`.
- **Identity and clocks.** The record carries:
  - the evidence snapshot;
  - the forecast version, manifest, read time and expiry;
  - the baseline checksum;
  - the config ID, version and status;
  - the horizon's game IDs and dates;
  - the evidence age and status;
  - diagnostics and limitations.

Buy Low/Sell High (`web/lib/buyLowSellHigh/`) reads records only:
- **Watchlists** are included by the shared sign, sorted deterministically, and list unavailable rows separately.
- **Market reference.** A gap is shown only when unit, horizon, scoring basis, source, time and freshness all match. Otherwise the page says "Market reference unavailable".
- **Trade.**
  - Give/Receive validation and unmodified FORGE totals.
  - Goalie ratios come from summed primitives. Lower-is-better is kept.
  - Category mode never names a winner. Incomplete inputs never yield a result.
- **Storage** is versioned under its own device-local key and recovers from bad data.

## 3. Requirement-to-evidence ledger (fixture stage)

| Requirement | Evidence |
|---|---|
| 10-game default, 5/20 selectable; no relabeling of short horizons | `interpret.test.ts` "horizons" block; `SkoElementPreview.test.tsx` horizon tests |
| Single application of participation; conditional kept separate | `interpret.test.ts` "does not apply appearance probability a second time" |
| Zero vs unknown; partial participation; stale; conflicts; point-in-time | `interpret.test.ts` "sparse, partial and stale evidence" block |
| Separate F/D IPP references | `interpret.test.ts` "forward and defense separation" block |
| Opportunity label, unknown state, no inferred PP role or scenario | `interpret.test.ts` "opportunity context" block; UI detail test |
| Cooling can coexist with an upgraded outlook; spread does not lower the mean | `interpret.test.ts` outlook and variability tests |
| VuDu ratio primitives and pending adapter | `interpret.test.ts` "VuDu goalie context"; UI VuDu test |
| Market gap only with a comparable reference; quote changes never alter shared records | `market.test.ts` market block |
| Trade arithmetic, mixed horizons, cross-position weights, goalie ratio pooling, unsupported ratio, expired forecast | `trade.test.ts` |
| Device-local persistence, reset and corrupt-data recovery | `storage.test.ts`; UI persistence test |
| Text status beside color, keyboard buttons, `aria-expanded`/`aria-pressed`, no network | the two component tests |

## 4. Goalie data and extract needs (not authorized here)

- **Per-appearance goalie evidence.** Needs saves, on-net shots against, guarded-net goals against and minutes, each with `availableAt`, plus a start versus relief flag. Empty-net events must be kept separate.
- **No VuDu gap.** The skater export authority does not cover a goalie extract. Any empirical goalie validation needs its own bounded study plan, so no VuDu gap is shown.
- **FORGE coverage.** FORGE already exposes `startParticipation` and ratio-of-expected-totals. A goalie adapter would map these together with the evidence above.

## 5. Scheduled-game participation requirements

- **Observed side.** A per-team-game recent rate needs a status for every completed team game. Confirmed scratches, injuries or other absences need a source. A missing row is `unknown`, which withholds the rate.
- **Expected side.** It depends on FORGE participation receipts with `allowedUses.totals`. Otherwise the totals are null and the gap reads `expected_incomplete_horizon` or a similar reason.
- **Live evidence reader.** None exists. The fixture defines `ObservedEvidence`. A live adapter needs an owner and a source that yields confirmed absences and availability times. That source is not verified (candidates: `rolling_player_game_metrics` and the NHL game logs).

## 6. Remaining decisions (TJ or owners)

1. **Final route and slug.** The previews are `/sko-element/preview` and `/buy-low-sell-high/preview`, which return 404 in production builds. Also decide whether legacy `/buyLowSellHigh` redirects or stays.
2. **Recent-window default.** It is provisional at 10 completed team games, with 5/10/20 offered.
3. **Opportunity alert rule.** Magnitude, persistence and hysteresis are undecided. The fixture uses 1.5 TOI minutes, 1.0 PP minutes and 3 appearances, marked illustrative.
4. **Provisional thresholds.** Evidence staleness is 96 h, the sparse-sample threshold is 5 appearances, and market-reference maximum age is 72 h.
5. **IPP references.** Decide the source of the F/D references, and whether PP and even-strength IPP are split. The current contract uses all situations only.
6. **FORGE requests.** Decide whether to ask the FORGE owner for intervals, role and teammate-return scenarios, and class references. All three are upstream gaps.
7. **Live adapter.** Its owner and authorization (SKO task 7.x).

## 7. Unrun or blocked checks

- **Screenshots:** none were taken, because sprint rules allow no dev servers here. The UI is verified by RTL component tests only.
- **`next build`:** not run. No build-specific behavior is involved beyond `getStaticProps` `notFound`.
- **Real-data traces:** none. This is fixture-only, so it says nothing about forecast accuracy or live VuDu readiness.
