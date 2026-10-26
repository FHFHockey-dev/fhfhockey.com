# RECEIPT-5 — TT-5: OwnershipSparkline on movers, neon logo outlines, flagged sparkline reads (lane TT, offline)

- **Ticket:** TT-5 from the chef, after TJ saw the TT-4 PNGs. It builds on the PP-unit add-on (`0d173aed7`).
- **Offline only.** No production read, write, push or deploy. E2E ran on :3110 with the deny preload; `run/node-network-6.jsonl` holds only Next's npm registry check.

## 1. Sparkline reads are behind a server flag (default **off**)

- **The flag:** `SOCIAL_SHARE_TUESDAY_SPARKLINES=1` turns on READ-PLAN v2's S1/M2. Unset (the default), `loadTrendLayer` returns before S1/M2: **no extra statement and no sparklines**.
- **Server:** `server.ts` passes `{ sparklines: sparklineReadsEnabled() }`.
- **Tests:**
  - `trendSources.test.ts`: flag off → no S1/M2 statement, ≤ 12 statements, every listed series null, and the layer equals the pure build without series.
  - `schedule.test.ts`: the handler passes `{ sparklines: false }`.
- **Still pending:** TJ's approval of S1/M2 before anyone sets the flag.

## 2. Movers sparkline = Transaction Trends' `OwnershipSparkline`

- **Reuse:** imported read-only from `components/TransactionTrends/OwnershipSparkline.tsx` (filled area and line, as in "TREND (5D)"); no TransactionTrends file is edited. Points are `{ date, value }` for every day P..D (`moverSparkPoints`).
- **Gaps:** because that component joins its line across missing points, **any gap means no sparkline** (Vitest).
- **Colour:** rise is green and fall red, from the hero sign.
- **Export fix:** html-to-image does not carry class styles onto SVG children (the area first exported as a solid black wedge). `NeonOwnershipSparkline` therefore writes the same fill and stroke as presentation attributes after render. Verified in the PNG.

## 3. Neon logo outlines

- **Tracer:** `tt5/trace-logo-outlines.mjs` (offline, `sharp`) reads each logo from the **committed tree** (`git show HEAD:…`, GIT_DIR stripped), so a locally modified logo cannot leak in. Writes `web/public/teamLogos/outline/X.png` (32 teams).
- **Method:** 256 px; Sobel on alpha and premultiplied RGB; threshold 0.22; Zhang–Suen thinning; a 3 px disc stroke; white on transparent.
- **Render** (`teamOutlineDataUrl` in `export.ts`): the outline is tinted on a canvas to green (#00ff99), red (#ff6b6b) or neutral blue (#63d2f5) by the hero sign, and inlined as a **data URL**, like team logos. CSS drop-shadow adds the glow. E2E asserts that each neon art `img` is a `data:image/png` and that the tile's art tone equals the tile's tone. The PNGs show it survives export.
- **Why not CSS mask-image:** the canvas tint is used instead because it rides the existing logo-inlining path and html-to-image already draws plain images exactly.
- **Contact sheets:** `tt5/contact-sheet-green.png` and `tt5/contact-sheet-red.png`, all 32 teams with the original logo in each cell's corner. Coverage per team is in `tt5/outline-coverage.json`.
- **Fallback** (per-team switch `OUTLINE_FALLBACK_TEAMS` in `SocialShare.tsx`; see the Ottawa add-on: OTT left the list): the home-page game-card treatment, a cropped full-colour logo over the team's 65° jersey stripes.
  - **Teams using it: NYR, NYI, WSH, OTT, DET.** NYR, NYI and WSH have wordmarks that clump; the OTT and DET outlines read as solid blobs at 56 px.
  - A missing outline also falls back.
  - The Ducks, Kings and Blackhawks remain neon (legible at tile size); TJ can move any team with a one-line change.

## 4. Other

- **Role-only hero label:** shortened to "ROLE · TOI FLAT", because the footer defines flat as within ±1:00.
- **Rates tiles:** stacked tiles put the sparkline on its own full-width row.

## Evidence

| Set | Files |
|---|---|
| Contact sheets | `tt5/contact-sheet-green.png`, `tt5/contact-sheet-red.png` |
| After, fixture (sparklines present, as with the flag on) | `tt5/after/fixture/TT5-OFFLINE-FIXTURE-{png,phone}-*.png` |
| After, genuine run-2 (neon outlines; no sparklines, because the flag is off and the capture predates them) | `tt5/after/genuine-run2/TT5-GENUINE-DATA-{png,phone,desktop}-*.png`; all four export tokens match the snapshot |
| Before (TT-4) | `tt4/after/…` (TT-4's after set) |

## Checks

| Check | Result |
|---|---|
| Vitest `lib/socialShare` + `components/SocialShare` | 231/231 |
| E2E full spec, :3110, every Monday/Wednesday pin asserted, genuine render | **33 passed** |
| Monday (9) / Wednesday (9) PNG pins | **byte-identical** (no PP3 pin change exists: no pinned edition has a unit-3 skater) |
| Tuesday pins | changed by design (tiles, art) |
| ESLint / CSS pure / full `tsc --noEmit` | exit 0 / PURE OK / exit 0 |

**Note:** `web/public/teamLogos/OTT.png` no longer shows as modified in `git status`; someone else resolved it. The tracer reads the committed blob regardless.

## Files and sha256

| File | sha256 |
|---|---|
| `web/lib/socialShare/trendSources.ts` | `a4c171d5987f7d3a3155e9f0a8f39057064d091f334d135355274b28e52e7fa3` |
| `web/lib/socialShare/trendSources.test.ts` | `542f9194fd9e2bbc30fcc33ab821f5c6783e492d43d904da6d89bfc1e061910a` |
| `web/lib/socialShare/server.ts` | `65c6941e2f04c07859f42d70a0557652445ef769f62dae7ec117e67c74f6abee` |
| `web/lib/socialShare/schedule.test.ts` | `1728a75c3eb8af16986c60aa782a6f617e42ec0e422c2e77113f41c962d03601` |
| `web/lib/socialShare/export.ts` | `5d26fe832f3b0e9b2dce228cee6ac21417a9092277affd3e92ef0f95a2f7cdda` |
| `web/components/SocialShare/SocialShare.tsx` | `9f0119a57103acd9a74e1ed3a584c9c17d5874889dce482cb5a91a5ae897b1da` |
| `web/components/SocialShare/SocialShare.module.scss` | `07b655a90b837a25fa1470b29c13d6ad7011f0e1063d8f223bf928f8444ac2c8` |
| `web/components/SocialShare/SocialShare.test.tsx` | `2b7d9becb035b9024e80931b9e2d4eecf00057567db830f1b63202e00968ca29` |
| `web/e2e/social-share.spec.ts` | `49a09bc5c1d8fe7f58ceffe854e6270e1a5c4e6c9057361fbf2a026b600c7d39` |
| `tasks/diaries/2026-10-26-claude-tuesday-trends-worker.md` | `4118123c4001dd0ff0c7565a2a943eb8293e968707c57ff886bf41b3c647bfd7` |
| `tasks/artifacts/tuesday-trends-2026-10-26/CONTRACT.md` | `4a965f8a7d40c7816bb8a239061dc4c89c3e15ae7a15f15ad89281244274893d` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/e2e-final-6.log` | `f3704f0d22320f481d5be1ed56e3cc1fb9b7c1bf5dd62d7e5dcab1d5f03133e8` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/vitest.log` | `df3df5fae37049fccc408197db4253fd4becd1497d11371eabe95df4d9323adf` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/tsc.log` | `cbf7de6a7ab22aa8f3b63eed31368677222a5389d4a0bcaa112a952910051cec` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/eslint.log` | `a6b49f7a0b519016701eccb4efc2de2d77010ed919b35fdad1e3abacbe9dcfd8` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/css-pure-check.log` | `9dd33fcc31b89d5aabb7e1990eea5f6fa17c16922eebe21e83f4301626b4ba96` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/node-network-6.jsonl` | `cc9787a65464224417e037131ed583b56d1cf5cc6a2b01eadb14fe108fc2258b` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt5/after/fixture/TT5-OFFLINE-FIXTURE-phone-deployment.png` | `31501ecc1075d949630910ebd85de540fa9264a2b1a62ed1610e3d0e60b33290` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt5/after/fixture/TT5-OFFLINE-FIXTURE-phone-hot.png` | `6eeb715f7a03effe5959e4aa4c80b6a1d02d29811a8bdb5abc8b8d2e06104931` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt5/after/fixture/TT5-OFFLINE-FIXTURE-phone-movers.png` | `e8b4cf3d54f4d672a068b6b0578aa4b0cb7102ec9d9c3778e7dc05e7e18cad47` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt5/after/fixture/TT5-OFFLINE-FIXTURE-phone-rates.png` | `faed411d9220c42a365d40f68182123c155fc90168434d845f75c49da5e69463` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt5/after/fixture/TT5-OFFLINE-FIXTURE-png-deployment.png` | `b437ad5ba910bc13919cef4f7730dc3d43bd3f7a917abc9a33abccd5bcac085a` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt5/after/fixture/TT5-OFFLINE-FIXTURE-png-hot.png` | `b787572a4ef7277d2d63bb450ddfcb3f9aaf4dda5ef505722f34c1a05cddfce3` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt5/after/fixture/TT5-OFFLINE-FIXTURE-png-movers.png` | `744f8a18f64ec283909d42d534b27d3afb3e54cf2be1f4888bbdb225f781e1a5` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt5/after/fixture/TT5-OFFLINE-FIXTURE-png-rates.png` | `e9f4c1cfcaa1736070448e8c2e3260b0d4ee05e59bf9187ba8fe71ec29feb4f6` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt5/after/genuine-run2/TT5-GENUINE-DATA-desktop-deployment.png` | `f2cf3497df8fe726b6f72665e937f5ba08800bea22a4c35c57b42bbf5bddf506` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt5/after/genuine-run2/TT5-GENUINE-DATA-desktop-hot.png` | `b14f8133fbf607acc1d151464ff4548c9d1ec86337e4119b666c99f306c4a7fe` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt5/after/genuine-run2/TT5-GENUINE-DATA-desktop-movers.png` | `af57a2645346881f41e3e453f2e6ddb9734409a5231b0899c82b96d0b2245b1c` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt5/after/genuine-run2/TT5-GENUINE-DATA-desktop-rates.png` | `d4857423ce297c9a1d56c7cddb136ffbde73e9d1c44494e9274fa48af80843f9` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt5/after/genuine-run2/TT5-GENUINE-DATA-export-tokens.json` | `af4c6485f907de6b690243c5d8475a30d7d497afd40cbd34a29587e006a8c234` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt5/after/genuine-run2/TT5-GENUINE-DATA-phone-deployment.png` | `fd73306d1b89d3beaca5d97c898771d6d719bbedbbf7764d69c34eca13ca5887` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt5/after/genuine-run2/TT5-GENUINE-DATA-phone-hot.png` | `2a811bfabe14129cc8bb107cef724df3540eadd4e4e6ae9936f807ff26c70aba` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt5/after/genuine-run2/TT5-GENUINE-DATA-phone-movers.png` | `7fada3dae231c2155de538a9c05784a6c6b206884b5f1730231222c2aa3b6495` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt5/after/genuine-run2/TT5-GENUINE-DATA-phone-rates.png` | `9775a6f5ec819922dd8d6c157f735a90c01471279fb7e1d2d5af5de183fff5fa` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt5/after/genuine-run2/TT5-GENUINE-DATA-png-deployment.png` | `cda3f326d6ab8c68b49ada75739002dafefd509892427e54213291feb60ee0d0` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt5/after/genuine-run2/TT5-GENUINE-DATA-png-hot.png` | `a310cddd2563f7ddedb481e38270b8186b77d8c55e3c9907b79568cd931879e0` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt5/after/genuine-run2/TT5-GENUINE-DATA-png-movers.png` | `fcd3fdff2eb29734667ab27e20fd2b830a4752694d6bf1951e14dc3c6501de2c` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt5/after/genuine-run2/TT5-GENUINE-DATA-png-rates.png` | `2d6899bb9960a60b05b17cbccbc4e42a0df9c66cdbd317218e12fe34cf4080ae` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt5/contact-sheet-green.png` | `081014ca93c2aa923ff7f1737fcd39202780cc7a36dae0d9c8c9dee4bbfc4d17` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt5/contact-sheet-red.png` | `66140b7ed5f95ac1d75ce7c12be76bf8c56e4de373a9c9aa49431ae73e3d3232` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt5/outline-coverage.json` | `7ce6f9714eaf0eb36854446edffcbaab301e3e2122c60797fe8e7e11026fa2b0` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt5/trace-logo-outlines.mjs` | `a1694fcc6c550c18ee5678d8f9338f840a11dab44f56cd5b5b9d9a96fb358d04` |
| `web/public/teamLogos/outline/ANA.png` | `0f0c695c3c257e3e0f3379f949d6562b490d397b56e85de141995984e7aa1234` |
| `web/public/teamLogos/outline/BOS.png` | `3920f7a40b6264ad03dba52a7cc81e59a468d71cd3c6ba7204406587ead73e52` |
| `web/public/teamLogos/outline/BUF.png` | `668d7980776a08094cc197c9f2ad411af9ef9e9a5270904aa7ee3fb23911aac0` |
| `web/public/teamLogos/outline/CAR.png` | `1f2a311aa3d2e3a3e4f26a97575913d2fe87b0fbb70dac82b29ca49deb664ff8` |
| `web/public/teamLogos/outline/CBJ.png` | `7cb29751e6698dcd6e0620d3ecfc67f228ea3fce3987c3dfd9d187e7bac0f6ce` |
| `web/public/teamLogos/outline/CGY.png` | `12a00fb40a70e694750c2922e7469bad2c3e4d610edbc0353800d75a968ffa30` |
| `web/public/teamLogos/outline/CHI.png` | `904f4a022ad559899862ec45e0c508ce295aad7e3e52711ce49486168a9b2639` |
| `web/public/teamLogos/outline/COL.png` | `7e815cf96f4bac7a00ae2823d5b5c6ee5690735b62ff48e7f522a0cdb8add5ee` |
| `web/public/teamLogos/outline/DAL.png` | `40a82e53c1199b555ed861b39cef2c0168c7672b62d756d50b73b84cc88da044` |
| `web/public/teamLogos/outline/DET.png` | `e56e04632492701a3d32b461aa71a24e14dbc8a9e01538b4f0587b8584dbc509` |
| `web/public/teamLogos/outline/EDM.png` | `a1e2b22ca98edbca802fe0fd3f030a55994b2fbf02069ccbace86cd362afec0d` |
| `web/public/teamLogos/outline/FLA.png` | `51c0336dc162c99acca5692e47287320ec96203f39f310477d4600df7dbbb02e` |
| `web/public/teamLogos/outline/LAK.png` | `3a031c90d36471bb1806026aba29c44da63c9bdff9e45a0f26377f3097e297b8` |
| `web/public/teamLogos/outline/MIN.png` | `b6f9bb84f967e1b41d9cd30dd720eb6e7c2c40502760e6cf1bbc17d0d58b9d59` |
| `web/public/teamLogos/outline/MTL.png` | `119553e2cd6dca8dbb9bf95858722ef4de222a3e7fd7a0e7ec6e5dcc8a2d8abc` |
| `web/public/teamLogos/outline/NJD.png` | `d74c878d2f714c4dfcf26efd54c8f36ec01002045a8139da1c2eaaac6eb1af3d` |
| `web/public/teamLogos/outline/NSH.png` | `83d7a82e286388c61f7b6c5c75802643c6e11555a0e2e7fbf2a8a0344b039a10` |
| `web/public/teamLogos/outline/NYI.png` | `01491d17d7931699fa7fd8a2eb52a9e53cb39ab9758a08894b1ffd9fa0dbdad7` |
| `web/public/teamLogos/outline/NYR.png` | `ef8169fe61ccb7984a3cd817804bbbcf7b4e469283d9095346ac9417e24ee1d7` |
| `web/public/teamLogos/outline/OTT.png` | `94925dc57580ddf9dc4bd953b7a89d13c3dc4d0ac6f93f6914e226b08d1c98da` |
| `web/public/teamLogos/outline/PHI.png` | `dc41d45cba9137f8a7271739dabc4e57ff14ea3123323cd1e68af934f76672f2` |
| `web/public/teamLogos/outline/PIT.png` | `769c45a71bd85de3edd0439517119073d2f6ccfa0828e995034a8a54598373a0` |
| `web/public/teamLogos/outline/SEA.png` | `b1040e9fa79ba905d2e5933fb504462ae4e66989fbd0cb2bff1f6383c5168027` |
| `web/public/teamLogos/outline/SJS.png` | `2c4b1b439cd3f80291d0b4f76903c566ec35168fe1c5298bec41177c0f6439bf` |
| `web/public/teamLogos/outline/STL.png` | `4e2a50cbffac8a29eaa876a975f701397ecbf3a274f1a6190ef69785644c1f95` |
| `web/public/teamLogos/outline/TBL.png` | `ada111bb73816d398dd4353cbc42c1663dc31a89a727611a9382c1b6914ba922` |
| `web/public/teamLogos/outline/TOR.png` | `f9c9d1e838c2ba75965de8688dc74ba484ef0ab66a0608b685ec90204ba400f7` |
| `web/public/teamLogos/outline/UTA.png` | `f12b12504cd648d5afd8a5bb6042138b28776939f5eaabe8edb82d6af59d309d` |
| `web/public/teamLogos/outline/VAN.png` | `39ad86d01b7db06a4cfac7a0a98a0b5dd084033900bbacbc0d2c190d119edc14` |
| `web/public/teamLogos/outline/VGK.png` | `40ad0ff16bf5cda97a64e4611482fee7119d4df1626f86c07d0aacbe996e8e79` |
| `web/public/teamLogos/outline/WPG.png` | `7ed9d29af92c58916c6ee80dd2fee9964558ec7e518496a9e47206615e0807de` |
| `web/public/teamLogos/outline/WSH.png` | `d39316ba1a3f41fac2cdbef51073098f83722bd42ad117139b9489e09b32614f` |

Note: `*.log` files are gitignored; their hashes cover the local copies.

## Add-on: new Ottawa logo committed (TJ, relayed by the chef)

TJ confirmed that the working-tree `OTT.png` is the correct new Ottawa logo; the chef committed it as `e6e5798bf`, and the legacy mark is `OTT-2.png` (unused here).

- **Re-traced:** the tracer reads HEAD, so `outline/OTT.png` now comes from the new logo. **The other 31 outlines re-traced byte-identically.** The new mark traces cleanly, unlike the old one, which came out as a blob, so **OTT moves back to neon**: `OUTLINE_FALLBACK_TEAMS` = **NYR, NYI, WSH, DET**. The contact sheets are regenerated.
- **No more logo override:** `SOCIAL_SHARE_LOGO_OVERRIDE_DIR` is no longer used. Pins were compared card by card, pin-free, against SS1 t24 run-a.

| Pin | Status | Changed regions (pixel diff) |
|---|---|---|
| monday-grid | **changed** | 5 regions, each ≤ 40×40 px = the OTT team-column logo and its opponent cells |
| monday-easiest | **changed** | 1 region ≤ 50×49 px = the OTT banner logo |
| monday-tiers-wide | **changed** (not predicted earlier: Ottawa sits in a widened tier bar) | 1 region ≤ 34×34 px = the OTT tier-bar logo |
| wednesday-grid | **changed** | 5 regions, each ≤ 40×40 px = OTT cells |
| the other 14 Monday/Wednesday pins | **byte-identical** | none |

- **Proof the changes are Ottawa only:** old-vs-new crops of every changed region are in `tt5/ott-repin/*-old-vs-new-regions.png`. Each one is the old Ottawa mark replaced by the new one, with nothing else moved. The connected-component boxes are in `tt5/ott-repin/diff-regions.json`.
- **New pins:** `tt5/ott-repin/pinned-env-v2.txt`, the same format as SS1's `pinned-env.txt`, with Tuesday added.
- **Full E2E with every pin asserted against v2, no override: 33/33**, run in two passes. Pass A: 32 tests, everything except the unknown-format test. Pass B: that test alone.
  - **Why two passes:** in this canonical checkout, with other lanes' uncommitted work in flight, the dev server falls into a Fast Refresh loop after compiling `/404`. Every later request then 404s, regardless of my change. This happened twice in single runs; logs are in `run/server-7*.log`. That test passes on its own.
- **Other checks:** Vitest 231/231, tsc 0, eslint 0, CSS pure OK. The genuine and fixture after-renders are refreshed in `tt5/after/`.

### Add-on files (sha256)

| File | sha256 |
|---|---|
| `web/public/teamLogos/outline/OTT.png` | `50bcfd68517ec2790fa889c254ea2b03710f266b4f6ab90d815999c3993d4a0e` |
| `web/components/SocialShare/SocialShare.tsx` | `21d83beaa45353d354cd4482a0ccc891228a0b9579cc1ee3c897ceaa722d17ba` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt5/contact-sheet-green.png` | `4b0dc7be754d067ba074f1e53c16b32a58736c14b0bb0431a479a839b3c7637b` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt5/contact-sheet-red.png` | `bc4b71fd16d885a19e85a628c88201c84793d8f7b485ba7ff08cf010eb44c618` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt5/outline-coverage.json` | `4b2c629ebd12e7ab52c234e2e42908e1c23b40457d1f2983c588dfb003063620` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt5/ott-repin/pinned-env-v2.txt` | `8e1e891affd22a85cfb3639c783bcee2dde11304d2d7574b819d611e7f3005fb` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt5/ott-repin/diff-regions.json` | `ae5447f928588c0eb0292ee781df8cb9d00027527c95594c9de5467ffa81ea81` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt5/ott-repin/monday-grid-old-vs-new-regions.png` | `85c746bfa6a5faa0abe2611c9e2827f724b226f209de95eb66eb57fa4e7e6ff6` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt5/ott-repin/monday-easiest-old-vs-new-regions.png` | `f0c79fedb17f1b9ec9794835229213cd6b4f04b86b5fbb2f2ea6037d301869b0` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt5/ott-repin/monday-tiers-wide-old-vs-new-regions.png` | `0090f59fb94b983edf85b228d98b2c9c29e34b2724a523e2f18077bec49a8756` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt5/ott-repin/wednesday-grid-old-vs-new-regions.png` | `022f5a4b898f498219952f2c4e0c7eef9c4a55d86df0b44f93cc0da1d1b6cb42` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/e2e-final-8a.log` | `0b95459b79089c3be8845dc177cc85d75add0152c8c3cbcbb9b296adbc6b1ef2` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/e2e-final-8b.log` | `71a531cb57f837ec4eeadd28ae6df4076edfd1b831525bd9a40a0b0acb791cfe` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/vitest.log` | `695fa0f7a9561909b6bf16e74c12ce1ef7ade2d768929b45d8be97c73b479c6c` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/tsc.log` | `cbf7de6a7ab22aa8f3b63eed31368677222a5389d4a0bcaa112a952910051cec` |
