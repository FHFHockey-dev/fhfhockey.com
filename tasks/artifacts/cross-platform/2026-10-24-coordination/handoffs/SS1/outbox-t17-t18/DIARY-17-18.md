# SS1 diary notes, tickets 17–18 (outbox copy; repo writes frozen by CODEX-20261025-083)

## Ticket 17 (2026-10-25 ~11:10 EDT)
- Snapshot /private/tmp/fhfh-ss1-t17/web (HEAD 1ee5127dc). Recent read: isolated per source, caps from grain (22), partial state, a server log line. 12 meta captions removed.
- TJ-approved 3 live selects: all OK, so the root cause is not reproduced. Check the Vercel logs for "[social-share]" after deploy. Live L5 hits/blocks are null.
- Written in repo before the freeze: handoffs/SS1/{RECEIPT-17.md, SS1-17.patch, HASHES-17.txt, BASE-17.txt, t17/} and the diary section in tasks/diaries/2026-10-24-claude-ss1-social-share-monday.md.

## Ticket 18 (2026-10-25 ~11:35 EDT)
- Layered on the t17 snapshot (17 not landed). Pop-ups: 15% TOI, mirrored cold, goalies too (rules proposed).
- streak.ts config + streakOf; per-game points from consecutive goals_total_all + assists_total_all rows.
- Gotcha: points_total_all was DROPPED (2026-10-21 migration); full tsc caught it. Always check rollingDroppedColumns.ts when adding rolling columns.
- Gotcha: the repo's net-deny-log.cjs was removed by the cleanup; recreated as outbox/SS1/net-deny.cjs (self-tested).
- vitest 172/172; e2e 30/30, 22 pins (12 changed); CSS OK; eslint 0. :3140 released 15:32:23Z.
