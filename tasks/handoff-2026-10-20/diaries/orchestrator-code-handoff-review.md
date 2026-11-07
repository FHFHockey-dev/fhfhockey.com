# Orchestrator diary — "Code handoff review and project recommendation"

Session `local_08a0bf1c-fda1-4d08-9f56-8ff961d00e41` (created 2026-10-17; Opus 5.5, xhigh). Written by the session itself on 2026-10-20 ~15:10Z.

## 1. Scope / role
- **Top orchestrator for TJ since 10-17.** I started most linked sessions, including the Chef (`local_4317ea20`, release owner and FORGE pipeline lead) and the A-xx/S-xx sprint workers. I relayed approvals, triaged their reports and decided what goes to which session.
- **Hands-on RSO (Roster Schedule Optimizer) owner since 10-19:**
  - interim FORGE daily bridge;
  - RSO visual pass (by-position grid, navbar, bench days);
  - planner fixes;
  - the RSO port to master (R6c).
- **TJ's 10-19 goal** ("working daily projections by 7pm ET; working RSO and Start Chart") was met:
  - FORGE run `8a3bb848` for 10-19 served same-day;
  - Start Chart returned 200;
  - RSO went live in R6c at 22:30Z (18:30 ET).

## 2. Where
- **Repo:** `/Users/tim/Code/fhfhockey.com`, the sole editing checkout, on `octoberBranch` (AGENTS.md). `master` = production/release.
- **My octoberBranch commits:**

  | Commit | Change |
  |---|---|
  | `67e50ee4e` | Bridge plus RSO UI |
  | `317375364` | Lineup goal |
  | `ed949622d` | Bench days collapsible, IR/O players not lined up or auto-dropped, reserve moves only into open slots, goalie win estimate |
  | `a855c9fe6` | Started-game lineup lock |
  | `79d3b792f` | Bridge PP-blank → 0 only when PP TOI ≤ 6 s |
  | `0654fafc4` | Compact bridge wire |

  `b401c5f53` (save-size packing) was written by the keep-rso-saves session.
- **Release candidates I built:**
  - R6c `707f60e83`, record: `tasks/artifacts/release-r6-2026-10-19/R6C-CANDIDATE.md`;
  - R6e `2a74489af`, held and superseded by R6f.

  Method: temp `GIT_INDEX_FILE` + `commit-tree` on master. Gates run on an exported tree in a throwaway `git init`.
- **Key code:**
  - `web/lib/rosterScheduleData/forgeDailyBridge.ts`, `bridgeForecastWire.ts`;
  - `web/lib/rosterScheduleOptimizer/planning.ts`, `lineupGaps.ts`, `candidatePlanMetrics.ts`;
  - `web/components/RosterScheduleOptimizer/*`;
  - routes `web/pages/api/v1/roster-schedule-optimizer/{data,provider,workspace}.ts`.
- **Private:** TJ's RSO planning-evidence export lives only in my scratchpad. Never commit it.

## 3. State (as of 2026-10-20 ~15:10Z)
- **Production master `b630e0767` = R6f.** The release line:

  | Release | Commit | Contents |
  |---|---|---|
  | R6a | `3755308fa` | Per-game resume; team-context sign fix |
  | R6c | `707f60e83` | RSO on master contracts (legacy + bridge only); Yahoo `min_games_played` goalie minimum |
  | R6d | `ccfe5e57b` | Started-game lock; PP-blank fix; rolling season-from-date guard |
  | R6f | `b630e0767` | Compact wire + snapshot packing |

  R6e was never pushed.
- **R6f smoke:** the data route went from 2.43 MB to 1.01 MB (1,283 rows, compact). **NOT verified:** account workspace save/load in a signed-in browser.
- **octoberBranch `392c02af2`** is synced with master (merge). It includes TJ's checkpoint `b8fe1072e`: 774 files of multi-session WIP, unreviewed. My pattern-based secret scan found nothing real. 16 local uncommitted paths remain (other sessions').
- **Production data:**
  - hits/blocks rolling recompute done (214 players, 7,460 rows, 0 mismatches);
  - matview `opponent_skater_allowed_by_position` (migration `20261019211444`) applied, refresh cron `42 9 * * *` active.
- **Scheduled tasks on TJ's Mac:**
  - `forge-projection-fallback-20261020` DISABLED;
  - `forge-daily-live-20261020` ran 10-19 11:50Z; publish was held on `native_target_scope_mismatch`.
- **Bridge coverage (10-19 data):** 420 of 1,007 players had projections.
  - **Cause:** the 10-13..10-19 FORGE runs were made locally from octoberBranch code (git_sha null). That code writes null PP heads when PP evidence is missing (`skater-adjustments.ts` ~626).
  - **Effect:** 151 skaters with PP time but no PP line, plus 115 with blank ES heads, still get no forecast. The PP fix rescued only 19.
  - **Expectation:** production (master) runs write full heads, so coverage should heal as teams play from 10-20. UNVERIFIED; check the data route's limitation lines.

## 4. Next (my queue, now for the next orchestrator)
1. **Verify the 10-20 production FORGE run** (pipeline cron 10:05–10:55Z with resume): check `forge_runs` for 2026-10-20 status/git_sha. Then check that bridge coverage grew; read the `/data` limitation lines "N skaters have projected power-play time…".
2. **Fix Codex audit items in my area** (`FHFH-TASKLIST` R1–R3); all three are real:
   - **R2 (my regression):** `ed949622d`'s OUT_INJURY skip in `prepareEvaluation` drops an injured player's play even when a provider lock holds him in an active slot. The slot frees and another player is assigned. Keep locked occupancy; exclude only contribution.
   - **R1:** `planningTimeline.ts:66–75` lets drop/reserve steps after puck drop; daily locks should run to the next league-local midnight. `a855c9fe6` only fixed assignment/occupancy, not step legality.
   - **R3:** `lineupGaps.ts` DROP chip lacks the injured/no-auto-drop predicate the planner uses.
3. **Browser-check R6f** account save/load (signed in), and the RSO grid during a live game (started-game lock).
4. **Real-account RSO acceptance** with a new dated window (REGISTER #24/#27; the 10-12..18 window expired).

## 5. Blocked / needs TJ
- **RSO daily schedule-refresh cron line** (`web/vercel.json`): needs operational approval after D3 (timeout cancellation).
- **WGO season-label repair:** held. 253,257 rows have null game_id/team_abbrev and can't match games. The exact fix for the 105 1959/1967 rows awaits a go.
- **Native publish (N1):** after the freeze (10-20 17:00Z) the Chef integrates the target-scope patch. Publish, CAS and env changes are separate approvals.
- **Next release scope:** F2 null-win port, then R1–R3.

## 6. Insights / rules the next orchestrator must keep
- **Never merge octoberBranch into master.** Its native admission contracts (`consumerRevisionAdmission`, `issuedContext` ISO hash, `gameRevisions`…) would make Start Chart admit no games.
  - Port to master by building a temp-index commit on master.
  - Gate it on an exported tree: symlink `web/node_modules`, include `supabase/`, `migrations/`, `sql/` (migration tests read them), and compare full Vitest against a pristine master export.
- **Push procedure (memory: push-octoberbranch-together):**
  1. TJ's go (the "Send it"/"SKO" slang = approve the proposed action only).
  2. Check that all 4 Vercel projects have previews off and production branch master.
  3. Record the latest deployments, push, wait ~90 s.
  4. Confirm no deployments, statuses or check runs.

  Master pushes give 1 web build + 3 CANCELED.
- **Production writes and master pushes:** the Chef and data sessions require TJ's go given *directly in their own session*; relayed approvals are refused (correctly).
- **Messaging:** the app caps a session at 10 cross-session messages per user turn. Send tickets one at a time and keep them under ~2,000 chars.
- **Bridge size budgets:** a compact-wire budget alone lets expanded snapshots exceed Vercel's 4.5 MB request/response limit and ~5 MB browser storage. R6f packs at every boundary and caps rebuilt size at 4 MB.
- **CSS Modules pure mode:** impure selectors break `next build` while Vitest passes. Run the pure check (sass + postcss-modules-local-by-default pure).
- **FORGE data facts:**
  - `nhl_team_data` has 3 rows per team/date;
  - the `teamGoalsForPctAdjustment` sign bug was fixed in R6a;
  - FORGE `proj_win_prob` is rarely filled (1/102), so the bridge estimates wins via a Poisson model on xG;
  - goalie IFTTT news overrides start shares.
- **Planner semantics:**
  - started (non-final) games today are now locked display rows, not planned or valued;
  - activeGames counts only remaining games;
  - weekly-lineup mode is untouched.
- **Old diaries:** `tasks/sprint-2026-10-18/*`, `tasks/artifacts/release-r6-2026-10-19/PLAN.md`, Chef register `tasks/sprint-2026-10-18/CHEF-REGISTER-2026-10-19.md`.
- **Memory index:** `~/.claude/projects/-Users-tim-Code-fhfhockey-com/memory/MEMORY.md` (push procedure, approval slang, CSS pure selectors, battery, no-GIT_DIR, message limits).
