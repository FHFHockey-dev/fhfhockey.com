# RECEIPT-8 — TT-8 and its add-on: neon stripes, Tomorrow group labels, Hot/Cold, outlines v2.5 (lane TT, offline)

- **Ticket:** TT-8 plus the TT-8 add-on, from the chef, on TJ's direct requests.
- **Not done:** no production reads, no pushes, no deploys.

## Raised, not changed: PROMOTIONS / DEMOTIONS

- **The issue:** the labels are as requested, but the column rule puts TOI first, so they misdescribe some tiles in the genuine run-2 render:
  - **Under PROMOTIONS with ▼ chips:** Alexandre Carrier (+1:44, ▼ P1 → P3) and William Carrier (+1:38, ▼ L1 → L3).
  - **Under DEMOTIONS with ▲ chips:** Ryan Greene (−2:04, ▲ L4 → L3, ▲ off PP → PP2).
- **Options for the chef/TJ:**
  - (a) Label by what decides the column: **MORE ICE / LESS ICE** (or **ICE TIME UP / DOWN**).
  - (b) Keep PROMOTIONS / DEMOTIONS and change the rule so the role leads.
  - (c) Keep both as they are.
- **Not changed.**

## 1. Neon stripes

- **Design:** the home page's 65° jersey-stripe edges (28 · 30/33 · 35/52 · 60 %) are now **thin team-colour lines** over a transparent field (`--team-bg`, `--team-light`, `--team-mid`), instead of solid bands.
- **Method:** a Sass `neon-stripes()` function builds them, with a 1.5 px core plus a 5 px glow copy at 32% (`color-mix`). The right-hand fade into the body stays. They are plain gradients, with no masks, and verified in the PNG.

## 2. Font

- **Files:** `Tomorrow-SemiBoldItalic.ttf` (62,248 B; sha256 `44bef0383d3ae455aefa06e84935b80c439f3f661b5097367255a2119cf1c4f0`, starting 44bef038 as stated) and `tomorrow-OFL.txt`, both committed.
- **Token:** `web/styles/vars.scss` gains `$font-family-sporty: "Tomorrow", system-ui, -apple-system, sans-serif;` and nothing else changes there.
- **Declaration:** `@font-face` "Tomorrow", 600 italic, next to the other share fonts in `SocialShare.module.scss`.
- **Export:** `export.ts` loads and embeds it like the others; the font list now carries a `font-style`.
- **Check:** E2E asserts `document.fonts.check('italic 600 26px "Tomorrow"')`.

## 3. Vertical group labels and Hot/Cold

- **Labels:** Tomorrow 600 italic, 26 px, letter-spaced, reading bottom to top in a 30 px track left of each column, green or red with a 6 px glow at .4:
  - Hot/Cold: **HOT / COLD**;
  - Ownership Movers: **RISING / FALLING** (eyebrows "ROSTERED % UP / DOWN", so the words aren't repeated);
  - Deployment: **PROMOTIONS / DEMOTIONS** (see "Raised" above);
  - Rates: none.
- **Rename:** Recent Form is now **Hot/Cold** (title, graphic option, footer definition, empty state). The rule id `recent-form-v1-early` and "Early season · small sample" are unchanged. Eyebrows read "UP VS PRIOR 5" and "DOWN VS PRIOR 5".
- **Fit:** the name size estimate is retuned for the narrower tiles (2-column text column ~290 px).
- **New E2E checks:** each card has exactly the expected labels and tones, and no label box intersects any tile. The TT-7b collision check passes on every tile, in stress mode and in the genuine render.

## Add-on: outlines v2.5 (`tt8/trace-logo-outlines-v2_5.mjs`, parameters in `tt8/outline-v2_5-params.json`)

- **Stroke weight, the midpoint (all 32 teams):**

| Version | Stroke diameter | Share of logo width |
|---|---|---|
| v1 | 7 px at 256 | **2.73%** |
| v2 | 7 px at 768 | **0.91%** |
| v2.5 | **14 px at 768** (disc radius 7, d² < 49) | **1.82%** |

  Interior edges use the same stroke. TT-7's lighter halo is kept.
- **COL's A:** the v2 per-channel-maximum gradient missed hue edges of similar brightness (the maroon A against blue and silver). v2.5 uses the **Euclidean RGB gradient** for interior edges globally, and the full A now reads (`tt8/col-crop.png`: original · v2 · v2.5).
- **Interior audit, every team:**
  - **Method:** relaxed-trace interior lines (gradient > 0.15, ≥ 24 px) farther than 8 px from any kept line.
  - **Overrides it led to:** DAL, WPG, MIN and UTA (colour threshold 0.20) and SEA (0.15 with a 24 px minimum stroke). This restored DAL's D, SEA's inner waves, WPG's jet, MIN's tree line and UTA's interior.
  - **Remaining highest shares:** COL 0.031, CHI 0.028, SJS 0.027, FLA 0.017, EDM 0.009, VGK 0.007, all speckle-level.
- **Sheets:**
  - `tt8/before-after-all-32.png`: all 32 teams at the 120 px tile size, original · v2 · v2.5.
  - `tt8/contact-sheet-v2_5-{green,red}.png`.
- **Outlines:** all 32 `web/public/teamLogos/outline/*.png` are regenerated and committed.

## Evidence (`tt8/after/`)

- **fixture:** desktop, phone and PNG for all four cards, with sparklines.
- **genuine-run2:** desktop, phone and PNG, without sparklines; all four export tokens match the snapshot.

## Checks

| Check | Result |
|---|---|
| E2E full spec, :3110, Monday/Wednesday pins asserted against v2 (two passes; see RECEIPT-5) | **34 passed** (33 + 1) |
| Monday (9) / Wednesday (9) PNG pins | **byte-identical to v2** (the new font embed does not change them) |
| Tuesday pins | changed by design: 01936c4120e27acfaa868185262b564e96ec218f4e48594ea4df097894ffc93b, 0bbbbb3f220059d25bbce85a062c1a7ee9e0d4b02d690691eb12ce0f565c13ca, 4f1bd9426b65a09dc4736db6c6c366171a8b4d44377df24f95319575a9c0a1e3, 8b579de42d5c05721a419b37bb01bee793d97071f3cf6907c563a91e71c0748c |
| Vitest | 231/231 |
| ESLint / full `tsc --noEmit` / CSS pure | exit 0 / exit 0 / PURE OK |

## Files and sha256

| File | sha256 |
|---|---|
| `web/styles/vars.scss` | `a9ba48f903a782517b26ffe57452892074fd4642a7e896302d574d6e151a103d` |
| `web/public/fonts/social-share/Tomorrow-SemiBoldItalic.ttf` | `44bef0383d3ae455aefa06e84935b80c439f3f661b5097367255a2119cf1c4f0` |
| `web/public/fonts/social-share/tomorrow-OFL.txt` | `1dd4eaacd1da1bfb7e1d14dd5af0279c17d4503fde55abc628bdaccc63ae9eca` |
| `web/lib/socialShare/export.ts` | `3476d5e1872350d9d9d1e6db9679c54bfd0b35839859e057582894ec90c7f8e2` |
| `web/lib/socialShare/trends.ts` | `04ce171a568f2dbbcdca5b46e36525ce76ff60c18515c0a866ff46411f9951a0` |
| `web/components/SocialShare/SocialShare.tsx` | `3d47a40b8e30c0bec9d0d120313c4bb5200bffe0207c644945a45ca954aaf760` |
| `web/components/SocialShare/SocialShare.module.scss` | `1bd2721fd4df6506996697af528aacd89806ea29e7ba4d70d7b50ba7571e5c97` |
| `web/components/SocialShare/SocialShare.test.tsx` | `ae3c05bee1904b3b16298cb13a6d37b5db61f4f00e856a407a96418057e33ec5` |
| `web/e2e/social-share.spec.ts` | `7c1564e36327727739a588f71d9e313a83f9caf221ee6fa19aea45c87efaa5f1` |
| `tasks/artifacts/tuesday-trends-2026-10-26/CONTRACT.md` | `ab49f30f91436b6ec80a5124f52015c0a518afa7754a031a7a3f0f85d61dc575` |
| `tasks/diaries/2026-10-26-claude-tuesday-trends-worker.md` | `f8d69e9512786c25afe9bd2eb493979736a4fd0fc8ef17765a116e504ce93030` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/e2e-final-18a.log` | `292eb642fb1f838eaaa20b8bd940f286601c6c4f5f11e40558ff35d7716893f8` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/e2e-final-18b.log` | `ae0ee7fd32b74820ea41fcd6c16bac8d8f43a18ba6ae4aff1b43088c2fb43ee9` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/vitest.log` | `1729dcbac3a9ecf75a0ded7647f2e2c29854c878ed33fdcac5b4387271c75f90` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/tsc.log` | `cbf7de6a7ab22aa8f3b63eed31368677222a5389d4a0bcaa112a952910051cec` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/eslint.log` | `a6b49f7a0b519016701eccb4efc2de2d77010ed919b35fdad1e3abacbe9dcfd8` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/css-pure-check.log` | `90a2d6370986b7630897e858b77b946afa0a93ed6b13a7a8c0d49b8c05e7d9c6` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/evidence-18/tuesday-cards-pinned.sha256` | `1e6b149d4b9db4015fd5486a43af734e588d18f456da13e85e2ad156f4016b0f` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt8/after/fixture/TT8-OFFLINE-FIXTURE-desktop-deployment.png` | `a3e03b9fee8eb8e5ddca23cf9c56d2e3fa723659d40c9a62f98a4ad3313ae7d9` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt8/after/fixture/TT8-OFFLINE-FIXTURE-desktop-hot.png` | `555c53c3e131f6230397d914bb66824e81d323b7e7244be7e57efe8278e8e1dd` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt8/after/fixture/TT8-OFFLINE-FIXTURE-desktop-movers.png` | `be384e4bd9cea1d9e1f517acb5ae1f5866cbe2f3ff9474e5b68e472efe228b0b` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt8/after/fixture/TT8-OFFLINE-FIXTURE-desktop-rates.png` | `e78b32a418cea8fef93bf6a53ff4c4a7dc242e6cb41aacabbb5825ddac678232` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt8/after/fixture/TT8-OFFLINE-FIXTURE-phone-deployment.png` | `1d3d5eabec609fe0027efb8bd72c599361012580e4f18adafcee5a658b286ea7` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt8/after/fixture/TT8-OFFLINE-FIXTURE-phone-hot.png` | `12806756af4ab1db9a7a43cfb33f496b9d0a945bcba4b013206aaf02d72bf3f0` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt8/after/fixture/TT8-OFFLINE-FIXTURE-phone-movers.png` | `02a0914e62ef048b9ed07891ef35630303c50996dc7fbd5966d36ed56d9cedec` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt8/after/fixture/TT8-OFFLINE-FIXTURE-phone-rates.png` | `8806c3f142b19a2fcdaf4cfa1ac905e78a08273915ca54b1b03c050560105197` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt8/after/fixture/TT8-OFFLINE-FIXTURE-png-deployment.png` | `9352cc5f7a1668704be1a9c67350f3bec4d83320515d9612ec32fd5cfcbffb1a` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt8/after/fixture/TT8-OFFLINE-FIXTURE-png-hot.png` | `cbd86e62cd876adb87fa36e257266ec112e13bec310f0c70f5de04fca6bdf630` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt8/after/fixture/TT8-OFFLINE-FIXTURE-png-movers.png` | `ea6cbe2273bca1da37550b0434b00ea34c4981f385d253e03e4541758a07914e` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt8/after/fixture/TT8-OFFLINE-FIXTURE-png-rates.png` | `73fded946fd7ffe12d5875fcf4b13842912f6ae047a8949da3ef96be8b1802fd` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt8/after/genuine-run2/TT8-GENUINE-DATA-desktop-deployment.png` | `dfbfe0baef42aebfa9c6e08c04bad19f6811a8d53f575d0a2723dc1980c6ffde` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt8/after/genuine-run2/TT8-GENUINE-DATA-desktop-hot.png` | `ab82c9957aba10a6b0115d4a68c2a1f19eb85e02d06feeab0380b0174bbf27cf` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt8/after/genuine-run2/TT8-GENUINE-DATA-desktop-movers.png` | `ded7a1a27d405469c9aa1f8a94d68e3201c22ca7192f1233a550adaf7c3618be` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt8/after/genuine-run2/TT8-GENUINE-DATA-desktop-rates.png` | `d7ad340b3c988153e5762fcfad176fd708520e6a8450e7ea4916764a25793435` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt8/after/genuine-run2/TT8-GENUINE-DATA-export-tokens.json` | `f09c8f846649427a46434c76ab551293f62be08a0da930aad6ad23aebd03d9de` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt8/after/genuine-run2/TT8-GENUINE-DATA-phone-deployment.png` | `42baff2b5142c20f396f4a64eb2434d1b5797b6cc4556bc08b6dd84e66a9d15a` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt8/after/genuine-run2/TT8-GENUINE-DATA-phone-hot.png` | `04730b19ee484bfc42d618796ed36ade1225e02df54709bfeabdc15b634be469` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt8/after/genuine-run2/TT8-GENUINE-DATA-phone-movers.png` | `c57afb94c5ba730717f5f8778bcb47a03bc3443ff6d0aae1818736253e260a03` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt8/after/genuine-run2/TT8-GENUINE-DATA-phone-rates.png` | `4d08074b9439a15e5e767d7a9333f7099b32971891cba06b096484609cc2b3ae` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt8/after/genuine-run2/TT8-GENUINE-DATA-png-deployment.png` | `a3032e99e26601488b6302946868e488510602e7e3fd5484280b68f191b0831e` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt8/after/genuine-run2/TT8-GENUINE-DATA-png-hot.png` | `7df78c167ca566cd067d856fc926eabcf54611ada75b91596e23d75f03825af6` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt8/after/genuine-run2/TT8-GENUINE-DATA-png-movers.png` | `ec93eb956a817df8147c7ac54a32fc4222e574cf59d150cc6e408272a5e3157a` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt8/after/genuine-run2/TT8-GENUINE-DATA-png-rates.png` | `73c323237009f9642c7970285331cf175887468b3016e472d522cd6bcc490229` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt8/before-after-all-32.png` | `94db930a874340145d7b59f64e593131483bdf1159113f9a557df4af17a8f2e4` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt8/col-crop.png` | `4b0312641b2cb3a7743ed3d55ea95cc8b6e172bba9fef7c68d8203003eb1c7d6` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt8/contact-sheet-v2_5-green.png` | `b6116cd02c2717750f9ebee954a46600d034750839de0aba70d673e62a100560` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt8/contact-sheet-v2_5-red.png` | `4dcc9fd7372fc6097581b77bf72ea566663ae73da6b20dfc1dba95d588893899` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt8/outline-v2_5-params.json` | `2d26f0200e1e07b8b98527c08cf003642059fbf87d4a0fac3b60718954c80143` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt8/trace-logo-outlines-v2_5.mjs` | `72df0f8f810ff81f92b0a493dff7528acb5546360280157a8284c24d68efab41` |
| `web/public/teamLogos/outline/ANA.png` | `a874a2f91bfb69e17392b8aaa26f1a77ed54892fbf3e6adde6e8df3e00b5dc94` |
| `web/public/teamLogos/outline/BOS.png` | `247902c632f46cd7095a4a564c7288097dbc7a0681718a0c9f645218738b4740` |
| `web/public/teamLogos/outline/BUF.png` | `7ced572f93221a220e53d0a03a0741d9053dd6962bf1567187c102d79aa42a4c` |
| `web/public/teamLogos/outline/CAR.png` | `e9e11eb72f4d6885d83c0c71da7c75d8aaff4110b90113be3c0f61773f701229` |
| `web/public/teamLogos/outline/CBJ.png` | `fd4fe821610ec03bee75cf37d47c5c47d0ec99596519116119cb376371012019` |
| `web/public/teamLogos/outline/CGY.png` | `80b5a9410a34484bcfa5239119d01f7b99842dac1f3ff6443d40edadaa02e4ae` |
| `web/public/teamLogos/outline/CHI.png` | `51f9d0b0226ab47322a69bc114864be3da535a2bf8ad3ae44a0b3932ea3c652e` |
| `web/public/teamLogos/outline/COL.png` | `6dc69865ba26a90ef34e3c494be854a5ad6559c70f38d1698c7c86b6334a91bc` |
| `web/public/teamLogos/outline/DAL.png` | `9a10cd9f057d82e834664328e6ee7d8647f67f7e515165aa8cfb59cffd1f3345` |
| `web/public/teamLogos/outline/DET.png` | `f54b3fbe9dde17720406888a6824e30ae8acf396a872be149747a6a79a5becb5` |
| `web/public/teamLogos/outline/EDM.png` | `5827ed13e2bc11ae75050e74e71b49acbdf5380a527b2b4bf7d83b8d68160f7a` |
| `web/public/teamLogos/outline/FLA.png` | `77d3c1127894612a206dd34ebcec0de6ada7db6edf8efff905a0acdd1935c068` |
| `web/public/teamLogos/outline/LAK.png` | `ca479dc26e86776f40e2a0ef7d4e7130b66ab2f8d4c2c80ecda455f46ceb5bfc` |
| `web/public/teamLogos/outline/MIN.png` | `3625f046a6b810db00af18adc88acdcd2f5b058433ae0d0387b2809a19fe4dd1` |
| `web/public/teamLogos/outline/MTL.png` | `5046d5ff56cf3f675d34e93fb880be25cb34a3671c0fc77184e035ab8420f527` |
| `web/public/teamLogos/outline/NJD.png` | `1ee44a970fdd80c0235da199f259807c4c962c0b7c7ea6e59712a7f694ff46f9` |
| `web/public/teamLogos/outline/NSH.png` | `ee8af60fc3f1ca13e58ee125e262cd44820c361a14bc64d903b1981adece0fcc` |
| `web/public/teamLogos/outline/NYI.png` | `8308b531389931caf09142a0b4833536af0032778f262b8ecc50490ffbe7953f` |
| `web/public/teamLogos/outline/NYR.png` | `c79ea77a71acd2250261a91566a3ca3f11e8f15143367c352eca3992a9d548fd` |
| `web/public/teamLogos/outline/OTT.png` | `d04533cffcc460aa23477c32c99afdeb20789955c583f7bdc92ae780034f7b7e` |
| `web/public/teamLogos/outline/PHI.png` | `54588a77f80c659aa9690aaaceb4d4a0c41a10ceca957fc7c921c206e22ea431` |
| `web/public/teamLogos/outline/PIT.png` | `890b00ed7ac5a01bb7681bbf87a3cf79a2fb1c70fd19843f3756b047aae0d55a` |
| `web/public/teamLogos/outline/SEA.png` | `529799b319a337942734840a5ae66591f8224e9a1fe3f3ada8e0087d19314d0f` |
| `web/public/teamLogos/outline/SJS.png` | `65b1f03bfd0c7dc906e0bd237da46e5defc27d39d4c31b6e21c1e2d50cf92bf7` |
| `web/public/teamLogos/outline/STL.png` | `803ad7f2b6365d10d94ff26cf4a016c106d5f94fea0c5efa8db0bf08610bfc0d` |
| `web/public/teamLogos/outline/TBL.png` | `0722199ff6219f710d6d04c872b0b2884bf313868c5a7aa8247362aec1a3f4a2` |
| `web/public/teamLogos/outline/TOR.png` | `6b88f2d7c171df68e5be22823516c9fbf8679e0f0981fb1275e51221fc1eb6db` |
| `web/public/teamLogos/outline/UTA.png` | `bc5131841c29b5dd39537dfca1048c28060b0090c06979ebf4f3b33a10bec9bc` |
| `web/public/teamLogos/outline/VAN.png` | `11383e16f36192460bfdadfc6bee8237ef585f550b6d2f910a69ab5ee3138a82` |
| `web/public/teamLogos/outline/VGK.png` | `dcadb60145770224ea294ab2c36c2f9199ed6b7c377271d67b47e31d01e43e72` |
| `web/public/teamLogos/outline/WPG.png` | `9d84d44d292b70873042b756c49f27612eb883d786c44ed82778dde0ac219e6e` |
| `web/public/teamLogos/outline/WSH.png` | `44815194996012ad4555c9e611f91f4e241a7a003eb6b8fa2b583e1c4008bc80` |

Note: `*.log` files are gitignored; their hashes cover the local copies.
