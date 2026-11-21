# TJ instruction · FORGE replay · Nov 20, 2026 ~13:35Z (verbatim)

Do not arm tomorrow's queue yet. Start an off-Mac sandbox replay of yesterday's failed FORGE games now. Do not wait for another slate, puck drop, or a wall-clock window.

1. Start with `2026020358`, which still failed after the first fix, then replay `2026020357`. Locate the preserved envelope and verify its hash and original pregame cutoff. Keep the original immutable and use a copy per attempt. If capture failed before an envelope was sealed, say exactly what survived and reconstruct only from records that can be shown to have been available by the original cutoff. Label it `reconstructed`, not an original live receipt. Missing inputs stay missing. Keep results, later corrections, and later lineup or injury news out of the model's view.
2. Run the actual capture → independent verifier → publication → both RSO readers against isolated fixtures. Set the test clock before dispatch and advance it in seconds through the real deadlines. Use test credentials and storage. If a stage fails, save its receipt, fix the failing step, reset only the trial state, and rerun the same frozen inputs immediately. Don't change the fixture to get a pass. Don't stop at a plan or repeat an unchanged failure without new evidence.
3. Prove the long-absence regression explicitly: a newer row independently shown not to be an appearance must not hide an older valid appearance and its matching support row. A genuinely malformed in-window appearance must still fail with an exact reason. Check both the latest-row RPC and legacy reader. Then show one matched claim, signed verdict and publication revision, both RSO readbacks with points/slot or explicit unavailable reasons, and zero duplicate publications on retry.
4. Return the runnable command, source and input hashes, failure and pass receipts, and the smallest remaining release gate.

No production writes, cron changes, push, or historical backdating. If you hit a real dependency you cannot recover, name it and keep the synthetic control and any other valid replay moving today. Bring me one separate decision after the replay passes: exact candidate and the earliest eligible live check. A replay pass proves the repair under frozen inputs; it does not turn a past failure into a live pass. Rewind the test clock, not production. The frozen envelope is what lets it fix and retry the same game today. If the failed capture stopped before sealing, Claude can use the retained pregame inputs to build a labeled reconstruction. That can prove the fix without pretending yesterday's live capture passed.

## Follow-up · ~13:50Z (verbatim; TJ declined restoring the Nov 19 05:18Z physical backup to a new paid project)

Do not restore a paid Supabase project. Start with `2026020358`, then `2026020357`. Check capture storage, the claim journal, and attempt artifacts for the original pregame input packets. Report what exists and where each run stopped.

**Create and verify the sealed-envelope copy before each replay.** If an original sealed packet exists, leave it untouched and make a byte-for-byte copy into durable, private storage accessible off-Mac. Save the game ID, claim ID if present, original cutoff in UTC, source release SHA, SHA-256, byte count, and a manifest of the input files. Read the copy back from storage and verify its hash against the original. Return the private artifact reference and verification receipt. Don't count a file left in `/tmp`, a pointer to the original, or a database backup as the copy. Exclude credentials and signing keys.

If no original was sealed, preserve whatever partial inputs survived and record which inputs are missing. Build a separately labeled `reconstructed` envelope only from versioned inputs proven available at the original cutoff. Exclude outcomes, later edits, and backfills. Seal that reconstruction, make the same durable verified copy, and don't relabel it as the original. If there isn't enough evidence for a faithful reconstruction, run a clearly labeled synthetic reproduction of the failure today.

Run the real FORGE chain off-Mac in disposable Postgres. Rewind the test clock and start every retry from the **same verified envelope copy**, with fresh trial state. On failure, save the receipt, fix the cause, reset only the sandbox, and rerun immediately. No overnight wait, production writes, cron changes, paid provisioning, or live arming.

**Make this a requirement for future live attempts.** Prepare and test the change in the sandbox now: retain admitted inputs as capture proceeds so failures leave a durable bundle marked `incomplete`; once capture seals, automatically create and read back the immutable copy before allowing verification or publication to proceed. If the copy is missing or its hash differs, stop and record the failure. Bring back the exact patch, artifact references, and replay receipts. Shipping that change is a separate decision.

(Earlier, TJ also said: "Use a checkpoint from before yesterday's games, use yesterday's games to test.")

## Host and storage decision · ~14:05Z (verbatim)

**Off-Mac host:** Use the existing **Supabase cron → HTTP GET → Next.js route → Vercel runtime** as the hosted design for FORGE and BLSH. Do not buy Vercel Sandbox, restore a paid Supabase project, or push fixtures to the public repository. Don't reopen the hosting decision unless you can name a concrete constraint the existing stack cannot meet. Start the frozen-input replays now using the same pipeline code in an existing private test environment. If the Mac is available, use disposable local Postgres now rather than waiting for hosted setup. Rewind the clock, fix, reset only test state, and rerun the same verified envelope immediately. Keep the off-Mac proof as a separate step, not a reason to delay debugging. For hosted proof, inspect the already deployed routes and the working Supabase cron pattern first. Reuse the existing projects. Keep the replay behind a restricted test route or mode that can read only the frozen fixture and write only to private test tables. Prove the isolation and fit within the route's runtime limit before proposing a run. If a route, migration, access change, deploy or cron firing needs approval, bring me the smallest exact batch. No new paid resources, production scheduling changes, or live arming under this instruction.

**Envelope storage:** Use my existing Google Drive. Create one private, unshared folder named `FHFH replay envelopes 2026-11-20`. Upload only the game-input bundles and their manifests, with no credentials, tokens, or signing keys. Keep originals, reconstructions, and incomplete bundles clearly labeled and separate. Do not overwrite an existing copy. For each bundle, record its Drive file ID, game ID, UTC cutoff, release SHA, byte count, and SHA-256. Download it from the actual off-Mac replay environment using existing authorized access and verify the bytes against the saved hash before using it. If that runner can't read Drive, tell me exactly what's missing. Don't create a paid Blob store, make a public link, or broaden Drive permissions. Keep any local replay moving in the meantime.

## Hosted proof requirement · ~15:40Z (TJ relayed from Codex; verbatim)

Use the existing Supabase and Vercel projects for the required off-Mac proof. For both FORGE and BLSH, **Supabase cron must issue the HTTP GET and the Next.js route must run the real pipeline on Vercel**. A direct GET, local replay, or Codex Cloud run is useful for debugging but does not satisfy that requirement.

Use the same scheduling, request authentication and runtime limits planned for production. Isolate the replay inputs and writes: use the hash-verified frozen envelope, a test clock, test keys and private test tables. Keep production readers, live data and the public feed untouched. Replay evidence must never qualify as live evidence.

Read back the entire chain: cron execution, HTTP result, exact deployment SHA, elapsed time, durable stage receipts and the actual downstream reader results. Prove a duplicate trigger makes no extra writes. If it fails, preserve the receipt, reset only test state and rerun the same envelope immediately. Leave a repeatable, default-off test path for future fixes, not a recurring test job.

Keep local debugging moving while preparing the hosted run. Bring one exact approval for any required deploy, migration, temporary access or one-shot cron. No new paid infrastructure. Report the hosted replay separately from live-game acceptance.

## Fixture rule · ~16:30Z (verbatim)

For the changed roster and identity rows, look for retained versions; if they can't be recovered, mark them missing rather than substituting today's values. You're right that an unselected timestamp isn't a missing timestamp. Keep both games' results out, and use the resulting fixture for the hosted replay without waiting for a new game.

## Correction · ~16:40Z (verbatim)

One correction before the fixture is sealed: **leave out outcomes and post-cutoff evidence, not every row that names the game.** Keep the schedule and any game-specific inputs proven available before the cutoff. Otherwise the replay could fail simply because we removed information FORGE legitimately had.

No need to restart the current turn. Make that distinction part of the fixture review before approving the hosted run.

## Manifest correction · ~16:45Z (verbatim)

One small manifest correction: add **`as_of_unverified`** for rows whose original version can't be recovered. That's different from proving they arrived `post_cutoff`. If one of those rows is required, call the reconstruction partial rather than silently filling it or claiming a faithful replay. No need to interrupt the running turn; catch it in the manifest review.

## WGO recovery + consolidated replay rules · ~17:15Z (verbatim)

The November 19 WGO recovery committed at 14:30:04 UTC Nov 20, transaction `15009521`: 432 rows, independently read back with zero discrepancies. Use `nov19-post-cutoff-repair-evidence.zip` from Astra's recovery folder as evidence of the repair only. Do not import those rows into the 0357/0358 pregame fixtures or use today's values to fill missing historical versions. For BLSH, use the repaired rows only in a separately labeled variant, not as evidence that the original capture would have seen them.

Keep the existing replay lanes moving today. Preserve and hash the original sealed input copy and any reconstructed or repaired variants separately; mark required unrecoverable inputs as `as_of_unverified` and label the fixture partial. Reproduce the failure, reset only private attempt state, and rerun the repair without waiting for a new slate. For hosted proof, use the existing Supabase cron → authenticated GET → Next.js route on existing Vercel, with private replay tables. Use the real-time-anchored fixture, not a global `Date` patch. Recheck current master and coordinate one release owner before proposing any push. Bring me one approval batch for the exact SHA, isolation checks, runtime, cleanup and any cost. No new paid infrastructure, live arming, or rerunning the WGO recovery. Report hosted replay and real-game acceptance separately.

(Evidence zip: /Users/tim/Documents/Codex/2026-11-20/forge-independent-production-audit/recovery/nov19-post-cutoff-repair-evidence.zip, sha256 0f91f5749adabdc2d874735e7925c6bab7103be0a93c417c120440991f5c5dd4, 7 files. Release owner for Claude-side pushes: Chef (local_23eb6989…); lanes never push.)

## Writer guard · ~15:40Z (verbatim)

Keep the writer guard out of the hosted-control push. The guard prevents new bad rows; it's not needed to replay the failure or prove the hosted path. Run that control today without waiting for the daily run.  Finish the writer release candidate today: verify the exact SHA and producer closure, then replay the daily writer on isolated real-input fixtures. Show that valid appearances write unchanged, a real appearance without a game ID is refused without a partial write, and legitimate non-appearances still behave as before. Keep the DB constraint separate.  Hold only the **writer deployment** until Astra reads back a fresh daily forecast in Start Chart and daily RSO on the current writer. Then bring me one exact release approval. If new null-ID rows show up in production before that, flag the evidence and recommend whether to ship the guard sooner. No need to wait for another slate to finish testing it.

## calendar_revision ruling · ~16:40Z (verbatim)

Allow revision-proven schedule content in the **PARTIAL replay only**. For each game, recompute the full `calendar_revision` with the original algorithm and require an exact match to that game's original claim. The match proves only the fields covered by the hash. If the reader needs an unverified field outside that hash, or the hash doesn't match, stop that game at pin and name the missing evidence.

Keep the real `fetched_at` recorded as unknown. In the replay copy only, use the claim cutoff as a conservative stand-in and label it `bounded_by_claim`. Don't write it back or call it an observed fetch time. Preserve the original evidence, hash the derived fixture separately, and continue today through capture, verdict, publication and both RSO readers. Report what passed as partial replay evidence, not exact historical reproduction or live acceptance.

## calendar_revision ruling · ~17:00Z (TJ chose option (b) with conditions; relayed by Chef)

- **Exact match.** Revision-proven schedule content is allowed in the PARTIAL replay ONLY. Recompute the full calendar_revision per game with the ORIGINAL algorithm (each claim's release). It must exactly equal that claim's value: 0357 `d3507a64408243a81ee4537f5c55617aa07300f03acb3d811fc96c676190d399`, 0358 `b9a16eabe9e533233bd1d80c6c0a541fa122d13838d93f929fd76fd6c397cb13`.
- **Coverage.** The match proves only the fields the hash covers. If the capture or a reader needs an unverified field outside the hash, or the hash doesn't match, stop that game at pin and name the missing evidence.
- **fetched_at.** The real fetched_at stays recorded as UNKNOWN. In the replay copy only, use the claim cutoff as a conservative stand-in labelled `bounded_by_claim`. Never write it back or call it an observed fetch time.
- **Preserve and continue.** Keep the original evidence and hash the derived fixture separately. Continue TODAY through capture → verdict → publication → both RSO readers.
- **Reporting.** Report it as partial replay evidence, not an exact historical reproduction and not live acceptance.

## Writer guard release timing · ~16:50Z (verbatim)

Remove the requirement to wait for tomorrow's daily run before proposing the writer guard. Keep the armed hosted control on its pinned SHA. In parallel, finish the guard's exact release package today: rebase onto the resulting master, verify the producer closure and release gates, and cover the blanked game-log ID against disposable Postgres if possible. Bring me the exact SHA, evidence, rollback, and earliest safe release slot as soon as the control is read back and cleaned up. If a specific check prevents a same-day release, name that check, not the calendar. No second push without my approval. The first natural daily run is still a required readback, not an automatic reason to wait.

## Stop 0357/0358 reconstruction; today's deliverables · ~16:55Z (verbatim summary of TJ)

Stop reconstructing 0357/0358: invalid_row reproduced and the repair clears the reader. Save receipts, mark fixtures **partial**, off today's critical path; no more historical exports or timestamp archaeology unless a specific new failure requires it. (1) Finish the hosted control pinned to 3e360ae4c through capture, witness, publication, both readers; receipts + cleanup; first failure → next safe same-day slot within approval; no code change or second push without approval. (2) Real inputs in parallel: 0359 first, then 0360, 0361, read-only scope; sealed hash-verified copies; drive to both RSO readers; report revision, points, legal slot or exact reason; diagnose and rerun from same sealed input today; report the first complete result without waiting for all three. (3) Writer guard release-ready today (SHA, closure, gates, rollback); one approval after control readback + cleanup; next daily run is a post-release check. Deliverables today: hosted receipt and real-input reader receipt, separately; neither is live acceptance. Don't wait on the advisor or bundle automation. If a gate blocks: exact failed check, what's moving, one decision.

## Sealed-collect ruling · ~17:35Z (verbatim)

Build sealed-collect today. Use the local harness's exact replay of the 227 sealed reads in a default-off mode on the hosted route. Verify the envelope and reader-input hashes; stop on the first unrecorded request. No guessed columns, new production export, live fallback, or writes outside private replay tables. Keep the real capture-to-publication logic and both RSO readers in the test. Prove the receipt is marked replay-only and can't enter live serving.

Keep sealed-collect, the writer guard, and reader attribution in separate commits. Bring one push for approval if all three pass promptly on the exact combined SHA. If sealed-collect or attribution hits a real blocker, don't hold the verified guard indefinitely: bring the smallest ready batch and state the build tradeoff. No push until the current synthetic control is read back and cleaned up and I approve the exact release.

After the approved deploy, run 0359 at the earliest safe same-day slot through Supabase cron → GET → Vercel. Verify both readers selected the sealed claim and publication, and compare against the local baseline (Daily 3.8285 at C#1; Detailed missing_participation). Report the hosted receipt and cleanup. Do not arm a live game as part of this approval.
