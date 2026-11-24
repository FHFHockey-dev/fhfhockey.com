# 2026-11-23 · Claude (Chef, RSO lane) · exact-game reserves + drop safety

## Scope (TJ 2026-11-23)
1. Daily bridge: prefer each game's exact admitted reserve row over a line moved from another game (Astra: MacKinnon,
   Makar, Quinn Hughes, Demidov). Keep conditional "if he dresses" value + source; label any moved fallback.
2. Drop safety (TJ pop-up, supersedes "exclude no-games everywhere"): one policy across DROP chip, Best Fit, planner
   add/drop and Streaming = Protect + high-ownership cutoff (existing approved one if any; else configurable + proposed
   default). Missing ownership = unknown, not 0%, not enough for an automatic drop. No games left = 0 AGP / 0 pts this
   week, not low value; never a standalone DROP chip by itself; a concrete Best Fit / Streaming move may drop an eligible
   idle player if it improves the lineup under the goal. Show ownership %, remaining projected pts, remaining AGP in the
   legal lineup; rank Best Fit by net pts (points goal, show net AGP) or net AGP (starts goal, show net pts); partial
   coverage labelled unknown/partial. Keep the +7 streaming case when the outgoing player is eligible; regressions for
   protected, highly rostered, missing ownership/projections, and games-but-no-usable-starts.
No production writes, Yahoo changes, push, build or deploy. Separate from styling/load-time work.

## Where
- Base: octoberBranch 6f56b16f8; master 9ac6f4bcc (target files identical on both). Prod READY dpl_A6wXhPbxbr… (480bd5d71)
  at last check; master since moved to 9ac6f4bcc.
- Overlap: rso-superstyle (local_e6032136, own worktree /private/tmp/rso-superstyle-claude-20261123 off 9ac6f4bcc) edits
  forgeDailyBridge.ts (skaters read → concurrentPages) and planning.ts (scheduleFits only) + RSO component/hooks/styles.
  Agreed: RSO stays out of scheduleFits / skaters read. Stale leases FORGE-RESERVE, RSO-FLAKE, RSO-YAHOO-DIET-P2 (10-26).
- Audit inputs: /private/tmp/forge-readonly-audit-20261123.KIwY6H (consumer-match.json, player-receipts.json, no-play.json).

## State
- Bridge fix done: forgeDailyBridge.ts exactReserve from all admitted run dates (team-checked); moved fallback counted and
  labelled "FORGE reserve lines moved: N player-games … moved from FORGE run <id> game <id>". Before: s2 game 1 took r3's
  game-2 line (0.4); after: r2's own game-1 row (0.2). rosterScheduleData 316/316.
- Drop: noGamesLeft(snapshot, player) helper in planning.ts. First cut excluded no-games players from every drop order →
  broke 23 streaming tests (TJ 10-27 spec drops an idle player). Reworking per TJ's answer.

## Next
- Keep no-games exclusion on the DROP chip only; restore planner/Best Fit/streaming orders; add the ownership/Protect
  drop-safety policy; audit display/ranking requirements; regressions.

## Gotchas
- Per-row source game is not in the bridge wire (WireRow has no slot); moved rows carry their run in revisionId and the
  shared note names source run+game.
- TJ pop-up answer: one drop-safety policy (Protect + ownership cutoff; unknown ownership never enough) on all four
  surfaces; no-games never a standalone DROP chip, concrete improving moves may drop an eligible idle player; display of
  ownership/net values; regressions incl. +7 streaming. Implemented library side: dropEligible ownership < 50 (existing
  HIGH_DEMAND_OWNERSHIP_PCT), lineupGaps excludes noGamesLeft, STREAMING_NO_DROP note. Fixtures: rostered/free-agent
  players get known 5% where ownership isn't under test; R7 tie tests use 40/5.
- Astra replay (HEAD vs patched, stored trace1 rows): 9/13 player-games borrowed b8da5fb9/f20889ee before; 13/13 own
  run+value after. tasks/artifacts/rso-reserve-drop-safety-2026-11-23/{astra-reserve-replay.json,README.md}.
- RC refs/rc/rso-reserve-drop-safety-20261123 = 7d4238279 on master 9ac6f4bcc (16 files). Prod READY
  dpl_Hbn2jb4XdfnKdiQetqNpzbxJ19NV on 9ac6f4bcc = rollback target. Gate running on clean export.
- Not done: UI display (ownership %, partial label) — superstyle lane's component files.
- Gates on RC 1d86d6c15 (rebuilt after fixing 2 TS errors in planning.test.ts): 2165/2166 (1000-player 13-day timing
  test timed out under load; alone 2.1 s RC vs 2.3–2.4 s master; planning.test.ts alone 195/195); eslint 0; typecheck 0.
  RC ref updated. Next: TJ decision on display work + release approval.
- TJ: display work → superstyle lane. Ticket sent to local_e6032136 (ownership %/remaining pts/AGP on drop surfaces, partial label, stale StreamingItinerary:142 text; no edits to RSO-lane hunks). Library candidate 1d86d6c15 unchanged, awaiting release decision.
- Superstyle lane will cherry-pick 1d86d6c15 into its worktree (9ac6f4bcc + 54f37d87f) as the display base, pending TJ OK. RSO lane owes it any new SHA if the candidate is rebased/replaced.
- Superstyle lane found 1d86d6c15 breaks components/RosterScheduleOptimizer/CandidateBrowser.integration.test.tsx (fixture
  ownership null → gate blocks every drop). Gate gap: gate.sh ran lib/ + __tests__/ only, not co-located component tests.
  Applied the lane's identical one-line fixture change (ownership: index < 2 ? 10 : null) so cherry-picks don't conflict;
  running full `npm run test:full` on the export. Lane also reports this week's /data has ownership for 0/1,065 players →
  with the gate, prod would show no DROP chip / automatic swap until ownership loads. Release-risk question for TJ.
- Candidate replaced: 1d86d6c15 → c4ddb44d7 (ref updated; parent 9ac6f4bcc; 17 files; only delta = lane's byte-identical
  CandidateBrowser fixture line). Full `vitest --run` on export: 66 fail = 65 identical on a 9ac6f4bcc export (export lacks
  root folders: cron/NST/FORGE receipt/BLSH scripts) + lib/nst/requestBudget load timeout (passes alone). planning.test.ts
  216/216 alone with requestBudget. eslint on changed test 0. Superstyle lane told new SHA. Local master ref is stale
  (5babd77c1, behind 9ac6f4bcc); not fetched. Next: TJ decision on empty-ownership release risk.
- TJ OK'd one read-only ownership check. yahoo_player_ownership_daily: latest ownership_date 2025-04-17, last updated_at
  2025-09-01; nothing in the last 30 days. Only loader is the manual lib/supabase/Upserts/Yahoo/yahooHistoricalOwnership.py;
  no cron/workflow schedules it. So with c4ddb44d7 as is, automatic drops would be off indefinitely, not briefly.
  Asked TJ: split (bridge + no-games chip rule now, hold the ownership gate) vs ship as is vs hold all.
- TJ: recheck ownership before deciding. Root cause = RSO read legacy yahoo_player_ownership_daily (2024-25 only) and
  joined bare player_id to a map that now carries full keys. Live history (yahoo_player_ownership_history, game 477)
  is written nightly. Fix: web/lib/rosterScheduleData/yahooOwnership.ts + planning.ts call; tests repointed + new
  regression. Real read: 569 known fresh, 0 known zero, 176 ≥50%. Candidate c868bdee3 (20 files) on 9ac6f4bcc, gating.
  Overlap: superstyle lane's unreleased 54f37d87f moved the same ownership block in rosterScheduleData/planning.ts
  (load-time prefetch) → it should call readYahooOwnership in its moved block. Producer not broken (no fix/backfill).
- Gate c868bdee3: 119 files / 2,334 tests, eslint 0, typecheck 0. Superstyle lane told new SHA + how to port its moved
  ownership block. Release plan in artifact README. Next: TJ release approval (fetch + recheck master first).
- RELEASED (TJ pop-up approval, prechecks passed): master 9ac6f4bcc → c868bdee3 at ~19:59Z. dpl_E1UnbKn7Frn4GpN8WoUGV3SvUD9g
  READY + 3 CANCELED. Mailbox: SLOT-REQUEST, HOLD, STATUS posted; DONE only after smoke. Smoke BLOCKED: Claude in
  Chrome not connected (3 tries). Rollback target dpl_Hbn2jb4XdfnKdiQetqNpzbxJ19NV. octoberBranch not synced yet.
- Smoke (2 of 5 used, stopped): load 1 = RSO in FHFH TJ — 2026-27 FHFH → "Yahoo authorization could not be loaded",
  retained roster, 0 NHL games each day, no planning data. A second RSO tab (…700) appeared in the MCP group at the same
  time. Runtime logs on dpl_E1Unb…: two provider POSTs at 20:10:11Z → 503 yahoo_oauth_unavailable and 503
  snapshot_unavailable. Load 2 = one Refresh → POST /provider 404 (team/league unavailable to account path). No ownership,
  drop, no-games, swap or reserve case exercised. Diff touches no Yahoo/OAuth/provider code; not treated as a release
  mismatch, no rollback. HOLD stays; DONE not posted. Needs TJ: close extra RSO tab, check Yahoo connection.
- INCIDENT (read-only diagnosis, 20:16Z): not Yahoo. Supabase PostgREST: burst of 57014 statement timeouts at 20:10:10Z
  across unrelated tables, then persistent 25P02 "current transaction is aborted" on pooled connections (209 in the 20Z
  hour, 0 in the prior 24 h). REST 5xx: ~0.5% before → 20% (20:10–20:15) → ~11% (20:15). The token RPC fails only when
  it lands on a poisoned connection → "Yahoo authorization could not be loaded". Timeouts already at 19:57/20:00 on
  player_baselines (pre-release, other lane). c868bdee3's new reads (yahoo_game_keys, ownership_history, map like.477)
  ran 20:09:54–55 and returned 200/206. Correlated in time with the release, not shown to be caused by it. Web rollback
  would not clear poisoned connections. Escalated to TJ.
- DB restart by TJ (~20:30Z, 522s); REST clean from 20:31Z. Smoke resumed: load 3 (one tab) → plan in ~132 s. Passed:
  19/19 roster ownership fresh; DROP chip Spurgeon 16%; drops offered Spurgeon 16 / Lekkerimäki 18 / Hill 49; Protected
  Batherson 94% + all ≥50% never offered; swaps render. Not exercised: known 0%, no-games standalone DROP, exact-game
  reserve on screen. DONE posted. Open: octoberBranch sync; DB incident root cause; slow /data (~110 s, superstyle owns load).
- octoberBranch synced locally (TJ "Sync it"): merge 3e173ff6b = bc23e04cc + c868bdee3 (plumbing merge-tree/commit-tree,
  update-ref guarded on bc23e04cc; index reset for the 20 paths only; other lanes' dirty files untouched). Branch is
  ahead 3 of origin (includes the sustainability lane's unpushed bc23e04cc). Not pushed: needs TJ per push-together rule.
- octoberBranch pushed (TJ "Push it"): 6f56b16f8 → 3e173ff6b at 20:55Z. Evidence previews stay off: newest preview is
  10-12; 6f56b16f8 push had no deployment. After 90 s: 0 GitHub statuses / 0 deployments for 3e173ff6b and bc23e04cc;
  no Vercel deployment since 20:55Z. Lane outcome recorded in tasks/artifacts/rso-reserve-drop-safety-2026-11-23/README.md.
  Still open (not this lane): 20:10Z DB incident root cause; /data ~110 s load (superstyle lane).
