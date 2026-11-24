# TJ instruction · BLSH replay + readiness · Nov 20, 2026 ~13:35Z (verbatim)

Resume BLSH today in parallel with FORGE. Apply the same "pretend it's yesterday" rule: start with the Nov 19 NHL slate, set the sandbox clock to the v6 capture window that would have processed it, and run now. Don't use the empty Nov 20 slate, wait for another window, or arm production.

Use a verified copy of the retained input packet. If none was sealed, reconstruct only from evidence available at the original capture cutoff and label it reconstructed. BLSH is postgame, so final boxscores available by that cutoff are fair game; later corrections, arrivals and backfills are not. Keep the fixture immutable. Run the real v6 capture and receipt code off-Mac against disposable Postgres with test signing keys. If it fails, save the receipt, fix the cause, reset only the sandbox, rewind the clock and rerun the same slate immediately. Prove duplicate retries write nothing and that incomplete or late evidence is handled correctly. If a required historical input is missing, name it and keep the synthetic control moving today. Don't call a reconstruction a live pass.

Work blockers 3–12 in parallel where possible. Bring me the exact L7 and signer-custody steps, the replay receipts, and one separate approval packet for the earliest eligible non-empty live window. No production keys, deploy, re-date or arming under this instruction. Keep the public gate closed.

## Host and storage decision · ~14:05Z (verbatim)

**Off-Mac host:** Use the existing **Supabase cron → HTTP GET → Next.js route → Vercel runtime** as the hosted design for FORGE and BLSH. Do not buy Vercel Sandbox, restore a paid Supabase project, or push fixtures to the public repository. Don't reopen the hosting decision unless you can name a concrete constraint the existing stack cannot meet. Start the frozen-input replays now using the same pipeline code in an existing private test environment. If the Mac is available, use disposable local Postgres now rather than waiting for hosted setup. Rewind the clock, fix, reset only test state, and rerun the same verified envelope immediately. Keep the off-Mac proof as a separate step, not a reason to delay debugging. For hosted proof, inspect the already deployed routes and the working Supabase cron pattern first. Reuse the existing projects. Keep the replay behind a restricted test route or mode that can read only the frozen fixture and write only to private test tables. Prove the isolation and fit within the route's runtime limit before proposing a run. If a route, migration, access change, deploy or cron firing needs approval, bring me the smallest exact batch. No new paid resources, production scheduling changes, or live arming under this instruction.

**Envelope storage:** Use my existing Google Drive. Create one private, unshared folder named `FHFH replay envelopes 2026-11-20`. Upload only the game-input bundles and their manifests, with no credentials, tokens, or signing keys. Keep originals, reconstructions, and incomplete bundles clearly labeled and separate. Do not overwrite an existing copy. For each bundle, record its Drive file ID, game ID, UTC cutoff, release SHA, byte count, and SHA-256. Download it from the actual off-Mac replay environment using existing authorized access and verify the bytes against the saved hash before using it. If that runner can't read Drive, tell me exactly what's missing. Don't create a paid Blob store, make a public link, or broaden Drive permissions. Keep any local replay moving in the meantime.

## Re-date approval · ~14:20Z (verbatim)

Approve BLSH packet §6.1 for **edits and tests only**, effective now. Re-date the candidate to **Nov 22, 12:05–12:07 UTC**, targeting the **Nov 21 slate**. Verify the date mapping, update the three web files, write the forward migration, re-pin the operator SQL, and rerun the 41-check PostgreSQL validation. Prove the new window is accepted and the retired window and wrong-slate inputs are refused.  In parallel, run the **Nov 19 slate replay today**. Rewind the sandbox clock, use the same frozen inputs for every attempt, save failures, fix and rerun immediately. Don't wait for the re-date or the live window to debug. Report replay proof separately from readiness to capture live.  Bring me the release-ready SHA, migration checksum, test receipts, exact L7 and signer steps, and the earliest safe release/freeze plan **today**. If a release can safely go out today, bring that decision today rather than defaulting to Slot B. If not, name the specific blocker. Coordinate with FORGE without imposing a new cutoff on its work. This authorizes no production migration, key staging, push, arming, or public enablement; those remain separate approvals.

## Hosted proof requirement · ~15:40Z (TJ relayed from Codex; verbatim)

Use the existing Supabase and Vercel projects for the required off-Mac proof. For both FORGE and BLSH, **Supabase cron must issue the HTTP GET and the Next.js route must run the real pipeline on Vercel**. A direct GET, local replay, or Codex Cloud run is useful for debugging but does not satisfy that requirement.

Use the same scheduling, request authentication and runtime limits planned for production. Isolate the replay inputs and writes: use the hash-verified frozen envelope, a test clock, test keys and private test tables. Keep production readers, live data and the public feed untouched. Replay evidence must never qualify as live evidence.

Read back the entire chain: cron execution, HTTP result, exact deployment SHA, elapsed time, durable stage receipts and the actual downstream reader results. Prove a duplicate trigger makes no extra writes. If it fails, preserve the receipt, reset only test state and rerun the same envelope immediately. Leave a repeatable, default-off test path for future fixes, not a recurring test job.

Keep local debugging moving while preparing the hosted run. Bring one exact approval for any required deploy, migration, temporary access or one-shot cron. No new paid infrastructure. Report the hosted replay separately from live-game acceptance.

## WGO recovery + consolidated replay rules · ~17:15Z (verbatim)

The November 19 WGO recovery committed at 14:30:04 UTC Nov 20, transaction `15009521`: 432 rows, independently read back with zero discrepancies. Use `nov19-post-cutoff-repair-evidence.zip` from Astra's recovery folder as evidence of the repair only. Do not import those rows into the 0357/0358 pregame fixtures or use today's values to fill missing historical versions. For BLSH, use the repaired rows only in a separately labeled variant, not as evidence that the original capture would have seen them.

Keep the existing replay lanes moving today. Preserve and hash the original sealed input copy and any reconstructed or repaired variants separately; mark required unrecoverable inputs as `as_of_unverified` and label the fixture partial. Reproduce the failure, reset only private attempt state, and rerun the repair without waiting for a new slate. For hosted proof, use the existing Supabase cron → authenticated GET → Next.js route on existing Vercel, with private replay tables. Use the real-time-anchored fixture, not a global `Date` patch. Recheck current master and coordinate one release owner before proposing any push. Bring me one approval batch for the exact SHA, isolation checks, runtime, cleanup and any cost. No new paid infrastructure, live arming, or rerunning the WGO recovery. Report hosted replay and real-game acceptance separately.

(Evidence zip: /Users/tim/Documents/Codex/2026-11-20/forge-independent-production-audit/recovery/nov19-post-cutoff-repair-evidence.zip, sha256 0f91f5749adabdc2d874735e7925c6bab7103be0a93c417c120440991f5c5dd4, 7 files. Release owner for Claude-side pushes: Chef (local_23eb6989…); lanes never push.)

## BLSH hosted replay approval · ~19:15Z (verbatim)

Approve the BLSH hosted replay batch only: cda345c4f, approval batch 5347fc40…, install SQL 766aec3b…. Start once FORGE's sealed replay is read back and cleanup is verified. Before pushing, recheck that master is still f47905d28, that no FORGE run is armed, and that the release hold is in place. Require a clean BLSH isolation verdict and passing denial checks. No carryover exception from FORGE.

Set the scoped replay token before the single build. Run the native → context cron pair only if the exact SHA is READY and both firings fit before 23:50Z. Retry a transient failure tonight only if it fits the same cutoff without another build. Save cron and HTTP receipts, both stage results, offline reader results, and proof the duplicate made no extra writes. Disarm the replay jobs and verify the sandbox access is removed and the retired token no longer works.

Label this a PARTIAL-fixture hosted replay, not live acceptance. No NST registration, live migration, production signing keys, live arming, or public gate change. If the slot no longer fits, don't arm it; report the specific blocker and verify cleanup.

## BLSH inherited-grant ruling · ~19:37Z (verbatim)

Proceed with the BLSH-only isolation proof after FORGE's readback and cleanup are verified. For the exact BLSH batch, record both inherited grants as findings and demonstrate that neither BLSH role can exercise them through its actual access paths. Check effective privileges, role membership, exposed schemas and the full callable Data API surface, including all 16 definer wrappers. Use read-only production checks and non-mutating HTTP denial checks; put any write or DDL test on the isolated copy.

Accept only those two findings, and only if both are proven unreachable. If a result is inconclusive, any other finding appears, or a denial check fails, stop before the push and report the exact blocker. If the proof passes, attach it to the BLSH receipt and continue under the existing exact-SHA, single-build and 23:50Z cutoff gates. No FORGE exception carryover, production-wide grant changes, or live arming.

## BLSH guarded hosted install replay · Nov 21 ~17:10Z (verbatim)

Approve after 18:20Z

(Answer to: "Approve the one guarded hosted install replay after FORGE closes?" — scope = installer-recovery-2026-11-21/HOSTED-REPLAY-PROPOSAL.md: one guarded install of install.sql 766aec3b…, MAX_ATTEMPTS=1, read-only checks, reset, post-reset probe; no build, deploy, token, exposure, cron or arming.)

## BLSH re-cut path A · Nov 21 ~17:40Z (11:40 CT) (verbatim)

Proceed with A, with these constraints. Cut one candidate from cda345c4f that changes only the replay context date gate. Use the pinned fixture’s logical date only on the authenticated, default-off replay path. Do not patch the global clock or use the fixture clock for auth, scheduling, deadlines, receipt timestamps, or live eligibility. Keep envelope f2525c71 and installer 766aec3b byte-for-byte unchanged; reuse the exact installer fault-test evidence.

Prove locally that the full native → context → reader chain succeeds on a different real UTC day, while the live path and an unapproved or mismatched replay still refuse correctly. Verify duplicate no-op, cleanup, and no live writes. Run local_proof 24/24, the focused Vitest suite, and SOURCE_PINS on the exact candidate.

Bring one exact approval batch today: candidate SHA, artifact hashes, earliest safe hosted slot, runtime, stop conditions, readbacks, and cleanup. Do not wait for a new game or re-date the live pilot. If same-day hosted execution is blocked, name the actual conflict and the earliest safe slot. No push, build, install, or arming under this instruction.

(Answer to: "Which re-cut path?" — scope = installer-recovery-2026-11-21/HOSTED-REPLAY-PROPOSAL-FULL-20261121.md §4 option A.)

## BLSH install hold confirmed by TJ · Nov 21 17:37Z (verbatim)

Yes, keep it held

(Answer to: "Keep the BLSH install held and leave BLSH to the BLSH Lane?" Supersedes the "Approve after 18:20Z" answer above.)

## BLSH R2 batch · Nov 21 ~18:05Z (12:05 CT) (verbatim)

R′ scope: Accept R′ as cut (Recommended)

Slot: Give the daily FORGE off-day release and any approved recovery the first slot. Prepare BLSH R2 in parallel. As soon as FORGE’s release and recovery are verified or explicitly called off, and the shared build and database slots are clear, re-merge R′ onto the actual master and rerun its required gates on the exact SHA.

Treat 2:30 p.m. CT as a target, not a trigger. If the checks finish earlier, bring the packet earlier. If the verified batch cannot arm by 5:20 p.m. CT (23:20 UTC) with enough time for both stages, reader checks and cleanup, propose the next safe slot within replay validity. No push, build, install or arming until I approve the exact batch.

Approval: Keep R2 ready and do the local prep and already-authorized read-only checks now. Once Daily FORGE is verified or explicitly called off and the shared slot is clear, confirm actual master. If it moved, re-merge and rerun the required gates, then bring me one exact approval packet for the new SHA. If master is unchanged, bring back 0d8b141bc with the verified slot and remaining time.

The packet should cover one guarded install, narrowly scoped schema exposure and replay token, one build, native → context, reader and duplicate checks, and verified cleanup. Allow at most one same-build rerun only for a diagnosed transient failure with time left for cleanup. No hosted install, exposure, token, push, build or arming until I approve that exact packet.

(Answers to the three R2 pop-ups: scope / slot / approval of APPROVAL-BATCH-R2.md for 0d8b141bc.)

## BLSH R2b start · Nov 21 ~18:40Z (12:40 CT) (verbatim)

Start exact R2b (packet b5084aa6) now, subject to every step-0 check passing and no conflicting writer. Run the single guarded install of 766aec3b and verify isolation. At step 4, bring me the exact push request for 39a15979651e004dad235fe70d86089595ec1092; do not push or build before that approval. If master changes or you hit a stop condition, do not arm. Follow the packet’s cleanup rules and report the outcome. Keep the public BLSH gate and live pilot untouched.

(Answer to: "Approve exact BLSH packet R2b now?")

## BLSH R2b rerun after pgsodium finding · Nov 21 ~18:45Z (12:45 CT) (verbatim)

Rerun exact R2b once from step 0 with one guarded install of 766aec3b, only if the original preconditions still pass and you can start by 4:20 p.m. CT. Accept only pgsodium schema USAGE inherited via PUBLIC. Record the non-mutating 406 probes for the replay token and anon, and verify that neither replay role can reach pgsodium indirectly through an exposed RPC, including a security-definer wrapper. A 406 alone isn’t enough. If anything else appears or the isolation check is inconclusive, stop and verify cleanup. Don’t change shared grants or expose pgsodium. Stop at step 4 and return the exact push request. No push, build, or cron arming yet.

## BLSH R2b final attempt · Nov 21 ~19:20Z (1:20 CT) (verbatim)

One more attempt. Approve one final R2b attempt from step 0, with the tested parser fix as the only change and one guarded install of 766aec3b. Start by 4:20 p.m. CT only if the original preconditions still pass. Keep all four hosted checks strict. On a pass, stop at step 2 with the sandbox unexposed and report the receipts and cleanup cutoff. If approval to proceed hasn’t arrived by that cutoff, clean up and verify it. On any failure, clean up, verify, and stop for today. No exposure, token, push, build, or cron arming is approved here.

## BLSH steps 2–3 secret handling · Nov 21 ~19:25Z (1:25 CT) (verbatim)

The hosted isolation checks passed, but the legacy JWT signing secret is much more powerful than the replay token. I wouldn’t put it on the clipboard or run an unreviewed script with it.

Prepare steps 2–3 only. Before exposing anything, show me the exact script and confirm how it uses the signing secret without putting it in chat, the clipboard, shell history, logs, files, or Vercel. Only the short-lived, replay-role token goes to Vercel. Preserve the four existing exposed schemas and add only blsh_replay_api after the safe handoff is ready. Run the 9 kit probes and 4 denial probes, then stop and return the exact 39a15979 push request separately. If the safe handoff isn’t ready before the 4:30 p.m. CT cutoff, verify cleanup rather than extending it. No push, build, or cron arming yet.

## BLSH steps 2–3 token in argv · Nov 21 ~19:35Z (1:35 CT) (verbatim)

Keep moving today, but don’t expose the schema or run f31bbb78 as written. Make the smallest change so the probe gets the token in memory or via stdin, never through process arguments or logs. Keep the hidden signing-secret prompt. Show me the revised script hash and verify the change with a dummy token; send me the exact command to run.

Once I approve the revised script, I’ll add only blsh_replay_api, preserve the four existing schemas, and run it myself. Keep the 9 kit + 4 denial probes and send me the exact 39a15979 push request separately. No push, build, or cron arming yet. If we miss the 4:30 p.m. CT cutoff, verify cleanup rather than extending it.

## BLSH clean up now · Nov 21 ~19:35Z (1:35 CT) (verbatim)

Clean Up Now. I checked the actual files on my Mac. The hashes match, and the token is passed through stdin as described. But ad1ff496 installs the production token before running the probes, then logs failures and still exits successfully. It doesn’t remove the token or undo the exposure on failure.

Please verify the step-0 cleanup and keep the passing hosted isolation receipts. For the next attempt, fix just that failure path and prove with a dummy run that a failed probe returns an error and triggers cleanup.

## BLSH stop for today + resume plan · Nov 21 ~19:50Z (1:50 CT) (verbatim)

Stop for today
Keep 3ef6a45c and the receipts for the next attempt. BLSH is cleaned up, not hosted-replay verified. Before resuming, recheck master and make sure you’re available to unexpose the schema if cleanup needs you.

(Pasted resume plan, recorded as given:)
Resume BLSH now. Own it through one complete hosted replay and verified cleanup, then prepare the earliest eligible live pilot. Keep those two outcomes separate.
1. Start read-only preflight now. Confirm production is at step 0, check current origin/master and the READY production SHA, confirm the shared slot and remaining time, and verify the exact candidate, installer 766aec3b, and revised step-3 script 3ef6a45c. If master moved, rebase only BLSH, rerun the required gates, and bring back the new SHA. If the existing start or arm cutoff can’t be met, return the earliest safe replacement window. Don’t reuse an expired approval.
2. Bring me the exact guarded reinstall request. Once approved, reinstall once and rerun all four hosted isolation checks. Stop at the human handoff: tell me exactly how to expose only blsh_replay_api while preserving the four existing schemas, and give me the hash-checked command for me to run. All 13 probes must pass before the short-lived replay token is stored. On failure, follow the cleanup procedure and verify the result. Never ask me to paste the signing secret or token into chat.
3. Bring the exact push/build and one-shot replay request back for separate approval. After approval, verify native → context, both readers, and duplicate handling. Then remove the replay jobs, token, exposure, and sandbox; verify the step-0 fingerprint and release the slot. Report what passed and what didn’t.
4. In parallel, use the official schedule to find the earliest game that has not started and still leaves enough time for the required pilot cutoff. Prepare that pilot for separate approval; if today is too late, nominate the next eligible game. Do not arm live capture, backfill an in-progress game, enable public BLSH, or count the replay as live acceptance.

## BLSH resume now · Nov 21 ~19:55Z (1:55 CT) (verbatim answer)

Ignore the Stop for Today - follow the other message. (Then the same text as the pasted resume plan above: resume now; steps 1–4; keep 3ef6a45c and receipts; recheck master and make sure TJ is available to unexpose if cleanup needs it.)

## BLSH build-queue slot · Nov 21 ~19:58Z (1:58 CT) (verbatim)

Keep Yahoo and News first. After News is READY and its readback passes, rebase R′ onto the actual master and rerun the required gates. Reserve the next build slot for BLSH only if the fresh guarded install can start by 4:20 p.m. CT, I’m available for the dashboard and token handoff, and there’s enough time to arm by 5:20 p.m. CT and verify cleanup. Bring back the exact reinstall request and keep the push approval separate. If any condition can’t be met, release the slot to RSO immediately and propose the next eligible BLSH window. Don’t start a partial run just to make the cutoff.

## BLSH live pilot R0 · Nov 21 ~20:15Z (2:15 CT) (answer)

"Approve R0, start re-date (Recommended)". The question was: approve the target Sun Nov 22 slate (0373–0377), capture Mon Nov 23 06:05 CT, plus the re-date work (edits and tests only). The migration, keys, push, INSTALL, ARM and schedule each come back separately. Packet: live-pilot-20261121/PILOT-PACKET.md d4a0ebbc.

## BLSH R2c reinstall · Nov 21 ~20:35Z (2:35 CT) (answer)

"Approve; I'm available (Recommended)". The request: run run-r2c-steps0-1b.sh (ec11d6f3) once: read-only step 0 (master b37a0180), ONE guarded install of 766aec3b, and the four strict checks. Stop at the human handoff; reset on failure. R‴ c922514df, batch R2c 96566418. TJ is available for the handoff.

## BLSH R2c retry · Nov 21 ~20:45Z (2:45 CT) (answer)

"Approve retry now (Recommended)". The request: approve the changed probe (only the 2 post-nonexistent-table probes also accept 404 with no code; probes-stdin 32e18db4, step-3 a38998e4; dummy run 6/6) and one more guarded install.

## BLSH R2c push-and-replay · Nov 21 ~20:52Z (2:52 CT) (verbatim)

Approved: run the exact c922514df push-and-replay packet now if the current clock still leaves enough time to build and arm by 5:20 p.m. CT. Recheck b37a0180 and the READY alias immediately before pushing. One build, one native → context replay, verify both readers and duplicate handling, then send me the unexpose handoff immediately. At most one same-build rerun, only for a diagnosed transient failure. Verify full cleanup and release the slot to RSO. If the cutoff can’t be met, don’t push; start cleanup now. This does not approve the separate live pilot.

## BLSH live pilot push window · Nov 21 ~23:15Z (5:15 CT) (answer)

"Gap B, Sun 7:30 pm (Recommended)". The question: for the Nov 22 slate (push candidate Y 1efdfb436, gates green), plan the Sun 09:00 CT push (conditional GO, overnight gates) or gap B. Chosen: gap B, same slate and same Mon 06:05 CT capture, push Sun 19:05 CT–Mon 02:00 CT, planned 19:30 CT. Packet LIVE-PILOT-APPROVAL-PACKET-1efdfb436.md (67f7d757…). No key, migration, push, INSTALL, ARM or schedule approved by this.

## BLSH live pilot line F · Nov 21 ~23:3xZ (5:3x CT)

"I'd approve line F for 1efdfb436 now. FORGE matched the d6520f1c fingerprint and receipt hash, and all 28 registry tests passed. Only 1efdfb436 passes production admission; don't push b5e18f49 alone. That approval is for registration only. The next bottleneck is naming the L7 reviewer and shared NST owner. BLSH can finish the migration script in parallel while you handle the keypairs. No need to wait for the push window to do any of that."
Scope: line F = admit closure d6520f1c (X b5e18f490, receipt 8c2d3a3c) as commit Y 1efdfb436. It does NOT approve keys, push, migration, INSTALL, ARM or schedule.

## BLSH L7 roles · Nov 21 ~23:4xZ (answers)

- L7 reviewer: "Use the existing Codex Astra BLSH chat as the independent L7 reviewer if it did not author or materially shape the exact four-file NST change (+48/−3) on pilot commit X `b5e18f490`, and is not acting as the shared NST owner. Confirm that before assigning it. If independence cannot be established, tell me and use the fresh read-only Claude reviewer option instead. Keep L7 review and shared NST owner sign-off separate. Write a self-contained, paste-ready prompt for me to give Astra. … Post the prompt here for me to paste; don't start a duplicate Codex chat."
- Shared NST owner: "11/21 FORGE Lane (Recommended)".

## BLSH B5 verifier · Nov 22 ~00:0xZ (answer)

"BLSH Chef, here (Recommended)". BLSH Chef is the B5 independent verifier: it recomputes both fingerprints from the two .pub files with the hash-checked checker. It receives only public files, never a private key.

## BLSH signer custody · Nov 22 ~00:2xZ (answer, verbatim)

"Keep off-Mac key custody as a hard requirement, but remove the need for me to own or operate a second computer. I want BLSH to run autonomously through Supabase cron HTTP GETs and the existing Next.js endpoints on Vercel. Do not relax custody or use a manual early-morning signature as the default.

Propose the smallest managed signing setup that supports two separate Ed25519 keys and produces signatures the existing verifier accepts. Keep private keys non-exportable and outside the verifying app. Vercel may hold the public keys and use narrowly scoped workload authentication to the signer; do not put private signing keys in Vercel env vars, any .env file, Git, logs or chat.

Keep my approval before arming. After that, the signer may issue only the two approvals for the approved slate, exact READY deployment/SHA, and the independently verified native receipt and time windows. It must refuse wrong, missing, late or conflicting evidence and duplicates. Do not make it a service that signs arbitrary input. Prove the complete timed handoff and refusals in a disposable environment, and return the exact custody change, setup, cost, stop switch and approvals for review.

Proposal and isolated proof only. No production keys, settings, migration, push, arming or scheduling. If Gap B can't meet this without rushing, hold the live pilot and bring the earliest eligible slate after the managed signer is ready."

## BLSH L7 A5 · Nov 22 ~00:4xZ (verbatim)

"A5: I approve the reviewed BLSH L7 NST registration on X b5e18f490 for integration as part of the single keyed BLSH release, with Y 1efdfb436 as the reviewed push tip. No FORGE bundling. This does not authorize a push, key staging, migration or arming. Keep the live pilot held pending the managed-signer proof and separate approvals."

## BLSH managed signer S0 (re-answered) · Nov 22 (verbatim)

"Hold the BLSH pilot for now. Do not adopt AWS or GCP. Investigate a no-added-cost design using our existing Vercel and Supabase plans, with Supabase Vault as the first option. Keep it unattended: no second computer, no private keys on my Mac or in .env, and no manual signing during the pilot.

Start with Supabase cron triggering a narrowly scoped signer on Supabase, with Vercel holding only the public verification keys. Evaluate whether Vault can hold the two separate Ed25519 private keys without exposing them to the main Vercel app, routine deploy credentials, or ordinary database roles. Be explicit about what project admins and database owners could still read or change. Compare that with using Vault only for the cron trigger credential and enforcing the one-shot approval in Supabase without private signing keys. If neither preserves independent approval, explain the tradeoff rather than weakening the gate silently.

Keep my approval before arming. In isolation, prove that the system issues or consumes only the approvals for the approved slate, exact READY deployment and SHA, verified native receipt, and allowed time windows. Show refusal of missing, mismatched, expired and duplicate requests, plus a stop switch. Verify the design fits our current plan limits without new charges. Return one recommendation and the exact approval needed next. No production changes, key creation or staging, purchases, push, migration or arming."

## BLSH S0-V1b+E2 · Nov 22 (verbatim)

"Proceed with V1b + E2 as the design to validate, not as approval to execute. Keep the pilot held. No new paid service, no second computer, and no private keys in Vercel or local .env files.

Bring me one exact E2 plan. Identify what uses the seven POSTGRES_* variables or the owner credential today, including live and rollback deployments, cron, pooler connections, and operator tooling. Show what will keep working after sync is disconnected and the password is rotated, how existing privileged sessions will be handled, and whether any rebuild or redeploy is actually needed. Include the cutover, readbacks, and recovery plan.

Prove that the Vercel runtime cannot read the keys, alter the approval policy, or mint an accepted approval through any remaining credential. Name the Supabase admin and MCP/CLI capabilities that remain trusted. Keep the one-shot, wrong-slate, expiry, replay, and stop-switch checks. If the boundary or no-added-cost requirement doesn't hold, report the blocker rather than switching designs.

Prepare this now. No production changes, credential rotation, key staging, migration, push, or arming without separate approval."

## BLSH E2-1 timing · Nov 22 (verbatim)

"Move E2-1 to the first clear slot after I'm back, targeting 1:15 p.m. ET / 12:15 p.m. CT. I'll be offline with my Mac closed from 4:45 a.m. CT to 1:00 p.m. ET. Don't reserve a build freeze while I'm unavailable. When I'm back, recheck the build queue and walk me through E2-1 only. No password reset, build, key staging, migration, or arming."

## ASAP rule renewal · Nov 22 05:44Z (verbatim)

Renew 24 hours (Recommended)

(Answer to the lapse pop-up at 05:43Z; ASAP on until ~05:44Z Nov 23. Never authorizes production changes.)

## BLSH E2 follow-up · Nov 22 (answer)

"Check options next time": before E2-2, BLSH Chef brings TJ the options for the Supabase integration's remaining access to `functions-fhfhockey`.

## ASAP rule renewal · Nov 23 04:5xZ (verbatim)

Renew 24 hours (Recommended)

(ASAP on until ~05:44Z Nov 24 / 12:44 am EST. Never authorizes production changes.)
