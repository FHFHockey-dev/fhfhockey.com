# C2 receipt: LUNA-LOCAL F1/F2/F3 repair (isolated snapshot)

- **Lane and IDs:** C2 (Claude session `local_d396b1e2…`, c2-luna-news). LUNA-LOCAL findings F1 and F2 from C7 `handoffs/C7/REVIEW.md`, plus F3 from CLAUDE-20261024-004.
- **Authority:** CODEX-20261024-007 (route the C7 F1/F2 repair to the owner; keep dispatch off), plus the C2 lease in CLAUDE-LEASES.json.
- **Status:** candidate patch only. It is not self-certified. C7 independent review is next.
- **What did not happen:** no canonical edit, no Git write, no dispatch, no paid or model call, no network access, no alias write, no ledger read or write, no production access.

## Base and pins

- **HEAD:** `2a5092d37cb863ec92a2a4e609999cf226bfa4a5`.
- **Canonical pins:** all ten canonical/protected pins in `luna-review-integration-2026-10-23/CANDIDATE.json` match. That is 6 packet files plus 4 protected files: `adapter.mjs` 055bc80c…, `tweetIdentityReplacementReview{,.test}.ts` 2be0e11a…/3abe7656…, `aggregate-budget.sqlite` e8418735….
  - Checked at 16:14Z, before the work.
  - Checked again at about 16:21Z, after the work.
  - The canonical files were never written. The protected files are untouched in the snapshot as well.
- **Snapshot:** `/private/tmp/fhfh-c2-isolated/web`. It is a copy of the working-tree `web/` with no node_modules (symlinked), .next*, .env*, .ms-playwright, .vercel or test-results.
  - Manifest: `/private/tmp/fhfh-c2-isolated/SNAPSHOT-MANIFEST.sha256`, 4,046 files, sha `de744d55…284a`, written at 16:14:20Z before any edit.
- **Patch:** `C2-LUNA-F1-F2-F3.patch`, sha256 `b6dc017e138caaa6edc0d8cc000c7cad5fbdebae4492a648610220dce8bfc249`.
  - 4 files, +52/−14.
  - `git apply --check` against the canonical tree passes (check only; nothing applied).

| File (web/) | Canonical baseline | Candidate |
| --- | --- | --- |
| lib/sources/tweetLunaReview.ts | 1dc24189… | 818d85c4c9f183d857b852aef774d0d395e2ebe34c4dadebfe3c5e7785e9f9aa |
| lib/sources/tweetLunaTransport.ts | 129dfdf3… | 6f67f0e819766eb8b7e712114f063681833ea87266b08443701231461e4d12d1 |
| lib/sources/tweetLunaReview.test.ts | 8a3e8ada… | 8294f598b5209f531db93331498a84cc4de529c2a857f4e559a5a4c99d0dd36b |
| scripts/review-ifttt-luna.ts | 03d37708… | b3407da148f11fe4dd3185e8521f3c1c9b4688232acbff675c9d104902cec8e8 |
| tweetLunaLocalStore.ts, fixture JSON | unchanged | unchanged |

## Changes

- **F1, Decisions-leg holds:**
  - **Problem:** the protected adapter absorbs transport errors as `unknown`/`skipped`.
  - **Wrapper:** `runRetainedTweetLunaReview` now records the error thrown inside its Decisions transport wrapper and rethrows it unchanged, so adapter behaviour is identical.
  - **Hold rule:** after validation, `decisionReview.status === "unknown"` (meaning the leg yielded no usable reference) throws into the existing catch.
  - **Hold result:** that catch sets `status:"held"` and adds one reason from the existing safe set: `luna_dispatch_disabled`, `luna_attempt_held_no_retry`, `luna_budget_*`, or the new `decisions_reference_unavailable` when no transport error was seen. Any other message stays `invalid_or_unavailable_review`.
  - **Unchanged:** `partial_or_unknown` (the leg returned, but some answers are unknown) stays `review_only` with `decisions_unresolved`, as before.
  - **CLI:** needed no change. It already exits 2 on `held`.
- **F2, attempt count:**
  - **Transport:** `createLunaTransport`'s returned function takes an optional third argument, `{ onAdmitted }`. It is called exactly once, right after `admission.reserve` returns `reserved`.
  - **Not counted:** kill-switch and input refusals before admission, budget/lock/ledger refusals, and settled replays.
  - **Counted:** both legs now pass `onAdmitted: () => base.attempts++` in place of the old pre-call increment.
  - **Meaning:** `attempts` = fresh durable reservations, each of which may have been billed. A reservation admitted and then held, for example a missing key after admission, still counts as an attempt (C08 semantics), even though it makes no fetch.
  - **Third-party transports:** a 2-argument transport is still type-compatible, but it would report 0. The only production transport is `createLunaTransport`.
- **F3, typecheck:** `createHash().update(readFileSync(...) as unknown as Uint8Array)` in the CLI and the test. This uses the repo's existing idiom (`scripts/import-player-forecast-season*.ts`). The bytes hashed are unchanged, so the digest check is not altered.
- **Test harness:** `timeout` now accepts `"decisions"` and `stopped` accepts a function. Existing tests keep their semantics.

## Original failures (reproduced before fixing)

- **F1/F2, Vitest on the unfixed source with the new regressions (`luna-evidence/luna-tests-before-fix.log`):** 5 failed, 41 passed (46).
  - Replay reported attempts `[2,2]`; expected `[2,0]`.
  - Kill switch on, identity leg: attempts 1; expected 0.
  - Decisions-only kill switch: `review_only`, attempts 1; expected `held`, 0.
  - Kill switch flipped between the legs: `review_only`, attempts 2; expected `held`, 1.
  - Decisions timeout: `review_only`; expected `held`.
  - Two controls passed both before and after the fix: missing-key attempt=1 and partial review stays `review_only`.
- **F1/F2, real CLI via vite-node on the canonical bytes, run read-only (`luna-evidence/cli-before.log`):**
  - K2 (`--dispatch`, kill switch on): exit 0, `review_only`, attempts 1.
  - K3 (`--dispatch` enabled, absent ledger): exit 0, `review_only`, attempts 1.
  - These match C7.
- **F3, scoped tsc on the two files with the project tsconfig (`luna-evidence/f3-scoped-before.log`):**
  - Exactly the 2 errors: `tweetLunaReview.test.ts(192,40)` and `review-ifttt-luna.ts(22,35)` TS2345.
  - The whole-project exit 2 is already recorded by the orchestrator (`handoffs/C7/orchestrator-full-tsc-1506.log`) on identical bytes.

## Checks after the fix

| Check | Result |
| --- | --- |
| Vitest `lib/sources/tweetLunaReview.test.ts`: Node 22.11.0, `env -i`, owner `network-guard.cjs` preload, one fork worker, cache in scratch | **46/46 pass** (41 original + 5 new). `luna-tests-after-fix.log` |
| CLI K1 default-off | exit 0, `disabled`, attempts 0; **byte-identical** to the owner's `CLI-DISABLED-RESULT.json` |
| CLI K2 dispatch + kill switch | **exit 2**, `held`, attempts 0, holds `[decisions_unresolved, luna_dispatch_disabled]` |
| CLI K3 dispatch + absent ledger | **exit 2**, `held`, attempts 0, holds `[decisions_unresolved, invalid_or_unavailable_review]`. No ledger or lock created; no sentinel key in any output |
| Scoped tsc (2 files) | exit 0 |
| **Whole-project** `tsc --noEmit -p tsconfig.json` in the snapshot (8 GB heap), under `/private/tmp/fhfh-heavy.lock` | **exit 0, 0 errors**. Lock taken free with noclobber at 16:19:20Z and released at 16:20:19Z; never stolen. `full-tsc-run.txt`, `full-tsc.log` |
| ESLint, 4 changed files | exit 0 |
| Authority flags on every K output | `canPublish`, `canWriteAliases`, `canChangeStatus` and `canExecuteReplacement` are all false |

Evidence is in `luna-evidence/`: logs, the `cli-repro.sh` and `full-tsc.sh` scripts, the Vitest and tsc configs, and the before/after CLI outputs.

## Limits and open items (not fixed here)

- **Failed-leg request ID:** a Decisions leg that fails does not put a request ID in the artifact. On timeout there is none. On a provider error it stays only in the ledger's uncertain row (`requestId`), as before. The `requestIds` array lists successful receipts only.
- **Not run:** C7's 40 adversarial controls were not rerun by me. Several record `attempts`/`status` and may need expectation updates by C7: C05, C06, C07, and the K2/K3 expected exit codes.
- **Not addressed:** F3-soft (soft goalie wording), F4 (missing key permanently blocks the ledger), F5 (exact model string) and F6 (newsFeed closure re-pin). These are owner decisions or observations, out of this repair.
- **Not run either:** live provider behaviour, hosted budget store, Release C composition, the 129 retained dependency cases, full suite, build or browser.
- **Next:** C7 independent review of this patch. Integration into canonical stays with the release owner (Codex). No Git work by C2.
