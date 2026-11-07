# RECEIPT-2 — TT-2: label fix, one genuine capture, offline genuine render (lane TT)

- **Ticket:** TT-2 from the chef (local_9c175312…). TJ's ceiling and N1 (`players`) addendum are recorded in `READ-APPROVAL.md`.
- **Base:** `82490cd45`. The commit SHA is reported in the chat message.
- **Production reads:** one capture run only: **11 statements**, read-only anon GETs, 2026-10-26T16:00:00.517Z → 16:00:04.599Z. A dry rehearsal beforehand went to `http://supabase.e2e.invalid` and reached no network.
- **Re-run:** **not used.** It is held for the decisions below.
- **Not done:** no writes, no NST, no Yahoo API, no Vercel, no NHL schedule call (the capture calls `loadTrendLayer` directly), no `PROJECTIONS_*`.

## 1. Label fix (offline)

- **Hero:** the movers card's hero label is now **"PCT PTS ROSTERED"**, and the footer definition reads **"pct pts = percentage-point change in Yahoo rostered %…"**. The Vitest and E2E assertions are updated.
- **Pins:**
  - **Monday:** all 9 byte-identical (committed `OTT.png` served through `SOCIAL_SHARE_LOGO_OVERRIDE_DIR`, as in RECEIPT-1).
  - **Wednesday:** all 9 byte-identical (same setup).
  - **Tuesday:** hot, deployment and rates unchanged; **movers changed** (label). New values are in `run/tuesday-pins.txt`.

## 2. Capture vs the ceiling

| Ceiling | Actual |
|---|---|
| ≤ 40 statements | **11** |
| ≤ 1,000 rows per statement | max **1,000** (rolling page 1) |
| Concurrency 2 | max in flight **2** |
| Approved tables only | rolling ×3, ownership history ×4, PP combinations ×2, map ×1, players ×1 (N1, 53 ids ≤ 100) |
| Errors | **0** |

| # | Table | Filters (in-lists counted) | Rows | Content-Range | ms | In flight | Error |
|---|---|---|---|---|---|---|---|
| 1 | `rolling_player_game_metrics` | season=eq.20262027, strength_state=eq.all, game_date=gte.2026-10-19 | 1000 | 0-999/1728 | 3360 | 1 | — |
| 2 | `yahoo_player_ownership_history` | (probe, order desc limit 1) | 1 | 0-0/* | 383 | 2 | — |
| 3 | `yahoo_player_ownership_history` | ownership_date=lte.2026-10-21 | 1 | 0-0/* | 49 | 2 | — |
| 4 | `yahoo_player_ownership_history` | ownership_date=in.(2 values) | 1000 | 0-999/1141 | 124 | 2 | — |
| 5 | `yahoo_player_ownership_history` | ownership_date=in.(2 values) | 141 | 1000-1140/1141 | 94 | 2 | — |
| 6 | `rolling_player_game_metrics` | season=eq.20262027, strength_state=eq.all, game_date=gte.2026-10-19 | 728 | 1000-1727/1728 | 178 | 1 | — |
| 7 | `powerPlayCombinations` | gameId=in.(17 values) | 442 | 0-441/442 | 162 | 1 | — |
| 8 | `powerPlayCombinations` | gameId=in.(25 values) | 729 | 0-728/729 | 206 | 2 | — |
| 9 | `yahoo_nhl_player_map_read` | yahoo_player_id=in.(120 values) | 60 | 0-59/60 | 111 | 1 | — |
| 10 | `players` | id=in.(53 values) | 53 | 0-52/53 | 59 | 1 | — |
| 11 | `rolling_player_game_metrics` | season=eq.20262027, strength_state=eq.ev, player_id=in.(8 values), game_date=gte.2026-10-19 | 24 | 0-23/24 | 128 | 1 | — |

Files: `genuine/layer.json` (shown players only), `genuine/statements.jsonl`, `genuine/facts.json` (aggregates computed in memory; no raw rows saved), `genuine/capture.run.ts` with `vitest.capture.config.mts` (guarded fetch: GET to the Supabase host only, stop at 40), and `genuine/capture-run.log`. The anon key never appears in any artifact (checked).

## 3. READ-PLAN facts 1–5

1. **Rolling window.**
   - **Size:** 1728 strength-all rows (cap 5,000) in 2 pages. Page 1 took **3,360 ms** (exact count plus connection setup); page 2 took 178 ms. There was no timeout.
   - **Skaters:** 638. Games each in the 8-day window: {'1': 64, '2': 132, '3': 368, '4': 74}. Null team_id: 0.
   - **Goalies:** 0 of 53 shortlisted names were goalies. Whether goalies appear anywhere in the table is still unknown, because only shortlisted ids are named.
   - **Writer:** newest row 2026-10-26 10:15 UTC (the daily writer ran); oldest latest-row 2026-10-20.
   - **Bug found and fixed offline:** the writer writes each game row once, so the per-row 72 h rule wrongly dropped **55 current skaters**. Freshness now follows the writer's newest row (`activeSkaters`, with a new Vitest regression test; CONTRACT updated). **The captured layer predates the fix**, so its footer reads "updated Oct 24" and those 55 are missing.
2. **Yahoo ownership.**
   - **Dates:** latest D = **2026-10-26** = today in New York (fresh); P = **2026-10-21**.
   - **Rows per date:** {'2026-10-21': 566, '2026-10-26': 575}, 1,141 in total (cap 6,000; the plan's estimate of 1,500–2,500 per date was high).
   - **Values:** 0 null pct. All values are whole percents.
3. **L5 semantics.**
   - **Season points:** `points_avg_season × season_games_played` is a whole number for **638 of 638** skaters, so it is season points.
   - **Window:** `toi_total_last5 ÷ toi_avg_last5 = 5` for 631 of 638 skaters, **including 62 of 66 skaters under 5 GP**. The writer (`fetchRollingPlayerAverages.ts`, simple metrics: `avg = window.sum ÷ window.count`) keeps the **last 5 appearances across seasons**; the window does not reset at season start.
   - **Effect:** early-season L5 values include last season. Our minimums (≥ 15 GP for form, ≥ 10 GP for rates and deployment) keep every listed L5 inside the current season.
4. **PP coverage.**
   - **Queried games:** 42 game ids (latest plus previous contiguous games of current skaters); all **42 of 42** have `powerPlayCombinations` rows (1,171 rows, ≈ 28 per game).
   - **Null units:** of 638 latest rows, 184 have a null `pp_unit`. **181 are confirmed "off PP"** (the game has rows), and only 3 are unknown; those 3 were in games of skaters the old rule had excluded.
5. **Id map.**
   - **Queried:** 120 values (60 candidate keys × player_key and bare id). Result: 60 map rows.
   - **Result:** **all 60 keys map to exactly one NHL id**; none ambiguous. All 10 mover slots filled.

## 4. Sections in the captured layer

| Section | State | Listed | Note |
|---|---|---|---|
| Hot/cold | ready | **0** | Nobody has ≥ 15 season GP on Oct 26 (the 10-prior-GP minimum). The card says "None qualify" and **Download is disabled**. This is a contract outcome, not an error. **Decision needed.** |
| Deployment | ready | 8 | Example: Alexandre Carrier is under USAGE DOWN (P1→P3, PP3→off PP) while his TOI is +1:44. The role change outranks TOI as documented; the value is coloured by the TOI sign |
| Rates | ready | 9 | Every L5 sample is ≥ 53 min |
| Movers | ready | 10 | Rising +17 to +10 pct pts; falling −13 to −5 |

## 5. Genuine render (offline)

- **Files:** `genuine/screens/GENUINE-DATA-{desktop,phone}-*.png`, `GENUINE-DATA-png-{deployment,rates,movers}.png`, and `GENUINE-DATA-preview-hot.png` (hot cannot export with no rows).
- **How rendered:** E2E "Tuesday GENUINE DATA render" served the captured layer on the offline fixture schedule.
  - Schedule row abbreviations are masked, so **no fixture "GP this week" chip** sits beside a genuine player (asserted).
  - Page shots carry a green "GENUINE DATA (captured 2026-10-26T16:00:00.517Z), rendered locally · schedule panel is the offline fixture" banner. The team list in the page shots is fixture data.
- **Export tokens:** every card's token equals `snapshot.id|card|dates` (`GENUINE-DATA-export-tokens.json`), and each PNG filename carries the snapshot id.

## Checks

| Check | Result |
|---|---|
| Vitest `lib/socialShare` + `components/SocialShare` | 216/216 |
| Full `npx tsc --noEmit` | exit 0 |
| ESLint (social lib, components, spec, API) | exit 0 |
| CSS pure check | PURE OK |
| E2E full spec on :3110 with deny preload, pins asserted | **32 passed** (1 deny entry: Next's npm registry check) |

## Files and sha256

| File | sha256 |
|---|---|
| `web/lib/socialShare/trends.ts` | `c28d2c98b124742b4012f63a4fe2802b25e89141c9d6430657dfa3f0418ab542` |
| `web/lib/socialShare/trends.test.ts` | `a476cdc231c3f71670db761fd6063df0c489953ea452eef9dab5bd4ab380fe96` |
| `web/lib/socialShare/types.ts` | `fd7cb9535979f485453e278242f30033cb8668a286e6501bd04162174955f12e` |
| `web/components/SocialShare/SocialShare.tsx` | `60995c67c24ba7ff4cb28a418c1eb10d859076d3a66458d66093f7b1ca756e47` |
| `web/components/SocialShare/SocialShare.test.tsx` | `63276eef6c3c47082720d35154781be3d73bebcd747ce4ef1234b809af66e15a` |
| `web/e2e/social-share.spec.ts` | `dfaff0d01d5fc03e7e34b94eba0027b15f1f45b7ce663040c3ffe013c99b1f08` |
| `tasks/diaries/2026-10-26-claude-tuesday-trends-worker.md` | `818350124c3f8f6f34e4f896e4ea5fac435b761e493c6c12362b10f2e2a49905` |
| `tasks/artifacts/tuesday-trends-2026-10-26/CONTRACT.md` | `9201864707c2b764f3de9c2b95305f21ba31801cc89d8cf617b060b7356359c1` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/tuesday-pins.txt` | `89d0c9b80b15766a3d2df614bef9b85495a139b93b4e77915326cccd2badb01b` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/e2e-final-2.log` | `cf896bd1a1273aa64f5c08d54c5cc554f204aa43075a201926eee179e6c73743` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/vitest.log` | `64aa3185b414db2632ec3f6308f8e5b5f476abb7bd81d7292cf96d1e4d7bba4f` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/tsc.log` | `cbf7de6a7ab22aa8f3b63eed31368677222a5389d4a0bcaa112a952910051cec` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/eslint.log` | `a6b49f7a0b519016701eccb4efc2de2d77010ed919b35fdad1e3abacbe9dcfd8` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/css-pure-check.log` | `63136cbe346d775532a26ac2443350684cd5a8acfb291745f81b302686726ab3` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/node-network-2.jsonl` | `fcb0383881b403cadc7f73f0994c72c1077d9955cf21e183441848409093e9c1` |
| `tasks/artifacts/tuesday-trends-2026-10-26/genuine/capture-run.log` | `2ff01697d71d69c48fd1a3b1deac6da767c143d5a13cc75e2ea70ea7a17208cf` |
| `tasks/artifacts/tuesday-trends-2026-10-26/genuine/capture.run.ts` | `49785b68bb526c8d434f354e0ad5c396e4a8c087c2a18c079c5c408ebf1057ad` |
| `tasks/artifacts/tuesday-trends-2026-10-26/genuine/facts.json` | `85eadbc8a22f3da8fd1824a953dffa270e59f3eb11b87e2a8952d4f2dc59cda6` |
| `tasks/artifacts/tuesday-trends-2026-10-26/genuine/layer.json` | `a6b073794cecfc1e8d507ca632946f27b0dc3e365080f67634b1d13b035f7a66` |
| `tasks/artifacts/tuesday-trends-2026-10-26/genuine/screens/GENUINE-DATA-desktop-deployment.png` | `0ae32e6636377c4e5635dcd0e937ebefb834a5e1490841832d916089a3a88cf6` |
| `tasks/artifacts/tuesday-trends-2026-10-26/genuine/screens/GENUINE-DATA-desktop-hot.png` | `4c56d5227d3c4dbe264d22bc289d6a51a8c486d7ae9d02ba5df4e8354821ce3b` |
| `tasks/artifacts/tuesday-trends-2026-10-26/genuine/screens/GENUINE-DATA-desktop-movers.png` | `c4ec963fa3fb4569281148c9f25ad98efc131e3a7323857a5b756d99da078e2c` |
| `tasks/artifacts/tuesday-trends-2026-10-26/genuine/screens/GENUINE-DATA-desktop-rates.png` | `22d8f8d1f60f3a526336bd380034174714c99468b3501d8919e5ced22139aab5` |
| `tasks/artifacts/tuesday-trends-2026-10-26/genuine/screens/GENUINE-DATA-export-tokens.json` | `946d02d074ee5a57f4362f27306fa2b7dd71f2bddcff35af5eae5e241bc85a09` |
| `tasks/artifacts/tuesday-trends-2026-10-26/genuine/screens/GENUINE-DATA-phone-deployment.png` | `1a15a1587378383938782d45a766ef36aae67b50753975650b0bc06cb219280b` |
| `tasks/artifacts/tuesday-trends-2026-10-26/genuine/screens/GENUINE-DATA-phone-hot.png` | `745923dd10e2f2f8d88dc92bdac2d2823521b63608241bfc8b569baa02989f25` |
| `tasks/artifacts/tuesday-trends-2026-10-26/genuine/screens/GENUINE-DATA-phone-movers.png` | `b0c22a1b8ff1c52f7acf384a290de317d6376a1abc0ec1c97e4971b206c08956` |
| `tasks/artifacts/tuesday-trends-2026-10-26/genuine/screens/GENUINE-DATA-phone-rates.png` | `cc564e6e37e8a75bcce555adedc5081538a88c7eb27941fb23ca5b21485200ce` |
| `tasks/artifacts/tuesday-trends-2026-10-26/genuine/screens/GENUINE-DATA-png-deployment.png` | `089c1157f438c33dea6c66c213ade9a2a906b9e4b363aea8380dd110188e3522` |
| `tasks/artifacts/tuesday-trends-2026-10-26/genuine/screens/GENUINE-DATA-png-movers.png` | `46afa4fb5f2a63cef89d4ee7b4a9d2dabb311eef22112e6e458dc85533c087b9` |
| `tasks/artifacts/tuesday-trends-2026-10-26/genuine/screens/GENUINE-DATA-png-rates.png` | `06bddd76535b0b4500fddf0b7f8519f06287345f9125fa71fafe3a3ced8a4767` |
| `tasks/artifacts/tuesday-trends-2026-10-26/genuine/screens/GENUINE-DATA-preview-hot.png` | `3f017dd2783ce9dfcb922064c55607e83d7e0d6e9d7ce3518fedeed990bf2139` |
| `tasks/artifacts/tuesday-trends-2026-10-26/genuine/statements.jsonl` | `bce3f26a392de4ebdbe6cb6075bdf648a4b9f0e5b35130b6e3ad9794487857a9` |
| `tasks/artifacts/tuesday-trends-2026-10-26/genuine/vitest.capture.config.mts` | `3096ec50e29b9eff1c46f257cb6237c29e524a46f7b33dae132497c737df97ca` |
| `tasks/artifacts/tuesday-trends-2026-10-26/screens/OFFLINE-FIXTURE-desktop-deployment.png` | `8021e12bf3c952f9b2f8947a7bf101a690d23b629e576de505eb3fa35d3d4e98` |
| `tasks/artifacts/tuesday-trends-2026-10-26/screens/OFFLINE-FIXTURE-desktop-hot.png` | `9f29bfa097e8b7b34ff19c079cc21a0ea20b61261cdd33c6def4a63e0b7c554e` |
| `tasks/artifacts/tuesday-trends-2026-10-26/screens/OFFLINE-FIXTURE-desktop-movers.png` | `3d70e835984899bc1aacf82c2a5fcbf7f05ec6921cdb47afa02e6aaa1cd0124d` |
| `tasks/artifacts/tuesday-trends-2026-10-26/screens/OFFLINE-FIXTURE-desktop-rates.png` | `f9ac232b18a1653f43a330f5042fd0e14cc4f4f08626dc285ffdfda10bcdc21b` |
| `tasks/artifacts/tuesday-trends-2026-10-26/screens/OFFLINE-FIXTURE-phone-deployment.png` | `b69fc3a062a6e46be5c064520ee63d6a8cda86168f772706b4cda8db483d9e6c` |
| `tasks/artifacts/tuesday-trends-2026-10-26/screens/OFFLINE-FIXTURE-phone-hot.png` | `86251e1258d1d7065acd881f5bf5b0087b0da9428dbd5a5e80d5760ed0492234` |
| `tasks/artifacts/tuesday-trends-2026-10-26/screens/OFFLINE-FIXTURE-phone-movers.png` | `fa0ced10e54ee4279e24aa81bf017ae44c98897229a4b6fc086e754997642d64` |
| `tasks/artifacts/tuesday-trends-2026-10-26/screens/OFFLINE-FIXTURE-phone-rates.png` | `1548abf62c8fef4dc865ea091dc32a01a086045a601e503d7242817dd7b79664` |
| `tasks/artifacts/tuesday-trends-2026-10-26/screens/OFFLINE-FIXTURE-png-deployment.png` | `9a6066282b2cfb1383a239df3e3a8eba9bd210f16214a2ef06a863320cc89554` |
| `tasks/artifacts/tuesday-trends-2026-10-26/screens/OFFLINE-FIXTURE-png-hot.png` | `2011b3cb22f8fbfccb08412657b87a403084170a9ba9c7b2e3ab5fc953499fa6` |
| `tasks/artifacts/tuesday-trends-2026-10-26/screens/OFFLINE-FIXTURE-png-movers.png` | `ac194eebacf443df1c828cc7b0bb0a1bd7d2cc7a8474ea3164458356d74a1d60` |
| `tasks/artifacts/tuesday-trends-2026-10-26/screens/OFFLINE-FIXTURE-png-rates.png` | `80c4451ff2bc67b284aa7755cc3bed275855b70f9fa0039fb50dbf24372da709` |
| `tasks/artifacts/tuesday-trends-2026-10-26/screens/README.md` | `1836d47a94d27f5c9d6899481372dfe691aac8b2949f81bef71c7933008fb84a` |

Note: `*.log` files are gitignored (`/tasks/artifacts/**/*.log`), so their hashes above cover the local copies in the canonical checkout. The bulk evidence PNGs from the other 28 E2E tests are kept in the worker scratchpad, not committed.
