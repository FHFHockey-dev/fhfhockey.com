# RECEIPT-13: TJ's per-team notes on the TT-12 sheet (lane TT, offline)

The bake moved to `tt13/bake-multicolour-outlines.mjs`, which supersedes `tt12/`. The per-team parameters are in `PARAMS`, documented in the script. The parameters used and the resulting palettes are in `tt13/palettes.json`. Every team is re-baked; the PNG bytes changed only for the teams below:
- `web/public/teamLogos/outline/color/BUF.png`
- `web/public/teamLogos/outline/color/CAR.png`
- `web/public/teamLogos/outline/color/CBJ.png`
- `web/public/teamLogos/outline/color/CGY.png`
- `web/public/teamLogos/outline/color/COL.png`
- `web/public/teamLogos/outline/color/DAL.png`
- `web/public/teamLogos/outline/color/EDM.png`
- `web/public/teamLogos/outline/color/NYR.png`
- `web/public/teamLogos/outline/color/SEA.png`
- `web/public/teamLogos/outline/color/TOR.png`
- `web/public/teamLogos/outline/color/VGK.png`
- `web/public/teamLogos/outline/color/WPG.png`

| Team | TJ's note | Done |
|---|---|---|
| BOS, CHI, DET, FLA, LAK, MIN, MTL, NJD, NYI, OTT, PHI, PIT, SJS, STL, TBL, UTA, VAN, WSH | Keep TT-12 | Unchanged (TBL stays single colour) |
| ANA | "Save both" | Ships the TT-12 multi-colour bake. The TT-11 single orange is kept as a documented switch: `NEON_SAVED_VARIANTS.ANA`; adding ANA to `NEON_SINGLE_COLOUR` shows it. Nothing deleted. |
| CAR, CBJ, CGY, EDM | Thicker stroke | Line radius 5.5 (was 3) at the 768 px trace, TT-12 colours |
| NYR | Slightly thicker | Radius 4.25 |
| BUF | Thicker or brighter | Both: radius 5 and floor 5.5:1 |
| COL | Brighter, "not entirely visible" | Floor 8:1 (navy `#236192` lifts to `#7eb5e0`, burgundy to `#dd9db1`) and radius 4.5 |
| DAL | Brighter | Floor 8:1: the jersey green becomes `#00c888`; radius 4. Still not the abrasive neon `#44d62c`. |
| NSH | Back to the TT-11 all-yellow | `NEON_SINGLE_COLOUR`: single tint `#efbe53`, halo `#ffb81c` |
| SEA | Single team colour with a red highlight at the top of the S | Every region except red becomes the tuned single colour `#6bcdf4`. The red eye (0.8% of the logo, kept with `minShare` 0.2%) stays red, floored to `#ef3856`. |
| TOR | Blue outer outline, white inner text | `pick: interior`: the silhouette is blue and every interior line (text, veins) is white, as whole lines (no two-tone) |
| VGK | Forehead and cheek detail | Lower interior-edge threshold (0.12) and shorter kept strokes (1.5%). The forehead ridge lines and cheek facets now trace. |
| WPG | Colour by region | `pick: inner`: each edge takes the colour of the region nearer the centre, with a lower threshold so the ring and jet edges trace. Result: silver outline, blue outer circle, white circle, red leaf, grey jet. |

**Notes**
- No team had to fall back.
- **Thickness:** the change is clear at full tile size but modest on the 120 px sheet, because the trace is downsampled. If TJ wants more, the radius is the one parameter to raise.
- **WPG's jet:** traces partly; its upper edges over the white circle are fainter than the leaf.

## Evidence
- `tt13/contact-sheet-tt12-vs-tt13.png`: the 13 changed teams, showing the original, TT-12 on green and red frames, and TT-13 on green and red frames, at 120 px.
- `tt13/closeups-vgk-wpg-tor-sea.png`: original · TT-12 · TT-13 at 240 px.
- `tt13/fixture` and `tt13/genuine-run2`: desktop, phone and PNG renders. Genuine export tokens match.
- The generators are `tt13/bake-multicolour-outlines.mjs` and `tt13/sheets.mjs`.

## Checks

| Check | Result |
|---|---|
| E2E full spec, :3110, deny preload, v2 pins (two passes) | **34 passed** (33 + 1); collision guard passed; logo assertion follows `teamNeon` (NSH and TBL tinted, the rest baked) |
| Monday (9) / Wednesday (9) PNG pins | **byte-identical to v2** |
| Tuesday pins | changed by design: 0608bf1f64f31ead365b78fa86a86f753ef91cdb0f075dfa156f82ed17ad4402, 2e4c8eb69b34e8e9edac2c9028c696d448a8ec2825ce83fd7314466f43b869f8, 81096611db36c5800a6158c012203f523cc31ddd73546eaaed8e9e398c5033db, c0ecbb322111519077ee620f5723643aacdafb33d69f5419facee90025d53e4a |
| Vitest / ESLint / full tsc / CSS pure | 241/241 / 0 / 0 / PURE OK |
| Network | denied Next.js version check only; no reads |

## Files and sha256

| File | sha256 |
|---|---|
| `web/lib/socialShare/teamNeon.ts` | `f693ab1a6663f7215b6a02324f8525e7631d98acd4b89a619ff0917b49112fb5` |
| `web/lib/socialShare/teamNeon.test.ts` | `a380a1cbaee8ae030858bab4d6f6e0330f708bc0c23697d2b98d8505bb2b02dc` |
| `tasks/artifacts/tuesday-trends-2026-10-26/CONTRACT.md` | `1570ed7aaca9b682040de6a34f01832936bbb419798319aa29b88ea875da9902` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/e2e-final-27a.log` | `762dd1b7b070a6eb5148dc36d2b883fca212efdbf50551958ee7f2aa179ecdaa` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/e2e-final-27b.log` | `8bd665c9b15b17504a6cba343d3132e232cdf02b380b83ab0f256424adddeea0` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/vitest.log` | `08a2ef47a1c7445316ff54f667ba93a88a7322f40ace0712c937cc77d86a02d1` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/tsc.log` | `cbf7de6a7ab22aa8f3b63eed31368677222a5389d4a0bcaa112a952910051cec` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/eslint.log` | `a6b49f7a0b519016701eccb4efc2de2d77010ed919b35fdad1e3abacbe9dcfd8` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/css-pure-check.log` | `a30d5400826f09d082ae448bf0ade4127a1371c6a82a7d0859d115f3c089d3f4` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/node-network-27.jsonl` | `1fe697465fc8ad6944dd7f263b82a6eb71b48e81e5569f4e0a8a560112a7c8c8` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/evidence-27/tuesday-cards-pinned.sha256` | `201fc3cdd311a4647e8654301e4817bca62b5ba25ba9be5922fe2ddd0ec00d2a` |
| `web/public/teamLogos/outline/color/BUF.png` | `36f81d31cdb1eeb3f17247eda78919d4031f129d7f4e9bbde7fbaaf7dcdcdc4f` |
| `web/public/teamLogos/outline/color/CAR.png` | `a8b2c0c5aca684e80d1a47b4e699925168f20c1621f3c899dcd47d26fb2d5e75` |
| `web/public/teamLogos/outline/color/CBJ.png` | `f6df557fc714f7992e6176bd3a733fe324212d72823629a6821c4945e00cef86` |
| `web/public/teamLogos/outline/color/CGY.png` | `fb3ccf5cdd884f9d5a2e68e37d4b593ef4788eb23fda9c7f032736ea1921c9f6` |
| `web/public/teamLogos/outline/color/COL.png` | `f400f841040ac6acb9a2898c5e9eefb5a457798e1871790829bd87ce47e08c02` |
| `web/public/teamLogos/outline/color/DAL.png` | `1d87936c6c4e171adb11987023fab0c71e8697b89486dd4522ba6132b444c658` |
| `web/public/teamLogos/outline/color/EDM.png` | `67c202bb8152a4b1eac5418fe1b6149ae06dc8cd167c5ddad078edb04bf5a31e` |
| `web/public/teamLogos/outline/color/NYR.png` | `8536c8b898468edf737024021e3cf575d40fc64d447fe460cf0a0367cd03a6e9` |
| `web/public/teamLogos/outline/color/SEA.png` | `84f3da8b7ce747d24ca2ec4869505b438d1665e5447f9686bc235df189ff44a2` |
| `web/public/teamLogos/outline/color/TOR.png` | `362993613507fb4599f84e5127a632ae1208b3781c9077def4e4aae65d10c144` |
| `web/public/teamLogos/outline/color/VGK.png` | `683c26c32d50383f1c0cbdd0bd8993747e0ca3fd51b30fb10d326930c5a6632c` |
| `web/public/teamLogos/outline/color/WPG.png` | `fd585525c4d48216ec13ec47997ad1843fdf64ef0bae3f551e7983d2930786c6` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt13/bake-multicolour-outlines.mjs` | `ffeac73698db0b4398b2f89bd31bed3a50de10ca9b90c01f0205092bec139a4f` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt13/closeups-vgk-wpg-tor-sea.png` | `8b318bbda674ceaa6bfbebd020efc4208396ac8bb7cb10a5c423e6f0ce3649a4` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt13/contact-sheet-tt12-vs-tt13.png` | `c370854c32df9d188d1c6f884aefa9c17197dc129f039929900a3cc4eee54848` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt13/fixture/TT13-OFFLINE-FIXTURE-desktop-deployment.png` | `7948389522ccef4b60c2e594a65ae6b4b821a5259def0a44e766355af601a2bc` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt13/fixture/TT13-OFFLINE-FIXTURE-desktop-hot.png` | `ed93296777ec1098547be9d9f8b52a51bb3cf215f6cdbd1a0879b7fedd67d2f0` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt13/fixture/TT13-OFFLINE-FIXTURE-desktop-movers.png` | `31e8fd9dec969c970e5bce75faed44a1b1733560333e8e16ab1208ff8198d458` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt13/fixture/TT13-OFFLINE-FIXTURE-desktop-rates.png` | `1e0238f06d8a7d9e6660d086656d292a98ba2a91f3e315251ea51a0eb25f20cc` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt13/fixture/TT13-OFFLINE-FIXTURE-phone-deployment.png` | `1a2a275d7d51487a97741a71cf624c3c09cac5d9e458e6d116d5f960e60e7fab` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt13/fixture/TT13-OFFLINE-FIXTURE-phone-hot.png` | `521801935d9bbbb469b6caa0279ef9fd7117906d9b18c84b435dbdcf66519921` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt13/fixture/TT13-OFFLINE-FIXTURE-phone-movers.png` | `602238d255f9ba676e8d885c292a87be6d18d09df4220cd950cf53c142bea44f` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt13/fixture/TT13-OFFLINE-FIXTURE-phone-rates.png` | `30067c9bb9de4e4832ac84925129ee3a4b94c6d74ce9130d1d1ae98925c64ea7` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt13/fixture/TT13-OFFLINE-FIXTURE-png-deployment.png` | `d30c7e83eb880ab0d60c82b2aee118fee87d158da35c4c6ebe9e24e962d38fa7` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt13/fixture/TT13-OFFLINE-FIXTURE-png-hot.png` | `ab57e74ace1fec2d453b0adc40ced18f67c0fb63ad45ef0e32753a57e2481631` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt13/fixture/TT13-OFFLINE-FIXTURE-png-movers.png` | `71570452b0272bb08a6ff07f0c9e35fa27581ec8fb7d530dbc5b7d652944d1dd` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt13/fixture/TT13-OFFLINE-FIXTURE-png-rates.png` | `f8b55823a58888db6b754b547f04a5c080b757c98460176d1d6d3b9ca130b23a` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt13/genuine-run2/TT13-GENUINE-DATA-desktop-deployment.png` | `06354f7d8114ce1abf521018a5835272d25da2b9f763600aba10f0a093fe9af1` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt13/genuine-run2/TT13-GENUINE-DATA-desktop-hot.png` | `2450a8261d2b902d853ffb7b65d71b2be1b9ddacf151ee41307ff93dad4ef30c` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt13/genuine-run2/TT13-GENUINE-DATA-desktop-movers.png` | `0c0111e0b4b5037a6a80733925e937bcd4a71aded97c3e62392a411a37cf1a7e` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt13/genuine-run2/TT13-GENUINE-DATA-desktop-rates.png` | `30b348f0562e80bf1246cb1da7d4c8fd8ee271e855a32f2c76cea0eb072fdab0` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt13/genuine-run2/TT13-GENUINE-DATA-export-tokens.json` | `a7ee060cbbd13e2bbe45833e04da360eec9e238c09c2b0b0516a8a63ed53ae19` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt13/genuine-run2/TT13-GENUINE-DATA-phone-deployment.png` | `0e50a9b7bc8c142d49549c074fd5a0500f637aaa973fc3d0186cab6a2b1ceab4` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt13/genuine-run2/TT13-GENUINE-DATA-phone-hot.png` | `e61dcf6e6b03ea824c70bdcfca12b3a772f967276321a9a27a94831db8207821` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt13/genuine-run2/TT13-GENUINE-DATA-phone-movers.png` | `7a3bc63960dc6f6e836b5c97502088282538eb23715405f76e999ad77f705c09` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt13/genuine-run2/TT13-GENUINE-DATA-phone-rates.png` | `b21d6a308358c42794f8a9b4188bd02c92ec4d1842ec41c5c38cd85c51655858` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt13/genuine-run2/TT13-GENUINE-DATA-png-deployment.png` | `8b9c1deb2dca48e3683600656e8433c094f6f640b886e52ce114e54513ad700c` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt13/genuine-run2/TT13-GENUINE-DATA-png-hot.png` | `d8566276de05e3a0dca6eb970ce37b192674db3b50b1c769c3c35f904b3ec4fd` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt13/genuine-run2/TT13-GENUINE-DATA-png-movers.png` | `ed17c274365fa47397c88252c1349966e7a62620b9cc9b3f9e835fca730c7e4c` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt13/genuine-run2/TT13-GENUINE-DATA-png-rates.png` | `0edc221450a357a9f3e3ba32ad4594dfc50e1c4c7c58b654c00309fa39d609da` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt13/palettes.json` | `e3153bf965efdeae9ff9887ad4464f4d7c3330455eec23584e985b6a416ddd4b` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt13/sheets.mjs` | `7fa1cf9dfa5e85c07b1cd77d80a726038437b2ca2eddb6771d7be25b254a85d1` |
