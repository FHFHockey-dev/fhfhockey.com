# Prioritized security findings

> Follow-up checkpoint (2026-10-15 05:56:27 UTC): the one explicitly approved npm retry succeeded: 57 affected package entries (3 critical / 32 high / 14 moderate / 8 low). Dependency applicability triage and the database-hardening proposal remain incomplete. Stop requested by TJ. See [context diary and resume handoff](context-diary-and-resume.md) and `dependency-audit-approved.json`. Original source findings/tests predate the separate proxy/Host workers' fixes; those fixes have not been re-reviewed here.

Evidence is from the current dirty `octoberBranch` checkout, not a production exploit. Each finding separates source behavior from deployment assumptions. Reproduction checks in `safe-local-checks.cjs` use synthetic inputs and mocked transports; they make zero network/database requests. No actual secret values are included.

| Priority | Finding | Severity / qualification |
|---|---|---|
| P0 verification | Existing SQL/entitlement hardening migrations have unknown applied status | Critical if arbitrary-SQL grants remain; deployment unverified |
| P1 | SEC-01 arbitrary HTTP proxy | High; source behavior reproduced |
| P1 | SEC-06 imported public tables lack RLS/grant hardening | High under documented database defaults |
| P1 | SEC-02 Host-only development admin bypass | High only for an untrusted-reachable privileged dev server |
| P2 | SEC-03 Patreon linking CSRF | Medium; requires provider authorization by another browser |
| P2 | SEC-04 rejected cron requests write audit rows | Medium; 94 route compositions identified |
| P2 | SEC-05 anonymous diagnostic fan-out | Medium; 250 mocked operations reproduced |
| P2 | SEC-07 user-writable provider identity claims | Medium; source policy/uniqueness analysis |
| P2 | SEC-08 public CMS writes lack input/method/abuse controls | Medium; invalid inputs forwarded in mock |
| P2 | SEC-09 operational audit details are publicly readable | Medium for operational confidentiality; no actual secret disclosure observed |
| P2 | SEC-10 unauthenticated credentialed NST proxy | Medium; two Python entry paths reproduced with mocks |

The severity order reflects the stated preconditions. None of these entries claims that a production exploit was run or that current deployed infrastructure lacks additional controls.

## P0 verification gate — privileged RPC and entitlement hardening have unknown deployment state

**Severity if the older grants remain: Critical for arbitrary SQL; High for entitlement forgery. Status: deployment risk, not a confirmed live vulnerability.**

- Boundary: public Supabase Data API/browser roles → privileged database routines and paid-feature authorization.
- Evidence: `supabase/migrations/20260716112908_production_schema_baseline.sql:1161` defines `public.execute_sql(text)` as `SECURITY DEFINER`; lines 43405–43406 grant execution to `anon` and `authenticated`. The source revokes that access in `supabase/migrations/20260820013120_revoke_execute_sql_browser_roles.sql:5` and revokes the destructive rolling-metric RPC in `20260820013124_revoke_truncate_rolling_metrics_browser_roles.sql:5`.
- Baseline lines 42982/42996 and 44643 permit users to insert/update their own generic entitlements. `supabase/migrations/20260909120000_draft_pro_complimentary_access_codes.sql:29` adds the restrictive policy protecting Draft Pro/Patreon authorizing shapes. `web/lib/draft-pro/server.ts:84` consumes those grants for paid access.
- The current `tasks/TASKS/repository-audit-remediation/migration-authority.json` marks the baseline `applied`, but these three security migrations `unknown`. That is insufficient evidence to claim production is protected or vulnerable. The full source migration chain includes the corrections; do not report these as missing source fixes.
- Safe verification design: authorized operator reads `has_function_privilege` for `anon`/`authenticated` on the two routines, inspects the `PUBLIC` ACL entry (grantee OID zero, not a role named `public`), and checks `pg_policies` for `user_entitlements_draft_pro_service_only`; reconcile exact applied migration hashes. `deployed-metadata-checks.sql` is a prepared read-only query set, **not executed**. Do **not** invoke either privileged routine, execute test SQL through it, or attempt a paid-access write in production.
- Proposed action: prioritize bounded read-only grant/policy evidence. If absent, prepare an approved migration release using the existing fixes; preserve the migration authority and deployment ownership.

## SEC-01 — unauthenticated arbitrary server-side HTTP proxy

**Severity: High. Status: confirmed source behavior and isolated mock reproduction; deployed reachability/internal network access unverified.**

- Path: `web/pages/api/cors/index.ts:42`, `:53`, `:54`, `:60`, `:90`.
- Boundary: anonymous internet caller → server egress/internal services → returned response.
- `url` and `method` come directly from query parameters. `new URL` validates syntax only; `fetch` has no host/protocol allowlist, private-address filtering, redirect restriction, timeout, or response-size limit. Successful JSON responses are relayed in full. This is SSRF and arbitrary-method proxying; availability and bandwidth abuse are additional impacts. Infrastructure egress rules could limit impact, but are not evidenced here.
- Minimal safe reproduction: invoke the imported handler with no authorization, a synthetic loopback URL, and `method=DELETE`; replace `fetch` with an in-memory stub. The current test observes the chosen destination/method and a 200 response containing the stub body. No real loopback or production request is sent.
- Proposed fix: retire the generic proxy or replace URL input with a narrow provider/resource contract. If an HTTP proxy is necessary, allowlist HTTPS origins and paths, reject private/link-local/reserved addresses after DNS resolution, prevent redirects or revalidate every hop, allow only required methods, and bound request time/response bytes and caller rate. Use dedicated provider clients when possible.

## SEC-02 — development admin access trusts a spoofable Host header

**Severity: High when a development server with privileged credentials is reachable by an untrusted peer; otherwise local hardening risk. Status: confirmed mock behavior, network exposure unverified.**

- Path: `web/utils/adminOnlyMiddleware.ts:20`, `:70`, `:83`.
- Boundary: unauthenticated development HTTP caller → service-role client and all `adminOnly` handlers.
- Any non-production request whose Host header is `localhost` or `127.0.0.1` bypasses authentication. The socket peer and an explicit opt-in are not checked. A Host header does not prove that the request originated locally. The shared middleware covers many operational writers.
- Minimal safe reproduction: mocked handler, `NODE_ENV=development`, synthetic non-loopback peer address, and `Host: localhost:3000`; service-role handler runs without any auth call. The production-mode negative control correctly returns 401.
- Proposed fix: remove the bypass or require an explicit local-only configuration plus loopback peer verification and loopback-only server binding. Prefer normal verified admin credentials for any network-accessible preview. Do not infer production bypass from this finding.

## SEC-06 — CSV importer creates publicly mutable tables under baseline defaults

**Severity: High under the repository's documented database defaults. Status: DDL omission confirmed by isolated execution; current deployed default privileges and event triggers unverified.**

- Paths: `web/pages/api/v1/db/upsert-csv.ts:418`, `:432`, `:540`, `:549`; `supabase/migrations/20260716112908_production_schema_baseline.sql:44823` and `:44824`.
- Boundary: a legitimate administrator's import → public-schema table accessible to anonymous/authenticated Data API clients.
- The authorized route creates arbitrary validated table names through `execute_sql`, but never enables RLS or restricts grants. The baseline grants new public tables created by `postgres` broad privileges to both browser roles. No event-trigger safety mechanism appears in the supported migration source. A new table therefore inherits anonymous read/write access under those defaults. The route even attempts DDL before rejecting an empty upload. Existing-table behavior is separate and depends on that table's existing controls.
- This is **not an SQL-injection claim**: table/column identifiers are validated at lines 346/379, and SQL types are allowlisted at lines 361–369. The admin-only route also does not imply anonymous callers can create the tables directly.
- Minimal safe reproduction: stub auth/audit wrappers as identity functions to isolate an already-authorized handler; capture the `execute_sql` argument for a synthetic table and empty dataset. Assert one `CREATE TABLE` call, no `ROW LEVEL SECURITY`/`REVOKE`/policy clause, and then HTTP 400. No actual DDL is executed. A separate disposable database test can apply equivalent default grants and verify browser-role writes are denied after the proposed fix.
- Proposed fix: prefer a predefined secure import schema/staging table. Otherwise validate the complete import before DDL and create tables with RLS plus explicit least-privilege grants in the same transaction, before inserting data. Grant public SELECT only when the imported data is intentionally public. Check existing importer-created tables through authorized metadata reads; do not run blanket production revokes without checking consumers and obtaining release approval.

## SEC-03 — Patreon linking state lacks browser binding and one-time consumption

**Severity: Medium. Status: confirmed source behavior and isolated mock reproduction; successful real provider authorization requires user interaction and was not attempted.**

- Paths: `web/lib/integrations/patreon/oauth.ts:125`, `:138`, `:171`; `web/pages/api/v1/account/patreon/connect.ts:17`; `web/pages/api/v1/account/patreon/callback.ts:22`, `:49`.
- Boundary: an initiating FHFH account → a different browser's Patreon identity and entitlement association.
- The connect endpoint correctly authenticates the initiating account. Its signed state embeds that user's ID, but the callback accepts the state without an initiating-browser cookie/session. The nonce is not stored/consumed. A signed state proves integrity, not that the callback belongs to the browser that initiated linking. An attacker can start their own link flow and persuade another person to authorize it; the callback then links that person's Patreon identity to the initiating account.
- Minimal safe reproduction: generate state using an audit-only synthetic signing key, invoke the callback with empty cookies/headers and a mocked provider exchange, and observe `connectPatreonAccount` receive the state user ID. Repeated verification of the same state also succeeds. No real tokens, provider accounts, or database writes are used.
- Proposed fix: reuse the repository's Yahoo transaction pattern: cryptographic random state, hashed browser-binding cookie, short expiry, atomic single-use consumption, canonical callback URI, and PKCE if the provider supports it. Add cross-browser and replay rejection cases.

## SEC-04 — rejected cron requests still create privileged audit writes

**Severity: Medium. Status: confirmed wrapper behavior; affected routes inventoried separately.**

- Paths: `web/lib/cron/withCronJobAudit.ts:235`, `:305`, `:335`; example `web/pages/api/v1/db/manual-refresh-yahoo-token.ts:79` and `web/pages/api/v1/db/update-teams.ts:132`.
- Boundary: anonymous HTTP caller → service-role database write and operational failure monitoring.
- The `withCronJobAudit(adminOnly(handler))` order invokes the audit insert even after the inner middleware returns 401/403. Attackers can create audit traffic and false job failures without gaining access to the operational handler. Raw `req.url` is also persisted. This is write amplification/audit pollution, not execution of the protected job.
- Inventory: `cron-audit-order.csv` has 92 direct `withCronJobAudit(adminOnly(...))` compositions. The two remaining entries are also affected after manual tracing: `web/pages/api/Teams/nst-team-stats.ts:556` wraps its `handler` in `adminOnly` before audit at line 1126; `web/pages/api/internal/sync-yahoo-players-to-sheet.ts:16` authenticates inside the handler audited at line 36. Thus 94 source routes share the ordering issue at the captured revision. Do not count the safe `withOperationalRouteAuth` routes as affected.
- Minimal safe reproduction: compose the actual two wrappers with mocked Supabase, send one unauthenticated synthetic request, assert 401 and one attempted `cron_job_audit` insert.
- Proposed fix: put authentication outermost, following `withOperationalRouteAuth` (lines 127–129), then method validation and job audit. If denied-request telemetry is required, use separately bounded security telemetry. Add a regression assertion that denial causes no operational DB write.

## SEC-05 — anonymous diagnostic route permits 250 upstream operations

**Severity: Medium. Status: confirmed handler behavior with mocked upstream; actual runtime/cost unmeasured.**

- Paths: `web/pages/api/v1/db/audit-nhl-ppt-replay-coverage.ts:11`, `:145`, `:165`, `:206`; `web/lib/NHL/pptReplayCoverage.ts:129`.
- Boundary: anonymous caller → service-role schedule reads and repeated NHL play-by-play retrieval.
- This operational audit is exported directly without an auth wrapper. A GET may select up to 250 games and call the upstream coverage loader once per game. No route-level rate limit/cache or aggregate deadline is present. Parameter bounds cap one call but do not establish caller authorization or a shared budget.
- `web/lib/projections/ingest/pbp.ts:89` delegates to `nhleFetchJson`; `web/lib/projections/ingest/nhleFetch.ts:7` permits up to three attempts per game with a 20-second per-attempt timeout. Up to 750 attempts is a source-level upper bound if all retries run; actual platform timeouts may terminate sooner. No such network load was generated.
- Minimal safe reproduction: pass 250 synthetic game IDs with no authorization and replace the coverage loader with an in-memory function; the handler invokes it 250 times and responds 200. The test does not send 250 network requests.
- Proposed fix: use the existing operational-route auth contract, strict identifiers/date bounds, a conservative batch limit and total work budget. If public data is needed, publish a cached result through a separate read path.

## SEC-07 — browser writes can squat another provider identity

**Severity: Medium. Status: confirmed source-policy/constraint mismatch; deployed grants and real provider linking untested.**

- Paths: `supabase/migrations/20260716112908_production_schema_baseline.sql:40176`, `:40190`, `:43636`, `:34074`; `web/lib/integrations/patreon/sync.ts:131`.
- Boundary: an authenticated user's direct Data API write → another user's ability to prove and link their external identity.
- The owner-only INSERT/UPDATE policies correctly limit `user_id`, but allow that owner to set `provider` and `provider_user_id`. A global unique index reserves `(provider, provider_user_id)` without proof of provider authorization. The Patreon service then rejects an otherwise valid link when another FHFH row claims the provider ID. No subsequent supported migration restricts these identity columns. A user can preempt an unlinked identity or move their own claim to it without having that provider's credentials. This is link denial/identity-claim poisoning, **not demonstrated token theft or Patreon account takeover**. Existing occupied IDs are protected by uniqueness.
- Minimal safe test design: in a disposable database with two synthetic users, set role `authenticated` with user A's claims; insert A's row using a synthetic provider ID. Then simulate a valid provider response for user B and assert the ownership collision. No real IDs or credentials are needed. This database test was not run; policy statements and the service rejection are the evidence.
- Proposed fix: make provider identity/status/scope/verification fields server-authored. Revoke direct browser INSERT/UPDATE or replace them with narrow column grants/RPCs for permitted display fields, retaining row ownership checks. Let verified OAuth/provider flows reserve identities atomically. Keep current provider connection owners involved in the change.

## SEC-08 — anonymous CMS mutation forwards invalid inputs and any method

**Severity: Medium. Status: confirmed source behavior with a mocked CMS client; CMS-side limits/permissions unverified.**

- Paths: `web/pages/api/createComment.ts:6`, `:12`, `:14`, `:24`; `cms/schemas/comment.js:8`; `web/components/Comments/Comments.tsx:8`.
- Boundary: unauthenticated caller → CMS write capability and public comment stream.
- The route calls a privileged Sanity client without a POST restriction, field type/length validation, post eligibility check, throttling, or moderation gate. TypeScript types and the Studio schema do not validate the request body at runtime. The public comment query displays all stored comments for the post. The handler also returns the raw caught error object. Anonymous comments may be intentional; the issue is the unbounded and unvalidated write contract, not anonymity by itself. React escapes ordinary comment text, so this is not a demonstrated XSS finding.
- Minimal safe reproduction: replace `@sanity/client` with a stub, call the handler with `method=PUT`, no authorization, and object/array values for the name/comment fields. It calls `create` with those values and returns 200. No CMS request was made.
- Proposed fix: enforce POST, a strict bounded schema, an existing published post, and server-enforced anti-abuse limits suited to anonymous commenting. Add moderation if required by the product. Return a stable public error code and log sanitized diagnostic fields. Test invalid types/size, unsupported methods and rate-limited submissions without live CMS writes.

## SEC-09 — full operational audit details are exposed to public readers

**Severity: Medium for operational confidentiality. Status: source exposure confirmed; actual stored content and deployed policies not read.**

- Paths: `supabase/migrations/20260716112908_production_schema_baseline.sql:39827`, `:43638`; `web/lib/cron/withCronJobAudit.ts:23`, `:303`, `:311`, `:327`.
- Boundary: privileged job request/response diagnostics → anonymous Data API readers.
- The baseline grants `anon` SELECT and a `USING (true)` SELECT policy over `cron_job_audit`. No later supported migration revokes that access. The audit writer stores the complete request URL, thrown message, and up to 4,000 characters of serialized response. `safeJson` truncates; it does not redact. This exposes internal operational details by design and risks disclosing sensitive fields if a handler includes them. **No actual secret value or production audit record was inspected, and no existing token leak is claimed.**
- Minimal safe reproduction: the isolated audit test verifies synthetic private query/response markers enter the stored row; SQL inspection verifies the public read grant/policy. A disposable database role test can verify denial after the change. Do not fetch production rows to look for secrets as part of this task.
- Proposed fix: restrict detailed audit reads to the authorized operational boundary and publish an explicit sanitized health view if public status is intended. Record a normalized route and allowlisted query/outcome fields rather than raw URLs/response previews. This privacy fix is separate from SEC-04's unauthorized-write fix.

## SEC-10 — anonymous requests consume the credentialed NST upstream

**Severity: Medium. Status: two Python handler paths reproduced with mocked upstream calls; deployed reachability, provider quota and actual cost unverified.**

- Paths: `functions/api/index.py:36`, `:57`; `functions/api/fetch_team_table.py:77`, `:99`, `:107`, `:252`, `:301`; compatibility path `web/pages/api/fetch_team_table.ts:83`, `:112`, `:117`.
- Boundary: anonymous caller → server-managed NST credential/quota and application runtime.
- Both Python entrypoints accept arbitrary supplied season/date/filter strings and call the upstream loader without authentication or shared rate control. The loader attaches `NST_KEY` as a header to a fixed HTTPS provider endpoint. The 10-second timeout limits an attempt, but does not prevent arbitrary caller frequency. The Next.js compatibility route is also anonymous; its shared NST client has additional controls, so the direct Python path is the clearest gap. The normal caller at `web/pages/api/Teams/nst-team-stats.ts:19` is an operational ingestion route, making this exposed companion boundary significant.
- This is not arbitrary-host SSRF or credential disclosure: the upstream hostname is fixed and no credential value is returned by the reviewed success path. Interpolated query strings also allow parameter pollution; use a query encoder and schema bounds.
- Minimal safe reproduction: `safe-python-checks.py` extracts only the two route functions, supplies a request with no Authorization and synthetic season inputs, and stubs the upstream loader. Each returns 200 after one mocked operation. No Python app/environment imports, provider calls, or database access occur.
- Proposed fix: require an explicit service credential on both Python entrypoints and retire or protect the compatibility route if no public consumer needs it. Validate seasons/dates/enums and encode query parameters. Preserve required ingestion coverage and the repository's **at least 21-second NST spacing across jobs** through a shared budget; do not solve this with faster bursts or blanket schedule disabling.

## Dependency advisory matching — initial attempt blocked; approved retry returned findings

Historical initial attempt (superseded by the approved successful retry in `dependency-audit-approved.json`; see the checkpoint diary): the npm lockfile contains 1,628 dependency entries plus the root entry. Offline inspection found HTTPS npm-registry archive URLs and integrity hashes for all 1,628 dependency entries; this says nothing about known vulnerabilities. The audit used a separate copy with empty npm config files and a sanitized environment, without installs/scripts or application changes. The sandboxed query failed DNS (`ENOTFOUND registry.npmjs.org`). Automatic approval review rejected an escalated public-advisory query because package metadata might disclose private package information. No upload was completed. Do not interpret the empty vulnerability map as zero vulnerabilities; the audit failed. Explicit approval to disclose package names/versions to `registry.npmjs.org` or an authorized offline advisory snapshot is needed for a current advisory result. See `dependency-structure.json` and the retained failed-audit output.
