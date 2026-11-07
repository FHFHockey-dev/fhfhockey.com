# RECEIPT-15: no striping, sparkline-led tiles (lane TT, offline)

## 1. Striping removed (all four cards)

- **What was deleted:** the stripe band element, its rules and its guard; the `neon-stripes()` and `stripe-bands()` Sass functions; the `sass:list` and `sass:map` imports, which only those functions used; and the team-colour vars on the tile art (`teamBannerStyle`, which only fed the stripes).
- **Result:** neon logos sit on the clean dark tile body. The CSS shrank from 53.6 kB to 43.1 kB compiled.
- **Guard:** fails if the tile or the art has any background image.

## 2. Sparkline-led layout on every tile (TJ's Rates mockup)

**Structure** (`TrendCard` and `.trendTileBody`)
- On 2-column tiles, the body starts where the logo's box ends.
- **Head:** name, then badge and line/PP chips (right-aligned; left-aligned on mirrored columns).
- **The difference:** large and centred, with its kind label.
- **The line row:** one no-wrap row, previous value · sparkline · current value. It reads left to right in mirrored columns too.
- **Meta lines:** Deployment's EV/PP row, then the foot (L5 minutes on Rates, and GP this week).

**Line ends per card**

| Card | Left end (previous) | Right end (current) | Centre (difference) |
|---|---|---|---|
| Hot/Cold | prior-5 P/GP (`PRIOR 5 P/GP`) | L5 P/GP (`L5 P/GP`) | `P/GP VS PRIOR 5` |
| Deployment | season TOI/GP (`SEASON TOI/GP`) | L5 TOI/GP (`L5 TOI/GP`) | `TOI/GP VS SEASON`, or the role hero `ROLE · TOI FLAT` |
| Movers | rostered % at P, labelled with its date | rostered % at D, labelled with its date | ± `PCT PTS ROSTERED` |
| Rates | season rate (`SEASON`) | L5 rate (`L5 SOG/60` etc.) | `Δ/60 VS SEASON` |

**Other details**
- **Deployment:** the EV/PP mini table didn't fit beside the new line row in a 184 px tile. It became one compact row: "EV season → L5 · PP season → L5". The old "Prior 5" and Movers date-range detail lines are gone, since the line ends carry them now.
- **Fill:** Hot/Cold's under-line fill dropped from 50% to 22%. The Movers area stays at 20%. Deployment and Rates have no fill.
- **Sparkline widths:** 150 px on Hot/Cold and Movers, 112 px on Deployment (its taller tiles have a wider logo zone), 176 px on Rates.
- **No series:** where a tile has no series (the genuine run-2 capture predates them all, or data is missing), a neutral dashed baseline sits between the two values. The guard requires exactly one of a drawn series or the baseline per tile.
- **Unchanged:** green/red tones, the Tomorrow group labels, team-colour neon logos, mirrored right columns, the source and freshness footer, and export fidelity (tokens and PNG checks).

## Guard extended (`tileCollisions`: stress, fixture and genuine)

- Pairwise overlaps, inside-the-tile and clipping checks now cover the new parts: name, chips, hero, kind, prev, spark, curr, evpp, foot and tag.
- **Line row:** no-wrap and one line, in the order previous, sparkline, current, with the sparkline at least 40 px wide.
- **The difference:** centred (±2 px) above the line row.
- **Logo:** no part except the team tag touches the logo's visible box.
- **Values:** the list test asserts Hot/Cold's line ends equal the layer's prior and L5 P/GP, Movers' ends are percentages, and Deployment's are clocks.
- **Genuine:** asserts no drawn series and one baseline per tile.

## Evidence
- `tt15/before-after-crops.png`: the first tile of each column, TT-14 vs TT-15, for genuine run-2 (baselines) and the fixture (sparklines).
- `tt15/fixture` and `tt15/genuine-run2`: desktop, phone and PNG. Genuine export tokens match.

## Checks

| Check | Result |
|---|---|
| E2E full spec, :3110, deny preload, v2 pins (two passes) | **34 passed** (33 + 1) |
| Monday (9) / Wednesday (9) PNG pins | **byte-identical to v2** |
| Tuesday pins | changed by design: db1cebff417aa5c0cbcb09fdc92e1adc3cb5a178894dfff17d2d98a220507e54, c815ba8f737293b1417396cad08b56dbf334d992ac936894e241bccdadcc11c6, 641ecb34d602fc140455db48b81fa9fd80a6e6b8b3801620d5e2aa303e79c6ef, 1d1f7e4830d91cff2d7188f4b390a08f4b9e2a3bde25eababfac044521533707 |
| Vitest | 241/241 |
| ESLint / CSS pure | exit 0 / PURE OK |
| Full `tsc --noEmit` | exit 2. Both errors are in `web/components/player-cards/PlayerCardShareStudio.test.tsx`, another lane's uncommitted player-cards work, outside lane TT. No TT file has an error. |
| Network | denied Next.js version check only; no reads |

## Files and sha256

| File | sha256 |
|---|---|
| `web/components/SocialShare/SocialShare.tsx` | `4b233502b0ef618f1b259e29a125f387852abeca42d62c8499ade9fedcb9b038` |
| `web/components/SocialShare/SocialShare.module.scss` | `78083ce96542df4858c321b3c3d8e26921f88ecd1c6007902cc975508d584108` |
| `web/e2e/social-share.spec.ts` | `c828daca864480cd04382be0db7eb376c607d7ff5226f1c0e736dde14f5f9ab2` |
| `tasks/artifacts/tuesday-trends-2026-10-26/CONTRACT.md` | `17877cb2fde40a6153a39d28af6826bd6dbe606402f8240a96aa8162fa5be14d` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/e2e-final-30a.log` | `3715a3051fb0cb702861bc1a30bbe90ce84c52a13b480f4d77878ffc08b98fe1` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/e2e-final-30b.log` | `644fda8e7a257d9867cbd4d2e01438d23de2968da2e908778d3575141accd4ab` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/vitest.log` | `e2396939e06e53bab9599b8d74849427f3959276c706c080bd980554a91f992f` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/tsc.log` | `7844d94d4fd997713316b25f1f27e020adbcc6a5b5eb629900c913a24a49893a` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/eslint.log` | `a6b49f7a0b519016701eccb4efc2de2d77010ed919b35fdad1e3abacbe9dcfd8` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/css-pure-check.log` | `e3a48be5c27c0985ca3f404c03f092135b5c93de6dd827df1d1215b4fbbe93eb` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/node-network-30.jsonl` | `59560c2a60a9a707056d97feb469d50481c1263d8246c0e04de6b083142cc228` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/evidence-30/tuesday-cards-pinned.sha256` | `0453566cc18bfdaa17586718a591e349f0ee8b67aa540dde0d3d995c804cf03b` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt15/before-after-crops.mjs` | `16af2b76114278d4e51159cc78a040ceb31ff1dfc6ab4ad30c0ca2e4a177f995` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt15/before-after-crops.png` | `34b88650921c8328fdd6d0d93ec01539c31a079c5c67c1158fb1e8579f7fd469` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt15/fixture/TT15-OFFLINE-FIXTURE-desktop-deployment.png` | `78e497af800c5a1e2e7c5ee9eaa7d09522bc203fd2150c966efea771aecd4f48` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt15/fixture/TT15-OFFLINE-FIXTURE-desktop-hot.png` | `5b65e2d242e0f828c93d4a4032812b2ff39314046c92c08b941f3e698bf416e0` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt15/fixture/TT15-OFFLINE-FIXTURE-desktop-movers.png` | `2a88d32471d913ca9ccd44a3ea70eeb7b2cafd7acd4b13976b0017f01829912c` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt15/fixture/TT15-OFFLINE-FIXTURE-desktop-rates.png` | `fa6884ec7fb422d82cba053ad6606db7b7c0ba7e779923cd793a1d38d87d2d9a` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt15/fixture/TT15-OFFLINE-FIXTURE-phone-deployment.png` | `7440cf9747533f6676af96ec501e7de0077b2d8b69a6fc373e5c0e9aad70601b` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt15/fixture/TT15-OFFLINE-FIXTURE-phone-hot.png` | `47f17ebbbf050a72393c18b9cafe986231ccb7a6e652f2be2bd0e35677739805` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt15/fixture/TT15-OFFLINE-FIXTURE-phone-movers.png` | `2c04da9013f644adbcb68ef10f81ed81a6dfd2f5bc5203bef29210623529c6ec` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt15/fixture/TT15-OFFLINE-FIXTURE-phone-rates.png` | `47595a3012e9a56434f0a9b21172827c928a0c4dd9a87a66c773e69d5dc65387` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt15/fixture/TT15-OFFLINE-FIXTURE-png-deployment.png` | `7c642df510bb4601fdc58d26815f4d57bc62fce51b15135892459d61cee5c905` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt15/fixture/TT15-OFFLINE-FIXTURE-png-hot.png` | `61b18ea97402720e87ffece61ed6577bea0a32e3a5ede009b6b82613005ab89d` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt15/fixture/TT15-OFFLINE-FIXTURE-png-movers.png` | `e83f9c3da612281f36e4cf8755298cf45c355537b6cdc5fc98a2ada494213663` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt15/fixture/TT15-OFFLINE-FIXTURE-png-rates.png` | `5831b590ebff3b9fa13ad1dbcc6968a0ce3d74409d22c77e4082ab18598784bb` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt15/genuine-run2/TT15-GENUINE-DATA-desktop-deployment.png` | `fec787d5afb198a33cdffcab87f9d7c92c2da509de049f6697abf043538a4deb` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt15/genuine-run2/TT15-GENUINE-DATA-desktop-hot.png` | `c1b34b7b2a4641af04b3ff8abb4a45f7e854f898e8dad01a5060bf50fa2b6577` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt15/genuine-run2/TT15-GENUINE-DATA-desktop-movers.png` | `353268e51be107c0827bbb9cf570e1047feca4db8278735833f4a3e4422279dc` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt15/genuine-run2/TT15-GENUINE-DATA-desktop-rates.png` | `54735b4235fefc1bec983346163c68e26367ba63c1dfcf9268527b6ccef9d285` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt15/genuine-run2/TT15-GENUINE-DATA-export-tokens.json` | `f178cd1f65e15644e5513d5688e3e9a25620fd1c92e99e7656db3c55ea7f92d7` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt15/genuine-run2/TT15-GENUINE-DATA-phone-deployment.png` | `fe5fdbea00848cf658e55b260137d2d6f38ebc0e0cae9e2619830fff7795ef44` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt15/genuine-run2/TT15-GENUINE-DATA-phone-hot.png` | `f61c0faca0a784038869aff606c88fec75e6369343045065127559f786dab920` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt15/genuine-run2/TT15-GENUINE-DATA-phone-movers.png` | `6d5742d066eff9f7a6cd1fb6f683b9aabae46a5feae128b24a6f066b7d8f543d` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt15/genuine-run2/TT15-GENUINE-DATA-phone-rates.png` | `06602d2cc62a323d7f221827dc4e0fe507522ca5b95455faffb82d66ddbb11ce` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt15/genuine-run2/TT15-GENUINE-DATA-png-deployment.png` | `2fc02069cc960b8a2800591e7e7b3a7fec0f70cc75f0fdb38d8891aca6f2fc63` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt15/genuine-run2/TT15-GENUINE-DATA-png-hot.png` | `5eff9b014e7745995d07b4c1cea5eb562a5a664bdc5b315411c1c6a4cb4ec2be` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt15/genuine-run2/TT15-GENUINE-DATA-png-movers.png` | `4da3ed5b76bc7b5486082bfe6bced8284c1ccf97b851f53c2ee97cfdea8af6c6` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt15/genuine-run2/TT15-GENUINE-DATA-png-rates.png` | `49920a5cc2f1d89abfe30c6bf0ea5dba65b6ce30f64295936e674ee7d137c63e` |
