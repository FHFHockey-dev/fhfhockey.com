# BLSH pilot readiness (Claude Chef), 2026-11-14 ET / 2026-11-15 UTC

## Scope
TJ wants BLSH brought to an approval-ready pilot, or else a precise blocked verdict. The work:
- an offline operator-path rehearsal;
- a bounded data-contract check;
- fixes to owned blockers, or handoffs for the rest;
- one approval packet.

No live, production, provider, ledger, push or deploy action.

## Where
Branch `octoberBranch`, in the sole checkout. Output folder: `tasks/artifacts/blsh-pilot-readiness-2026-11-14/`. Claim: `CLAUDE-BLSH-PILOT-READINESS-CLAIM-20261115` in `CLAUDE-TO-CODEX.md`.

## State
- **Pins:** 25 of 27 match. Drifted: `BlshTradeComparison.{tsx,test.tsx}`, changed by `adc77310d` (Codex sprint item 9). Neither file is one of the 9 runtime roles.
- **Frozen candidate expired:** the slot and date are hard-coded, and the date age check at `nativeProcessCapturePreparation.ts:48` is 8 days, so Nov 7 has been stale since 11-15T00:00Z.
- **No custodian reply:** there is no reply to `CODEX-BLSH-CUSTODIAN-COORDINATION-20261112`. A factual reply has been posted.
- **Missing Nov 13 receipt:** no Nov 13 "private capture lane" receipt exists in the repo or the notes folder. The latest on disk is `PILOT-READINESS.json` (11-12 19:40Z).

## Next
1. Map TJ's fail-closed list to existing tests.
2. Run an isolated rehearsal.
3. Check the data contract.
4. Write the packet.

## Gotchas
The NST local ledger lives at `tmpdir()/fhfhockey-nst-budget-<uid>`, so always set `TMPDIR` to the scratchpad. Never call `createNativeProcessCaptureAdapter`, because it reads credentials.

## Checkpoint ~01:45Z
- Pin recheck: PIN-RECHECK.json. 17/19 source pins and 8/8 evidence pins match, and all 9 runtime roles match. The only drift is BlshTradeComparison (`adc77310d`). On the current tree, 7 suites (239 tests) pass (SUITES-CURRENT-TREE.log).
- Rehearsal: REHEARSAL.md and rehearsal/RESULTS.jsonl (sha 5ea1480b…). The happy path completes and reads back clean. All 13 fault and tamper cases veto, network attempts are 0, and the ledger is untouched. Real CLI: `--check` exits 0, and `--run` with a synthetic receipt refuses with exit 1 (receipt deleted).
- Gotcha: under ts-node commonjs, `import * as fs` is a copy. Patch through `require()` or the runner's fs calls are unaffected.
- TJ confirmed (chat): the old pilot can't be rescheduled. The next handoff is a fresh candidate (date, slot and output) with a new offline rehearsal. No operator or slot is confirmed.
- Next: data contract (waiting on the research agent), successor handoff, packet.

## Checkpoint ~02:10Z: deliverables written
- DATA-CONTRACT.md: the cohort (25 lowest IDs with five context IDs) ran through the real `qualifyCurrentInputs`. Identity 322/322; windows 25/25 complete and matching the context; native 0/322 (semantics unknown, held). Contract suites: 9 files, 328 passed / 110 opt-in skipped.
- BLOCKERS.md: B1–B7 plus closed C1–C2. PILOT-APPROVAL-PACKET.md: NO-GO / blocked; the one next decision is TJ naming the operator and window.
- Mailbox handoff posted: CLAUDE-BLSH-PILOT-HANDOFFS-20261115.
- Nothing committed. No live, production, provider, ledger, push or deploy action.
- Next: TJ decision; Scout's B1/B2/B5 responses.

## Checkpoint ~02:40Z: advisor corrections applied
- Verifier now requires the exact role set. The rehearsal has 19 lines and 14 vetoes, including the fewer-roles case.
- Cohort pool B (lowest 25 of all 740 profiles): 22 complete, 3 short, 25/25 matching the context. Missing on-ice goals-for/against (5–6 records, all inside latest-five windows) are held with reasons and never zero-filled.
- Citations were grep-verified (signs, UI copy, 8 test titles).
- `local_3bb2755d` is not among the 80 most recent sessions. The packet now names TJ as the proposed operator and Claude Chef as the verifier. The date changed to Sat 11-14 (slate unverified); a mailbox correction is posted.
- Uncommitted. Waiting on TJ's operator decision and Scout's B1/B2/B5.

## ~03:00Z: parallel lanes (TJ direction)
- TJ chose a Claude NST session as operator.
- TJ: build a fresh candidate on a verified completed slate, and the evidence bridge, in parallel; a separate reviewer follows. A diagnostic-only run is not worth doing.
- Verified slate: 2026-11-11, games 2026020293–298, all OFF in DRM step5 before-files; 299 is Nov 12. It expires 2026-11-19T00:00Z.
- Sessions:
  - `local_988fbc84`: successor patch, retargeted to Nov 11 plus TLS observation.
  - `local_d637c306`: evidence bridge.
  - `local_017907a3`: operator, slot clearance and receipt plan.
- Mailbox: CLAUDE-BLSH-PARALLEL-LANES-20261115.
- Next: verify each lane's output, start the separate bridge reviewer, then assemble the approval packet.

## ~03:30Z: bridge finding confirmed and routed
- The bridge reports 13/13 offline tests passing; the real gate under a test-only policy qualifies 234 + 234 rows.
- SUCCESSOR.patch has no TLS facts, so live it qualifies 0. TLS-VARIANT-BLOCKED.patch fails on resumed sessions (empty peer cert in Node 22).
- Tickets sent:
  - candidate (`local_988fbc84`): adopt the resumed-session fix (chain to an earlier full handshake on the same servername) and add an in-packet RUNTIME.json;
  - bridge (`local_d637c306`): consume both;
  - operator (`local_017907a3`): the T−1 probe is now pre-approval evidence only.

## Slot confirmations (2026-11-17 13:45–14:15Z)
- FORGE Lane (`local_e8064f61`): **clear**. No live action in the window; Tuesday fallback capture ~23:00Z; migration apply before that day; never NST.
- Pending: Rankings Lane, Scout/Codex (H1, Browserless), Scout/Astra (live audit), TJ (/db/runner).
- RANKINGS Lane (`local_a9638be4`): **clear**. No republish, writer, NST-backed requests or live load in the window. Both children are idle. Last production action: a composite republish at 2026-11-15T14:02Z. The lane will check the BLSH slot before any future action.
- Still pending: Scout/Codex (H1, Browserless), Scout/Astra (live audit), TJ (/db/runner).

## Independent bridge review (`local_548117af`)
- Verdicts:
  - **Pass:** Q2, Q4, Q6, Q8a–d, Q9 (no leakage) and Q10.
  - **Fail:** Q1 is a custody limit; a fabricated packet converts, so TLSVerified is a consistency claim, not proof. Q3 is partial: the pins file is unpinned.
  - **Unverified:** Q5 frame transport.
- Window rule confirmed: current use requires the five games to span 6 days or less (7-day event age, plus the date must precede the retrieval day). That is 0/644 in the 11-01 snapshot. The gate's constants never show a full window regardless.
- Eight preconditions are recorded in REVIEW.md "Overall recommendation".
- Routed:
  - bridge: pin the pins file; bind the TLS basis; exact RUNTIME keys; frame TLS acquisition spec; tests to scratch; EEXIST.
  - candidate: refuse the lifecycle key's presence; launch proof in RUNTIME; per-dispatch CA re-read and dispatcher check.
- Open decisions for TJ (packet): node_modules integrity method; whether an admission-ledger external witness (production read) is required.
- Bridge v4-aligned: Chef rerun 17/17. Reviewer recheck requested. Candidate v4 = 66b4eb30 (bootstrap a224d62e).

## Recheck and packet v2
- RECHECK.md:
  - **Pass:** Q3 closed; TLS basis and frames bound; exact key sets; v4 matches the bridge.
  - Mutants: 2 of 3 killed.
  - **Still open:** Q1 remains a custody limit. ACQUISITION-SPEC fails partially on gaps 4a–c, which are routed to the bridge along with building the tool offline.
- Astra: slot clear. Scout/Codex reply is still pending.
- PILOT-APPROVAL-PACKET-v2.md written. Verdict NOT YET; gates G1–G6 listed.
- TJ decision (2026-11-15): node_modules integrity via dependency-tree hash; ticket sent to operator lane (`local_017907a3`).
- G3 built by operator: 42 packages, 1,634 files, tree 76c7d466…473a. Chef recompute matches the baseline. The refusal `bootstrap_differs_from_baseline` is expected until Scout applies v4. The bridge acquisition ticket was lost to an API error and has been re-sent.
- Acquisition tool e075b90a built. Chef rerun 20/20. Sent to reviewer for RECHECK-2 (approve or deny the tool hash).
- RECHECK-2: DO NOT APPROVE tool e075b90a.
  - F1 (High): the tool hash doesn't pin the import closure; a global-dispatcher injection produced production frames.
  - F2 (Medium): ids can come from an unapproved conversion.
  - F3 (Low): the output path is free-form.
  - Routed: bridge fixes F1–F3 (self-contained tool + dispatcher check). Candidate v5 adds the dispatcher identity check; the G3 rebaseline follows.
- Lane coupling found: the bridge read the successor folder by path, so v5 churn broke 21/21. Fix requested: vendored, hash-checked inputs.
- Candidate v5 = e8be50de (bootstrap dbf69c47, runner a74cbb0a). Adds a dispatcher identity check.
  - Correction from v5: the live transport is npm undici 7.29.0, loaded by cheerio; it is covered by the G3 tree baseline (verified).
- RECHECK-3: APPROVE tool 4f8a0888, for v4 conversions only.
- Moving to v5. Tickets sent:
  - bridge: rebind APPROVED + tool to v5, new tool hash;
  - operator: G3 rebaseline.
- Next: the reviewer's narrow RECHECK-4, then refresh packet v2 to v5.
- RECHECK-4: APPROVE tool aa8a9cb7 (constants-only diff). New finding: a tls.connect wrapper in any loaded package defeats the dispatcher check, so in-process coverage of all require.cache files is needed. Ticket sent to the operator to prove the G3 closure covers them.
- G3 v5 baseline is 4534fd65, tree 76c7d466 (42 packages, 1,634 files), including undici 7.29.0 (verified).
- Chef bridge rerun at v5: 21/21.
- PILOT-APPROVAL-PACKET-v3.md written for candidate v5. Verdict NOT YET; gates G1–G6.
- G3 in-process coverage: 256 loaded files, 34 packages, 0 uncovered (LOADED-MODULES-COVERAGE-v5.json, verified); baseline unchanged at 4534fd65. Packet v3 updated.
- 2026-11-15 TJ: verify v5 in canonical checkout; confirm admission state (not accept unknown); T−1 probe, capture, frames are separate approvals.
- G1 pre-apply (read-only): `git apply --check` e8be50de passes on HEAD eb0a07e9; 6 patched files unchanged since a9551076; 7 unchanged role pins match HEAD. Apply + suites still need Scout (or TJ re-scoping).
- Packet v3: G1/G5 rows updated; §9 split into 0 admission read, 1 T−1 probe, 2 capture, 3 frames. Next: TJ pop-up on who applies v5 and approval of the G5 read for 11-16.
- TJ pop-ups 2026-11-15: "Chef applies now"; "Run it now" (G5).
- G1: applied SUCCESSOR.patch e8be50de on octoberBranch (UNCOMMITTED; 6 files in web/scripts/blsh). Suites 228/228; --check exit 0; G3 match, 0 uncovered; bridge 17/21. The 4 failures are a suite precondition (successorSources re-applies the patch), ticketed to the bridge lane. Evidence in g1-canonical/ (SHA256SUMS).
- G5: one read-only query run. enforced=false; 3 bodies match migrations; ACL service_role only. admission/ADMISSION-READ-20261115.json b015ed09. Recheck on 11-16 needs approval.
- Gotcha: bridge suite needs inherited PATH (python bs4); env -i PATH=/usr/bin fails all 21.
- Bridge post-apply fix: Chef rerun 21/21 (BRIDGE-TESTS-postapply.log); tool aa8a9cb7 unchanged; SUMS stale for bridge.test.mjs be63e2c0 / fixtures.mjs 3c5f57a4 / README. Asked the author to update; reviewer recheck next.
- RECHECK-5 APPROVE (b3d52342): test-only post-apply change; SUMS 003b5750 29/29. Asked the reviewer to close RECHECK-4 precondition 2 against the G3 loaded-module evidence.
- RECHECK-6 (ff91c4ab): precondition 2 NOT closed. R0 G3 self-trust on typescript (forged match reproduced), R1 attest T−0/T+0, R2 T+0 rerun, R3 DYLD_*. TJ: launcher refusal + attest for R3, keep v5, bootstrap refusal queued for the next candidate. R0–R2 + R3-interim ticketed to the operator local_017907a3.
- Operator R0–R3 done: G3 tool 912041a5 (typescript verified before load), T+0 rerun + attestation §3c, DYLD prefix refusal. Chef reruns: R0 tests 0 failures (tsforged refused); G3 on canonical match/256/0 uncovered. RECHECK-7 requested from the reviewer.
- RECHECK-7 (e5e176a0): R0 closed (912041a5), R1/R2 closed as procedure, R3 open until the launcher is written. TJ approved the launcher design (pop-up); build ticket sent to the operator; RECHECK-8 next. Note: HEAD moved to 863fab152 (another lane, no blsh paths).
- Launcher built: nst-pilot-launcher.py 1bc56fab, tests 84ef919a; Chef rerun 34/34, no fake secret. Additions (G3 at gate 7, receipt privacy + origin pin, value-shape refusal) are fail-closed; Chef accepts them, and they get named in the final run approval. Probe v2 is now bf39d6ae. RECHECK-8 requested.
- RECHECK-8 (d214bff1): NOT CLOSED on one doc fix: DEVELOPER_DIR redirects the python3 shim, so the invocation needs /usr/bin/env -i PATH=/usr/bin:/bin. Launcher code passes. Chef batched the doc fix with 3 Lows (enforce -I, env-file hygiene, O_EXCL lock) plus stop-item wording into one operator pass, then RECHECK-9.
- Launcher 31c370c3 (tests 2c01f08a): Chef rerun 49/49, no fake secret; env -i prefix documented; real .env.local passes the stat-only gate (operator report). RECHECK-9 requested; TJ won't approve the hash before it.
- RECHECK-9 (f52e7453) CLOSED: launcher 31c370c3; G3 offline closed. Packet v3 updated with the launcher row and approval wording. Remaining: G2 (Scout/Codex + /db/runner), T−1 approvals (G5 recheck, probe v2 bf39d6ae), G4 (approved-list change + 6 GETs), policy installer.
- TJ pop-ups: /db/runner window clear (G2); Chef adds the G4 list. frames.mjs list set to [aa8a9cb7] (8b57ffbf; pre-change copy in scratch). Suite 18/21: tests 3, 15, 20 expect the empty list. Test adaptation ticketed to the bridge author, then RECHECK-10. Custody: hand-written acquisition + real tool bytes now pass frames.
- G4 tests adapted by the bridge author: bridge.test d2283c19, fixtures 5128fb98, README b9af3661, SUMS 3f50a7c4 29/29. Chef rerun 21/21 (BRIDGE-TESTS-g4-final.log); frames.mjs diff = list line only. RECHECK-10 requested.
- RECHECK-10 (1914be4f) APPROVE G4 list. Offline work complete. Remaining: T−1 approvals on 11-16 (G5 recheck, probe bf39d6ae), capture approval (launcher 31c370c3), 6 GETs, Scout/Codex reply, policy installer name. Packet v3 recommendation updated.
- TJ (hour push): build 11-18 fallback (candidate lane ticket); installer = Scout/Codex (mailbox ask); commit v5 locally -> 348a122d6 (6 files, no push, no attribution). Tickets: operator RUNBOOK + dress-rehearsal; bridge POST-CAPTURE + dress-rehearsal. APPROVAL-SHEET.md written. Next: verify the lanes, then RECHECK-11.
- TJ: request/context reader adapted by a Claude lane (started local_4f22e1bf blsh-request-reader); T−1 connect-only egress check; wake-up = TJ messages Chef at ~13:45Z 11-17 and Chef relays; finish the fallback now. Tickets: operator (egress tool, snapshot tool, attestation binding, 1118 launcher), bridge (vendor v5-1118, fallback deadline). Operator dress rehearsal 22 PASS/3 SKIP; bridge post-capture 28/28; fallback patch 209b34eb (bootstrap 849009ee, ~9h53m eval).
- All lanes delivered; Chef reruns in blsh-pilot-readiness-2026-11-14/final-verify/: reader 71/0, launcher 49/49, egress 0 fail, operator rehearsal 1117 0 fail, bridge rehearsal v5 28/28, bridge suite 21/21. RECHECK-11 (day-of set, reader first) sent to local_548117af; fallback review started as local_869c6133 (blsh-fallback-review).
- RECHECK-11 (d69585c9): reader DO NOT APPROVE (A1 High: pyc/shadowing bypass pins), operator APPROVE on B1 (no rehearsals or suites on slot dates), post-capture DO NOT APPROVE (C1 High: g3Line wrapper mismatch). Fallback REVIEW (6ef29d6f): H1 1118 pins unset, H2 tool swap parked, M1 swap gate, M2 §8 stop order, L1 re-clearance, L2 typecheck. Fix tickets sent to bridge, operator, reader, candidate.
- Fix round done. Chef reruns (final-verify-2): reader 77/0, launcher 49/49, op1117 0 fail, brv5 36/36, suite 21/21, sums clean; launchers, aa8a9cb7 and frames.mjs unchanged; typecheck exit 0 patched and unpatched; no read-only DB role in the repo (owner role is custody). RECHECK-12 and fallback REVIEW-2 requested.
- RECHECK-12 (bfe6311c): reader APPROVE, operator APPROVE, post-capture code APPROVE on C4/C5 text fixes (ticketed to the bridge). Fallback REVIEW-2 (522b89e2): ready for TJ's decision if 11-17 is missed; npm update check may have made one anonymous registry request (disclosed).
- POST-CAPTURE c1ae5d46 verified (cited hashes current). APPROVAL-SHEET rewritten with the final reviewed set and approvals A0–A4 (adds the request read and egress check). Packet v3 recommendation updated. Awaiting the reviewer's C4/C5 addendum.
- RECHECK-12 addendum: C4/C5 met, so post-capture APPROVE. All day-of areas approved. Offline work complete; awaiting TJ approvals A0–A4 (11-16 onward).
- TJ: no-laptop/no-manual wanted. Decided: keep the Nov 17 manual pilot as reviewed, and build v6 = daily Supabase pg_cron → Next API route, designed for daily runs. Started local_0cb61c96 (blsh-cron-v6): DESIGN.md first, then report; pinned files, node_modules and package.json frozen until 11-17/18 finishes.
- v6 DESIGN f6f78878 approved by TJ: slot 12:05Z (backup 12:20Z); lifecycle disabled (NST_JOB_LIFECYCLE_ENABLED absent in Vercel production, names-only check of 112 keys; no NODE/OpenSSL overrides); daily read via a reviewed SECURITY DEFINER function (migration file only); boxscores automated in Phase 3; system-env exposure unknown, keep gate 5. Phase 2 started in local_0cb61c96.
- v6 Phase 2 built (new files only): Chef verified pins unchanged (11 hashes), G3 match, Vitest 37/37, typecheck 0, SUMS b01191f1 34/34 from the repo root. Review sent to local_869c6133 (V6-REVIEW.md).
- V6-REVIEW (c0789453): all 7 areas APPROVE for code and an inert deploy/apply; scheduling gated on M1 (process-wide undici observer vs concurrent requests) plus the deployment probe. Fix ticket M1 + L1–L7 sent to the v6 lane.
- v6 fixes: vercel.json gets a separate functions entry (maxDuration 250) for the route; SUMS ae8caef1 OK; Chef reruns Vitest 40/40, typecheck 0, pins unchanged, G3 match. V6-RECHECK requested from local_869c6133. M1 stays open until the probe (Fluid/concurrency).
- TJ: inert v6 release now + commit v6 locally. Committed 6d4aba061. octoberBranch is 624 ahead of master (other lanes' work), so the plan is a targeted RC: commit-tree on origin/master + v5 + v6 + authority 153/154 + rollback SQL, gated in a clean export; push chef/ branch; PR; squash-merge (1 build + 3 cancels); apply both migrations per the MIGRATION-150 receipt method. Baseline test currently fails on octoberBranch (154 vs 152) until authority is added. Prep ticket sent to the v6 lane.
- GOTCHA 11-15: functions/node_modules vercel CLI 48.1.6 has no 'api' subcommand; 'vercel api <path>' was parsed as a deploy and refused ('Can't deploy more than one path'). list_deployments since 1794780000000 = 0, so nothing was created. Memory updated. Fluid/preview settings: read via MCP at probe time.
- TJ asked to commit EVERYTHING and push all to master. Repo is PUBLIC. 18 modified + 3,772 untracked files (~1.5 GB, a 71 MB TSV). Secret scan: test/synthetic tokens only so far; TJ's email appears in super-goal-final-summary (already on master); the reader tests carry a placeholder DB URL with the real project host. RSO/Yahoo private-data check, full gate and active-session check NOT done. Usage limit hit: nothing pushed. RC c2b3bd24c (v6-only) on local chef/blsh-v6-inert-release is ready and gated.
- v6 lane adopted a copied TLS-observer fix in the working tree without Chef's decision; Chef reverted to the reviewed 6d4aba061 bytes (the copy is preserved in release/fix-tls-observer/). The RC includes v5, so no copy is needed.
- SHA256SUMS restored to the reviewed code set (the lane-fix copy is saved in scratch); all 23 code entries equal RC tree c6d8a129. The release stays paused for TJ (push-everything inventory incomplete).
- TJ chose: release everything committed except mid-edit (Superstyle HomePage/TeamStandings/Home.module.scss, rebuild-score) and untracked artifacts. merge-tree origin/master+HEAD is clean (351bf381); overlaid v6 release files gives final tree 72a0cfe4 (199 files vs master). Secret scan: test TSA keys in __fixtures__ only; email line already on master. No scss changed. Full gate (test:full, typecheck, lint) running in the clean export.
- RELEASE: PR #453 squash-merged as master 89284e9c4 at about 1794788484 (tree should be 72a0cfe4). No deployment from the chef branch push. Watching the build; rollback target dpl_2jUj8jVf (86c24938).
- Build READY dpl_23ZsbjhA (89284e9c4), 1 build + 3 cancels. Preflight 1 at 00:30:57Z: 1|1|0|0|0|0|0|0|0|absent|5|3|t|t|54|3|f|name,version, matching expected. Storage policies: anon/authenticated 'deny' are RESTRICTIVE; permissive only for service_role; RLS on, so the new bucket is not exposed. Apply 153 at 00:36Z after preflight 2.
- Migrations 153 and 154 applied 00:36:57Z / 00:37:36Z; readbacks exact; receipt v6-migrations/MIGRATIONS-153-154-APPLY-RECEIPT.md. octoberBranch synced with master (915a30c59) plus authority applied commit (local, unpushed; ships with the next release, avoiding an extra build). Kill switch off, no schedule.
- TJ approvals recorded in TJ-APPROVALS.md: A0+A1 (11-16), A2–A4 in advance (conditional), v6 probe part A; bookkeeping ships with the next release.
- A0 PASS at 2026-11-16T01:33:39Z: enforced=false; 3 bodies unchanged (5e854308/7e1851c4/a56ce3d4); ACL service_role only. admission/ADMISSION-READ-20261116.json
- v6 probe A: item 10 PASS (build ok), 13 PASS; items 1 and M1 UNKNOWN (not exposed by the read-only API); need TJ's dashboard check. V6-PROBE-A.md
- TJ: Fluid compute ON (M1 real, scheduling blocked); there is no system-env toggle in the dashboard (confirm in part B). M1 fix design ticketed to the v6 lane.
- A1 PASS (operator; TJ approved probe 246bf6b4 + egress c61c7fe7 directly after Chef's stale bf39d6ae relay; records corrected). admissionReceipt blsh-admission-20261116.565ad253fc30. M1-FIX-DESIGN daa9c051 received.
- TJ chose M1 fix parts 1+3 (context tagging + pre-claim self-test); part 2 waits on probe B. Ticketed to the v6 lane (tracked v6 files only; frozen set unchanged; no commit until review).
- M1 fix built (uncommitted): Chef verified Vitest 61/61, typecheck 0, eslint 0, frozen pins unchanged, copied lines 14–52 hash f05d54f6. Review requested (V6-M1-REVIEW) from local_869c6133.
- V6-M1-REVIEW (f3af4e28) APPROVE parts 1+3 for commit and inert deploy. Committed locally dc5e8d4fb. Next: TJ release timing plus probe B approval.
- RELEASE 2: PR #454 squash-merged as master 5c42cb14fb4e4ef1ff1cdaf64db1c668319b019c (fix dc5e8d4fb + bookkeeping 9ed2e8b24 only; FORGE lane work not included). Building.
- Part B timing: route pilot fence skips capture dates before 2026-11-19, window 12:00–12:30Z, so part B is useful only from 11-19 12:05Z. The self-test isn't run with the switch off (corrected). Recorded in V6-PROBE-A.md.
- Build READY dpl_HoV6iN1h (5c42cb14f). octoberBranch synced (bookkeeping kept ours: 153–156 applied); baseline 21/21; v5 pins unchanged.
