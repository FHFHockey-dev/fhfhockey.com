# RECEIPT-16: TJ's notes on the TT-15 genuine Hot/Cold render (lane TT, offline)

## Hot/Cold sparkline "clipping": cause confirmed, no read change

**Finding:** the TT-15 genuine Hot/Cold render (genuine run-2: Michkov, Necas, Lehkonen, Zegras, Gritsyuk, Svechnikov, Matthews, Connor, Granlund, Perfetti) has no drawn sparkline at all.
- The run-2 capture predates the series: no `series` field on any row of any card.
- Every line in that render is the TT-15 neutral dashed baseline, which reads as a line that starts part-way with dashes.
- **Confirmed by:** `genuine/run-2/layer.json` (no `series` key on any section row) and the guard's genuine assertion that no tile draws a series.

**When the code can produce real leading gaps** (`gameSeries` in `trends.ts`): only when, inside the S1 read,
- a row or the row before it is missing for that games-played count;
- two rows share a games-played count (both are dropped); or
- a season points total isn't whole within 0.01.

Hot/Cold qualifiers need 10 or more games this season, and the season started about 20 days before the edition date. So the 35-day S1 window already reaches each qualifier's game 1, and game 1 needs no prior row.

**Decision:** fetching an extra prior row would change nothing for this edition, so no read change is made and READ-PLAN v3 is untouched. Later in the season, when 10 appearances can exceed 35 days, the window would need widening. That would be a READ-PLAN change for TJ.

**What changed to stop the misreading**
- The no-series baseline now carries a small "NO PER-GAME DATA" label.
- A real gap (a game whose row or value is missing) gets a faint dotted column above its hollow tick, and the meta line says "N game(s) no data".
- These are labelled "no data", not "no GP". A gap is missing data: games a player missed are never points in the series, which runs over his appearances.

**Recommendation:** TJ's check of real series needs a genuine capture with S1 (a run-3, which needs his approval through the chef). Run-2 cannot show any.

## All four cards
1. **Corner tag removed.**
   - Rostered % sits beside the name at the name's size ("ANDREI SVECHNIKOV 93%", in white so the tone stays on the name).
   - Missing shows "—", never 0%; a fixture 0% is a real observation. Layers that predate the field show nothing, as in run-2.
   - Team · position starts the meta line under the sparkline ("CAR · R · 4 GP this week"). The ticket suggested under the name, but item 2 puts the chips directly under the name. A separate line would not fit the 146 px Hot/Cold tile, and Deployment's movement chips leave no room for it in their row.
2. **Chips:** the badge and line/PP chips sit in a row directly under the name, aligned with it (right edge; left edge on mirrored columns). On Deployment these are the movement chips.
3. **Gold glow:** an outer tile glow and a name text shadow in gold, `rgb(255 201 74 / --gold × 0.5 and 0.75)`.
   - **Strength:** `--gold = clamp((50 − rostered) / 25, 0, 1)`: none at 50% or more, or when missing; full at 25% or less.
   - **Layering:** it sits outside the tone border, behind the tone glow, so green and red read first.

**Rates:** the ABOVE SEASON badge is removed.

**Fit:** the 2-column difference figure is 24 px and the sparkline 22 px tall, so the name clears the top border.

## Guard extended (stress, fixture and genuine)
- **Chips:** the chips row starts 0–4 px under the name and is aligned with it.
- **Rostered %:** stays inside the name, and no corner tag is drawn.
- **Gold:** `data-gold` matches the shown rostered % within the rounding (±0.03).
- **Stress mode:** adds a 20% rostered tile (full gold) beside the 100% and "—" tiles.
- **List test:** every tile shows rostered % or "—", and a meta line starting team · position; Rates carry no badge.
- **Genuine:** asserts no drawn series and one labelled baseline per tile.
- **Unit tests:** `rosteredText`, `goldGlow` (50 → 0, 49 → 0.04, 37.5 → 0.5, 25 and below → 1, missing → 0) and the gap columns.

## Evidence
`tt16/fixture` (with sparklines and gold) and `tt16/genuine-run2` (labelled baselines): desktop, phone and PNG. Genuine export tokens match.

## Checks

| Check | Result |
|---|---|
| E2E full spec, :3110, deny preload, v2 pins (two passes) | **34 passed** (33 + 1) |
| Monday (9) / Wednesday (9) PNG pins | **byte-identical to v2** |
| Tuesday pins | changed by design: 10c68bfb66453d67929490d86d7a6e7c6a2791f2c3b156d0d5caa26e2f8218f7, 56d5b8507655fd360848408ea9e8a90d93131b012a9f1f81211910896f4b65d0, 9e847985e37b46ac840a2788bd5e43a0d2650733bafb5cf253f92626ff691184, 68c5bf2a7e3e8b71e59d1a2fb43bfd50af80e09fe373bfb34e0fe44dcd55bdc0 |
| Vitest | 241/241 |
| ESLint / full `tsc --noEmit` / CSS pure | exit 0 / exit 0 / PURE OK |
| Network | denied Next.js version check only; no reads |

## Files and sha256

| File | sha256 |
|---|---|
| `web/components/SocialShare/SocialShare.tsx` | `85b7f7b4b9d1386c84681aa051486f8da0dcef53ba824e1f62d597cfcf082b53` |
| `web/components/SocialShare/SocialShare.module.scss` | `144b9f9a252b56202e396581cfc7e60628e61a5dbd34c0800949f78a72ba2fe7` |
| `web/components/SocialShare/SocialShare.test.tsx` | `f744ffad115d9e929ec648adbcfee50a478a796b2abbc2c499c3e4850d998db9` |
| `web/e2e/social-share.spec.ts` | `c424f08907b3db6b41ce7a64d431c0d54881f34e157a71d40fde2b9872c59e39` |
| `tasks/artifacts/tuesday-trends-2026-10-26/CONTRACT.md` | `7fec2182b080db56124160c30e2aed46134fbb10e801da0a5b682316cd64dfb5` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/e2e-final-31a.log` | `5c465f71df97829e7757f380227b688e603dea2f59e9a8a2af4c336efa1e85d0` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/e2e-final-31b.log` | `90bf74b57fe9c2b341f553fb12ccdcc9cde9519e54f319c49d1ed320af475327` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/vitest.log` | `122f002bcea1a03cd591052bbbb372e6e7d8b11d07aaf3a04966c31d0353cb8c` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/tsc.log` | `cbf7de6a7ab22aa8f3b63eed31368677222a5389d4a0bcaa112a952910051cec` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/eslint.log` | `a6b49f7a0b519016701eccb4efc2de2d77010ed919b35fdad1e3abacbe9dcfd8` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/css-pure-check.log` | `9fa072d00ca3572dfcdfd095233709675777edf686cf72bb6300f03b2586d172` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/node-network-31.jsonl` | `a2e55540fa999565bef38a550145305afe7c456ba7556851dddb64a86088b91c` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/evidence-31/tuesday-cards-pinned.sha256` | `743898eeea05303ecd701e623132582413edd6fcc28790fd3bc069c4a9e7e150` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt16/fixture/TT16-OFFLINE-FIXTURE-desktop-deployment.png` | `7f3a12e578081ef834ec74eae05f7dcab8eb1615234a655d58ef9930c5ba1a0d` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt16/fixture/TT16-OFFLINE-FIXTURE-desktop-hot.png` | `a4a986c1a47762e96540771b0281ba749c3ae5276412a5271bb8e7cc3c44ea85` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt16/fixture/TT16-OFFLINE-FIXTURE-desktop-movers.png` | `64f84265c8eb1cc07f11dc0c306dc22f9dbf3c301ac55d37ddd68eabadbd2102` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt16/fixture/TT16-OFFLINE-FIXTURE-desktop-rates.png` | `024a2a5e17ecac31f5fa381fbfb9d05adb43280aa115b985b360fe747c9ce98c` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt16/fixture/TT16-OFFLINE-FIXTURE-phone-deployment.png` | `cc527d1c8bd03dfe06c8ed113ef67d5fa56f1bc72080b3e9a0936d597fcbceac` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt16/fixture/TT16-OFFLINE-FIXTURE-phone-hot.png` | `abec993d286376a7ba68d728d3a1df23ee17d64610151b6e271373b772d3ed77` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt16/fixture/TT16-OFFLINE-FIXTURE-phone-movers.png` | `8d65cd84c2f51dd5e70c4de88d55966c08e7888382b3dfce99f59fc2b27030d1` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt16/fixture/TT16-OFFLINE-FIXTURE-phone-rates.png` | `f112e4facf864950568bb6557513b0828dd04b653066a8d04cb3efa7e546d76b` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt16/fixture/TT16-OFFLINE-FIXTURE-png-deployment.png` | `835b94046ee9ab5e29cf4131e65ba7545e994a1170f1aea56e739137611c01de` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt16/fixture/TT16-OFFLINE-FIXTURE-png-hot.png` | `b3c3e34aa489a8029c73a6d8126b231574120377dfe6976e07747847fb678a05` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt16/fixture/TT16-OFFLINE-FIXTURE-png-movers.png` | `74b2a016ffc7f291b8466f71901fdcfc2a068f416e72122b2fb1d00ea594eb8c` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt16/fixture/TT16-OFFLINE-FIXTURE-png-rates.png` | `6bd4a9f720c3567cf2c40468bee0057ef6a69ac50ca6077947b14a9ddce3e4e3` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt16/genuine-run2/TT16-GENUINE-DATA-desktop-deployment.png` | `59aee0d6134c93a0432ce834abfae2373b4019503a854b3530a399415abf7eeb` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt16/genuine-run2/TT16-GENUINE-DATA-desktop-hot.png` | `4bdb38fd6e60e3fdad1d115df65d67e1544c642702781c44a95526e844187a25` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt16/genuine-run2/TT16-GENUINE-DATA-desktop-movers.png` | `ba2fc7697a2b74050bd59a72da072aace47b702d367482139fc831d7b23069ab` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt16/genuine-run2/TT16-GENUINE-DATA-desktop-rates.png` | `833d74dbf3e024f47409a64cf8425ab6d55c9337893ef3f159609bafe4000310` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt16/genuine-run2/TT16-GENUINE-DATA-export-tokens.json` | `a7a16c53c84e30c4d6c4fd135e019a084004f09376a0ed93730688673291d3b3` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt16/genuine-run2/TT16-GENUINE-DATA-phone-deployment.png` | `e69bd5a42f1b4dc48ecf3988d4af2add2c03230f675a4510335a1464cab96f35` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt16/genuine-run2/TT16-GENUINE-DATA-phone-hot.png` | `0b7c27ce702aa0b66318a92bd9232eecad2d39e7da7623966b64afbb0e94b170` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt16/genuine-run2/TT16-GENUINE-DATA-phone-movers.png` | `75f5a476156ff5523645ad5edf40609120499a659ea59191c39c71fef9cd8c54` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt16/genuine-run2/TT16-GENUINE-DATA-phone-rates.png` | `ccf444d25ef1cdd77a061213069b651000daa018f482f18f5e7b3443a9afa0e9` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt16/genuine-run2/TT16-GENUINE-DATA-png-deployment.png` | `0d313952554060dd9f622bcadf60b76edda5c104c86abe89f619dcecb8faf6f6` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt16/genuine-run2/TT16-GENUINE-DATA-png-hot.png` | `1134d34dfff6d6d812d17646330c6bf7e4eb5966871f6f8014d7a219f96efcb2` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt16/genuine-run2/TT16-GENUINE-DATA-png-movers.png` | `87752cc7fc06c5865e6ebb004aff82c6a7565aa218f94ba6cd2d129ae459672a` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt16/genuine-run2/TT16-GENUINE-DATA-png-rates.png` | `139ec9f79f42860cf33e333b33fa69aed81bd25f31ec5c13e35a347019474aaa` |
