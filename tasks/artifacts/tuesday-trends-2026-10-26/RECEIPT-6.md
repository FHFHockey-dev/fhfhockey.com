# RECEIPT-6 — TT-6: sparkline reads approved, on by default with a kill switch (lane TT, offline)

- **Ticket:** TT-6 from the chef. TJ's approval is recorded in `READ-APPROVAL.md` addendum 2 (2026-10-26T19:08:43Z): READ-PLAN v2 S1/M2 for editor page loads, released with sparklines on.
- **Not done:** no production reads by Claude, no pushes, no deploys, no Vercel settings changed.

## 1. Ottawa: already done in `6e3b284fd`

- **Trace:** `outline/OTT.png` was re-traced from the committed new OTT (`e6e5798bf`), and OTT is back to neon. Fallback teams: NYR, NYI, WSH, DET.
- **Override:** the logo override is no longer used.
- **Re-pinned, Ottawa cells only:** `monday-grid`, `monday-easiest`, `monday-tiers-wide`, `wednesday-grid`. Region crops are in `tt5/ott-repin/`.
- **Unchanged:** the other 14 Monday/Wednesday pins are byte-identical.
- **Pin set:** `tt5/ott-repin/pinned-env-v2.txt`. This TT-6 run asserted every pin against it again.

## 2. Flag default ON, `=0` is the kill switch

- `sparklineReadsEnabled(env)` returns `env.SOCIAL_SHARE_TUESDAY_SPARKLINES !== "0"`, with an updated comment. The server passes `{ sparklines: sparklineReadsEnabled() }` to `loadTrendLayer`.
- **Tests:**
  - `trendSources.test.ts`: default `{}` → on; `"1"` → on; `"0"` → off. The off path issues no S1/M2 statement and returns no sparklines.
  - `schedule.test.ts`, real handler: the default passes `{ sparklines: true }`, and the kill switch passes `{ sparklines: false }`.
- **Docs:** CONTRACT.md updated. The READ-PLAN v2 heading now records the approval, default on and the kill switch.

## 3. Checks

| Check | Result |
|---|---|
| E2E full spec, :3110, every pin asserted against v2 (two passes; see RECEIPT-5 on the dev `/404` loop) | **33 passed** (32 + 1) |
| Monday (9) / Wednesday (9) PNG pins | byte-identical to v2 |
| Tuesday pins | **byte-identical to v2**: no change. The E2E mocks the edition API with a fixture that already carries sparkline series, so the rendered cards are the same on the default-on path. The server-side default is proven by the handler test, not by the PNGs |
| Vitest `lib/socialShare` + `components/SocialShare` | 231/231 |
| ESLint / full `tsc --noEmit` / CSS pure | exit 0 / exit 0 / PURE OK |

## Release notes for the chef

- **Runtime behaviour:** with no env var set, each signed-in editor load of `/social-share/tuesday-trends` issues READ-PLAN v2 (typical about 14 statements, worst about 21, pages ≤ 1,000, concurrency 2).
- **Kill switch:** to turn sparklines off without a code change, set `SOCIAL_SHARE_TUESDAY_SPARKLINES=0`. That is a Vercel env change, so it needs TJ.

## Files and sha256

| File | sha256 |
|---|---|
| `web/lib/socialShare/trendSources.ts` | `2182cc0ba0b96a314e3c9ef7792c775c9cb97b6f99b1380eec6bebcca2db903a` |
| `web/lib/socialShare/trendSources.test.ts` | `fb514408af5ac68b1d2cd02ea04bf92231121f73beea59b63dbdae8ec1050af0` |
| `web/lib/socialShare/schedule.test.ts` | `88e6eb69a586e7036665dd5023dea6d3e0239403f53cf2b66f8079759fbaf2f0` |
| `tasks/artifacts/tuesday-trends-2026-10-26/CONTRACT.md` | `9b1ac2dc9d3f7a28046a7de21c30f6fa80441da76a129e260daf8ee4854c083e` |
| `tasks/artifacts/tuesday-trends-2026-10-26/READ-PLAN.md` | `49318a9dc633a204749ec3b71722d6b205f451d4273c7201656da9a0b5398f5c` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt5/ott-repin/pinned-env-v2.txt` | `8e1e891affd22a85cfb3639c783bcee2dde11304d2d7574b819d611e7f3005fb` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/evidence-9/tuesday-cards-pinned.sha256` | `3af129d7433db3f72e8707cb1e9f0b9b3a4d66cde30fb8852e4a8e23397806c0` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/e2e-final-9a.log` | `1cb84d1af0f277fe806c41cee9f7d0173bec49b55afeb311e42f1948fb2fe59e` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/e2e-final-9b.log` | `71a531cb57f837ec4eeadd28ae6df4076edfd1b831525bd9a40a0b0acb791cfe` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/vitest.log` | `93efe7cae0aa4acd27d5627cc112483bd4ba263877161574aa8846d7ca4960ab` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/tsc.log` | `cbf7de6a7ab22aa8f3b63eed31368677222a5389d4a0bcaa112a952910051cec` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/eslint.log` | `a6b49f7a0b519016701eccb4efc2de2d77010ed919b35fdad1e3abacbe9dcfd8` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/css-pure-check.log` | `9dd33fcc31b89d5aabb7e1990eea5f6fa17c16922eebe21e83f4301626b4ba96` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/node-network-9.jsonl` | `42502fde9ff8138d3d30e65b1618e03f71442d1ccd778c9ce4bd392d786d668b` |
| `tasks/diaries/2026-10-26-claude-tuesday-trends-worker.md` | `45dd405b6c850a20534c6cc1094bdd96be5a7a2c4a2b03b0c1fcacc6f4285529` |

Note: `*.log` files are gitignored; their hashes cover the local copies.
