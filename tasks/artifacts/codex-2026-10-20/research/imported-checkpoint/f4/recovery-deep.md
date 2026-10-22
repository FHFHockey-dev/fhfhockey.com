# FHFH recovery: what actually fences a late writer?

2026-10-20. Research and a deterministic standard-library model only. No application, Git, dependency, database, provider or deployment changes. This strengthens `recovery.md`; it does not authorize implementation.

## Material refinement

**Immutable identity + metadata lease CAS + client pre-write checks do not make forced takeover safe.** Reusing the same run ID leaves old and new workers writing the same projection keys. Giving the replacement a new run ID isolates those particular rows only conditionally; global analytics sidecars remain shared. Neither an expired lease nor process exit proves that already-dispatched database work has settled.

The smallest honest schema-free alternative is narrower: resume only after an explicit, durable, quiescent handoff; refuse same-run reuse after an expired/indeterminate attempt. This trades availability for safety. It is not the current behavior and does not repair independent sidecar consumers or establish reader admission/scorability.

## Exact current order

Paths below are repository-relative. Abbreviations: R = `web/lib/projections/run-forge-projections.ts`; L = `web/lib/projections/queries/run-lifecycle-queries.ts`; P = `web/lib/projections/stages/persistence-stage.ts`.

1. R:408 computes a new implicit cutoff. R:457–469 claims only uncaptured/implicit-cutoff work and passes that invocation’s cutoff into calculation.
2. L:265–305 reads a candidate, then changes its lease owner using run_id + running status + previous owner. The update does not atomically predicate on the currently stored expiry/progress revision. L:153–159 treats any expired, sufficiently young resumable row as paused; there is no clean-release distinction.
3. R:730–780 rereads preflight, restores selected metrics, determines pending games, then deletes their projection rows. L:385–395 issues three separate deletes; none contains owner/status fencing.
4. R:876–920 awaits skater computation. Skater stage checks time at each team’s start (`stages/skater-stage.ts:1343–1349`), but writes players and team later (`:3118,3269`) without an immediate ownership check. Goalie stage checks at each candidate’s start and writes later (`stages/goalie-stage.ts:167–169,763`). All these projection upserts use run-scoped conflict keys, with no lease predicate (P:3–36).
5. R:923–956 awaits goalie processing. Then R:1081–1090 awaits the analytics sidecar sequence: delete/upsert player predictions, delete/upsert game predictions, delete/upsert flags (P:48–102). Keys/filter scopes include date/game/model, **not run ID**. Metadata containing run_id is not isolation. These are independent requests, not one transaction.
6. Only afterward R:1093–1102 adds the game to completed IDs and CAS-writes progress. Timeout release is R:1106–1112; final success is R:1133–1138. L:367–369 fences these metadata updates, but cannot undo earlier data changes.

Thus: A dispatches an output write → lease expires → B takes over, clears, rewrites and succeeds → A’s delayed write commits → A’s checkpoint CAS fails. The run remains correctly owned by B and succeeded, while its rows are now stale/mixed. A delayed cleanup delete can instead remove B’s valid rows. A late sidecar delete can damage even B’s distinct run.

## Deterministic experiment

Artifacts alongside this memo:

- `recovery_interleavings.py`: Python standard library only; no application imports/network.
- `recovery-interleavings-results.json`: assumptions, counts, witness traces, lost-ack and handoff cases.
- `recovery-interleavings-results.txt`: execution summary.

Run: `python recovery_interleavings.py`.

The model preserves actual relative order for one representative projection table and one representative sidecar: projection → sidecar delete → sidecar upsert → checkpoint. Replacement order is takeover → cleanup → projection → sidecar delete/upsert → checkpoint → success. Additional tables are deliberately omitted. Separate tails model an in-flight cleanup or sidecar delete whose worker then dies. Every order-preserving merge is enumerated; outcomes are checked **after all delayed events**, not when B first reports success.

| Variant | Unsafe / enumerated |
|---|---:|
| Current metadata CAS, game tail | 336 / 792 |
| Current metadata CAS, cleanup tail | 30 / 36 |
| Client ownership precheck, game tail | 336 / 1,716 |
| Server ownership read without shared serialization | 336 / 1,716 |
| Same run-scoped keys, game tail | 336 / 792 |
| Fresh run, observing isolated projection only | 0 / 792 |
| Fresh run, observing projection + global sidecar | 456 / 792 |
| Fresh run, late sidecar-delete tail | 21 / 36 |
| Atomic server fencing, game tail | 0 / 792 |
| Atomic server fencing, cleanup tail | 0 / 36 |

**Interpretation:** counterexamples to the weaker protocols, not incident probabilities, application integration tests or proof of candidate SQL. Both workers intentionally have the same issuance identity: uncaptured mutable inputs can still produce A-old versus B-new. Cleanup counterexamples do not require differing payloads. Fresh-run success assumes the old run is permanently nonadmissible and readers select only the new run; this is merely isolation, not proof of admission, freshness or scorability.

The atomic-fenced model assumes ownership/status validation and **every** write/delete share one serialization authority with takeover. A SQL `WHERE EXISTS`, an ordinary ownership SELECT followed by a write, or an RPC name alone does not establish this under MVCC. A real implementation must demonstrate the appropriate shared lock/conflict/serialization behavior. No such SQL proof was performed. The model also assumes one initial authority; it does not prove first-run uniqueness from L’s read-then-insert path.

## Smallest complete safety contract

Define the guarantee precisely: once generation B supersedes A, A cannot mutate resources selected by B; a completed-game receipt cannot overclaim its output unit; lost responses do not silently change intent.

1. **Identity:** pin original cutoff, effective code/config and exact game manifest. A matching label is necessary, not an immutable source snapshot.
2. **Mutation authority:** at each mutation’s serialization point, atomically validate the current owner/generation and writable status. Include cleanup deletes and control transitions, not just upserts. The existing UUID owner can serve an equality fence against one authoritative row; a new monotonic column is not inherently required. An independent sink using highest-seen tokens needs ordered fencing instead.
3. **Correct conflict scope:** authority must cover all resources shared by writers. Per-run fencing alone does not serialize different runs/horizons sharing date/game/model sidecars. Either include those resources under their common authority, or remove them from the overlapping execution/serving contract through an explicitly approved change.
4. **Completion/publication:** outputs precede checkpoint; final success requires the immutable manifest’s complete set. No further writes to that selected generation are permitted. Per-write fencing provides stale-writer exclusion, not automatically atomic multi-table game visibility. An atomic game replacement + completion receipt is stronger; separately fenced writes need truthful partial-state/reader gating.
5. **Lost acknowledgments:** bind a mutation identity to its payload hash and durable result; reconcile exact evidence. A duplicate receipt proves a historical commit, not present ownership or permission to finalize a superseded run.

[Hazelcast’s primary fencing documentation](https://docs.hazelcast.com/hazelcast/5.7/data-structures/fencedlock#fencing-tokens) describes the essential failure: a paused former lock holder resumes after a replacement, so the protected resource must reject its stale requests. This supports the protocol principle, not adopting Hazelcast.

## Bounded alternatives before any database change

**Clean-handoff-only, no new tables:** store a versioned release receipt in existing metrics: identity hash, owner/release nonce, exact completed set/hash, and a quiescent terminal-path indication. All write promises must have settled with known outcomes, no write tasks may remain scheduled, and the old worker must irrevocably stop output work. Promise rejection alone does not mean a remote write settled. Claim must CAS the exact release and clear its resumable marker while changing owner. A lost release response requires exact readback; an absent/ambiguous receipt does not authorize takeover. Unknown/expired attempts fail closed and retain the prior admitted result until resolved. This preserves useful cooperative resumability without pretending to recover every killed worker.

**Fresh-run restart:** isolates FORGE projection rows only after old admission is irrevocably blocked and all relevant readers are verified. It is not a complete alternative while shared sidecars remain writable/consumed. Do not blindly copy old completed rows: the identity/input contract still applies.

**If forced recovery is required:** an existing run row plus a transactional server function may avoid new tables/columns, but still entails database code/schema deployment and approval. Per-write guarded functions versus atomic per-game replacement are bounded design choices. The latter requires staging today’s incremental writes; neither is implemented or authorized here.

## Lost-ack findings and acceptance tests

The experiment also models current error ordering. A running checkpoint can commit, lose its response, then be relabeled failed by R:1156–1162. A final success can commit, lose its response, survive the failed rewrite’s status predicate, yet return an error. Reconcile rather than infer outcome from the thrown error.

Existing `web/lib/player-forecasts/nativeCatalogHead.ts:109–138` is a useful internal precedent: one CAS, then exact revision/observation/hash readback; unknown stays unknown. It is not drop-in fencing for mutable projections.

Required regression gate: pause each real persistence boundary, take over, finish B, release A, and verify both rows and sidecars remain unchanged. Repeat for cleanup, lost progress acknowledgment, lost final-success acknowledgment, and a payload mismatch under the same operation ID. For clean handoff, assert no reuse with pending writes, unknown outcomes or unreconciled release; permit only an exact quiescent receipt. Application fakes validate plumbing, but any claimed server-fencing guarantee additionally needs an isolated-database concurrency test of the actual transaction/lock behavior, separately authorized. All model assertions passed; no application or database tests ran.
