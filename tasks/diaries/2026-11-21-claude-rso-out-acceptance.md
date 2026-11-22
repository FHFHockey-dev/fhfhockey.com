# 2026-11-21 · Claude (Chef) · RSO Out-player real-league acceptance

## Scope
Real-league acceptance of the released Out-player correction (#457/#458/#460): Out players inspectable but unranked,
not in swaps, DTD counted, IR unaffected, healthy alternative recommended. Separate optimizer defects from
missing/withheld FORGE inputs; isolate the top verified mismatch; narrow local fix + regression test.
No Yahoo roster changes, forced sync, production writes or deploy.

## Where
- Checkout /Users/tim/Code/fhfhockey.com, octoberBranch HEAD 3ee9e7dea.
- Deployed production (fhfhockey): f47905d28, dpl_9YQAY1gpwwe8XBa1qWDExzaGzevP READY. Out fix master 2b8651da8 is an ancestor.
- RSO code unchanged 2b8651da8..f47905d28. octoberBranch carries unreleased lineupGaps.ts L11 change (2ed7f404a).

## State / checks
- TJ pop-up: approved ONE production RSO tab, one auto-load snapshot (~64 Yahoo reads), no refresh/sync, no changes.

## Next
- Open tab, check navigator.onLine, capture evidence.

## Blockers / approvals
- None yet.

## Gotchas
- Opening RSO auto-loads access check + provider snapshot + goalie confirmations; one tab only.

## Real-league window (one tab, one snapshot) — closed
- TJ selected team "FHFH TJ – 2026-27 FHFH" himself. Requests: access, workspace, schedule, provider (1x, 8.3 s),
  yahoo-current-data (1x). No Refresh/Sync pressed, no roster/settings/matchup changes. Tab closed.
- Provider diagnostics: 58 availability pages, 1393 rows. Roster 19: DTD Panarin (amber, in Sat LW slot);
  Demidov + Larkin in IR+ with OUT tag "not counted while he's listed Injured Reserve", AGP 0. No Out players on
  active/bench. Best Fit (By more starts) top 10 has no injured players.
- FORGE INPUT GAP (not optimizer): all 17 active players' Sat 11-21/Sun 11-22 games carry
  "no projection (serving disabled)" -> lib/rosterScheduleData/planning.ts:203-205 (shared serving off) and the
  interim bridge did not serve (RSO_FORGE_DAILY_BRIDGE off, or bridge empty — not yet distinguished).
- Consequence: "Best projected points" disabled ("Needs usable projections for at least part of your lineup"),
  Most starts pressed. That is the truly-unavailable safeguard, observed in production.
- Not verifiable in this league today: Out players not ranked/in swaps (none on roster, none in Best Fit top 10),
  healthy alternative in points mode (no projections). Label: partially verified; fixture needed.

## Paused 2026-11-21 for TJ's two customer bugs (objective switch, Pettersson identity). Resume afterwards.

## Bug 1 — points league stuck on Most starts (TJ 2026-11-21)
- Planner probe (objectiveSwitchScenario, real planRoster): points availability identical under saved agp vs outcome
  intents; full/partial forecasts -> available, no forecasts -> blocked. Planner is not the defect.
- Reproduced in the component with the persisted Yahoo setup() fixture: access granted -> points->starts->points and
  reload all work. Reload while /access fails, is pending, or sync not granted -> readOnlySaved locks BOTH goal
  buttons on the saved Most starts with no title/description (looks like "points unavailable").
- Production 11-21 (TJ league): points disabled with "Needs usable projections…" = FORGE serving disabled, a truly
  unavailable state (not this bug).
- Fix (RosterScheduleOptimizer.tsx, ~10 lines): goalReadOnly reason (saved view / preservation hold / signed out /
  checking access / access unverified / no sync access) on both buttons via title + sr-only aria-describedby;
  projection reason kept for points. Lock policy unchanged (edit() still refuses while readOnlySaved).
- Tests: 5 new in __tests__/.../RosterScheduleOptimizer.test.tsx ("lineup goal in a persisted Yahoo points league");
  4 fail without the fix, 5 pass with it. Open question for TJ: let the goal change while only provider access is missing.
- Added test: account-saved league across reload + two Refresh provider presses keeps the goal and the switch (6 tests).

## Bug 2 — VAN D Elias Pettersson "no unique canonical identity"
- Message: web/lib/integrations/yahoo/rosterPlanning.ts:513; all four failure kinds collapse into it.
- TJ-approved read-only SELECTs (2 of 4 used): canonical 10377/NHL 8483678 (D) and 9780/8480012 (C) both verified,
  active_nhl, team 23, ZERO Yahoo crosswalk rows in any season. Yahoo keys 477.p.32762 (D) and 477.p.7520 (C) exist
  for game 477/2026. Aho C 477.p.6777 -> 9327 verified. Aho D 477.p.7654: no row, canonical 8589 lifecycle inactive.
  => Pettersson D (and C) = case (a) missing mapping. Aho D = (a)+(d) absent from catalog.
- Lease RSO-CUSTOMER-BUGS-1121 recorded in CLAUDE-LEASES.json (TJ pop-up); RSO-FLAKE / RSO-YAHOO-DIET-P2 untouched.
- Tests: dailyAcceptance.yahoo.test.ts (h), both reader paths, exact keys: missing, corrected (10377 on roster + D slot,
  9780 rostered elsewhere), conflicting, wrong season (465), absent catalog (Aho D), crossed row it.fails pin.
  Crossed row verified to land on center 9780 silently (known gap; guard is TJ's call).
- Proposal: tasks/artifacts/rso-pettersson-identity-2026-11-21/REPAIR-PROPOSAL.sql (2 rows, NOT EXECUTED).
- Gates: 5 files 443/443 pass; eslint 0 errors (6 pre-existing warnings); npm run typecheck EXIT=0, 0 errors.
- Diff for review: scratchpad rso-customer-bugs-1121.diff (not in repo).

## Injury acceptance resumed (closest fixture)
- 8 files, 114/114 Out/DTD/IR tests pass: Out searchable but unranked (CandidateBrowser), never the swap
  (CandidateCard), not in streaming pool so next healthy streamer proposed (streamingChain), never takes the planner's
  candidate slot (planning), DTD counted with caution (planning/RosterPlayerRow/CandidateCard), IR row names only (SlotWeekGrid).
- Real league: BLOCKED for points-mode claims on 11-21 (FORGE serving disabled -> no projections); IR+ players show the
  OUT tag in the roster list, AGP 0, not counted.

## Next
- TJ decisions: (1) goal change while only provider access is missing, (2) crossed-row guard, (3) execute REPAIR-PROPOSAL.sql.
- Nothing committed. Lease RSO-CUSTOMER-BUGS-1121 stays active until TJ decides.
- Bug 1 follow-up: account copy saved on agp + local on outcome -> reload keeps local; "View account save" locks both
  buttons with the saved-inputs reason; "Continue manually" unlocks; points sticks across reload. Component file 253/253.
- Catalog filter verified in planningInputs.ts:223-235 (verified, active_nhl, unmerged, unique NHL id).
- Open for TJ: IR+ players carry the OUT tag in the roster list on production (11-16 scope said IR row unchanged; fixture
  only asserts the grid IR row). Likely cause of 'serving disabled' (no FORGE run today, label kept because bridge
  returned no rows) is unverified and belongs to the off-day lane. No narrow fix/regression for it yet (outside carve-out).

## TJ follow-ups (pop-ups 2026-11-21) — done locally, nothing committed
- Goal unlock: accessOnlyLock (readOnlySaved && !planHeld && !viewingSaved) lets only the lineup goal change via a
  local setWorkspace; private Yahoo planning read (yahooPrincipalId) is off while access is the sole lock. Without that
  gating each toggle set up a Yahoo planning read (4 -> 7 in test). Fallback note when points chosen but schedule shown.
- Position guard: rosterPlanning.ts resolve() refuses a verified row whose Yahoo G/D/F class is disjoint from the
  canonical class (captured before Yahoo overwrites positions); own-roster message names the conflict; diagnostics
  count refused keys. rosterPlanning.test.ts added to the lease (TJ) for the class-mismatch case only.
- SQL rehearsal: disposable PG 15.19 (loopback TCP, LC_ALL=C), exact migration DDL + production evidence seed:
  apply 3->5 rows, view + both TS resolvers map 32762->10377, 7520->9780; second run refuses; rollback restores
  byte-identical table; key/target/other-season conflicts, changed evidence and a late failure all stop unchanged.
  Final REPAIR-PROPOSAL.sql sha256 c3e4e49a4e77ee7a1d9677c92a409519cbb4ceef855b036371400afa71083a96 (rehearsed).
- Gates: 6 files 465/465; eslint 0 errors (6 pre-existing warnings). Pre-existing unrelated failures:
  writerPermissions.test.ts (YAHOO-WRITER static check), forge-pregame-stage.test.ts (own pg_ctl start fails here).
- Advisor fixes: private-read gating now only after a goal change under the access lock (an access-granted reload
  measured 3 /data reads with the first gating vs HEAD 2; now 2 + 2 broker, pinned by test). Conflict count now
  includes the opponent roster. match_method renamed manual_review_stable_yahoo_id_position; re-rehearsed.
  FINAL REPAIR-PROPOSAL.sql sha256 0827b507d2edb34dfa2dcf1b1cecf62ed4d9f1e9d74381b99043d3cc21c1e3e3.
- Active production reader: legacy view (capture lacked the diet-only "Yahoo reads this snapshot" line).
- Same-rule resolvers NOT guarded (outside carve-out): planningConfirmations.ts, starterBoard.ts, yahooEligibilityCache.ts.
- Guard release precondition (read-only, not run): count of verified 477 rows with disjoint classes; local check 0 / 1.
- Gates: 6 files 466/466; eslint 0 errors. Neither UI change viewed in a browser.
- Final typecheck (npm run typecheck): EXIT=2, 1 error (see below).
- Fixed TS18048 in my rosterPlanning.test.ts line (diagnostics ?? []). Re-run: npm run typecheck EXIT=0, 0 errors; rosterPlanning.test.ts 104/104.
- TJ approved PRECONDITIONS only (step 1); ran once, read-only: canonical_ok, yahoo_ok, unclaimed_ok, uniques_ok all
  true; reader md5s 495ccc43…/88f9440f… == rehearsal (no drift). Insert NOT run.
- Deployed f47905d28 resolver chain byte-identical (yahooIdentity.ts, gameContext.ts, planningInputs.ts); deployed
  rosterPlanning.ts differs only by my uncommitted guard. Legacy view path active => the two rows would fix the live
  lookup with no deploy. Next: separate two-row approval for a quiet slot after current FORGE work clears.
- Production reads this session: 2 SELECTs (classification) + 1 preconditions block. No writes.

## Next (as of end of turn)
- TJ: approve the two-row repair for a quiet slot (sha256 0827b507d2edb34dfa2dcf1b1cecf62ed4d9f1e9d74381b99043d3cc21c1e3e3).
- Code (goal unlock, reason text, position guard) is local and uncommitted; release needs the normal Chef gate + TJ.
- Out-player acceptance open items: IR+ OUT tag mismatch, FORGE "serving disabled" cause (off-day lane), points-mode
  real-league claims blocked until FORGE serves.
- Not guarded yet (outside carve-out): planningConfirmations.ts, starterBoard.ts, yahooEligibilityCache.ts.

## Repair run approval (TJ 2026-11-21 ~18:30Z) — WAITING FOR CLEARANCE
- TJ approved ONE run of REPAIR-PROPOSAL.sql sha256 0827b507d2edb34dfa2dcf1b1cecf62ed4d9f1e9d74381b99043d3cc21c1e3e3,
  only after explicit clearance that FORGE is done and the slot won't overlap BLSH; recheck deployed reader + every
  precondition right before; stop on any mismatch; verify via the active RSO read path after commit; no retry.
- 18:31Z: NOT cleared. CLAUDE-DAILY-OFFDAY-PUSH-HOLD-20261121 (18:17Z) in force: FORGE Chef pushing 096b78b6, no
  release/done note yet; BLSH install held, no reservation posted. Nothing run.
- 096b78b6 vs f47905d28: 5 files, none in yahoo/, planningInputs, RSO or migrations (recheck anyway at run time).
- Run-time checklist: (1) sha256 of file; (2) prod deployment SHA + reader files byte-identical to rehearsed;
  (3) PRECONDITIONS block all true + md5 495ccc43…/88f9440f…; (4) execute file once; (5) readback via
  yahoo_nhl_player_map_read + legacyYahooIdentities on live rows; (6) receipt in this diary.

## RECEIPT — Pettersson crosswalk repair EXECUTED once (TJ approval + TJ "Cleared, run it", 2026-11-21)
- 18:32:28Z pre-checks: REPAIR-PROPOSAL.sql sha256 0827b507d2edb34dfa2dcf1b1cecf62ed4d9f1e9d74381b99043d3cc21c1e3e3 (match).
  Production fhfhockey = 096b78b6 (dpl_2psc7uGM4UhXgEFHwmhrVx8GA3G1 READY, nothing building); yahooIdentity.ts,
  gameContext.ts, planningInputs.ts byte-identical to rehearsal; rosterPlanning.ts == f47905d28; no new migrations.
  PRECONDITIONS: canonical_ok, yahoo_ok, unclaimed_ok, uniques_ok all true; md5 495ccc43…/88f9440f… == rehearsal.
- Executed the file's transaction (lines 13–70) once. No error -> committed; in-transaction checks passed.
- Post-commit readback (read-only): exactly 2 rows with this repair tag, verified_at 2026-11-21T18:33:03.547823Z:
  477.p.32762 -> fhfh 10377 (D), 477.p.7520 -> fhfh 9780 (C), ctx yahoo:game:477:season:2026, season 20262027.
  yahoo_nhl_player_map_read: 477.p.32762 -> NHL 8483678, 477.p.7520 -> NHL 8480012 (only rows for these keys/players).
  Live rows through deployed-identical legacyYahooIdentities and uniqueVerifiedYahooIdentities: 32762 -> 10377, 7520 -> 9780.
- No retry, no other row changes, no Yahoo call/roster write, no push or deploy. Rollback block in the file stays unexecuted.
- Not done: no authenticated customer-league UI check; that user needs Refresh provider (one Yahoo snapshot) to see it.

## Real-league goal round trip on the local patch + release candidate (TJ, 2026-11-21 ~13:35 CST)
- Where: TJ's :3000 dev server (canonical web/, local patch hot-loaded); one Chrome tab, closed after. Source Manual -> Yahoo,
  team "FHFH TJ — 2026-27 FHFH" (b8a23dca…). No Optimize lineup, Refresh, Sync, Save to account, roster or Yahoo write.
- Round trip: points* (restored) -> starts -> points -> starts; reload (comes back on Most starts) -> points -> starts.
  Every press switched aria-pressed, no button disabled, no lock reason. yahoo-current-data reads: 1 per load + 1 per press
  (5 before reload, 5 after).
- Projections in this league today: 1 of 15 remaining plays priced (McDavid Sun @STL 3.6); 14 "Expected fantasy points:
  unavailable". Planner therefore selects by schedule capacity in BOTH goals (planning.ts:1133 selectionMethod =
  unresolved.length ? schedule_capacity : quality); UI says "Lineup by schedule capacity", Compare 14 GP · — pts both rows,
  lineup identical. Real-league proof that points mode uses projections: BLOCKED (FORGE input gap, not the toggle).
  Side note: Panarin now listed OUT (was DTD this morning), not counted; Demidov/Larkin IR+ OUT unchanged.
- Fixture proof (component, real planner, persisted Yahoo setup): new test "re-plans Most starts -> Best projected points ->
  Most starts from the projections" asserts selected Compare row + Matchup "Selected plan" flip 4 GP/-3 <-> 2 GP/3 pts each
  press and after reload, never "schedule capacity". Mutation (force agp into planner) fails the test; restored.
- RC: refs/rc/rso-customer-bugs-20261121 = 1a3db29d5 (tree 74276d30f) on origin/master 096b78b62; 5 lane files only
  (base blobs identical on HEAD and master; no import changes; no .module.scss -> CSS pure check N/A). Not pushed.
- RC gates (clean git archive of 1a3db29d5: web/ + supabase/ + the two tasks/artifacts folders tests import; node_modules
  symlinked): vitest RSO component + lib/integrations/yahoo + lib/rosterScheduleOptimizer = 54 files, 1519/1519 pass;
  eslint on the 5 files exit 0 (6 pre-existing warnings); npm run typecheck EXIT=0, 0 errors. First pass on web/ alone
  failed only on missing root folders (writerPermissions migrations, supabase/functions, tasks/artifacts imports).
- Next: TJ decision on release (push/merge to master = Vercel builds; inventory projects first). Lease stays active.

## Release prep for 1a3db29d5 (TJ "Prep the release", 19:48Z) — NOT pushed
- 19:48Z: origin/master (ls-remote) = 096b78b62; READY production fhfhockey dpl_2psc7uGM4UhXgEFHwmhrVx8GA3G1 on 096b78b62
  (aliases fhfhockey.com, www). RC parent = 096b78b62 (fast-forward today).
- Queue (mailbox + Codex diaries): FORGE repair DB write 19:55–20:00Z (approved); Yahoo 2236ecb7 20:05–20:30Z (migration +
  build + readback, awaiting TJ); News 54a1cf2c approved for first clear slot after Yahoo readback (rebases if master moves).
  No path overlap with RSO (Yahoo: ownership-trends + migration; News: tweet-pattern-review + tests + migration).
  Posted RSO-CUSTOMER-BUGS-RELEASE-QUEUE-20261121 in CLAUDE-TO-CODEX.md asking for the slot after News readback.
- Projects: 4 git-linked production entries per master push: fhfhockey builds (~8–10 min); fhfhockey.com, cms-fhfhockey,
  functions-fhfhockey cancel (pattern held for 096b78b62, f47905d28, 3e360ae4). `web`, `functions` never deploy.
  web/vercel.json ignoreCommand builds only when web/ (or cron-schedule.md) changed → RSO changes web/ → 1 build.
- Rollback target = READY fhfhockey deployment immediately before RSO's (today dpl_2psc7uGM…; after Yahoo/News it is News's).
- Pettersson SQL: not rerun. Fixture ≠ live points acceptance; live points recheck waits for FORGE coverage.
- 19:51Z TJ approved the release plan ("Approve plan"). Next: wait for Yahoo + News releases/readbacks, rebase the 5 blobs onto new master, re-gate, return the exact SHA for push approval.
- 19:58Z BLSH-QUEUE: TJ order Yahoo → News → BLSH (conditional, install by 22:20Z) → RSO. Acked 20:00Z; RSO waits for BLSH release/readback.
- 20:12Z Yahoo released 2236ecb7; 20:2xZ News READY on b37a0180d; 20:29Z BLSH re-gating on b37a0180, RSO holds.
- Rebuilt locally (no push): refs/rc/rso-customer-bugs-20261121-b37a0180 = 66bd76d10 on b37a0180d — same 5 blobs as
  1a3db29d5 (base blobs unchanged by Yahoo/News). Clean-export gates: vitest 1518/1519 (planning.test.ts 13-day case timed
  out at 5 s under load avg ~14 while BLSH gated; file rerun alone 185/185, that case 2.5 s), eslint 0 errors, typecheck 0.
- 20:51Z BLSH pushed c922514df (no RSO-path overlap) and holds all other pushes until BLSH-RELEASED (~21:45Z).
- Rebuilt: refs/rc/rso-customer-bugs-20261121-c922514d = 356f93a5d on c922514df, same 5 blobs. Clean-export gates:
  vitest 54 files 1519/1519, eslint 0 errors (6 pre-existing warnings), typecheck 0. (gate.sh exit 1 = grep -c of 0 errors.)
  Next: after BLSH-RELEASED, recheck master + READY alias; rebuild if master moved; ask TJ to approve the exact push.
- 21:14Z BLSH-RELEASED. 21:15Z recheck: remote master c922514df = RC3 parent (FF ok); READY fhfhockey dpl_DebFbbRByWvcVCdBTJc7FewDhu5w on c922514df, nothing building (3 siblings CANCELED). Rollback target = dpl_DebFbb… . Asking TJ to approve push of 356f93a5d.
- 21:15:53Z TJ approved (pop-up "Push 356f93a5d"); reservation posted; remote master rechecked = c922514df; pushed 356f93a5d -> master (FF). Waiting on Vercel build.
- RELEASED: 356f93a5d → fhfhockey dpl_jctZodFpjBZBP3J9sUW6unLiYxEx READY (aliased fhfhockey.com); fhfhockey.com/cms/functions
  CANCELED. Smoke (sequential): (1) list_deployments sha OK; (2) anonymous GET /roster-schedule-optimizer 200 0.35s 21:24:08Z;
  (3) one signed-in tab, TJ league, saved goal points: starts → points both switched, enabled, no lock reason; 4
  yahoo-current-data reads total (2 load, 1 per press); no Optimize/Refresh/Sync/Save/roster write; tab closed.
  Live coverage at 21:2xZ: 9 of 15 remaining cells priced, "5 players with unknown projections" → still schedule capacity;
  live points-mode acceptance remains OPEN until FORGE prices every active play.
  Posted RSO-RELEASED (21:26Z). Rollback target dpl_DebFbbRByWvcVCdBTJc7FewDhu5w. octoberBranch sync not done (needs TJ go).
- Sync (TJ "Sync octoberBranch"): full merge of origin/master (67 commits ahead) into octoberBranch conflicts in 4 files
  owned by other lanes (Yahoo ownership-trends.test.ts; FORGE hostedReaders.ts, run-forge-projections.ts,
  verifiedForgeReleases.test.ts) → not done by RSO. RSO part done: octoberBranch 73c6806ce commits the 5 released blobs
  (byte-identical to 356f93a5d), explicit pathspecs, local only, not pushed (branch ahead 3 incl. Rankings 42a1502ff).
  Lease RSO-CUSTOMER-BUGS-1121 marked released (2026-11-21T21:27Z).
- TJ: "Owning lanes". Sent ticket to FORGE Lane [8406e7] (merge + FORGE conflicts, no push); posted RSO-SYNC-YAHOO-20261121 to the Codex Yahoo lane for ownership-trends.test.ts. RSO done; diary kept as the lane record.
- 22:03Z FORGE lane done: octoberBranch 84b405ca8 = merge of master 523ba0108 into 6339d3897. Verified: master and 73c6806ce are ancestors; RSO 5 files identical to 356f93a5d and to master; no conflict markers under web/; not pushed (ahead 74 of origin/octoberBranch). RSO lane closed; open item = live points-mode acceptance once FORGE prices every remaining play.

## Live points-mode acceptance (TJ 2026-11-21 ~22:50Z) — check 1: coverage INCOMPLETE
- Deployed: fhfhockey dpl_w4ThHx3Y9McLFEYUygUusxGPRfkh READY on master 523ba0108 (contains RSO 356f93a5d).
- One signed-in tab, FHFH TJ — 2026-27 FHFH, 22:53Z; 2 yahoo-current-data reads (page load), no presses, no writes; closed.
- Window: matchup week Mon Nov 16 – Sun Nov 22, plan from Sat Nov 21. Saturday plays priced (Granlund 2.8, Caufield 3.9,
  Batherson 2.8, Yamamoto 3.0, Lekkerimäki 2.7, Seider 3.1, Tuch 2.7, Hart 2.7/4.1 if GS); McDavid Sat @CAR already
  started (locked). Remaining unknown = 5 players, all Sunday Nov 22:
  McDavid EDM @STL; Carlson + D'Astous TBL vs BUF; Heiskanen + Oettinger (G) DAL vs PIT. Lekkerimäki VAN vs CHI priced 2.6.
- Page: "Forecast coverage · 70/98 assignment targets"; interim bridge = each player's latest FORGE v2 daily line
  (runs 11-14..11-21), "25 of 32 teams covered"; baselines/participation partial (serving_disabled). Tile 130.3 known part;
  "Lineup by schedule capacity"; Compare 14 GP · — pts both rows. Points still falls back → toggle NOT retested.
- Next expected FORGE: Vercel cron run-rolling-forge-pipeline daily_incremental Nov 22 10:05–10:55Z, then
  forge-served-forecast-snapshot 12:40Z. Recheck after ~13:00Z Nov 22 (before Sunday puck drops). No rerun triggered.
- Pettersson: reuse verified mapping (18:33Z receipt); customer screen UNVERIFIED until they confirm after one Refresh provider.
- 00:38Z Nov 22: previous session ended; wake timer re-armed (task b4wx4gjub) for 13:05Z Nov 22 coverage recheck. Release-queue watchers not re-armed (release finished).
- TJ AFK 5am CST–1pm EST Nov 22; chose "Move to 1:05pm EST": 13:05Z timer stopped, re-armed for 18:05Z Nov 22. Plays already started by then can't be tested.

## Live points-mode acceptance — check 2 (Nov 22 14:08Z, TJ online) — BLOCKED for this window
- Deployed: fhfhockey dpl_A6wXhPbxbrNJWGCThoe5bsouyHmG READY on 480bd5d71 (contains 356f93a5d; RSO paths unchanged since).
- One signed-in tab, Week 8 (Mon Nov 16 – Sun Nov 22), remaining = Sun Nov 22 only; 2 Yahoo reads (load), no presses, closed.
  Coverage "6/34 assignment targets"; interim bridge lines runs 11-15..11-21, "5 of 32 teams". Priced: Lekkerimäki VAN vs CHI 2.6.
  Unknown (same 5): McDavid EDM @STL; Carlson + D'Astous TBL vs BUF; Heiskanen + Oettinger DAL vs PIT. Tile 127.0 known part,
  "Lineup by schedule capacity"; toggle not retested (would only show the fallback).
- Cause (existing readback, Chef off-day diary 2026-11-21-claude-chef-offday-release.md §Nov 22): 11:15Z natural-run
  acceptance FAIL 422 — 0 runs for 11-22, 0 writer rows, all 5 games 2026020373–0377 missing; pipeline
  upstream_skater_sources FAILED (undiagnosed). Earlier trace: TBL/DAL lines expired 11-21 10:41Z; McDavid's only newer
  line is a pregame receipt fenced out of Daily. No scheduled FORGE run remains before this week's last games.
- Blocker for live acceptance: a successful FORGE daily run. Earliest chance: Week 9 after Nov 23 10:05–10:55Z run +
  12:40Z snapshot, IF upstream_skater_sources is fixed (off-day Chef lane owns it). 18:05Z timer stopped.
- TJ (Nov 22): recheck live points mode only once FORGE's upstream_skater_sources failure is fixed and a daily run prices the window. No timer armed. Next step then: one tab, confirm full coverage, starts → points → starts + reload, record SHA/window/coverage + one points-driven lineup difference.
