# A7–A9 local implementation handoff

**Revision 2:** the independent review's A7 consumer-query admission gap is implemented. See [R1.md](R1.md) for exact changes, 91 passing targeted tests, scoped type/lint checks, and the new fixed-hash handoff. A8/A9 remain byte-identical to their qualified accepted revision. The cumulative packet now contains 13 files; earlier receipts below are explicitly revision 1.

Implemented on `octoberBranch`, tested at HEAD `a811b0762ffe29006c3df7eaa4c19bf18deecda3`. An external documentation-only commit advanced HEAD during R1; tested and observed HEADs are recorded separately in the current manifest. This is an uncommitted local candidate, ready for independent review, not release acceptance. Existing dirty work was preserved; [packet.patch](packet.patch) contains only this worker's cumulative delta against the captured starting bytes.

## Behavior and evidence

| Finding | Before, reproduced offline | After |
| --- | --- | --- |
| A7 asymmetric missing fields | CF/CA `(10,null),(10,10)` produced 66.7%; PP `(null,5),(1,5)` produced 10%; shots `null,30` produced 15/game | Those metrics are null. Required counts/exposures must cover every supplied played row; unrelated complete metrics remain available. Unknown game exposure makes the sample unknown, while known zero-game rows are excluded and measured zeros remain zero. |
| A7 consumer propagation | Partial counts could become precise rates; aggregate-null values could become zero when ranked | Consumers display N/A/em dash for unavailable metrics and “Incomplete game sample” for unknown game exposure. Aggregate ranks are withheld if the current value or a supplied comparison value is missing; legitimate zero values remain rankable. |
| A8 incomplete pagination | One repeatedly rate-limited page still published a 100-game, 100% chart | Repeated 429, short pages, invalid metadata, or changing totals withhold every window and display an unavailable alert. Verified empty seasons remain distinct. Two attempts/request, eight concurrent pages, and local span slicing are preserved. |
| A9 obsolete request | A→B→A left A showing B's shots | Effect ownership guards success, empty results, errors, final loading updates, and follow-on page reads. Only the current key's data is returned. Equal filter values reuse the cache; hidden-tab reads stay deferred and obsolete pending reads cannot publish. |

The original three audit assertions failed before and pass after. Additional red receipts cover 8 async cases, 37 count/consumer cases, and 2 aggregate-rank cases (a real-zero ranking control passed before). Final nearest tests cover first/middle/final repeated-429 and short pages, malformed/changing metadata, retry recovery, concurrency, cached span changes, missing numerator/denominator/TOI/games, real zero values, stale success/error/empty/finally paths, filter/season changes, and hidden tabs.

## Exact source/test inventory

Six production files and seven test files changed across both revisions. Only the three marked new were created by this worker; some other listed files were already untracked before the task.

- `web/lib/stats/percentUnits.ts`
- `web/lib/stats/percentUnits.test.ts`
- `web/lib/stats/teamCountConsumers.test.tsx` — new in R1
- `web/components/GoalieShareChart/index.tsx`
- `web/components/GoalieShareChart/GoalieShareChart.pagination.test.tsx` — new
- `web/hooks/useShotData.ts`
- `web/hooks/useShotData.test.tsx` — new
- `web/components/GameStateAnalysis/GameStateAnalysis.tsx`
- `web/components/GameStateAnalysis/GameStateAnalysis.test.tsx`
- `web/components/TeamDashboard/AdvancedL10Metrics.tsx`
- `web/components/TeamDashboard/AdvancedL10Metrics.test.tsx`
- `web/components/TeamDashboard/TeamDashboard.tsx`
- `web/components/TeamDashboard/TeamDashboard.test.tsx`

The three consumer components required nullable game-count propagation. TeamDashboard additionally needed removal of aggregate-null→zero coercion in its recent-performance and ranking consumers. No FORGE or Yahoo files, shared registers, dependencies, lockfiles, generated files, migrations, or deployment settings were edited. Task bookkeeping is limited to this artifact directory and `tasks/diaries/2026-10-22-codex-a7-a9-stats.md` (not a release deliverable).

## Initial packet verification (revision 1)

Node **22.11.0**, npm **10.9.0**. All execution used the queue's isolated source-copy recipe, cleared environment with synthetic placeholders, socket/HTTP(S) denial, and unmocked-fetch denial. No tests ran in the canonical checkout. Final pinned snapshot: `/tmp/fhfh-queue-check-xtvh43r9/isolation/snapshot/web`.

| Check | Result | Receipt |
| --- | --- | --- |
| Original reproductions before | 3 failed, 5 unrelated skipped | [baseline](evidence/baseline.log) |
| Added async regressions before | 8 failed, 15 skipped | [async red](evidence/async-regressions-red.log) |
| Added A7 regressions before | 37 failed, 39 skipped | [A7 red](evidence/a7-regressions-red.log) |
| Aggregate-rank regressions before | 2 failed, 1 zero-value control passed, 27 skipped | [ranks red](evidence/aggregate-ranks-red.log) |
| Final focused tests | **111 passed across 8 files** | [final tests](evidence/final-tests.log) |
| Final original reproductions | **3 passed**, 5 unrelated skipped | [final reproductions](evidence/final-repros.log) |
| Scoped TypeScript | **Passed**, exit 0 | [configuration](tsconfig.a7-a9.json), [log](evidence/typecheck.log) |
| Focused ESLint | **Passed**, 0 errors; 2 unchanged `<img>` warnings | [lint](evidence/lint.log) |
| Packet diff/whitespace and drift | **Passed**; 12 final hashes match tested snapshot; HEAD/branch unchanged | [candidate](CANDIDATE.json) |

The first combined run had two new display-test oracle mistakes (N/A versus em dash, and a 5v5-prefixed label); they were corrected to existing UI conventions. The first scoped type check found two unsupported Testing Library `exact` options in new tests; these were removed. The final results above reflect the corrected files. No known test/type errors remain in this packet.

For independent reproduction, stage a new isolated copy using [the queue recipe](../../claude-audit-fix-queue-2026-10-22/VERIFY.md), verify its packet files against [SHA256SUMS](SHA256SUMS), and copy `tsconfig.a7-a9.json` into that copy's `web/` directory. `run-tests.sh` and `run-check.sh` accept that isolated `web/` path as their first argument. Do not point them at the canonical checkout.

```sh
sh run-tests.sh "$snapshot" \
  lib/stats/percentUnits.test.ts \
  components/TeamDashboard/AdvancedL10Metrics.test.tsx \
  components/GameStateAnalysis/GameStateAnalysis.test.tsx \
  components/TeamDashboard/TeamDashboard.test.tsx \
  components/GoalieShareChart/GoalieShareChart.test.ts \
  components/GoalieShareChart/GoalieShareChart.pagination.test.tsx \
  hooks/useShotData.test.tsx \
  __tests__/pages/stats/team/teamAbbreviation.test.tsx

sh run-tests.sh "$snapshot" \
  lib/auditEdgecases.test.ts lib/auditStatsAsync.test.tsx \
  -t 'unpaired missing count|incomplete page set|obsolete team request'

sh run-check.sh "$snapshot" npm exec --offline -- \
  tsc --noEmit --project tsconfig.a7-a9.json
```

The focused lint command was `npm exec --offline -- eslint --report-unused-disable-directives-severity warn` followed by the 12 listed source/test paths relative to `web/`, through the same `run-check.sh` wrapper. Full application suites, full-repository type checking, builds, and live browser/provider validation were not run.

## Fixed-hash handoff and limits

[CANDIDATE.json](CANDIDATE.json) records all 13 current before/after SHA-256 values, the tested base SHA and observed handoff HEAD, exact snapshot location, and check receipts. Revision 1's pinned manifest and patch are preserved under `r1/`; see [R1.md](R1.md). [SHA256SUMS](SHA256SUMS) can be checked from the canonical repository root using `shasum -a 256 -c <path-to-SHA256SUMS>`. Revalidate those hashes before acceptance; later unrelated working-tree activity is not this packet's candidate.

No implementation blocker remains. Independent acceptance is pending. An attempted consumer-scope coordination message to source thread `01a15411-3560-7632-8d31-1dd2447ba00e` returned `thread not found`; it was not delivered, not denied, and had no uncertain side effect. The delegation already expressly includes necessary affected consumers and supplied idle/no-collision evidence, so changes stayed within that assigned scope. No outside agent was contacted.

The full-window contract checks the supplied rows; it does not establish that upstream ingestion supplied every expected game/team. R1 repairs count-query admission so existing unknown-exposure rows are retained. A9's existing event/game query semantics remain unchanged apart from retiring obsolete reads; its tests verify ownership, not provider-side filtering. Aggregate rank completeness covers supplied comparison rows, not an independently established entire-league universe. No production requests, paid API tests, credential reads, commits, pushes, migrations, or deployments were performed by this worker.
