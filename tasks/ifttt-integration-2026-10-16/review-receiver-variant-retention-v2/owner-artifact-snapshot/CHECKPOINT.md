# R19 receiver preservation correction

Local correction verified; **independent review pending**. No application/runtime file changed from the receiver-v1 candidate. All119 prior source pins,41 owner artifacts,217 R19 review artifacts and15 live/captured dependencies remain unchanged. New work is confined to this replacement SQL6 and copied local test/config inputs. No staging, commit, synchronization, deployment, hosted query/DDL, live ingestion, processor dispatch, replay, flag or scheduler activation occurred.

- [x] Preserve v1/R19 evidence and unchanged reviewer assertions.
- [x] Avoid INSERT for existing carriers; reconcile absent-key conflicts safely.
- [x] Run focused disposable-storage controls and scoped TypeScript.
- [ ] Independent correction review.
- [ ] Separately approved operational prerequisites and rollout.

## Correction

The RPC now takes a transaction advisory lock for its exact table/source/post key, then locks and snapshots an existing raw row **before any raw INSERT**. Existing carriers skip INSERT entirely, so a conflict-skipped INSERT trigger cannot mutate the original before the snapshot.

Only an absent key attempts insertion. The function supplies the expected generated ID and server receipt clock and checks the entire inserted row against its prebuilt expectation. Cooperating RPC callers serialize and converge to one carrier. A direct writer need not take this advisory lock: if it wins the absent-key race, the RPC detects that its own insertion did not happen and raises, rolling back any conflict-trigger writes. A fresh HTTP request can then lock that committed carrier and retain the differing input as held. No automatic mutation retry or independent action is issued. The existing complete stored-receipt/raw postcondition checks remain.

The function explicitly sets a2-second runtime lock timeout. **Timeout clarification:** the migration's top-level5-second `SET LOCAL statement_timeout` bounds its DDL transaction; it is not evidence of a5-second per-RPC deadline. The deployed caller/role statement budget and trigger inventory remain prerequisites. No deferred commit-time or subsequent/universal writer guarantee is added.

## Checks and evidence

- `evidence/unchanged53-results.json`: all53 unchanged cases pass, including both original R19 contract assertions. The copied reviewer41-case body/assertions remain byte-identical up to its enclosing close; six new controls are appended.
- **59 distinct cases passed across focused runs:**47 actual private-PG cases and12 nearest mocked receiver cases. The initial59-case run passed57 and hit two new race-fixture parameter-cast errors; both original failures remain in `evidence/final59-results.json`. After correcting only the timestamp/text cast, only those two cases were rerun and passed in `evidence/repaired-race-results.json` (57 skipped). `evidence/check-summary.json` reconciles case names/statuses without counting skipped cases as passes. There was no later full59 rerun by the owner.
- The added controls cover both raw tables: an initial raw receipt-clock trigger rewrite must roll back; CCC exact/changed-key retries must skip INSERT triggers; and a **real two-connection absent-key race** must preserve a separately committed carrier, roll back a1-microsecond trigger mutation, return500 and then reconcile by a fresh held receipt. `evidence/absent-race-*.json` contains full before/after rows and results. The race is coordinated through observed private `pg_locks`, not a timing assumption.
- Scoped TypeScript exits0. Runtime source/test files are unchanged from v1's passing lint, so lint was not rerun. No broad81, full compiler/build/browser, hosted PostgREST or external sender test occurred.
- All private PG17 tests used Unix sockets/TCP disabled, fixture credentials/data, a local RPC bridge and network denial. Test/compiler processes finished and clusters were stopped/removed.

Original failing R19 evidence remains under `../review-receiver-variant-retention-v1/`. The earlier same-key body-loss reproduction and v1 retained-variant positive are also preserved. `evidence/sql6-correction.diff` shows the bounded replacement; `evidence/integrity.json` records prior hashes and unchanged reviewer prefix.

## Freeze and gates

`owned-source-v2-sha256.json`:125 files, SHA256 `a63680cd434c6ca71713853e26e2cd3c3c18a261d8f694de10da171670409964`, plus15 read-only dependencies. Prior119 paths remain retained evidence; six new task paths contain this correction. All125/15 are held for independent review; only outside-pin reports may change meanwhile.

**Select only this replacement SQL6:** `supabase/migrations/20261016082142_ifttt_raw_receipt_variants.sql`, SHA256 `789772078e3b8405539358e07413cf2fd4cf6d80a82513911bf989f8c02b0483`. The previous SQL6 is superseded, never an additional migration to apply alongside this one. Both remain task-local outside active migration authority. Accepted SQL5 also retains its previously selected replacement only.

Default-off flag and held-variant behavior remain as described in `../receiver-variant-retention-v1/CHECKPOINT.md`. `../receiver-variant-retention-v1/ROLLOUT-GATES.md` remains an unexecuted approval package, qualified by the timeout clarification above. Deployed schema/ACL/trigger/fencing and real source/history identity evidence, authenticated correction/supersession policy, full52, external queue/sender guarantees and genuine future metrics remain open. No live operation is newly authorized.
