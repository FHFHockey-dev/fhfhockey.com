# R-OPEN — local portions inside the remaining imported parents

Bounded read-only replenishment, **2026-10-19**, Sol/high worker `/root/c_f2`; Chef xhigh. **One concrete local acceptance gap is confirmed.** It is a static Vercel-cron coverage gap in an otherwise externally gated scheduling parent. No source/test/list/register/config was written or test/route/provider/hosted operation run.

## Queue coverage and exclusions

Parsed current open imported IDs from the master before inspecting candidates. All **106 current open IDs** are already in the [prior C-RECONCILE 120-row set](../master-local/C-RECONCILE.md); no new ID is unaccounted for. Exact set subtraction removes **14 accepted closures**:

| Source-list family | IDs removed from the prior open set |
| --- | --- |
| auth-user-settings-platform | C0209, C0210, C0211, C0213 |
| rankings-post-alignment-gap-audit | C0064 |
| cron-audit-email-failures | C0067 |
| nst-api-audit-and-migration | C0047 |
| game-prediction-accuracy-improvement | C0050 |
| sko-charts | C0071 |
| rolling-player-metrics-remediation | C0032 |
| team-underlying-stats-landing-page | C0069 |
| underlying-stats-landing-page | C0041 |
| underlying-stats-power-rankings-roadmap | C0032, C0033 |

Prior classifications of those remaining106 are72 fence/collision,30 owner/provider/production and4 locally-done/receipt entries. These are a **reused screening index, not a conclusion that every local child is blocked**. This pass then read exact local acceptance wording and checked only named plausible paths.

Current [REGISTER](../REGISTER.md) and dated receipts subtract newer accepted local work within still-open parents: R-COST's reader workload/reuse, R-SCORE's complete-population/distribution fixture, R-HEALTH's latest-score-date diagnostics, R-PYTHON admission/caller coordination, and the error/telemetry/operator/policy lanes. In particular C0095/C0096 stay open externally but their new local fixtures/health source are already accepted; no duplicate implementation or additional speculative denominator/model/freshness rule is proposed.

Claude's FORGE/RSO/IFTTT/Yahoo/surface ownership, the literal schema/config/helper fences, active/review-owned files and production/provider/history/owner decisions remain exclusions. No source scan of every API or every imported parent was performed.

## Proposal 1 — cover actual Vercel cron entries in the local auth/audit inventory gate

**Parent identity:** `SRC::tasks/TASKS/cron-operations/tasks-prd-cron-audit-and-schedule-optimization.md::C0044` / NEW7.0. Its current exact acceptance explicitly calls for **“a gate that covers Vercel crons.”** The parent also requires current inventory/hosted/schedule reconciliation; those external portions stay open.

### Actual current source gap

- Both existing [audit coverage inspector](/Users/tim/Code/fhfhockey.com/web/lib/cron/cronAuditCoverage.ts:264) and [auth coverage inspector](/Users/tim/Code/fhfhockey.com/web/lib/cron/cronAuditCoverage.ts:334) accept `scheduleMarkdown` and iterate `parseCronInventoryFromMarkdown`. Neither consumes `web/vercel.json` or a Vercel cron-entry input.
- The [focused wrapper test](/Users/tim/Code/fhfhockey.com/web/__tests__/pages/api/v1/db/cron-audit-wrappers.test.ts:75) explicitly freezes the pg_cron46-route/50-job set and asserts cron-report is absent from that set. Its [Vercel check](/Users/tim/Code/fhfhockey.com/web/__tests__/pages/api/v1/db/cron-audit-wrappers.test.ts:93) only checks that the single cron-report entry exists. It does **not** enumerate or qualify the rest of the Vercel entries.
- The current fenced **read-only** [Vercel configuration](/Users/tim/Code/fhfhockey.com/web/vercel.json) has **27 configured entries and18 normalized route pathnames** (strip query parameters for file resolution while retaining the distinct configured entries). Thus successful current pg_cron and one-entry checks leave an explicit real scheduled-source gap, independently of whether hosted inventory can be observed.
- A bounded symbol readback of those18 source files found14 `adminOnly` forms and four bespoke internal secret-guard forms: `/api/internal/starter-board`, `/api/internal/yahoo-live-draft`, `/api/internal/fantrax-sync`, `/api/internal/espn-sync`. Their current code uses nonempty local-secret checks plus exact bearer/constant-time admission. The current generic auth classifier only understands `adminOnly` and one direct `token !== process.env.CRON_SECRET` pattern; a naive reuse would falsely report the four legitimate forms as unprotected. Reading a `CRON_SECRET` string/import alone must not count as verified auth.
- Eleven of the18 normalized routes visibly call `withCronJobAudit`; seven do not directly call it. That **does not establish absence of helper-owned auditing**: the provider/internal scopes require an explicit reviewed owner/mode readback. No exemption or audit requirement change is inferred. This proposal must keep unresolved audit ownership explicit rather than fabricate green coverage or force runtime edits in excluded provider routes.

### Smallest scoped implementation / checks for Chef to assign

**Candidate files only:**

1. `web/lib/cron/cronAuditCoverage.ts` — add a bounded Vercel-entry source path to the existing static inspection contract, reusing route resolution and classifications where valid. Keep configured-entry identity/query strings and normalized route identity distinct; classify only supported, reviewed admission/audit owner forms and expose unsupported/unqualified cases explicitly. Do not create a generic security analyzer or change existing pg_cron behavior.
2. Existing `web/__tests__/pages/api/v1/db/cron-audit-wrappers.test.ts` — extend current source coverage to every configured Vercel entry and its normalized route, with focused fixtures for the four actual bespoke guard forms and honest audit-owner findings. Do not replace the real auth/audit behavioral tests or rewrite the source routes.

The helper was clean at readback. The existing test contains accepted F2/Python integration edits; **Chef must reserve/reassign it before any follow-up edit**, preserving those changes. This report claims no current source ownership and does not authorize edits to active owners. If Chef keeps that file, Chef can own this two-file change directly.

**Acceptance bounds:** all27 current configured entries resolve into the18-route inventory; every actual configured path has an explicit reviewed auth classification; audit-owner qualification or unresolved status is exact, with no silent exemption. pg_cron46/50 coverage and existing real-wrapper tests retain their contracts. Shared secret values and provider code must never be imported/executed by the static inventory test. Unsupported cases remain unqualified; local classification is not proof of deployed runtime admission.

**Narrow check:** from `web/`, `npm test -- __tests__/pages/api/v1/db/cron-audit-wrappers.test.ts`; Chef handles proportionate TypeScript/lint after implementation. No test was run in this report. No new test file is needed.

**Excluded from that implementation:** `web/vercel.json` edits, any scheduler/deployment/config mutation, live inventory read, route invocation, provider calls, new audit wrappers on excluded routes, Yahoo/Patreon/FORGE changes and broad shared-auth helper refactors. This local gate/inventory improvement alone does **not** close C0044, its current hosted-inventory question, timing-floor exceptions or broader audit-owner decisions.

## Other plausible local clauses checked without making work

| Candidate / clause | Why no new proposal is made |
| --- | --- |
| C0095/C0096 score/full-run/health clauses | [R-SCORE](R-SCORE-HANDOFF.md) and final [R-HEALTH](R-HEALTH-HANDOFF.md) already contain successful local fixtures and18 independently accepted health cases. Remaining scheduler/finalizer/authoritative-membership/natural/deployed evidence is not supplied by another synthetic case. |
| ranking C0124 workload clause | [R-COST](../continuation-cost/R-COST-HANDOFF.md) already supplies the actual-reader response/workload comparison and rank-preserving reuse. Do not reopen full-cohort ranking or invent a production cost acceptance. |
| xG C0172 forbidden-feature local gate | Prior C-RECONCILE explicitly identifies both gates as implemented; bounded current named-function readback still contains the forbidden-feature checks. Serving champion disposition/registry/promotion evidence is the remaining owner boundary, not another gate implementation. |
| dashboard C0050 raw-error copy | Current `clientFetchCache.ts` already emits fixed `Request failed.` and CommandCenterShell renders stable module-unavailable copy. Claude owns that surface; no duplicate repair. |
| sustainability-model C0073 testing/docs/performance parent | Its explicit open children C0077/C0088 require genuine historical projection/actual coverage and empirical baseline evaluation. Existing harness/empty-history availability work is retained; fabricated data or extra generic tests cannot establish that actual contract. |
| forecast C0119, trends C0054, rolling C0039 and cron C0035 prior local clauses | Prior receipts already establish truthful no-model forecasts, safe paging/error boundaries, compacted-field handling and partial-write receipts. Current parent wording still contains external release/natural/history or current-owner gates; no contradictory new local source evidence was found here. No rerun or reimplementation merely for activity. |
| P8 follow-ups including Python public entrypoint | Current R-PYTHON is reviewed/accepted locally; deploy-time secret/config parity is external. F1/operator/error/telemetry/Patreon return-path work is already accepted. F2 residual callers, OAuth transactions/schema and IFTTT are explicitly excluded owners/fences; no new provider/helper mutation proposed. P8 mixed-module suspicion is not promoted into a proven bundle/key-disclosure defect. |
| Cleanup cache/untracking, owner-policy and credential cases | Git deletion/untracking, secrets, provider rotation and held product/scheduler decisions remain distinct authority gates. Accepted comments/Patreon/ESPN/Fantrax decisions are not reopened. |

No second or third proposal is manufactured after confirming this one real, narrow local acceptance gap. The106 parents remain individually governed; the prior table is not rewritten.

## Readback receipt

Created only `tasks/codex-sprint-2026-10-19/continuation-review/R-OPEN-LOCAL-PARTS.md`. Read-only parsing established120prior →106current after14accepted closures, with zero new/unmapped IDs. Current Vercel JSON parsing and bounded18-route symbol inspection are source evidence, not route execution or a complete import-closure audit. No source/master/register/test/config, hosted/provider/network, environment/secret, Git-mutating or subworker action occurred.
