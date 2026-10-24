# P07 R2 — clock correlation and publication expiry

**All294tests across10files pass, including the three reproduced R1 failures and unchanged C08.** Eight application/test paths changed. TypeScript/lint remain pending shared heavy-check lock coordination; no such lock location/protocol was supplied or located in the repository instructions/handoffs, so neither command was launched. Independent R2 acceptance and current-tree integration are pending.

## Correction

1. The execution adapter generates a fresh UUID nonce in `X-RSO-Read-Nonce`. The existing public data route validates/echoes it with the server's evaluation timestamp, includes that receipt in the whole-body byte budget, and forces private/no-store. A missing/mismatched nonce or manifest timestamp differing from the server evaluation is rejected. Existing callers without a nonce retain their previous response behavior. No private account fields, signing key, storage or new endpoint were added.
2. Forecast admission uses the correlated server evaluation cutoff. Current runtime permissions use that server time plus elapsed request/computation time; the full round trip conservatively bounds transit. Browser/server epoch offsets do not enter this comparison. Monotonic elapsed time prevents backward clock corrections extending authority; positive wall jumps conservatively count elapsed time, including platform sleep where the performance clock may pause. The existing20-second read budget still applies. Future source timestamps are not made valid merely because delivery took time. The manager/provider snapshot and its evidence timestamps remain untouched.
3. Applicable positive-review deadlines are captured before calculation alongside source deadlines. The adapter checks them immediately before publication. Crossing either deadline clears numeric plan inputs, candidate metrics and display evidence together by evaluating capacity-only inputs. It does not filter away an already-expired review. Production review catalog remains empty; positive reviews exist only in synthetic fixtures.
4. The result carries a monotonic publication deadline for the hook, comparable across the window/worker time origins. Source/review expiry remains timely under device-wall-clock changes. The legacy wall deadline is retained for existing result fixtures; real executions provide the monotonic deadline. Current-read graph replacement, synchronous authority lifetime, worker/fallback coalescing and both goalie gates remain intact.

## Evidence

- Before edits, copied original six-case independent boundary test:3pass/3fail, exactly the two±5s skew failures and expiry-during-compute failure. `evidence/reviewer-reproduction.log`.
- First corrected focused run:47pass across route, adapter and hook; `evidence/first-correction.log`.
- Reviewer boundary assertions, real UI single-read and C08:8pass; `evidence/independent-oracles-corrected.log`. The six-case boundary file is byte-identical to the review artifact. Its fixture response helper and the real-UI fetch stub only add the new server nonce/evaluation receipt; all original assertions/time manipulations are preserved. Original reviewer files are untouched; adapted copies and explanation are in `review-fixtures/`.
- Final focused run:294pass/10files, `evidence/final-tests.log`; exact paths in `TEST-FILES.json`. Covers native review admission/expiry under both clock offsets, source expiry/transit, server cutoff, old/future manifests, nonce mismatch, read timeout, monotonic hook invalidation, unchangedC08, transplants, authority lifetime, real worker/fallback, selected-source/bridge/StartChart and contribution permissions. No807-suite repeat.
- Scoped whitespace check and R2 patch dry-run both pass; logs in `evidence/`.
- TypeScript and lint: **pending coordination**, not passed or attempted. R1 receipts are not relabeled R2 evidence. Browser Worker packaging/runtime and production behavior were not tested.

## Exact candidate and concurrent work

`CANDIDATE.json` pins32P07candidate files and the exact8-file `r2_delta`; `after/`, `r2.patch`, `BASELINE.json`, `SHA256SUMS` and `FIXED-SNAPSHOT.json` preserve reviewable/reproducible bytes. The fixed tree has3375files: R1's3372 plus three artifact-only reviewer fixtures. Overlay SHA-256:

`13c85ce88e9ec109791470315f724a61caafe324d6fcc9ea8a08197d83eec4b2`

R1 and original independent-review artifacts remain unchanged. The brief collision pause was lifted after parent mapped Claude tasks6/7/8/11 to disjoint files; none were touched. Display paths were released to task10 at recorded hashes in `DISPLAY-LEASE-RELEASE.md`.

During final comparison, canonical `web/lib/rosterScheduleOptimizer/planning.ts` changed outside this eight-file lease to `09918cdb16f2eeee00554448b953c16f773b2e3f42455e213dac7e4f38ec5474`. It was preserved and not silently copied into the tested snapshot. `CANONICAL-COMPARISON.json` distinguishes this concurrent work. R2's verified snapshot still uses the exact R1 planner. Parent must assign current-tree integration/review of that later dependency separately.

## Remaining gates

Shared heavy-check lock protocol/availability is needed for TypeScript/lint. Independent R2 review and reconciliation with later planner/display work are pending. Native target reviews, authentic configuration/artifact identities, predictive/as-of qualification, browser/runtime/rollout and production authorization remain separate. No accuracy improvement or historical requalification is claimed.

No credentials, actual network/service/DB/NST/provider calls, dependency changes, schema/storage, process intervention, commit, push or deployment. No tool action was denied; validation is pending coordination, not uncertain execution.
