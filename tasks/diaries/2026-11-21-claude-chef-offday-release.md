# Chef · 0359 close check + daily off-day release proposal (Nov 21)

- Scope: (1) cite proof that live 2026020359 published once before puck drop, both RSO views selected the same run, and close and cleanup are done (no reruns); (2) compare Astra `096b78b62` with Claude `37a43ad9a`, coordinate with Astra (daily owner), and prepare one release and recovery proposal. No production changes and no deploy.
- Where: octoberBranch, `/Users/tim/Code/fhfhockey.com`. Files written: `tasks/artifacts/daily-offday-release-2026-11-21/PROPOSAL.md`, plus an append to `CLAUDE-TO-CODEX.md` (CLAUDE-OFFDAY-COORDINATION-20261121). No git mutations.

## 0359: proven (read-only, 17:24–17:29Z)
- `live_runs`: capture qualified 16:20:16.9Z, claim f55203dc. Publish ran 17:25:01.7→17:25:05.2Z. Revision 365d0704. Outcome succeeded / readers_recorded; terminal 17:25:05.23Z, 55 min before the 18:00Z puck drop.
- `publications where claim_id=f55203dc`: count = 1. `forge_witness.signed_verdicts`: 1 row, 1 accepted (key 469bc6093b6ffc11).
- Readers: Daily selectedRun f55203dc (revisionId `forge-daily-bridge-v1:f55203dc…`), McDavid C#1 3.812. Detailed selectedRun f55203dc, revisionId 365d0704, but missing_participation (identity_conflict exclusion), so no points. The labels match the accepted sealed baseline: both views select the same claim, whose single publication is 365d0704.
- Cleanup was done by the other Chef session: receipt `tasks/artifacts/forge-live-release-2026-11-19/live-0359-20261121/READBACK-0359.json` (sha 30f6e72b…08df, verified). Jobs 421–424 gone, 408 off, 0 open runs. Unexposed at 17:26Z; my probe at 17:29Z returned PGRST106 with the 4 default schemas. Mailbox close note FORGE-0359-CLOSED-20261121.
- Gotcha: my 17:26:24Z probe still returned 42501 (exposed). It raced the 17:26Z unexpose. Re-probe before calling cleanup incomplete.

## Off-day
- Astra's candidate is a fast-forward of origin/master with its closure registered. The pipeline and routeRunner already accept `skipped_no_completed_games`. Claude's commit is on octoberBranch, has no registered closure, and adds a new status. Chosen: Astra's. Claude's is withdrawn (revert proposed).
- Recovery blocker: the run scope key is (mode, date). Today's scope is attempts_exhausted, so deploying alone won't recover today.
- Upcoming checks: Nov 22 is the nonempty control, Nov 25 has 1 game, Nov 26 is the first live off-day, so the Nov 27 run is its acceptance. 13 of today's games start 20:30Z–03:00Z.
- Next: Astra answers the 3 asks; TJ approves the exact SHA, slot and recovery; then 37a43ad9a is reverted on octoberBranch.

## 17:40Z: TJ made Chef the single owner of the off-day fix and same-day recovery prep (prepare only: no push, reset, rerun or production write)
- 37a43ad9a withdrawn locally: commit 11bea873f (revert, only its 5 files, no push).
- Exact RC 096b78b62 gated on a clean export: vitest 7 files / 335 pass, eslint 0, typecheck 0, production admission pass (closure 0446100e). Receipt: `tasks/artifacts/daily-offday-release-2026-11-21/gates/GATES.json`.
- Lanes:
  - [offday-proof](local_0a191d15…) covers the downstream zero-game stages plus a nonempty control.
  - [recovery-plan](local_7904279e…, fork) covers the bounded recovery.
  - Both are due 19:05Z.
- Findings:
  - The daily pipeline hasn't completed since Nov 16. Nov 17–19 failed at run-projection-v2 (`invalid_row`), Nov 20 upstream, Nov 21 at the NST off-day.
  - Nov 19's source-date stages after rolling never ran.
  - The live 0359 run is a forge_runs row for 2026-11-21 (run_id = claim, 1 game).
  - run-projection-v2 accepts `gameIds`, enough to recover unstarted games only.
- Next: integrate both lanes' results, recheck master, holds and the clock, then the 19:30Z packet.

## 17:46Z
- recovery-plan lane delivered RECOVERY-PLAN.md (sha ae353f3e…). It is Option B: one scoped run-projection-v2 for the 13 unstarted games, on f47905d28, with no reset, no pipeline call and no deploy needed. Latest safe start is 20:10Z.
- Chef verified:
  - the resume key is `h1:<sorted ids>`;
  - Start Chart's H3 newest-selected-games overlay;
  - derived build 10:25Z failure (deferred 2026-11-19).
- NEW RISK: the stage-7 derived backlog (game 0357 manifest) may block Nov 22's scheduled run even with the fix. Ticket sent to offday-proof.
- PROPOSAL.md rewritten: recovery before the push, with each as a separate approval.
- Next: offday-proof report (19:05Z); confirm repair slot + BLSH install finished; packet.

## 17:58Z
- offday-proof receipt verified (6aa3e0a6…). Off-day passes every stage after NST except stage 7, which fails on game 0357's pending manifest (independent of the off-day). projection_execution is unproven on a full slate. Nonempty control passes.
- Follow-up ticket sent to offday-proof for the exact 0357 refresh (FIX-0357.md).
- APPROVAL-PACKET.md drafted: A recovery, B release, C 0357 refresh (pending).
- Next: confirm the repair slot and BLSH install have cleared, re-check preconditions, then present A + B.
- 18:03Z: offday-proof v3 (df85badd…) revised stage 7 to pass. Chef verified projectionDerivedQueue.ts:74-87: 0357 never queues while its relationship is pending, and the 11-19 date is not queued. Batch C (0357 refresh: ingest, then shift-charts, then derived) is now an optional quality fix for SEA/VAN.

## 18:06Z: TJ APPROVED A (recovery, 13 ids, on f47905d28, ≤3 GETs, after the repair reaches a terminal result) and B (FF push 096b78b62 after A). C deferred. Verbatim in TJ-APPROVALS.md.
- 18:12Z preflight (read-only, recovery/run/state.sql + schedule.sh):
  - only the live f55203dc run for 11-21 (36/2/2 rows), 0 running, no active writers;
  - 0359 terminal;
  - all 13 games FUT, ≥137 min away;
  - prod = dpl_9YQ… Ready on fhfhockey.com.
- BLSH install HELD (old Chef relay plus TJ-INSTRUCTIONS 12:05 CT ruling, lines 73–85: FORGE gets the first slot). Promised the BLSH lane (local_f83c2634) the new master SHA and deployment ID afterwards.
- Waiting for the appearance-repair terminal note (slot 18:10–18:15Z); watcher fires 18:24Z.

## 18:13–18:17Z: Batch A done, Batch B pushed
- The repair is terminal: committed 18:10:48Z, xid 15054058, slot released. Preflight re-run clean at 18:13:39Z.
- A call 1, 18:13:43→18:15:33Z, HTTP 200, success. Run ced8d73f is `succeeded` on f47905d28 with selected_games covering the 13; 36 players per game, 26 team, 26 goalie rows. The 0359 rows and record are unchanged.
- Start Chart (1 GET): projectionRunId ced8d73f, mode exact, sourceStatus ready, gameRuns 0360–0372. 0359 shows goalies only: the live run f55203dc is not in Start Chart's gameRuns (observation, record untouched).
- Daily RSO (1 GET): 810 bridge rows over 0360–0372, all from run ced8d73f with closure proof. At 11:06Z it served 0.
- Receipt: recovery/run/RECOVERY-RECEIPT.json (sha 4c773e49…).
- 18:17:13Z PUSHED 096b78b62 (FF from f47905d28) after the push-hold note. The build watcher is running.
- FIX-0357.md (offday-proof) logged as a follow-up (TJ: later).

## 18:34Z: Batch B verified, slot handed to BLSH
- Production is READY: dpl_2psc7uGM4UhXgEFHwmhrVx8GA3G1 (096b78b62, CLI commit filter), aliased fhfhockey.com and www, built in 4 min. functions and cms canceled. The fhfhockey.com project entry is unresolved (the CLI name resolves to the main project).
- Smoke runs/latest 200, serving ced8d73f. Receipt release/RELEASE-RECEIPT.json (sha 79f16383…). Rollback target dpl_9YQ….
- Mailbox: hold lifted (CLAUDE-DAILY-OFFDAY-RELEASED-20261121). BLSH lane messaged with the SHA and deployment id.
- Open:
  - octoberBranch sync from 096b78b62 (needs TJ go-ahead, ours-merge plus no-build watch);
  - Nov 22 10:05Z readback (nonempty control, first full-slate projection since the invalid_row fix);
  - Nov 27 off-day live acceptance;
  - FIX-0357 (TJ: later);
  - Start Chart doesn't list live run f55203dc for 0359 (observation).

## 18:5xZ: octoberBranch reconciliation prepared, not executed (TJ: tips untouched; reconcile once after BLSH and the checkpoint)
- merge-tree of 11bea873f with 096b78b62 (base 02f0426d5) has 3 conflicts: hostedReaders (8 hunks, add/add), run-forge-projections (4), verifiedForgeReleases.test (1).
- Root cause: checkpoint 3ee9e7dea imported Codex's unreleased 74f31aded (FORGE output and capture reliability, closure 0bea3cd4, on no branch). 24 more FORGE files auto-merge silently into hybrids, including forgeDailyBridge.ts.
- A trial in scratch is incoherent: closure 256381ea (not admitted), 3 real type errors, 10 real test failures (record_succeeded_observation / observeSuccess).
- Needs an owner decision: port or drop 74f31aded. Record: octoberbranch-reconciliation/RECONCILIATION-PREP.md.
- Gotcha: zsh treats `$T:web…` as a history modifier (`:w`); write `${T}:path`.
- 19:0xZ TJ: preserve 74f31aded (done: local tag preserve/74f31aded-forge-output-reliability); compare in an isolated worktree (done: /private/tmp/forge-74f31aded-compare-20261121, detached at 096b78b62); leave superseded changes out; port only required gaps, separately. gap-74f31aded lane started. Branches and checkout untouched.
- 19:1xZ gap-74f31aded done: 0 required gaps out of 116 hunks. Spot-checks pass. Reconciliation resolution: master for all 74f31aded-derived files plus hostedReaders; drop 0bea3cd4. Optional G1–G7 are listed, not ported. Worktree /private/tmp/forge-74f31aded-compare-20261121 is kept clean (remove after reconciliation).

## 20:2xZ: TJ participation policy (Detailed RSO) staffed
- Branches moved since prep: origin/master 2236ecb7c (Yahoo trends release), octoberBranch 42a1502ff (composites test commit). Reconciliation must use the final master.
- New detached worktree /private/tmp/forge-participation-policy-20261121 at 2236ecb7c (no branch). Lane participation-policy (local_96a86520) designs, implements and tests TJ's assumed-playing / assumed-out policy there; design note to Chef first; no release.
- Policy amends decisions 3/47 (unconfirmed participation = unknown) for Detailed RSO; Daily scope only if TJ approves.
- 20:4xZ lane design note: changes only consumerRevisionAdmission (opt-in), planning.ts (rso), hostedReaders; closure unchanged. Chef verified: RSO_USE_POLICY.reviews is empty (review-before-use, D5), so Detailed stays use_not_approved even with the policy.
- TJ pop-up answers: (1) separate confirmed vs possible returns; a credible game-specific "will play"/"confirmed back" report lifts the exclusion at once; an appearance is a fallback for future games only; a newer injury or scratch overrides. (2) Don't bypass review; keep the if-he-plays line, count 0 while out, restore it without a new FORGE run, record availability changes separately; test both catalogs. Relayed to the lane (needs a read-time availability overlay instead of stale_source withdrawal; revised design note before coding).
- Review-scope lane proposed as card task_8cd106fc (the app refused a direct start on a peer-message turn). Worktree /private/tmp/forge-rso-review-scope-20261121 at b37a0180d (master moved again).
- 21:xxZ participation lane rev 1 = 3f1138cb2 (worktree, 5 files, closure 0446100e unchanged, vitest 274 pass, tsc/eslint 0). Chef verified the commit. It PREDATES TJ's answers: RETURN→assumed_playing and late-scratch via stale_source/new revision both conflict. It also found a Daily-bridge regression (P07: the fallback is off when denied rows are admitted). Ticket sent: rev 2 with an availability overlay, split possible vs confirmed return, and a fallback on no USABLE rows (no env flag); revised design note first.
- Rev 2 design (DESIGN-REV2.md in side-session-notes/local_091a3ca0…): read-time overlay, RSO only, no migration, closure unchanged; possible vs confirmed return read from forge_roster_events.payload.subcategory; the bridge falls back when no row is usable (reverses P07). Lineage forge-rso-participation-overlay-v1:skater@<revisionId>, component forge-detailed-skater. Chef approved with one gap closed: later roster injury/scratch events must override. Q1: appearance via wgo_skater_stats, future games only. Q2: a confirmed roster RETURN covers the next game only. Q3: line/PP changes keep the line with a note.
- Rev 2 fe2dafd64 verified by Chef: 6 files (new rsoParticipationOverlay.ts), closure 0446100e unchanged, focused rerun 366/366. Sequence and Daily fallback per REPORT-REV2.md. Gap: basis notes live in forecast.limitations, which ForecastEvidence.tsx doesn't render, so assumed vs confirmed isn't visible in the UI. Rev 3 ticket: UI labels + change lines (not RosterScheduleOptimizer.tsx, which is leased), a receipt round-trip, and loader cost bounds.
- Rev 3 ddcf2d078 verified: closure 0446100e, 149/149 on ForecastEvidence/admission/planning; notes module has no server imports. The live pregame receipt doesn't carry the basis yet (contract change, TJ decision). Player detail skipped (leased file).
- TJ pop-up: add the participation record to the live Detailed receipt now (hostedReaders only); player panel waits for the customer-bugs lane to release RosterScheduleOptimizer.tsx. Rev 4 ticket sent, including a merge-tree check vs origin/master c922514df.
- Rev 4 47a1a2628 verified (hostedReaders + test only; closure 0446100e; pregameCapture 221/221; merge-tree onto c922514df clean, tree 487d72a2). Worst-case live receipt 1,574 B. No reader consumer is in the closure.
- TJ: HOLD. Ship together with the review-before-use scope as one release once that scope is approved. Lane parked. Worktree /private/tmp/forge-participation-policy-20261121 kept as is. Open: review-scope card task_8cd106fc (unstarted); player-panel label after the customer-bugs lane releases RosterScheduleOptimizer.tsx.
- Review-scope lane (local_5a45496c) PROPOSAL.md: no review is possible yet. (a) No evidence: the scope was never pinned, 0 slates. (b) Binding codeVersion = deploy SHA, so a review can't match rows issued after its own release; rsoUsePolicy.ts is in the closure. Its §6 lineage concern was based on dangling 2f3c20880; the final 47a1a2628 mints forge-rso-participation-overlay-v1:skater@rev (Chef verified). Remaining gap: the resolver requires @issuance only for the issued prefix.
- TJ pop-ups: approve the identity fix as its own lane; review every scored target (extends D2); amend D4 and re-hash the scope. Identity-fix worktree /private/tmp/forge-rso-identity-fix-20261121 at 47a1a2628 (one chain, ships with participation).
- Amended scope v2 drafted (draft protocolHash 7d9e2368…, best-case slate 14 = Dec 12). TJ ruled B1–B8 by pop-up, all as proposed. The lane is finalizing the hash, status amended_awaiting_identity, and the v2 checker change list. The identity-fix card task_f5780f57 is still unstarted.
- Scope final dc9c87b7… (Chef recomputed it with the checker's canonicalHash: match; file 2bfc5bb6…). TJ: add bootstrap settings to the scope (new hash and sign-off). Ticket sent. v2 checker change list is in SCOPE-AMENDMENT.md (not built).
- Bootstrap added: scope 2acaff68… (Chef verified canonicalHash, file 499a36b5…, seed re-derived 7f8b18a3b1d413c5). TJ signed off unchanged; sign-off recorded outside the protocol. Review-scope lane done until the identity fix ships (card task_f5780f57 unstarted).
- Final scope file 2e2a8586… (Chef checked); protocolHash 2acaff68 unchanged; review-scope lane paused.

## 21:4xZ: octoberBranch ← master 356f93a5d (RSO lane ticket; TJ confirmed by pop-up)
- octoberBranch 73c6806ce (RSO reconcile commit on top). Trial: 5 conflicts (hostedReaders, run-forge-projections, verifiedForgeReleases.test, Yahoo ownership-trends route + test).
- bbb85af7b/2ba720742/7b11a43cb reached master via the #462 squash (739fd8484), so they're not "unreleased". But 3ee9e7dea also changed 7+ FORGE files outside 74f31aded (custody, hostedGame, hostedPublication, policy, rpc, witness, servedForecastLedger). Gap lane extension ticketed (compare worktree now at 356f93a5d).
- TJ: Yahoo → master's released version; News overlap (4 dirty files) → wait for News to checkpoint (mailbox note posted). Hold note goes in before the merge.
- RSO lane ack: nothing pending on octoberBranch, and its lease is released, so RosterScheduleOptimizer.tsx is free for the parked participation player-panel follow-up (after the merge).
- Identity fix 6ca16d025 (3551f7efb code, 98daf41b6 registers closure 01131f2a provisional, tests) verified: closure matches, 1,498/1,498 rerun, merge-tree clean. Deviation: payload.codeVersion stays SHA (DB pin), new modelIdentity v2 = closure hash, used by reviews. TJ accepted by pop-up. Parked; it ships with participation plus a real review. Scope lane asked to update identity wording (hash must stay 2acaff68).
- Scope identity wording updated outside the protocol (file 1667940c…; protocolHash 2acaff68 unchanged, Chef re-verified). The protocol's 'closure-hash codeVersion' wording already matches; codeVersionMeaning was added outside the protocol. No re-hash needed.
- 22:xxZ inputs drifted: master 523ba0108 (Luna), octoberBranch 6339d3897 (News/Luna checkpoints; no dirty overlap now). Resolved tree ecd5d572 = merge-tree + master blobs for 62 files (60 FORGE take-master + 2 Yahoo). No conflict markers; it differs from the lane's tested tree B only by the 14 Luna drift files. Closure 7ee3612e (TJ: keep Rankings). Hold note posted. Verification running in a clean export.
- 23:xxZ DONE: octoberBranch = 84b405ca8 (merge of 523ba0108 into 6339d3897, tree ecd5d572), via commit-tree plus ff-only in the checkout; dirty files untouched. Verified on a clean export: typecheck 0; focused 312 files: 25 failures identical to master's clean export (env). CSS pure N/A (no .module.scss changed). Closure 7ee3612e. Done note posted. Not pushed. Cleanup pending TJ: worktrees /private/tmp/forge-74f31aded-compare-20261121 (can now go). The parked candidates' worktrees stay.
- Gotcha: zsh doesn't word-split $ARGS; use an array.
- 23:xxZ TJ: natural-run acceptance. Both runs are in the future (now Nov 21 22:5xZ); no existing scheduled follow-up. Prepared acceptance/check.sh + summarize.py (read-only; the parser was dry-run on Nov 21 bodies, 13/13). Checkpoints: Nov 22 11:15Z and Nov 27 11:15Z. The evidence-checker rebuild has no owner. Slate 1 needs participation + identity LIVE (empty catalog), which conflicts with the 'ship with review' hold; flagged to TJ.
- Scheduled (TJ yes): forge-daily-acceptance-20261122 (Nov 22 05:15 CST / 11:15Z) and -20261127 (Nov 27 05:15 CST), one-time, read-only check.sh, Bypass mode; a completion notifies Chef. Then Chef shares Nov 22 coverage with the RSO lane (local_09db03da). Checker v2 lane started by TJ: local_f0c9732c.
- BLSH Chef asks: (1) Nov 22 FORGE arming: none planned or approved by this Chef; a 09:00 CT push is clear given a re-preflight. (2) BLSH pilot registry entry: shape accepted (verifierVersion field, appended last, receipt in tree, Y parent = X not octoberBranch); Chef will review X's receipt when posted.
- BLSH registry review: ACCEPT Y 1efdfb43 (X closure d6520f1c recomputed; receipt 8c2d3a3c matches; 28/28; admission pass on Y, fail on X as expected). Verdict at blsh-registry-review/VERDICT.md.

## 23:4xZ Five-player Nov 22 trace (in progress; paused for the checker patch)
- Schedule: 0375 EDM@STL, 0374 BUF@TBL, 0376 PIT@DAL, 0377 CHI@VAN (control), 0373 CAR@NYR. Ids: McDavid 8478402, Carlson 8474590, D'Astous 8480426, Heiskanen 8480036, Oettinger 8479979 (G), Lekkerimäki 8483476.
- Bridge rules (master forgeDailyBridge.ts): 7-day lookback by as_of_date; proof-gated runs; each line valid for min(puck drop, run.created_at + 8 d) (VALID_DAYS=8, line 477).
- TBL/DAL latest proven lines = 6b37dea6 (as_of 11-19, CREATED 11-13 10:41Z, sha e1ab46318), which expired at 11-21 10:41Z. Daily runs failed 11-17..11-20 and TBL/DAL didn't play 11-20/21, so there's no fresher line. Expected to clear with the natural 11-22 run.
- McDavid: newest line is f55203dc (live pregame, snapshotKind qualified_pregame_receipt, which is by design fenced out of Daily: externalInputProof.ts:66-67). Older proven line 6b37dea6 also expired, and lineWithheld(EDM) applies. Expected to clear with the 11-22 run.
- Oettinger: goalie rows to 6b37dea6 (sp 0.9713, game 0358), expired → missing forecast, not a conditional projection.
- Heiskanen: DEFECT candidate. No FORGE rows since as_of 11-07 although he played (wgo through 11-19). Run 6b37dea6 skater_coverage DAL game 0358: lineup 17 / eligible 39, 8480036 in unknown_by_reason.reserve_pass_disabled. First failing stage = FORGE generation (projected lineup omits him). Next: why rolling metrics/lineup selection drops him.
- Control: Lekkerimäki priced from ced8d73f (VAN 0371, 11-21; proven via verified producer attribution).
- 23:5xZ TJ: strict acceptance checker patched (summarize.py rewrite, check.sh kind arg + psql -q). 20/20 offline tests incl. 4 reproduced legacy false passes. Receipts in acceptance/receipts/. Both scheduled tasks updated (tests first, then check.sh with kind). Trace resumes next.
- 00:1xZ five-player trace DONE: nov22-five-player-trace/TRACE.md. No code defect; all five are expected next-slate timing. TBL/DAL lines were issued 11-13 and expired 11-21 10:41Z (VALID_DAYS 8); EDM's 11-21 line is the pregame publication, fenced from Daily by design; Heiskanen was out and returned 11-17 (lineCombinations 0342/0358), after the 11-13 build; Oettinger has a missing forecast, not a conditional line. Control and opponents (BUF/STL/PIT/CHI/VAN) are priced from ced8d73f. Optional: the no-line wording for pregame-fenced runs.
- Checker v2 lane (local_f0c9732c) verified: tooling-v2 node --test 52/52; SCOPE-AMENDED unchanged (1667940c); v1 tooling and web/ untouched.
- 23:26Z BLSH L7 NST-owner sign-off PASS posted (BLSH-L7-NST-OWNER-20261121): diff 4 files, clearance allowed, no direct NST 11:07–12:07Z, limits fine; jobs 404–407 active but skipped:disabled. Day-of hold for my lanes only; route-runner queue check at ~11:55Z Mon is separate. (Correction: earlier '00:1xZ' diary times were ~23:1xZ.)
- Checker v2 surface map done and verified (node --test 52/52; check-readbacks.mjs 8bb20a83; scope 1667940c unchanged). Parked.
- 02:2xZ PUSHED 53f1929a1 (acceptance route; TJ pop-up 'Mine now'). BLSH ack: the live pilot is HELD (managed signer), Y 1efdfb43 superseded and won't be pushed, no rebuild now; the next BLSH candidate gets a fresh X/Y later. BLSH E2-1 env change (no build) targets Sun 18:15Z. Build watch running; then smoke (TJ approved one call) and pg_cron jobs (approved).
- 02:27Z DONE: prod dpl_Bmhdrm7WCx6Ak9QA21RfU21xvvji READY on 53f1929a1 (aliased). Smoke 422 as expected (receipts acceptance/prod-route/smoke.*). pg_cron jobs 429 (Nov 22 control) and 430 (Nov 27 offday) at 11:15Z UTC (cron.timezone default GMT; job 404 audits confirm UTC). Local scheduled tasks now only read the audit (job_name '/api/v1/db/forge-daily-acceptance'). Follow-ups: unschedule 429/430 after Nov 27 (TJ approval); sync the 3 files into octoberBranch; cron-schedule.md rows not added.

## Nov 22 natural run acceptance (production job)
- Read 14:08Z (08:08 CST), read-only audit query only. Job ran 11:15:00–11:15:08Z (05:15 CST), 7.96 s, control kind (run 11-22, source 11-21). Receipt: acceptance/prod-route/result-20261122.json (response not truncated).
- FAIL: HTTP 422, pass=false, runId null, 0 scheduled runs for 11-22, 0 writer rows. Passing checks: run_schedule_explicit_nonempty, source_schedule_matches_kind, start_chart_http_200, daily_rso_http_200. All 7 others false.
- Missing for writer, Start Chart and Daily RSO: all 5 expected games 2026020373–0377. Pipeline: core_entity_freshness complete; upstream_skater_sources FAILED (likely the reason no run was created; not yet diagnosed).
- Evidence: scheduleHttp 200/200, readerHttp 200/200, pipelineRows 2, nstRows 1, runsForDate 0, writerRows 0. sha256 scheduleRun ded8f157…b1fb2, scheduleSource 6cd4166a…9e4a, startChart 4670e70b…7adb, dailyRso f4ca9a22…295a.
- Next: diagnose the upstream_skater_sources failure (read-only) before Nov 27; no rerun made.

## Nov 22 natural run acceptance (production job 429): FAIL
- 11:15:08Z job 429 → 422. First failing stage upstream_skater_sources (stage_handoff_unconfirmed): update-wgo-skaters was abandoned at the 10:09:15Z child deadline and finished at 10:25:01Z (504 rows for 11-21); later fires refused (manual review hold). NST passed (20/20, missing [], verifiedOffDates []). Daily FORGE NOT verified.
- TJ approved the scoped recovery: 14:14Z one GET → 200, run a294e2f3 (selected_games 0373–0377, 35–36 skaters/game, 10 team, 10 goalie), preflight PASS. Start Chart and Daily RSO serve all 5 under the run. Receipt recovery-1122/RECOVERY-RECEIPT.json. Not a natural-run pass; the failed scheduled run stays failed.
- Master moved to 480bd5d71 (Codex records + auth superstyle, 10:41–10:56Z), which contains the route. BLSH E2-1 build freeze 14:10–15:10Z (builds only).
- WGO lane local_85da83a0: TJ pivot → the scheduled path reads the 07:30Z standalone WGO output with a readiness check (exact finalized-game coverage, producer receipt, cutoff), totals checked separately, no coordinator WGO calls.
- ~14:58Z TJ: Rankings owns the readiness SQL (20261118151903 is LIVE: schema_migrations confirms) → narrow forward migration, compatible during rollout; FORGE owns the standalone-WGO consumer; gate together for one build; required test: 504-row rewrite committing 500 then failing must defer. Tickets sent to the Rankings lane local_15e54587 and the WGO lane local_85da83a0 (with real job-9 audit rows). No production changes.
- Rankings lane delivered the forward migration 20261122145409 (blob a0398d65), tests (PG15/17 incl. the 500-of-504 case), rollback 0d620303; uncommitted in the shared checkout. Chef approved the WGO writer sourceDigests edit (update-wgo-skaters is in the closure → new registration). Rollout: migration → web build before 07:30Z; rollback reverse.
- Overlap with the Rankings publisher 558ea2fb4 (on 480bd5d71; touches update-wgo-skaters, the registry and closure modules): chose (b) per TJ's 'don't bundle the rest of K1'. The FORGE release (gate + writer digest + migration 20261122145409) builds on master 480bd5d71, never octoberBranch; the publisher rebuilds after. Asked Rankings to confirm the migration works without rankingsSourceDate.
- 15:1xZ MASTER BLOCKED: TJ's #464 squash c2c46ceae (14:22Z) failed prod admission (closure 7ee3612e unregistered; dpl_FNseXHEz54ztvhSNKMu6imRf4Kbx ERROR); prod still on 480bd5d71 (dpl_A6wXhPbx…). Chef prepared a registration-only commit a9e08f854 on c2c46ceae (verifier receipt 96eaa4ce…, 243 modules, 0 findings; registry 28/28; typecheck 0; admission pass). Worktree /private/tmp/forge-daily-acceptance-route-20261121 is now detached at a9e08f854.
- TJ approved the push at 15:10Z, then said E2-1 is NOT done → HOLD until the BLSH-E2-1-DONE note (env vars SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY being recreated). The WGO release must now build on c2c46ceae / a9e08f854.
- WGO lane candidate B 3bb71b523 (on c2c46ceae; closure 3352c41d) NOT final: its FORGE gate lacks the digest match. Told the lane: base a9e08f854, digest recompute plus the 500-of-504 case on the FORGE path, the transition consequence. Rollout to bring to TJ: migration 20261122145409, then push (outside 07:30–10:55Z), after E2-1.
- WGO lane final cut M 1b80214d1 (on c2c46ceae; closure af8b8d11, 244 modules; includes the digest match + 500-of-504 FORGE tests). R dropped. Asked for M′ rebased on a9e08f854 (two-step release). Chef ran the prod checks (read-only): Nov 19/21 games type 2 OFF (state refreshed 10:05:28Z by stage 1); per-side WGO rows 18/18 H/R for every game. Rankings harness: PG15 + PG17 both fixtures pass.
- Rankings rollback file blob now 0a7367849273 (header ORDER note only). The gate now hard-depends on wgo_skater_date_digest → migration before deploy; rollback order FORGE web first. TJ asked for E2-1 Vercel walkthrough (E2-PLAN.md steps 1–2a/2b).
- GATED combined candidate C = ebfdf1cd20190ce4d3dff33b81c2ef2cd0d20d54 (on M′ a86a99898 ← a9e08f854 ← c2c46ceae; + 4 Rankings files, blobs a0398d65/080d8efd/00bc9ce8/0a736784). FF of origin/master, merge-tree clean, closure af8b8d11 (registered in M′), prod admission PASS on C, typecheck 0, Rankings harness PG15+PG17 pass; vitest db/cron/registry/scripts 2,734 pass, 20 fail = scripts/blsh/nativeProcessCaptureBootstrap (identical failure set on a clean export of master; env/pins; untouched by C). Worktree /private/tmp/forge-daily-acceptance-route-20261121 detached at C.
- 15:3xZ–15:42Z RELEASE (TJ approved the full sequence; E2-1 DONE at 15:35Z): (1) pushed a9e08f854 → dpl_BeEkh7JQsPFrPNwo7i4fMBPzqYU5 READY and aliased; smoke /api/v1/runs/latest 200. (2) Migration 20261122145409 applied in one transaction (exit 0): ledger row present, digest fn service_role only, readiness has sourceDigests, digest(11-21) rows 504. (3) Pushed ebfdf1cd2 at 15:40:56Z; build watch running. (4) pg_cron job 431 = Mon 11-23 11:15Z control acceptance. Remove 429/430/431 after Nov 27 (approval). TJ disconnecting (plane).
- 17:55Z DONE: ebfdf1cd2 → dpl_96LYjEUwPL7LZ2tuXXciaUbG6ngm READY and aliased; smoke 200. Done note posted. Next natural evidence: Mon 07:30Z job 9 digests → 10:05Z gate → 11:15Z job 431.
- 18:2xZ TJ 'do those open tasks': octoberBranch was already synced locally (d18e2b557 at 18:13Z, tree == master 43ad7037; not pushed, remote 01d615abf). Unscheduled spent job 429; created job 432 (Nov 28 12:00Z) to unschedule 430, 431 and itself. The local Nov 27 task now notes 432.

## 2026-11-23 00:14Z (Sun 19:14 EST): octoberBranch push + RSO decision
- TJ approved both. Vercel api (CLI 65.14.0, npx cache): fhfhockey, functions-fhfhockey, cms-fhfhockey, fhfhockey.com all previewDeploymentsDisabled=true, prodBranch master; web/functions unlinked. No GitHub workflow runs on push.
- Pushed octoberBranch 01d615abf..d18e2b557 (tree = master ebfdf1cd2). Newest deployment before: ebfdf1cd2 set 15:40:56Z. After-check (Vercel + GitHub status/deployments) in scratchpad deps-after.json.
- TJ pop-up: Detailed RSO "Ship, gate closed": one candidate (identity fix + participation overlay + checker v2) for ~Nov 28, review-before-use stays on. Ticket sent to identity-fix lane local_da2a675c: rebuild on ebfdf1cd2, recompute closure (01131f2a stale), gates, reader behaviour, exact push step for TJ.
- After-check (+100 s): newest Vercel deployment still the ebfdf1cd2 set (15:40:56Z); GitHub status 0, check-runs 0, deployments 0 for d18e2b557. No builds.

## 2026-11-23 00:26Z: Detailed RSO release (TJ pop-up "Push tonight")
- Candidate 989ee767c (lane local_da2a675c; report in side-session-notes rso-rc-2026-11-22/REPORT.md). Chef re-verified in a clean export: closure 3611475f… recomputed equal; production admission pass; typecheck exit 0; registry+admission 42/42; forgeEnvScope.test fails identically on master ebfdf1cd2 (pre-existing, 4th withForgeEnv caller forge-replay-run).
- Pushed master ebfdf1cd2..989ee767c at 00:26Z. Rollback: promote dpl_96LYjEUwPL7LZ2tuXXciaUbG6ngm (ebfdf1cd2).
- octoberBranch synced locally: merge 9773fb82f, tree = 989ee767c. Not pushed.
- Build: fhfhockey dpl_AtQxwfvRY59rQuKvrPsFppS5mfxJ READY (00:33Z), cms/functions/fhfhockey.com CANCELED. fhfhockey.com alias -> dpl_AtQx (989ee767c). Smoke /api/v1/runs/latest 200 (status ready). Next: Mon 10:05Z natural run now runs on 989ee767c; 11:15Z job 431 checks it.

## 2026-11-23 13:26Z: octoberBranch pushed; Monday acceptance read
- Preview settings re-read (4 linked, all previewDisabled, prod master). Pushed octoberBranch d18e2b557..9773fb82f at 13:26Z; no-build check in background.
- Job 431 (11:15Z) = 422 FAIL on one check: pipeline_stages_complete, because of an extra row projection_execution:kill:562de285… (complete). Every other check passed: 11 stages complete, 1 full_slate run 0203c9b0 succeeded (created 10:16Z), all 7 games in writer/Start Chart/Daily RSO, upstream_skater_sources complete 10:05:56 (WGO gate passed, on 989ee767c).
- Cause: the 10:20Z pipeline call (req …b1b911321117) hit "Task timed out after 240 seconds" at 10:24:27 (2.6 min before its first log after start). The 10:30Z slot recorded the kill receipt, resumed, and the stage completed 10:38. First owner-keyed kill receipt on record. Exec stage took 22 min (Nov 13: 26, Nov 9: 21; others 4–12).
- Not marked verified. Decision for TJ: accept a designed kill+resume, or stay strict and wait for a clean run.
- octoberBranch push 9773fb82f: no new Vercel deployment (newest still the 989ee767c set), GitHub status/checks/deployments 0. In sync with origin.

## 2026-11-23 13:40Z: TJ answers (stay strict); Monday readback
- Cause of the kill: prod DB stall 10:20:12–10:23:09Z (all jobs hung; update-season-stats failed 179 s). The pipeline's withNhlOffSeasonSkip waited it out (unbounded loader, reason "[object Object]"); the 180 s budget starts after it, so Vercel killed at 240 s.
- Scheduled read-only checks (TJ): job 433 forge-daily-acceptance-20261124 (11:15Z, run 11-24/src 11-23) and 434 -20261125 (run 11-25/src 11-24); each unschedules itself. SQL: tasks/artifacts/wgo-handoff-fix-2026-11-22/release/cron-20261124-25.sql. Job 432 still removes 430/431 on Nov 28.
- Started lane preflight-timeout-fix (local_8d254c04): local repro + smallest fix, no push.
- Monday readback: WGO receipt update-all-wgo-skaters 07:31Z sourceDigests[2026-11-22] = {md5 9e2957fa…, rows 180}, equal to wgo_skater_date_digest now. Run 0203c9b0 (git 989ee767c) wrote all 7 games (36/36/36/36/36/36/35 skaters; 35 = team 28 has 17), 2 goalies each, 10:16–10:17Z. Start Chart: selects 0203c9b0, all 7 games. Daily RSO: first read (13:34Z) served no bridge ("Interim FORGE projections could not be read", transient); second read 13:35Z served all 7 games under 0203c9b0. First puck 00:00Z; nothing missing, no recovery needed.
- Daily RSO miss diagnosis (TJ yes): no runtime log line (route swallows the bridge error in planning.ts catch). Request logs: 13:34:24Z and 13:35:42Z both 200 MISS. loadForgeDailyBridgeForecasts has a fixed readDeadline = min(planning deadline, start + 6000 ms) covering runs → proof → skaters/goalies paging; the passing read took 5.98 s end to end. Inferred cause: required bridge reads overran 6 s → PlanningReadDeadlineError → catch → 200 with no forecasts ("Interim FORGE projections could not be read"). Not proven (error not logged). Fix options for TJ: log error class + branch timings; give required reads a share of the 20 s planning budget; return a retryable signal instead of an empty set.
- Read-limit fix (lane local_7eb54ac0) 699e90b7d: Chef verified (FF of 989ee767c, closure 3611475f unchanged, admission pass, 4 files 273/273, typecheck 0). TJ "Push now". Pushed 989ee767c..699e90b7d 14:06Z; fhfhockey dpl_3YSPKvYEfcxBBnwMCPawFhvf3ixM READY 14:11Z, 3 cancels; alias -> 699e90b7d. Smoke Daily RSO 11-23: 200 in 8.07 s, bridge serves all 7 games under 0203c9b0. Rollback: dpl_AtQxwfvRY59rQuKvrPsFppS5mfxJ (989ee767c).
- octoberBranch synced locally 6078d02af (tree = 699e90b7d), not pushed. Preflight lane told to base on 699e90b7d.
- Preflight-timeout fix (lane local_8d254c04) 9ac6f4bcc: Chef verified (FF of 699e90b7d, closure 23af25d3 recomputed, admission pass, 5 files 192/192, typecheck 0). TJ "Push now". Pushed 14:17Z; fhfhockey dpl_Hbn2jb4XdfnKdiQetqNpzbxJ19NV READY 14:23Z + 3 cancels. Rollback: dpl_3YSPKvYEfcxBBnwMCPawFhvf3ixM (699e90b7d). Tue 10:05Z natural run is the first on closure 23af25d3; job 433 checks it at 11:15Z.
- octoberBranch pushed 9773fb82f..6f56b16f8 (tree = 9ac6f4bcc) at 14:18Z; 0 deployments, 0 GitHub statuses/checks.

## 2026-11-23 10:55 EST · Full-NHL H1–H10 (Chef)
- Request: a frozen all-32-team H1–H10 denominator from dated roster, transaction and schedule evidence, reusing the v2 `buildOpportunities`; then a plan for one shadow issuance. Local only.
- Live: master and alias = 9ac6f4bcc (dpl_Hbn2jb4X READY); octoberBranch = 6f56b16f8.
- Preserved Astra's audit receipts from /private/tmp/forge-readonly-audit-20261123.KIwY6H to tasks/artifacts/forge-full-nhl-h10-2026-11-23/astra-audit-receipts/: 20 files plus MANIFEST.sha256. The fixture's node_modules symlink and cache were excluded. No private league data.
- Overlap: rso-superstyle parked FORGE coverage ("skip for now"); its FORGE-COVERAGE-EVIDENCE.md is input. Told it that coverage moved here.
- Codex Luna lanes own aliases (web/lib/sources); no roster-affiliation owner was found.
- Staffed forge-h10-denominator (local_c1a61d2b): worktree /private/tmp/forge-h10-denominator-20261123 from 9ac6f4bcc.
- Daily acceptance stays separate: job 433 Tue 6:15 am EST, then 434, then 430 Fri.
- 11:0x EST · TJ widened the scope to the full outcome: local producer (skater and goalie if-playing, H1–H10, gaps not zeros, immutable revisions, retry dedupe), hosted nightly and material-update scheduling, the exact hosted shadow packet for approval, then hosted proof plus a signed-in RSO Add/Drop between an owned and an unowned player.
- Not complete until the hosted rows and the RSO decision both verify. The Daily and pregame feeds and the review gate stay as they are.
- Sent the scope to forge-h10-denominator. Its worktree already has an uncommitted denominator.ts, tests and a freeze script.
- Blocker it flags: the real ledger needs full-season games, roster timestamps and an official transactions feed. None of these has been fetched.
- 12:2x EST · Verified H10 candidate dad247c77 (5 commits on 9ac6f4bcc, worktree /private/tmp/forge-h10-denominator-20261123). Vitest lib/forge-v2: 207 passed, 19 PG-skipped; typecheck exit 0.
- TJ approved the bounded read. Ran it once read-only (4 s); CSVs in hosted-packet/read-results-20261123/.
- Findings:
  - forge_v2_private is NOT applied in prod, so the shadow needs a migration;
  - zero forge_roster_events since Oct 1;
  - rosters still show Larkin DET and Dach/Montembeault MTL, with no trade cards for them, so the Larkin trade is unverified;
  - no WGO ingest clock columns.
- Sent the lane: goalies in scope, a retention design (about 18 GB/yr), cron cadence, the local real-data dry run, and a corrected packet.
- 13:0x EST · Verified H10 rev 3 3c93551a3: Vitest lib/forge-v2 211 passed / 25 PG-skipped; typecheck exit 0; closure 23af25d3.
- Real-data G2 with the NHL API overlay: 804 players / 8,040 keys, identical to Astra's set.
- TJ approved the goalie read; ran it once: 821 lines, 26 unmapped (teams join).
- TJ's decisions, relayed to the lane:
  - D1: FxTwitter in the material path via the existing poller. A tweet triggers an official recheck only; it never moves a player on its own. Availability overlay; Codex owns web/lib/sources.
  - Q2: monthly partitions by issuance time, plus an archive rehearsal (export, checksum, restore, reconcile, backtest).
  - Q3: per-dispatch HMAC with a dedicated secret and idempotent retries, no bearer fallback.
  - The 07:45Z update-players run is still undecided.

## 15:50 EST Mon 11-23 — production PostgREST incident (diagnosed, read-only)
- The RSO lane reported 503s ("current transaction is aborted"). With TJ's approval: Supabase logs plus one read-only DB session.
- Site-wide incident, not RSO-specific: statement timeouts 14:57–15:10 EST, then 255 aborted-transaction errors across about 40 tables 15:10–15:17. Postgres fast shutdown/restart at 15:29:58 (initiator unknown); PostgREST back at 15:30. Clean since 15:35.
- Healthy at 15:45: 22/60 connections, no stuck sessions or locks.
- Evidence: side-session-notes/…/rso-superstyle-2026-11-23/PROD-READ-FAILURE-CHEF-DIAGNOSIS.md.
- Open: which statements timed out (not read). PostgREST is 12.0.2.

- Cause found (16:0x EST): see diagnosis file; unbounded player_baselines read from a local dev server.
- The statements that timed out (8 s limit) were almost all one PostgREST read: `player_baselines?select=player_id,player_name,position_code,snapshot_date,win_l5,win_l10,win_l20,win_season_prev,win_career&snapshot_date=eq.2026-11-22`. That is every player's baselines for a date, with five wide window columns.
- It ran 24 times between 14:55 and 15:10 EST, taking 14–20 s each (≥11 returned 500). All 24 came from supabase-js-node on a residential Comcast connection: a local Next dev server or script on TJ's Mac, not Vercel.
- Code: web/lib/sustainability/entitySurfaceServer.ts fetchPlayerBaselinesForSnapshot (lines ~186–201). Its callers need 1 player (entity bands and history) or `limit` players (scores list), but the function fetches the whole date. The same code is on origin/master, so production /trendsSandbox skater views can trigger it too.
- Chain: repeated 14–20 s reads, then statement timeouts, then PostgREST 12.0.2 pooled connections stuck in aborted transactions, then site-wide 500s from 15:10 to 15:17.
- Fix proposal: filter by the needed player ids (`.in("player_id", ids)`, index player_id+snapshot_date exists), plus a regression test. Separately, the PostgREST version is a Supabase dashboard setting (TJ).

## 16:3x EST Mon 11-23 — H10 rev 4 verified; TJ decisions
- Rev 4 c1240356b: vitest forge-v2 228 passed / 41 skipped (no PG); typecheck 0; eslint 0 (34 files); closure 23af25d3.
- TJ (pop-ups):
  - read #3 run once (now done: results in lane hosted-packet/read-results-news-20261123, 385 cards, max 774 any-card/72 h);
  - migrations go with the release;
  - prepare one combined release (H10 + baselines fix), with named approvals for SHA, push, secret, env and cron;
  - retention adopted (current + 2 hot, archive from M+3).
- Baselines fix lane: local_4d8579aa (baselines-read-fix).
- G2c asked of the H10 lane (500-limit overflow, 109 author-less cards).
- Next: both commits, then the combined candidate on origin/master, gates, then the approval pop-up.

## 17:1x EST Mon 11-23 — combined candidate prep
- H10 final 3260cc022: vitest forge-v2 237 passed / 43 skipped; typecheck 0; eslint 0 (36); closure 23af25d3. The official-appearance lift rule is TJ-approved.
- origin/master = c868bdee3 (RSO release by the RSO lane; TJ restarted the DB at about 20:30Z).
- `git merge-tree origin/master 3260cc022` is clean (tree 46feb8a19).
- Baselines fix c261b8052 (octoberBranch): the source applies to master cleanly. The test has 3 conflicts because bc23e04cc is unreleased and must stay out.
  Asked baselines-read-fix (local_4d8579aa) for master-based blobs, gated in a clean export.
- Codex mailbox: incident cause + 109 author-less cards provenance item posted.
- Next: blobs, then commit-tree the candidate on c868bdee3, then gates (vitest, typecheck, eslint, closure/admission, CSS pure), then the TJ release pop-ups.
- 17:2x: H10 final release SHA 829258397 (adds the route-level lift test and the packet). merge-tree with origin/master is clean (tree ecd269864). Drop the lane diary from the candidate. Waiting on the baselines master blobs.

## 22:4xZ Mon 11-23 — H10 + baselines release (TJ approved steps 1–4 by pop-up)
- Candidate 7db94da1d on c868bdee3. Tree: merge of H10 829258397 + baselines fix master blobs (src 3b6667e9 = c261b8052 patch on master; test 2755cf74), lane diary dropped.
  - Gates in a clean export: typecheck 0; eslint 0 (38 files); vitest 3,162 passed, 20 failed (4 BLSH/qualify script files, identical on a clean c868bdee3 export); closure 23af25d3; admission pass.
- (1) Migrations 20261029235656/20261123200000/20261123210000/20261123220000 applied in one transaction at 22:41Z (exit 0). Readback: 4 ledger rows; 5 parents × 10 months; service_role-only grants; tick not service-executable; everything empty; no jobs.
- (2) Vault forge_h10_dispatch_secret created (48 chars, generated locally, never printed, local file deleted). Vercel production FORGE_H10_DISPATCH_SECRET, FORGE_H10_SHADOW_ENABLED=true, APPROVAL_ID=tj-2026-11-23-h10-shadow, APPROVED_AT set before the push.
- (3) Pushed 7db94da1d to master at 22:42Z; build watch running. Rollback dpl_E1UnbKn7Frn4GpN8WoUGV3SvUD9g.
- Next: READY, smoke (runs/latest + unsigned POST refused), schedule the nightly job only, then watch 09:00Z Tue. Then sync octoberBranch (ours-merge, with TJ).
- 23:13Z: dpl_DqDt4r9NeKUQsBfAUmwEkPNyb3Zm READY on 7db94da1d, fhfhockey.com aliased; cms and functions not building.
- Smoke (23:14Z): /api/v1/runs/latest 200 (0.66 s). Unsigned POST /api/v1/db/forge-h10-shadow returned 400 invalid_dispatch. The secret check (503) comes before it, so the secret is loaded.
- 23:14:36Z: pg_cron job 466 forge-h10-shadow-nightly `*/15 8-12 * * *` active. Readback: only that job (no material job), cron tz default GMT, 0 dispatches, 0 vintages. No manual run.
- First natural run: Tue 09:00Z (4:00 am EST). One-time read-only task forge-h10-first-night-read fires at 09:50Z with the lane's first-night-verify.sql (being drafted).
  Report: keys vs freeze per kind and horizon, missing/extra/duplicate, numeric coverage, cutoff, run id, elapsed, load. Daily FORGE (job 433) is NOT evidence for H10.
- Pending: octoberBranch sync from master 7db94da1d (TJ go + no-build watch).
- 01:xxZ Tue: H10 lane committed the first-night verify SQL f3695ee76 (read-only check clean; rehearsed 7,320/7,320 skater + 720/720 goalie keys, and the seeded defects were found).
  The scheduled task now pins that commit and runs from the notes folder.
  - Section 06 per-reason gap tallies live only in pg_net responses (about 6 h).
  - EVERY row will show no_uncertainty_available: skater distribution omitted, participation model unavailable, goalie start probability not modelled. All declared, but the original requirement asks for uncertainty, so H10 can't pass on that until it's built. Raised with TJ.
- TJ: "Yes, add them" + a full uncertainty brief (50%/90% intervals per key, conditional vs participation kept separate, chronological holdout validation vs a baseline, runtime/storage, joint-outcome fantasy band later). Relayed verbatim to the H10 lane. Tonight’s run, the verifier and Daily/RSO stay unchanged.
