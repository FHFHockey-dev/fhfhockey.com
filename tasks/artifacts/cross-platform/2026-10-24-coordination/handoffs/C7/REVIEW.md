# C7 independent review — LUNA-LOCAL (six-file manual/default-off packet)

Reviewer: Claude C7 lane session (independent; did not author the packet). Read-only application custody. Evidence-only writes: this folder plus reviewer scratch outside `web/`. No Git writes, server, paid/model request, production read/write, alias write, ledger mutation or hosted activation.

## Verdict

| Scope | Verdict |
| --- | --- |
| Six files at pinned hashes, **default-off use** (CLI without `--dispatch`; caller `enabled !== true`) | **ACCEPTED.** Zero attempts. No key, ledger, transport or network touched. All authority flags are false. |
| Admission/reservation store, transport wire caps, kill switch, uncertain-spend hold | **ACCEPTED** (offline, synthetic responder). Reservations are never silently freed. |
| Identity source-time and goalie occurrence binding | **ACCEPTED** for hard statuses. See F3 for soft statuses (observation only). |
| Any `--dispatch` / enabled use | **BLOCKED** until F1 and F2 are repaired. Money safety holds, but the review artifact misreports Decisions-leg stops and failures as `review_only`, and the CLI exits 0. |
| Live provider behaviour, hosted budget store, Release C composition, the 129 retained dependency cases | **Unqualified / not in this review** |

> **Update (ticket 4, about 17:00Z):** C2's repair `C2-LUNA-F1-F2-F3.patch` (`b6dc017e…`) fixes F1, F2 and F7 (full-tree tsc exit 0). See `RECEIPT-LUNA-R1.md`. From C7's side, dispatch is no longer blocked. Activation and spend still need their own approvals.

## Pins (re-verified independently)

- At 14:40:24Z and again at 14:47:02Z, HEAD was `2a5092d37cb863ec92a2a4e609999cf226bfa4a5`. All 6 new-file pins and all 4 protected pins match `tasks/artifacts/luna-review-integration-2026-10-23/CANDIDATE.json`: 10/10 before and after my runs. `application.patch` = `3a80fdab…bd6a` matches. The R1 pair (`tweetIdentityReplacementReview{,.test}.ts`, git ` M`) and the aggregate SQLite ledger match. The ledger was not opened.
- Imported closure (`SOURCE-CLOSURE.json`, 38 files): 37/38 match.
  - **F6 drift:** `web/lib/newsFeed.ts` is now `de831779…218d`, modified 2026-10-23 11:20 −04:00. The closure was pinned at `fc5466e9…` at 09:26. The current bytes equal the Codex release-readiness candidate pin (`tasks/artifacts/release-readiness-2026-10-24/CANDIDATE.json`).
  - The file is imported **only by the test** (homepage-compatibility control). The owner's 41/41 ran against the older bytes. My rerun passes against the current bytes.
- Actual imports of the six files are all repo-relative paths inside the pinned closure, plus `zod`, `node:*` and `vitest`. The CLI hashes the protected `adapter.mjs` against `DECISION_REFERENCE_SHA256` before any work.

## Executed (Node 22.11.0, `env -i`, owner `network-guard.cjs` preload, one fork worker, Vite cache in scratch)

1. Owner suite rerun, `lib/sources/tweetLunaReview.test.ts`: **41/41 pass**, exit 0 (`evidence/owner-rerun.json`). This reproduces the owner's final run on the current dependency bytes. It is not added to my count.
2. Independent adversarial controls, `evidence/c7LunaAdversarial.test.ts`: 27 control IDs and 40 cases.
   - Final run: **40/40 pass** (`evidence/controls.log`, `evidence/controls-observed.json`).
   - Original failures are preserved:
     - Run 1 (`controls-run1-original.log`): 1 failure, C18. My exact expectation of 232,689,600 was wrong; `Math.ceil(x*1.1)` yields 232,689,601. That is a conservative round-up, not a defect.
     - Run 2: C24's text lacked the subject mention, so it was held pre-dispatch at the wrong layer. I corrected the text, and it is now rejected at the validator (`goalie_subject_binding_invalid`).
   - C01 proves the guard is active inside the worker (`fetch` → `OFFLINE_LUNA_TEST_NETWORK_DENIED`).
3. Real CLI through vite-node, 7 invocations (`evidence/cli-controls.sh`, `cli-controls.log`, `cli-outputs/`). Outputs went to scratch:
   - K1 default-off: exit 0, `disabled`, attempts 0. Output is **byte-identical** to the owner's `CLI-DISABLED-RESULT.json`. The `--ledger` target was not created.
   - K2 `--dispatch` with kill switch on, and K3 `--dispatch` enabled with an absent ledger: **exit 0, `review_only`, attempts 1** (F1/F2). No network. No ledger or lock created. The sentinel key does not appear in any output.
   - K3b (no `--ledger`), K4 (existing output), K5 (input = output), K6 (run from repo root): exit 1 with the generic message. K4 left the existing file unchanged.
4. Scoped `tsc --noEmit -p …/tsconfig.json`: exit 0. Five-file ESLint: exit 0.

Distinct C7 evidence: 40 control cases plus 7 CLI runs. The owner's 170 are claims; I reproduced 41 of them.

## Findings (repair goes to the owning lane, C2 / packet author; I made no fixes)

**F1 — Medium (blocks dispatch use): Decisions-leg holds are masked.**
- **Mechanism:** the protected `createShadowAdapter` catches every transport error and returns `status:"unknown"`. `tweetLunaReview.ts:141-144` maps that to the hold `decisions_unresolved` and leaves `status:"review_only"`. The CLI then exits 0, because only `held` exits 2.
- **Observed cases:**
  - C07: Decisions timeout. The ledger is correctly `unknown_billed_outcome` with a 233,000,000-nano uncertain reservation, but the artifact says `review_only` and lacks the Decisions request ID.
  - C06: the kill switch flipped between legs.
  - K2: kill switch on via the real CLI.
  - K3: missing ledger via the real CLI.
- **Smallest fix (in the packet's own file, adapter untouched):** when `sidecar.status` is `unknown` or `skipped`, set `status:"held"` and add a safe hold carrying the adapter reason, e.g. `decisions_transport_held` / `luna_dispatch_disabled`.

**F2 — Low (false-effect counter): `attempts` counts transport invocations, not dispatched requests.**
- `base.attempts++` runs before `transport()` (`tweetLunaReview.ts:122,136`).
- C05 (kill switch on): attempts 1, with 0 fetch, 0 key reads and an empty ledger. C07 rerun (budget stopped): attempts 1. K2/K3: attempts 1.
- The default-off zero-attempt claim holds. The dispatch-mode artifact overstates.
- Fix: count only after admission returns `reserved`, or rename the field to transport calls.

**F3 — Observation (no authority expansion): soft goalie statuses are not wording-checked.**
- C26: `likely` on "will not start tonight" and `projected` on "ruled out tonight" are both accepted.
- In both cases `verified:false`, `appliedOverride:null`, `human_review_required` is set, and the post-acceptance floor is 0.8 / 0.65.
- HANDOFF's "explicit not-starting contradiction" coverage applies only to `confirmed`. Whether to reject contradictory soft labels is the owner's decision.

**F4 — Observation: a missing key after admission permanently blocks the ledger.**
- C08: no fetch occurs, but the row is set to `uncertain` and `blockedReason` to `unknown_billed_outcome`.
- This is conservative and documented, but a configuration mistake will need manual ledger repair.

**F5 — Unqualified offline:**
- An exact `model === "gpt-6-luna"` match means a dated provider model string would block the ledger every time (C14).
- The live usage, Decisions shape and `x-request-id` behaviour are unverified.
- Note on `controls-observed.json`: its ledger `requestId` column reads the row-level field, which is set only on uncertain rows. Settled request IDs live in `receipt.requestId`, and the artifact's `requestIds` show them. That column is a recording artifact, not packet behaviour.

**F7 — Low (added 16:2xZ; blocks a full-tree type gate):** `tsc --noEmit -p web/tsconfig.json` exits 2 with exactly two errors, both in this packet:
- `lib/sources/tweetLunaReview.test.ts(192,40)` and `scripts/review-ifttt-luna.ts(22,35)`: TS2345, `Buffer` not assignable to `BinaryLike` (`createHash().update(readFileSync(…))`).
- The packet's scoped tsconfig, which both the owner and I ran, passes. CANDIDATE.json records `fullTreeTypecheck: false`.
- The behaviour at runtime is unaffected.
- Fix (owner): pass `new Uint8Array(buf)` or the file contents as a string.
- Evidence: `c1-c4-evidence/fulltree-tsc.log`. C4 independently reported the same two errors.

**F6 — Pin hygiene:** the release owner should re-pin `web/lib/newsFeed.ts` in the closure, or record that the current release-readiness bytes are intended.

## Confirmed controls (all pass)

- **Zero-attempt / disabled:** default-off and non-boolean `enabled` values (`"true"`, `1`, `{}`) make zero calls, and a missing ledger is never created (C02–C04). The kill switch is checked before admission and before key lookup (C05).
- **Uncertain spend:**
  - Timeouts, HTTP 500, responses over 256 KiB, unresolved usage (cached tokens, priority tier, dated model, missing usage, output over 2048, negative input) and lock contention at settle all retain the reservation. None of them settles (C07, C13–C15).
  - Leftover `reserved` or `uncertain` rows block admission (C09). A stale lock is never stolen, and the ledger bytes stay unchanged (C10). Expired, disabled, `maxCalls` 0 and cap-below-reservation ledgers admit nothing (C11).
  - The aggregate counts prior exposure plus settled charges (C12). The ceiling is 232,689,601 nano, at or below the 233,000,000 reservation (C18).
- **Wire:** callers cannot widen tools, store, tokens, tier or extra fields, and redirects are set to `error` (C16). Provider error text and the key never reach the artifact (C17).
- **Binding:**
  - The same source instant in another valid format is accepted, while +1 ms is held pre-dispatch (C19).
  - `asOf` before publish or after now is held, and a review clock earlier than ingestion is held (C20, C21).
  - An alias known after publish is excluded in causal mode. Retrospective mode is explicitly marked (C22).
  - Goalie evidence spanning another occurrence, a non-goalie subject, a canonical-ID mismatch and duplicate occurrences are all rejected (C23–C25).
  - The Decisions wire is byte-identical with and without the Luna identity leg, so model proposals never become reviewer facts (C27).
- **False-effect flags:** `canPublish`, `canWriteAliases`, `canChangeStatus` and `canExecuteReplacement` are false on every observed result, including all K-runs.

## Not done / limits

- No live or hosted call. No full suite, build or browser run.
- The 129 retained dependency cases were not rerun; their files match the closure pins, and none changed in this packet.
- No review of Release C composition or of the dependency diffs.
- The old SQLite ledger and the hosted budget store are out of scope.
- Social-share (C7 later ticket) is not started.
