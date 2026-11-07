# Independent NST fix re-review — 2026-11-01

**Disposition: P1, P2 and P3 are closed for the frozen disabled local candidate. No new concrete code blocker found in this focused eleven-file delta.** This is local acceptance of the three fixes, not deployment, activation, hosted schema qualification, live provider acceptance or predictive validation.

Reviewed manifest SHA256: `cec0829dcd184e411aa508a300ea477085d8fecd946100d6ddc339c8c4ccacb3`. All67 current files, all67 new snapshots and all67 old snapshots match their respective pins at start/finish. No source swaps or source fixes. Existing custody/protected-owner receipts remain in force.

## P1 — Closed: safe invocation settlement no longer means full-queue completion

Code: `web/lib/nst/jobLifecycle.server.ts:124,133-140`; `web/pages/api/v1/db/update-nst-goalies.ts:954-967`; `web/pages/api/v1/db/update-nst-gamelog.ts:3157-3170`.

The wrapper permits an explicit per-route settlement classifier while preserving captured response, unsent headers, HTTP2xx, requiresReview, failed operation and audit vetoes. Other callers retain the strict false-success/false-retry default. The underlying active-dispatch, uncertain-context, deadline and acknowledged-finish checks in runNstJob are unchanged. A classifier cannot override them.

The goalie classifier requires the real audit wrapper's positive receipt and accepts successful complete I/O or the route's safe partial/pre-dispatch-deferral contract. Full-queue completion and source coverage remain separate. Empty/no-due return paths now explicitly identify settled success. Gamelog requires confirmed manual audit and zero unresolved source outcomes, then complete I/O or its contiguous acknowledged continuation; off-season skips remain scoped exceptions. Source/write/audit failures do not satisfy these rules.

**Independent old/current reproduction:** same real exported goalie route fixture, actual audit wrapper, real lifecycle, mocked I/O. Old source is read virtually from the pinned snapshots by a small Vite load hook; the live checkout is never replaced.

| Original case | Old code | Current code |
| --- | --- | --- |
| One-dataset completed write |503, begin→hold |200, persisted final audit, begin→finish |
| One-of-ten bounded write |503, begin→hold |207, persisted final audit, begin→finish |

Evidence: `goalie-old.log`, `goalie-current.log`, `differential-goalie.test.ts`, `vitest.differential.mts`. Two cases pass against each version, asserting the defect on old and corrected behavior on current.

The current regression run also executes the new actual-route cases for complete, partial, initial deferral, source error, malformed parse, lost output, lost provider completion and lost audit; gamelog includes bounded one-of-twenty continuation plus complete/lost-audit/unresolved-source/lost-output. Common/default veto tests and existing detached/pending admission/expiry tests pass. The audit wrapper itself remains unchanged.

## P2 — Closed: an empty queue cannot establish valid activation

Code: `supabase/migrations/20261101161622_nst_goalie_catchup_v1.sql:625-630,656-660`; preparation validation at535-539; report adapter `web/lib/nst/goalieFreshness.server.ts:25-36,63-73`.

Progress now consults preparation's validated season context. An absent/out-of-aperture bootstrap, null/future activation timestamp, ambiguous season, wrong requested season or no eligible season lacks that validated context, yielding configurationKnown=false and reviewRequired=true. Preparation's own review flag also propagates, including unresolved runner state. Disabled control remains distinguishable; off-season preparation remains not_due. Freshness already avoids an off-season progress call and renders an unknown in-season configuration as unknown rather than healthy.

The preparation function is read-only, with no provider dispatch or control mutation. Reuse adds its bounded eligible-season/bootstrap/date enumeration to progress; no recursion or write lock is introduced. The report's existing5s RPC budget remains in force. This does not measure hosted query performance.

**Original-state comparison:** the old SQL marks both bootstrap=NULL and future enabled_at as known whenever enabled_at is non-null; new SQL cannot return a matching validated season for either. Independently executing the real report adapter with these old/new receipt shapes changes complete retained allCounts coverage from healthy to unknown for both cases (`progress-receipts.log`, 2tests). This is an adapter/receipt reproduction, not independent execution of SQL.

**SQL evidence inspected:** the exact current harness assertions at `supabase/tests/nst_goalie_catchup_v1.py:294-317` and retained `review-fixes/pg-check-01/RESULT.json`. They cover five invalid bootstrap/activation settings, valid empty queue, wrong season, ambiguous season, no eligible/off-season context and disabled state; all18 PostgreSQL15.19 scenario groups are recorded PASS. Exact function definitions were restored/compared and cleanup recorded. The new migration hash is `d99730b43d2658861259e81f01c687217e161a38c293843de0192dc1fd69e291`. The SQL delta only changes progress configuration/review derivation; claim/admission/commit/grants are unchanged.

**Verification limit:** no PostgreSQL harness or migration was run by this re-review, honoring the parent no-migrations restriction. The real SQL execution evidence is the author's retained proof plus inspection of its exact assertions; old/current SQL conclusions also rely on direct control-flow review. Do not describe this as an independently rerun database test.

## P3 — Closed: CLI bootstrap precedes lifecycle begin

Code: `functions/api/fetch_team_table.py:381-382`. The only implementation delta loads the three required names before entering nst_job. HTTP authentication and optional loading order are untouched.

**Independent actual-CLI AST comparison:** `cli-differential.py/json` executes each pinned old/current __main__ body with the real lifecycle helper and synthetic environment, without env-file reads or real requests. Six assertions pass:

- Old code fails on missing configuration before bootstrap in all three fixtures, reproducing the original problem.
- Current success: bootstrap→begin→fetch/output→finish.
- Current bootstrap failure: bootstrap only; no begin.
- Current unsuccessful output: bootstrap→begin→fetch/output→hold.

The current107-test Python regression includes the new real-main AST cases and existing HTTP authorization/proxy/historical caller cases. The unchanged local loader may still no-op when no env file exists; configuration then fails closed. No local credentials were inspected.

## Checks and preservation

- **Rerun PASS:**457 JavaScript tests/17files using the existing offline verifier;107 Python tests/3files with mocked I/O;4 old/current goalie differential assertions;2 old/current progress receipt-rendering tests;6 old/current CLI AST assertions.
- **Inspected, not rerun:** scoped TypeScript/lint PASS receipts and18-group PostgreSQL proof. No full-project build/typecheck, provider call or hosted test.
- Shared heavy lock acquired atomically for each check batch, released only by its owner. Temporary reviewer tests inside web were removed. Source/candidate/prerequisite pins unchanged after verification; see `FINAL-PINS.json`. The accepted admission prerequisite remains `aefd3c20f2ff76328ef8b27e19244e438ad69a22ea1f9b5ef3cc1d6068784dce`.
- No application source changes, migrations, database actions, production/official/NST requests, schedule changes, push or deployment. No holdout access. No denied/pending/uncertain external action.

## Residual release boundaries

The separately authorized deployment inventory was read as retained evidence, including raw catalog/audit/runner/provenance receipts. It does not authorize this review to perform hosted work. Its catalog lists no admission/lifecycle/checkpoint relations/routines; serving web/Functions provenance predates this fence. Unknown external hosts, old deployment URLs and credential holders still prevent positive caller clearance. Exact paired deployment/configuration, default/object ACL/schema preflight, exact release SHA/build inventory and explicit activation approvals remain necessary.

The raw audit receipt confirms six daily report successes near13:01; inactive report234 alone is therefore not evidence of missing report execution. Actual delivery remains unverified. The raw runner receipt confirms the legacy goalie job is terminal failed after10steps with lastHTTP200 and no lease; its failure reason/cursor/data disposition still needs separate bounded reconciliation, not replay.

Keep application lifecycle and both database controls disabled until the ordered approvals and positive clearance are satisfied. Historical script semantics, independent WGO/relief-appearance completeness, all-ten-table live coverage, provider shape, throughput, canary/backfill budget and delivery qualification are not newly established by this re-review. No remaining local finding from P1/P2/P3 authorizes rollout.
