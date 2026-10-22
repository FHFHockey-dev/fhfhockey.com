# Independent audit → local fix queue

Reconciled from **2026-10-22 03:51:47 UTC** (ending timestamp and refs in `reconciliation-end.json`) in the canonical `octoberBranch` checkout. HEAD remains `a811b0762ffe29006c3df7eaa4c19bf18deecda3`; recorded release source remains `origin/master` `248df9923cfbd00705222bb8ad9126a169bf8773` (R20). Local `master` is stale and is not a release comparison base. No fetch or production check was performed.

**This delivery creates the queue and preserves evidence only. No application fix, worker launch, commit, push, migration, deployment, production request, credential access, or contact with another agent is authorized by this turn.** Proposed assignments below are not active claims. Unknown current ownership blocks editing that slice.

## Reconciliation result

All 18 finding-related files and all **3,562 previously fingerprinted files** match the earlier audit's bytes. See [reconciliation-start.json](reconciliation-start.json) and [full-audit-source-comparison.json](full-audit-source-comparison.json). The specific defect expressions were reread in current source. The prior offline reproductions remain relevant; no unchanged application test was rerun merely to refresh its timestamp.

| Audit ID | Priority | Current disposition | Ownership / conflict |
|---|---|---|---|
| A1 target-day context | P1 | Reproducible-open, inherited; final model qualification decision-dependent | Historical FORGE audit/model lane overlaps hydration/H-B export; no current editing claim confirmed |
| A2 exact-game bridge suppressed | P2 | Reproducible-open; Q9/R17 did not cover this null-newer case | Historical Claude Q9/RSO contributors; current bridge custodian unconfirmed |
| A3 partial actuals → DNP | P2 | Reproducible-open; completeness evidence contract decision-dependent | Same ledger file as A4; one implementer required; historical S-B contributor is not a current claim |
| A4 missing coverage universe | P2 | Reproducible-open; durable denominator representation decision-dependent | Same ledger packet as A3; schema/storage change requires a separate reviewed scope |
| A5 missing actual stat → 0 | P2 | Reproducible-open | Yahoo adapter ownership unconfirmed; shares test file with A10; sequence them |
| A6 late checkpoint / kill detection | P2 | Classifier gap reproducible-open; operational frequency/guarantee unverified | Claude repair diary explicitly owns state + pipeline route; live ownership confirmation still required; route also has later Codex/NST integration |
| A7 unpaired stats samples | P2 | Reproducible-open; honest missing-sample display contract needs selection | Uncommitted Claude S01 work under load-time work; reserve existing changes until handoff |
| A8 incomplete goalie pages | P2 | Reproducible-open | Uncommitted Claude load-time slice; owner diary says awaiting review/commit, not relinquished |
| A9 stale Shot Map completion | P2 | Reproducible-open | Same load-time lane; hook/cache hunk must be preserved during repair |
| A10 provider test seam | P2 gate | Reproducible-open verification gap; stale access mocks, not a demonstrated bypass | Completed local Codex provider-sync slice awaiting integration + older Claude adapter tests; share A5 test custody |

**Already fixed:** none of A1–A10 shown by current source. **Superseded:** none. Older Q9/lease safety changes, WGO recovery, and passing subset receipts do not close these narrower cases. **Declared ongoing/retained work:** hydration/H-B export, stats S01/load-time, and the provider-access handoff. The local documents do not establish which sessions are currently running; do not label a historical author as an active owner without confirmation.

## Canonical context — link, do not replace

These A1–A10 are **audit IDs**. They are not the similarly named IDs in the master task list.

- [Master task list](../../handoff-2026-10-20/MASTER-TASKLIST-2026-10-20.md): G1 writer-before-reader gate; continuation takeover guarantee; D2 ingestion recovery; F3/F5/F7 exposure and physical-event contracts; F8 attribution; U1/U2 stats consistency. Its old release observations are historical.
- [Chef register](../../sprint-2026-10-18/CHEF-REGISTER-2026-10-19.md): cross-lane decisions and original release splits. [Streamlining register, R19/R20](../../TASKS/forge-projections/tasks-forge-projection-audit-streamlining-2026-10-21.md#r19-2026-10-21-2301z) is the newer release receipt; do not regress to a stale diary's R15/R18 summary.
- [FORGE release inventory](../forge-projection-audit-2026-10-21/forge-model-release-inventory.md) and [hydration verdict](../forge-projection-audit-2026-10-21/hydration-recon-verdict.md): distinguish released S-F-lite from pending hydration, aligned heads, physical rates and native admission. The verdict is evidence to requalify, not blanket approval.
- [FORGE audit diary](../../diaries/2026-10-21-claude-forge-projection-audit.md), especially final entry: combined `c` export still described as running; migration-88 RPC rejected by the reconstruction fence, league rescale off. No newer completion receipt was found locally.
- [Repair ownership diary](../../diaries/2026-10-21-claude-forge-pipeline-repair.md), [Claude→Codex boundary handoff](../cross-platform/2026-10-21-claude-to-codex-forge-audit-followups.md): pipeline versus NST/WGO/cron-report boundaries. Do not move ingestion work into a ledger/lease fix.
- [Stats S01 diary](../../diaries/2026-10-21-claude-stats-s01.md) and [load-time diary](../../diaries/2026-10-21-claude-stats-load-time.md): shared TeamDashboard work, distinct helpers/hook/chart changes, final local handoff still pending review.
- [Provider-sync report](../provider-sync-paywall-2026-10-21/REPORT.md), [exact changed-file inventory](../provider-sync-paywall-2026-10-21/CHANGED-FILES.json), [owner diary](../../diaries/2026-10-21-codex-provider-sync-paywall.md): completed local Codex work, no deployment. Its selected-set test receipt does not cover all changed consumers.

These documents were read, not modified. Source and handoff hashes are retained with this queue. Git authors are TJ; workflow attribution comes from handoffs, not model-name inference.

## Proposed packets and independent acceptance

Before assigning any packet, Chef records a named custodian, exact file/hunk scope, base SHA + current dirty-file hashes, an explicit handoff/no-conflict acknowledgment, and a distinct acceptance reviewer. No actual worker/model assignment has been made. Verify runtime model/effort and the `mise-en-place.md` hierarchy before later delegation; this task exposes no verified actual Chef settings.

Each `audit_test` command below runs **only in an isolated, network-blocked copy** prepared by [VERIFY.md](VERIFY.md). The independent reviewer owns new adversarial fixtures and checks the final bytes; implementer agreement or historical test counts do not constitute acceptance.

### Packet T — A1 temporal validity first

- **Proposed implementer:** current FORGE capture/query custodian, after resolving overlap with the Claude model/export lane. **Reviewer:** a separate temporal-validity reviewer; no fitting/model changes in this packet.
- **Current evidence:** `web/lib/projections/queries/skater-queries.ts:562` still uses `lte(date, cutoffDate)`; stage `:1953` passes target slate date; reconstruction `run-forge-projections.ts:578` shares it. Inherited predicate from `c1113b62ffa`; test `skater-queries.test.ts:575` blesses inclusive selection. Prior synthetic test selects target-day shots/xG=99.
- **Narrow edit scope:** `web/lib/projections/queries/skater-queries.ts` and its `.test.ts`; add at most a bounded reconstruction regression in the existing capture/replay test home if required. Stage/capture files are read dependencies, not automatically owned edits. Do not sweep hydration/H-B/model hunks into the fix.
- **Dependencies/decision:** confirm what source dates mean; this view is per-game actuals, so strictly prior dates are the proposed safe contract. A broader timestamp-availability redesign is a separate ticket. Correctness of this read is separate from qualifying any model/cohort.
- **Offline checks:** `audit_test lib/auditTemporalCutoff.test.ts`; then `audit_test lib/projections/queries/skater-queries.test.ts lib/projections/runProjectionV2.test.ts scripts/forge-reconstruction-backtest.test.ts`.
- **Independent gate:** extreme target-day actuals cannot affect admitted context; prior-day rows remain usable; empty/partial history stays unknown; capture/replay performs no network writes or provider calls. Inventory temporal assumptions of the touched read/caller. Re-score the exact final candidate from legitimate captured prior inputs offline only where possible. Do not infer that nine green regressions validate a model; no new remote capture or model release authorized.

### Packet B — A2 exact-game bridge

- **Proposed implementer:** confirmed RSO/bridge custodian; **reviewer:** separate consumer-admission reviewer.
- **Evidence:** `forgeDailyBridge.ts:373–380` still gates the exact lookup behind `stale || stats`; complete today + null-assist tomorrow yields zero rows (prior `edgecases.log`). Claude-labeled Q9 `1bc536e8b7`, R17/R20 source.
- **Scope:** `web/lib/rosterScheduleData/forgeDailyBridge.ts` and `.test.ts` only; retain existing team, h1, expiry, identity and null-head semantics.
- **Dependencies:** ownership confirmation; no need to wait for or import the pending model export. Serialize with any current bridge worker.
- **Checks:** `audit_test lib/auditEdgecases.test.ts -t 'keeps a complete exact-game forecast'`; then `audit_test lib/rosterScheduleData/forgeDailyBridge.test.ts lib/rosterScheduleOptimizer/candidatePlanMetrics.test.ts`.
- **Independent gate:** today's row keeps its exact source/values despite incomplete newer data; no fabricated tomorrow head or retargeting of the exact row; mismatched teams/expired rows still excluded.

### Packet L — A3 + A4 ledger contract, one owner

- **Proposed implementer:** confirmed S-B ledger custodian; **reviewer:** separate accounting/data-completeness reviewer. A3 and A4 must not be edited in parallel by different implementers.
- **Evidence:** `servedForecastLedger.ts:164–176` infers DNP from any class row; `:214–223` counts only emitted source rows. Settlement route `:40–48` supplies no finality/completeness proof. One unrelated actual settles a missing player as zero; two dressed players/one forecast report 100% rather than 50%. S-B `8cfaba0fc7`, R19/R20.
- **Scope:** `web/lib/player-forecasts/servedForecastLedger.ts` + `.test.ts`; `web/pages/api/v1/db/forge-served-forecast-{snapshot,settle}.ts` + their nearest tests **only as the agreed contract requires**; `web/pages/api/v1/forge/scoreboard.ts` and `web/tests/api/forge-scoreboard.test.ts` for denominator transport. No ingestion routes, migration files, crons or schedules in this packet.
- **Dependencies/decisions:** choose authoritative finality/completeness evidence for absence and a durable independent identified-player universe. If unavailable, missing actuals must remain unknown. Agree the smallest representation before editing; a schema change needs a separately scoped local proposal and operational permission before application. Canonical D2 ingestion recovery is related evidence, not proof that this ledger may assume all rows are complete.
- **Checks:** `audit_test lib/auditEdgecases.test.ts -t 'unrelated actual row|coverage includes'`; then `audit_test lib/player-forecasts/servedForecastLedger.test.ts __tests__/pages/api/v1/db/forge-served-forecast-snapshot.test.ts __tests__/pages/api/v1/db/forge-served-forecast-settle.test.ts tests/api/forge-scoreboard.test.ts`.
- **Independent A3 gate:** partial/late/live/unverified actuals do not become DNP; known actuals can settle without inventing missing outputs; verified DNP is zero; replay/correction remains idempotent by player-game, including a missing player's later arrival.
- **Independent A4 gate:** no-forecast/no-history debut still enters the independently established dressed denominator; two dressed/one covered = 0.5; no double count across sources; zero and unknown denominator remain distinct. Per-source pooled MAE must not be represented as a paired model trial.

### Packet Y — A5 actual points; reserve shared test custody for A10

- **Proposed implementer:** confirmed Yahoo RSO adapter custodian (not identified by the audit diary); **reviewer:** separate scoring reviewer. Parent must resolve custody of `rosterPlanning.test.ts` before A5 or A10 edits.
- **Evidence:** `rosterPlanning.ts:79–82` still converts null weighted fields to zero. Synthetic GOALS=2/HITS=null at weights 1/1 returns 2. Claude-labeled R14 slice, same in R20.
- **Scope:** only `yahooPastLineupPoints` in `web/lib/integrations/yahoo/rosterPlanning.ts` and the corresponding block of `.test.ts`; preserve the provider/paywall lane's unrelated code.
- **Dependencies:** no new provider request or scoring policy; retain existing league weights. Verify the adapter's separate DNP assumption alongside Packet L, without copying a completeness shortcut into this fix.
- **Checks:** `audit_test lib/auditEdgecases.test.ts -t 'missing weighted actual stat'`; then `audit_test lib/integrations/yahoo/rosterPlanning.test.ts -t 'Actual fantasy points on recorded past lineups'`.
- **Independent gate:** missing/null/blank nonzero-weight stats are unknown, legitimate numeric zero remains zero, zero-weight missing heads do not invalidate a score, nonfinal/no-game stays unknown. Fixing this conversion does not certify ingestion completeness.

### Packet P — A6 lease classification

- **Proposed implementer:** current pipeline continuation custodian, reconcile the explicit Claude repair claim and Codex/NST edits first; **reviewer:** separate lease/continuation reviewer.
- **Evidence:** `rollingForgePipelineRunState.ts:72–80` still infers handoff from remaining lease span. +215s checkpoint / +270s expiry / +301s check yields `dead=false`; fixed-expiry checkpoints remain at pipeline `:1382–1388,1412`. R12 repair `afa8cac9ba`, same in R20.
- **Scope:** `web/lib/rollingForgePipelineRunState.ts`; nearest existing `web/__tests__/pages/api/v1/db/run-rolling-forge-pipeline.test.ts`; route `run-rolling-forge-pipeline.ts` only if necessary for explicit handoff state. Do not touch NST/WGO producers, cron-report, schedules or generic projection takeover guarantees.
- **Dependencies/decision:** specify the promised killed-holder guarantee versus deliberate handoff, without broadening canonical quiescent-only recovery. Check whether required durable state can use the current contract; schema/RPC expansion is a separate proposal. Concurrent kill deduplication is an acceptance risk to inspect, not permission for a broad refactor.
- **Checks:** `audit_test lib/auditEdgecases.test.ts -t 'late durable checkpoint'`; then `audit_test __tests__/pages/api/v1/db/run-rolling-forge-pipeline.test.ts`.
- **Independent gate:** late in-flight expiry counts correctly; deliberate short handoff and live lease do not count as killed; cursor is preserved; retry cap remains truthful. Add a route-level late-checkpoint/kill fixture, not just a classifier assertion. Explicitly report any concurrency guarantee not established offline.

### Packet S — A7–A9, retain original stats work

**Proposed custodians:** existing Claude S01 owner for A7, load-time owner for A8/A9; confirm whether these are the same person/session. **Reviewer:** independent stats/data-contract reviewer. TeamDashboard is shared by both diaries and is excluded from edits unless those owners agree a required hunk.

- **A7 scope/evidence:** `web/lib/stats/percentUnits.ts` + `.test.ts`; independent nullable sums at `:39–48`, aggregate paths `:105–136,161–205`. `(null,5),(1,5)` becomes 10% PP; one missing shots game becomes half the observed rate. **Decision:** recommended safe full-season contract is unknown when needed exposure/counts are incomplete; a paired observed-sample alternative must disclose its sample rather than present full-season totals. No estimator tuning. **Checks:** `audit_test lib/auditEdgecases.test.ts -t 'unpaired missing count'`; then `audit_test lib/stats/percentUnits.test.ts components/TeamDashboard/AdvancedL10Metrics.test.tsx components/GameStateAnalysis/GameStateAnalysis.test.tsx components/TeamDashboard/TeamDashboard.test.tsx`. **Gate:** asymmetric missing numerator/denominator/TOI/games never combine unrelated samples; valid zeros remain zeros; consumers honestly render the agreed unknown/partial state.
- **A8 scope/evidence:** `web/components/GoalieShareChart/index.tsx` + nearest `GoalieShareChart.test.ts` (or agreed new component test); null 429 page becomes empty at `:252–258`, remainder published at `:273`. **Decision:** withhold affected windows or explicitly label partial data; no extra real requests. **Checks:** `audit_test lib/auditStatsAsync.test.tsx -t 'incomplete page set'`; then `audit_test components/GoalieShareChart/GoalieShareChart.test.ts`. **Gate:** first/middle/final failed page cannot yield an apparently complete season/L10 window; bounded retries/concurrency retained; span clicks do not refetch. Existing pure aggregation tests alone cannot accept pagination behavior.
- **A9 scope/evidence:** `web/hooks/useShotData.ts` + agreed new `web/hooks/useShotData.test.tsx` (currently absent); cache skip `:72`, unowned completion `:249–256`. A→B→A returns B shots on visible A. **Checks:** `audit_test lib/auditStatsAsync.test.tsx -t 'obsolete team request'`; then `audit_test hooks/useShotData.test.tsx __tests__/pages/stats/team/teamAbbreviation.test.tsx` once the planned test exists. **Gate:** stale success/error/finally never replaces current team/filter/loading state; hidden-tab reads stay deferred; returning to a valid cached key remains correct. Do not remove lazy loading to make the race disappear.

A7 precedes any required consumer display adjustment. A8/A9 have disjoint intended files and could run independently **only after exact claims are confirmed**. No broad stats rewrite or repeated live performance timing belongs here.

### Packet G — A10 provider test seam, after Y releases shared test file

- **Proposed implementer:** existing Codex provider-sync maintainer together with the agreed Yahoo test custodian; one writer for `rosterPlanning.test.ts`. **Reviewer:** independent access-boundary reviewer.
- **Evidence:** local `provider.ts:15` calls `requireProviderSyncAccess`; test mock at `rosterPlanning.test.ts:37` returns capabilities without `eligible` and lacks a Draft Pro fallback mock. Assertions `:517,529,541,548` still fail 503 vs 429/502/403 and false success. Existing central paywall/access suites passed. This is a mixed-ownership integration/test-contract gap, not a demonstrated security bypass or a reason to relax the guard.
- **Scope:** test setup and provider-route assertions in `web/lib/integrations/yahoo/rosterPlanning.test.ts`; provider gate modules are read dependencies. Application guard edits require a separately demonstrated defect and owner handoff.
- **Dependencies:** Packet Y shared-test handoff; preserve both verified in-season and Draft Pro access rules and private error handling. No billing re-audit, policies or credentials.
- **Checks:** `audit_test lib/integrations/yahoo/rosterPlanning.test.ts -t 'provider snapshot route'`; then `audit_test lib/integrations/yahoo/rosterPlanning.test.ts lib/integrations/providerSyncAccess.test.ts lib/integrations/providerSyncPaywall.test.ts`.
- **Independent gate:** allowed caller demonstrably reaches the adapter and forwards only authenticated user ID; denied/outage caller never reaches provider/credential reads; curated 429/502 and generic private-safe 503 assertions are actually reached. Do not delete assertions or mock the whole route/guard into an unconditional pass.

## Execution sequence and stopping rules

1. **Claim gate:** parent resolves exact owners/handoff and dirty-hunk custody; no applications edits while unknown. This queue itself contacts nobody and launches nobody.
2. **T first:** correct/accept the temporal contract before any further model qualification. Existing backtest verdicts remain historical. T can be bounded separately from physical-event/model tuning.
3. **B, then L and Y:** prioritize consumer/ledger truth. B and L have disjoint intended code, but an existing common owner decides whether to serialize. L's two findings stay together. Y reserves the shared adapter test file until its handoff.
4. **P:** repair/verify the narrow lease guarantee; preserve later source-down integration. No production retry as QA.
5. **S:** A7, then disjoint A8/A9 after confirmed claims; preserve existing performance improvements and unrelated stats hunks.
6. **G:** correct the provider test seam after Y, then independently check the combined adapter/access boundary.
7. **Acceptance:** each reviewer records exact candidate SHA + dirty-file hashes before/after, observed red→green evidence, nearest regression results, and remaining limits. Run focused lint/type checks once the actual TS change warrants them; do not run builds or full suites for this queue. Any new failures are diagnosed, not suppressed. Stop on unexplained drift/conflict.
8. **Later final-candidate pass:** parent integrates accepted hunks, pins the complete candidate and independently reviews cross-boundary behavior. No blanket model or release qualification follows from packet tests. Publishing, migrations, data repairs and operational work remain separate authorizations.

## Evidence and completion

[REPORT.md](REPORT.md) and [COMMANDS.md](COMMANDS.md) are byte-preserved originals; their `/tmp` paths are historical. [VERIFY.md](VERIFY.md) provides portable offline setup/current verification commands. [evidence-manifest.json](evidence-manifest.json) hashes 21 preserved report/receipt/reproduction files. Evidence contains synthetic fixtures and code-level findings only; no private capture, account data, credentials or `.env` files were copied.

Original report SHA-256: `bc213e1f0f60820e40e72dee91b5db95880b3a15344edcf7c7e33a2831a75965`. Original existing-test result: 1,094 pass / 4 fail / 1 skip across 29 files; nine additional synthetic assertions fail. These are prior receipts, not fresh runs in this reconciliation turn.

**Queue/document task:** complete after final integrity/drift check. **Application implementation:** not started. **Editing blockers:** current file claims for every packet; contract decisions in T/L/P/S as specified. **External actions:** none denied, pending or uncertain; none attempted in this queue turn. Library delivery failure belongs to the earlier audit delivery and is not a blocker to this durable local queue.
