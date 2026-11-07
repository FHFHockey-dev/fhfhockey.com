# 2026-11-06 · Claude · Tweet parsing audit (read-only)

## Scope
Read-only audit of how the tweet pipeline recognises and extracts line combos, goalies, injuries and other moves;
current confidence signals; proposed 0–100 scores; answer-key type sketch for the swipe trainer (parallel session).
No application code changes. Parent: local_1fb55d9b (trainer Chef).

## Where
- Checkout /Users/tim/Code/fhfhockey.com, octoberBranch (shared; commit nothing).
- Deliverable: tasks/artifacts/tweet-parsing-audit-2026-11-06.md
- Sources: web/lib/sources/* (13 files named in brief) + fixtures.

## State
- Started. Sibling notes folder empty.
- Read all 13 named files + tweetInterpretation.ts, lineSourceFirstArrival.ts, fixtures.
- Ran a read-only probe (scratchpad probe.ts via vite-node with a scratch config; no repo writes) on real fixture
  tweets + synthetic edge cases. Output in scratchpad probe.out.
- Two parse paths: legacy (flag off) and interpretation (TWEET_PIPELINE_INTERPRETATION_ENABLED=true). Flag not in
  local env files; prod value unverified — check metadata.interpretation presence in DB rows.

- Prod DB (SELECT only, ≤45 rows per sample + aggregates): interpretation flag IS on in prod (every row since
  10-07 has metadata.interpretation). DFOFantasy lineups: 80 rows, 0 goalies (63 have "🥅:"). First D pair lost when
  a D shares a surname with an org forward and no blank line separates F/D (Hughes, Pettersson, Lindholm, Makar).
  Transactions mostly classified "injury" ("recalled"/"assigned" hit injury keywords). probe2 confirmed ruled-out
  goalie becomes goalie_1.

- DONE: report written, tasks/artifacts/tweet-parsing-audit-2026-11-06.md (680 lines, uncommitted). Hand-over
  pointer in the shared notes folder. Nothing committed; no app code touched.

## Next
Parent Chef relays to TJ; the trainer session uses §5/§6. Retire this diary once the report is accepted.

## Blockers / approvals
None. Supabase reads: SELECT only, LIMIT ≤ 200.

## Insights / gotchas
