# R18 transaction postcondition correction

Local correction verified; independent review pending. No runtime/application file changed in this increment. All prior 103 source pins, 15 original snapshots, 69 owner artifacts and 218 R18 review artifacts remain byte-identical. Work stays on `octoberBranch`; no staging, commit, checkout synchronization, hosted query, migration, activation, dispatch, replay, push or deployment occurred.

- [x] Preserve rejected checkpoint and unchanged R18 reproductions.
- [x] Correct staged SQL5 and verify rollback/recovery against disposable storage.
- [x] Run focused tests and scoped TypeScript.
- [ ] Independent correction review.
- [ ] Operational prerequisites and separately approved rollout.

## Changed behavior

`20261016073503_tweet_claim_shadow_raw_ack.sql` is a **replacement draft** for the same SQL5 under `../shadow-raw-ack-increment/`. Select only this replacement in a future approved migration package; never apply both alternative definitions. SQL1–4 and their prerequisite/order gates remain unchanged. Nothing entered an active migration tree.

The function retains the locked raw and job rows, computes their exact expected completed rows, performs both writes, then reads both actual rows again before returning. It compares complete rows, including unchanged source identity/attribution, receipt clock, attempts and retained job payload. A BEFORE or nondeferred AFTER trigger that changes either expected result raises inside the same transaction and rolls back settlement. Success returns the actual stored job acknowledgment. The original observation evidence, owner/server-clock lease checks, duplicate serialization and bounded read-only lost-reply recovery remain unchanged.

This closes R18's observed intra-RPC write-trigger mismatch. It does not establish universal fencing against arbitrary subsequent service-role writes or caller statements. Complete deployed schema/trigger/ACL/writer inventory remains required; deferred commit-time writers were not exercised or accepted. Strict whole-row preservation deliberately holds on an incompatible deployed trigger rather than certifying an altered receipt.

## Verification and evidence

- `evidence/unchanged44-results.json`: all 44 copied reviewer/owner cases passed against the initial correction. This rerun retained the three R18 assertions unchanged.
- `evidence/final54-results.json`: **54/54 pass** against final SQL: 40 SQL cases and 14 actual hook/default-off cases; 53 use disposable Postgres and one checks default-off behavior. The original 44 cases remain; ten added controls cover full rollback for nine raw/job rewrites and a later job AFTER-trigger raw-clock rewrite followed by fault removal and successful idempotent recovery. Retained observations and job metadata survive, attempts stay one, and no dispatch is created.
- `evidence/scoped-tsc.log`: scoped TypeScript exit 0. No application TypeScript changed, so lint was not rerun. No full compiler, build, browser, full web suite or broader 81-case regression run occurred in this increment. Earlier 118 passes are retained evidence, not rerun/current combined acceptance.
- `evidence/R18-*.json`: corrected readbacks from the unchanged reviewer cases. Original failing records remain under `../review-shadow-raw-ack-v1/evidence/`; none were overwritten.
- `evidence/sql5-correction.diff` and `evidence/fidelity-integrity.json`: exact bounded SQL change, byte-identical integration copy, unchanged reviewer SQL prefix/assertions, prior checkpoint/review integrity and 15 matching live/captured dependencies. Both test files load this directory's replacement SQL5; their snapshots preserve the accepted `1f08…` contributions dependency without inferring goalie-policy acceptance.

PG17 ran on fresh private Unix sockets, with TCP disabled and the network-denial harness, then stopped and removed both clusters. Test and scoped compiler processes are finished. No hosted application/database call occurred.

## Frozen correction

`owned-source-v2-sha256.json`: **110 files**, SHA256 `bbff39c42f357166a8714f0a087029bfc2aa6397b4c8989161bd1ad067d20717`, plus 15 read-only dependency snapshots. The original 103 paths are retained evidence; seven new paths contain the selected replacement SQL and test/config inputs. SQL5 SHA256: `be0d24b025d1b83d294b0f20c7cca40510b5ef6c712a2ad71586ad1c754df59d`.

These paths and snapshots are held for independent review. Only new report artifacts outside the pins may change while held. No other implementation writer is authorized here.

The historical ledger remains 225/227 matching assertions across 50/52 rows, with ambiguous CR011/CR051 negatives and separate approved positives preserved. This correction does not extend full52, authentic source/dated identity/history, native/external consumer, HTTP receiver, external queue or genuine future-performance acceptance. All operational gates in `../shadow-raw-ack-increment/ROLLOUT-GATES.md` remain open. Next implementation boundary, after acceptance: bounded HTTP raw-receiver durability and identity/variant behavior described in `../shadow-raw-ack-increment/RAW-RECEIVER-NEXT.md`, with ownership coordinated before any edit.
