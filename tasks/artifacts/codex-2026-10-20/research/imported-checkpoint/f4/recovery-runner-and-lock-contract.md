# Recovery checkpoint: actual runner and proposed fencing contract

2026-10-20. No application, Git, dependency, SQL or production changes. No database was installed or contacted. Proposed transaction behavior below is **untested**.

## Actual-runner counterexample: PASS

`recovery_runner_harness.cjs` reuses the prior injected-client harness and calls the actual exported `runProjectionV2ForDate` twice. It keeps real lifecycle/claim, cleanup, projection and analytics persistence, metrics finalization, and runner control flow. Only preflight/statistical stages and the database client are synthetic, following the existing `web/lib/projections/run-forge-projections.resume.test.ts:102–150` seam. Stage fakes call the real persistence exports rather than editing arrays directly.

- A starts at T0 with deadline T0+1s and real lease expiry T0+61s. Its first player write is deferred.
- At T0+62s, B invokes the actual runner, reclaims the same run ID, clears pending-game rows, writes both teams/players at 0.9, runs real analytics persistence and succeeds with the game completed.
- Releasing A commits player 1 at 0.1; its fake stage then calls real team persistence at 0.1, and times out at the next team boundary. The actual runner attempts its paused checkpoint and rejects with RUN_LEASE_LOST.
- Final status remains succeeded and completed IDs still contain the game, but player values are [0.1,0.9] and team values [0.1,0.9]. Goalies and sidecars retain B’s values/row counts. This is a content-integrity failure despite plausible completion/count metadata.

Evidence: `recovery-runner-results.json` records both results, snapshots, call trace and actual source hashes; `.txt` records execution. Node 22.11.0, outbound-blocking preload, three imported application files byte-identical before/after. The prior two actual-export cases also still pass after extracting reusable harness support.

Run from `web/`, with pipefail when piping output:

```sh
/workspace/shared/fhfh-audit-runtime/node-v22.11.0-linux-x64/bin/node \
  --require=/tmp/fhfh-scan-no-network.cjs \
  /workspace/shared/fhfh-research-2026-10-20/recovery_runner_harness.cjs
```

This closes the narrow orchestration gap. It does not execute the real statistical models, HTTP route, transport, reader admission/scorability or SQL engine; deferred commit semantics are intentionally injected.

## Why a server ownership read is still insufficient

Counterexample: A ordinarily reads owner=A; B changes owner to B and commits; A then writes a projection table using its cached authorization. Different target rows/tables need not create a write conflict. Moving A’s first read into an RPC does not change that reasoning. Under [PostgreSQL Read Committed](https://www.postgresql.org/docs/17/transaction-iso.html#XACT-READ-COMMITTED), ordinary reads use command snapshots rather than freezing another row’s ownership. Serializable is not a drop-in protocol proof: all participating transactions, retry behavior and publication ordering still need validation.

## Choice A: quiescent handoff only

Keep data operations as they are, but permit same-run continuation only after a durable exact release receipt: original identity, owner/release nonce and completed-set hash. Before writing that receipt, every data request must have a known settled outcome; no scheduled output tasks can remain. The old invocation must irrevocably stop mutations. Claim consumes that exact marker once and changes owner atomically. Lost release acknowledgment requires exact readback. Expiry, elapsed grace, process exit or a rejected local Promise alone cannot substitute for quiescence.

This can use existing JSON metrics without new tables, but requires application protocol changes. Unknown/expired attempts remain blocked rather than automatically resumed/restarted against shared resources. It trades availability for safety and assumes every participating writer obeys the handoff protocol.

## Choice B: forced fencing, proposed transaction contract

For each bounded persistence transaction, not during provider reads/computation:

1. Acquire the common authority for the affected resource scope. Shared sidecars conflict by date/game/model/version/prediction scope, regardless of run ID or projection horizon; the flag scope is at least date/game/model/version. A coarser common scope is acceptable for correctness. It must exist even when the output rows do not yet exist.
2. Lock the authoritative run/generation state, then freshly validate expected owner, writable status, immutable identity and operation/payload identity. Do not trust a value read before obtaining authority.
3. While holding that same authority, perform bounded output mutations, including cleanup and sidecar deletes. Persist the matching completion receipt before commit for an atomic game unit; smaller fenced operations must not overclaim whole-game completion.
4. Takeover, retirement, clean release and final success acquire the identical authority before changing who may mutate. Old writes either finish before takeover can commit, or acquire authority afterward and reject. No network wait or expensive calculation belongs inside this critical section.
5. Use one canonical order across every path: sorted scope authorities, sorted run identities, then a fixed table/key order. A no-new-table option could combine existing run state with transaction-scoped advisory authority, but advisory participation is cooperative and existing per-run rows alone are not a shared cross-run sidecar authority. Any new server function/deployment still needs separate authorization.

These are inferred design requirements, not verified SQL. [PostgreSQL row locks and lock ordering](https://www.postgresql.org/docs/17/explicit-locking.html#LOCKING-ROWS) explain how conflicting authority locks can serialize transactions and why consistent acquisition order matters. The same documentation distinguishes transaction-scoped advisory locks from session locks; a session lock across pooled HTTP requests is not this contract. Merely adding a nonlocking WHERE EXISTS or taking a lock only in the takeover path is insufficient.

## Exact isolated-PostgreSQL acceptance cases still unexecuted

No PostgreSQL/container executable is available, per the root’s read-only discovery. Do not install/contact a database to close this gap without a separately bounded environment/task.

1. A holds authority while mutating; B takeover must block until A commits/rolls back. B owns authority first; A must reject with zero writes/deletes afterward.
2. A waits for authority after a stale pre-read; once unblocked it must validate the new owner, not cached state.
3. Repeat across distinct runs and horizons sharing each sidecar, including absent output rows, empty deletes and cleanup. Verify the common authority, not only duplicate-key behavior.
4. Simultaneous first claims and same-release claimers select one authorized mutator. Replayed old owner/release identity cannot regain authority.
5. Inject failure before commit and lost response after commit. Output unit plus receipt is all-or-nothing; exact readback/retry never repeats changed intent or promotes a superseded result.
6. Exercise deadlock/serialization abort and whole-transaction retry with fixed operation identity. No partial completion may survive an abort. Validate canonical ordering under multiple games.
7. Attempt every legacy/direct mutation path. Either enforcement rejects bypasses or the safety guarantee must explicitly exclude them. A correctly fenced new RPC cannot protect resources still writable through old unfenced calls.

Stop at this checkpoint: actual runner plumbing is demonstrated; the remaining question is the chosen handoff/fencing policy and its concrete isolated-database proof, not more architecture research.
