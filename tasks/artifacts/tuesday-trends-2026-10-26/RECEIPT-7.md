# RECEIPT-7 — TT-7: lighter glow, v2 outlines for all 32 teams, home-page light-card tile layout (lane TT, offline)

- **Ticket:** TT-7 from the chef, after TJ reviewed the TT-5/6 genuine renders.
- **Not done:** no production reads, no pushes, no deploys.

## 1. Glow turned down

- **Before (TT-5):** the neon logo used `drop-shadow(0 0 3px) drop-shadow(0 0 8px)` in full tone colour, which bloomed thin strokes into blobs (EDM, CBJ on movers).
- **Now — logo:** `drop-shadow(0 0 1px rgba(black, .9)) drop-shadow(0 0 2px rgba(tone, .55))`, a thin dark edge plus a light halo.
- **Now — other glows:** the tile border glow is down to `0 0 8px rgba(tone, .22)`, the sparkline halo to 1.5 px, and the hero text-shadow to 6 px at .35.

## 2. Outlines v2 for all 32 teams; no team needs the stripe fallback now

- **Tracer:** `tt7/trace-logo-outlines-v2.mjs`, reading committed logos (git show HEAD, GIT_DIR stripped).
- **Method:** trace at 768 px, downsample to 384 px. The alpha silhouette contour is always kept. Interior colour edges are kept only above 0.3 **and** in connected strokes of at least 46 px at trace size, which removes letter clumps and speckle. Then thinning and a 3 px stroke radius at trace size, thinner relative to the art.
- **Threshold tuning:** a first pass at a colour threshold of 0.42 dropped the low-contrast interiors of LAK (letters), VGK (helmet) and SEA. At 0.30 they are back, and wordmarks stay clean.
- **Contact sheets at the real tile size (120 px)** with the new halo: `tt7/contact-sheet-v2-green.png` and `tt7/contact-sheet-v2-red.png`. All 32 are legible.
- **Former fallbacks** NYR, NYI, WSH and DET are now neon: before/after crops in `tt7/before-after-former-fallbacks.png` (original · v1 TT-5 · v2 TT-7).
- **Fallback list:** `OUTLINE_FALLBACK_TEAMS` is now **empty**. The mechanism stays per team, and a missing outline still falls back to the full-colour logo over the stripes.

## 3. New tile layout (home page `.desktopLightCard`)

- **No TeamBanner strip.** The tile has a dark body (`#15191f`) with a tone-coloured border and a faint glow.
- **Left:** the team's 65° jersey stripes (the same gradient recipe as `homepage-jersey-stripes`), darkened and faded into the body. A large logo is cropped at the left edge: the neon outline in the tile's tone, or the full-colour logo as fallback. A small "TEAM · POS" tag sits bottom-left.
  - **Fade method:** plain gradients and an image, with no CSS masks, so the html-to-image PNG matches the preview.
- **Right, right-aligned:**
  - the player name, large, uppercase, tone-coloured, up to 2 lines;
  - the hero change with the absolute value beside it in smaller type ("22:19 TOI/GP L5");
  - the kind label, with the sparkline beside it (stacked rates tiles put it above);
  - the detail lines ("· N GP this week" appended);
  - the badge and role chips in one right-aligned row.
- **Applies to:** all four cards. Label kinds, tones (green up, red down, blue neutral), sparklines (Transaction Trends' area chart on movers), the source/freshness footer and the 1080 export are unchanged in meaning.
- **Rates:** three narrow, tall columns use a smaller logo in the upper left and a shorter fade.

## Evidence (`tt7/after/`)

| Set | Files |
|---|---|
| Fixture (with sparklines) | `fixture/TT7-OFFLINE-FIXTURE-{png,phone}-{hot,deployment,rates,movers}.png` |
| Genuine run-2 (no sparklines; captured before the series columns) | `genuine-run2/TT7-GENUINE-DATA-{png,phone,desktop}-*.png`; all four export tokens match the snapshot |

## Checks

| Check | Result |
|---|---|
| E2E full spec, :3110, Monday/Wednesday pins asserted against v2 (two passes; see RECEIPT-5 on the dev `/404` loop) | **33 passed** (32 + 1) |
| Monday (9) / Wednesday (9) PNG pins | **byte-identical to v2** |
| Tuesday pins | changed by design (new layout): e48ace608863ac991d82bca4a5c3211a903f5cb7e8b65e9339f7ac29043527fe, 1a7240a48f10f970cf185769aa360e707ba189afeed2f90f1a181c761fd94172, 3dcff06fdfd46cf3cb2c6831be9c02301d80aecfe7992112adac0efb05efa9ca, fb48ad70446d6242029b3c1ef7db555ee5360f96fa14d7435c7d42785032d57d (hot, deployment, rates, movers) |
| Vitest | 231/231 |
| ESLint / full `tsc --noEmit` / CSS pure | exit 0 / exit 0 / PURE OK |

## Files and sha256

| File | sha256 |
|---|---|
| `web/components/SocialShare/SocialShare.tsx` | `d503907a9b947335ba7ba3f679cf66c0aa8f12467791cca15219f34ff7b89fcc` |
| `web/components/SocialShare/SocialShare.module.scss` | `c2c53068a4ab95455ef99ecfae404f0c21b6d1d1ce3ffebbad44a21485e6bcc7` |
| `tasks/diaries/2026-10-26-claude-tuesday-trends-worker.md` | `d41af7071d252a8da220cb02714ec54c32cb768be01692d43d887bf9040d647c` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/e2e-final-14a.log` | `9e2121d32adacb5e515d6cf90c3b02a23e33d7c21d8e02e3d329650d8e9bf75d` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/e2e-final-14b.log` | `f9c8ac6b6f29999f2800a5c51fc6e1b53086b306dee3ef95ba85e72031b3793d` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/vitest.log` | `59decba99cfd75a971b736c58df0fa6555800e5c67a7615aa23111c2a1df1e4b` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/tsc.log` | `cbf7de6a7ab22aa8f3b63eed31368677222a5389d4a0bcaa112a952910051cec` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/eslint.log` | `a6b49f7a0b519016701eccb4efc2de2d77010ed919b35fdad1e3abacbe9dcfd8` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/css-pure-check.log` | `192c93f787c77c995d19677bd69778c3ff0fa007ba094382cb0b06a48d2f38c5` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/evidence-14/tuesday-cards-pinned.sha256` | `e8cdf16780f8d100b92777f11c570338e956b4eb178b49ccca6b1962c74ef20b` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt7/after/fixture/TT7-OFFLINE-FIXTURE-phone-deployment.png` | `43293e3fe99b4c86ebbc50a62a52cc9d858f15b57f296f56b3edf1515c40275f` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt7/after/fixture/TT7-OFFLINE-FIXTURE-phone-hot.png` | `d19df570181aeab3de611a10084f314bc66888d798f07afb27ad6da4af0b0580` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt7/after/fixture/TT7-OFFLINE-FIXTURE-phone-movers.png` | `690b4b44647cb5b52e05c342a15666f2172781ae71e66c5eec044fca48aba969` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt7/after/fixture/TT7-OFFLINE-FIXTURE-phone-rates.png` | `76b7e5da8c9d2c0cbdaf6649ed6f6d742e96722d05eb662d110c46d1dde48b9d` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt7/after/fixture/TT7-OFFLINE-FIXTURE-png-deployment.png` | `8543909f45be3caad1e16bb38515ae06f3001412cdcd4f3d44be543df3c5f71c` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt7/after/fixture/TT7-OFFLINE-FIXTURE-png-hot.png` | `8fff03bf142397b2116a1e031f659214966dd4a7e4ee206c8c73a96ef7c6e683` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt7/after/fixture/TT7-OFFLINE-FIXTURE-png-movers.png` | `7e8a6f7bf926758d688227dd6e05f803eea5ad8409f6912efde3febe382b40e1` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt7/after/fixture/TT7-OFFLINE-FIXTURE-png-rates.png` | `a79ab2dcb777f01bbeb94a832aae5dd427bf03011383c72d59e7fe8881427ba2` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt7/after/genuine-run2/TT7-GENUINE-DATA-desktop-deployment.png` | `a363987bc0309ba73ce67a034d444c289bc1cac3eb22ef26e92bc36e72ec867c` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt7/after/genuine-run2/TT7-GENUINE-DATA-desktop-hot.png` | `46802db1fc65858b7d7dd38552772f8e862f55849910cf5045f1dcabd71e3066` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt7/after/genuine-run2/TT7-GENUINE-DATA-desktop-movers.png` | `b01e3bfb883690bb68e211d9793a8250a70e4960f6d4cb47b582b78e8448b00e` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt7/after/genuine-run2/TT7-GENUINE-DATA-desktop-rates.png` | `0171ff5a40da01e474a58d51fbf833710ab6371c0742b0a04ef4ea79c2c222a1` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt7/after/genuine-run2/TT7-GENUINE-DATA-export-tokens.json` | `1f5dfa32f20fed789c31d60f05964992146f5d386b469e9806e0555bc72950cd` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt7/after/genuine-run2/TT7-GENUINE-DATA-phone-deployment.png` | `81a4f47992f7623d63c37398328f53c99d454cc0b94c3b517dc56a6107c1ee4d` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt7/after/genuine-run2/TT7-GENUINE-DATA-phone-hot.png` | `85d97445f0b0d5fa75e113d350a11cdb7ec08160bb1e76b0c7dacf30cd69ac0a` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt7/after/genuine-run2/TT7-GENUINE-DATA-phone-movers.png` | `45ed44a53655a6b3097f8dacf5cc81d335a13e05807b690cdcbca1ded67eef5e` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt7/after/genuine-run2/TT7-GENUINE-DATA-phone-rates.png` | `fb057d90912135b0cb3cd4b1939313e94d6bc0e7fd87ac3f1424cb2fdab478b9` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt7/after/genuine-run2/TT7-GENUINE-DATA-png-deployment.png` | `00a84f544eb9f06804b1d7447702820354a4807562da275e957f25fa40b74f43` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt7/after/genuine-run2/TT7-GENUINE-DATA-png-hot.png` | `a196fdc09eb174effde80b9abd5722f891d018c64051d2f72cdca6c1f3c42ce8` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt7/after/genuine-run2/TT7-GENUINE-DATA-png-movers.png` | `3ae0d492847dbe0da22d9bc10ece55951a9d36ea39ad4466293731b04d4a8c86` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt7/after/genuine-run2/TT7-GENUINE-DATA-png-rates.png` | `86082f486ab5b68a08de583bd82c40a6d431c40f550bca02cf0af147f0070c89` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt7/before-after-former-fallbacks.png` | `8fa1ecc12b1774f1fd615229b23144db324de34fc76110dedcef3b5c120a76e5` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt7/contact-sheet-v2-green.png` | `605ad5252fdfbcd1d7d9dce2f8386d82914e1fa620250cef1b61684c55303f86` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt7/contact-sheet-v2-red.png` | `1e254e59782d388b88365fd86ceb1599130051ea37defd3ed1c4b6f24eeead9b` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt7/outline-v2-params.json` | `081f96cf491ea2d934c27666e57884ba2c9f86bc3764b1ebb6dd618dde09f1dc` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt7/trace-logo-outlines-v2.mjs` | `5374c3ee7bac45f979df434917c46106b04e2ffe765bb4c7fc7e0dfbb4264c28` |
| `web/public/teamLogos/outline/ANA.png` | `2936c58587fd3226d18308c4ae51c5e49567b5ceb6da3f60d554114fe80b0a07` |
| `web/public/teamLogos/outline/BOS.png` | `6c330ba81b1868fb68066da267a886530c7899b3c60bafa4d8e9d09ca29b55ab` |
| `web/public/teamLogos/outline/BUF.png` | `87ae5fae4ba672adafdf1bcdf58b2985820172988f5a05a6986b64afd7ed6b57` |
| `web/public/teamLogos/outline/CAR.png` | `c16c0ac032de73b78c2152187f26fba309d7403e3804463963ec499ccab1c279` |
| `web/public/teamLogos/outline/CBJ.png` | `a184d337dea11471f9ed4853be39b0a116b6c5f7a89909fd605c175aa31f651b` |
| `web/public/teamLogos/outline/CGY.png` | `1d13adbce9ce43a84b53a138b285dc94839781693a0ba2406163bd91e3139f28` |
| `web/public/teamLogos/outline/CHI.png` | `75adf4de55d98970b697d1b5e7dc47b92a5e7bed4d9fc6af4f04d8bd95f625ba` |
| `web/public/teamLogos/outline/COL.png` | `eb1656a67560189409067acb0ace2fc0beae4130acef69315de733a1001c9da8` |
| `web/public/teamLogos/outline/DAL.png` | `43581779e380a53fdc058722a24c0493f072ebf5eb22c96293ee9d9ef5916eaf` |
| `web/public/teamLogos/outline/DET.png` | `37a1a4cc3bf0ab35a3781bdeaddbe71e3abe0970940d66b2c7e30784398a08e7` |
| `web/public/teamLogos/outline/EDM.png` | `c771b688e73d61692f250258b41825f6ae3c26689d60fad73745d649bfe3a1bc` |
| `web/public/teamLogos/outline/FLA.png` | `530d0948760406f6a2d00c9d33a8b66e87e2789a5457ef615bd0a75b402bb921` |
| `web/public/teamLogos/outline/LAK.png` | `74ddbe3d9f17d7ec3568578c9f9b3adbb504d86c9a412dbb18fb5dc5b4eadac9` |
| `web/public/teamLogos/outline/MIN.png` | `5a9c5bb6a486e5c16097f38306f664bea18e1d8c359739f57a6ee9932c7aeaa4` |
| `web/public/teamLogos/outline/MTL.png` | `c7e76ca0afbd22bc78fa4fd456d50b9a90e9f5cfb0396996fa7cc1b19ae2aa95` |
| `web/public/teamLogos/outline/NJD.png` | `65b4a395eabb3130234f310ffcc287c2e90c176589e94ecfc89d5a621cfe4906` |
| `web/public/teamLogos/outline/NSH.png` | `d142bc2aa7e94816a27ff706e34c450eba84aae350393c23b0c41331d0a756e3` |
| `web/public/teamLogos/outline/NYI.png` | `478aa165095285c15b1d4abfe860ec3f900541ae70bf164abe364510f9249940` |
| `web/public/teamLogos/outline/NYR.png` | `4b87b9c6fcc1588788a90a300f3bfbff2a3255d6759d407c071b9cab05e50e00` |
| `web/public/teamLogos/outline/OTT.png` | `339387c56f0b93d51572d4c6dfb1045b24ab7d492fc6db7c26bccfe7f8919f68` |
| `web/public/teamLogos/outline/PHI.png` | `8383e1c3c50356abc4e408efd5b9810f9620ac954c25713988c94a86295b14be` |
| `web/public/teamLogos/outline/PIT.png` | `bbd2e04c7e7e355c85672a5f0da846d62096ff8bb1deed22b6538ec002683b51` |
| `web/public/teamLogos/outline/SEA.png` | `e985be1989ce3c9b608f0437a55a214cab902c093ab1bbc303b6159e437463f0` |
| `web/public/teamLogos/outline/SJS.png` | `3cac16cf1123591f7acd1046c77e0cdf646e7e8bbe90805ecf727349acf9a498` |
| `web/public/teamLogos/outline/STL.png` | `ed4933dc9966aa0a7484642858311661a655a201612ef936d0f565ac57b4c7d2` |
| `web/public/teamLogos/outline/TBL.png` | `9cb23760a4ffa2b027c16fa39032307a4fd7d4c7d2f4ac4502831735ff1887d0` |
| `web/public/teamLogos/outline/TOR.png` | `4e365c8cc7b6054cdd5ea81840229fa642dd7ed2440a244e87336b1e5f1b48dd` |
| `web/public/teamLogos/outline/UTA.png` | `922d3ae8e9e60f80aebc130ec0d3f57a519940a0200cad9b1fd9565a58fcb483` |
| `web/public/teamLogos/outline/VAN.png` | `e25d854ec07e02a5491058c0a9ab95be847371a5ca007a98c4c5e2847f73ee68` |
| `web/public/teamLogos/outline/VGK.png` | `35c4a898b52b96ca50a49aaf6e49ab2cfc8fb8daec613150119ec380c586d3b0` |
| `web/public/teamLogos/outline/WPG.png` | `188be1ef829555cdd42e0bf0d578ae86e151b158b434bae265cae397e2629c30` |
| `web/public/teamLogos/outline/WSH.png` | `a1c527c90548a16e63ad46f44aa11ee7de935d707fab0e335551c50f8ce5eae7` |

Note: `*.log` files are gitignored; their hashes cover the local copies.
