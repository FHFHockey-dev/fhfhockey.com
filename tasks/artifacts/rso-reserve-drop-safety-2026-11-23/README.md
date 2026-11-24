# RSO: exact-game FORGE reserve rows + one drop-safety policy (2026-11-23)

Candidate `refs/rc/rso-reserve-drop-safety-20261123` = `1d86d6c150c906452998c8916a32761a380b311d` on master `9ac6f4bcc`.
16 files, all `web/lib/rosterScheduleData`, `web/lib/rosterScheduleOptimizer` or one RSO test; no component, style,
load-time, migration or env change. Local only: not pushed, not deployed.

## Gates (clean git archive of 1d86d6c15; node_modules linked)
- vitest lib/rosterScheduleOptimizer, lib/rosterScheduleData, __tests__/components/RosterScheduleOptimizer, hooks,
  __tests__/pages/api/v1/roster-schedule-optimizer, lib/integrations/yahoo: 100 files, 2165/2166. The one failure is
  planning.test.ts "1000-player population across 13 days" hitting its 5 s timeout under load (load avg ~11); alone it
  passes in 2.09–2.13 s on the candidate vs 2.27–2.44 s on master; planning.test.ts alone 195/195.
- eslint on the 16 files: 0 errors. npm run typecheck: exit 0, 0 errors.

## 1. Exact-game reserve rows (Astra 2026-11-23)
Bounded local replay of the audit's stored reserve rows (`player-receipts.json` trace1) through the HEAD and candidate
bridge (`astra-reserve-replay.json`). Value = the "if he dresses" goals line. Every row stays conditional: counted
goals unknown (null), not used in totals, code `skater:no_lineup_evidence`.

| Player | Game | Stored exact row (run: goals) | Production wire 11-23 | Before (HEAD replay) | After (candidate) |
|---|---|---|---|---|---|
| Ivan Demidov | 2026020379 | 0203c9b0: 0.245 | b8da5fb9: 0.2457 | b8da5fb9: 0.265 | 0203c9b0: 0.245 |
| Quinn Hughes | 2026020384 | 0203c9b0: 0.141 | f20889ee: 0.1405 | f20889ee: 0.141 | 0203c9b0: 0.141 |
| Cale Makar | 2026020397 | 0ddc93e3: 0.225 | b8da5fb9: 0.2354 | b8da5fb9: 0.192 | 0ddc93e3: 0.225 |
| Ivan Demidov | 2026020397 | 0ddc93e3: 0.214 | b8da5fb9: 0.2194 | b8da5fb9: 0.265 | 0ddc93e3: 0.214 |
| Nathan MacKinnon | 2026020397 | 0ddc93e3: 0.341 | b8da5fb9: 0.3592 | b8da5fb9: 0.292 | 0ddc93e3: 0.341 |
| Quinn Hughes | 2026020396 | 0ddc93e3: 0.139 | f20889ee: 0.1402 | f20889ee: 0.141 | 0ddc93e3: 0.139 |
| Cale Makar | 2026020408 | df4b39a8: 0.188 | b8da5fb9: 0.203 | b8da5fb9: 0.192 | df4b39a8: 0.188 |
| Nathan MacKinnon | 2026020408 | df4b39a8: 0.286 | b8da5fb9: 0.2907 | b8da5fb9: 0.292 | df4b39a8: 0.286 |
| Quinn Hughes | 2026020408 | df4b39a8: 0.141 | f20889ee: 0.1372 | f20889ee: 0.141 | df4b39a8: 0.141 |
| Cale Makar | 2026020425 | b8da5fb9: 0.192 | b8da5fb9: 0.192 | b8da5fb9: 0.192 | b8da5fb9: 0.192 |
| Ivan Demidov | 2026020415 | b8da5fb9: 0.265 | b8da5fb9: 0.265 | b8da5fb9: 0.265 | b8da5fb9: 0.265 |
| Nathan MacKinnon | 2026020425 | b8da5fb9: 0.292 | b8da5fb9: 0.292 | b8da5fb9: 0.292 | b8da5fb9: 0.292 |
| Quinn Hughes | 2026020428 | f20889ee: 0.141 | f20889ee: 0.141 | f20889ee: 0.141 | f20889ee: 0.141 |

Before: 9 of 13 player-games borrowed the furthest run's line (b8da5fb9 / f20889ee) although the game's own row existed.
After: all 13 use their own run and value. (Production values differ slightly from the replay's "before" only because
production also applied opponent/rest scaling to the moved line.)
Unit cases (`forgeDailyBridge.test.ts`): exact row per game; missing exact row → moved line labelled
"FORGE reserve lines moved: N player-games … moved from FORGE run <id> game <id>"; exact row from another team refused;
a lineup line for the game still wins. Admission (`servingRows`, proven runs only) and Detailed's review gate unchanged.

## 2. Drop safety (TJ pop-up 2026-11-23)
- `dropEligible` (shared by DROP chip, Best Fit, planner add/drop, Streaming): canDrop, not Protected, not in a reserve
  slot, not listed Out, AND fresh known ownership < `HIGH_DEMAND_OWNERSHIP_PCT` (50, the existing cutoff TJ approved
  2026-10-20 as the high-demand caution). Missing ownership → not an automatic drop.
- No games left (`noGamesLeft`): stays a known 0 for schedule math; never the standalone DROP chip and never listed
  "unprojected"; a concrete Best Fit / planner / Streaming move may still drop him when eligible and the whole move
  improves the lineup (net vs the current optimized lineup, already how Best Fit and Streaming score).
- Regressions: idle drop chip (before: a ranked first/chip; after: not suggested); improving swap drops idle a
  (+2 AGP, +4 pts); same move blocked when Protected / 85% rostered / ownership unknown; missing incoming projections →
  net points unknown; games but no usable starts → net 0, no plan; valid drop control; DTD counted; Out never dropped with
  his if-playing value kept (2 pts over 2 games); unknown value stays "unprojected". Streaming: +7 chain kept when the
  idle player is eligible; Protected / 85% / unknown ownership → no chain drops him, note STREAMING_NO_DROP; streamers
  without projections → chain net points unknown; no open slot → no recommended chain.

## Not done (needs a decision)
- Display: ownership % beside drop candidates / Best Fit drops / streaming legs and a distinct "partial" label are UI in
  components/RosterScheduleOptimizer/* (CandidateCard, StreamingItinerary, RosterPlayerRow), which the rso-superstyle
  lane is editing. Ranking/net values already exist (Best Fit: Net Pts / Net AGP by goal; Streaming: ±AGP, ±proj FPts).
- The 50% cutoff is a constant, not a user setting.
- Per-row source game for a moved reserve line is not in the bridge wire (shared note names run+game instead).

## Rollout (needs TJ approval for each remote step)
1. Pre-check (read-only, approval): `yahoo_player_ownership_daily` has rows dated within 3 days. If stale, every
   automatic drop is withheld (labelled) until it refreshes.
2. Rebase the same 16 blobs onto then-current master if it moved; re-gate (vitest affected dirs, eslint, typecheck).
3. Inventory Vercel: one `fhfhockey` build expected (web/ changed); fhfhockey.com, cms, functions cancel by ignore step.
   Post a build-slot reservation in the mailbox; push the exact SHA (fast-forward) with TJ's approval.
4. Smoke (read-only, ≤5 sequential): deployment list for the SHA; anonymous GET /roster-schedule-optimizer 200; one
   signed-in tab in TJ's league: Best Fit and DROP chip render, an idle no-games player is not the DROP chip, a
   ≥50%-rostered or unknown-ownership player is never in a proposed drop. No Optimize/Refresh/Sync/Save/roster write.
5. Optional live check of item 1 after FORGE's next run: a reserve player's game rows carry their own run id.

## Rollback
- Instant: promote the READY `fhfhockey` deployment immediately before the release (today: `dpl_Hbn2jb4XdfnKdiQetqNpzbxJ19NV`,
  READY on master `9ac6f4bcc`) — reverts both fixes together; no data to undo (no writes, no migration).
- Code: `git revert <release SHA>`; the two fixes are independent hunks (bridge vs retention/lineupGaps/streaming), so
  either can be reverted alone: bridge = forgeDailyBridge.ts; drop safety = retention.ts + lineupGaps.ts +
  planning.ts (`noGamesLeft`) + streamingChain.ts.

## Ownership source (TJ recheck, 2026-11-23)

Root cause: RSO's loader read `yahoo_player_ownership_daily` (legacy; season 20242025 only, 2024-10-13 → 2025-04-17) and
joined `player_id` to `yahoo_nhl_player_map_read.yahoo_player_id`, which now carries the full key `477.p.N`. Both made
every player's ownership unknown, so the drop gate would have blocked every automatic drop.

Live source: the nightly `update-yahoo-players` job (game 477, season 2026) writes `yahoo_players` and dated
`yahoo_player_ownership_history` rows through `upsert_yahoo_players_atomic`. The FORGE/Transactions ownership-trends
route reads the same history (`yahoo_players_with_normalized_history`). Last run 2026-11-23 08:40Z: 1,613 players,
587 observed, 0 explicit zero, 1,026 `missing_value` (Yahoo sent no number). The audit row says `failure` because the
job reports 207 "partial" when any value is missing; the data itself is written.

Fix: `web/lib/rosterScheduleData/yahooOwnership.ts` resolves the NHL game key for the season start year from
`yahoo_game_keys` (exactly one, numeric), reads that game's history from the last 3 days, and joins on the full key
with a unique NHL match. Missing values stay unknown, never 0%.

Read-only proof against production, 2026-11-23 19:29Z (`ownership-live-read-2026-11-23.json`):
- before: 0 fresh rows for season 20262027;
- after: game 477, newest 2026-11-23, 569 players known (569 nonzero, 0 known zero, 176 at ≥50%), read in 675 ms;
- samples: McDavid, MacKinnon, Makar, Kucherov 100%; Bedard 90%; Pettersson C 8480012 74%; Pettersson D 8483678 14%;
  Zegras 62%.
- Not available: a verified 0% case (Yahoo sent no explicit zero this season), and a signed-in RSO response for a
  real league (needs a dev server with Yahoo sign-in).

## Candidate c868bdee3 (replaces 1d86d6c15 → c4ddb44d7)

- 20 files on master 9ac6f4bcc; ref `refs/rc/rso-reserve-drop-safety-20261123`; local, not pushed.
- c4ddb44d7 added the superstyle lane's byte-identical CandidateBrowser fixture line (the earlier gate skipped the
  co-located component tests). c868bdee3 adds the ownership source fix.
- Gate on a clean export: vitest across rosterScheduleOptimizer, rosterScheduleData, components/RosterScheduleOptimizer,
  __tests__ RSO, hooks, RSO API and integrations/yahoo = 119 files / 2,334 tests passed; eslint 0; typecheck 0.
  A full `vitest --run` on c4ddb44d7 matched a 9ac6f4bcc export except one NST load timeout, which passes alone.

## Release plan (needs separate approval)

1. Fetch and recheck origin/master is 9ac6f4bcc. If it moved, re-cut these 20 blobs onto it and re-gate.
2. Inventory the Vercel projects. Expect 1 fhfhockey build + 3 canceled (fhfhockey.com, cms, functions). Fast-forward
   push of c868bdee3 to master only with TJ's go.
3. Smoke (≤5 read-only, one at a time) in TJ's league on the READY deployment: ownership known for rostered players; a
   DROP chip/Best Fit drop only for a player <50% who is not Protected; a ≥50% or Protected player is never dropped; a
   no-games player is never the standalone chip. Stop on first mismatch.
4. Rollback: promote dpl_Hbn2jb4XdfnKdiQetqNpzbxJ19NV (READY on 9ac6f4bcc). Data needs no rollback: no writes, no
   migration, no cron change.
5. Independent of the superstyle display work; that lane rebases its ownership prefetch onto `readYahooOwnership`.
