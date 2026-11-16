# Yahoo private acceptance: corrected source bounds

This supersedes the request-budget assumptions in the historical [October 25 plan](../../rso-wave2-2026-10-25/YAHOO/REAL-ACCOUNT-PLAN.md). It is source inspection, not a live test or approval. Current source pins are in [RESULT.json](RESULT.json).

The old plan estimated 80 provider reads across three snapshots and two confirmations, with a ceiling of 100. It assumed a maximum of 20 availability pages per snapshot, but the implementation does not enforce 20. Stopping after the first completed snapshot cannot enforce that limit inside the request.

## Provider work per application request

| Operation | Source-derived bound | Qualification |
| --- | --- | --- |
| Cold snapshot, horizon starts today or later in the verified league time zone | Six base adapter calls plus 0–81 availability pages | Settings, today's roster, scoreboard, league rosters, league and team. A cached team is either reused or fetched once after ownership reconciliation. |
| Required settings and today's roster | At most one additional adapter call each after a timeout | `readRequiredPlanningResource` retries only `yahoo_api_timeout`; rate-limit/access failures are not retried by this wrapper. |
| No elapsed days, including those timeout retries | At most **89 adapter calls / 178 resource GET attempts** | Each adapter call can make two resource GET attempts after a first 401. This is a conservative code-level ceiling, not expected usage or a complete network budget. |
| Snapshot includes elapsed days | Up to 13 additional dated roster calls; at most **102 adapter calls / 204 resource GET attempts** in total | Valid stored/in-memory past lineups may reduce calls. Do not rely on caches when defining a maximum. |
| Confirmations | 0–1 roster adapter call; at most **2 resource GET attempts** | Cached/no-playing-goalie paths can skip Yahoo. No settings/discovery fan-out or outer timeout retry. The normal 401 retry remains. |

`rosterPlanning.ts:321` implements the required-read retry, `:367`–`:440` the base/past reads, and `:613`–`:641` availability batches. `providerClient.ts:230`–`:311` obtains tokens and retries 401 once. `planningConfirmations.ts:25`–`:66` defines the bounded confirmation resource path.

The bounds count calls to the application's Yahoo resource transport. They exclude OAuth POSTs, auth/DB RPCs, database reads/writes, transport redirects, planning-data loads and other UI requests. For the old three-snapshot/two-confirmation sequence, the no-elapsed-day conservative bound is **269 adapter calls / 538 resource GET attempts**, before those excluded operations. It is not an approved test budget.

The first availability page runs alone; later pages run three at a time. The 8-second scan budget is checked **between batches**, and does not cancel in-flight reads. Five other resource reads can run concurrently after settings; elapsed-day reads can add 13 concurrent calls. One application request at a time therefore does not make its internal provider requests sequential. A response/error observed by the caller does not cancel every sibling operation already started.

## Persistence and refresh behavior

The adapter reads fantasy resources and does not submit lineup or transaction changes. The current call path can nevertheless write FHFH state:

- `tokenManager.ts:96` can mark connected-account and active draft-session reauthentication state.
- `tokenManager.ts:123`, `:202`, `:264` and `:343` can perform OAuth refresh, persist rotated credentials, and claim/release a refresh lease. This may happen before the first resource GET or after a 401.
- With `RSO_YAHOO_DIET` active and elapsed-day lineups missing, `rosterPlanning.ts:405` can upsert `rso_yahoo_past_lineups`.
- Both application routes load planning data and authenticate/authorize. These additional operations are outside the provider counts above. A full browser workflow can also invoke workspace persistence or timed upkeep according to the user's existing choices.

Choosing today onward avoids elapsed-day lineup writes. It does not suppress credential refresh or reauthentication writes. No confirmed no-refresh/no-persistence switch exists in the inspected call signatures. This task does not add one, change a live flag, alter user refresh settings or access tokens.

## Exact next acceptance step

Prefer an existing, approved private capture with its source/candidate identity and transport receipt. The owner can validate these facts privately and return only counts/booleans and non-sensitive discrepancy descriptions:

1. The selected team belongs to the signed-in principal, the current season and the agreed daily league; real roster slots, eligibility, acquisition timing/limits, reserves and goalie rules are represented or explicitly unknown/unsupported.
2. Actual snapshot/confirmation adapter calls, resource attempts, pages attempted/accepted, cache reuse, stop reason and any refresh/persistence are known. A diagnostic adapter-call count alone does not count 401 retries or OAuth calls.
3. Selected moves and refresh choices survive reconciliation; user acceptance is required for a proposed repair. No provider transaction or lineup write occurs.
4. Goalie confirmation scope, response date/age, expiry and started-game exclusions are recorded as assertions, without storing roster/account details in the repository.

If no usable capture exists, the Yahoo owner must prepare a concrete future window: one owned league/team (kept private), exact candidate/target, date/time zone/horizon, exact routes `/api/v1/roster-schedule-optimizer/provider` and/or `/api/v1/roster-schedule-optimizer/yahoo-current-data`, allowed side effects, explicit total/internal concurrency bounds and stopping conditions. An assistant-run live window needs separate authorization. Do not reuse the old 80/100 count as an enforceable bound or approve a broad token/configuration repair by implication.

The global Yahoo ownership writer and its credential repair do not establish a private user's connected-planning acceptance. No live provider/app request, credential handling, refresh, database operation or config change was performed for this preparation.
