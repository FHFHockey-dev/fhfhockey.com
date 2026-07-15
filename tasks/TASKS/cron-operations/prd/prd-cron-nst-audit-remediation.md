# PRD: Cron, NST, and Audit Remediation

> **Shared pair mapping:** This PRD governs both `tasks/TASKS/cron-operations/tasks-prd-cron-nst-audit-remediation.md` and the active email-derived remediation list `tasks/TASKS/cron-operations/tasks-cron-audit-email-failures.md`. The two lists must be reconciled by owning route/failure rather than executed as duplicate fixes.

## Introduction/Overview

The cron health emails from March 29, 2026 and March 31, 2026 show a mix of real job failures, missing audit observations, and likely misclassified audit failures. The current cron-report surfaces in `[cron-report.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/cron-report.ts)`, `[CronAuditEmail.tsx](/Users/tim/Code/fhfhockey.com/web/components/CronReportEmail/CronAuditEmail.tsx)`, and `[CronReportEmail.tsx](/Users/tim/Code/fhfhockey.com/web/components/CronReportEmail/CronReportEmail.tsx)` depend on consistent `cron_job_audit` rows and on stable upstream integrations.

This project has two phases:

- Phase 1: remediate the live failures and observation gaps visible in the March 29 and March 31, 2026 emails, with special priority on Natural Stat Trick (NST) migration and missing audit coverage for cron-scheduled Supabase-writing routes.
- Phase 2: harden audit coverage and reporting behavior for cron-scheduled Supabase-writing routes so the daily emails reflect true operational status instead of noisy or ambiguous failure states.

The NST portion is urgent because `www.naturalstattrick.com` is no longer the correct automated access host. NST traffic must move to `data.naturalstattrick.com` and must require a configured key. Until the key is present, NST routes must fail fast instead of silently using the legacy host.

## Goals

- Restore trustworthy cron visibility so the daily email reflects actual failures, missing runs, and partial-success conditions.
- Migrate all NST-backed application endpoints away from `www.naturalstattrick.com` to `data.naturalstattrick.com`.
- Require an NST key from environment configuration and fail fast when the key is missing.
- Ensure every cron-scheduled API endpoint that writes or upserts to Supabase records a usable audit row.
- Re-run the affected jobs and the cron email flow and confirm the system reaches a stable post-remediation state.

## User Stories

- As an operator, I want the daily cron summary to distinguish hard failures from partial-success or expected transient states so I can act on the right problems.
- As an operator, I want every scheduled Supabase-writing route to emit a matching audit row so missing telemetry does not hide route behavior.
- As an operator, I want NST routes to use the supported bot-access host and authentication flow so production scraping continues to work.
- As a developer, I want audit payloads to follow one consistent contract so the report email can infer status, timing, rows upserted, and failed rows reliably.
- As a developer, I want post-fix validation to prove the cron system is healthy beyond NST alone, because downstream jobs depend on upstream freshness.

## Functional Requirements

1. The system must classify the March 29, 2026 and March 31, 2026 email failures into explicit buckets: real code defect, upstream dependency failure, configuration failure, missing telemetry, schedule mismatch, and partial-success noise.
2. The system must preserve the current daily summary and audit email outputs but improve their input data quality so those emails report true operational state.
3. Every endpoint in scope that currently references `www.naturalstattrick.com` must be updated to use `data.naturalstattrick.com`.
4. All NST-backed routes must read the NST key from environment configuration and must fail fast with a clear, sanitized error if the key is missing.
5. NST authentication details must never be exposed in logs, audit rows, cron emails, or response payloads.
6. The implementation must identify and update all known NST-backed routes in the application layer, including at minimum:
   - `/api/v1/db/update-nst-gamelog`
   - `/api/v1/db/update-nst-current-season`
   - `/api/v1/db/update-nst-last-ten`
   - `/api/v1/db/update-nst-goalies`
   - `/api/v1/db/update-nst-team-daily`
   - `/api/v1/db/update-nst-player-reports`
   - `/api/v1/db/check-missing-goalie-data`
   - `/api/Teams/nst-team-stats`
7. The implementation must document the NST request method used by the codebase, including whether the key is sent as a header, query string, or both, and that choice must be consistent across all NST routes.
8. The audit system must use a consistent success/failure contract for cron-scheduled Supabase-writing routes.
9. A route must not be marked as an audit failure only because a 200 response message contains text such as `Failed games` or similar mixed-result language.
10. Routes that complete with row-level issues must be recorded as successful with structured `failedRows` and sample details when the overall request succeeded.
11. The shared audit behavior in `[withCronJobAudit.ts](/Users/tim/Code/fhfhockey.com/web/lib/cron/withCronJobAudit.ts)` must be updated or extended so failure inference prefers explicit structured fields over naive message substring matching.
12. Any scoped route that uses bespoke audit insertion instead of the shared wrapper must be normalized to the same audit contract or otherwise produce equivalent fields for `job_name`, `status`, `rows_affected`, timing, response summary, and structured error details.
13. The project must inventory all cron-scheduled Supabase-writing routes and confirm whether each one records a matching `cron_job_audit` row.
14. The project must remediate the missing-audit cases surfaced in the March 31, 2026 email for scoped routes, including:
   - `update-shift-charts`
   - `update-nst-tables-all`
   - `update-nst-team-daily`
   - `update-season-stats-current-season`
   - `update-rolling-games-recent`
15. The project must explicitly evaluate route-to-job matching in the cron report so a route that is already wrapped with audit logging is not shown as “No audit row” because of alias, path, method, or job-name mismatch.
16. The daily cron report must continue to show observation gaps separately from route failures.
17. The implementation must triage and fix the live non-NST failures shown in the March 31, 2026 daily summary because full-system verification depends on them:
   - `update-standings-details` NHL API `429`
   - `run-forge-projection-v2` `422`
   - `update-sko-stats-full-season` schema mismatch on `assists_5v5`
   - `update-power-rankings` `(void 0) is not a function`
   - `run-projection-accuracy` missing succeeded projection dependency
18. The implementation must account for the March 29, 2026 audit noise where repeated failures were reported for `/api/v1/db/cron/update-stats-cron` and `/api/v1/db/update-line-combinations`, and must distinguish true failures from expected live-game or partial-processing conditions.
19. The implementation must preserve or improve existing cron timing metadata so the email templates can continue to render duration, row counts, and benchmark notes.
20. The project must re-run targeted routes after fixes and then re-run the cron email process so verification covers route execution, audit recording, and email summarization.
21. Full verification must include the cron-report flow plus the relevant upstream/downstream dependencies, not only the NST routes.
22. `public.immutable_unaccent(text)` must use a fixed empty `search_path` and a schema-qualified `public.unaccent` call with the intended `public.unaccent` dictionary, preserving strict/immutable/parallel-safe normalization semantics for every dependent expression index.
23. A WGO goalie bulk-write failure and its bounded row-level fallback must never be converted into a successful route or audit result when requested rows remain unpersisted; the route must expose structured failed-row counts/samples and an actionable failure status.
24. Both the 20-minute recent-game stats cron and the daily season-stats route must use one skater-stat batch contract: on the exact player-parent FK violation, look up and repair only missing `players.id` parents, fail on any repair error, retry the full skater-stat batch exactly once, and propagate any remaining or non-player-FK error without individual stat-row partial writes.
25. `statsUpdateStatus.updated=true`, per-game success counts, and successful audit classification must occur only after the shared skater-stat batch contract completes; current failed games must remain explicit failed/pending rows while separately governed stale-game quarantine remains visible and non-successful work is never relabeled as a clean run.
26. Both dynamic and daily season-stat routes must apply the same fail-closed principle to goalie batches: a player-parent FK may trigger bounded missing-parent repair and one complete-batch retry, but any repair, retry, or unrelated write error must propagate with structured row/game details and must prevent status/audit success.
27. WGO date ingestion must treat every required upstream request/page as one acquisition unit: any request failure must prevent persistence of partial or empty date data, return a bounded sanitized source/date failure, and force the route and audit to error. Overwrite mode must acquire and persist the complete replacement batch before pruning only stale existing goalie IDs; a failed acquisition/upsert may not delete good rows, and a failed prune must retain a safe superset while failing the route/audit.
28. Dynamic and daily season-stat ingestion must share an explicit team-stat completeness contract: required team source rows and `teamGameStats` writes may not be skipped or suppressed, and any missing/invalid source or terminal write failure must leave the game pending and produce bounded structured route/audit failure details.
29. A finished game's `boxscore.playerByGameStats` payload must be present and produce non-empty skater and goalie batches before the game can succeed; absent, invalid, or empty player-source data must remain pending and surface as a bounded structured route/audit failure.
30. CRON_SECRET containment must use value-free, parameterized tooling that returns only allowlisted counts, booleans, job IDs, timestamps, and status codes; secret values, command text, request/response content, headers, environment values, and raw database errors must never enter logs, shell history, task artifacts, or chat.
31. Affected literal and already-Vault-backed consumers must be quiesced from a non-secret activation ledger before rotation, and every inventory, shape, and activation invariant must be asserted before mutation and restored afterward.
32. The replacement must be staged only in the existing scoped Vercel record and a temporary Vault candidate, followed by an unchanged-stable-release deployment; old rejection and candidate authorization must be proved only on the non-mutating cron-auth-check before canonical database rotation.
33. Canonical Vault replacement and all 59 literal command replacements must occur in one parameterized transaction using `vault.update_secret` and `cron.alter_job`, never direct `cron.job` updates, while preserving URL/method/body/timeout/schedule/name/activation semantics. All literal-bearing jobs must remain quiesced after that transaction; the temporary candidate remains available until final proof and cleanup.
34. Literal-to-Vault conversion must remain a separately gated but immediately following P0 phase: convert the two inactive definitions first, then the 57 previously active definitions in dependency-aware batches of 1, 4, and at most 8, with high-risk jobs isolated and every batch disabled, structurally checked, authorized, incrementally restored to its prior active state, and observed before progression. The two pre-existing Vault-backed jobs may resume individually after canonical authorization succeeds.
35. P0 closure requires zero compromised/current plaintext matches in current commands and pending pg_net queue/response rows, one canonical Vault secret, all 59 definitions Vault-backed or explicitly approved as disabled exceptions, missing/old rejection and current authorization, one healthy observation per batch, no secret-bearing debris, and reconciliation of the weekly-owner runbook activation drift. Historical `cron.job_run_details.command` must be inspected only through value-free match counts, and any immutable platform log/backup retention boundary must be explicitly documented rather than overstating plaintext eradication.
36. `update-season-stats` must be protected by the established admin-or-valid-CRON_SECRET boundary before its service-role full-season writer is deployed; unauthenticated callers must be rejected and intended cron/admin callers must remain covered by regression tests.
37. Explicit structured success/status fields must take precedence over legacy message substring heuristics in audit classification, including clean messages that contain zero-valued words such as `Failed: 0`.
38. Every `statsUpdateStatus` advancement or stale quarantine must prove the exact expected `gameId` rows were returned; a no-error zero-match update or partial expected-set match must remain pending and fail the route/audit.
39. Season incremental selection must be gap-safe: a later successfully persisted game may not advance the next-run cursor past any earlier failed/incomplete game.
40. Season HTML-report PP-TOI fallback must use the canonical eight-digit NHL season folder and may persist a fallback value only after the correctly formed source attempt.
41. The shared audit wrapper must inspect the resolved Supabase audit-insert result and surface/log a returned database error rather than treating an awaited non-throwing response as success.
42. WGO season lookup database errors must remain distinguishable from a genuine absent season and must fail the date/route/audit instead of returning a normal zero-update result.
43. Every WGO database write diagnostic, including bulk, row fallback, recovered fallback, and prune output, must be bounded and sanitize URLs, bearer-shaped values, and control characters before logs/responses/audits.
44. WGO pagination must enforce a bounded page/start or repeated-page termination rule that produces a structured route/audit failure before platform timeout.
45. The immutable-function migration must assert or explicitly preserve the verified production cost, leakproof, support, and configuration catalog contract in addition to owner/identity/grants and the required strict/immutable/parallel-safe/security/search-path attributes.
46. The existing admin-or-cron authorization helper and the privileged season writer must fail closed when `CRON_SECRET` is absent or blank; a literal `Bearer undefined` may never authorize a request, and the route boundary may be deployed only after the explicit external-contract checkpoint.
47. Every stats writer must require the NHL landing payload game ID to equal the requested game ID before any persistence or status advancement; mismatches must be structured, non-quarantinable failures.
48. The recent-game stats cron must accept only a documented bounded integer work count and must bound concurrent game work so caller-controlled fan-out cannot exhaust the function.
49. Caller input errors may return 4xx, but Supabase/RPC/quarantine/upstream/internal failures in recent or dynamic game-stat routes must return bounded 5xx responses and remain pending/audit-failed.
50. Successful season-stat responses must expose a canonical successful-work count that the audit wrapper records as `rows_affected` without counting failed, skipped, or deferred games.
51. `update-wgo-goalies` must use the established admin-or-valid-CRON_SECRET authorization boundary for every mutation mode; unauthenticated requests must be rejected, and cron/admin callers must retain explicit regression coverage before deployment.
52. Season incremental selection must recover historical gaps that predate the prospective stop-at-first-failure rule by selecting the earliest incomplete/status-pending game rather than relying only on each stats table's maximum game ID.
53. The bespoke WGO audit writer must inspect a resolved Supabase insert result and surface a returned database error with bounded sanitized diagnostics instead of reporting route success after audit loss.
54. Player-specific WGO acquisition must use the same required-page validation, repeated-page detection, and bounded page ceiling as date-wide acquisition so malformed or non-advancing sources fail before timeout.
55. Rejected WGO bulk and row upsert promises must be normalized into the structured bounded write-failure contract before reaching logs, responses, or audit details.
56. Recent and season stats routes must apply one bounded sanitizer to generic per-game errors and settled-result logging so HTML, URLs, bearer-shaped strings, and control characters cannot reach logs, responses, or audit details.
57. Both game-stat writers must acquire and validate every required team/player source before the first database write, then use either a verified transactional per-game persistence boundary or an explicitly approved retriable-pending partial-write contract.
58. Stale quarantine must be opt-in only for explicitly safe pre-write failure classes; generic failures or any failure after partial persistence may not set `statsUpdateStatus.updated=true`.
59. Durable stats status must distinguish fully persisted completion from safe pre-write quarantine/cancellation with an explicit outcome or reason so the historical structural cursor can skip intentional terminal no-data outcomes without overlooking legacy false-success rows.
60. Historical completeness recovery must be able to prove the expected skater and goalie batch cardinality for a game, not only the presence of one row; persist a versioned expected-count/completion manifest or an equivalent verified contract and select any older non-empty-but-partial game before later complete games.
61. Single-player WGO reads must accept only a positive integer NHL player ID, construct the upstream filter from that validated value, and exclude or fail any summary, advanced, or days-rest row whose player ID does not match the request so malformed input or an ignored upstream predicate cannot return unrelated goalies.
62. `public.get_unupdated_games()` must not remain an unrestricted privileged routine: preserve its required stats-discovery result contract while using fully schema-qualified objects, an empty function `search_path`, security-invoker semantics, and service-role-only execution.
63. Any transactional per-game stale-row replacement must have a verified `gameId`-leading access path on every pruned stats table; add the missing goalie-game index before the production writer is activated.
64. Supabase's authoritative registered migration chain must be reproducible on a blank data-less database before it is used as evidence for option-A branch validation: inventory every production object assumed by the current 26-entry remote chain, establish a behavior-preserving schema baseline or equivalent supported replay contract, and prove the chain reaches the expected non-empty schema without changing live production behavior or rewriting already-applied semantics speculatively.
65. The transactional game-stat migration must use PostgreSQL conditional expressions such as `coalesce(...)` in valid grammar form rather than schema-qualifying them as catalog functions; executable verification must exercise every typed-row validation branch so a migration that creates successfully cannot defer a first-call runtime failure.
66. Production deployment of the transactional contract must use one deterministic package-manager boundary: exclude the untracked pnpm lock and root store from a clean web-only artifact, install the tracked npm lock, prove the pinned Supabase/PostgREST version plus full type/build checks, and promote only that exact READY artifact.
67. A future Supabase client upgrade must not rely on the open-index `SkaterDbRecord` shape for regular/playoff game-stat upserts; both targets require exact generated `Insert` typing and focused write regressions before the dependency change is accepted.
68. The dedicated immutable-unaccent migration must converge from either the exact verified legacy-null configuration or the exact already-hardened empty-search-path configuration, reject every other catalog state, and preserve the body plus all dependent index invariants.
69. The staged Cron release must include every required concurrent Draft Ranker source module and its required ranking-identity prop contract; a stale Git snapshot or incomplete local upload is not acceptable build evidence.
70. The production build must pass under a documented bounded Node heap contract that is reproducible locally and on Vercel; heap exhaustion cannot be treated as a transient success or bypassed without recording the selected build resource boundary.

## Non-Goals (Out of Scope)

- Retrofitting audit rows for every manually triggered endpoint in the application. This PRD is limited to cron-scheduled Supabase-writing routes.
- Redesigning the visual layout of the cron emails unless a small content tweak is required for clarity.
- Reworking all cron schedules or time slots unless a schedule mismatch is directly causing the scoped failures.
- Expanding NST usage beyond the existing route set.
- Fixing non-scoped side-effect routes that do not write to Supabase, such as Google Sheets sync, except where they block correct cron-report interpretation.

## Design Considerations

- The email surfaces should remain familiar to the operator.
- The report should continue to separate:
  - scheduled failures
  - missing scheduled runs
  - unscheduled activity
  - audit-only failures
  - partial-success warnings
- If wording changes are needed, prefer short operator-facing labels such as `Missing audit row`, `Partial success`, `Config missing`, and `Upstream rate limited`.

## Technical Considerations

- `cron-report.ts` currently relies on both scheduled cron observations and `cron_job_audit` rows. Alias matching between schedule names, route paths, and audit `job_name` values must be reviewed carefully.
- `[withCronJobAudit.ts](/Users/tim/Code/fhfhockey.com/web/lib/cron/withCronJobAudit.ts)` currently infers failure partly from message text. This is likely a root cause of the inflated March 29, 2026 audit failure count.
- `[shift-charts.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/shift-charts.ts)` already writes a bespoke audit row and should be normalized against the shared contract instead of left as a special case.
- Some scoped routes already use `withCronJobAudit` but still appeared in the March 31, 2026 email as missing audit rows. That indicates a reporting correlation issue, not only a missing wrapper issue.
- NST migration must include any helper functions, Python scrapers, fetch wrappers, or Vercel function URLs that still assume the legacy NST host.
- Production catalog evidence captured on 2026-07-14 shows `public.immutable_unaccent(text)` is a strict, immutable, parallel-safe, security-invoker SQL function with no fixed function `search_path`; its body selects unqualified `unaccent('public.unaccent', $1)` while the extension and dictionary live in `public`. Four valid/ready/live expression indexes depend on it (`goalie_name_norm_btree`, `skater_name_norm_btree`, `yplayers_name_norm_btree`, and `yplayers_name_norm_trgm`), and `yahoo_nhl_player_map_mat` also evaluates it during refresh. No generated column or other database routine calls it.
- Representative production read-only parity checks prove `public.unaccent('public.unaccent'::pg_catalog.regdictionary, input)` matches the current function for accented, ligature, and empty-string samples and resolves with `search_path = ''`; therefore the migration should replace only the function boundary and should not reindex unless post-apply catalog or output evidence shows drift.
- `update-wgo-goalies` retries a failed bulk write row-by-row. The bounded fallback may recover transient batch failures, but any remaining row failure must abort every route mode with structured counts/samples so the manual `cron_job_audit` insertion records an error rather than a false success.
- The two stats writers now acquire and materialize their required sources before the first write, but their team/skater/goalie writes remain separate transactions. The production checkpoint must choose between one additive per-game transactional RPC and an explicit partial-write exception; any RPC should remain security-invoker, use an empty `search_path`, expose exact returned counts, and grant execution only to the required service role.
- `statsUpdateStatus.updated=true` currently represents both fully persisted success and safe pre-write quarantine. That collision blocks the structural season cursor, and row-presence alone cannot certify legacy expected roster cardinality. The same status-schema checkpoint must add a durable terminal outcome/reason plus versioned expected/observed batch counts or an equivalent proof contract.
- Production review also found that legacy `public.get_unupdated_games()` is a public-executable `SECURITY DEFINER` routine without a fixed `search_path`; the additive checkpoint must harden that existing boundary without broadening client table access. `goaliesGameStats` additionally needs a `gameId`-leading index before the new transaction prunes stale goalie rows by game.
- The first authorized data-less Supabase branch proved the production project's registered migration history is not a complete bootstrap: connector branch creation replayed the 26 registered main migrations, reached `MIGRATIONS_FAILED`, and left zero public tables and zero applied migrations, while the local dirty migration directory is not consumed by connector-created branches. The failed branch was deleted after evidence capture. The sparse Draft Ranker migration itself passes isolated executable replay, so no historical file should be rewritten without an exact chain-level failure and production metadata reconciliation. Repairing the authoritative bootstrap is now a separate P1 dependency before another ordinary connector branch can be accepted as clean-replay evidence.
- The tracked npm lock pins Supabase/PostgREST 2.89.0, while an untracked pnpm lock and pnpm-linked 2.110.3 local install expose stricter diagnostics. The production candidate must come from a temporary web-only snapshot that preserves current source but excludes caches, environment files, root `.pnpm-store`, and the untracked pnpm lock; the shared worktree/index remain untouched.
- Production already carries the exact hardened `immutable_unaccent` definition through applied Draft Ranker migration `20260715024101`; the dedicated migration remains useful as the canonical function-specific contract but must converge idempotently from that exact hardened state rather than fail or accept arbitrary `proconfig` drift.
- Executable PostgreSQL review of the local transactional migration found six `pg_catalog.coalesce(...)` calls in the team/skater/goalie typed-row validators. `COALESCE` is a conditional expression, not a schema-resolvable catalog function; function creation can defer these statement plans until first invocation. The correction must be limited to unqualifying those expressions while preserving qualification of actual catalog functions and aggregates, and the regression must forbid recurrence.
- Literal-bearing jobs must stay disabled after the atomic canonical rotation until each one is converted to the canonical Vault lookup; enabling candidate-literal commands can copy the replacement into cron statement/run history. Activity is restored only per verified Vault-backed batch, while the two already-Vault-backed consumers may resume after canonical authorization proof.
- The status-only pg_net proof necessarily creates transient queue/response rows containing request or response metadata. Helpers must use a fixed URL, return only request IDs/status/timeout/error booleans, delete recorded response rows without reading headers/content/error text, wait for queue removal, and prove zero scoped debris before finalization.
- The single-player WGO request mode must validate its NHL ID before interpolating a Cayenne expression and must apply the same requested-player filter to every returned source, even when the upstream endpoint claims to honor the predicate.
- Because the NST key is not yet approved at PRD creation time, verification must define a blocked state clearly:
  - before key approval: configuration failure is expected and must fail fast
  - after key approval: legacy host usage is forbidden and all NST validation must use the new authenticated path
- Any audit storage of request URLs must avoid leaking the NST key if the key is passed in the query string.

## Success Metrics

- The post-remediation daily cron summary shows zero scoped “No audit row” findings for cron-scheduled Supabase-writing routes.
- The post-remediation audit email no longer inflates failures for successful 200 responses that only contain mixed-result text.
- All scoped NST routes are confirmed to call `data.naturalstattrick.com` and none call `www.naturalstattrick.com`.
- When the NST key is absent, scoped NST routes fail fast with a clear configuration error.
- When the NST key is present, targeted NST validation succeeds or produces only documented upstream-limit failures.
- The March 31, 2026 failure set is reduced to only genuine remaining blockers, with each blocker explicitly categorized.
- A full-system verification run completes and produces a cron email where scoped failures, missing runs, and partial-success notes match the actual route behavior.

## Open Questions

- What exact environment variable name should store the NST key?
- Should the NST key be sent primarily as a custom header, as a query parameter, or with a header-first and query-string fallback policy?
- Are any NST requests still routed indirectly through other hosted functions that also need host/key migration?
- For routes such as `update-stats-cron` and `update-line-combinations`, what response contract should represent partial progress versus actionable failure?
- Should the cron report suppress known safe side-effect routes from “No audit row” warnings when they are intentionally out of scope for Supabase audit coverage?
- Is a small follow-up PRD needed after this work to cover non-Supabase scheduled side-effect routes and remaining cron observability gaps?
- Should game-stat persistence use the recommended additive service-role-only transactional per-game RPC with a durable outcome/count manifest, or should the owner explicitly accept observable retriable partial rows and a narrower status-authoritative contract that cannot prove every legacy partial batch?
