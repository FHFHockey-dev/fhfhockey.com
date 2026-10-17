# One-time private Yahoo source capture

Purpose: recover current original roster, scoring/settings and an explicitly partial candidate universe for the named FHFH TJ acceptance case. The passive retained export lost providerSnapshot after HMR; normal Refresh can renew tokens, write account/session state and paginate broadly. This private developer collector reuses the configured Supabase client and existing Yahoo URL/owner contracts without invoking the normal refresh, changing the saved plan, or reading forecast/outcome tables.

## Exact allocation and implementation

- Supabase project `fyhftlxokyjtpndbkfse`.
- Internal league `c2685592-521e-49de-999b-491b9326c921`; team `b8a23dca-0645-4dbd-af6e-6fb1f894e021`.
- Provider league `477.l.125593` / team `477.l.125593.t.10`; season2026/game477. These were resolved by the previous approved metadata reads, not guessed.
- Private allocation `/Users/tim/Documents/FHFH-private/forge-rso-completion-20261016-v1/yahoo-original-source-allocation-v1.json`, SHA256 `653897b52d7e8dbde38c0882d40bc05e8feae8dfcdad0c7e85e6fda15d38207b`.
- Collector `capture-yahoo-planning.ts`, SHA256 `364eecdb06fc08acf49e87dfcfa4e3336b2fee645ceb89c67148a6a46be06b54`; synthetic test SHA256 `6dfc0bc776eb968f40d3eeb24663be26930a85d17c1f2ffa7987f7340681ca59`.

The token RPC response is explicitly projected to `access_token,expires_at`; broader projections are rejected before transport. Local migration source implements this RPC as a read-only SELECT chain; hosted DDL has not been rechecked. Independent source review found no blocking issue, and the final projection passed the 16 synthetic checks.

## Authorized-operation proposal

At most six sequential Supabase SDK requests: exact team metadata; matching league metadata; matching connected-account metadata; current server Auth owner record; NHL2026 game-context metadata with limit2 ambiguity sentinel; one existing secure-token read RPC for that verified account/user. The team read resolves the user/account IDs. All subsequent scopes must match, and the Auth record must satisfy the application's existing verified-owner predicate before any token read. No grant is created and no entitlement refresh runs.

The proposed execution may load the ordinary web development environment from existing configuration in memory if not already inherited. The existing service credential and Yahoo access token stay in the process; no credential file is copied, no credential is logged or saved, and no new persistent access is created. Raw metadata/Auth/token response bodies are never retained. A missing, unknown-expiry or expiring token stops the run before Yahoo requests; it does not trigger OAuth, a token lease, token renewal, account-status writes, or a reconnect attempt.

Then at most four sequential Yahoo GETs, exact standard-JSON paths:

1. `https://fantasysports.yahooapis.com/fantasy/v2/league/477.l.125593/settings?format=json`
2. `https://fantasysports.yahooapis.com/fantasy/v2/team/477.l.125593.t.10/roster;date=2026-10-16?format=json`
3. `https://fantasysports.yahooapis.com/fantasy/v2/league/477.l.125593/players;status=A;sort=OR;start=0;count=25/ownership?format=json`
4. Same available-player path with `start=25`, only if page0 reports25rows.

Roster date must still be October16 in the freshly returned settings timezone (manager-approved America/New_York fallback only if absent). A date change requires a new allocation. Settings/roster ownership, league/team identity and provider HTTP freshness are checked. At most50candidate rows are requested; the result is always marked partial, not whole-pool coverage. No scoreboard, transaction, recent-form, game outcome, prediction, pilot or evaluation endpoint/table is included.

## Bounds, retention and stopping

Maximum10network requests total, concurrency1,8seconds per request including body consumption,90seconds total,1MiB per body and10MiB total exposure. Exact method/domain/path/query allowlists, no retries, pagination beyond the two specified pages, redirects or automatic recoveries. Stop on the first transport, scope, authorization, freshness, clock, body-cap, schema or ambiguity failure; preserve prior successes and do not repeat them.

New exclusive output `/Users/tim/Documents/FHFH-private/forge-rso-completion-20261016-v1/yahoo-original-sources-v1/`, directory0700/files0600. Preserve complete original Yahoo response bytes (all fields/players returned), or bounded partial failed bytes, with hashes, safe timestamps and request/exposure ledger. No request headers, database bodies, Auth bodies or token responses are persisted. Offline parsing and reconciliation against the already retained canonical identities/rules are included; missing mappings and inputs remain unknown. Source capture does not authorize forecast publication or count as actual served consumer acceptance.

Sixteen synthetic checks passed using the real Supabase SDK against injected synthetic transport, including owner/account mismatches, unknown/expired token, blocked writes, redirect/byte/time caps and no credential retention. Root's local Node22.11 fixture confirms BYOB streaming support without an external request. The exact allocation passed CLI plan-only validation with zero network requests. No live execution has occurred.

This proposal needs separate direct user approval because earlier metadata/source allocations are consumed and did not authorize this service-credential/token-backed Yahoo capture. It includes no database write, fantasy transaction, lineup change, account save, refresh, job activation, DDL, deployment or publication.
