# C4 SITE-WIGO workflow links — Claude lane diary

- Scope: connect `/wigoCharts` to existing `getWigoSurfaceLinks` + `SurfaceWorkflowLinks`. Lease: `web/pages/wigoCharts.tsx`, new `web/__tests__/pages/wigoCharts.test.tsx`, `handoffs/C4/`. No Git, no server until granted.
- Where: octoberBranch @ 2a5092d37 (uncommitted). Receipt + patch: `tasks/artifacts/cross-platform/2026-10-24-coordination/handoffs/C4/{RECEIPT.md,C4-SITE-WIGO.patch}`.
- State: code + 6 Vitest cases pass (baseline fails 6/6); eslint clean; tsc only 2 pre-existing Luna errors.
- Browser pass done on :3110 (isolated, inert env, synthetic player via an in-page fetch stub): 4 screenshots, keyboard focus/Enter/Back, tap/Back with the tab restored, all in RECEIPT.md. Server stopped; slot released.
- Deviation: the public NHL API was reached (the `/api/cors` schedule call plus server-side season fallbacks, at least 5). Production Supabase and :3000 were not reached. Details in RECEIPT.md.
- Next: C7 independent review; Codex integration.
- Blockers: none.

## Ticket 2 — BLSH-3.1/3.4 candidate detail

- Lease: `BuyLowSellHighPreview.tsx`/`.test.tsx` plus new files in `web/components/buyLowSellHigh/`. Shared sko/BLSH libs are read-only.
- Done: new `BlshPlayerDetail.tsx` and `.module.scss`, and list/detail toggles in the preview. 10/10 tests pass (the 5 new tests fail on the baseline). Neighbouring suites 73/73, eslint clean, pure check OK, tsc has only 3 foreign errors.
- Receipt `handoffs/C4/RECEIPT-BLSH.md`; patch `handoffs/C4/C4-BLSH-DETAIL.patch` (3becd6da…).
- Next: browser screenshots at 375/1280 when :3110 is granted (queued after SS1 and C1). Set `NEXT_PUBLIC_SITE_URL` inert too.
- Gotcha: stale, partial and conflicting fixtures are all *unranked*, so detail toggles were also needed in the unranked/level list.
- Gotchas: the shared `<section>` has no accessible name (no region role), so the tests find it by heading. The desktop grid has fixed rows/areas at ≥1600, so the links sit outside it. Default tsc heap aborts (exit 134); use an 8 GB heap.

## R1 — C7 finding C4-F2

- Description now branches on `selectedPlayer` too (partial state: "Team HQ and lines appear once this player's team is known…"). Page `7ee8ff57…`, test `6ca27777…`; incremental patch `handoffs/C4/C4-WIGO-R1.patch` (65dddc93…), applied after C4-SITE-WIGO.patch. 6/6 pass; the old page fails the partial-state case.
- C4-F1 (shared link copy) is not ours; the orchestrator routes it to the owner of `siteSurfaceLinks.ts`.
- Next: one :3110 run covering the BLSH screenshots plus the WiGO partial-state screenshot, with `NEXT_PUBLIC_SITE_URL` inert.

## Browser run 2 (:3110, 2026-10-24 ~16:57–17:02Z), slot released

- Network-guarded via `--require net-guard.cjs` (copy at `handoffs/C4/harness/`): only Next's npm version check was blocked; no app egress; :3000 untouched.
- BLSH v2: a mobile zoom-out (innerWidth 645 at 320) came from the pre-existing Watch hidden spans escaping the scroller. Fixed with `.scrollContainer {position: relative}` on the watch table wrapper. New patch `C4-BLSH-DETAIL-v2.patch` (b1fa417d…); v1 is superseded. 9 BLSH screenshots plus 2 WiGO R1 screenshots, all in the receipts.
- Gotchas: a hidden pane paints lazily, so layout reads 0×0 or screenshots go stale until a fresh screenshot is taken. The browser HTTP cache served `/api/v1/season` from run 1.
- Next: reviews (C7/Codex); hand the SkoElementPreview overflow note to its owner.
