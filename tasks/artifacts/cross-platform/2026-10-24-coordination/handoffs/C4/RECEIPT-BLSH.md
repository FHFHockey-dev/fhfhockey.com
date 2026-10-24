# C4 receipt — BLSH-3.1/3.4 fixture-fed candidate detail (code, tests and browser evidence)

Lane: C4 (Claude), ticket 2. Stable IDs: BLSH-3.1 (detail panel with opportunity, volatility, confidence and observed duration) and BLSH-3.4 (keyboard/touch explanation controls, visible limitations).

Status: **implementation, unit and local browser verification complete. The candidate is now v2 (see "v2 revision"), and the :3110 slot is released** (server stopped; no listener on 3110 at 2026-10-24T17:02:09Z). No Git writes and no production access. The run was network-guarded: zero outbound application requests. Codex vets.

## v2 revision (found during the browser run)

- **Problem:** at 320/390px emulated phone widths, the page's layout viewport widened to 645px (`innerWidth` 645), so a phone would render the page zoomed out.
- **Cause:** the pre-existing Watch buttons' visually hidden name spans (`styles.visuallyHidden` is `position: absolute` and has no positioned ancestor). They sit in the last table column, escape the `tableWrap` scroller, and land at x≈645. The same markup exists in the baseline, so this predates C4. BLSH-3.4 covers mobile list layout, and the fix is confined to leased files.
- **Fix:** a new `.scrollContainer { position: relative; }` in `BlshPlayerDetail.module.scss`, applied to the watch table's `tableWrap` in `BuyLowSellHighPreview.tsx` (1 line). The hidden spans are now clipped inside the scroller.
- **Measured after the fix at 320px:** document `scrollWidth` 320 (was 645); scroller 650/294 scrolls internally; `innerWidth` 320.
- **Coverage gap:** there is no unit regression for this because jsdom has no layout. The browser measurements are the evidence.
- **Same pattern in a read-only file:** `components/skoElement/SkoElementPreview.tsx` may have the same issue via its "Details for …" hidden spans in the last column. That file is read-only for C4, so this is a note for its owner only; it was not tested here.

| Path | v1 (superseded) | **v2 candidate** |
| --- | --- | --- |
| web/components/buyLowSellHigh/BuyLowSellHighPreview.tsx | `58d00efe…64a5` | `400ccb4b711560ae32168deba45d371301f79199ad704b695b678091b40135e0` |
| web/components/buyLowSellHigh/BlshPlayerDetail.module.scss | `75dd6cba…2fea` | `3527dd432fb53cafdb426e69b08e395e684103fb85ca512c0743a0b37e200cff` |
| web/components/buyLowSellHigh/BlshPlayerDetail.tsx | `8d599804…3fb3b` | unchanged `8d599804461848e162fa566bea5e571375f45f965bbc54afbbc3b3475613fb3b` |
| web/components/buyLowSellHigh/BuyLowSellHighPreview.test.tsx | `6bf7a3a0…86c7` | unchanged `6bf7a3a0e9788564ab4889b5377634be1aefccf730f0c8aa56c187ce643d86c7` |

- **Use** `handoffs/C4/C4-BLSH-DETAIL-v2.patch` (`b1fa417dad912f57d9a51a201a740d21be0bf0ea7edb8220528096f3731d19ec`). It runs from HEAD to v2 across the same 4 paths, and `git apply --check --reverse` passes against the working tree.
- `C4-BLSH-DETAIL.patch` (`3becd6da…`) is **superseded**. It is kept unmodified for traceability.
- **v2 re-checks:**
  - `npm test -- components/buyLowSellHigh components/skoElement lib/buyLowSellHigh lib/skoElement __tests__/pages/wigoCharts.test.tsx`: 7 files, 79/79 pass.
  - `npx eslint` passes.
  - The CSS-module pure check passes on v2 `BlshPlayerDetail.module.scss`.

## Browser evidence (v2, isolated :3110)

**Server:** `PLAYWRIGHT_ISOLATED_NEXT=1 npx next dev -p 3110` with three layers of protection:
1. **Network guard** (`NODE_OPTIONS=--require <path>/net-guard.cjs`; a copy is at `handoffs/C4/harness/net-guard.cjs` for reuse by other lanes). It refuses `net`/`tls` connects and `fetch` to anything except loopback ports other than 3000 and 3105, and logs each refusal.
   - It was tested first: the NHL API, production Supabase and `localhost:3000` were refused via both `fetch` and a raw socket, while loopback :3199 was allowed.
2. **Inert env:** every backend URL, including `NEXT_PUBLIC_SITE_URL`, pointed at `c4-fixture.invalid`; keys were synthetic or empty.
3. **Fixture-only page:** the BLSH page renders static fixtures and makes no data request.

**Outbound result:**
- The guard log has 1 entry, Next's own npm version check (`registry.npmjs.org`), and it was blocked.
- The server log shows no API request.
- The browser network list contains only `localhost:3110` URLs.
- TJ's :3000 was never contacted.

Screenshots in `handoffs/C4/screenshots/blsh/` (sha256):

| File | Shows |
| --- | --- |
| `320-list-toggles.jpg` `be33ba39…77a` | List at 320px with Details toggles in the player column; toggle is 63×44px. |
| `320-keyboard-enter-detail-open.jpg` `f2635609…7d07` | Real Enter on the focused toggle opens the detail. Focus moves to the heading (`:focus-visible`, 2px solid). Toggle reads "Hide details" with `aria-expanded=true`. Close is 56×44px. |
| `320-detail-variability-confidence-source.jpg` `2ba79a91…284b` | Observed SD labelled as history; predictive spread and mean uncertainty "Unavailable (not supplied by forge v1)"; "Confidence: not supplied"; fixture, contract and config status; evidence and forecast clocks; horizon and recent-window coverage; limitations. |
| `320-escape-focus-returns-to-toggle.jpg` `8137d688…a793` | Real Escape closes the detail. Focus returns to "Details for Fixture Forward Three" with a visible focus ring and `aria-expanded=false`. |
| `390-touch-tap-detail-sparse.jpg` `ca183d97…9e1e9` | Tap (390px, mobile emulation) opens Fixture Defense Two, showing "2 appearances … sparse sample", "Opportunity unknown: too few appearances", PP role unavailable. |
| `390-unranked-level-toggles.jpg` `162c7843…77a` | Tapping the Unranked/level disclosure reveals the stale, unknown-status, pending-goalie and level rows, each with a 44px Details toggle. Tap Close returned focus to its toggle. |
| `390-touch-stale-evidence-detail.jpg` `af8eb6cb…cea` | Stale player: "age 199 h (stale)", "Observed evidence is stale; gaps are withheld", plus the "Not in the current list" notice. |
| `1024-keyboard-cooling-list-detail.jpg` `85842d66…efc3` | Keyboard only: Enter on Cooling watch, then Tab to "Details for Fixture Forward Five", then Enter. Shows the three-panel detail under the list. Document 1009px ≤ 1024 (scrollbar), no horizontal overflow. |
| `1440-cooling-list-detail.jpg` `4a939930…8cea` | Same state at 1440px; document 1425px, no overflow. |

Limits:
- Taps in emulated touch viewports are delivered as mouse clicks (`maxTouchPoints` reported 0), not real touch events.
- The pointer-opened heading shows no focus ring, which is correct `:focus-visible` behavior.
- **Cosmetic, not fixed:** at ≥1024px, the list items in the shorter Gap and Variability panels spread out vertically to match the tallest panel. This comes from the shared `.panel` grid stretch.
- No real device was used.

## Input contract: qualified, consumed read-only

The slice uses the existing typed contract and changes none of it:
- `InterpretationRecord` (`sko-interpretation-v0.1`, `web/lib/skoElement/contract.ts`);
- the synthetic bundle `fixtureRecords(horizon)` (`fixtures.ts`: fictional FX teams, `fixture: true`);
- `buildWatchlists`/`WatchRow` (`lib/buyLowSellHigh/market.ts`).

Each 3.1 term maps to an existing field, passed through without arithmetic:

| 3.1 term | Contract field shown | How it is labelled |
| --- | --- | --- |
| opportunity | `opportunity.label`, recent block, `toiChangeMinutes`, `ppToiChangeMinutes`, `powerPlayRole`, `ruleId`/`ruleStatus` | Rule status shown, e.g. "provisional fixture" |
| observed duration | `opportunity.observedDuration` | "History only; not a forecast of how long it lasts." |
| volatility | `metrics[target].observedVariability` (sample SD of observed per-team-game values) | "Observed game-to-game SD … Recent history, not forecast volatility." For weighted league points, the per-category SDs are listed rather than a new combined SD. |
| confidence | `uncertainty.predictiveSpread`, `uncertainty.meanUncertainty` | Both shown as `Unavailable (not supplied by forge v1)`, plus "Confidence: not supplied. No confidence rating is derived on this page." |

Source, as-of and coverage are always visible in the detail:
- fixture flag, `asOf`, contract version and config status;
- evidence snapshot, cutoff, age and status, plus retrospective flag;
- forecast version, manifest, readAsOf, expiry and status;
- horizon scheduled vs requested, with its reason;
- recent window appearances, confirmed absences and unknown games;
- duplicate, invalid and conflicting source-row diagnostics;
- the record's own `limitations[]`.

No formula, threshold, confidence, duration or forecast semantics were added. Shared files were not edited.

## Change

- **New `BlshPlayerDetail.tsx`.** A read-only `<section aria-labelledby>` detail containing:
  - the gap for the selected target;
  - Opportunity and observed duration;
  - Variability and confidence;
  - Source, as-of and coverage, plus Limitations;
  - a "Not in the current list…" warning when settings move the player off the visible list (for example Fixture Forward Three at horizon 20, where only 14 of 20 games are scheduled).
- **New `BlshPlayerDetail.module.scss`.**
  - `.touchButton` gives toggle and Close controls a 44×44px minimum.
  - Visible `:focus-visible` outlines on those buttons and the heading.
  - `scroll-margin-top` on the panel.
- **`BuyLowSellHighPreview.tsx`: list/detail wiring.**
  - Each Rebound/Cooling row gets a "Details" toggle in its row-header cell, so it stays visible when the table scrolls sideways on narrow screens.
  - Unranked and level players get the same toggle, which makes stale, partial, conflicting and goalie records explorable.
  - The toggle uses `aria-expanded`/`aria-controls`. Opening moves focus to the detail heading. Escape or Close dismisses it and returns focus to the originating toggle. One detail is open at a time.
- **Unchanged:** the watchlist inclusion rule, ordering, market and trade logic, storage, and the page route `pages/buy-low-sell-high/preview.tsx`.

## Hashes

Base HEAD: `2a5092d37cb863ec92a2a4e609999cf226bfa4a5`.

| Path | baseline | candidate |
| --- | --- | --- |
| web/components/buyLowSellHigh/BuyLowSellHighPreview.tsx | `2f2141c56fca99e87cf91153a1c190c53f0aa2d51d66fe76637b73642ff314d9` (matches lease) | `58d00efe80f13ffec8fdc106f0dc29266535f9881aedd13ebc6bedac32f664a5` |
| web/components/buyLowSellHigh/BuyLowSellHighPreview.test.tsx | `4707412981f71c191ad0aa75a1bca1a62df633d62077df035b7df41a0c173efc` (matches lease) | `6bf7a3a0e9788564ab4889b5377634be1aefccf730f0c8aa56c187ce643d86c7` |
| web/components/buyLowSellHigh/BlshPlayerDetail.tsx | new | `8d599804461848e162fa566bea5e571375f45f965bbc54afbbc3b3475613fb3b` |
| web/components/buyLowSellHigh/BlshPlayerDetail.module.scss | new | `75dd6cbad93b4b467bf0a05b2c94bfb899954bca28f79c59f5f6da2c0fb72fea` |

Patch `handoffs/C4/C4-BLSH-DETAIL.patch` `3becd6dabeb556dab77426707b3cc09925aa8150206f4ebbf165d62d02ce451d`. It covers the 4 paths above, and `git apply --check --reverse` passes against the working tree.

Read-only dependencies (unchanged; `git status` clean):

- web/lib/skoElement/contract.ts `36b482d8fd0b5916eb2c7c5398ea8c2c8dacfe5491a871d5d3494dc1120f0702`
- web/lib/skoElement/fixtures.ts `b4e7e6b31c9fd9d1e541aba1e0f19993caa413bab8112b1cd05bc10e1b7f2fa2`
- web/lib/skoElement/interpret.ts `660b73c836041f867f6207d0fa89e391570de6422a019bd4e3c5e46fddbf6466`
- web/lib/buyLowSellHigh/market.ts `571d55e04deb24fbdc27174e63a5ca1817bc43c75750d6e19219038950bdc442`
- web/lib/buyLowSellHigh/storage.ts `99855ab0a9d00c38e06745193c015be100e65c52bc57c6f0e3c465d4f85aeadc`
- web/lib/buyLowSellHigh/trade.ts `cafbfae310001084850704df9afd3cb0287d29a10709bed50e73cf219b67db79`
- web/components/skoElement/format.ts `7519954a3a30b150eca338dbb3b4c8064ec5eaab1475fa1a5c135573cd72246b`
- web/components/skoElement/SkoElement.module.scss `e8578e661f88170d15cad4adfa3044095d4a6353eede71fdbc1a2dba3505fe43`

## Checks (actually run)

- **`npm test -- components/buyLowSellHigh/BuyLowSellHighPreview.test.tsx`: 10/10 pass.** The 5 original tests are unchanged and the 5 new ones are:
  1. The detail shows passed-through opportunity, observed duration and observed SD, "Predictive spread: Unavailable (not supplied by forge v1).", "Confidence: not supplied", the fixture/as-of/contract line, horizon coverage and limitations. Focus moves to the heading, `aria-expanded`/`aria-controls` are set, and there is no buy/sell-now text.
  2. Escape, and separately Close, dismiss the detail and return focus to the row toggle. Sparse-sample status is visible (Fixture Defense Two).
  3. Changing the horizon to 20 keeps the detail open for Fixture Forward Three with "Not in the current list", "14 of 20 requested team games scheduled" and the gap shown as `Unavailable (expected incomplete horizon)`.
  4. Details open from the unranked list: stale evidence (Defense Three), "1 conflicting games" (Forward Nine), and the goalie (opportunity and SD "unavailable for this record", gap pending goalie adapter). Opening one closes the previous.
  5. Ranked by fixture league points, the detail lists per-category SDs and does not derive a combined one.
- **Regression control:** with the baseline preview restored temporarily, the 5 new tests fail and the 5 original pass; the candidate was then restored.
- **Neighbouring suites:** `npm test -- components/buyLowSellHigh components/skoElement lib/buyLowSellHigh lib/skoElement`: 6 files, 73/73 pass.
- **`npx eslint components/buyLowSellHigh`:** pass.
- **CSS-module pure check** (Sass compile, then Next's `postcss-modules-local-by-default` in `mode: "pure"`, script at session scratchpad `purecheck.cjs`): `BlshPlayerDetail.module.scss` passes. A negative control with `div {}` is correctly rejected.
- **`npx tsc --noEmit` (8 GB heap): exit 2.** Its 3 errors are all `Buffer`→`BinaryLike` in other lanes' files: `e2e/social-share.spec.ts:335`, `lib/sources/tweetLunaReview.test.ts:192` and `scripts/review-ifttt-luna.ts:22`. None are in C4 files.

## Pending

- Independent review (C7 or Codex) of v2.
- The SkoElementPreview overflow note goes to that file's owner.
- Integration stays with Codex.

The "Hashes" and "Checks" sections above describe v1. v2 supersedes them as recorded in "v2 revision".

## Input-contract requests (not implemented; for the reserved owners)

1. **Confidence (BLSH-3.1).** The contract only has `uncertainty.predictiveSpread`/`meanUncertainty`, both `not_supplied_by_forge_v1`. A confidence display needs FORGE (Codex/scientific owner) to supply a predictive interval or spread per target and horizon, with its unit, coverage level and method/version. Until then the UI shows "not supplied".
2. **Volatility as a forward-looking term.** Only observed SD exists. Any forecast-volatility or regime-persistence measure needs an accepted definition and field from the scientific owner.
3. **Duration beyond history.** `observedDuration` is history only. Expected persistence or hysteresis needs an accepted `OpportunityRule` (status `accepted`) with magnitude and persistence semantics. The current fixture rule is `provisional_fixture`.
4. **Sortable candidate rows (rest of 3.1).** These were not in this slice. Sorting by anything other than the shared signed gap (for example by observed SD or TOI change) changes what "ranked" means, so the product owner should name the allowed sort keys and confirm unavailable values stay last.
5. **BLSH-2.2 and BLSH-4.1:** unchanged and held. They need expected appearances and common-date inputs, and the batched serving reader, from their reserved owners.

## Preserved / out of scope

Shared `lib/skoElement/**`, `lib/sko/**`, `lib/buyLowSellHigh/**` and `components/skoElement/**` are read-only and unchanged. There are no nav, Game Grid, page-route, or forecast/sKO formula changes, and no Git operations. This is not live, trace, parity or release acceptance (BLSH-4.2–4.4 remain held).
