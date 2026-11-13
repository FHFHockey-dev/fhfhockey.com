# Math-audit fix sprint: debrief

Status: **Sprint closed, 2026-11-13.**
- **Closure:** no P0 or P1 is open. Releases through #438 are live, and Astra's audit and all its addenda are complete. Astra's A3 recheck passed both findings at `5fbb2d3a2`.
- **Penalty shots and power v4:** penalty shots are verified end to end for the 8 games; power v4 is rebuilt and verified.
- **Two scheduled production checks pending (2026-11-14).** These are post-release checks, not unfinished fixes:
  1. the first scheduled FORGE reserve rows, from the 10:05Z run;
  2. cron 283's first scheduled v4 power write, at 10:15Z (05:15 ET).
- **Separate tickets, not sprint blockers:**
  - **PP share** stays withheld pending two owner decisions: whether to accept the NHL Penalty Summary as the official reference for 5 games, and whether to rebuild the 14 affected games' stored `powerPlayCombinations` or compute the share from shifts and qualified intervals.
  - **Codex:**
    - items 1, 2 and 6; item 6 needs its reader fixes before its migration;
    - the model studies: the shared goalie baseline fix and xG v2 scoping can start now, and the goalie/starter refits and the Week Score off-night study follow.
  - **CTPI prediction:** needs more completed games (checkpoints at games 20, 30 and 40). The descriptive Recent Team Form beta is already live.
- **Records:** the local record commits ride with the next release.

Chef: the Claude fix-sprint Chef session (Opus). Lanes ran as Opus sessions, one per lane, in the sole checkout `octoberBranch`, with exact file ownership. Every production action had TJ's own pop-up approval.

## 1. Summary
- **Scope:** findings from the three-wave math audit: 35 packets, 1,358 calculations, Fable audits peer-reviewed by Codex "Astra", and owner decisions 1–151 (83–151 were decided during the sprint).
- **Lanes:**
  - 25 lanes plus sub-lanes: L1–L22, L4a/L4b and L9a/L9b/L9c, with sub-lanes L2-landing, L5a, L5b, L9a-markets, L10b, L13b and L22-UI.
  - Follow-up lanes F1–F17 on 2026-11-13, F12–F15 answering Astra's checkpoint 1.
  - Codex dev items 3, 5, 7, 8 and 9 were integrated; items 1, 2 and 6 are held by Codex.
- **P0 coverage (45 total), after releases #434 and #435 and Astra's checkpoint 1 and #434 addendum:**
  - 40 fixed in code. W1 #14, #18 and #20 moved to fixed on 2026-11-13; Astra closed AF-01 (#20) in both RSO readers.
  - 5 are partly fixed (§5):
    - W1 #16: starter refit, Codex;
    - W1 #17: writer is Codex item 1, held;
    - W1 #21: multiplier neutral until validated, decision 148;
    - W1 #27: R3 no-history stays unknown;
    - W3-P0-1.
  - None is left unaddressed.
- **Releases on 2026-11-13:**
  - #432 (`e1ab46318`);
  - #433 (`4d9b6a10d`; migrations 144–146);
  - #434 (`496ab3766`; Astra fixes, F5–F15, Codex items);
  - #435 (`6f1cb0767`; version-aware power labels, writer dry run, CTPI beta card).
  - #436 (`4b45d8f1a`; social rankings missing-vs-zero, batched Lines reader, PP clock C1/C2).
  - #437 (`b6d43efdc`; penalty-shot split with parity, NST alias fix, CTPI beta same-games label; migration 148 applied before);
  - #438 (`ed2002161`; team summaries count penalty shots; read-only team diff).

  Each release was gated in a clean export, built once with three cancels, and passed a 5-GET smoke.
- **Production on 2026-11-13** (§3, `production/PRODUCTION-QUEUE.md`):
  - the 2026-27 rolling recompute and the 2025-26 goalie rebuild;
  - indexes 123/124 and migrations 101 and 142–146;
  - power ratings v3, then v4 (1,425 v4 rows plus 47 labelled legacy carries);
  - xG champion retired; composites v3, rankings, team_unit_toi and trend bands;
  - game state, CTPI v2 (gated) and SOS v2 backfills.
  - the penalty-shot split (migration 148, 8-game derived rebuild, player/goalie and team summary refreshes, served landing verified);
  - the F18 data repairs (14 WGO identity rows, Mahura NST re-fetch).
- **Astra:**
  - The frozen #433 audit is **complete**. The final report is `astra/ASTRA-FIX-SPRINT-AUDIT-checkpoint-1-2026-11-13.md` (byte-identical to Astra's final file). It found one P0, AF-01, now closed. Its later social-rankings finding is being fixed by lane F17.
  - The #434 addendum is **complete**: no new P0, and two P1s on power v4, fixed in #435 and the gated rebuild.
  - The #435 addendum is **complete**: the F16 label P1 is closed and the rebuild receipts reconcile (1,425 v4 + 47 legacy). Its two P2s (CTPI "same games", runner cron guard) were fixed in #436–#438, and addendum 3 closed both.
  - Addendum 3 (#436–#438) is **complete** (`astra/ASTRA-FIX-SPRINT-AUDIT-ADDENDUM-436-438-2026-11-13.md`): application changes accepted, no P0/P1, no rollback or rerun. Two operational P2s:
    - A3-01, the landing verifier could print ALL_OK with wrong ES or missing goalie fields: **closed.** The strict `verify-landing-strict.py` passed its offline self-test (Astra's false-pass case fails for all 8 games), then a TJ-approved 24-GET rerun returned ALL_OK with raw responses kept.
    - A3-02, the resumed summary runner overwrote the canary's before snapshot: **closed locally.** F15's runner fixes and resume tests cover all three runners, plus the team runner's stop-before-write gates (33 tests). No production rerun.
    - Astra's independent recheck, run offline at `5fbb2d3a2`: **both PASS** (`astra/ASTRA-RECHECK-A3-2026-11-13.md`). The canary's original ES baseline is still lost; its ES-unchanged evidence is the original recorded readback.
- **Integration gate:** clean `git archive` export of `496b5c9de`.
  - Vitest: 19,122 passed, 0 failed (1,391 files).
  - Typecheck: passed.
  - ESLint, 715 changed files: 0 errors.
  - CSS Modules pure check: 6 of 6 passed.
  - pytest: 213 passed, plus 4 git-history tests that pass in the full checkout (217 of 217).
  - The first gate run caught three cross-lane test breaks; they were fixed in `b6336a5d8` (L12), `e2a18e4ec` (L22) and `496b5c9de` (L9a).
- **Release:**
  - PR #430 (squash) is master `631a00c19`. Its tree matches candidate `27edf8381` exactly: octoberBranch `74c85b556` without the lane diaries.
  - Vercel: one fhfhockey build READY (`dpl_137qFEpUhovkj9Q6NaPbD4jAHNzP`), three cancels.
  - Smoke: 5 of 5 GETs returned 200.
  - octoberBranch synced as `c577225e2`, with no build.
- **Follow-up release:** PR #431 (squash) is master `502a93b4c`, with tree equal to candidate `981953daa`. It carries the flag release, decisions 136–143 and the adopted Codex areas 5–11. Gate: typecheck 0 and ESLint 0 errors. Vitest's only failures were environment-only, or already failing on master `4243bcd4e`.
- **Production incident:** on 2026-11-12 between 15:43 and 15:50Z, production Postgres hung and then crash-recovered under the strength re-normalization load (§4.3).

## 2. Release state
| Item | State |
|---|---|
| master | `496ab3766` (PR #434, 2026-11-13 15:56Z). Before it: `4d9b6a10d` (#433), `e1ab46318` (#432), `502a93b4c` (#431), Codex `4243bcd4e` and `866b90bc4`, then the sprint release `631a00c19` (#430). |
| PR #434 contents | Astra checkpoint 1 responses: AF-01 (both RSO readers), AF-02 to AF-06, AF-07 adapter, AF-08. Lanes F5 to F15. Codex dev items 3, 5, 7, 8, 9. The sKO read API gate (decision 124). Held: Codex items 1, 2, 6 and the CTPI beta card. No migrations. |
| PR #433 contents | F1 CTPI v2 writer (gated); F2 and F2b SOS v2; F3 Lines 5v5; F4 stored game finality; W2-3 D13; migrations 144–146 applied before the merge. |
| Deployed | #434: fhfhockey production deployment completed 16:01:05Z (GitHub deployment 7769867793). #433: completed 13:31:56Z (7766487447). Each time cms-fhfhockey, functions-fhfhockey and fhfhockey.com were canceled by the Ignored Build Step. `FORGE_RESERVE_PASS_ENABLED=true` was set by TJ before the #433 merge. |
| octoberBranch | Synced to master `496ab3766` by an ours-merge, `94d7c2340` (tree unchanged; no build). |
| Excluded from releases | Lane diaries. |

## 3. Production actions taken (each with TJ's pop-up)
| When (UTC, 2026-11-12) | Action | Receipt |
|---|---|---|
| sprint | Migration 88 (`20261020211500`) and 137 (`20261112090000`) | `476b93257`, `1244512f9` |
| ~14:20–14:35 | Migrations 125–136 and 138–140, each applied singly via the session pooler and read back | `d08318dce`, `7c3116717`, `82f643878`, `74c85b556`; readbacks in `migration-authority.json` |
| 14:41 | Release branch pushed: no build, no checks at 98 s | PR #430 |
| 14:48 | PR #430 merged; build READY plus 3 cancels | §2 |
| 15:01–15:08 | Goalie summary rebuild 2026-27 (decision 111): 44 date calls, 298/298 games at formulaRevision 2, 14,094 partitions, 0 stale | `production/GOALIE-REBUILD-2026-27-PLAN.md` |
| 15:0x | Migration 141 (goalie season view, regular season only): 5v5 GAA coverage 73 → 97 of 98 goalie-seasons | `1aa886c92` |
| 15:09–15:10 | Smoke, 5 sequential GETs: all 200 | §2 |
| 15:10 | octoberBranch ours-merge pushed: no build at 103 s | `c577225e2` |
| 15:35–15:46 | Strength v2 re-normalization, windowed: 146 games, then the **incident** (§4.3) | `PRODUCTION-QUEUE.md` incident section |
| 15:54–19:35 | Strength v2 re-normalization, slow single-game phases A–E (TJ re-approved after the crash was disclosed). All **298/298** 2026-27 games at v2, complete. | `HEADS-CHANGED-2026-11-12.tsv`; handoff 2 |
| 18:22; 19:18–19:2x | 11 OT games recovered from **official HTML** shift reports. NHL JSON was dropping one team's OT shifts; each game was qualified for identity, overlaps, coverage, ES skater TOI and GS goalie TOI. One new raw snapshot each; JSON snapshots kept. | `production/GAME-2026020159-RECOVERY-PLAN.md` |
| 19:36–19:43 | (Codex) Trends six-row repair; Goalie Grid names-first release `4243bcd4e` | Codex mailbox |
| 20:03–20:28 | Summary refresh (serial step 4): team 41,720 rows (0 stale), player 43,764 partition rows, goalie 298/298 at rev 2 | handoff 3 |
| 21:05–23:25 | (Codex) DRM step 5: 296 games repaired, 2 current. Game-57 HTML source exception, TJ-approved. | Codex `drm-ddatv-2026-11-12/production/step5/` |
| 23:50 | pg_cron job 327 `update-predictions-sko` paused (decision 129); `goalie_totals_unified_snapshot` refreshed (402 → 476 rows) | `PRODUCTION-QUEUE.md` |
| 2026-11-13 00:0x–00:50 | 2025-26 goalie partition rebuild (summary-only), TJ-approved. 213 calls, 0 failed. 1,394 played games and 65,164 partitions, all at formulaRevision 2. A false stop at 2026-04-27 came from unplayed "if necessary" playoff games (23 in the schedule, no raw payloads); the run resumed on played games only. | `PRODUCTION-QUEUE.md` |
| 2026-11-13 00:25 | Production alias restored from Codex's temporary H1 CLI deployment to `dpl_HH8SPE1cLyonVBW9uN3rUi1MN3Sa` (promote, no build); healthz 200 | `PRODUCTION-QUEUE.md` |
| 2026-11-13 00:35–00:37 | Release #431: branch pushed (no build at ~90 s), PR squash-merged as master `502a93b4c` (tree = candidate `981953daa`) | §2 |
| 2026-11-13 00:41–00:49 | Release #431 build READY and auto-aliased (1 build + 3 cancels). Smoke 5/5 at 200. octoberBranch ours-merge `b69cbd375` pushed; no build. | §2 |
| 2026-11-13 00:50 | pg_cron 305 `build-forge-derived-v2` moved 10:05 → 10:25 UTC (off the rolling-forge pipeline's minutes) | `8942d193b` |
| 2026-11-13 00:51 | Migrations 142 (v2_skill) and 143 (team-of-record percent_games) applied singly and read back | `db8693805` |
| 2026-11-13 01:12–03:57 | 2026-27 rolling recompute (L6 fixes), TJ-approved. Slow sequential calls, all 200. 764 skaters; 10,727 rows per strength through 11-11; game dates 11-07 and 11-09–11 filled. Paused twice on its own guards. | `production/FORGE-INPUTS-PLAN-2026-11-13.md` |
| 2026-11-13 01:30–01:42 | (Codex) Goalie H1 for game 2026020308 (TJ-authorized), on temporary deployment `dpl_CarX` built from 502a93b4c; production restored | `tasks/artifacts/goalie-h1-2026-11-13/HANDBACK.md` |
| 2026-11-13 01:47–01:55 | Release #432: pipeline stall fix and Codex areas 2–4. Master `e1ab46318`; 1 build + 3 cancels. | §2 |
| 2026-11-13 01:55–02:00 | **DB incident 2:** Postgres froze after a checkpoint started and self-restarted at 02:00:46. TJ restarted it again from the dashboard at 02:08:28. Smoke passed afterwards. | `PRODUCTION-QUEUE.md` |
| 2026-11-13 05:39 | Migration 101 (`forge_reserve_projections` table) applied; the env flag ships with the next release (TJ "Table now, flag next release") | `043f71f9c` |
| 2026-11-13 06:57–07:02 | Index 124 (2 s) and index 123 (concurrent, 37 s on the 2.2 GB `wgo_skater_stats`), both valid; power ratings v3 recompute, 45 one-day calls, 1,440 rows; xG champion `cfg9bac2706` retired with a registry backup and 3 reader checks (decision 5) | `2990aef75` |
| 2026-11-13 07:03–07:08 | Dry runs (rankings, composites, team_unit_toi, trend bands); composites v3 published (764 rows; BEAST+ 2, BEAST 24, MCM 53, Watch 63); rankings written (50,320); `team_unit_toi` snapshot 2026-11-13 (299 games; 13 partial, labelled, from goalie-shift gaps) | `0ec520c28` |
| 2026-11-13 11:01 | Pipeline check: all 11 stages complete by 10:46; stage 2 at 10:07:53 (stall fix held); FORGE runs for 11-13..11-15; rolling 396 rows per strength for 11-12. WiGO cron 231: 988/990 players in 111 s, 2 rejected for missing WGO identity. NST gamelog: one unmatched player (Josh Mahura), 16 of 20 datasets flagged, data for 395 players landed. | `546b24442` |
| 2026-11-13 11:41–13:16 | Trend-band history rebuild 2026-27 (decision 36; TJ "Later, paced"): 77 calls of 10 players, 60 s gaps, all 200, max 9.5 s; 769 players, 666,376 bands | `production/trend-bands-2026-11-13/` |
| 2026-11-13 13:16 | Migrations 144 (CTPI v2 publication), 145 (`team_sos_daily`; `sos_standings` frozen) and 146 (games game state) applied singly, each read back | `cd5604159` |
| 2026-11-13 13:25–13:32 | Release #433: branch pushed (no build at 95 s), PR squash-merged as master `4d9b6a10d` (tree = candidate `359789456`); 1 build + 3 cancels, watched through GitHub statuses. Smoke 5/5 at 200. | §2 |
| 2026-11-13 13:33–13:34 | Post-release runs, all 200: `update-games` (1,409 games with a stored state); CTPI v2 backfill (1,102 candidate rows, 10-07 → 11-13; v1 unchanged); `update-team-sos` (32 v2 rows, 84 fixtures per team) | `production/PRODUCTION-QUEUE.md` |
| 2026-11-13 14:47 | Legacy-route request-log check (decisions 79, 124): 0 requests in the last day on all four routes (read-only, TJ's dashboard). sKO read API gated (TJ "Gate it tonight"). | `08fe51d9e`, `aae1d7c93` |
| 2026-11-13 15:54–16:02 | Release #434 (TJ "Push and merge"): branch pushed (no build at 90 s), squash-merged as master `496ab3766` (tree = candidate `01ed7f7bc`). 1 build plus 3 cancels. Smoke 5/5 as expected. octoberBranch `94d7c2340`, no build. | §2 |

Coordination: steps 1–6 ran serially with Codex under a TJ-approved order (mailbox entries `CLAUDE-FIX-SPRINT-SERIAL-ORDER-20261112` and onward), each with an explicit DB handoff.

## 4. Cross-lane checks
### 4.1 Integration gate (clean export)
The first run, at `ca06cbf6c`, found three test files that lanes changed outside their own test lists:
- `statsGame.test.tsx` (L22 heading), now with stronger fixtures: upcoming games exercise the parser, and the 2.0/3.0 book is rejected.
- `lib/NHL/client/index.test.tsx` (L12 decision 64, odds-free key).
- `qualify-native-players-offline.test.ts` (L9a's new column reads: 29 tests, one root cause).

The re-run at `496b5c9de` was clean, apart from the expected git-history pins. The `planning.test.ts` 1000-player benchmark is a load flake: it passes when run alone.

### 4.2 Release-together sets, each verified before merge
- **Migration 134 before L1's game-stats writer (`3e6562f9a`):** applied first. Without it, every game's skater rows are rejected.
- **Migration 136 before the L4b radar:** applied.
- **Migration 139 before the L15 writer:** applied.
- **Migration 129 with the L9a/L11 readers**, which are shape-tolerant: applied.
- **L9c if-plays lines:**
  - L11 bridge `630456546` and L12 `81b896fd7`/`baaa0bac2` shipped.
  - Codex is now adding the Start Chart availability labels (CODEX-GOALIE-GRID-START-CHART-DEPENDENCY-20261112).
  - The FORGE run that writes the if-plays lines must wait for those labels (queue step 10).
- **FORGE band reader inert (`2c6b96176`):** this **changed live FORGE output**. The audit thought the reader was inert, but it was applying momentum of about ±14% and widening bands up to 1.55×. It can be re-enabled only with a fitted regression size (decision 26).

### 4.3 Incident: database hang and crash recovery during re-normalization
**Timeline:**
- The first plan used date windows of 13–25 games, 10 s apart, with a guard that counted active queries only.
- Seconds per game rose from about 2.6 to more than 6.6.
- A checkpoint took 270 s to write at 15:42Z.
- From 15:44Z, REST returned 522 and 5xx errors, and the pooler couldn't check out connections (`ECHECKOUTTIMEOUT`).
- Postgres logs are silent from 15:43 to 15:50. The database then crash-recovered and was up at 15:50:06Z ("redo done", end-of-recovery checkpoint).

**State after recovery:** each game's normalization is atomic, so no game was left half-written. 146 games were at v2 and 152 at v1.

**Lesson:** guard on I/O pressure and call latency, not on active-query count. The slow run uses single games 60 s apart, a probe-latency check (under 1 s), no query over 5 s, no I/O or lock waits, and no forced checkpoint. It stops on any call over 15 s. Its first 5 games took 1.7–3.1 s each and wrote about 3 MB of WAL each.

**Open:** the root cause is likely memory or I/O exhaustion from large concurrent payload upserts and normalization RPCs. It isn't proven: we have no host metrics. Check the Supabase dashboard's resource graphs for 15:40–15:50Z.

## 5. P0 coverage
### Wave 1
| # | Defect | Lane | Status |
|---|---|---|---|
| 1 | Leaky xG champion cfg9bac2706 | L14 | Code fixed (registry pin, selector, gate). **Retired** 2026-11-13 07:01Z with a registry backup (decision 5). No in-house xG model is active until a v2 model is approved. |
| 2 | Bucket-heuristic xG on underlying stats | L2, L14 | Display retired. Parity and the team writer still compute it, hidden (accepted). |
| 3 | Team shot map mirrored | L14 | Fixed |
| 4 | Score-state filters empty | L1, L2 | Fixed. Player and team summaries are rebuilt in queue 2. |
| 5 | GSAA = heuristic xGA − GA | L2-landing | Fixed; goalie partitions rebuilt |
| 6 | Penalty classes | L1 | Fixed |
| 7 | HD/SC/rush carry NST names | L1 | Fixed: declared FHFH house definitions; parity rush follows NST options |
| 8 | Radar cohort | L4b | Fixed; migration 136 applied. WiGO rebuild in queue 9. |
| 9 | Rolling /60 fallback 60× | L6 | Fixed. Stored rows are rebuilt in queue 5. |
| 10 | Results luck reads a rate as a count | L6, L5 | Fixed; needs the rolling rebuild (queue 5) |
| 11 | Trend page scales and empty calendar views | L6 | Fixed; player-trend v3 rebuild in queue 5 |
| 12 | Power ratings standardised against the slate | L12 | Fixed; v3 recompute in queue 7. The prior min(1, GP/10) is unfitted (decision 125). |
| 13 | PP/PK tiers from one game | L12 | Fixed; recompute in queue 7 |
| 14 | Game Grid win odds | L12, F6 | **Fixed (#434).** The data path withholds odds (L12). F6 `9b51a17ea` labels each cell "Odds n/a: Model odds unavailable"; `9b97c4656` fixes the transposed cell's away team. Astra's #434 addendum: supported. |
| 15 | Top Adds NaN | L12 | Fixed (expected points, decision 118/132) |
| 16 | Starter probability over-confident | L9b | **Partly.** Credited start, cutoffs, closed vector and unknown rest are fixed. The refit isn't run (plan `L9b-starter-refit-plan.md`). The accuracy job is a Codex proposal. |
| 17 | Start Chart raw L10 share (conditional) | L9b, Codex dev | **Partly.** Labelled "L10 start share". The writer fix (`update-goalie-projections-v2.ts`) is Codex dev item 1 on 2026-11-13. Astra confirmed partial and noted the RSO bridge as another L10 consumer (AF-01, F12). |
| 18 | PK bucket omitted | L9a, F7, Codex 3 | **Fixed (#434).** The writer adds PK heads; readers admit them version-aware (F7 `369e00828`, AF-05); the goalie stage adds known opponent PK shots (Codex `cd67fb728`). Astra's #434 addendum: supported. |
| 19 | Hits/blocks count PK twice | L9a | Fixed; FORGE rerun |
| 20 | Goalie row is the team slot | L9b, F12 | **Fixed (#434).** Astra disputed it at #433 (AF-01, P0). F12 `738191ecf`, `a275d0ec7`, `6873c28ce` move the RSO bridge and the later-impact inputs to `forge_goalie_candidates_v1`. Astra's #434 addendum: "Closed in #434 code and focused tests". |
| 21 | Opponent-goalie .900 | L9a, F13 | **Partly fixed.** The independent posterior is in. Null goals-against is dropped, never 0, and the multiplier is neutral until validated (decision 148), F13 `0eaa1f5b4` in #434. The held-out study is Codex goalie-model work. |
| 22 | Power Terminal | L12 | Fixed |
| 23 | Trend-band TOI 60× | L7 | Fixed; band rebuild in queue 6 |
| 24 | Sandbox band status | L7 | Fixed (usual range `validated:false`) |
| 25 | /charts career averages | L7 | Fixed |
| 26 | Streaming rank blend | L11 | Fixed |
| 27 | No-line players as known zeros | L11, L9c | Consumer fixed (L11). Root cause **partly**: R2, R4, R5 and R6 fixed. R1 needs the reserve migration (authority 101) and FORGE_RESERVE_PASS_ENABLED (queue 11). R3 (no NHL history) stays unknown. |
| 28 | Goalie losses = 1 − W | L11 | Fixed. L/OTL stay unknown until a fitted split exists (decision 46). |
| 29 | Pickup boost scales −100 | L12 | Fixed |
| 30 | Category z-score attenuation | L13 | Fixed |

### Wave 2
| # | Lane | Status |
|---|---|---|
| W2-P0-1 NST season views | L4a | Fixed: migration 125 applied (McDavid GP 99 → 67) |
| W2-P0-2 home-first strength_exact | L1, L2 | Fixed. Summaries are rebuilt in queue 2. |
| W2-P0-3 goalie MD/LD GA twice | L2-landing | Fixed; goalie partitions rebuilt |
| W2-P0-4 skater strength filters show PK | L2-landing | Fixed. Player summaries are rebuilt in queue 2. |
| W2-P0-5 team score-state TOI | L2 | Fixed. Team summaries are rebuilt in queue 2. |
| W2-P0-6 landing PP%/PK% | L2 | Fixed |
| W2-P0-7 nulls first | L2 | Fixed |
| W2-P0-8 variance CF/60 | L3 | Fixed: pooled iCF/60. The 5v5 basis is unverified, so it is labelled with its source. |
| W2-P0-9 goalie matrix GSAA/60 | L5a, L4a | Fixed (L5a, plus migrations 135 and 141) |
| W2-P0-10 team matrix heuristic xG | L5b | Fixed (NST 5v5 only) |
| W2-P0-11 last-N per-60 labelled as goals | L5, L6 | Fixed; needs the rolling rebuild |
| W2-P0-12 line-card goalie | L8 | Fixed |
| W2-P0-13 /api/toi PP share | L8 | Fixed: withheld until the PP clock is qualified |
| W2-P0-14 draft VONA (conditional) | L13 | Fixed (decision 76) |

### Wave 3
| # | Lane | Status |
|---|---|---|
| W3-P0-1 stats-page rates and shares | L17 | **Partly.** Rates and NST shares are pooled. The four WGO shares show for single games only; pooling them needs a verified SAT basis. |

## 6. Per-lane results
For each lane: its commits, then its findings and their outcomes (finding IDs as in the brief), its tests, and what's left. Production steps for all lanes are in `production/PRODUCTION-QUEUE.md`.

### L1: event state, parity, PBP
**Commits:** `cb28ffc58`, `3e6562f9a`, `72e78b3d1`, `765e6f71c`.

**Fixed:**
- W2-2 D1 / W2-3 D1.
- W1 P0 #4 (parity), #6 and #7 (house definitions).
- PR-U3 / W2-3 A1.
- W2-7 D1: decision 84 (EN is the opponent's empty net), shootout goals aren't goals, and decision 83 nulls.
- BA W1-2 B: D8 boundary fixtures (two guard cases pass both before and after), PDO scale, miss-reason map v2.
- W2-2 D11.

**Out of scope:** W3-3 D5 (L16).

**Tests:** 171 files / 2,107 passed; Upserts 388/388.

**Left:**
- Codex: the team `powerPlayToi` "00:00" default and the goalie '0/0' placeholder need nullable support in Codex files.
- `season.py` EV_TOI `greatest()` reads nulls as 0.
- Parity still computes bucket xG (hidden).
- The xG rush window stays at 10 s.
- Unverified: house labels on L4b surfaces.

### L4a: NST SQL views and migrations
**Commits:**
- `11589483b`: F1 quarantine.
- `04d2dfd82`: migrations 125–132.
- `f36c85e88`: 133.
- `e24ec520d`.
- `f066be4ce`: 134.
- `ddf9c1669`: 135.
- `01fbee34c`: 136.
- `9fb3c5a91`: 137.
- `77bc8e6f8`: 138.
- `16c5c095a`: 139.
- `049ca206b`: 140.
- `730242f62`: 141.

**Fixed:**
- W2-P0-1 and W2-1 F1.
- D3 / PR-SQL-3; D4 / PR-SQL-2 / F3.
- D6 (comment; label by L4b), D7, D8, D9, D11, D14.
- D16 (inventory only).
- BA W1-2 B (row 120 note).

**Partly fixed:**
- PR-SQL-1: the materialized-view half is deferred.
- D12: an interim fail-closed fix; the decision-16 denominator is still open.

**Deferred:** D10 (materialized view, no reader), D13 (to L7), W3-7 D9/A5 (no caller).

**Declined:** D15 / M-SUS-001 (withdrawn).

**Tests:** update-nst-gamelog 108/108. Eleven disposable-PG proofs, each with a rollback; all exit 0.

**Left:**
- D7: players with no PP-unit game have no 0% row.
- The `nst_seasonlong_combined_*` views still zero-fill.
- `percentile-rank.ts` returns zeros for a player with no games.
- `LineCombinations/utilities.ts` counts a missing outcome as a win.
- The migration-139 rollback refuses once a NULL exists.

### L6: rolling averages and trends
**Commits:** `6b2023387`, `f7ab9bca9`, `522feb4db`, `e00e2e9a7`, `51ab213f3`.

**Fixed:**
- W1 P0 #9, #10 (producer) and #11.
- W2-4 D5 producer: xSH% = ixG ÷ iFF.
- BA W1-3 A support pairs and fixture.
- D5 (team of record), D7/D14/D16, D10 (mid-rank).
- W3-6 N1 writer.
- W3-3 D8, D9.
- W3-7 D6 (no dedicated test).

**Partly fixed:** D6 PP share; the writer passes null until L8's clock is qualified.

**Tests:** 46 files / 400 passed.

**Left:**
- The `team_pp_clock` table isn't built.
- Rows without `windowCountSupport` read as unknown until the rebuild.
- Rebuild scope note: the lane wrote 2025-26; the current season is 2026-27.

### L14: xG model, gate, shot map
**Commits:** `0b1d5a636`, `645aaef94`, `a41ca6641`, `52c8469d9`, `60f1b3eb9`, `6fadc574a`, `d06dfc7c0`, `2d1db07a6`.

**Fixed:**
- W1 P0 #1 (code and demotion plan) and #3.
- BA W1-1 A (isotonic ties, rebound keys, xgboost scoring space) and BA W1-1 B.
- W3-1 D1/A4, D6/C2 (decision-88 gate; admin-only shadow scoring, decision 101), D8.
- Decision 7.

**Partly fixed:** W1 P0 #2 (model side).

**Tests:** 35 files / 191 passed; joint run 66 files / 651.

**Left:**
- Demotion, aggregate rebuilds and the v2 features/model (queue 3).
- No in-house xG for new games until a v2 model passes (decision 99).
- The decision-100 EN comparison hasn't run.

### L17: player stats page
**Commits:** `889a32a32`, `48d80a605`.

**Outcomes:**
- W3-P0-1: partly fixed (see §5).
- W3-3 D1 copy: fixed.
- W3-2 D5 (decision 89): fixed.

**Tests:** 19 files / 282 passed.

### L2 and L2-landing: underlying stats
**Commits:** `168d9e179`, `829332f70`; L2-landing `9a8f1c8bd`, `5ef993a62`, `1922c6f3c`, `857732315`, `90c6ace50`, `40b7cc4d3`.

**Fixed:**
- W2-P0-2 to -7.
- W1 P0 #2 (display) and #5.
- W2-2 D11, D12, D13, D14, D15, D19; PR-U3.
- W2-3 D5, D8–D12, D14, D16, D17, A2, A4, DR1, DR3.
- W3-1 D7 / C1.

**Deferred:** W2-2 D10, PR-U2, PR-U4 (coverage flags with formulaRevision 3).

**Declined:** W2-3 D15 (labelled approximation).

**Unverified:** W2-3 D7 (finished-game rule) and D13 (chart minimum TOI).

**Left:**
- `teamStatsSummaryRefresh` writes bucket xG into NOT NULL `xgf`/`xga`. It's hidden; retiring it needs a nullable migration.
- Player readers serve pre-revision rows until the rebuild.

### L3: variance pages, roster matrix, TOI parser
**Commits:** `ccb414c43`, `8ec8bbe19`, `6f42a7ecc`.

**Fixed:**
- W2-P0-8.
- W2-3 A3, A5.
- W2-2 D6, D7, D8 (decision 97), D9 (decision 98); PR-U1/U2/U4.
- W3-3 D4.
- Rule 5: URL/key log lines removed.

**Tests:** goalie 35/35 (13 failed on HEAD); Teams 12/12.

**Left:**
- The iCF/60 5v5 basis is unverified.
- NST wiring deferred (decision 73).
- PR-U3 goalie distance weighting is untouched.
- Browser check not run.

### L5, L5a, L5b: rankings, splits, matrices, unit TOI
**Commits:** `e922bb6c0`, `ee075a1b5`, `f5d60829a`, `e6c7b4c01`, `87dfa76ea`, `6c236b079`, `54f5cb7ae`, `daf4357b6`; L5a `e023c5ee5`, `96a935599`; L5b `2870d41cb`.

**Fixed:**
- W2-P0-9, -10, -11; W1 P0 #10 (consumer).
- W3-6 N1.
- W2-4 D3, D5, D6, D7, D8, D9 (decision 112), D12, A1, A2, A3.
- W2-6 §3.
- Decision 90 (mid-rank percentiles; dense rank stated in the glossary).

**Out of scope:** W2-4 D10 (fixed by L2-landing).

**Partly fixed:** D11/D13. Floors are done; the composite writer's gate is deferred.

**Tests:** final 57 files / 535 passed.

**Left:**
- BEAST cut-offs need re-evaluation (decision 74).
- QS labels on the splits page and TeamDashboard are not updated.
- `war.ts` season fallback is 20252026.

### L8: lines, PP combos, TOI API, shift charts
**Commits:** `1e34edbdd`, `7deb81304`, `4126fed60`.

**Fixed:** W2-P0-12, W2-P0-13.

**Partly fixed:**
- W2-6 D3: legacy label done; the 5v5 switch waits on the unit-TOI rebuild and the disjoint-slot owner question.
- D5: `es_shifts` sits in Codex's `shift-charts.ts`.
- D8: M-LINE-028/030 sit in unowned `web/lib/sources`.
- M-FRG-058: clock contract written; the clock is unqualified.

**Deferred:** D4 (fitted floor needs reads), D6/D7 (dormant).

**Tests:** 9 files / 72 passed.

**Left:**
- `PP_CLOCK_QUALIFIED = false`.
- `team_pp_clock` table not built.
- FORGE `toi_pp_seconds` exceeds the PP clock on 77 team-games (L9a).

### L4b: WiGO readers, ratings, writer, radar
**Commits:** `71840ba42`, `f9891a23c`.

**Fixed:**
- W1 P0 #8.
- W3-1 A1, A2, A3, D4, D5, D9, D11, D12.

**Partly fixed:** D3. The 30-minute floor is provisional and not split-half validated.

**Declined:** W2-1 D9 reader (no change needed).

**Tests:** 62 files / 604 passed; radar 61/61; E2E 13/13.

**Left:** the WiGO rebuild; the floor validation read; PP% is labelled unqualified.

### L16: homepage analytics and pulse
**Commits:** `d32138d0b`, `5d7ef3daf`.

**Fixed:**
- W3-2 A1 / W3-3 D5.
- W3-2 D2 (decision 42 notice, decision 43 pick).
- W3-2 D1 / W3-3 D6 (decision 109).

**Tests:** 13 files / 110 passed.

**Left:** FORGE projected goals still show as "Proj" on game cards.

### L18: social share
**Commits:** `e7b032700`, `dee837882`, `644a6691e`, `fdb14783b`, `21607f3f9`.

**Fixed:**
- W3-3 D2, A1.
- W3-2 D4/A2.
- BA W1-3 A.
- Crease Shift finality, then handed to Codex.

**Declined:** BC W1-12 social readers (no change needed).

**Tests:** 50 files / 1,346 passed.

### L9a, L9a-markets: FORGE skater path
**Commits:**
- `9cf384ff4`, `18f1f1804`, `e5b0b11fb`, `fe0b3d110`, `6f94723d4`, `5f62c2f47`, `74b83d87e`, `4e9c4371d`, `22242bcd8`, `52d37ae12`, `2c6b96176`, `8bc43a855`, `2b2c58a76`, `0b7c8b04e`, `a357d348f`, `496b5c9de`.
- Markets: `c47f77708`.

**Fixed:**
- W1 P0 #18, #19, #21.
- A1/N1, D6/D8, PR-SQL-2/F3/C8.
- W2-6 §1.
- N2, N3, N4, D7.
- Markets: D4b, D17, D18, W3-4 N2 (dormant, decision 30).
- Decision 26: band reader inert.

**Fixed elsewhere:** D16 (by L13b).

**Partly fixed:**
- A2: the reserve part is a Codex proposal.
- M-FRG-017: PP over-allocation only.
- W1-7 D2: scratches game-scoped; tweet-pattern-review scratchGameId deferred.

**Deferred:** D5 joint refit, decision 29, W3-4 N3–N5, decision 27.

**Unverified:** BC W1-6 D8, D13, D14.

**Tests:** lib/projections 1,557 passed; gate 58/58.

### L9b: FORGE goalie path (handed to Codex 2026-11-11)
**Commits:** `266794115`, `4eab7347d`, `4bf7bb7c8`, `b0a8bd244`, `d2f9b2941`.

**Fixed:**
- W1-5 credited start.
- W1 P0 #20.
- D24/N6; GSAA .900 readers; W3-4 N1; W2-8 PR5.

**Partly fixed:** #16, #17, BA W1-5 B (no frozen puck-drop receipt).

**Blocked on Codex:** the accuracy job.

**Tests:** 465 across 16 files.

### L9c: FORGE coverage path
**Commit:** `22f67eb9f`.

**Outcomes:**
- Decisions 132.2–132.4: fixed. The decay harness is unvalidated and not applied.
- W1 P0 #27 root cause: partly fixed (R1 is production work, R3 is unknown).

**Tests:** lib/projections 1,580 passed.

### L12: team ratings, Game Grid, Top Adds, Power Terminal
**Commits:** `690693c71`, `24acb3ca6`, `81b896fd7`, `baaa0bac2`, `b6336a5d8`.

**Fixed:**
- W1 P0 #12, #13, #15, #22, #29.
- SOS.
- Poisson (shared OT rule).
- W3-3 D7/D10; W1-12 039/040.

**Partly fixed:**
- #14.
- CTPI: v2 pooled; v1 frozen.
- BA W1-4 B: one power score; D9 EN exclusion unverified.
- W1-12 D5: off-night value deferred (decision 53).

**Tests:** 2,619 tests across 176/177 files.

### L13, L13b: draft and category value
No diary exists. Outcomes come from the commits and the Chef diary.

**Commits:** `456ba9e61`, `902a28ac9`, `bbc0dd961`.

**Fixed:**
- W1 P0 #30; W1-12 A R1.
- W2-P0-14.
- W2-5 D1, D3, D4, D5, D6/§4.2, M-DRF-010.
- W3-1 D2, D10.

**Partly fixed:**
- W2-5 D7–D14: community prior in unowned code.
- W1-12 D6: Yahoo sort_order is a Codex proposal; ESPN/Fantrax normalizers are unowned.

**Out of scope:** W1-12 D3 (fixed by L10).

### L22: game predictions, odds, game pages
**Commits:** `b16a81fae`, `99c42265b`, `71861c094`, `7c3867003`, `e2a18e4ec`.

**Fixed:**
- Decision 43 (and 117).
- Backtest leak, issuance, partial rows, odds pairing (decision 116), lineup, misc.
- Decisions 44, 45; calibration test.

**Partly fixed:**
- D1 / decision 42: the cron "skipped" status is a Codex proposal.
- Decision 1: benchmark spec only.

**Tests:** 37 files / 411 passed; reopen 248; gate 49/49.

**Policy choices to confirm:**
- A book with two offers on one side is skipped.
- A response with no fetch time, or a started game, shows as unavailable.

### L15: season evaluator, TS + Python twins
**Commits:** `412e9870f`, `12e55325d`, `3e4c7826f`, `944f95f42`, `bef023fa8`.

**Fixed:**
- W3-5 F1–F6, F8, F9, PR1–PR3.
- W2-8 D9–D12, PR8, PR9.
- M-PFC-110; decision 66.

**Partly fixed:**
- W2-7: D1, D2, D4b, D5, D9 fixed. D3, D4, D7, D8 deferred.
- BC W1-8 A/B: the .65 loading is labelled, not changed.

**Tests:** Vitest 36 files / 1,372 passed; pytest 217.

**Left:**
- A goalie outcome model (decision 121).
- Intervals stay labelled uncalibrated (decision 39).

### L10, L10b: served ledger and settlement
**Commits:** `c9342d6d0`, `e18c111ad`, `788511320`; L10b `37adc9c0a`.

**Fixed:**
- W2-8 D1 (decision 78), D2, D3/PR4.
- W2-7 D6; M-PFC-120.
- BC W1-6 A3.
- W3-5 F6–F10, PR1, PR3–PR5.
- BC W1-11 010.

**Partly fixed:**
- Decision 41: basis persistence waits on the flag (migration 138 is applied).
- W2-8 D6: the decision-127 calendar default is still v1 (queue 16b).
- D8: unverified.

**Left:** an owner decision on the accountability composite column (it can't hold v2 skill below 0).

### L11: RSO bridge and optimizer
**Commits:** 15 L11 commits (`495f54d26` … `ca06cbf6c`), plus a Codex proposal `c231c05be`.

**Fixed:**
- W1 P0 #26, #27 (consumer), #28.
- BC W1-11 A: comparator, re-aim, override, reserves, dates.
- W2-8 D2/D3; W2-1 C2.
- Decisions 51, 57.

**Deferred:** tilt and W1-6 D19 (owner contract), D4, D5, D6.

**Blocked on Codex:** W1-12 R2.

**Tests:** RSO 1,804 passed.

**Left:** unverified whether L11 reads the L13 stat registry and L9b's goalie contract.

### L7: sustainability, trend bands, /charts
**Commits:** `b5ee2aca0`, `667e24ef0`.

**Fixed:**
- W1 P0 #23–#25.
- BC W1-9 A1–A3.
- W3-6 N2–N4.
- W2-1 F2.

**Partly fixed:** N6/D8 (label only).

**Deferred:** A4–A6, N5, D9–D11, D13.

**Tests:** 232 passed.

### L19: legacy averages routes and CSV upsert
**Commits:** `c2bcbf9d0`, `526c1f6d8`.

**Fixed:** W3-3 D3, A2 (decision 133), D11.

**Left:** the NST traded-season layout is assumed.

### L20: legacy sKO
**Commit:** `317c1ff4d`.

**Fixed:**
- W3-7 D1: renamed Volatility-Discounted Points Pace (VDP), decision 134.
- D2 (migration 140 applied).
- D10 (legacy part).

**Partly fixed:** D5. The IPP guard is in; the cause of the 42 rows isn't established.

**Deferred:** D8/A4 (dormant).

**Left:** pause the cron (queue 13).

### L21: Sko Element contracts
**Commit:** `0f3614cb9`.

**Fixed:** W3-7 A1–A3, D3, D4, D7, D10.

**Out of scope:** VuDu.

**Left:** the Codex BLSH-consumer proposal (CLAUDE-FIX-L21-A1-D3-20261112) has no reply.

## 7. Remaining risks
- **Mixed or stale stored data until the queued rebuilds run:**
  - player and team summaries;
  - rolling and trend rows;
  - power ratings;
  - WiGO;
  - FORGE rows (null PK heads before `9cf384ff4`; goalie candidates empty until the FORGE run);
  - trend bands.
- **FORGE live-output change from the inert band reader** (§4.2).
- **No in-house xG for new games** until a v2 model is approved (decision 99). The served champion is the leaky cfg9bac2706 until it is demoted.
- **PP share withheld everywhere** until the PP clock is qualified.
- **Database load:** two incidents (2026-11-12 15:43Z and 2026-11-13 01:55Z) show that sustained bulk writes (re-normalization, summary and rolling rebuilds) must be paced by I/O and latency, with gaps between runs. Both hangs followed a checkpoint, under hours of continuous writes.
- **Duplicate derived-build trigger at 10:05 UTC.** Codex's `24b1cb4d3` moved pg_cron 305 `build-forge-derived-v2` from 09:50 to 10:05 on 11-12, the same minute the Vercel rolling-forge pipeline (cron 6, `includeDownstream=true`) starts; that pipeline also runs `build-projection-derived-v2`. `combinedCronInventory.test` has failed on master since then. Read-only check 2026-11-13: 305 is active at `05 10 * * *`. Any schedule change needs TJ.
- **Production served a CLI deployment with H1 overrides for about 19 minutes.** Codex's `dpl_GK6quj7ogBxcQE3FZxV3VDzSTvjM` (00:06Z, compute on, canary 307, scheduler off) was aliased to fhfhockey.com until the Chef promoted `dpl_HH8SPE1cLyonVBW9uN3rUi1MN3Sa` at 00:25Z (TJ's pop-up). No H1 request was sent. After a manual promote, Vercel may pause auto-assignment of production domains, so the alias is checked after each release.

## 8. Owner decisions
**Decided on 2026-11-13 (decisions 135–143), all implemented in code:**

| Decision | What was decided | Lane and commit |
|---|---|---|
| 135 | Signed nullable `v2_skill` column | L4a `e0dea7205`, migration 142, not applied |
| 136 | Tilt conserves the team total | L11 `7efd70f9b` |
| 137 | Disjoint 5v5 units, behind `LINES_FIVE_ON_FIVE_ENABLED=false` | L8 `79dedadf1` |
| 138 | Team-by-date `percent_games` denominator | L4a `e0dea7205`, migration 143, not applied |
| 139 and 143 | BEAST gates re-derived and kept as v3 | L5 `d755d8b4c` |
| 140 | WiGO floors PP 60 / PK 120 with a label | L4b `1b11bb1f2` |
| 141 and 142 | Legacy sKO IPP pooled; 0/0/0 only when shifts confirm | L20 `21ca6d492` |

All shipped in release #431 (master `502a93b4c`).

**Still open:**
- Resume the update-predictions-sko cron after VDP v0.4 (decision 129).
- PP clock disagreement policy, before the PP share is served.
- pg_cron 305 `build-forge-derived-v2` vs the Vercel rolling-forge pipeline. Both start a derived build at 10:05 UTC since Codex moved 305 on 11-12 (§7).

## 9. Former Codex proposals (now owned by this session)
On 2026-11-13 TJ moved all remaining project work to the Claude Chef session ("No more back and forth with Codex"). These proposals are now follow-up tickets here, not mailbox items.
- L9b: accuracy job, v2 goalie writer.
- L9a: 18-GOALIE-SA, A2-RESERVE, D2-RESERVE-LABEL.
- L9c: reserve-row coverage.
- L12: odds labels.
- L13: Yahoo sort_order.
- L22: cron "skipped" status.
- L11: W1-12 R2.
- L21: BLSH consumers.
- L1: team and goalie placeholders.
- L9c: Start Chart labels, which Codex is applying now.

## 10. Records and hygiene
- **Lane diaries committed in lane commits:** L4b, L7, L9a-markets, L10b, L12 (diary-only commits), L15, L21. All were left out of the release candidate.
- **No diary:** L13/L13b and L10 half A. Their outcomes come from commits and the Chef diary.
- **Commits that swept in other lanes' mailbox sections:** L6 `6b2023387` (L14 claim) and L15 `412e9870f` (L9a section).
- **Chef diary SHA error corrected:** the lease release is `ee2b1c19c`.

## 11. Verification of the draft's "unverified" items (2026-11-13; read-only code check at HEAD 89bf543fb)
| Item | Status | Evidence |
|---|---|---|
| L2 W2-3 D7 (finished-game rule) | **Fixed and released** in #433 (lane F4, `94e4c7c67`, `073a5905e`). Migration 146 added `games.game_state`; `update-games` fills it (all 1,409 games for 2026-27 read back), and the landing and detail readers decide finality from it with a labelled start + 8 h fallback. | Other heuristic consumers, listed by F4 (`teamStatsSummaryRefresh.ts:1132`, `teamStatsQueries.ts:1023` and `teamUnitToiNightly.ts:149` are date-only), as a follow-up lane |
| L2 W2-3 D13 (chart minimum TOI) | **Fixed and released** `33b919192` in #433. Chart points skip the minimum; table rows keep it. The regression test fails on the old code. | Done |
| BC W1-6 D8 (goalie rest and trend boosts) | **Not fixed** | `goalie-stage.ts:344-363`, `projection-weights.ts:26-30`. This is the goalie stage (L9b), not L9a. The debrief's L9a "D8 fixed" was W1-7 D8 (WGO TOI unit), a different finding. |
| BC W1-6 D13 (no home term in goalie outcomes) | **Not fixed** | `goalieOutcomes.ts:92-123`, `goalie-stage.ts:383-385` |
| BC W1-6 D14 (on-ice goals split by TOI only) | **Not fixed** | `skater-stage.ts:2885-2891, 2915-2916` |
| BA W1-4 B D9 (EN exclusion in team Goaltending rating) | **Not fixed** | `power-ratings.ts:262-266, 439, 578, 848` use NST all-situation rows with no EN filter (decision 7) |
| Week Score lexicographic order | **Not fixed** | `calcWeekScore.ts:69-81`: 6 per game + 4 per off-night, so 3 games / 3 off-nights (30) beats 4 / 1 (28) |
| Week mismatch → blocked (BC W1-12 D5 sub-item) | Already in place (pre-sprint) | `forge/players.ts:377-385, 479-486` |
| L10 W2-8 D8 | Partly in place (pre-sprint) | `settlement.ts:76-114, 251-259`; no scratch settlement from identity evidence added |
| L11 reads the L13 registry and L9b goalie contract | **Not wired** | Neither `statsMasterList` nor `readGoalieCandidatesContract` appears in L11 files; the bridge reads stored `proj_*` and `goalie_start_projections.l10_start_pct` |
| L4b FHFH house labels | No defect | WiGO and the radar show genuine NST measures under NST names (decision 9). FHFH measures appear only on underlying-stats pages, which already carry FHFH labels. The brief's rename was misrouted. |
| L5 adjustedImpactPromotionContract (decision 100) | **Fixed** | `adjustedImpactPromotionContract.ts:84-119` (`ee075a1b5`); always reports blocked because no run record is passed |
| L1 → L10 baselineInputCapture faceoffs | Handled (no change needed) | `baselineInputCapture.ts:247` selects faceoffs but never uses them |
| L9a → L10 ledger PK heads | **Partly fixed** | `modeledHeadTotals.ts:7-12`: PK is summed when present, but a missing PK head counts as 0 instead of unknown |

These open items become follow-up tickets in this session; TJ moved all remaining project work here on 2026-11-13.

## 12. Codex work adopted (2026-11-13)
TJ moved all remaining project work to this session ("No more back and forth with Codex"). A read-only inventory found 12 areas of uncommitted Codex work. Each was decided by pop-up; nothing was deleted, and backups are in `production/codex-adoption/pre-sync/`.

| Area | What | Outcome |
|---|---|---|
| 1 | Goalie Grid release copies (42 files, byte-identical to master) | Not committed as new work. octoberBranch synced with master `4243bcd4e` (`22a94090a`). |
| 2 | Frozen starter-board exporter and goalie workload contract | `7b3d328ba`. The stale local `verifiedForgeReleases` pin (975e67b47) was replaced by master's released pin. |
| 3 | One historical goalie start ledger | `b4a9fcf42`. Reviewed against L9b and L18. Starters resolve only from complete, unambiguous official labels, and Crease Shift is unchanged on complete windows. The membership modules ride along unwired. |
| 4 | DRM reader, UI and history, plus /drm superstyle passes 1–6 | `97685d418`. 293 tests, DRM e2e 6/6, CSS pure 5/5. Ships in the next release. |
| 5 | RSO objective switch and dated Lines fallback (candidate f42a15054) | `e0d424d5b`, released in #431 |
| 6–8 | Yahoo diet test, homepage payload and Yahoo pickup errors, trends test | `49952fdb6`, `4bb0e11b5`, `2185f1c76`, released in #431 |
| 9 | Browserless quarantine guard: the line-combo webhook skips with 200 (TJ: commit) | `79daa3285`, released in #431 |
| 10–11 | Rankings usability; BLSH offline capture scripts | `c58a57117`, `ec85232a1`, released in #431 |
| 12 | Generated `next-env.d.ts` | Restored to HEAD |

Also fixed here: the Game Grid TeamDetails test mock had been failing on master since the Goalie Grid release (`7234e9682`, next release). Codex's production deployment with H1 overrides was replaced by the original deployment (§3, §7).

## 13. Follow-up ticket status (2026-11-13, Chef)
| Item | Status | Next |
|---|---|---|
| L2 W2-3 D13 (chart minimum TOI) | **Fixed and released** `33b919192` in #433. Chart points skip the minimum; table rows keep it. The regression test fails on the old code. | Done |
| L2 W2-3 D7 (finished-game rule) | **Fixed and released** in #433 (lane F4, `94e4c7c67`, `073a5905e`). Migration 146 added `games.game_state`; `update-games` fills it (all 1,409 games for 2026-27 read back), and the landing and detail readers decide finality from it with a labelled start + 8 h fallback. | Other heuristic consumers, listed by F4 (`teamStatsSummaryRefresh.ts:1132`, `teamStatsQueries.ts:1023` and `teamUnitToiNightly.ts:149` are date-only), as a follow-up lane |
| Week Score ordering (BC W1-12 D5) | Depends on decision 53 (off-night value measured from roster scenarios, validated on held-out weeks); the 6/4 weights are a modelling choice | Off-night value study |
| L9a → L10 PK head counted as 0 | Deferred. Every FORGE row now served predates L9a's PK writer (runs created 11-09), so treating null PK as unknown would blank totals sitewide | After the first FORGE run on released code, confirm PK heads are written for every player, then treat null PK as unknown |
| BA W1-4 B D9 (EN in team goaltending) | Owner decision. The rating reads NST all-situations rows, which include empty-net events | Choose 5v5 rows, or subtract PBP-derived team EN events; then the power-ratings recompute (queue 7) |
| BC W1-6 D8/D13/D14 (goalie stage) | Model changes needing refits and held-out checks (L9b plan) | Owner decision and refit plan |
| L11 registry and goalie-contract wiring | Not started (integration) | A lane of its own |
| L9a ice-time classifier vs Codex penalty clock | Codex's `24b1cb4d3` replaced L9a's `8bc43a855` in `ingest/shifts.ts`; derived event counts still use situation codes | Read-only cross-check of edge cases |
| CTPI v2 publication (W1-4) | Released gated. The writer issues only v2 candidate rows (1,102 backfilled, 10-07 → 11-13); readers default to v2 and hide candidates, and v1 is frozen. **The descriptive Recent Team Form beta is live** (#435; same-games label #437). Only the approved-only predictive path stays gated until v2 is approved. | Owner decision: validate and approve v2 for prediction (successor code change); CTPI checkpoints at games 20, 30 and 40 |
| SOS v2 (decision 21) | Released (#433, F2 + F2b). The first snapshot holds 32 rows, 0 pending, 84 fixtures per team (2026-27 is an 84-game season). `sos_standings` is frozen. | Q6 (win% vs points% headline, 2:1 landing weights, as-of semantics) stays open |
| NST gamelog identity: Josh Mahura 8479372 | Found at the 11:01Z check. NST matched him on 12 of 14 games and failed on 11-07 and 11-12 (16 of 20 datasets flagged each time; other players landed). | Find NST's name or id for him on those dates (read-only), then an alias or identity fix and a bounded re-fetch of the 2 dates within the NST limits |
| WiGO `missing_identity` rejects | Cron 231 writes 988/990 players; 8478446 (2022-11-12) and 8481827 (2021-11-06) have `wgo_skater_stats` rows with no team, opponent or game id, so the run audits as `failure` daily | A 2-row WGO repair from the NHL game logs (needs TJ) |
| F3 unowned Lines items | Stale header comment in `[abbreviation].tsx`; `lines/index.tsx` mixes labels; LineShareBars TOI | A small Lines lane |
| Astra AF-07 penalty shots (decision 149) | **Done for the player and goalie landing (2026-11-13).**
- Adapter (#434); split columns, writer, builder, readers and parity (#437); migration 148 applied.
- 8-game derived rebuild: all post-write checks passed, totals equal official.
- Bounded landing summary refresh: canary 065, then the other 7, TJ-approved separately; key-by-key readbacks passed.
- Served player and goalie landing verified against the rebuilt rows for all 8 games (ALL_OK); re-verified strictly after Astra A3-01 (24 GETs, ES and every goalie field asserted, raw responses in `landing-verify-20261113T184529Z/`). | **Team follow-up done (2026-11-13):** builder fix released (#438). The read-only 8-game diff (54 rows, only PS deltas, no audit row), the team refresh (54 rows changed, matching the diff exactly) and the served team landing (16/16 team-games equal to the official boxscores) were each TJ-approved separately. **AF-07 closed.** Remaining: 2025-26 has 33 penalty-shot games on old totals (no rebuild proposed). |
- Adapter `8463912d8` (#434).
- Split columns, v2 writer, builder, readers and parity: `30fa0f00a`, `8a4a7d8d1` (#437).
- Migration 148 applied 17:28:45Z.
- **8-game rebuild DONE** 17:46–17:50Z: all 8 games passed the post-write checks; the Chef readback shows 16 team and 304 player rows split, 8 PS shots and 2 goals, and all-situation totals equal to the official boxscores. **Condition 1 met.** | Close only when:
1. all 8 games pass the post-write checks;
2. the bounded underlying-stats summary refresh for those 8 games (separate plan, reviewed and approved on its own) has run, and the landing is verified against the rebuilt rows. |
| Astra AF-08 finality consumers | **Fixed in the final release:** F7 `5bb89aef1` and `706937676`. `teamUnitToiNightly` needs a PBP game-end event; settlement needs a FINAL/OFF boxscore. | — |
| Astra: social skater rankings score a missing stat like a known zero | Confirmed by Astra after checkpoint 1. **Fixed (#436)**; see the F17 row below | — |
| PP clock (decisions 144, 151) | F11:
- report `48dd8fe8f`: 2,493/2,500 exact;
- C3 `a98eda63f` (#434);
- C1 and C2 `de4650c77` (#436);
- decision-151 checks `9e3d73640`.

2026-27 regular season: 616/618 pass the clock check (607 with PP time, 9 verified zero). 607/607 could display with shifts ∩ qualified intervals, but only 591/607 from today's stored `powerPlayCombinations` (16 team-games in 14 games disagree). O4: all 5 scrum games reconcile exactly with the NHL Penalty Summary; the stored `teamGameStats` total is the outlier (−28 to +120 s). **PP share stays withheld** (TJ). | **Decided (decision 152, 2026-11-13):**
- The Penalty Summary is the official reference only for those exact-reconciling team-games, with both values and the reason kept and the stored total untouched.
- The numerator is shifts or unit intervals ∩ qualified PP intervals, replacing the stored-combinations calculation.

**Next (F11 `local_efbef655`):** the five-game reference in code, then a read-only comparison against stored combinations and a cost measurement. Then TJ chooses between computing in the reader and storing the output with a bounded refresh. PP share stays withheld until the served values are verified. |
| Codex dev items 1, 2, 6 | **Held by Codex and excluded from the final release:** `fc34b053a` (goalie writer), `284f99045` (accuracy job), `c89ff5d24` (game-stat placeholders, with an unapplied migration) | Codex: league SV% helper nulls, pregame issuance contract, Splits and Lines readers before migration |
| CTPI descriptive beta card (F5b) | **Live:** shipped in #435 (`122dd880b`, `17b342f76`, `3b6d82edc`), with the same-games label fix in #437. Badged "Descriptive beta · not a forecast"; the approved-only predictive path stays gated | — |
| Power ratings v4 (decisions 145, 147, 150) | **Released and rebuilt.** Code in #434; version-aware labels and the writer dry run in #435. Rebuilt 2026-11-13 16:46–16:53Z after a live no-write preflight: 1,425 v4 + 47 labelled legacy carries (09-29..10-02, source 08-29), 0 v3 left, served labels checked. | — |
| Astra #435 addendum P2: CTPI beta card says "same 10 games" while warning about a date mismatch | **Closed** (addendum 3): date-by-date comparison, regression included | — |
| Astra #435 addendum P2: runner cron guard can go stale after the load wait | **Closed** (addendum 3): runner `630127066` rechecks after the guard | — |
| Astra A3-01 P2: landing verifier could falsely pass | **Closed 2026-11-13:** `verify-landing-strict.py` (self-test plus strict 24-GET rerun, ALL_OK, raw responses kept). The record's "21 GETs" was a miscount of 24. ES unchanged by the refresh is shown by the 7 surviving pre-refresh snapshots. For the canary, the pre-refresh values are cited from the original run log (`run/summary-run.jsonl` line 2), not the overwritten snapshot; that log has no ES row. **Astra recheck: PASS** at `5fbb2d3a2` (24 responses replayed, log hash matches). | — |
| Astra A3-02 P2: resumed summary runner overwrites the canary's before snapshot (and re-baselines done games) | **Closed locally 2026-11-13 (offline; no production rerun):** F15 `f3b411463`, `9cc43a0b6`, `6d24ba51e`, `bfeabb283`, `f4c8cc701`.
- All three runners write run-unique snapshots that can't be overwritten (the first per game is the original). A resume skips done games before any snapshot or baseline; the PS runner's final read-only totals check is not a baseline.
- Resume tests for all three runners, each with one completed and one pending game: the completed game's files stay byte-identical, and only the pending game gets new snapshots.
- Team runner: execute diffs only pending games, against the original approved diff. Two cases each stop before any write or snapshot, with the done file and the approved diff byte-identical:
  - a changed diff (exit 6);
  - a per-game diff response that doesn't confirm a dry run with zero writes (exit 2; dryRun missing or false, rowsUpserted ≠ 0, truncated).
- Chef reran pytest: 33 passed.

The canary's original before rows are lost; its true pre-refresh values (0 G / 5 S) survive in `summary-run.jsonl`. **Astra recheck: PASS** at `5fbb2d3a2`. | — |
| Astra #435 addendum, model handoff: `homeMinusAwayGoalieRating` mixes v4 (5-on-5) and legacy goaltending across history; `featureBuilder.ts` drops the provenance | Not a release blocker; there's no production game model (decision 42) | Codex model work: version the feature, filter or withhold mixed inputs, and keep reconstructed inputs apart from issued ones |
| Social rankings missing-vs-zero (Astra #433 follow-up) | **Fixed and released (#436):** F17 `f2df257b6`. The social share skater score is withheld when any input stat is missing. | — |
| NST identity gap (Mahura) and WiGO rejects | **Repaired 2026-11-13** (F18, TJ-approved): 14 WGO legacy-identity rows fixed and 2 NST dates re-fetched. The alias code fix `77a6e7592` shipped in #437. | Ticket: the wider 2020-21 to 2022-23 WGO game-identity backfill (most legacy rows lack game ids) |
