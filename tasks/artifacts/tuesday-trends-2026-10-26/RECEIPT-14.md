# RECEIPT-14: stripes moved to the centre of the tile (lane TT, offline)

TJ asked to move the background stripes to the centre of the card "so it doesn't overstimulate the visuals".

## What changed (`SocialShare.tsx`, `SocialShare.module.scss`)

**Logo**
- The tile art no longer draws stripes. Each neon logo sits on a clean dark field.

**2-column cards (Hot/Cold, Deployment, Movers)**
- The stripes moved to a new band element. It's a flex sibling of the text column, so it fills only the gap between the logo zone and the text.
- **Start:** where the logo's box ends, `calc(118cqh - 7.36cqw)`. The tile is now a size container.
- **End:** at the text column, which hugs its widest line (at most the old 70%). It can never run behind text.
- **Look:** the band fades to the body over its outer 30% on each side. It keeps the neon edge lines and the subtle 18% fill.
- **Mirrored right columns:** the angle is inverted (−65°) and the band sits on the text's other side.

**Rates: chosen placement is the centre, behind the sparkline area only**
- The band sits behind the sparkline area, between the season and L5 values, dimmed: lines 28%, glow 8%, fill 7%.
- Legibility was checked in renders. At the 2-column strength (and at 55%), stripes crossing the line and the dashed season level competed with them, so it is dimmed until the sparkline's line, dots and dashed season level are clearly the brightest marks.
- **Alternative rejected:** between the logo and the name. The badge and chips row is wider than the name, so the gap there is a 20 to 30 px sliver that read as an artefact.
- **No sparkline, no band:** genuine run-2 has no rate series, so its Rates tiles show no band. The fixture shows it; see the crops.

**Guard** (`tileCollisions`, run in stress mode and genuine)
- The art must have no background image (no stripes behind the logo).
- The band's visible core, its middle 40%, must not sit behind any tagged part (name, hero, absolute, kind, details, table, chips, tag, season, sparkline) or the logo's box.
- The only exception: the sparkline box that contains the band on Rates.
- All other guards are unchanged (overlaps, clipping, edges, hero row), and the export still matches the preview (export tokens and PNG assertions).

## Evidence
- `tt14/before-after-crops.png`: the first tile of each column for Hot/Cold, Deployment and Movers (including the mirrored right column), plus Rates from genuine run-2 and fixture.
- `tt14/fixture` and `tt14/genuine-run2`: full desktop, phone and PNG renders. Genuine export tokens match.
- The generator is `tt14/before-after-crops.mjs`.

## Checks

| Check | Result |
|---|---|
| E2E full spec, :3110, deny preload, v2 pins (two passes) | **34 passed** (33 + 1), including the extended collision guard |
| Monday (9) / Wednesday (9) PNG pins | **byte-identical to v2** |
| Tuesday pins | changed by design: b669b848ccd767cfe23141e123c0c2bfed0a3954643b9d1c480ee2d590385b22, 5efb5bbd35271069ba5716cd2ca85168bdc203b5bda6959b059f0216a4c842c1, 130cc83be09fb4b170995f444c2348044f2aec36e15e4a9cc4ca86117a1452bb, 422d56807e4eb7b70017ee8e040edf38168328279f9fb3cd8877fdad219e583b |
| Vitest | 241/241 |
| ESLint / full `tsc --noEmit` / CSS pure | exit 0 / exit 0 / PURE OK |
| Network | denied Next.js version check only; no reads |

## Files and sha256

| File | sha256 |
|---|---|
| `web/components/SocialShare/SocialShare.tsx` | `c4709753698eaa8e313bffd7275428ea2e3bacfaebb0786c97b7e4c6d54746d0` |
| `web/components/SocialShare/SocialShare.module.scss` | `4fcf994a2ae024eec86ab0bd03e3a4331ee6199af5aa582202c287a8b61615a6` |
| `web/e2e/social-share.spec.ts` | `85d320ff6056fbd574149be8bb23ae4c1d27080721fc25c1918d7cdacd3855e3` |
| `tasks/artifacts/tuesday-trends-2026-10-26/CONTRACT.md` | `83eb7d716b405193c8546ec50fbfca91865c75633626995800d2aa50a615e5e9` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/e2e-final-29a.log` | `1217db6065b73a68f4fc94b89bbc12dc2dd7fa9853b191417263054758f82e15` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/e2e-final-29b.log` | `095bd1bba8fb5c6ea6256bffb5b5bc385e840ec64c53e7babf96f667e5a7fd8a` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/vitest.log` | `ad9482472e12512660043e35ab8124c4be591c2ce8e03ca2a1e71e23568d0d44` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/tsc.log` | `cbf7de6a7ab22aa8f3b63eed31368677222a5389d4a0bcaa112a952910051cec` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/eslint.log` | `a6b49f7a0b519016701eccb4efc2de2d77010ed919b35fdad1e3abacbe9dcfd8` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/css-pure-check.log` | `c006ad00e1328d2a90bcb71d33b14d7d7e8bd4593d47a09a692f288affe1b2ab` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/node-network-29.jsonl` | `8f3033e1d6d0c3b2f47ffda53d6b027dbb002fabac5a4f1b7f7c76dd68d4bde1` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/evidence-29/tuesday-cards-pinned.sha256` | `559325787ef6bf2bafbce209e1c7ff43261eaf5dd785b467f220a13b4af4035f` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt14/before-after-crops.mjs` | `a2db6ba386d333e38f659cdb2286dbaac3edc5ab27141aae9315128bf0d885ab` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt14/before-after-crops.png` | `c177ebb866c990ff74c386b34278443986ecb896f403e5da6bd08d75ac386008` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt14/fixture/TT14-OFFLINE-FIXTURE-desktop-deployment.png` | `fb670b9abaa3f03490340e2ace977e992e95fdb95b76d7b05c27b82efeb710d3` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt14/fixture/TT14-OFFLINE-FIXTURE-desktop-hot.png` | `aa988ce21c7c433a3efc7adc1fecd57b9190cf870a7538017f55620762a0ead0` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt14/fixture/TT14-OFFLINE-FIXTURE-desktop-movers.png` | `b351741294201a4db03f8fc3259342da4b00b6bfd73a992cde91946cfb762022` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt14/fixture/TT14-OFFLINE-FIXTURE-desktop-rates.png` | `3ec27ef02bfbed6e844209a422bc3dc008fc2f838b2180782cbec4dac5cc3c73` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt14/fixture/TT14-OFFLINE-FIXTURE-phone-deployment.png` | `47c90b8513333b8ae6ebc56c31a87ccd0e00af495da6cb9be0b44c17a76cc9b5` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt14/fixture/TT14-OFFLINE-FIXTURE-phone-hot.png` | `d4a0815161aec5ff65e739ca5a6d8ff49d1570ae4c8633e4f12e75791029f8f5` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt14/fixture/TT14-OFFLINE-FIXTURE-phone-movers.png` | `61149f91e6545cc29526df2aab270146f14e46c1440fd9607de73bbaef4a6f4c` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt14/fixture/TT14-OFFLINE-FIXTURE-phone-rates.png` | `c89eaf03dd21806e3ebf4d9eec534c53b3ffc074b309e604a0c094da4ea80809` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt14/fixture/TT14-OFFLINE-FIXTURE-png-deployment.png` | `61e03ab785af21443b885ef0b5cc6f137e8aca84b91c3c360330aed3eb1a8d18` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt14/fixture/TT14-OFFLINE-FIXTURE-png-hot.png` | `19be435a216022539875efc661a0a971f81d868bf292bc9ca2405a3fb81a7137` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt14/fixture/TT14-OFFLINE-FIXTURE-png-movers.png` | `69cc6d992cc4d7806e08d53f2bb7c531dc5b1a3eef24128b0f0ffe67a8561ec2` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt14/fixture/TT14-OFFLINE-FIXTURE-png-rates.png` | `d7d078a309ccfa661ad441a1caf413b85b1dc7aa1034833bcd9ac185786ed787` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt14/genuine-run2/TT14-GENUINE-DATA-desktop-deployment.png` | `ec673c1ac7cf349f0d8c3a1fe69a24bb7ad79dbf50ba0ac6d87f9a12e8e702b6` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt14/genuine-run2/TT14-GENUINE-DATA-desktop-hot.png` | `6706cadf1620d5a7c7359a5b20414ccb1c8d46f47fc46ad6d8378be2c841eb95` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt14/genuine-run2/TT14-GENUINE-DATA-desktop-movers.png` | `37a3168f2a4ac2e12f660a8c1c877ac8ce91421a2637a90649ea72b47b572e38` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt14/genuine-run2/TT14-GENUINE-DATA-desktop-rates.png` | `aea0243065ec5a1c1b6b738d6db14820c9ac3c77c0b5d9d442099ec65470e46a` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt14/genuine-run2/TT14-GENUINE-DATA-export-tokens.json` | `1aeccf7a5b38ccb04f599c7efca7f59c305d78f2c4a52927fa137398407aa704` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt14/genuine-run2/TT14-GENUINE-DATA-phone-deployment.png` | `d61ab0b7145d23bf56c8818d975d187c174ef535b8b6e9e07715939ecd6a6f60` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt14/genuine-run2/TT14-GENUINE-DATA-phone-hot.png` | `e54e9d76a14d46a097800965e5c7b1c38fe85d05e727d2206bcb044a2da76b27` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt14/genuine-run2/TT14-GENUINE-DATA-phone-movers.png` | `452d604bb8b21e6ae261225188a4740369c4702faf307418bbdccbd5de783821` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt14/genuine-run2/TT14-GENUINE-DATA-phone-rates.png` | `da0cf6eb4a4b8c0319450da133f5246a709dae6ece38f19042f1c3ac0554677f` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt14/genuine-run2/TT14-GENUINE-DATA-png-deployment.png` | `7209104cfb9594ec0b8beb124a177d48584986edd43b0122aba91863c751dd46` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt14/genuine-run2/TT14-GENUINE-DATA-png-hot.png` | `a44fc020cde31aeb3af0e563cb1cde0931add34b7df7d8d0c1c798e7279648d0` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt14/genuine-run2/TT14-GENUINE-DATA-png-movers.png` | `26f304b37260b294af2abef8488c9e73f48f8c50dc0935e6b8a6e214ba38e9b8` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt14/genuine-run2/TT14-GENUINE-DATA-png-rates.png` | `398f3ef51d92c1ae6019ef63ee2e49b9b7e9adf54870e526e0fc92ab36a28f51` |
