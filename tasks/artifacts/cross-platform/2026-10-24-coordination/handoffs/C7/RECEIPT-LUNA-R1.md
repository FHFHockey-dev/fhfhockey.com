# C7 independent review — LUNA-LOCAL repair R1 (C2 patch `C2-LUNA-F1-F2-F3.patch`)

**Reviewer:** Claude C7 lane session. C2 authored the repair; C7 only raised the original findings. This review was read-only: no canonical edits, no Git writes, no dispatch, no paid or model call, no network, no ledger read or write, no server.

**Verdict: accepted.** F1, F2 and the typecheck finding (F3 in C2's receipt, F7 in my `REVIEW.md`) are fixed. Dispatch stays off by default, the authority flags all stay false, and the protected pins are untouched. The packet-wide verdict in `REVIEW.md` changes from "dispatch blocked on F1/F2" to **dispatch unblocked from C7's side**. Hosted activation and spend still need their own approvals; nothing here grants them.

## Pins

- **Patch:** `b6dc017e138caaa6edc0d8cc000c7cad5fbdebae4492a648610220dce8bfc249` (matches).
- **Scratch build:** I rsynced the working tree `web/` at 16:45Z into scratch, excluding node_modules, build output and `.env*`. All six packet pins and four protected pins matched `CANDIDATE.json`: 10/10. The ledger was hashed in place, not copied or opened.
- **After `git apply`:**
  - `tweetLunaReview.ts` → `818d85c4…`
  - `tweetLunaTransport.ts` → `6f67f0e8…`
  - `tweetLunaReview.test.ts` → `8294f598…`
  - `review-ifttt-luna.ts` → `b3407da1…`

  These equal C2's table. `tweetLunaLocalStore.ts` (`52977c79…`), the fixture (`e787036b…`), `adapter.mjs` (`055bc80c…`) and the R1 pair (`2be0e11a…`/`3abe7656…`) are unchanged.
- **Code checks:** `onAdmitted` is called only after `reserve()` returns `reserved` (after the replay return, at transport line 51). The F1 throw sits after the adapter call, so the protected adapter's behaviour is unchanged.

## Original failures, reproduced on the unpatched scratch base (`r4-evidence/luna-r1/`)

**Vitest** (owner 41 + my 40 original controls + 12 new R1 controls), under the owner's network guard and `env -i`, cache in scratch: 84 passed, **9 failed** (`base-vitest.log`). The failures are the R1 controls encoding the repaired contract:
- **F1:** Decisions timeout → `review_only` (my C07). Kill switch flipped between legs → `review_only` (C06). Decisions-leg budget refusal → `review_only`.
- **F2:** attempts reported 1 with nothing admitted, for: kill switch, ledger stopped, `maxCalls` 0, unsettled leftover, and settled replay (`[2,2]`).

**Real CLI** (`cli-base.log`):
- K2 `--dispatch` with the kill switch on: **exit 0**, `review_only`, attempts 1.
- K3 `--dispatch` with the ledger absent: **exit 0**, `review_only`, attempts 1.
- These match my original receipt.

**My own control mistakes, logs kept:**
- R1-03 run 1 used a 70 KB statement. It was held upstream (`retained_packet_unresolved`) and never reached the adapter.
- R1-03 run 2 used a Decisions reply with no answers. The adapter returned `partial_or_unknown`, which stays `review_only` with `decisions_unresolved`, as C2's receipt documents and as intended.
- I reworked R1-03 into an observation control. The `decisions_reference_unavailable` path (the adapter skipping without calling the transport) **was not reached by my fixtures**.

## After the patch

| Check | Result |
| --- | --- |
| Vitest, same set (owner 46 + C7 40 + R1 12) | **98/98 pass** (`after-vitest.log`) |
| C05 kill switch | attempts 1 → **0**, still `held` |
| C06 kill switch flipped between legs | `review_only` → **`held`** `[decisions_unresolved, luna_dispatch_disabled]`, attempts 1 (one real request) |
| C07 Decisions timeout | `review_only` → **`held`** `[decisions_unresolved, luna_attempt_held_no_retry]`. Reservation retained, ledger `unknown_billed_outcome` |
| R1-04 budget refusal on the second leg | **`held`** `luna_budget_exhausted`, attempts 1, ledger not blocked |
| Refusals before admission (kill switch, stop, maxCalls, unsettled, expired, stale lock) | attempts **0** |
| Admitted then held (missing key C08, settle lock contention C13, HTTP 500, 2xx with an invalid binding) | attempts **1**: reservation made, possibly billed |
| Replay of settled receipts (R1-06) | attempts **0**, no fetch, `review_only` |
| R1-07 | `attempts` equals the number of new ledger rows |
| CLI K1 default-off | exit 0, `disabled`, attempts 0. **Byte-identical** to the owner's `CLI-DISABLED-RESULT.json` |
| CLI K2 / K3 | **exit 2**, `held`, attempts 0. No ledger or lock created. No sentinel key in any output |
| CLI K3b / K4 / K5 / K6 | exit 1 with the generic message. The existing output file is unchanged |
| Authority flags | `canPublish`, `canWriteAliases`, `canChangeStatus` and `canExecuteReplacement` are false on every result (asserted in every control) |
| **Whole-project `tsc --noEmit`** on the patched scratch copy, 8 GB heap, under `/private/tmp/fhfh-heavy.lock` | **exit 0, 0 errors** (`full-tsc-after.log`) |

The heavy lock was held by C2 when I first checked. I waited and did not take it then. Later I acquired it with noclobber, when free, at 16:50:44Z, and released it at 16:51:44Z.

## Remaining (unchanged, not blockers for this repair)

- **Request ID of a failed Decisions leg:** not in the artifact. It stays in the ledger's uncertain row only. C2 discloses this.
- **Untouched findings:** F3-soft (soft goalie wording), F4 (a missing key permanently blocks the ledger), F5 (exact model string), F6 (`newsFeed.ts` closure re-pin).
- **Type cast:** the F3 fix uses an `as unknown as Uint8Array` cast. It is a repo idiom and the hashed bytes are unchanged, but it silences type checking at those two calls.
- **Not run:** live provider, hosted store, Release C composition, full suite, build or browser.
