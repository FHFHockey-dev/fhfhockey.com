# RECEIPT-7b — TT-7b: hero row and long-name layout fixes, with a collision guard (lane TT, offline)

- **Ticket:** TT-7b from the chef's review of `tt7/after/genuine-run2`.
- **Not done:** no production reads, no pushes, no deploys.

## 1. Movers, Ovechkin ("−8" pushed "74% ROSTERED" onto the label)

- **Cause:** the hero row was a *wrapping* flex row. Inside the html-to-image export clone, its intrinsic width came out too narrow, so the absolute block wrapped under the hero and spilled over the kind label and detail line. The live DOM did not wrap; only the export did.
- **Fix:** `.trendTileHeroRow` is `flex-wrap: nowrap` and `white-space: nowrap`. The hero and absolute value always share one line, so there is nothing left to wrap or collide.
- **Before/after:** `tt7b/before-ovechkin-movers.png` and `tt7b/after-ovechkin-movers.png`.

## 2. Rates, Bjorkstrand (long name over the logo on narrow tiles)

- **Cause:** the stacked text column started at 28% of the tile width while the logo extends to about 40%, and the name kept its 20 px size.
- **Fix — column:** the stacked text column is now 58% wide, starting right of the logo zone.
- **Fix — name sizing:** names are sized by `nameFontSize(name, stacked)`. They shrink to fit the column (2-column cards: 20 px base, 16 px floor; stacked: 19 px base, 15 px floor). Below the floor they wrap to 2 lines, then ellipsize (CSS line clamp). A name never leaves its column.
- **Before/after:** `tt7b/before-bjorkstrand-rates.png` and `tt7b/after-bjorkstrand-rates.png`.

## 3. Guard (E2E `tileCollisions`, run on every tile of all four cards)

- **What it checks:**
  - **No collisions:** the name, hero, absolute value, kind label, every detail line and the chip row don't intersect pairwise, and every part stays inside the tile.
  - **Name placement:** the name stays inside its column with no hidden horizontal overflow, and it doesn't intersect the visible logo.
  - **Hero row:** it is computed `nowrap`, a single line, with the absolute block level with and right of the hero. This is the structural guard for the export-only wrap.
- **Where it runs:**
  - **New test "Tuesday tiles never collide…" (stress mode):** whole-number movers, so one-digit heroes including "−8" beside "74%"; long heroes ("+0.98"-style form, "−2:04" TOI); and the longest real names (CHARLE-EDOUARD D'ASTOUS, OLIVER BJORKSTRAND, RYAN NUGENT-HOPKINS) on the first tile of every list on all four cards.
  - **The genuine run-2 render:** all four cards.
- **Regression check:** against the TT-7 CSS (wrapping hero row, 72% stacked column, fixed name size), the guard **fails** with "name overlaps the logo" on the stacked rates tiles. The hero-wrap condition fails the `nowrap` structural check by construction.

## Evidence (`tt7b/after/`)

- **fixture:** `TT7b-OFFLINE-FIXTURE-{png,phone,desktop}-{hot,deployment,rates,movers}.png`, with sparklines.
- **genuine-run2:** `TT7b-GENUINE-DATA-{png,phone,desktop}-*.png`, without sparklines; all four export tokens match the snapshot.

## Checks

| Check | Result |
|---|---|
| E2E full spec, :3110, Monday/Wednesday pins asserted against v2 (two passes; see RECEIPT-5 on the dev `/404` loop) | **34 passed** (33 + 1), including the new collision test and the collision check in the genuine render |
| Monday (9) / Wednesday (9) PNG pins | **byte-identical to v2** |
| Tuesday pins | changed by design: e48ace608863ac991d82bca4a5c3211a903f5cb7e8b65e9339f7ac29043527fe, 1a7240a48f10f970cf185769aa360e707ba189afeed2f90f1a181c761fd94172, 9e77ee33bc35f45896d6d0a503621d4ea8bf15b474ac93238b954d7c63dcc794, fb48ad70446d6242029b3c1ef7db555ee5360f96fa14d7435c7d42785032d57d (hot, deployment, rates, movers) |
| Vitest | 231/231 |
| ESLint / full `tsc --noEmit` / CSS pure | exit 0 / exit 0 / PURE OK |

**Note:** after the E2E run, full tsc flagged a type in the stress helper. The fix is a type-only generic, which Playwright strips at transpile, so the E2E results stand for the same JavaScript. tsc and eslint were re-run after it, both exit 0.

## Files and sha256

| File | sha256 |
|---|---|
| `web/components/SocialShare/SocialShare.tsx` | `c4337af8d70d925de176ae7d299121bd2fbeb18b60a0b7e914e1a1f56cace2af` |
| `web/components/SocialShare/SocialShare.module.scss` | `f8a797a3571c05ae253bc0efa6c3e7ddc5627a8a2cb5b26d026b153e3679dbc6` |
| `web/e2e/social-share.spec.ts` | `4b8d86bd05333727a28d78a80057202a9c734dd538d14d11a63f794b767e1d74` |
| `tasks/diaries/2026-10-26-claude-tuesday-trends-worker.md` | `badf6e6271cedec55bddaf64675a2d3a8f1e084a0e228942c31a3e56ee06f7e7` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/e2e-final-16a.log` | `68f2a75919c59d67026cdc75842ad04063c75cf99382d447ab0780e68fbc0a65` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/e2e-final-16b.log` | `df652bd6cb1bd6681623cdb15e2a52c49c345704e9e8fbe62acdd3cfa977043b` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/vitest.log` | `1bef10ec8853ce9f3a0661092f93bc4fa1d88f34edf4fb409f64eec61f87e384` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/tsc.log` | `cbf7de6a7ab22aa8f3b63eed31368677222a5389d4a0bcaa112a952910051cec` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/eslint.log` | `a6b49f7a0b519016701eccb4efc2de2d77010ed919b35fdad1e3abacbe9dcfd8` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/css-pure-check.log` | `bc5862f7bfedc8661775e14dc79ed2cb1efa1f111b2acc59888d0eb88c0c70c2` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/evidence-16/tuesday-cards-pinned.sha256` | `6594cc332a324cfaf85a69b1b7089ea884ecb57336a0477465b2fca81b1c3825` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt7b/after-bjorkstrand-rates.png` | `95a6e51b8dc4e60185dc98ec5ee78ecb3b92c5b02615a18b1ef396e685247285` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt7b/after-ovechkin-movers.png` | `367b82d73e817f5bac4cef21078096a33782c6970e058a4b67910f42c06dcaf6` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt7b/after/fixture/TT7b-OFFLINE-FIXTURE-desktop-deployment.png` | `628046056c058da2c36cd53c1d2e1bba5901d34815efb1e3ebb142c12a129d8e` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt7b/after/fixture/TT7b-OFFLINE-FIXTURE-desktop-hot.png` | `0a106b81928f57752799449a309dffd1c3caf3bb290a7332d41a9bc3aa5f8d02` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt7b/after/fixture/TT7b-OFFLINE-FIXTURE-desktop-movers.png` | `422a867a03ccd8e54bbbac88b7b2ad162de74c12a9a83d29fc5899658508193e` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt7b/after/fixture/TT7b-OFFLINE-FIXTURE-desktop-rates.png` | `41664198894c8814750c1f0c216cd42f5c67fba6f10887940c58c65178acbb5f` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt7b/after/fixture/TT7b-OFFLINE-FIXTURE-phone-deployment.png` | `356d1f4e58dc7e762fe64a61af1b687f2530668d16a274414bc021356182fc14` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt7b/after/fixture/TT7b-OFFLINE-FIXTURE-phone-hot.png` | `b5f2345dbe94f460ff184c7b76ddfda45a21f6e6cdf7d2a2d508f5c5e65c3a1f` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt7b/after/fixture/TT7b-OFFLINE-FIXTURE-phone-movers.png` | `0ae9762236e08cf2ebf2eae7124e0cdeec0170590800cca1cdd8a8fdda455bdb` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt7b/after/fixture/TT7b-OFFLINE-FIXTURE-phone-rates.png` | `8cdaf5028ead53f89c10defbe65c1092303ebb74b47740fa7232298310b5ea8c` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt7b/after/fixture/TT7b-OFFLINE-FIXTURE-png-deployment.png` | `97bb97fdefb6ec2423874334b254c11a430fd423d36319b8aab76eb472d8f74f` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt7b/after/fixture/TT7b-OFFLINE-FIXTURE-png-hot.png` | `918d73aa85f6cf3372fd33a1768d942b43bcebbd11a30b4756992d439151ad88` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt7b/after/fixture/TT7b-OFFLINE-FIXTURE-png-movers.png` | `7e8a6f7bf926758d688227dd6e05f803eea5ad8409f6912efde3febe382b40e1` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt7b/after/fixture/TT7b-OFFLINE-FIXTURE-png-rates.png` | `ae9c1b41c81d42994ad96a6ccbe70b936d0c2b13bd65b9cea43fd844f9934bd2` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt7b/after/genuine-run2/TT7b-GENUINE-DATA-desktop-deployment.png` | `afb96e03f80c6ca93e5b6b4927704afa9d4cea04e7f6e1637db2eb4d70cdb5bd` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt7b/after/genuine-run2/TT7b-GENUINE-DATA-desktop-hot.png` | `7636e7e5c6b1dd88e35ac58a51f764c4dbd01e938ef12432adefb57ce83d7d57` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt7b/after/genuine-run2/TT7b-GENUINE-DATA-desktop-movers.png` | `152c702b62d4de8637bdacd67877823f4aee8a9770e696131fb6092f05848002` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt7b/after/genuine-run2/TT7b-GENUINE-DATA-desktop-rates.png` | `603c2ee0c04dcfc6477cc7f5cc22b95dbb52284285497b6bdc74b0b2e8c80957` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt7b/after/genuine-run2/TT7b-GENUINE-DATA-export-tokens.json` | `68973d5af4825d538e5ba77cc016917e8bcabf1f654c0fe975e449a89a4eae97` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt7b/after/genuine-run2/TT7b-GENUINE-DATA-phone-deployment.png` | `27b4c36f259a39e34581b9b736457ff86869ec901a776abe1d34aab98b24b2b4` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt7b/after/genuine-run2/TT7b-GENUINE-DATA-phone-hot.png` | `e7960d50fd615e4622338886c366bce974bbb9d11cd4a812b23ef224de473439` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt7b/after/genuine-run2/TT7b-GENUINE-DATA-phone-movers.png` | `0c560c34d310773a77b9ec95aab532a113ee6c80c1da4fe0aac348a76170e0f2` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt7b/after/genuine-run2/TT7b-GENUINE-DATA-phone-rates.png` | `d29e02f6c50fefa398460d850dcedb2e348c5c85ff0b635984653e92f7923f6f` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt7b/after/genuine-run2/TT7b-GENUINE-DATA-png-deployment.png` | `00a84f544eb9f06804b1d7447702820354a4807562da275e957f25fa40b74f43` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt7b/after/genuine-run2/TT7b-GENUINE-DATA-png-hot.png` | `a196fdc09eb174effde80b9abd5722f891d018c64051d2f72cdca6c1f3c42ce8` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt7b/after/genuine-run2/TT7b-GENUINE-DATA-png-movers.png` | `a6eaeb7495e2a9500cdb9c37789b8f5ca0b67525cf14780393c629a8f6a5a165` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt7b/after/genuine-run2/TT7b-GENUINE-DATA-png-rates.png` | `3ec7af9c6ed66bb291d93b4781e13618f16dbd7e74ba040e50864baf93f839c4` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt7b/before-bjorkstrand-rates.png` | `18fbe37cfcebbfe5057223ef73f0e53b323ca878deaae9ba4dc4c18226216785` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt7b/before-ovechkin-movers.png` | `5850d2068703128ef0433706eab91249b79a439cd11603cd6d5f2aa1de08cd34` |

Note: `*.log` files are gitignored; their hashes cover the local copies.
