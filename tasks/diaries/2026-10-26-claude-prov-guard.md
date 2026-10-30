# PROV-GUARD — FORGE consumers refuse unproven external-input exclusion (2026-10-26)

## Scope
Lane PROV-GUARD (CLAUDE-LEASES.json). Shared helper `web/lib/projections/externalInputProof.ts`; guard RSO bridge
(forgeDailyBridge.ts, planning.ts), served-forecast ledger, Start Chart legacy fetchSlate, apiHelpers latest run,
/forge/players, /projections/players. No commits (orchestrator commits). No DB/network. Not touching RSO-YAHOO-DIET-P2 files.

## Where
- octoberBranch, HEAD 5356dc616 at start. web/ tree clean at start.

## Decisions
- Proof = run input snapshot in `player_forecast_source_observations` (provider forge, dataset forge-run-inputs-v1,
  entity_key = run_id), `payload.inputProvenance.external_fantasy_input_contract === excluded_from_native_inputs_v1`
  plus a valid `capturedReads` receipt (same checks as consumerRevisionAdmission.ts:56/88). Revisions copy this
  inputProvenance verbatim (publish_forge_game_revisions), so the snapshot is the root proof.
- Pre-7007a0527 writers never set the claim (checked git history), so legacy rows are unproven by construction.
- Uncaptured runs (capture disabled) have no snapshot → unproven. Risk: if prod capture is off, every consumer goes
  unavailable. PROD-READ-PLAN must check this.

- `requireLatestSucceededRunId` left unguarded on purpose: run-projection-accuracy (eligibility unchanged per brief) and
  projections/goalies|teams + forge/goalies use it. New `requireLatestExternalInputProvenRunId` for skater consumers.
- HEAD-failure logs: scratchpad `before/*.txt` (summarised in receipt).

## State / next
- [x] helper + tests (12)  - [x] projections/players (+explicitRunAdmission)  - [x] forge/players  - [x] apiHelpers tests
- [x] served-forecast ledger (write-boundary re-check)  - [x] RSO bridge (+planning test; planning.ts unchanged)  - [x] Start Chart
- [x] HEAD baseline: `git archive HEAD web` into scratchpad `head/`, new tests overlaid → 36 failed / 365 passed (log head-baseline.log)
- [x] PROD-READ-PLAN.md (3 queries, not run)
- [x] wider vitest 334 files / 5471 passed; whole-project tsc exit 0 (needed --max-old-space-size=12288; default heap OOM'd);
  eslint 17 files clean. All under heavy lock, released.
- [x] PROV-GUARD-RECEIPT.md with hashes

## Next / handoff
- Orchestrator: review + commit the 17 files listed in the receipt; ask TJ before PROD-READ-PLAN Q1.
- Release risk: if prod runs uncaptured (capture && compute flags false), guard withholds all FORGE skater output.
- Follow-ups (out of lease): projections/goalies|teams + forge/goalies explicit/latest checks; consumerRevisionAdmission
  could import validCapturedReadReceipt.

## Gotchas
- Other lanes (RSO-YAHOO-DIET-P2, draft-ranker) are editing web/ concurrently; whole-project tsc reflects their WIP too.
- Start Chart fake-fetch tests needed a second request (candidate ids, then proven run); real-client tests updated.

## Step 2 (orchestrator, 2026-10-26): verified-release attribution
- Prod capture is OFF (no snapshots since 02:16Z); step-1 guard committed 9eb4f0d36 would blank all output.
- Built verifiedForgeReleases.ts (538100d41 only, by full SHA), scripts/verify-forge-release-sha.ts (git archive +
  import closure scan + literal resolver + reviewed dynamic sites), externalInputProof accepts captured proof OR an
  allowlisted SHA on a succeeded single-invocation run (resume.invocations = 1); snapshot evidence always wins.
- Attribution finding: git_sha stamped once at insert from VERCEL_GIT_COMMIT_SHA||GIT_SHA; resumes by another
  release-side deployment keep it -> resumed runs rejected. Need TJ-approved read of the 2 prod runs' invocations.
- Verifier: 538100d41 VERIFIED (192 modules, 0 findings); bd337d97a NOT VERIFIED (seasonBootstrap config import).
- Receipt: PROV-GUARD-RECEIPT-2.md. Checks: wide vitest 5497 pass; tsc 0 (after Buffer typing fix + receipt regen);
  eslint clean; lock released. Next: orchestrator commits; TJ-approved read of the 2 runs' resume.invocations.

## PAUSED (2026-10-26, TJ via orchestrator) — how to resume safely
- State: step 2 complete and verified; nothing in flight; heavy lock not held; nothing committed. File list in
  PROV-GUARD-RECEIPT-2.md "Paused state".
- Before resuming: re-read the receipts; check `git status` that the files listed there are unchanged (or compare
  against the receipt hashes); confirm HEAD (was 3795abb43) and re-run focused tests:
  `npm test -- lib/projections/externalInputProof.test.ts lib/projections/verifiedForgeReleases.test.ts`.
- If verify-forge-release-sha.ts changes, re-run it for every allowlisted SHA and update receiptSha256
  (verifiedForgeReleases.test.ts enforces the verifier hash).
- Do NOT expand to teams/goalies/game predictions (Astra audit owns that). Do not commit; orchestrator commits.
- Next on resume (only if asked): the approved invocations read result decides whether a writer-side attribution fix is needed.

## F1 slice (Astra audit, resumed 2026-10-26 ~15:46Z): producer-closure identity — DONE, uncommitted
- Receipt: tasks/artifacts/astra-rso-handoff-2026-10-26/slices/F1/RECEIPT.md (file list + hashes).
- Built: scripts/forge-producer-closure.ts (scanner moved here, shared by verifier + build), next.config.js build-phase
  inlining of FORGE_PRODUCER_CLOSURE_SHA256, forgeProducerIdentity.ts stamp, writer stamps on every metrics write,
  consumer admits stamped single-invocation runs whose closure is allowlisted; 538100d41 SHA entry kept for unstamped.
- Evidence-driven change: admission (externalInputProof/verifiedForgeReleases) was inside the closure via
  run-rolling-forge-pipeline → run-projection-accuracy → apiHelpers; moved requireLatestExternalInputProvenRunId into
  externalInputProof.ts; verifier now fails on admission_module_in_closure.
- Listed closure 0e9876…4f = worktree on 82490cd45 INCLUDING another lane's uncommitted planningTypes.ts. If the
  integrated commit differs in any closure file, re-run verify-forge-release-sha.ts <final sha> and add that identity.
- Gotcha: a python `open(p,'w').write(tuple)` truncated next.config.js once; restored byte-identical from HEAD via
  `git show HEAD:web/next.config.js` (diff empty) before re-applying. Write files only after building content.
- Checks: focused 524 pass UTC + NY; tsc 0 under heavy lock; eslint 0. No next build run (inlining unconfirmed in bundle).
- Resume: F4 (teams/goalies/predictions) is next ONLY after orchestrator review.

## V2/V3 + build proof + F4 (2026-10-26 ~16:00–16:45Z) — DONE, uncommitted
- V2: stamp from DefinePlugin constant __FORGE_PRODUCER_CLOSURE_SHA256__ (server, prod build only); code_versions local:* denies.
- V3: runProof diagnostics on forge/players, projections/*, forge/goalies, start-chart, ledger. Bridge edit REVERTED to
  HEAD after the lease moved to FORGE-RESERVE (needs FORGE-RESERVE + RSO-MANUAL sequencing).
- Build proof: HEAD export + lane files only, `next build --experimental-build-mode=compile` offline (needs inert CMS_URL);
  writer chunk calls identity module with literal hash. Receipt slices/F1/V2-V3-BUILD-RECEIPT.md.
- F4: projections/teams+goalies, forge/goalies (proof-filtered fallback, explicit admission, null stays null), game
  predictions (classify proven/unproven/contradicted; withhold only contradicted; GAME_PREDICTIONS_REQUIRE_FORGE_PROOF
  default off = TJ choice). Receipt slices/F4/RECEIPT.md.
- Allowlist: 4c06 (HEAD c0ebd63f7 + lane) + 6613 (bundle tree). FORGE-RESERVE closure edits will need a final re-verify.
- Gotchas: HEAD moved 3x during work; always verify closure with `verify --tree` on an export, not the worktree.
  Python list-of-tuples edit scripts: no trailing commas/`]`. Unquoted heredoc + backticks runs commands.
- Next: orchestrator review/commit; TJ pop-up on the proof flag; resume only when asked.

## C7 R42 fixes (after commit 595ab13d9) — DONE, uncommitted
- A1 de-list 6613; closure entries need `commit` + commit receipt (595ab13d9 verified → 4c06). A2 proof-read failure:
  builder skips FORGE rows, reuse rebuilds, serving labels proof_unavailable. A4 code_versions required. A7
  claim_withheld/malformed_capture. Receipt slices/F4/R42-FIXES.md. Closure unchanged 4c06.
- Gotcha: `verify --tree` rewrites closure-<hash>.json in the repo; restore committed receipts afterwards.

## Resumed-run admission (after ad079935e) — DONE, uncommitted
- Stamped runs admitted when every invocation stamped the same verified closure and the count matches resume.invocations;
  legacy exact-SHA stays single-invocation. Null code_versions allowed (only run-forge-local sets FORGE_CODE_VERSION);
  local:* denies. Closure c1f0129a unchanged. Files: externalInputProof.ts + test.
