# RECEIPT-3 — TT-3: Recent Form v1, deployment columns, integer movers, approved re-run (lane TT)

- **Ticket:** TT-3 from the chef, with TJ's decisions taken in the chef's pop-ups.
- **Base:** `c5829aa9e`. The commit SHA is reported in the chat message.
- **Production reads:** the **one approved re-run**: 11 statements, 2026-10-26T16:18:39.380Z → 2026-10-26T16:18:41.537Z. A dry rehearsal beforehand went to `.invalid` and reached no network.
- **No approved production reads remain.** Any further capture needs a new TJ approval.
- **Not done:** no writes, no NST, no Yahoo API, no Vercel, no NHL schedule call, no `PROJECTIONS_*`.

## 1. Recent Form `recent-form-v1-early`

- **Definition:**
  - P/GP over the last 5 appearances vs the preceding 5. The two windows never overlap.
  - All 10 appearances must be in the current season.
  - Shown on the card: both windows' P/GP and the change.
  - "Early season · small sample" appears in the eyebrow and footer, in the PNG too.
  - The copy is descriptive only.
- **Derivation:** `points_total_last10 − points_total_last5`, from the same R1 statement (one extra column; **no new statement**). The writer keeps the last N **valid observations across seasons**. A skater qualifies only when season GP ≥ 10, `points_avg_season × GP` is a whole number (no in-season game lacks points), and `0 ≤ last5 ≤ last10 ≤ season points`. Unproven inputs are left out, never zero.
- **Versioning:** CONTRACT.md versions the rule. Changing the window needs a new id plus a documented edition rule or a reviewed transition. It never switches automatically and never mixes windows.
- **Empty state:** "No qualifiers yet". Deployment, rates and movers still export (E2E: "an empty Recent Form … never blocks the other Tuesday exports").
- **Genuine qualifier count: 439** (skaters with ≥ 10 season GP: 439; `points_total_last10` present on 638 of 638 latest rows). Listed: 5 up and 5 down.

## 2. Deployment column rule

- **TOI-driven rows:** if abs(TOI change) ≥ 1:00, the column follows the TOI sign. The role chips keep their own arrows (genuine: Carrier, now **USAGE UP**, +1:44 with ▼ P1→P3 and ▼ PP3→off PP; Greene, now **USAGE DOWN**, −2:04 with ▲ L4→L3).
- **Role-only rows:** follow the role direction, and the hero shows the role ("▲ LINE", "▼ LINE + PP"), never a TOI number.
- **Mixed-direction role-only rows** are **left out** (documented).
- **Proof:** "Hero never contradicts its column" is asserted in Vitest (fixture and hand-built Carrier/Greene cases) and in E2E on the rendered DOM.

## 3. Movers

- Yahoo rostered % is whole-number precision, so the card shows "+17" and "28% → 45%".
- One decimal appears only when a value has decimals (Vitest `moverDigits`).

## 4. Re-run vs the ceiling

| Ceiling | Actual |
|---|---|
| ≤ 40 statements | **11** |
| ≤ 1,000 rows per statement | max **1000** |
| Concurrency 2 | max in flight **2** |
| Approved tables only | yes (players: 66 ids ≤ 100) |
| Errors / retries | **0 / none** |

| # | Table | Filters (in-lists counted) | Rows | Content-Range | ms | In flight | Error |
|---|---|---|---|---|---|---|---|
| 1 | `rolling_player_game_metrics` | season=eq.20262027, strength_state=eq.all, game_date=gte.2026-10-19 | 1000 | 0-999/1728 | 1284 | 1 | — |
| 2 | `yahoo_player_ownership_history` | (probe, order desc limit 1) | 1 | 0-0/* | 189 | 2 | — |
| 3 | `yahoo_player_ownership_history` | ownership_date=lte.2026-10-21 | 1 | 0-0/* | 166 | 2 | — |
| 4 | `yahoo_player_ownership_history` | ownership_date=in.(2 values) | 1000 | 0-999/1141 | 120 | 2 | — |
| 5 | `yahoo_player_ownership_history` | ownership_date=in.(2 values) | 141 | 1000-1140/1141 | 72 | 2 | — |
| 6 | `rolling_player_game_metrics` | season=eq.20262027, strength_state=eq.all, game_date=gte.2026-10-19 | 728 | 1000-1727/1728 | 276 | 1 | — |
| 7 | `powerPlayCombinations` | gameId=in.(23 values) | 631 | 0-630/631 | 125 | 1 | — |
| 8 | `powerPlayCombinations` | gameId=in.(25 values) | 691 | 0-690/691 | 138 | 2 | — |
| 9 | `yahoo_nhl_player_map_read` | yahoo_player_id=in.(120 values) | 60 | 0-59/60 | 128 | 1 | — |
| 10 | `players` | id=in.(66 values) | 66 | 0-65/66 | 154 | 1 | — |
| 11 | `rolling_player_game_metrics` | season=eq.20262027, strength_state=eq.ev, player_id=in.(8 values), game_date=gte.2026-10-19 | 23 | 0-22/23 | 128 | 1 | — |

**Sections:** hot ready (10 listed), deployment ready (8 listed), rates ready (9 listed), movers ready (10 listed). **None came back unavailable.**

**Footer freshness:** `metricsUpdatedAt` = **2026-10-26T10:15:32.129Z**, the writer's last run, which renders as "updated Oct 26, 6:15 AM EDT". Games run through 2026-10-25. The freshness fix from TT-2 is in effect: no skater is excluded as stale, versus 55 in run 1.

**Other facts in run 2:**
- PP rows exist for all 48 queried games, so there are 0 "PP ?" unknowns.
- Yahoo D = 2026-10-26 and P = 2026-10-21 (575 and 566 rows).
- Map: 60 of 60 keys are unambiguous.
- Rolling page 1 took 1,284 ms.

## 5. Genuine render (offline, captured 2026-10-26T16:18:39.380Z)

- **Files:** `genuine/run-2/screens/GENUINE-DATA-{desktop,phone,png}-{hot,deployment,rates,movers}.png`. Page shots carry the green "GENUINE DATA (captured …), rendered locally" banner.
- **Fixture schedule:** schedule abbreviations are masked, so no fixture "GP this week" chip appears beside a genuine player (asserted).
- **Export tokens:** each PNG's token equals `snapshot.id|card|dates`: hot ✓, deployment ✓, rates ✓, movers ✓. All four cards exported.

## Checks

| Check | Result |
|---|---|
| Vitest `lib/socialShare` + `components/SocialShare` | 221/221 |
| E2E full spec, :3110, deny preload, pins asserted, genuine render on | **33 passed** |
| Monday (9) / Wednesday (9) PNG pins | byte-identical (committed `OTT.png` served, as before) |
| Tuesday pins | all four changed by design (Recent Form, deployment rule, labels); new values in `run/tuesday-pins.txt` |
| ESLint | exit 0 |
| CSS pure check | PURE OK |
| Full `npx tsc --noEmit` | exit 2. **All 3 errors are in other lanes' dirty files**: `lib/player-cards/shareExport.ts` (Codex) and `lib/rosterScheduleData/bridgeForecastWire.ts`. **0 in social-share** |

## Files and sha256

| File | sha256 |
|---|---|
| `web/lib/socialShare/trends.ts` | `253500633d0c3c9f152eda52505d23f9335af7386eb27a81336958a9e75db64b` |
| `web/lib/socialShare/trends.test.ts` | `c19df80e09adc51489404f8a65fc2a586c791ba78deee3692cc082459d6b3ec4` |
| `web/lib/socialShare/trendsFixture.ts` | `786e859fe42db9299c09050061d18a3f52d483a3386c7ddd86c5a69f365de853` |
| `web/lib/socialShare/types.ts` | `9368ae411637aa8f15f9fefd075a2e9bbf2abd21f45756649415a9b7de1103ff` |
| `web/lib/socialShare/schedule.test.ts` | `154631222118f4e2502b2d8bf58a8f594f297da78108a7809df5083da57f90c0` |
| `web/components/SocialShare/SocialShare.tsx` | `792a52567269a717e8e2218adc7a29daee84e3e8309b13f8b16c8c8898d5def6` |
| `web/components/SocialShare/SocialShare.test.tsx` | `4da64579454a3965b6b47022c8f602f3b4bd3e0e6c4c961050d1f874d0d5b29b` |
| `web/e2e/social-share.spec.ts` | `5bab98dc9ab557e69b2a2693eae425fc8399e8ab2fa3ccd1268cbec8e2921de6` |
| `tasks/diaries/2026-10-26-claude-tuesday-trends-worker.md` | `8ea0f15682e0341e1f4a7587251b9da052cf501f8e4a0087f534d96d388f4df0` |
| `tasks/artifacts/tuesday-trends-2026-10-26/CONTRACT.md` | `31a444524785ef046eb70396abecd89e9619652d2e32885311f21870e4e8e228` |
| `tasks/artifacts/tuesday-trends-2026-10-26/READ-PLAN.md` | `5e4e6f4cecca59991b630de0fe3b1618055faa679d532fa0b97f2d5185aa757f` |
| `tasks/artifacts/tuesday-trends-2026-10-26/genuine/capture.run.ts` | `f791ea53e2c8864304b66dcbdb4a457ba0e6592ec3b0cf3b87f5d5b04aa4b356` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/tuesday-pins.txt` | `71c15622d3841f6d52a90eaf0945279a9aa9c36c9783e07c3b634b20ce5f8db4` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/e2e-final-3.log` | `21655db7cb67011907ba1cdc52943c3b15680fd5514cb6e9c0a44e83e550bbcb` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/vitest.log` | `a56a7c670ebb98943e31b061282960681c7e9d85ad97dacd4d42b47cbd60170d` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/tsc.log` | `d531f473d9f13213a3728f74330c3c9fca6731dc3dea8fce90b7ddc259f4f8fe` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/eslint.log` | `a6b49f7a0b519016701eccb4efc2de2d77010ed919b35fdad1e3abacbe9dcfd8` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/css-pure-check.log` | `63136cbe346d775532a26ac2443350684cd5a8acfb291745f81b302686726ab3` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/node-network-3.jsonl` | `5a25de0431eabc945916a4038bf83baae5bbc4139f95125d694903568c65e22e` |
| `tasks/artifacts/tuesday-trends-2026-10-26/genuine/run-2/capture-run.log` | `eb890c05f626a317d4c1aa18643118195cd282e7606cada847c57170d287c957` |
| `tasks/artifacts/tuesday-trends-2026-10-26/genuine/run-2/facts.json` | `41b3c56721bd6e2e31b067213cbc8783cb915bc7e3b2a17074634fbeadc71791` |
| `tasks/artifacts/tuesday-trends-2026-10-26/genuine/run-2/layer.json` | `1f5f034123885ace57e630ff1cb8153e0ff18376a529e4e3eb4f310c31e41ba4` |
| `tasks/artifacts/tuesday-trends-2026-10-26/genuine/run-2/screens/GENUINE-DATA-desktop-deployment.png` | `7b03bf7d88b6ce862217dcd0fbd0dd0751120e63e2768c2396e33041085e10e1` |
| `tasks/artifacts/tuesday-trends-2026-10-26/genuine/run-2/screens/GENUINE-DATA-desktop-hot.png` | `aa308f4b367a33fe3bee67e2a3dc2592ee3752ad8129844189b41061999e11d1` |
| `tasks/artifacts/tuesday-trends-2026-10-26/genuine/run-2/screens/GENUINE-DATA-desktop-movers.png` | `b1d922b395394e6b5572bedbcf744d424ff29611b8fdee38e01888a984d1cd5f` |
| `tasks/artifacts/tuesday-trends-2026-10-26/genuine/run-2/screens/GENUINE-DATA-desktop-rates.png` | `b8e8f66bdd70640f439871c29ddff727ff3e2ab329eecf257cf518f99d598f7e` |
| `tasks/artifacts/tuesday-trends-2026-10-26/genuine/run-2/screens/GENUINE-DATA-export-tokens.json` | `126a0aebe78d8cd10d9196a6ac26af591834f47a9fe2b0c6e6ad931f470b1139` |
| `tasks/artifacts/tuesday-trends-2026-10-26/genuine/run-2/screens/GENUINE-DATA-phone-deployment.png` | `85d3f26df5bb1728b9e7bbdfffc49325c88703ee356ad42e986c3ed734c95798` |
| `tasks/artifacts/tuesday-trends-2026-10-26/genuine/run-2/screens/GENUINE-DATA-phone-hot.png` | `3e71d1f1cb01daf3708a5516fb31a3ce97ac9eafcb8c0948d755a35b325098c7` |
| `tasks/artifacts/tuesday-trends-2026-10-26/genuine/run-2/screens/GENUINE-DATA-phone-movers.png` | `53ca87634f3d8fb2c1601a88d4138945c0357e42beebfd33dd3420130247fc4d` |
| `tasks/artifacts/tuesday-trends-2026-10-26/genuine/run-2/screens/GENUINE-DATA-phone-rates.png` | `d8bed60c8a66af42e59cc560aaeec54a49dda6291065682ea5f5b2744d8b906b` |
| `tasks/artifacts/tuesday-trends-2026-10-26/genuine/run-2/screens/GENUINE-DATA-png-deployment.png` | `efd88856818459eb9bc30e36fcf35987076df123387ca0d79aa95fb178170179` |
| `tasks/artifacts/tuesday-trends-2026-10-26/genuine/run-2/screens/GENUINE-DATA-png-hot.png` | `08b64feb44364ab5848806b0337dc30c77ba418da5fe6966503c15d388cec4e9` |
| `tasks/artifacts/tuesday-trends-2026-10-26/genuine/run-2/screens/GENUINE-DATA-png-movers.png` | `8f2a2c992967c11d03e8b3fb068eaa528586a0606336a5c2a3eccdd802c42904` |
| `tasks/artifacts/tuesday-trends-2026-10-26/genuine/run-2/screens/GENUINE-DATA-png-rates.png` | `934edf02d6cfb93d13224b9849d9e815d7bf7529eb5e0bb2cc227455370d05fc` |
| `tasks/artifacts/tuesday-trends-2026-10-26/genuine/run-2/statements.jsonl` | `f90d09321a4d328280836ceb8d31d0013688d3b4c81cd7a6cf1d401548301e41` |
| `tasks/artifacts/tuesday-trends-2026-10-26/screens/OFFLINE-FIXTURE-desktop-deployment.png` | `4c887cabfa2b028a331adbc09c063bd2708dee11d50612d6b27a8a8144285681` |
| `tasks/artifacts/tuesday-trends-2026-10-26/screens/OFFLINE-FIXTURE-desktop-hot.png` | `b95c528aaf1b11e137b9f85f3d816a8dd7aa95a8281ae136900cd12cf70fa512` |
| `tasks/artifacts/tuesday-trends-2026-10-26/screens/OFFLINE-FIXTURE-desktop-movers.png` | `0d0ef0970b8cccf4c6cf58b0b7e27cf118cc4d62b1c8dd7524ba2e9f6bbeea3d` |
| `tasks/artifacts/tuesday-trends-2026-10-26/screens/OFFLINE-FIXTURE-desktop-rates.png` | `054fda112f7da0b25ed7b0e0593791e59ec2548dda033fd5ee221170d97e4466` |
| `tasks/artifacts/tuesday-trends-2026-10-26/screens/OFFLINE-FIXTURE-phone-deployment.png` | `fe42c3ea59cf6187d93aede4273a8b7c80268fcf6a88f1a80b56854247271db9` |
| `tasks/artifacts/tuesday-trends-2026-10-26/screens/OFFLINE-FIXTURE-phone-hot.png` | `1e9df4358d715c7f6cc405b9f680069daf7133e2bf6b0c88183bd231b837fba3` |
| `tasks/artifacts/tuesday-trends-2026-10-26/screens/OFFLINE-FIXTURE-phone-movers.png` | `3af592da213a624bf0fd22929d78777a3c82da82607b33a5fb5f9d2386df8de2` |
| `tasks/artifacts/tuesday-trends-2026-10-26/screens/OFFLINE-FIXTURE-phone-rates.png` | `b5c4d9c3a8ee35e84d8753e453177d5b7ae45c94ddb632afdfd09196e1987f0d` |
| `tasks/artifacts/tuesday-trends-2026-10-26/screens/OFFLINE-FIXTURE-png-deployment.png` | `5c166f224ec8c996b6a71ee4434faac31c5c4f2cd2b326c0a35e4a071a241904` |
| `tasks/artifacts/tuesday-trends-2026-10-26/screens/OFFLINE-FIXTURE-png-hot.png` | `4481be7cd4f73bee54ce4f67b98f1c3bd6ae296c00018dc0441694f393b7db5f` |
| `tasks/artifacts/tuesday-trends-2026-10-26/screens/OFFLINE-FIXTURE-png-movers.png` | `5229f51500a858fbb68ce56e04d9c964302097ff9df27ad7a40690801077b280` |
| `tasks/artifacts/tuesday-trends-2026-10-26/screens/OFFLINE-FIXTURE-png-rates.png` | `6f1a9668994b8220b121fd0f7c8fae778223ad7682176577429f46b7b47e48bc` |
| `tasks/artifacts/tuesday-trends-2026-10-26/screens/README.md` | `1836d47a94d27f5c9d6899481372dfe691aac8b2949f81bef71c7933008fb84a` |

Note: `*.log` files are gitignored; their hashes cover the local copies.
