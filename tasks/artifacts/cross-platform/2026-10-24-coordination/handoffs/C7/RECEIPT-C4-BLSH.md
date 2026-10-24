# C7 independent review — C4 BLSH-3.1/3.4 detail panel (v2)

**Reviewer:** Claude C7 lane session (not the author). Read-only: no source edits, no Git, no server or browser this ticket, no production. Evidence is in `r6-evidence/c4-blsh/`.

**Verdict: accepted with limits.**

- The fixture-fed detail invents no volatility, confidence or duration formula.
- Source, as-of, coverage, and the supported-versus-unavailable states are always visible.
- Keyboard and focus behaviour hold.
- The shared BLSH and sKO libraries are untouched.

The limits are mainly that the mobile zoom-out fix and touch behaviour rest on C4's own browser measurements.

## Pins

- **Patch:** `C4-BLSH-DETAIL-v2.patch` `b1fa417d…19ec`, which matches and `git apply --check --reverse` cleanly against the working tree.
- **Canonical tree equals v2:**
  - `BuyLowSellHighPreview.tsx` `400ccb4b…`
  - `BlshPlayerDetail.module.scss` `3527dd43…`
  - `BlshPlayerDetail.tsx` `8d599804…`
  - `BuyLowSellHighPreview.test.tsx` `6bf7a3a0…`
- **Untouched**, all git-clean and all equal to C4's listed hashes:
  - `lib/buyLowSellHigh/{market,storage,trade}.ts` `571d55e0…`, `99855ab0…`, `cafbfae3…`
  - `lib/skoElement/{contract,fixtures,interpret}.ts` `36b482d8…`, `b4e7e6b3…`, `660b73c8…`
  - `components/skoElement/format.ts` `7519954a…` and `SkoElement.module.scss` `e8578e66…`

  `git status` shows no change under `lib/buyLowSellHigh`, `lib/skoElement`, `lib/sko` or `components/skoElement`.

## Executed

- **82/82 pass** (`blsh.json`).
- The owner's neighbouring suites total 79: BuyLowSellHighPreview 10, SkoElementPreview 8, market 17, storage 5, trade 11, interpret 22, wigoCharts 6. This reproduces C4's 79/79.
- My 3 controls. Run 1 failed to load because I imported `FIXTURE_LEAGUE` from the wrong module (my mistake; log kept).

| Control | Result |
| --- | --- |
| **D1 provenance** | I rendered `BlshPlayerDetail` for every fixture player × horizons {5, 10, 20} × every skater target plus `LEAGUE_POINTS`: **351 renders**. Every number displayed already exists in the supplied record or its watch row, raw or as formatted by the shared `formatMeasured`. There are **0 strays**. Nothing matches buy/sell-now, a numeric or graded "confidence", or "expected duration/persistence". |
| **D2 keyboard** | Activating a "Details for …" toggle moves focus to the detail's `h2`. Escape closes the detail and returns focus to the originating toggle. Opening a second detail leaves exactly one open, and `aria-expanded` follows. |
| **D3 visibility** | For every fixture record, even with `row = null` and off-list, the detail shows as-of/contract/config, Evidence, Forecast, Horizon, Recent window, Limitations, "Predictive spread", "Confidence: not supplied" and "Not in the current list". |

**Code read:** `BlshPlayerDetail.tsx` (96 lines) does no arithmetic except `evidenceAgeHours?.toFixed(0)` for display. Volatility is `metrics[].observedVariability`, labelled "Recent history, not forecast volatility". For `LEAGUE_POINTS` it lists per-category SDs and **doesn't combine them**. Confidence is the contract's `uncertainty.*`, rendered "Unavailable (not supplied by forge v1)". Duration is `observedDuration`, labelled "History only".

**D1 limit:** the set-based check can't catch a derived value that happens to equal some number already in the record. The code read covers that gap.

## Mobile zoom-out fix (v2)

- **The change:** `.scrollContainer { position: relative; }` is applied to the watch table's `tableWrap` (patch lines 140 and 283), which clips the absolutely positioned visually-hidden spans inside the scroller. The mechanism is sound.
- **Evidence:** this rests on C4's browser measurement (document `scrollWidth` 645 → 320; `innerWidth` 320). jsdom has no layout, so there is no unit regression for it.
- **Screenshot:** `320-detail-variability-confidence-source.jpg` renders at true 320px width and is readable, consistent with that measurement.
- **Not re-run:** I didn't re-run the browser (no server).

## Limits and notes for the owners

- **Touch:** taps were emulated mouse clicks; no real device was used.
- **Cosmetic:** at ≥1024px, panel list items stretch vertically (shared `.panel` grid).
- **SkoElementPreview owner:** `components/skoElement/SkoElementPreview.tsx` may have the same hidden-span overflow ("Details for …" spans in the last column). It is untested, and C4 correctly did not edit it.
- **Requests for the reserved owners:** a real confidence or predictive interval, forward-looking volatility, an accepted persistence rule and sort keys. These are correctly left unimplemented.
- **Not live or release acceptance:** BLSH-4.2–4.4 remain held.
