# Independent review V2 — recurring schedule writer overlap correction

Verdict: **ACCEPT the bounded V2 engineering proposal at FROZEN-V2.json SHA2562515e4b9e1391484656cf6a0a81d8f74c3ed6589d6309532df95edee2e8ebc41. No remaining actionable finding in this finite re-review.** The original P2 is addressed at the proposed database contract level. This is static/offline acceptance, not proof of executed PostgreSQL behavior, release readiness, permission to install DDL, or recurring activation. Real isolated PostgreSQL/native-wrapper verification and all stated approvals remain mandatory.

## How V2 addresses the P2

The original rejected writer unconditionally upserted after an identity-only read. V2 replaces that commit path with the database RPC and obtains the ordering clock before its first source page (`candidate/web/pages/api/v1/db/refresh-roster-optimizer-schedule.ts:47–53`,`:94–109`). It does not manufacture a later completion-time receipt for a delayed capture. The database timestamp is conservatively normalized to milliseconds before both row generation and p_observed_at; precision loss can cause an equal-clock no-op, not permission for an older stored receipt to replace a newer one. The existing normalized content/scope hash continues to exclude only our observation clock.

`database-prerequisite.sql:8–40` proposes a shared nonblocking transaction advisory lock before ordinary INSERT/UPDATE/DELETE statements, plus an INSERT/UPDATE row guard. The RPC takes the same lock (:57) before validating/read-checking/applying. Reentrant acquisition within the same transaction accommodates the statement triggers fired during INSERT ... ON CONFLICT DO UPDATE. Under the declared ordinary-DML/triggers-enabled contract, separate service instances cannot concurrently apply cache statements through different application paths. It is not a process-local mutex.

The row guard compares NEW.fetched_at with the locked target OLD version for updates and raises on less-than/equal time, null/non-finite values or materially future clocks. Thus the unchanged legacy/manual upsert is covered at the database boundary, rather than being trusted to call the new RPC. Existing stamp-trigger behavior does not alter fetched_at, based on the named repository schema. Actual trigger firing/order, ON CONFLICT behavior, real roles and isolation failures remain engine-test/preflight requirements, not results established by this review.

## Whole-batch and acknowledgement semantics

The RPC validates the fixed477/2026/20262027 regular-season profile, bounded dates, timestamp/row agreement, one-to1000 unique identities and1MiB jsonb-text ceiling. It reads at most1001 cached identities under the lock, rejects overflow or any missing cached side, and checks incoming identities against newer/equal stored receipts even if an existing row was outside the new date range. A stale/equal side causes the entire batch to return zero applied rows before the insert.

The explicit22-column insert/update list matches the existing table shape and unique game_key/source_game_id/team_id identity; generated IDs/inserted_at/updated_at are not imported from payload JSON. The typed row casts and existing constraints remain relevant. GET DIAGNOSTICS must equal the entire incoming count. The enclosing PL/pgSQL exception block is intended to roll back its database changes before returning only the known RS001/RS002/RS003 stale/busy/rejected zero-change outcomes. Generic SQL, constraint, isolation, cancellation or transport errors are not relabeled as those known no-ops.

The route accepts a known stale/busy/rejected result only with rowsUpserted exactly0, returnsHTTP409/successfalse/writeOutcome not_applied, and retains the distinct outcome. It acknowledges success only for applied plus the exact planned count. Missing, malformed, partial or errored RPC acknowledgement, including a commit followed by a lost response, remains unknown after the attempted commit. No automatic retry is introduced. Existing audit remains a separate operation with its own final receipt; cache commit does not establish audit durability.

## Clock, permission and maintenance limits

The ordering clock is a conservative capture-start marker, not provider publication time, complete source receipt time or commit time. SQL compares native timestamp instants; the recurring RPC rejects a marker older than90seconds or over5seconds future, and the shared row trigger rejects non-finite/materially future receipts for ordinary writers. These checks do not establish causal order of provider corrections, and legacy/application capture conventions remain distinct. The proposal correctly discloses those limits and requires approval of the shared rejection/skew behavior.

All four functions are SECURITY INVOKER with pg_catalog search path, schema-qualified target relations and explicit execute revocation fromPUBLIC/anon/authenticated plus service_role grants. Existing table grants/RLS are unchanged. The repository migration describes the required keys,22 input columns, receipt type and existing updated_at trigger. Production schema/role parity and advisory-key collision checks have not been performed. RPC admission still relies on the route's full source/reciprocal/status/week validation; this function is not a standalone source-authenticity proof.

Ordinary DELETE statements acquire the shared lock but have no receipt comparison. Delete/reinsert, destructive/full-mode maintenance, identity restoration and privileged trigger bypass are not a persistent tombstone/version guarantee. Multi-statement legacy full refresh remains multi-statement; the new RPC only makes its own batch atomic. Shared DDL can reject stale/equal/contending legacy statements and therefore needs explicit owner handback/schema authorization. Applying only the five-path application patch is insufficient. No approval or freshness authority is inherited from the reported one-day FORGE repair, whose private artifacts were not inspected.

## Unchanged horizon and corrected bounds

The current/next full New York Monday–Sunday weeks, whole active Yahoo period and source-date padding remain unchanged. The proposal continues to include early-week rows for the whole current week and to stop on invalid/oversized calendars or season rollover.09:50/21:50UTC remains a proposed12-hour cadence, not a near-puck-drop freshness guarantee or permission to suppress6-hour/2-hour warnings. There is no recurring delete path.

The1000-side number is an explicit proposed allocation, not an observed normal population; its conditional31dates×32clubs×one game/club/date=992 rationale is now disclosed alongside the initial source-derived count requirement. Four successful metadata reads allow193 returned rows; overflow detection can return194. Write mode adds one scalar clock RPC, one commit RPC and the separate audit, so two scheduled calls allocate14 external database requests/day. Internal SQL range/identity reads, trigger/index work and rollback costs are separate from HTTP counts. Inspection retains five array reads with1193 accepted/1194 sentinel rows plus the clock; it has no commit or audit.

Source limits remain at most5sequential1MiB/8second pages, usually3 for16dates. Route/SQL row-payload checks both reject rather than truncate; PostgreSQL jsonb formatting can make its check stricter. The handler's90-second timer,120-second pg_net transport proposal and configured240-second function ceiling remain distinct. Neither client abort nor function termination proves database cancellation; server statement/cancellation behavior must be established before activation. Extra authenticated/manual invocations are outside the two scheduled calls' daily allocation and still incur work before a skip. No global request limiter or SQL CPU/memory guarantee is claimed.

## Checks actually performed

All22 FROZEN-V2 file hashes, original-source/candidate bindings and20 rejected-preservation hashes match. Reconstructed the complete five-path unapplied diff against current originals; it exactly matches the frozen candidate. The original rejection/report/reproducer/log remain preserved.

Reviewer reran only the11 selected new adversarial/model/static checks in verify-offline.cjs: original delayed-earlier/newer-commit interleaving; equal-clock conflicting duplicate; mixed batch with one stale side; both legacy/recurring directions; late-row legacy rollback; shared busy contention; committed-but-lost acknowledgement; missing database clock/partial receipt; SQL declarations/permissions; rejected preservation. All11 passed, command exit0. The model is JavaScript staging/rollback logic, not PostgreSQL: it does not emulate MVCC, full SQL validation/clock-age/cast behavior, trigger execution, grants or database cancellation. Regex SQL declarations are not parsing/execution proof. These limitations are explicitly retained.

Author32/32 offline results and five-root virtual TypeScript success were inspected, not rerun in full; the50 unchanged tests remain V1 evidence. No PostgreSQL process, parser/engine connection, SQL/schema execution, native-wrapper integration, application edit/patch application, full compiler/build/browser, provider/database/network request, scheduler activation, credential or one-time approval/attempt/private-pilot read occurred. Only this report was written.

Before release, the separately authorized isolated PostgreSQL matrix must establish actual statement/row triggers during ON CONFLICT, both ordering directions/equality, whole-batch rollback, nonblocking contention, privileges, supported isolation failure behavior and lost acknowledgement. Native mocked-wrapper tests must cover actual final-audit outcomes. Schema generation/review, shared-boundary handback, deployed preflight, secret-reference/report delivery/owner checks and release/recurring-write activation approvals remain pending. This engineering acceptance does not complete those gates.

## Exact accepted frozen evidence

- FROZEN-V2.json: `2515e4b9e1391484656cf6a0a81d8f74c3ed6589d6309532df95edee2e8ebc41`.
- `PROPOSAL.md`: `563e61c62298cbbc7d7a9e264ad321a6065896a8b069709756fa2cf2a7075d22`.
- `implementation.patch`: `c8ff0740e81dd0760da2a5a6588e1dfe3fed5205bc9f1ce9e95916452c67e276`.
- `database-prerequisite.sql`: `2175a73ba14f776547303721ec06554a65fe6e32b00882a5a18e53c97eff4570`.
- `source-bindings.json`: `9f40f2a6f470d4ef0ba73f116b7a5059cd1d8ef6f7c43139a303e28326a4ee2f`.
- `canonical-register-activation.patch`: `fccd5ab25aa872cdd990f5d3d282eb5bce17aab4937664d6457386373ab50d09`.
- `canonical-entry.proposed.json`: `3df3fa64591a49d92febfb14b31c475a58f0893cbe1afd0571936aff52cf20d2`.
- `activation-reference.sql`: `827568c5ddb5b611f74dc9118120ecdb2b28d158e2826d10859638d40c2ef5c7`.
- `prepare-candidate.py`: `81893c8cd8f991627932336b4f6af388a8829598aa4b2659748c08b18e5dcf0e`.
- `verify-offline.cjs`: `8a0926980a6bd3f3fc299f84cb4c4d007149d86745901dd3cc09e68075720de1`.
- `transaction-model.cjs`: `040e7f8ed0ade78d3a68165de6c43d9cae004c4fca7c14e46cf75c353a05aa45`.
- `offline-verification-v2.tap`: `9c22a6476edc79c49323a172b1c9ac6293c25cb4f5276508cca43bb61152c0a4`.
- `typecheck-candidate.cjs`: `55ab0b65c48a185c0c0aad0acc5c779e091c35ec0c7ec106da293a5450eb5f7f`.
- `candidate-typecheck-v2.log`: `b9d90137023d7d279746df887d18848dbcd84d0a6440405c60e9b66a218f1827`.
- `review-request-v2.md`: `29c553e017e3a4927d5e116c70b8790c49b7fe503f306eb7893c87e53f308a34`.
- `independent-review.md`: `69182ff3c6cc7ee63863b460c4ae0b28ef5a71509dab2b931839098235ebe4f8`.
- `rejected-v1/PRESERVATION-MANIFEST.json`: `511cbfabb680875c6e7eb691930d0e4a9e583dfb4c8c3cead9f732b058ad411a`.
- `rejected-v1/reproduced-overlap.log`: `c839577742bba1423ff8d212b38d9607f241a8fc363a5bf714ab67d771ce22b6`.
- `candidate/web/lib/cron/cronInventory.ts`: `7ce3f8cd67c3dc5749018591899f88885e724d17352247c5bab770b145b9d8eb`.
- `candidate/web/lib/rosterScheduleData/recurring.ts`: `e876ef82ec720744588bbc4dc3e984db8669b1861229666b6637d6de1ae46136`.
- `candidate/web/lib/rosterScheduleData/source.ts`: `1aad10ae23f6a3585900b79f918d71872db3fbe28c9a9c2233011c02797406c5`.
- `candidate/web/pages/api/v1/db/cron-report.ts`: `04db8f08d9cc86bc1ad474cc3aaa33971905a33dfd747966a4e8e01ea0048b55`.
- `candidate/web/pages/api/v1/db/refresh-roster-optimizer-schedule.ts`: `f93de7aa936a36d2274330fdd3fa5d30cb4888e63a5f8135f21c4b25ec4282d8`.

The named22-file freeze is the acceptance boundary. Preserve it and the rejected V1 packet; any implementation/DDL correction receives its own exact increment and verification record.
