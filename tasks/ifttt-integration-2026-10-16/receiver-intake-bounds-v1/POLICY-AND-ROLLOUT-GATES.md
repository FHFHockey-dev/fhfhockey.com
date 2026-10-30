# Controlled receiver intake: choices and gates

This is a local default-off implementation proposal. No policy, flag, migration, receiver request, stop, dispatch or schedule has been activated remotely.

## Exact operator choices required

TJ must approve one immutable policy, including:

1. **Exact receiver tuples**: table, sourceGroup, sourceKey and normalized configured sourceAccount. Choose the participating routes explicitly; there are no wildcards or automatic new-source enrollment. This is discovery-route scope, not proof that a body, quoted post or relay is authored by that configured account. Original body/provenance differences remain immutable held variants.
2. **A future start and finite end** with explicit timezone. The database uses its clock, inclusive start/exclusive end, and checks end again before success. There is no automatic extension.
3. **maxAttempts and maxReceipts** as positive safe integers. No production values are selected in code. Attempts include exact retries, ordinary storage failures and receipt-cap refusals after admission. Allow explicitly approved retry headroom. Receipts count distinct immutable receipt IDs admitted to this policy, not raw carriers or claims. A first variant of an unarchived legacy carrier needs two slots (baseline plus variant). Repeating admitted IDs consumes no new receipt slots but does consume an attempt. A new policy can admit existing IDs under a separately approved budget; it does not create a new independent claim/effect.
4. **A stop owner** and reason. The existing service role may only stop a registered policy, not register/widen/reset/resume it. A stop is durable and monotonic. An environment emergency stop additionally closes this receiver. Restart requires a newly approved policy and matching configuration; it cannot reset the old one.

The config must contain all fields of `IftttIntakePolicy` in `web/lib/sources/iftttIntakePolicy.ts`. Use `parseIftttIntakePolicy` to normalize handles and scope order before owner registration; the receiver sends the same normalized contract. No runnable production policy template with arbitrary dates/caps is supplied.

## Activation prerequisites (separate approval)

- Identify exact candidate source/test hashes and the authoritative migration tree. Reconcile SQL1–7 prerequisites with deployed schema; task artifacts are not an active migration tree. SQL6 must be the accepted replacement in receiver-variant-retention-v2, never both alternatives. SQL7 adds no automatic policy.
- Obtain full deployed schema, functions, ownership, search_path, RLS, default/inherited/column/table privileges and trigger inventory. The earlier bounded catalog hash is not complete ACL proof. Confirm the migration owner owns the protected tables/functions and bypasses their RLS as intended; anon/auth have no access. Review the two narrowly scoped SECURITY DEFINER entrypoints. Revoke service direct core EXECUTE and archive INSERT as SQL7 specifies, and prove no alternate inherited grant restores them.
- Prove all deployed receiver/writer instances use the approved candidate and policy configuration. Raw-table legacy writers and old deployed code are not universally fenced by this proposal. No live direct writer, external queue, host-wide rate limiter or full consumer guarantee is inferred.
- Prove a caller-wide database/RPC deadline in the actual transport. Runtime lock_timeout is 2 seconds. The migration transaction's 5-second statement_timeout is DDL-only and does not establish the caller deadline. HTTP saturation/preflight traffic and a killed/cancelled whole transaction are not charged durably by this counter.
- Approve exact policy bytes, future window and budgets, register once as owner, and read back the exact contract/zero counters. Application role cannot register. Then explicitly approve matching environment configuration: IFTTT_RECEIPT_VARIANTS_ENABLED=true, IFTTT_INTAKE_POLICY=<approved JSON>, TWEET_CLAIMS_MODE=shadow and TWEET_PIPELINE_INTERPRETATION_ENABLED=true; emergency stop must be absent or false. The receiver never registers a policy from environment input. No global flag-only activation is sufficient.
- Keep the pilot retain-only: neither canonical nor held receipts trigger an immediate processor request, even process=true/capture=true. Pending raw carriers remain pending. Any later bounded processing/evaluation intake requires its existing, separately approved cohort, identity/history/fencing and work limits; this receiver approval cannot authorize that work.
- Independently prove authentic source/original IDs, dated player/team/league/game identities, deployed history/legacy reconciliation and writer fences before qualification/delivery. Relays are not independent corroboration. Authentic future labels/metrics remain separate; the historical discovery corpus is development data, not an untouched holdout.

## Stop and failure semantics

Policy row locking serializes admitted work, receipt slots and stop. A request holding the lock can finish before a concurrent stop acquires it; after stop commits no later admitted request is accepted. No automatic retry/mutation occurs inside the receiver after an uncertain reply. An external exact retry may reconcile the stable receipt ID within remaining attempts/window. If exhausted/stopped/expired, it fails closed and requires read-only/operator reconciliation rather than widening limits.

An ordinary inner storage failure rolls back raw/archive/admission writes while retaining its attempt charge. Fatal/cancelled whole statements can roll back that charge too; they also cannot commit that statement's retention. This bounds admitted attempts and retained versions, not total physical CPU/network costs. SQL6 still limits each raw payload to 64 KiB and envelope to 80 KiB. Policy JSON has an 8 KiB configuration bound. No exactly-once external effect is promised.

Fully unset pilot config plus flag false/absent preserves the pre-existing default-off legacy route. Once policy/stop/active-or-malformed pilot flag is present, missing/disabled/invalid configuration fails closed rather than falling back to legacy writes. Unknown post IDs also fail closed in controlled intake. Operational rollout must prove all instances' configuration rather than treating this compatibility path as universal fencing.
