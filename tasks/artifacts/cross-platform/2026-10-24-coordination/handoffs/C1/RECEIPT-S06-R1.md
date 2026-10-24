# C1 receipt: STATS-S06 R1, overflow skater truthfulness

- Lane C1, Claude session, 2026-10-24. This answers C7 findings C1-F1 (medium) and C1-F2 (low) in `handoffs/C7/RECEIPT-C1-C4.md`.
- Status: **implementation candidate with screenshots; not re-reviewed, integrated or released**. `RECEIPT.md` and `RECEIPT-S05.md` are not edited.
- Base: the S06 candidate, i.e. `C1-S06.patch` `ecef9b66…` applied to `2a5092d37`:
  - `LineCombinationsGrid.tsx` `7ee607b7…`
  - `TeamTabNavigation.test.tsx` `8ca993b0…`
- Patch: `handoffs/C1/C1-S06-R1.patch`, sha256 `f7c5bf62894d2e9b4ea11b951d04b34a6c73a111c29608a9519f366828b769b9`, two files and incremental on top of S06. `git apply --check` is clean on a copy of the S06 candidate, and the result reproduces the candidate hashes:
  - `web/components/LineCombinations/LineCombinationsGrid.tsx` → `fb5c6a3c0d50f1c9f1abca1de82527420cc240b3ba3c4b125c466485b18c6de7`
  - `web/components/TeamTabNavigation/TeamTabNavigation.test.tsx` → `6312ca9177389c01db342826b4833f99facc9729ddbacd4f737b21ae245dbae0`
- No other files changed: no CSS, no other S06 file and no S05 file. No Git.

## Change and why this option

- The grid shows 4 forward lines (12 slots), 3 pairs (6) and 2 goalies. Anyone beyond that stays **in their own group**, in a labelled extras row under that group's grid:
  - "Extra F · 13F/5D" holds F13 and F14 in the Forwards section;
  - "Extra D · 11F/7D" holds D7 and D8 in the Defense section;
  - "Extra G" holds a third goalie.
- Each extras row is a `role="group"` with that label and a tooltip: "Dressed beyond the regular lines; no line or pair in the source". Forwards, Defense and Goalies are now labelled groups too.
- **No skater takes another group's slot.** This also removes the HEAD-era 11F/7D placement of D7 in the forwards' C4 slot. Open slots stay empty: 11F leaves C4 empty, 5D leaves E3 empty.
- **No silent loss (C1-F2).** With 19 or more skaters (13F/6D, 12F/7D) or 3 goalies, everyone is rendered, so the extra row doubles as the omission notice.
- **Why not "label the borrowed cell".** Any card inside the Defense pairs still reads as a pair partner. The source (`update-line-combinations`) stores only line-sorted ID arrays per position group, so it has no deployment for extras. Showing them as unassigned members of their own group asserts only what the data contains: who dressed, and their position group.
- The extras grid uses inline `gridTemplateColumns` on the existing `lineCombinationsSectionGrid`, so no shared stylesheet was edited. The panel already scrolls (`lineCombinationsFixedHeight`, `overflow: auto`).

## Verification (run in `web/`)

- Regressions for 13F/5D, 14F/4D, 11F/7D, 10F/8D, 13F/6D, 12F/7D and 12F/6D, each with 3 goalies. For every shape they assert:
  - the regular Forwards and Defense cards are exactly F1–12 and D1–6;
  - each section contains only its own group;
  - the extras groups hold exactly the overflow;
  - the total card count equals everyone dressed.
- **Against the S06 grid:** 7/7 fail (`fixture-harness/r1-against-s06-run.txt`; swap and hash-verified restore in `r1-swap.sh`). 12F/6D fails there only because the group labels and the 3rd goalie are new.
- **Candidate:** `npx vitest run hooks/useShotData.test.tsx components/TeamTabNavigation/TeamTabNavigation.test.tsx __tests__/pages/stats/team/teamAbbreviation.test.tsx components/GoalieShareChart` **passed, 62/62**.
- `npx eslint` on both files: **passed** (0 problems).
- Whole-project `npx tsc --noEmit`: 8 GB heap, under `/private/tmp/fhfh-heavy.lock`, released afterwards. **Failed, exit 2**, with 2 errors and none in C1 files (`tsc-s06-r1-2026-10-24.txt`). Both are the pre-existing Luna errors: `lib/sources/tweetLunaReview.test.ts:192` and `scripts/review-ifttt-luna.ts:22`. The `e2e/social-share.spec.ts` error from the S05 run no longer appears.

## Screenshots (`handoffs/C1/screenshots-s06-r1/`)

- **Setup.** Same harness: isolated Next on 127.0.0.1:3110 with `fixture-harness/pgrst-stub.mjs`, and every other request aborted. The stub's lineups are:
  - TOR 13F/5D
  - BOS 14F/4D
  - BUF 10F/8D
  - MTL 11F/7D
  - EDM 12F/6D
- **Captures** (`capture-s06r1.mjs`): `{TOR,BOS,BUF,MTL,EDM}-lines-{320,390,1024,1440}.png` and `EDM-shotmap-{320,390,1024,1440}.png`.
  - At 320 and 390 the lines panel is a fixed-height scroll area, so `{TOR,BOS,BUF,MTL}-lines-{320,390}-extras-visible.png` show the extras row scrolled into view (`capture-s06r1-scrolled.mjs`).
- **Measured in the DOM at every width** (`report.json`):

  | Team | Shape | Extras row |
  | --- | --- | --- |
  | TOR | 13F/5D | "Extra F · 13F/5D" [Leafs13] |
  | BOS | 14F/4D | "Extra F · 14F/4D" [Bruins13, Bruins14] |
  | BUF | 10F/8D | "Extra D · 10F/8D" [Sabres27, Sabres28] |
  | MTL | 11F/7D | "Extra D · 11F/7D" [Canadiens27] |
  | EDM | 12F/6D | none |

  The Forwards/Defense/Goalies groups hold exactly each team's own counts (for example BOS 14/4/2). Document horizontal overflow is 0 for every page.
- **Observed, outside R1:** at 320px the lines panel also scrolls horizontally, because the Forwards and Defense columns don't stack at that width (`TeamTabNavigation.module.scss` `.lineCombinationsFixedHeight` is a flex row). I did not compare this against HEAD, and it needs that stylesheet's lease. The section title "Line Combinations" is also clipped at 320.
- **Not covered:** real devices, assistive technology and real lineup data.
- **Slot released.** The server and stub were stopped at 2026-10-24T16:54:16Z, :3110 and :54399 were confirmed free, and TJ's :3000 was untouched.
