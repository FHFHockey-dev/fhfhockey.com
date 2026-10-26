# RECEIPT-12: TT-12 per-team neon choices and multi-colour logos (lane TT, offline)

## Applied

| Item | Teams | What |
|---|---|---|
| 1 | VGK | stroke = `secondaryColor` gold `#b4975a` |
| 1 | CHI / NYI / SJS | halo = `accent`: CHI `#cc8a00`, NYI `#ffffff`, SJS `#ea7200` (floored) |
| 2 | DAL | stroke = `jersey` `#006847`, floored to `#009365`. The halo is still the green `secondaryColor`, at the soft spread. |
| 3 | BUF, CBJ, CHI, DAL, DET, MTL, NYR, OTT | `soft`: white glow 2 px at 30% (was 3 px at 50%), halo 1.5 px at 35% (was 2 px at 55%) |
| 3 + 5 | FLA, STL, TOR, WSH | They are on both the dimmer list and the "no difference" list. They get `distinct`: white glow 2 px at 30% (dimmer), halo 2 px (no wider) at 85%, so the halo's own colour shows. |
| 4 | ANA, BOS, CAR, CGY, DET, NJD, NSH, NYI, PHI, PIT, SEA, SJS, UTA, VAN, VGK, WPG | Halo colour kept. DET only gets the softer spread; NYI takes the item-1 accent. |
| 5 | COL, EDM, FLA, LAK, MIN, STL, TBL, TOR, WSH | `distinct` spread. Halo choices below. |
| 6 | ANA, CHI, DET, EDM, FLA, NYI, NYR, TOR, WSH | Baked multi-colour outlines, all 9 legible |

### Item 5 halo choice per team

- **COL:** `secondaryColor` burgundy `#d2567c`. It was already a different hue; the halo was hidden under the white glow, which `distinct` now dims.
- **EDM:** `secondaryColor` orange `#fc4c02`. Same reason as COL. EDM is also baked multi-colour.
- **FLA:** `secondaryColor` gold `#b9975b`. Same reason as COL. Also baked.
- **LAK:** `jersey` white `#ffffff`. It's LAK's only colour apart from its silver stroke and silver `secondaryColor`, so the contrast is in lightness, not hue.
- **MIN:** `jersey` red, floored to `#e3485f`, against the green stroke.
- **STL:** `secondaryColor` gold `#fcb514`. It was already different; `distinct` makes it show.
- **TBL:** `secondaryColor` white. No coloured alternative exists (accent black would floor to grey). `distinct` makes the white halo read against the blue.
- **TOR:** `secondaryColor` white. Same as TBL. Also baked.
- **WSH:** `secondaryColor` red `#ef3855`. `distinct` makes it show. Also baked.

### Item 6: how the multi-colour logos are baked

The script is `tt12/bake-multicolour-outlines.mjs`; the palettes are in `tt12/palettes.json`.
- **Trace:** the same v2 trace as TT-7.
- **Palette:** k-means on the original's flat pixels, with the outline colours drawn from those palette colours. Anti-aliased blends are excluded, so no blend colours appear.
- **Two-tone lines:** a stroke pixel over a flat region takes that region's colour. An edge between red and white is red on its red side and white on its white side.
- **Off-logo and blend pixels:** the skeleton's pick, which is the most colourful neighbouring region. Neutral borders give way to the team colour beside them.
- **Floor:** every colour clears 4.5:1. Black becomes grey `#818181` (ANA, CHI).
- **Output:** `web/public/teamLogos/outline/color/*.png`, loaded untinted, with the white glow and team halo kept.

## Flags

- **VGK:** the gold stroke now equals its gold halo (item 4 says keep). Proposed: halo `jersey` red `#8d0519` (floored) if TJ wants them apart.
- **EDM (multi-colour):** the navy field becomes blue, and with thin white and blue two-tone lines it reads dimmer than the other eight at 120 px. It's still legible. Proposed: drop EDM back to a single colour if TJ prefers.
- **DAL:** the jersey stroke is calmer, but the halo is still the neon green `secondaryColor` at the soft spread. Proposed: if it still reads abrasive, use the jersey halo too.

## Evidence

- `tt12/contact-sheet-tt11-vs-tt12.png`: all 32 teams at 120 px, TT-11 pair then TT-12 pair, on green and red frames.
- `tt12/closeups-multicolour.png`: the 9 teams at 240 px (original · TT-11 · TT-12).
- `tt12/fixture` and `tt12/genuine-run2`: desktop, phone and PNG renders. Genuine export tokens match.

## Checks

| Check | Result |
|---|---|
| E2E full spec, :3110, deny preload, Monday/Wednesday pins asserted against v2 (two passes) | **34 passed** (33 + 1) |
| Logo assertion | `data-stroke` is the team stroke, or `multi` for the 9 baked teams; `data-halo` and `data-spread` are per team |
| Collision guard (stress and genuine) | Passed |
| Monday (9) / Wednesday (9) PNG pins | **byte-identical to v2** |
| Tuesday pins | changed by design: d09305ca1de662685f3357605e66e4cfdc86db9b14e39f30d23da4723d8bcd53, 1e65a51bb54481f9a6c3d99881de7992b6af577ec2fa0dd445ba5685abbe21bb, ea4d80d16ecbaf7fe3351d975c1b7fd227b6d03e6eec3e740bb477fd999157ea, 07940b786fb3ee65ce57434b315128fb07284cdd7b695a07a8a05cf66521707f |
| Vitest | 240/240 |
| ESLint / full `tsc --noEmit` / CSS pure | exit 0 / exit 0 / PURE OK |
| Network | denied Next.js version check only; no egress; no reads |

## Files and sha256

| File | sha256 |
|---|---|
| `web/lib/socialShare/teamNeon.ts` | `a027daf7b3f32b14e699f68bfa0f83517d762598ff62408789f22a9835e50580` |
| `web/lib/socialShare/teamNeon.test.ts` | `b6dae84ad4f73e181791f49118f6b83386103ccd93145904f913a6ba222ae78c` |
| `web/lib/socialShare/export.ts` | `cbf16938f45be3533a80bc841e6e18c6c4a5519c7016a728dafb25fa2d975ad7` |
| `web/components/SocialShare/SocialShare.tsx` | `4ed851c2b7c63c6f15cb73d4727705cbaa1cc458b33df2935354b7b869a382ee` |
| `web/components/SocialShare/SocialShare.module.scss` | `1edf49387b3b2a46068d5ea10af85bbe49c2138e1ec62ffcff94b4961e06a149` |
| `web/e2e/social-share.spec.ts` | `69b018dc4c368436d90a940910d80166dad820fd723ae2df285826aa1c2ff53c` |
| `tasks/artifacts/tuesday-trends-2026-10-26/CONTRACT.md` | `9626e99e5972a3411a52c9d1d80a827b0e9567e7a1de7459f58100b4cdc73984` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/e2e-final-25a.log` | `1313f6a557a96212c749f55342e32dbf9b5fc53dc17498f9f05df5648c3d6d3f` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/e2e-final-25b.log` | `874084e6e266db77afff3b6431da158661183f7a5a347f6cae1037821adedbe4` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/vitest.log` | `895b0e760110e6cd34b5eccd769b008ef6f6b08676a58b316499298d0dbc3a70` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/tsc.log` | `cbf7de6a7ab22aa8f3b63eed31368677222a5389d4a0bcaa112a952910051cec` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/eslint.log` | `a6b49f7a0b519016701eccb4efc2de2d77010ed919b35fdad1e3abacbe9dcfd8` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/css-pure-check.log` | `a30d5400826f09d082ae448bf0ade4127a1371c6a82a7d0859d115f3c089d3f4` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/node-network-25.jsonl` | `345f739a8602a57449e0c604c66bdf9114e9ce93141187e139c1ce88861eb3c2` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/evidence-25/tuesday-cards-pinned.sha256` | `01a77bd7ce80c2c63f19e641a7811a0d94daacd649c39b02977bfe31ee8a490f` |
| `web/public/teamLogos/outline/color/ANA.png` | `c406f60d4cdabb21a52f9ac50e6cf2c46d372dcf90a77be2b1a2e82160320c9a` |
| `web/public/teamLogos/outline/color/CHI.png` | `1dd4ea0a7994262e147bd1795feb0a1a90292f56f47fd1d2b71c4f159a41b9dd` |
| `web/public/teamLogos/outline/color/DET.png` | `0e8388d66e82fa6678e13da1af127f0c87bbae6948e296b4f24d3f4e9fb25336` |
| `web/public/teamLogos/outline/color/EDM.png` | `5b9e92c84c256c1be06f77c76d54a3af4bd1446aad5aa7b7f615915117c6a5a9` |
| `web/public/teamLogos/outline/color/FLA.png` | `455de1a974494eb6f3aa9a402a9b2bfd80f129d5f64e1c8bfc223a41af41a947` |
| `web/public/teamLogos/outline/color/NYI.png` | `2f6599b6a86a39788d47f6f1abc2a7148ec7f83437da1fb715d32eed6e8336e4` |
| `web/public/teamLogos/outline/color/NYR.png` | `c0d43c438e5a485d3793a1f0c0956d3e41d28c64ad0d3746e8db2afc352d7113` |
| `web/public/teamLogos/outline/color/TOR.png` | `8e1e0a149fd102d59e5824256a788ea8f8c6170f2ac83346c33059105285d45f` |
| `web/public/teamLogos/outline/color/WSH.png` | `0ebf2c4dab60b1742cbcef52b92553fe178507324c4e9a0c850afea650290fd0` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt12/bake-multicolour-outlines.mjs` | `663f662a8400168d6924a9bcc8d551912188f49ed92584d2fbcc594b03189659` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt12/closeups-multicolour.png` | `ea2f1887bf0ba2ded320e3c4720dc3c4aa738b641f3d244dcc64e665a72de06f` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt12/contact-sheet-tt11-vs-tt12.png` | `b130972f9571e6efaf5b74443b04cb607895e4960a5aeb6142ed684246701712` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt12/fixture/TT12-OFFLINE-FIXTURE-desktop-deployment.png` | `6256ebf5b88c519d43a9539de3851191f71dcec64bd1a0c7b3b45a903a0244b0` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt12/fixture/TT12-OFFLINE-FIXTURE-desktop-hot.png` | `fee4330ffee07da1f2f6c9057a841f2876a9506f532af1daa008474399424944` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt12/fixture/TT12-OFFLINE-FIXTURE-desktop-movers.png` | `a52a4b50baf3ac90ee19c96409577bf3ce15b0b04ddf5c5045586ac406e8720c` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt12/fixture/TT12-OFFLINE-FIXTURE-desktop-rates.png` | `cd893e8de47effe9342afbf9624060b5551f0b4a57838e224801af17b556c150` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt12/fixture/TT12-OFFLINE-FIXTURE-phone-deployment.png` | `dae3291d593eadbecbf4a823f18d5e8f1441cf753fd4aa27fd14aff5d3e62d26` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt12/fixture/TT12-OFFLINE-FIXTURE-phone-hot.png` | `9ac6a9ab38afd27c48048e56800d9a127f02dfa43f61af045998a84055fb4262` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt12/fixture/TT12-OFFLINE-FIXTURE-phone-movers.png` | `742dde95fafeb26a2e4b6a27e3a4aec56dd0c0be4d38d3d583cdd470b8a3d9ea` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt12/fixture/TT12-OFFLINE-FIXTURE-phone-rates.png` | `6c78bcd6b8108cf942da5b91597ff0f46929d91966c0cb9563b868e44b15730b` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt12/fixture/TT12-OFFLINE-FIXTURE-png-deployment.png` | `c196b4fefeced575748f47794e3b74b4ff7813b8ed87cdee1aa81dbb48f2ad68` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt12/fixture/TT12-OFFLINE-FIXTURE-png-hot.png` | `cafaad6fcc6a2b73239e35c0f8886861a1b89489c28c56bcc41afb703b444780` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt12/fixture/TT12-OFFLINE-FIXTURE-png-movers.png` | `d6078b3905fedd901dd34796ca42af3330b899df5590fba22302acda2b85138a` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt12/fixture/TT12-OFFLINE-FIXTURE-png-rates.png` | `97fda6f67d02bd6986ecc1d24e5f442000757390bd96c8162f741994b490619b` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt12/genuine-run2/TT12-GENUINE-DATA-desktop-deployment.png` | `6b2474c9d7d5ba5719b2d58e8ba1fc1df52ecbc193b5f74c63f2688519298389` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt12/genuine-run2/TT12-GENUINE-DATA-desktop-hot.png` | `e51bd2f4aa35ce6462e07efcf654668363741a7fc61031f6de2d073bf0630411` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt12/genuine-run2/TT12-GENUINE-DATA-desktop-movers.png` | `ad4d7ccd692044a9e5ddb189b45409995ed1b22010d8abe904856c74238999aa` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt12/genuine-run2/TT12-GENUINE-DATA-desktop-rates.png` | `8a5d202bd0b9d47d1f16fa8b08854222e3bf4668806c06e7c0fbf2ca74960a54` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt12/genuine-run2/TT12-GENUINE-DATA-export-tokens.json` | `e422c17513195272a59d0e0077c32d2086a12894ea687a7247ec7a62a19035f2` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt12/genuine-run2/TT12-GENUINE-DATA-phone-deployment.png` | `b994e66d9a4ebda4e7a8cb348b71b646b870067eed1555245b73c980e60c5e7b` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt12/genuine-run2/TT12-GENUINE-DATA-phone-hot.png` | `6a4a522d04787931d1d8222452eb6cac6b6f8a10b532e2b8fba0f55674406379` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt12/genuine-run2/TT12-GENUINE-DATA-phone-movers.png` | `a8edcf3fab22d038a124fa766aac3fa4cf4edb28a44df4f777d8bf3a74d6f206` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt12/genuine-run2/TT12-GENUINE-DATA-phone-rates.png` | `dc51dfb2b83c22a118741adc803524e31ba8e674497ea7308341b545d75aa260` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt12/genuine-run2/TT12-GENUINE-DATA-png-deployment.png` | `2954ee3321967c95977524c871df676957fe6566640b0111db20e02001bd06a3` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt12/genuine-run2/TT12-GENUINE-DATA-png-hot.png` | `d2f48e6db66bd56c22dc0cb4cd46d4478798b5b7259bed5b9e73551ca3fbf079` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt12/genuine-run2/TT12-GENUINE-DATA-png-movers.png` | `7e1d8e33f108d9071d42238a4dd2bad98f8b46de05529867fc31eade971535ee` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt12/genuine-run2/TT12-GENUINE-DATA-png-rates.png` | `f38ff849150b4ac48923fdc817468a9a8d2c1394926ea42c37fe318c6e6bd1cd` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt12/neon-lib.mjs` | `279bd90c993575b4b219721e44c3f27445706844649cf580f519aa8313ab24ac` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt12/palettes.json` | `bb3db2ecb8a0acdd29b52b126853881e4d365ba6185f9a11b60943633b52dcf4` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt12/sheets.mjs` | `dfd887d26c70db710b3a3c1369d84b1505bcc6ca730700ef96ec19cdeae17ca9` |
