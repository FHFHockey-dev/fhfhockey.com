# Recurring RSO / Start Chart schedule refresh — implementation candidate

Prepared offline on 2026-10-16 in the canonical `/Users/tim/Code/fhfhockey.com` checkout, `octoberBranch`, inspected HEAD `a8f58de6178e282acd3a71851c66f4a56b119f14`. **Nothing in the application, scheduler, database, credentials or production configuration was changed.** New files are confined to this artifact directory. This is independent of FORGE's active one-time repair.

## Decision

Propose one separately named, authenticated **POST** job, `refresh-roster-optimizer-schedule`, at **09:50 and 21:50 UTC** (`50 9,21 * * *`). Use the repository's documented **pg_cron → pg_net → web route** convention, subject to confirming that operational ownership and the existing Vault reference before activation. Do not introduce a second scheduler or Vercel cron entry. No scheduler was created here.

Use a small recurring route, `/api/v1/db/refresh-roster-optimizer-schedule?profile=current-next-v1&dryRun=false`, with fixed recurring authority. Leave the existing exact-game/hash, one-time route untouched. Default requests to the new route are inspection-only; explicit `dryRun=false` enables a write after authentication, method enforcement and scope checks.

Two runs per day are the smallest simple cadence that tolerates one missed cycle while staying below the existing 36-hour cache gate: the next observation would ordinarily be 24 hours after the previous success. Daily execution can reach 48 hours after one miss. Two consecutive misses approach 36 hours and require operator attention. Execution delays and failures still matter; this is not an availability guarantee. This cadence **does not satisfy** the separate provisional 6-hour / near-puck-drop 2-hour UI warnings, and does not change or suppress them.

## What the local wiring actually establishes

| Evidence | Finding |
| --- | --- |
| `web/pages/api/v1/db/update-roster-optimizer-schedule.ts` | Existing POST-only route; defaults to bounded D−2…D+21; reads Yahoo weeks/season/team directory; normalizes source; reads existing season cache; upserts; deletes only in full mode with complete source. Legacy unguarded calls still write. |
| `web/lib/rosterScheduleData/refreshGuard.ts` | Guarded writes require explicit dates, season, exact game IDs, max sides and an inspected SHA-256. That contract must remain available for the separate repair. It is unsuitable as a static recurring URL. |
| `web/lib/rosterScheduleData/source.ts` | Bounded requests advance seven days per NHL schedule GET. Every requested date must appear, including empty dates. Conflicting duplicate game versions reject. The normal transport currently has no byte cap or independent timeout. |
| `web/lib/rosterScheduleData/planningInputs.ts:88` | Shared reader queries one day of padding on either side of a consumer range, then evaluates returned games in the requested local-date scope. The oldest valid receipt across scoped rows drives the 36-hour warning. Reloading the reader does not refresh the cache. |
| `web/lib/rosterScheduleOptimizer/workspace.ts:150` | Default RSO horizon is the current Monday–Sunday in the manager's timezone, or an authoritative current provider period. Arbitrary selected/custom dates are also allowed. |
| `web/pages/api/v1/start-chart.ts:963` and `:1182` | Start Chart consumes single-date shared planning inputs / game expectations; its legacy path also uses the independent canonical slate. Refreshing this cache does not refresh that slate or create a forecast. |
| `web/vercel.json` | No roster-optimizer schedule refresh cron. The rolling pipeline has its own 10:05 UTC entry. API routes have an existing configured 240-second ceiling. |
| `tasks/TASKS/cron-operations/cron-schedule.md` | No matching scheduled-job entry for the current cache writer. Contains the established Vault-backed pg_net POST pattern and separate daily reporting conventions. |
| `web/lib/cron/cronInventory.ts:46`, `web/pages/api/v1/db/cron-report.ts:68` | An alias / reporting mapping already recognizes the old writer. An alias is not a registered scheduled job. |

The supplied 46-hour age for October 15 game `2026020112`, and the absence of a matching live pg_cron job in the earlier inspection, are **reported prior evidence**, not fresh database observations. Local repository inspection agrees that no matching declared job exists. External or indirect scheduling remains unverified. No live catalogs, provider endpoints, logs, credentials, approval files, guarded-write attempts or private pilot were inspected.

The earlier private `ROUTINE-REFRESH-PROPOSAL.md` was read at the supplied exact path. This proposal changes its tentative daily D−2…D+21 design for two reasons: one daily miss can violate 36 hours, and D−2 stops refreshing early-week rows that the current-week reader still ages.

## Horizon and recurring authority

The proposed server-owned profile pins Yahoo game key **477**, Yahoo season **2026**, NHL season **20262027**, regular-season games and the existing cache conflict identity `game_key,source_game_id,team_id`. It does not infer season rollover from the wall clock or accept a caller-selected season, game set, date range, row cap or full mode.

1. Determine today's date in `America/New_York`, matching Start Chart's game-expectation scope and the NHL scoring-date use case.
2. Compute the full current and next Monday–Sunday calendar weeks.
3. Extend that range to include the **entire active Yahoo period** if its boundaries are wider. Exactly one valid active period is required.
4. Add one day of source-date padding on each side, consistent with the shared reader's date padding. Reject a horizon over 31 inclusive days rather than clipping it.

For the selected **October 12–18** week and ordinary Yahoo periods, every run during that week fetches **October 11–26 inclusive**: 16 dates, three source requests at October 11, 18 and 25. Thus October 12 does not age out of the refresh on October 15–18, and October 15 game `2026020112` is in scope. The offline fixture uses that supplied ID with synthetic teams/status/time; it is not a fresh observation of that real game's details.

This is a declared near-term service horizon, covering current/next calendar-week RSO and Start Chart dates inside it. It **does not promise freshness** for every arbitrary RSO selection (up to 367 days), a 21-day calendar request starting elsewhere, next-N discovery up to 60 days, all provider future periods, historical workspaces or all possible manager timezones. A selected range outside the refreshed horizon keeps its actual receipt ages and existing limitations; its extension requires a separately bounded decision. A wider active provider period is included only while the 31-day cap holds. Season edges, missing calendar mappings or a new season stop writes and require review.

## Exact proposed local changes

[implementation.patch](implementation.patch) is a complete, **unapplied** five-file code diff: **195 insertions, one deletion**.

| Future application path | Change |
| --- | --- |
| `web/lib/rosterScheduleData/recurring.ts` | Fixed profile, strict query parsing, horizon derivation, capped/cancellable source-page reader. |
| `web/pages/api/v1/db/refresh-roster-optimizer-schedule.ts` | Separate POST route with inspection default; bounded exact-count metadata/cache reads; source and identity validation; one upsert; existing auth/audit wrapper. |
| `web/lib/rosterScheduleData/source.ts` | Optional per-page reader seam, retaining the old default behavior. Reuses the established date completeness and duplicate validation. |
| `web/lib/cron/cronInventory.ts` | One new recurring-job route alias. |
| `web/pages/api/v1/db/cron-report.ts` | New job alias and target-table mapping. |

No changes are proposed to the current guarded route, guard contract, consumer policy, schema, manifests, lockfiles, model generation, serving flags or existing jobs. A separate route adds roughly 105 lines to avoid mixing recurring authority with repair-only authority in the shared route. It reuses existing normalization, week mapping, source validation, reciprocal-side guard and operational auth/audit.

The recurring route derives game IDs from the current bounded source response and computes a content hash for audit evidence. This is **not a human-approved per-run hash** and must not be described as one. Activation approves the fixed recurring policy instead. Each game must have two reciprocal, uniquely identified sides, correct season, mapped week, known team ID/abbreviation and a supported status. Missing dates, malformed/empty sources, unsupported games, unknown statuses, incomplete database reads and overflow fail before the upsert.

A bounded existing-cache read checks that no previously cached side in the refreshed date range disappeared. If a game moved out of the range or vanished from the provider, the whole cycle rejects for separate reschedule/cancellation inspection. A returned postponed/cancelled game updates to the existing non-countable status. There are **zero deletions**. A game moved into the range keeps its existing conflict identity. This conservative missing-game gate trades automatic recovery of source removals for visible failure; it must be accepted explicitly.

Every success observes the source again and writes a truthful new `fetched_at`. `source_updated_at` remains the provider timestamp or null. No read-only consumer call, skipped cycle, prior retained response or failed validation refreshes receipt clocks. The cache upsert and final audit insert are separate operations; their acknowledgement ambiguity is preserved.

[canonical-register-activation.patch](canonical-register-activation.patch) is the separate future register diff. [canonical-entry.proposed.json](canonical-entry.proposed.json) has a null job ID because no job exists from this work; replace it with the returned real ID after an approved registration. [activation-reference.sql](activation-reference.sql) gives the exact proposed pg_cron/pg_net shape with the **secret reference only**, never a secret value. These are activation artifacts, not migrations or executed SQL. Adding the active register entry is reserved for coordinated activation, not the earlier code-only release.

## Resource envelope and operational tradeoffs

Per scheduled invocation, with no retries, concurrency one and no downstream fan-out:

| Resource | Normal 16-date range | Hard proposed bound |
| --- | --- | --- |
| NHL source requests | 3 sequential GETs | 5 for at most 31 dates; no redirects/retries |
| Decoded source body | Measured only by fixtures here | 1 MiB/page; at most 5 MiB total; 8 seconds/page |
| Database reads | 5 requests | Weeks ≤64, season ≤1, memberships ≤64, teams ≤64, existing sides ≤1000; ≤1193 returned rows total; exact counts required |
| Cache writes | 1 upsert request | ≤1000 sides, ≤1 MiB serialized rows, one statement/request; zero deletes |
| Audit writes | 1 on a write-mode attempt that reaches the handler | Existing `cron_job_audit` wrapper; inspection has none; auth/method rejections happen earlier |
| Handler deadline | No production latency measured | 90 seconds across metadata/source/cache/upsert, with abort propagation |
| Function / transport | Existing infrastructure | Existing 240-second route ceiling includes wrapper/audit; proposed pg_net timeout 120 seconds |

At two runs per day this authorizes **normally 6, at most 10 NHL GETs/day; at most 10 MiB decoded source/day; 10 DB reads/day; up to two cache upserts / 2000 sides / 2 MiB serialized cache rows per day; and two audit attempts/day**. Excluding existing reporting, that is at most 14 database requests/day (10 reads + 2 upserts + 2 audits), not 14 reads. A source page, rejected cycle or failed audit may lower those figures. Audit wrapper time lies outside the handler's 90-second timer; the complete invocation is bounded by the existing 240-second configuration, not by an invented 90-second end-to-end guarantee. Worst scheduled wall-time ceiling is 480 function-seconds/day; this is not a CPU or dollar estimate.

There are no NST requests, rolling/FORGE pipeline calls, projection recomputes, data publishes, extra health-poll jobs, builds or deployments in this work. No pricing, deployed memory tier, actual CPU, transfer billing or pg_net version was queried. Dollar cost and savings are therefore unknown. The smaller horizon reduces source calls relative to the old 24-date default *per invocation* (3 versus 4); the proposed higher cadence means 6 versus 4/day, so this is not a net request-cost saving claim.

Metadata/cache read caps and the 1 MiB upsert cap are explicit. The route response contains compact range/count/hash facts, no game/side arrays, a bounded duplicate warning and errors truncated to 1000 characters. Existing audit previews cap at 4000 characters. No general DB transport-body cap or measured memory bound is asserted. Earlier checks stop expensive work rather than truncating data to look successful.

## Failure visibility and ownership

Use the distinct recurring job name so a manual repair audit cannot count as its scheduled run. Preserve the exact method and query in the canonical register. The existing report reads that register and can flag missing expected observations; the new alias/target map connects the new audit to its cache. Do not use pg_cron's successful HTTP *submission* alone as application success.

Healthy evidence requires the correct scheduled slot, HTTP/body success, acknowledged upsert, declared range, expected row count/hash and `finalAudit.status=persisted`. A rejection must remain a failure with its reason. `writeOutcome=unknown` or failed/missing final audit is an operational incident: inspect bounded existing receipts/readback before authorizing a manual retry. No automatic retry loop is proposed. Subsequent scheduled cycles are fresh source observations under the recurring policy; the operator must hold this one job if an unresolved incident makes another cycle inappropriate.

The existing local Vercel report entry is 13:00 UTC; the canonical register also describes a 21:15 UTC report. With a 09:50/21:50 cadence, a next-day 13:00 report after two missed cycles sees roughly 27h10m since the prior successful morning observation, leaving about 8h50m before the 36-hour gate. This assumes the report and its delivery work. It is not immediate alerting, and successful delivery was **not verified** here. Before activation, assign one named owner, confirm the report actually includes both expected slots and reaches that owner, and agree to act before 36 hours. If current reporting cannot do that, activation is blocked until a separately approved monitoring solution exists; do not silently create another paid polling job.

Rollback disables/removes **only the new job**, updates its canonical entry and retains cache rows/audits. Do not disable other essential schedules or undo the guarded repair. Review the season pin and this job's active period before postseason/season rollover; do not silently switch game keys/seasons or turn a recurring rejection into success.

## Offline verification delivered

- **Passed: 21/21** checks in [offline-verification.tap](offline-verification.tap), executed by [verify-offline.cjs](verify-offline.cjs). The VM compiles the actual candidate and existing source/normalization/guard modules in memory. All provider/DB operations are synthetic, unexpected imports/readers reject, and authentication/audit integration is explicitly an adapter fixture. Cases cover the whole selected week, New York midnight rollover, extended/invalid periods, exact three-page transport, inspection, query/method/auth gates, missing dates, empty/overflow scopes, wrong identity/season/type/status, postponement, duplicate conflicts, missing cache identities, incomplete DB counts, cancellation/deadline, unknown write acknowledgement, byte caps, truthful receipt/source timestamp separation and source bindings. An additional extraction of the actual cron-report slot helpers verifies the combined-hour expression, distinct morning/night observations and rejection of an older slot as the latest required observation. Full report generation/delivery remains unverified.
- **Passed: 50/50** existing tests, two files: `__tests__/pages/api/v1/db/update-roster-optimizer-schedule.test.ts` (43) and `lib/rosterScheduleData/source.test.ts` (7). [existing-tests.log](existing-tests.log) records the actual `npm test -- --run ...` invocation from `web/`. These test unchanged application files and include the real shared operational wrapper with mocked dependencies; they do not prove production auth, source transport or audit durability.
- **Passed:** five-root candidate TypeScript check, virtual application paths, no emit or tsbuildinfo write: [candidate-typecheck.log](candidate-typecheck.log), [typecheck-candidate.cjs](typecheck-candidate.cjs). This is not a full web repository type-check.
- **Passed:** `git apply --check` for the code and register patches; no application of either patch. Relevant original-file and candidate SHA-256 bindings are in [source-bindings.json](source-bindings.json). [prepare-candidate.py](prepare-candidate.py) reproduces the patch using local files only.
- **Not run:** application-wide lint/unit suites, browser acceptance, build, deployment, live scheduler checks, real NHL calls, database queries/writes, actual report delivery or production smoke requests. No current production freshness or repair success is inferred.

The first harness run was 17/18: a fixture incorrectly expected a padded 32-day range to fit 31 days; the fixture was corrected. Candidate type-checking then found the shared wrapper's augmented request type; the new route now follows the existing route's `Parameters<typeof writer>[0]` pattern. Final results above apply to the corrected candidate.

Reproduce from repository root, without applying the patch:

```sh
node --test tasks/artifacts/schedule-refresh-recurring-2026-10-15/verify-offline.cjs
node --max-old-space-size=8192 tasks/artifacts/schedule-refresh-recurring-2026-10-15/typecheck-candidate.cjs
git apply --check tasks/artifacts/schedule-refresh-recurring-2026-10-15/implementation.patch
git apply --check tasks/artifacts/schedule-refresh-recurring-2026-10-15/canonical-register-activation.patch
```

After local integration is authorized, retain these fixtures and extend the nearest native route/source tests to run the new route against the real auth/audit wrappers, including persisted/failed final-audit receipts and same-statement write errors. That integration check is required before release; the adapter harness is not a claim of those wrapper outcomes. Existing shared tests already protect the old route. Do not use production to discover code errors.

## Remaining approval boundary

**Status: proposal complete; implementation/release/activation pending authorization, not denied and not attempted.** The current task permits only new artifacts. No request to apply, commit, push, build, deploy, register a job, retrieve a secret or write a database is implied.

1. Accept the policy choices: fixed 477/20262027 season, current/next week plus active Yahoo period/padding, 31-day/1000-side limits, missing-game rejection, two UTC slots, incident owner/report SLA and resource envelope. Authorize the five-path local implementation, then integrate and run the native wrapper tests described above.
2. Reconcile with FORGE owner **01a135c8-567b-71d2-b610-6b78f3cc40d7** before activation so the one-time repair and recurring writer cannot overlap. An ownership-only message was sent to that task for this artifact directory; no acknowledgement is claimed and its private work was not inspected.
3. Separately approve a release candidate: exact web project/environment/branch/SHA, inventory of all linked Vercel projects and build-trigger/ignore behavior, and expected build entries/cost. Reuse an appropriate existing deployment if it already contains the accepted code; otherwise any new build/deployment needs explicit approval. Current deployed project metadata is unverified. The register path itself appears in `web/vercel.json`'s ignored-build comparison, so publishing that documentation is **not assumed build-free**.
4. Separately authorize bounded read-only operational preflight: verify installed scheduler/pg_net behavior, matching existing/in-progress jobs across providers, existing secret **reference** parity, actual report matching/delivery and deployed candidate identity. This step was not authorized for this offline task. Do not query/copy secret values or duplicate an external job.
5. Only after those checks, authorize **recurring production upserts and audit writes** through the one new pg_cron POST job, using the reviewed SQL shape and real returned job ID. Publish the canonical register through the approved workflow. Verify the first **natural** run using existing job/audit records within an approved read budget; do not manually invoke ingestion for QA. Any application smoke requests need separately stated exact routes and bounds.

No active one-time repair, RSO/Start Chart forecast acceptance, provider/account validation or broader product goal is closed by this proposal.
