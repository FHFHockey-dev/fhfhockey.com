# 2026-11-15 Claude — BLSH evidence bridge (offline)

## Scope
Offline bridge: verified runner packet + non-secret runtime receipt -> NativeReceipts, native-inputs manifest,
definition artifact, OfficialFrames, proposed (non-installable) acceptance entry. E2E through the real gate with a
test-only policy. Parent: local_56526db8 (Claude Chef). No network, DB, NST, provider, git mutation, push, deploy.

## Where
- Folder: `tasks/artifacts/blsh-evidence-bridge-2026-11-15/` (new, untracked; no commits by this lane).
- Read-only inputs: gate `web/lib/buyLowSellHigh/currentProcessEvidence.server.ts` (sha e69db2c0…, matches the
  prepare_packet SOURCE-PINS), runner/adapter/preparation (pins match Chef expected-pins), Chef `verify-packet.mjs`,
  prior art `blsh-native-packet-preparation-2026-11-08/` (prepare_packet.py, closed_gate.cjs, pinned nst_lineage.py / intake.py).
- Fixtures (read-only, outside repo): NST 2026-10-01 counts/rates/PK-oi pages; retained boxscores
  (source-vintage-20261101-01/live-02); retained CURRENT-REQUEST (11-01) for aggregate-only checks.

## Decisions
- Reuse prepare_packet.py as composer and nst_lineage.py as the NST cell parser (no second parser).
- producer = adapter hash, redactor = client.ts hash, taken from the pins input, never from the packet.
- Representation map: runner `client_redacted_parser_input` -> gate `parser_input_after_redaction` (same bytes:
  `redactNstMessage(text)` from `fetchNstTextByUrl`, retained unmodified by the runner). Nothing else maps.
- completedByUTC = retrieval time of the earliest official observation showing the game final (packet schedule op).
- Proposal keeps `reviewSHA256: null` -> deliberately non-installable; test asserts the gate rejects it.
- No real all-strength on-ice counts page exists in the retained tree -> on-ice tested synthetically; live run must supply.

## State / checks
- Aligned to the FINAL successor (SUCCESSOR.patch 40dd64bc…): per-op `tls` with resumed/keep-alive binding
  (verifyTlsChain) + packet RUNTIME.json (checkRuntime; default store == bundled roots; pinned NODE_SHA256).
  The external runtime-receipt proposal was dropped in favour of RUNTIME.json.
- Verifier: successor's verify-packet.mjs (fc4e3d04…); Chef's older one vetoes successor packets (key name scan).
- `node --test tests/bridge.test.mjs`: 14/14 pass (TESTS.log, 175 s), TMPDIR=scratch, GIT_DIR unset.
  Mutations (drop TLS chain; drop 8-day rule) each fail their test; file restored byte-identical.
- Real gate + test-only policy: 234 + 234 qualify; CLOSED admits 0. CLI smoke: all four CLIs run; refusals exit 2.
- Real NST 10-01 page vs real stored rows: 234/288 match; 54 held on dotted team codes. Real boxscore 36/36 TOI.
- Window feasibility: all-five source-observation 68/644; current use 0/644.
- README.md, REVIEWER-BRIEF.md, SHA256SUMS written. Parent messaged twice (TLS gap, then correction).

## Review fixes (2026-11-15, Chef request after REVIEW.md)
- Aligned to successor **v4** (patch 66b4eb30…, pins f2f639ea…, verifier 04a632ba…, bootstrap a224d62e…); Chef asked for
  v3 pins 55a50c6d…, superseded mid-task -> APPROVED names v4 (flagged to Chef).
- Q3 APPROVED constants; Q6 TLS basis + packet record + CONVERSION/FRAMES/ACQ runtime bound; exact RUNTIME/launch/tls keys;
  Q5 frames production mode (v2 receipts + TLS chain + acquisition runtime + reviewed tool, none yet) + ACQUISITION-SPEC.md;
  Q7 tests write to scratch only (test 17); Q10 output_exists; lifecycle key absent; v4 per-op CA store.
- Chef decision (2026-11-15): bind v4; refusing v3 is correct. Chef reruns the suite and routes changed parts to the reviewer.
- Suite 17/17 (TESTS.log, 180 s). Former survivor mutants (<=8, mirror, overclaim) now caught; file restored (cmp).

## Recheck ticket (RECHECK.md §4/§1/§2/§6, 2026-11-15)
- Built acquire-boxscores.mjs (e075b90a…): 1 GET per scheduled game (6 for 11-11), 0 retries, concurrency 1, redirect error,
  v4 adapter withTlsObservation (hash-pinned aa6237bd…), 0700/0600, manifest last. APPROVED_ACQUISITION_TOOLS left EMPTY.
- frames.mjs rewritten: production only via completed acquisition dir (manifest, exact per-game set, launch block, tool hash
  computed from bound source, APPROVED node, finalUrl/redirected). assemble re-derives candidate class; frames MANIFEST bound.
- Mutant 3 call site killed via synthetic-mode stub verifier (pinned verifier unchanged).
- Offline loopback TLS test: real pooled keep-alive (2 connections) binds correctly; 5 faults + 2 pre-start refusals.
- Suite 20/20 in canonical checkout (186 s). SHA256SUMS 18/18.

## RECHECK-2 ticket (F1/F2/F3, 2026-11-15)
- Tool rebuilt self-contained (4f8a0888…; e075b90a… NOT approvable): node: imports only, adapter socketTls/withTlsObservation +
  lib helpers copied (equivalent on 12 scenarios vs aa6237bd…), execArgv [], global-dispatcher identity check, sendHeaders
  count == 1, approved-candidate conversion only + ids from schedule.raw.json, fixed out path per date, peerCertificate shape.
- frames.mjs: runtime v2 / receipt v3; execArgv [] first; dispatcher unset; fixed outputDirectory; sendHeaders/dispatcher fields.
- Gotcha: requiring npm undici installs its own global dispatcher (lib/global.js); the test harness resets the slot.
- Suite 21/21 (178 s); SHA256SUMS 19/19; real fixed output path never created.

## Vendoring (2026-11-15)
- Successor lane overwrote its LIVE folder with v5 WIP; Chef's rerun failed 0/21 (verifier veto). Vendored v4 verifier/pins/patch
  + Chef's old verifier/pins/rehearse.ts into approved/; UPSTREAM-PINS.json (6 vendored + 14 in-place) checked at test import.
- Suite 21/21 at v4 (173 s). Waiting on Chef for v5 hashes + dispatcher field names before rebinding APPROVED.

## v5 rebind (2026-11-15)
- APPROVED -> v5 (pins a2a1e694…, verifier b86af692…, bootstrap dbf69c47…), vendored approved/v5/; v4 kept for refusal tests.
- RUNTIME.globalDispatcher exact {present,Agent,sameAsRunnerLoad}; per-op tls.globalDispatcher {present,constructorName,identityUnchanged}
  (packet tls = 15 keys; acquisition receipts keep 14). Tool constants only -> aa8a9cb7… (fetch logic = 4f8a0888…).
- Suite 21/21 (175 s); two dispatcher mutants caught. Residual: node_modules/undici unpinned (operator G3).

## Post-apply mode (2026-11-15)
- Chef applied v5 in the canonical tree (uncommitted); Chef's run 17/21 (tests 3/14/18/19: patch re-applied onto a v5 copy).
- successorSources(): patch --dry-run -f forward/reverse -> base (apply in scratch) | already_v5 (skip) | else refuse;
  then runner/adapter/preparation/bootstrap must equal the v5 pins. Both /usr/bin/patch (Apple) and anaconda GNU patch agree.
- Test 14: unpatched runner from `git archive a955107671ee` (blsh, lib/nst, lib/cron, tsconfig, package.json) + chef
  rehearse/pins/clock; BRIDGE_REHEARSE/BRIDGE_REHEARSAL_CLOCK no longer read. Tool untouched (aa8a9cb7…).
- Applied tree, BRIDGE_PINS/VERIFIER=v5: 21/21 (194 s). A first run showed 20/21 only because I edited README mid-run
  (test 21 snapshot); don't edit the folder while the suite runs. SHA256SUMS 29/29 OK.

## G4 tool list (2026-11-15)
- Chef set frames.mjs APPROVED_ACQUISITION_TOOLS = [aa8a9cb7…] (frames 8b57ffbf…); Chef's run 18/21 (tests 3/15/20).
- Tests only: UNREVIEWED_TOOL_BYTES (real tool, last \n -> space) + toolBytes fixture option; 3/15/20 require
  acquisition_tool_not_reviewed for it; list asserted == [aa8a9cb7…]; custody limit asserted (hand-written facts + real
  tool bytes -> production frames). README + ACQUISITION-SPEC updated. Suite 21/21 on the applied tree (183 s).

## Post-capture runbook (2026-11-15)
- post-capture/: POST-CAPTURE.md, dress-rehearsal.sh, check-attestation.mjs, deadline-check.mjs, rehearsal-inputs.mjs.
- Rehearsal 28/28 (~70 s): Leg A rehearse.ts packet stops; Leg B fixture candidate -> loopback tool -> hand-built acq ->
  frames/deadline/assemble/prepare/propose -> PROPOSAL_ONLY; real gate on time 234+234, deadline inclusive, +1 ms individual 0.
- Gotchas: prepare_packet needs node on PATH (/usr/local/bin) and bs4 python (/opt/anaconda3); /usr/bin/python3 lacks bs4.
  Gate capture age is per group; deadline-check uses global earliest (conservative). v5 committed 348a122d6.
- Gap: fresh CURRENT-REQUEST/CONTEXTS for 11-11 (no CLI here). Suite 21/21 (206 s). SHA256SUMS 34 entries.

## Parked 11-18 fallback v5-1118 (2026-11-15)
- Vendored approved/v5-1118 (patch 209b34eb, pins 3f61f9d4/bootstrap 849009ee, verifier b86af692 = v5 bytes); UPSTREAM-PINS.
- convert CANDIDATES {v5 = APPROVED, v5-1118}; --candidate required on CLIs (convert non-synthetic, assemble, check-attestation).
- BLOCKER (not changed, reported): tool aa8a9cb7 pins v5 pins -> refuses fallback conversions. Operator 11-18 pins unset.
- Rehearsal: v5 28/28, v5-1118 19/19 (event_age binds; next UTC day refused). Suite 21/21 (201 s). SUMS 37.

## Staged either-pins tool (2026-11-15, TJ: accept either pins; stage, swap after review)
- post-capture/proposed/acquire-boxscores.mjs b4b563f4 = live aa8a9cb7 + APPROVED_PINS [v5, v5-1118] + one check line.
  Live tool untouched and still listed. Tests 18 (text equality modulo two edits) + 19 (serves v5 and fallback, refuses
  forged/v4 pins). Rehearsal v5 28/28, v5-1118 21/21 (B4s). Suite 21/21 (182 s). SWAP.md has the procedure. SUMS 39.

## RECHECK-11 C + fallback H1/M1 (2026-11-15)
- check-attestation: unwraps launcher g3 wrapper; binds candidate, argv0, cwd, exec window; 1118 pins filled; expect seam
  (function-only) like operator check(expect=). Rehearsal attestations written by operator-attestation.py write.
- POST-CAPTURE step 2b (operator check), step 4 -> reader RUNBOOK; SWAP.md gated (M1). Swap not executed (H2).
- Rehearsals v5 36/36, v5-1118 31/31; suite 21/21 (185 s); SUMS caa7f6f5 (39). Reviewer repro: CLI refuses only on the
  operator rehearsal's stub argv0 (C2, correct); seam -> ok:true.
- Gotcha: never run operator dress-rehearsal/launcher suites on 11-17/11-18 (RECHECK-11 B1).

## Next
Report counts + changed hashes to Chef for the reviewer's recheck. Run with BRIDGE_PINS=approved/v5/expected-pins.json on
the applied tree (README "Tree precondition").

## Blockers / pending
- Live run needs: approved successor packet, NODE_SHA256, custodian acceptance of the RUNTIME evidence,
  TJ-approved boxscore read (6 calls), fresh request/context, real on-ice page, independent review.
- Team-code map proposal for nst_lineage.py (needs its own pin + review; L.A unverified).

## Gotchas
- verify-packet.mjs vetoes any observation with TLSVerified !== null: `true` lives only in the bridge receipt.
- Never run Chef `run-rehearsal.sh` (truncates its RESULTS.jsonl).
- Gate capture-age check (`:213-214`) is inside the try: stale evidence fails source observation too.

## RECHECK-12 C4/C5 (2026-11-15)
- POST-CAPTURE steps 4 and 2b now point at the reader RUNBOOK and the operator RUNBOOK section 4 (no inline copies), with current hashes 8e27a427/c23eb286/d84a9547 and de0982a6/236aace4. All 20 cited hashes verified on disk. Doc only; no suite rerun.
