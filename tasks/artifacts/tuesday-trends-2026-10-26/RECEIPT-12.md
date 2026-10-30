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


## Add-on: every team in its original colours

TJ asked to put every team through the "just like the original logo" filter.

**What changed**
- **Bake:** `tt12/bake-multicolour-outlines.mjs` now bakes all 32 teams with the same method as the first nine: palette from flat pixels, two-tone lines, most-colourful skeleton pick, every colour floored at 4.5:1. The palettes are in `tt12/palettes.json`.
- **DAL:** any logo colour near its neon-green `secondaryColor` is remapped to its jersey green `#006847` (floored `#009365`) before the floor. The star outline is now about 73% jersey green, not the abrasive neon.
- **Multi-colour set:** `NEON_MULTICOLOUR` is every active team except those in `NEON_SINGLE_COLOUR`.
- **Fallback, TBL:** the logo is one blue, so a multi-colour bake gives the same single colour. TBL keeps its tuned tint with the distinct white halo. Its baked file exists but isn't used.
- **The other TT-12 choices still apply:**
  - per-team halos (CHI, NYI and SJS accents; MIN and LAK jersey colours);
  - the soft and distinct spreads;
  - VGK gold and the DAL jersey stroke for the single-colour fallback path. VGK's bake is gold-dominant on its own.

**Readability flags.** Every team is legible, so none falls back. These read differently from TT-11; TJ to judge.
- **PHI, CAR, NJD, PIT, ANA, LAK, SJS, UTA:** these committed logos are mostly black or white. Black becomes grey `#818181` under the floor, so their outlines read mostly white or grey with the team colour as an accent. PHI is 77% black in the committed file, so its orange shows only in the centre. Proposed: if TJ wants these vivid, remap black to the team colour, as with DAL.
- **COL and WPG:** the thin navy and burgundy lines read faintest behind the stripes on real tiles. Proposed: the normal spread instead of distinct, or the TT-11 single colour.
- **DAL:** the jersey green is calm but dark on red tiles. Proposed: use the TT-11 tuned single colour if it reads too faint.

**Evidence**
- `tt12/contact-sheet-tt11-vs-tt12.png`: per team, the original, TT-11 on green and red frames, and TT-12 on green and red frames, at 120 px.
- `tt12/closeups-multicolour.png`: the first nine at 240 px.
- `tt12/fixture` and `tt12/genuine-run2`: re-rendered. Genuine export tokens match.

| Check | Result |
|---|---|
| E2E full spec, :3110, deny preload, v2 pins (two passes) | **34 passed** (33 + 1); collision guard passed; logo assertion: `multi` for 31 teams, the TBL tint otherwise |
| Monday (9) / Wednesday (9) PNG pins | **byte-identical to v2** |
| Tuesday pins | changed by design: 0e95ff4cff55628e756000f718abcd463bea433696b04fa2581684fa4fa557cc, e0f283d53aba3aa2384d9271a700804b42fcba3c97c2823a853ce9a0199f1d09, d9749935043999fb273af82b7577dfa9e013815b3a941cd5a7e1e37c7a3ce24e, f1051d67d8c0d69ac4168ec6d83f4bfa39f73fb2bd7cc97d9fcb8cdee9c88ec0 |
| Vitest / ESLint / full tsc / CSS pure | 240/240 / 0 / 0 / PURE OK |
| Network | denied Next.js version check only; no reads |

### Add-on files and sha256

| File | sha256 |
|---|---|
| `web/lib/socialShare/teamNeon.ts` | `fbffec1cc32bdd3eb742b531f747b864d24b6daf194cc2f9a4e695ae65523f90` |
| `web/lib/socialShare/teamNeon.test.ts` | `9cc4326f16a18b5421037501ea205d16e8db9ef1e6eaa1f744c76810bc392935` |
| `tasks/artifacts/tuesday-trends-2026-10-26/CONTRACT.md` | `6c29eae02c7237a65f518e92d084859a52077e23c038f60cee8b81045c3d38af` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/e2e-final-26a.log` | `8fd5f982a568e1c674cd5d8a08389d1f70431cb4a116e840fc6e64604c69b81e` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/e2e-final-26b.log` | `8bd665c9b15b17504a6cba343d3132e232cdf02b380b83ab0f256424adddeea0` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/vitest.log` | `43e5af2137145571442338d1586755801ed211c27e8ec3bfdf94296cc877024a` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/tsc.log` | `cbf7de6a7ab22aa8f3b63eed31368677222a5389d4a0bcaa112a952910051cec` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/eslint.log` | `a6b49f7a0b519016701eccb4efc2de2d77010ed919b35fdad1e3abacbe9dcfd8` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/css-pure-check.log` | `a30d5400826f09d082ae448bf0ade4127a1371c6a82a7d0859d115f3c089d3f4` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/node-network-26.jsonl` | `39fe74e93fc0fd9af1f180bcd6fb0a4d6f4a5d36e805b3919957cd0c30721950` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/evidence-26/tuesday-cards-pinned.sha256` | `ef1ae1ab23af3520eb0145778b3b591cb291687ee99f77dcf12a9e4c408ebefb` |
| `web/public/teamLogos/outline/color/ANA.png` | `c406f60d4cdabb21a52f9ac50e6cf2c46d372dcf90a77be2b1a2e82160320c9a` |
| `web/public/teamLogos/outline/color/BOS.png` | `b0980421a039912dc9aefb11a0382e4f435a4ae24b43c6cbf402b19b0209a0c3` |
| `web/public/teamLogos/outline/color/BUF.png` | `ec9333341778c280eb1cc5dd37a34f15a49621f7314986a5451a23538d02efde` |
| `web/public/teamLogos/outline/color/CAR.png` | `0436dfac31bdb90c3fd807d5190f0c8df6eb788d60563a606d51c977d9cba9a7` |
| `web/public/teamLogos/outline/color/CBJ.png` | `9892dafbfe19db25b684daeb1db0fa9a6e5705d7a7d4ff36b7c4ac9e309f5ea4` |
| `web/public/teamLogos/outline/color/CGY.png` | `89c40e72dae86370ea09d94e5ed60acb1ac6b098750da5aa49083c585f0a2b1c` |
| `web/public/teamLogos/outline/color/CHI.png` | `1dd4ea0a7994262e147bd1795feb0a1a90292f56f47fd1d2b71c4f159a41b9dd` |
| `web/public/teamLogos/outline/color/COL.png` | `f41ee91fc3501c5f8caf82d5060c37bdbbc4d12be0731569ec902883dbe2b8f9` |
| `web/public/teamLogos/outline/color/DAL.png` | `94543f235107c646f08e62ad76be319f11a2a303cb70f679240640ca652c1084` |
| `web/public/teamLogos/outline/color/DET.png` | `0e8388d66e82fa6678e13da1af127f0c87bbae6948e296b4f24d3f4e9fb25336` |
| `web/public/teamLogos/outline/color/EDM.png` | `5b9e92c84c256c1be06f77c76d54a3af4bd1446aad5aa7b7f615915117c6a5a9` |
| `web/public/teamLogos/outline/color/FLA.png` | `455de1a974494eb6f3aa9a402a9b2bfd80f129d5f64e1c8bfc223a41af41a947` |
| `web/public/teamLogos/outline/color/LAK.png` | `8341e78e703a0e7776cb3a18ce5b4e1b11bab949e0990661f5b754de884e4668` |
| `web/public/teamLogos/outline/color/MIN.png` | `ac64340af3f5d770871e9cdd99dc4c6946504db553e80018f0a2f0d9c393fae3` |
| `web/public/teamLogos/outline/color/MTL.png` | `8dff5f9b327d06bec2f8f8d491a48656abd2a0b3dd58b8e55ccd7d8f6361dd6e` |
| `web/public/teamLogos/outline/color/NJD.png` | `e592bf71d201557e4b4f21abb8b3381dab25b97fa810656ad5a747b8a40ee42a` |
| `web/public/teamLogos/outline/color/NSH.png` | `38b7444db3b6fde5e9dc1dc0410854f462ae9a7157921173198ef4c188a32c03` |
| `web/public/teamLogos/outline/color/NYI.png` | `2f6599b6a86a39788d47f6f1abc2a7148ec7f83437da1fb715d32eed6e8336e4` |
| `web/public/teamLogos/outline/color/NYR.png` | `c0d43c438e5a485d3793a1f0c0956d3e41d28c64ad0d3746e8db2afc352d7113` |
| `web/public/teamLogos/outline/color/OTT.png` | `584a01abc07a38b27f13f377fd58d55b6aa35f39114def04d069a93c6d1e879c` |
| `web/public/teamLogos/outline/color/PHI.png` | `cf7d695758a37d59f3ec31ba98b0cdd19228b4874c79bcb0c388464926902fdb` |
| `web/public/teamLogos/outline/color/PIT.png` | `5caf6525d672afa9790feeabd943597d5cdaf67ed39b2652dfbe9b94d85e9d15` |
| `web/public/teamLogos/outline/color/SEA.png` | `3f0cbdc61f19fc92031ab35b6747ab06fa1b876944c878c4c77655bf7c198ced` |
| `web/public/teamLogos/outline/color/SJS.png` | `07adec7394270d61f3e8c6c04347e7f013b49160cf77a2364c511ad15b2b3dd9` |
| `web/public/teamLogos/outline/color/STL.png` | `2f459d4f28a0232dfbb143d4b4c29049f05a5facfb4531b25337fc380993b777` |
| `web/public/teamLogos/outline/color/TBL.png` | `83103ff5c3430753d78d42598cf67545bbdb8cb823925b650086992c435a9d32` |
| `web/public/teamLogos/outline/color/TOR.png` | `8e1e0a149fd102d59e5824256a788ea8f8c6170f2ac83346c33059105285d45f` |
| `web/public/teamLogos/outline/color/UTA.png` | `f787cd938757b25a03c6a631d42e00d8e662a7cba4a2881101059465b9de1809` |
| `web/public/teamLogos/outline/color/VAN.png` | `cbaf246a4ec01f4ad6eb071e46e19001754c32c24dff8560f872e2f21b9add75` |
| `web/public/teamLogos/outline/color/VGK.png` | `75ccc09ca657fe12eb9d047dd516207b9659bd3ac6e64fef9ad4cff2ea13c935` |
| `web/public/teamLogos/outline/color/WPG.png` | `89c02072e8cceb37ccc005e0019a3d6c124f1b3387965fc82bc5b26d2fac8e06` |
| `web/public/teamLogos/outline/color/WSH.png` | `0ebf2c4dab60b1742cbcef52b92553fe178507324c4e9a0c850afea650290fd0` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt12/bake-multicolour-outlines.mjs` | `f4634db76b4d1544fe59afd24612175a5f5a78cc789a2ec976c010e1d684d657` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt12/closeups-multicolour.png` | `ea2f1887bf0ba2ded320e3c4720dc3c4aa738b641f3d244dcc64e665a72de06f` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt12/contact-sheet-tt11-vs-tt12.png` | `cfe1a623140ca5db83b6080bcb25850261e17566760ebf392e279a3dacc18706` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt12/fixture/TT12-OFFLINE-FIXTURE-desktop-deployment.png` | `6ca2b0d070bf015cc0ef90ec954405b9f3fa1e252f7630b3e2f249c765e87edf` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt12/fixture/TT12-OFFLINE-FIXTURE-desktop-hot.png` | `551c7db1bbd9e26d2d0cc714e3858bc28c0db84ee52fe04471ccd4f234ba0015` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt12/fixture/TT12-OFFLINE-FIXTURE-desktop-movers.png` | `b26beea225bc14f54cf20a8e644ada9d2b0dc99962652a62262cff1bcd0984ed` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt12/fixture/TT12-OFFLINE-FIXTURE-desktop-rates.png` | `430cd16577f931e5b0105d3e71a935c21c373c0bf0c88ace61a1d23af03c54d5` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt12/fixture/TT12-OFFLINE-FIXTURE-phone-deployment.png` | `250fb14ef98918e1e8ed4db2ad208d1b9f935fc905fad10db1f1346a01ccf7dc` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt12/fixture/TT12-OFFLINE-FIXTURE-phone-hot.png` | `16f67a6b1ee6407beab5519b035427b218d121fc9b478e3e9b4e599ba92f9aa0` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt12/fixture/TT12-OFFLINE-FIXTURE-phone-movers.png` | `d54dd2eb27658e86fd3ba7788bbbb2420aeb486c06456394c208640e0dd3e161` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt12/fixture/TT12-OFFLINE-FIXTURE-phone-rates.png` | `4529c5a587a2a2557869757012f35b8416f2ed4328d02ca2077bfd06c8987356` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt12/fixture/TT12-OFFLINE-FIXTURE-png-deployment.png` | `12f10da7071f009268d7b06df61052dc7fe9cfd29c1ac28dbda3272ade3a25b3` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt12/fixture/TT12-OFFLINE-FIXTURE-png-hot.png` | `373ae912720b4a3f4af5f417c57f2c96c9b6926c53d1cd6e187378c56909b91a` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt12/fixture/TT12-OFFLINE-FIXTURE-png-movers.png` | `96f322dbb5cb10802dc7413e01159439c3f531c7c48a0c8ef8c530e117f9ed53` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt12/fixture/TT12-OFFLINE-FIXTURE-png-rates.png` | `f47e929c1d119e3129431aabc889eaeb67780010834a6f8ee009c320abb6ce5b` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt12/genuine-run2/TT12-GENUINE-DATA-desktop-deployment.png` | `d26f9a979fb282891c47497df420ced3843f507093387481dd75dccd41d645d6` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt12/genuine-run2/TT12-GENUINE-DATA-desktop-hot.png` | `e0ddf1b203f45a4d260a2030df2b76f340408fe377821ce8d3ad9b9e62ec4e74` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt12/genuine-run2/TT12-GENUINE-DATA-desktop-movers.png` | `860a0293c785e05103176cb455b50c1c973d29bfdb8dd2070d5fca80399ab3a6` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt12/genuine-run2/TT12-GENUINE-DATA-desktop-rates.png` | `9001f431e3bd59c74f37071bc36c1af9355ca88e3f03e99119968ef4a801d039` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt12/genuine-run2/TT12-GENUINE-DATA-export-tokens.json` | `11e15c3e446f2aaca7d2af7c797409c1348cd42ec9a453532fb4d0987fbe13b4` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt12/genuine-run2/TT12-GENUINE-DATA-phone-deployment.png` | `1a6d8cb24f24ed1c705cb432756c5e87563b980f14891002d94224ddc97021c6` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt12/genuine-run2/TT12-GENUINE-DATA-phone-hot.png` | `02c23ec3f3a1669c529e96296cf85f15328432cd696581d979ced0fa12726607` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt12/genuine-run2/TT12-GENUINE-DATA-phone-movers.png` | `7b3f2ce7860f636bbc363c11e975d24b010ddda8410feb2157f7d453d5282260` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt12/genuine-run2/TT12-GENUINE-DATA-phone-rates.png` | `9bd9ee836bf282c49cd4a29f376b968aaac000e66f84e0629e524710fc86131d` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt12/genuine-run2/TT12-GENUINE-DATA-png-deployment.png` | `6c641b7f89ab0c3a1ca2eeae6dfd6591da300a5844f9f7838b1a4f202b5f0ae8` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt12/genuine-run2/TT12-GENUINE-DATA-png-hot.png` | `83e8e2d52964daf29c9a33d4512f249d5218b3d076f3d89a1ef4c14decdb095a` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt12/genuine-run2/TT12-GENUINE-DATA-png-movers.png` | `65c4a2be691ceb1d2fc8ada616e4260aedee5592397c53dcaa1a34fa8cc6f0a8` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt12/genuine-run2/TT12-GENUINE-DATA-png-rates.png` | `c2adabca6677eb40478b98418cbbc2478e1ac8469edd2454bce84fab7022c5f3` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt12/neon-lib.mjs` | `279bd90c993575b4b219721e44c3f27445706844649cf580f519aa8313ab24ac` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt12/palettes.json` | `7d22d0cf6b9c9b848d1e289888a640bab24044d631ec8e6cd1ce60faa2a325e8` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt12/sheets.mjs` | `dbf45bf6e4dea8aaa11d167eee4831d4a621228e99f41c96eff9d9aea8e3bb60` |
