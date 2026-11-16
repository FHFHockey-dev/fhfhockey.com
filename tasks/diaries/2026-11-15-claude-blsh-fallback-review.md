# 2026-11-15 claude: BLSH 11-18 fallback independent review

**Scope:** second, independent, offline read-only review of the parked 2026-11-18 fallback set (candidate, operator, bridge). Started by Chef `local_56526db8`. No edits outside `tasks/artifacts/blsh-fallback-review-2026-11-15/` and this diary; no commits; no network; GIT_DIR unset in every run.

**Where:** octoberBranch HEAD `2c1cd633d`; fallback base `348a122d6` (ancestor; no drift since in web/scripts/blsh, web/lib/buyLowSellHigh, web/lib/nst, package files).

## Checkpoints
- Candidate: hashes match (patch 209b34eb, CANDIDATE 5029c1cc, HANDOFF 28d4287b); `git apply --check` on HEAD exit 0 (not applied); scratch apply gives bootstrap 849009ee; bootstrap diff = SLOT + OUTPUT only. Timing rule re-derived from currentProcessEvidence.server.ts:210-215/252 and preparation :48.
- Operator: launcher diff = docstring, slot dates, lock name, G3 baseline pin only. Baseline-1118 differs from v5 only in sources.bootstrapSHA256. Tests 49/49 (1117 and 1118). Rehearsal 1118: 26 PASS / 2 SKIP / 0 FAIL.
- Bridge: v5-1118 vendored files match candidate; verifier identical; staged tool = exactly 2 edits. Rehearsal v5-1118 21/21 PASS.
- Findings: (1) bridge check-attestation OPERATOR_PINS["v5-1118"] still null though operator built 2670353d/e9c7ec5a → post-capture gate 2 refuses; (2) RUNBOOK §8 "move 11-17 T−0 files" precedes the 11-17-lock stop-check and launcher-1118 has no cross-slot lock check.

## State / next
- DONE: REVIEW.md 6ef29d6f…, SHA256SUMS 656b5b7b… in tasks/artifacts/blsh-fallback-review-2026-11-15/ (repro R1–R5 + logs). Verdicts: 1 APPROVE; 2a APPROVE; 2b RUNBOOK §8 DO NOT APPROVE (M2); 3a APPROVE; 3b staged tool bytes APPROVE; 3c set-runnable DO NOT APPROVE (H1 null operator pins, H2 swap not done, M1 SWAP timing guard).
- Extra checks after advisor: candidate rehearsal outcome-identical to v5; 7/7 explicit-candidate negatives refuse (R5); check-attestation has no other 11-17 literals.
- Next: Chef relays REVIEW-2; H2 swap hashes get a short check when executed.

## Gotchas
- Compound `cd` in Bash changes the session cwd; use absolute paths.

## Recheck (Chef request, 2026-11-15 ~21:45Z)
- REVIEW-2.md written: overall READY for TJ's approval decision (if 11-17 missed). H1, M1, M2, L1, L2 FIXED/APPROVE; H2 open by design (gated); RECHECK-11 B1 guards cover 1118.
- Runs: bridge rehearsal v5-1118 31/31; operator rehearsal 1118 31/2/0; launcher suites 49/49 x2; R6 attestation mutations (9 cases) all as expected; R7 date guards refuse only 11-17/18; patched typecheck exit 0.
- Gotcha: `npm run typecheck` with a fresh HOME triggered npm's update notifier (likely one anonymous registry request); disclosed in REVIEW-2. Use --no-update-notifier next time.
- New Low N1: other reviewer's recheck8/recheck9 probes run the real 11-17 launcher unguarded.

## BLSH v6 cron review (Chef request, 2026-11-15 ~22:00Z)
- Scope: independent offline review of tasks/artifacts/blsh-cron-v6-2026-11-15 + web/lib/blsh/nativeCaptureV6, route, 2 migrations (files only), SQL test. Output: V6-REVIEW.md in this folder.
- Scratch export: $SCRATCH/v6x (HEAD web+supabase, v6 untracked files copied, sums 34/34 OK, node_modules symlinked; reader folder copied).
- Runs so far: vitest 8 files 37/37 (sandbox, network denied except localhost); my repro V-R1..R3 pass; SQL test 50/50 on disposable local postgres (unix socket only; user temp dir, my run's dir removed).
- Findings so far: Medium concurrency/TLS-observer (unverified Fluid); Low: missing-D = no_slate, pre-schedule checkpoint shares 15 s timeout, pre-try refusal leaves claimed, DESIGN approved bytes not retained.
- DONE (~23:00Z): V6-REVIEW.md written. Areas 1-7 APPROVE (code + inert deploy/apply); schedule/enable NOT YET: needs probe incl. M1 (process-wide sendHeaders observer vs concurrent requests; V-R4 reproduced). Lows L1-L7. Extra runs: census tests 133/133 (after adding cron-schedule.md to scratch), tsc exit 0, V-R4 x2.
- Gotcha: postgres unix socket path >103 bytes under the session scratchpad; the SQL test needs the short user temp dir.

## V6 recheck (Chef request, ~23:30Z)
- Baseline = my scratch copy of the reviewed bytes ($SCRATCH/v6x); fresh export $SCRATCH/v6y of SHA256SUMS ae8caef1 (40/40).
- V6-RECHECK.md: (a) inert deploy + migration apply APPROVE (deploy still needs TJ build approval); (b) scheduling gated by probe incl. M1 (Fluid + own function timeout 250 via deployment function list), items 6/7/8/12/13, registration landing with inventory.
- M1 partly fixed (separate config = separate function per Vercel docs; glob-overlap precedence undocumented -> probe check). Narrowed observer not needed; if Fluid stays on prefer a cron-bearer pre-gate before adminOnly. L1-L7 FIXED.
- Runs: vitest 173/173 (v6 40), tsc 0, SQL 57/57, recheck repro 7/7. WebFetch/WebSearch vercel.com only.

## V6 M1 fix review (Chef request, 2026-11-16 UTC)
- V6-M1-REVIEW.md: APPROVE parts 1+3 (commit + inert deploy); scheduling gated by probe B (B-M1a own function, B-M1b self-test in prod) + earlier items.
- Verified: v5 lines 14-52 byte-identical (f05d54f6); HEAD v6 = rechecked bytes; only adapter import + handler gate 5.5 changed. Vitest 182/182 (v6 61).
- Plain-node experiment on npm undici 7.29.0 (cheerio's Agent) + real loopback TLS: 40/40 attributed with concurrent same-path foreign traffic; context break fails closed; self-test passes. Cross-context TLS resumption not observed on loopback.
- Gotcha: inside vitest the npm-undici class identity check fails (module loading); use plain node --experimental-strip-types for dispatcher-path proofs. Throwaway cert deleted.
- Lows: self-test fetch uses cache:no-store unlike production calls; PROFILE-SPEC should caveat connectionReused:false (part 2 deferred).
