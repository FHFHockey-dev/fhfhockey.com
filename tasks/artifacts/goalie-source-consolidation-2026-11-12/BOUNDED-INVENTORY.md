# Owner-pinned membership inventory, local review

This replaces the held player-history discovery proposal. **Prepared only; no database or provider calls executed.** Production access remains with Scout's serial queue, even after a Chef handback. A quiet moment or completed Phase E is not authorization to use that queue.

## Exact purpose and missing input

Inspect **one already identified raw observation**, not discover all observations for a player. The source owner must supply a retained receipt identifying project, season, canonical goalie/FHFH/NHL bridge, one observation UUID and its expected source hash. Neither the default transaction manifest nor either inspected temporary directory supplies an observation UUID receipt. Without it, this plan cannot execute. Do not obtain one through the old range query, a provider call, a latest-only RPC, or a guessed UUID/name match.

The target project remains `fyhftlxokyjtpndbkfse`; season/cutoff and identity must be pinned in the eventual receipt. Swayman's earlier appearance capture is not such a receipt. A chosen observation may still have null effective time, missing interpretation or incomplete membership; inventory success does not cure these gaps.

## Logical work and response bounds

- One connection, one read-only transaction, concurrency one; at most three SELECTs in the order below. No joins, aggregates over application tables, range discovery, sort, OR predicate, paging or retry.
- Query 1 reads backend activity metadata once. Its work scales with live server backends, not hockey history. It is a final stop guard, not a complete I/O-health check or substitute for the production owner's current clearance.
- Query 2 is one equality lookup on the unique NHL identity index documented in local baseline SQL (`20260716112908_production_schema_baseline.sql:34263`); at most one identity row if that deployed index is valid.
- Query 3 is one equality lookup on the observation primary key declared in `20260818150256_player_forecast_season_v4_integrity.sql:7`; at most one observation row. Identity, season and clocks are validated on the returned row, rather than added as filters that could hide a conflicting record. No partial predecessor selection is represented as full membership history.
- At most three result rows including the guard. Driver must reject a second identity/observation row, more than 16 KiB of combined result JSON, any oversized marker, zero identity/observation rows, or any mismatch. No original article, evidence JSON, raw player name or arbitrary payload is selected.

These bounds depend on verified deployed constraints and index access. They do **not** promise a fixed number of physical page reads under arbitrary cache/bloat/lock conditions. The query owner must review an already retained compatible plan/schema receipt establishing direct unique/primary-key index access before execution. No such deployed-plan receipt was found locally. If a new `EXPLAIN`/catalog check is needed, it is a separately reviewed read with its own budget; it is not hidden inside these three SELECTs. Do not use `EXPLAIN ANALYZE` for this inventory.

## Parameterized SELECTs for the reviewed driver

All parameters come from the owner receipt and strict positive-safe-integer/UUID admission. The SQL text is static; use driver bind parameters, never shell or SQL interpolation.

1. Final guard; stop on any active query, idle transaction, I/O/lock waiter or unknown client visibility. No polling. Background checkpoint/write pressure and recent incident signals must already be cleared by the production owner.

```sql
SELECT count(*) FILTER (WHERE state = 'active') AS active_queries,
       count(*) FILTER (WHERE state IN ('idle in transaction', 'idle in transaction (aborted)')) AS idle_transactions,
       count(*) FILTER (WHERE wait_event_type IN ('IO', 'Lock', 'LWLock')) AS waiters,
       count(*) FILTER (WHERE backend_type = 'client backend' AND state IS NULL) AS visibility_unknown
FROM pg_stat_activity
WHERE pid <> pg_backend_pid();
```

2. Exact identity lookup; parameter `$1` is the owner-pinned NHL player id. No names or ordering are needed. Require exactly one row and an exact match to both pinned ids.

```sql
SELECT id AS fhfh_player_id, nhl_player_id
FROM public.fhfh_player_identities
WHERE nhl_player_id = $1::bigint;
```

3. Exact observation lookup; parameter `$1` is the owner-pinned observation UUID. Require its returned `source_hash` to equal the owner's independently retained source hash. Source timestamps remain exact, including microseconds and null effective times.

```sql
SELECT id, season_id, fhfh_player_id, nhl_player_id,
       observation_kind, event_type, organization_team_id, roster_status,
       CASE WHEN octet_length(source_key) <= 512 THEN source_key END AS source_key,
       CASE WHEN octet_length(source_url) <= 512 THEN source_url END AS source_url,
       source_hash,
       to_char(observed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS observed_at,
       to_char(available_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS available_at,
       to_char(effective_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS effective_at,
       to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS created_at,
       supersedes_id,
       (octet_length(source_key) > 512 OR coalesce(octet_length(source_url) > 512, false)) AS oversized
FROM public.player_forecast_season_roster_observations
WHERE id = $1::uuid;
```

## Transport and stopping contract — not implemented or executed

The future driver must have a connection timeout of 3 seconds, a monotonic 8-second deadline for the entire attempt, server `statement_timeout = '1s'`, `lock_timeout = '100ms'`, and `idle_in_transaction_session_timeout = '1s'`. Use `BEGIN READ ONLY`; never leave a transaction open awaiting approval. Validate each result before issuing the next SELECT. Always finish with `ROLLBACK`/connection close; close on timeout/error and never retry. An inability to confirm cleanup is an uncertain outcome that ends the attempt and is reported to Chef, not a reason to reconnect and investigate within this budget.

Server timeouts alone do not prove end-to-end cancellation or pressure safety. Before asking to execute, the owner must test the actual driver's connection/error/cancellation/cleanup behavior with fixtures or a separately allowed isolated environment and pin the reviewed runner bytes. The SELECT formats source clocks as exact UTC text with six fractional digits: do not round-trip them through JavaScript `Date` or a driver's default timestamp conversion. Preserve null effective times. Convert bigint ids only after an exact positive-safe-integer range check; reject unsafe values rather than rounding them. No runner has been implemented here; the generic SQL tool's transport has not been established to satisfy this contract. The above numbers are required budgets, not measured performance or a guarantee of server cancellation latency.

Stop immediately on any activity/pressure signal, time limit, connection or SQL error, unavailable guard visibility, missing/ambiguous identity, missing row, altered source hash, wrong season/player, cap or malformed field. Do not widen scope, rerun the guard, retrieve predecessors, resolve missing dates or fetch source URLs.

## Offline admission ready now

`web/lib/projections/goalie/membershipInventory.ts::readMembershipInventory` accepts an already retained JSON envelope `{contract: "goalie-membership-inventory-v1", projectId, capturedAt, observations}`. Its external `MembershipInventorySelection` pins exact byte SHA-256, project, read clock, source cutoff, season, canonical identity/team mapping and every requested observation UUID/source hash. The future one-row inventory uses one row pin; existing retained exports can use up to 32 pins and 128 KiB. No filesystem, DB, HTTP or provider access occurs in this function.

Reject `oversized: true` before constructing an envelope; after verified false, omit that transport marker. The gate then checks exact row-set equality, source coordinates, clocks and byte limits, and delegates semantics to `membershipEventsFromStoredObservations`. Separately supplied interpretation receipts cannot invent an effective date. Original source keys survive admission and snapshot encoding byte-for-byte. The output always retains the underlying adapter's `coverage: null` and `membershipComplete: false`.

The hash/UUID pins establish agreement with the owner's receipt, not original-source authenticity. A caller must not derive its expected pin from the same untrusted export it is admitting. The original evidence bytes, trustworthy interpretation, interval completeness, physical persistence and trusted reader selection remain separately required. The 11/16 fixture and unavailable forward probability are unchanged.

## Review outcome and remaining gates

Local static review removes the original OR/sort/range work and preserves wrong-row evidence for offline rejection. Fixture verification covers the offline gate and exact-coordinate preservation; it is not a live query-plan, transport, evidence-authenticity or forecast review. No separate independent reviewer is claimed.

Before any execution, Scout must obtain the source UUID/hash and identity receipt, deployed unique/primary-key access evidence, a tested/pinned transport, current production-owner clearance and explicit approval for this exact attempt. If no retained observation receipt exists, return that source-discovery gap to the owner; do not substitute an unbounded search. Physical persistence and Grid reader integration still require the exact handoffs in `INVENTORY-AND-OWNERSHIP.md`.
