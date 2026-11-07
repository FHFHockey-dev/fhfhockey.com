# C2 receipt: Team Colors card small text and PNG readability

Package C2 (SITE-PLAYER-CARDS / SITE-SOCIAL-SHARE, P1), from `tasks/today-plan-2026-10-25.md`. First-pass frozen handoff. This is a visual checkpoint, not a claim of owner design approval.

## Custody and where things are

- **No canonical writes.** The CLAUDE-20261025-060 transfer had not been posted in `CODEX-TO-CLAUDE.md` when this finished (last entry is CODEX-20261025-078). All edits were made in the isolated snapshot `/private/tmp/fhfh-c2cards-isolated/web`. It was copied from the working-tree `web/` at 2026-10-25T14:14Z without `node_modules`, `.next*`, `.env*`, `.ms-playwright` or `test-results`; `node_modules` is a symlink. The manifest is `../SNAPSHOT-MANIFEST.sha256` (4,129 files) and the before-copies are in `../before-copies/`.
- **Baselines, re-checked against canonical at handoff (all unchanged):**
  - `EditorialPlayerCard.tsx` `f3c996c4c0cf9d75f533d1d4937a5db2474edb6a7c9b9665bbb3849df205afb5`
  - `EditorialPlayerCard.test.tsx` `99b9013b5d2d16d343f88381730d5794c1beaefda5b6647aa092f0cef5d8bfe6`
  - `PlayerCardShareStudio.module.scss` `0bcab0a01648ff20a2d083dea3ec7e3d9c7fa0ca644eba48fa5d1b976db50db3` (**not modified**)
- **Candidate:**
  - `candidate/EditorialPlayerCard.tsx` `ac5c46e764934d3ef6a42cb33d26711b809a95914c745ba87a3d77bbaa7ed567`
  - `candidate/EditorialPlayerCard.test.tsx` `57f7f64f661f8b050589149fcc659f0da92990adffc6f47d48258fce64315a6e`
- **Frozen patch:** `C2-CARD-READABILITY.patch`, SHA-256 `cdf9d065229fe9f7459c3da3bf0a67ed22875f28b379ad3bd8a3e8849612e468`. It touches 2 files (+46/−15). `patch -p1 --dry-run` from the repo root applies cleanly to the current canonical files. It has not been applied.
- **Read-only and untouched:** Studio TSX and its test, HeroPlayerCard (portrait and header), shareExport, source math, routes, auth and SocialShare.

## What changed (EditorialPlayerCard.tsx only)

The canvas size and aspect ratio are unchanged (1200×900 editorial; Hero landscape 1200×1020, square 1200×1200). The Team Colors palette, statistics, disclosure wording and saved preferences are also unchanged. Sizes below are in SVG units (svg-px).

| Element | Before | After |
|---|---|---|
| Raw rank/N in the profile rows | 26 | 28 |
| Missing/undefined label in the profile rows (2 lines) | 18 | 21 |
| Caption "minutes:seconds per appearance" | 17 | 19 |
| Rank and percentile line in the ratio band | 19 | 22 |
| **Missing/undefined label in the ratio band** | **14, one line** | **19, two lines** (same text, split at " · ") |
| Ratio band header ("Actual ratio first…") | 16 | 18 |
| Ratio band geometry | y 642–782 | y 630–778 (taken from empty space under the last profile row) |
| Footer sample line (GP · TOI · dates) | 20 | 22 |
| Footer notice (warnings or "Regular season · own spans may differ") | 17 | 19 |
| Footer population, source and policy lines | 18 / 17 / 16 | 20 (18 when the notice is stacked) |
| `fhfhockey.com` | end of the policy line | right side of the source line, bold (this keeps the policy line within the width) |

- **Long-notice handling.** A conservative width estimate decides where the notice goes. If it fits, it stays right-aligned beside the sample line. If not, it moves to its own left-aligned line under the sample line. This exposes `data-footer-layout="inline-notice" | "stacked-notice"`. Across 32 fixture combinations, only the full-N short sample (player 1004, `fullN`) stacks: "Known short season · proposed policy · Some metrics undefined" next to "TOI unavailable".
- **Text unchanged.** Every visible string is the same, including "no GP, TOI or position filter", "Updated … UTC", "Numeric magnitude ≠ quality", every missing/undefined/rank-unavailable label and the SVG aria-label/desc.

## Checks run

| Check | Result |
|---|---|
| `vitest run components/player-cards/EditorialPlayerCard.test.tsx` (snapshot) | **passed 8/8** (5 existing, unchanged, plus 3 new: minimum label size ≥17, inline notice and `fhfhockey.com` present; stacked notice for the long-warning fixture; two-line ratio unavailable label at ≥19) |
| `vitest run components/player-cards/` (Editorial, Preview, ShareStudio, Flow) | **passed 30/30** |
| `eslint` on both changed files | **passed** |
| `tsc --noEmit` (whole snapshot, under heavy lock) | **failed, unrelated to this change:** 2 errors in `lib/sources/tweetLunaReview.test.ts:192` and `scripts/review-ifttt-luna.ts:22` (Buffer/BinaryLike), inherited from the working tree. No errors in player-cards or the harness. |
| CSS Modules pure check on `PlayerCardShareStudio.module.scss` (sass, then postcss-modules-local-by-default pure) | **PURE OK.** The file is unchanged. Next logs an existing autoprefixer warning (`align-items: end`), which was left alone. |
| Browser QA (Playwright Chromium; every request other than 127.0.0.1:3140 aborted; snapshot `next dev` on :3140 only) | **run, before and after**, with the same case set |

**Browser case set.** All runs use the reviewed Kaprizov artwork with the Team Colors portrait.
- Studio UI cases: complete, metric-gap (missing) and history-gap (GP unverified; export disabled by design). Each is captured in landscape and social-square at desktop 1440, 390 (DPR 3) and 320 (DPR 2).
- Harness cases go through the real `rasterizePlayerCard`:
  - undefined (power play, single day, zero denominator)
  - partial (unknown pool, all ranks unavailable)
  - missing with a long date range
  - longest inline notice (1004 power play, metric gap)
  - stacked notice (1004 full-N, preview only: TOI is null so export is correctly blocked)
  - full-N 5v5 range
- **Real exported PNGs:** 14 before and 14 after, in `png/before/` and `png/after/`. They are actual browser downloads from Download PNG, 1200×1020 or 1200×1200.
- **Geometry** is measured from rendered text bounding boxes (`measurements-*.json`, `summary-*.txt`):
  - Overlap: none in the card body, before or after. The only reported overlap is KIRILL/KAPRIZOV line boxes in the read-only Hero header, a 4-unit line-box artifact rather than a visual collision.
  - Out of bounds: none, before or after.
  - Smallest card-body text rose from 14 svg-px (ratio unavailable label) to 17 svg-px (the "ACTUAL PERCENTAGES" eyebrow, unchanged). The remaining 16 svg-px text belongs to the read-only Hero header.
- **Visual inspection** of the after PNGs (landscape and square, all cases): no clipping and no overlap. The lowest footer line ends about 14 units above the canvas edge, or about 7 units in the stacked case. The square format's Hero bottom band is unaffected.

## Before/after visual checkpoint (for TJ)

- `compare/lower-1to1-*.png`: 1:1 crops of the real exported PNGs, before above after, showing the ratio band and footer. Best single view: `compare/lower-1to1-hero-partial-unknown-pool-landscape.png`.
- `compare/phone-*.png`: each real PNG shown at 366 CSS px wide and DPR 3, which is how it appears on a 390px phone. Before is on the left, after on the right.
- `screens/before|after/studio-390-*` and `studio-320-*`: the actual Studio preview at phone widths. `-page.png` files are full-page.
- `screens/after/preview-hero-stacked-notice-fulln-short-*.png`: the stacked-notice layout.

## Limitations (honest)

- **The fine print is still small on a phone.** The card is a fixed 1200-unit-wide artwork, so on a 390px phone 1 svg-px ≈ 0.305 CSS px, and at 320px ≈ 0.247:
  - The footer's 20 svg-px is about 6.1 CSS px at 390 and about 4.9 at 320 (before: about 4.9–5.5 and 4.0–4.4).
  - The key values hold up better: actual values (37–40) are about 11–12 CSS px, ranks and percentiles (22–28) about 6.7–8.5.

  Making the footer comfortably legible on a phone without zooming would need a presentation change: a readable caption outside the artwork, a pan/zoom preview, or a taller mobile format. That is a design choice (and may need Studio TSX, which Codex holds), so it was **not** made and is put to TJ.
- **Not established:** native iOS or Android share-sheet behaviour, rendering on a real device, owner visual acceptance, and production. The PNGs come from desktop Chromium canvas rasterization using system Arial.
- **The harness is QA-only.** `qa/c2-harness.tsx.txt` (snapshot `pages/c2-harness.tsx`) renders the Studio without the access gate, plus HeroPlayerCard for fixtures the Studio doesn't expose. It is not part of the patch. The snapshot `.env.local` holds dummy unreachable values (127.0.0.1:9), not secrets.
- **The notice width check is an estimate** (Arial advance 0.53em bold / 0.5em), not a measurement. It was validated against measured widths: the longest inline case measures 1,003 of 1,120 available units.
- No live data, Git, deployment, analytics/auth or image reprocessing.

## Reproduce

```bash
cd /private/tmp/fhfh-c2cards-isolated/web && npx next dev -H 127.0.0.1 -p 3140
```

```bash
node /private/tmp/fhfh-c2cards-isolated/qa/capture.cjs /private/tmp/fhfh-c2cards-isolated/after-out
```

Take `/private/tmp/fhfh-heavy.lock` (mkdir lock with an OWNER file) before the capture.

## TJ decision (2026-10-25, pop-up in this session)

TJ asked how the phone view should handle the remaining small fine print, and chose **"Accept for now"**: keep this in-artwork increase as the first pass. The Studio's existing "Card values and provenance" section stays the readable phone fallback, with no caption, pan/zoom or format change. This settles that scoping question only. It is not overall visual acceptance of the card.
