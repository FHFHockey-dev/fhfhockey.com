# 2026-10-26 · Claude · RSO Yahoo diet (Phase 1, analysis only)

## Scope
Inventory every Yahoo read made by RSO and the Start Chart Yahoo panel; map each consumed field to an in-house source or Yahoo-only; classify A/B/C; write INVENTORY, FIELD-MAP, PLAN, DECISIONS-FOR-TJ under tasks/artifacts/rso-yahoo-diet-2026-10-26/. No product edits, no Yahoo/DB/prod calls.

## Where
- Branch octoberBranch (shared checkout), no commits.
- Artifacts: tasks/artifacts/rso-yahoo-diet-2026-10-26/

## State / checkpoints
- 10-26 start: read WINDOW-RESULTS-2026-10-26, sibling notes, rosterPlanning.ts, providerClient.ts, planningConfirmations.ts, starterBoard.ts, provider + yahoo-current-data + starter-board routes, RSO refresh/upkeep code.
- Finding: provider snapshot auto-upkeep re-runs every 5 min while visible (PROVIDER_REFRESH_INTERVAL); yahoo-current-data fires 1 roster read per planning execution.
- Finding: providerClient already has `availability` by player_keys (≤25 per call) — basis for targeted availability.
- Supabase MCP not authenticated; using repo types/migrations only (0 DB queries).

## Next
Write the four deliverables; report to orchestrator.

## Blockers / approvals
Implementation needs TJ approval + file leases from orchestrator.
- 10-26 checkpoint: INVENTORY.md and DECISIONS-FOR-TJ.md drafted. Planner caps candidates at 40 (candidatePlanMetrics.ts:74, planning.ts:1258), so the targeted-availability design verifies ~50 (2 reads of 25 player_keys). Waiting on Explore subagent for in-house table freshness before FIELD-MAP/PLAN.
- Gotcha: no recorded real Yahoo payload in repo proves scoreboard carries `week` or roster carries `roster_adds`; PLAN step 4 must verify in a bounded window first.
- 10-26 checkpoint: all four deliverables written (INVENTORY, FIELD-MAP, PLAN steps 0–7, DECISIONS D1–D8). Explore subagent findings spot-checked: yahoo_nhl_player_map has no scheduled writer (update-yahoo-players.ts:143–150 only counts it) → added step 0 / D8.
- Checks: static analysis only; 0 Yahoo calls, 0 DB queries (Supabase MCP unauthenticated), no product edits, no git mutations.
- Next: TJ decisions D1–D8; orchestrator leases for Phase 2. Keep this diary until Phase 2 starts or the plan is recorded in a task list.

## Phase 2 (lane RSO-YAHOO-DIET-P2, flag RSO_YAHOO_DIET=1, default off)
- Implemented D8 (yahooIdentity.ts), D2 (planningCache.ts server caches + upkeepLease.ts client lease), D3, D5, D6 (shared yahooInferredAcquisitionTiming), D4 (migration 20261026200000, NOT applied, + flagged code path). D1 full scan kept.
- Checks: vitest 146 files green UTC + NY; whole tsc exit 0 under heavy lock (8 GB heap); eslint 0 errors. E2E running.
- Gotchas: tsc needs --max-old-space-size=8192; the RSO upkeep effect re-runs on every settled refresh, so lease release must live in its own effect; PostgREST ints vs string ids in .in().
- Pending leases requested from orchestrator: provider.ts (manual bypass), providerRules.ts (+test) for D6 overridability.
- Process slips: one early unlocked whole tsc; reverted my out-of-lease provider.ts edit with git checkout.
- 10-26 P2 done: E2E 73/73 UTC + NY; receipt RECEIPT-P2.md complete. Waiting on provider.ts + providerRules.ts lease answers.
- 10-26 P2b: providerRules + provider.ts granted and done; vitest 161 files UTC+NY, tsc 0 (lock), eslint clean, E2E 73/73 x2. Receipt updated.
- 10-26 16:2xZ follow-up (RSO-FLAKE finding): caches keyed by connected-account generation (id:GUID:last_synced_at), status-gated to connected, refused live read purges + withholds cached result. 6 files uncommitted; tests 58/58 + wider 3,333 UTC+NY; eslint clean; tsc waiting on heavy lock (held by RSO-MANUAL-F3). Receipt RECEIPT-P2-ACCOUNT-KEYS.md.
- tsc exit 2: 10 errors all in another lane's uncommitted SocialShare edits; 0 in lane files.
- 10-26 docs ticket: wrote tasks/artifacts/rso-wave2-2026-10-25/YAHOO/REAL-ACCOUNT-PLAN-2b.md (window 2b-A R2–R4 flag off cap 230; 2b-B D7 local cap 225; 2b-C prod enable cap 215; 7 approvals). Original PLAN-2 untouched. No code, no reads.
- 10-26 19:1xZ bridge-proofs ticket: provider.ts + rosterPlanning forward onBridgeRunProofs; tests 106/106 UTC+NY; tsc 0 (lock); eslint clean. Unrelated failures in planning/category suites (post-6c36c8e8c) reported. Receipt RECEIPT-P2-BRIDGE-PROOFS.md.
- 10-26 league-rules ticket: yahooPlanningReportedRules imports uses_faab/faab_balance (+ waiver_time, weekly_deadline, min_games_played, waiver_type/rule as context); Data health names only unreported rules. Repo has no recorded payload with waiver/FAAB fields -> confirm in window 2b A1. Tests 123/123 UTC+NY, tsc 0 (lock), eslint clean. Receipt RECEIPT-P2-LEAGUE-RULES.md.
- 10-26 P1 D6 ungate: inference applies whenever settings fresh (flag only gates reads). Tests UTC+NY green except load-sensitive 1000-player test (passes alone); tsc errors only in other lane's untracked player-cards test. Receipt RECEIPT-D6-UNGATE.md.
- 10-27 11:30Z FORGE check (TJ-approved GETs): forge/players 10-27 = 200, basis verified_producer_closure, closure bf23edfe, release 598942a78 (332 rows, 22 teams). start-chart got curl 000 at our 60 s timeout; the Vercel request log shows it answered 200 (cache MISS), so it was slow, not failing. One more approved GET, forge/players 11-02 = 200, same basis and closure, 120 rows, 8 teams: DAYS_AHEAD=6 filled through Sunday.
- 10-27 TJ pop-ups: 2b-A today afternoon (cap 230); skip A4; 2b-B local :3110 after 2b-A (at least 60 min gap, token-refresh exception for B only). Questions 5–7 (prod enable, leave on, D4) are not asked yet; they come after B passes. Plan amendment: YAHOO/REAL-ACCOUNT-PLAN-2b-AMENDMENT-01.md (baseline #393; D6 now agrees off/on).
- Next: TJ signals he's ready (afternoon, before an owned goalie's game, after Yahoo marks), then run A0 preflight.
- 10-27 11:58–12:07Z window 2b-A ran (TJ AFK, approvals via mobile pop-ups: two-tab deviation tallied via Vercel logs; onLine false -> manual refresh only). 205/230 Yahoo reads (3 provider x 65 + 10 confirmations), all 200. R2 counter OK (week 5: 1 used / 3 remaining); goalie marks not observed; R3 refresh notice OK; R4 blocked by defect RSO-2b-A3 (Preview swap step non-conditional future, then "action time passed"; repair removes it). Undo + reopen OK. Results: YAHOO/WINDOW-RESULTS-2b-2026-10-27.md. Fix lane started: rso-swap-legality (local_7d0e7323). 2b-B needs TJ to sign in on localhost:3110 (Claude can't enter real credentials) and onLine true; daily budget left 250.
- 10-27 ~12:40Z swap-legality fix verified on clean overlay (1015/1015 UTC+NY, tsc 0, eslint ok), committed 74ebba759 (5 files), closure unchanged bf23edfe (receipt json untracked under projection-table-audit/release-verification). Follow-up ticket sent: manual Select add path (same defect class). Then: release candidate pop-up to TJ, then R4 re-run window.
- 10-27 release #394 (TJ pop-up 'Ship RC10 now'): RC10 7ad492e4a = master 598942a78 + swap/select-add fixes + receipts; gate tsc 0, eslint 0 err, full vitest only export-only failures (identical on master export; pass in checkout), closure bf23edfe. Branch push 0 deploys; master 93a55d4c4 (tree = RC10); dpl_CYuCFNxZ fhfhockey READY, other 3 CANCELED. Smoke 3 GETs 200 (RSO page new chunk 3f215219, forge/players basis verified_producer_closure bf23edfe, home). octoberBranch ours-merged 6ba50932d and pushed (also published local TT-14..17 commits). R4 re-run approved today after ~3 p.m. ET, cap 150.

## 2026-10-27 19:01–19:12Z — R4 re-run (approved, cap 150)
- Used 138 of the 150-read cap (2 provider × 65 + 8 current-data), all 200, with no Yahoo error codes. Day total is 343 of 455.
- RSO-2b-A3 is verified fixed live. The card step is conditional (Thu 00:00 league time) and stays legal across 3 re-reads. Gain is 6.2785, the drop loss 1.547 shows, net = add − drop, and Undo and reopen leave the plan empty.
- The goalie mark showed: "Not starting (Yahoo, read …)".
- New open item: after a current-data re-read, the range line falls back to "Mon–Sun fallback; league matchup dates unverified", plus "partial provider inputs". Look at it offline.
- Results are in YAHOO/WINDOW-RESULTS-2b-2026-10-27.md (R4 section). Next: 2b-B on another day, which needs TJ to sign in on localhost and navigator.onLine true.
- 19:20Z TJ spec: the RSO must curate a streaming chain (DROP→LAK Mon, →NJD/PHI Tue, →WPG Thu, →OTT/EDM Sat; 4 adds, +7 AGP). Pop-up answers: projection first, with recent form as a tiebreak; compare 1 vs 2 spots and always offer the 1-spot alternative. Started session rso-streaming-chain (local_69952d83-46c5-44ca-a53c-b7cd8e7071a4), offline only, local commit.
- 21:1xZ Verified a7dfb06a1 (last-10 FPts hint from wgo_skater_stats/wgo_goalie_stats; one-line schema field). My re-run: 5 files / 180 tests pass. Partial `games_played = 1` date indexes exist on wgo_skater_stats (baseline migration). Release risk: the recent read is ~7x wider (20 columns, 30 days, ~6–8 pages) inside the 2 s form deadline. A timeout is non-fatal (the hint is just missing); check it in the release smoke. Not browser-checked. Commits 979c05ae1 + a7dfb06a1 are local and unpushed.
- 21:4xZ RC11 b5d4af6e8 (refs/rc/2026-10-27-streaming) gated: tsc 0, eslint 0 errors, CSS pure, vitest 6 failing files (same as the master baseline) in UTC and NY. Waiting for TJ's push approval.
- 22:0xZ Release #395 is live: master 3a2f115d4 (tree = RC11). Deploy dpl_Fjqa9SPpTfEWwAhPzjMNewpToKmM is READY; cms/functions/fhfhockey.com were CANCELED. Smoke: 4 GETs, all 200; the RSO chunk c34a8e77 has the streaming UI strings; forge/players has 332 rows on closure bf23edfe. octoberBranch was synced as c3aad5b19 (ours-merge, tree unchanged) and pushed, with no new deployments after 90 s. Still to check: the recent-form read's timing in the Vercel logs on the next real RSO use, and the itinerary in a browser.
- 22:3xZ Matchup-dates fallback diagnosed offline: the 2-minute freshness window in currentProviderPeriod (workspace.ts), not the re-read. Fixed to same-period evidence plus a regression test. RSO tests 55 files / 1466 tests pass in UTC and NY; eslint ok. Local commit only.
- TJ (10-27): hold 620ed5b66 (matchup-dates fix) locally and ship it with the next release batch.
- 22:5xZ RC12 e6bd4068e (refs/rc/2026-10-27-matchup-dates) gated: tsc 0, eslint 0 errors, vitest has the same 6 baseline failing files in both zones. Waiting for TJ's push approval.
- 23:0xZ Release #396 is live: master d35d82a21 (tree = RC12). Deploy dpl_GjFZSEoErkuHiGX8rwKcrythKFae is READY; cms/functions/fhfhockey.com were CANCELED. Smoke: 3 GETs, all 200; new RSO chunk f5558731.
- 23:2xZ Small items done here: rosterPlanning.ts reuses recentForm's WGO column maps; free-agent cards say 'before adding' (waivers keep 'claiming'); two FORGE closure receipts tracked. 20 files / 318 tests pass in UTC and NY; eslint ok; tsc deferred to the release gate. Started rso-layout-slider (local_2beeb32c…) and rso-chain-limits (local_0c61a1b2…).
- 00:xxZ Verified the combined RSO commits (15e86fcc2..d46eb63a9, plus 620ed5b66 already released as #396): 81 files / 2026 tests pass in NY. UTC had 1 failure in a page test under load avg ~111; it passed 3/3 alone, and the whole file passed 230/230 on rerun (timing flake). The FORGE accountability PRD (planning only) is at tasks/prd-forge-accountability-table.md. Next: RC13 for this batch, pending TJ's go.
- 01:1xZ Verified 87d431d6f (full week, Full week reset, collapsible Streaming Plan) and 439966985 (compact cards, L/PP chips from lineCombinations/powerPlayCombinations with 600/1,280 caps, L5 from the existing WGO rows). Combined RSO suite: 81 files / 2041 tests pass in UTC and NY. Batch 15e86fcc2..439966985 is local and unreleased; RC13 waits for TJ's go.
- 01:2xZ RC13 cae4d72db gated: tsc 0, eslint 0 errors, 7 scss pure; vitest has the 6 baseline failing files plus a TeamStandingsChart load flake (3/3 alone), in UTC and NY. Waiting for TJ's push approval.
- 01:4xZ Release #397 is live: master 2126296d2 (tree = RC13). Deploy dpl_5ptpWd2xQFyj7yNqUpbWJRsSp9ux is READY; cms/functions/fhfhockey.com were CANCELED. Smoke: 3 GETs, all 200; RSO chunk 749cdba6 has Full week / Planning from / Show fewer.
- 2026-10-29 12:0xZ TJ's real-league check of #397 (his tab, pulled into my group):
  - Preview swap and Use this streaming plan were disabled because 'Confirm planning inputs' was unpressed and hidden in the collapsed League rules section; no reason was shown.
  - Timed upkeep ran a full provider snapshot every ~5 min (11:51:49, 11:57:00, 12:02:11Z); at ~65 reads each that is ~780/h. onLine was true this time, so upkeep ran; the 2b windows ran offline, so it never showed.
  - The unprompted reload was navType 'reload' with wasDiscarded false, and no site code reloads the page; most likely Chrome restarted the renderer under load (avg >100). Persistence held.
  - TJ approved pausing: tab navigated to newtab at ~12:03Z. TJ pop-up: stopgap now (30-min cadence and a 60-min idle stop while the diet flag is off), diet later.
  - Started session rso-upkeep-confirm (local_bea8d0a5…).
- 12:4xZ Verified c3cf52629 (30-min diet-off upkeep with 60-min idle stop; visible confirm gate). RSO suite: 81 files / 2048 tests pass in UTC and NY. Local and unreleased.
- 13:2xZ RC14 008f70c6b gated: tsc 0, eslint 0 errors, 2 scss pure; vitest has the 6 baseline failing files in UTC, plus one planner-test timeout in NY under load (145/145 on 2 reruns). Waiting for TJ's push approval.
- 13:4xZ Release #398 is live: master fec2ba2d2 (tree = RC14). Deploy dpl_EWsgH9tqSEriPPS1iiNms4WF7vj3 is READY; cms/functions/fhfhockey.com were CANCELED. Smoke: 3 GETs, all 200; RSO chunk 9d603752 has the confirm-gate text and the 30/60-min constants.
