# Independent bounded optimizer review

Reviewed the four optimizer files against their supplied `.before` copies on `octoberBranch`. Read Audit1's synthetic fixture and checklist sections 2.1–2.4 as leads. No source files changed; no private outcomes, production services, broad suites, or other owners' increments inspected.

**Decision: no blocking correctness finding in this increment.** This accepts the bounded synthetic repair, not full checklist completion or production readiness.

- `planning.ts:515–525,755–766`: required-player coverage includes original roster members even after a proposed drop, missing player records, and action participants. Unknown team membership or a non-complete schedule nulls projected value and prevents comparison/recommendation eligibility. The original false +10 path cannot certify a numeric points gain through the reviewed candidate metrics path. Unknown participation also remains non-comparable through existing forecast permissions. Schedule AGP can remain numeric for unknown participation because it counts lineup opportunities, not expected appearances.
- `candidatePlanMetrics.ts:68–85,95–110`: horizon-value ranking replaces ID-only shortlist ordering; low baseline assigned contribution receives earlier drop exploration. This is a heuristic. It does not exhaust marginal lineup impact or guarantee the best candidate/drop across arbitrary positions, locks, reserve prerequisites, dates, waivers, or categories. The result retains explicit shortlist/proposal/evaluation limits and `complete=false` when truncated.
- Exactly 40 candidates and the stronger 41st are separate regressions (`candidatePlanMetrics.test.ts:75–100`). The default 160-evaluation case finds +9 by dropping player 3 for every returned candidate, against an independently computed baseline of 191. It does not depend on admitting a 41st candidate. Two baseline evaluations plus the first round of 40 × two objectives already reach all first drop choices; the loss ordering makes player 3 that first choice. The 41-candidate fixture independently admits player 140 and returns +999, while reporting 40/41 coverage and an excluded candidate.
- `exhaustiveDayPoints` (`candidatePlanMetrics.test.ts:54–72`) is independent of production optimizer, ledger, eligibility helpers, and production scoring functions. It enumerates injective assignments, includes leaving slots empty, applies fixture weights directly, and enumerates all single drops externally. The dual-position/negative-score fixture adds useful coverage beyond identical C slots. Its independence is sufficient for these single-day, unconditional, exact-position, unconstrained fixtures. It is **not an independent transaction-legality oracle**: it does not validate acquisition timing, budgets, locks, reserves, weekly semantics, ratios, or forecast admission. Do not describe it as proof of those dimensions.

Meaningful remaining regression opportunities (non-blocking for this bounded repair): explicitly assert 40 returned candidates and 40 eligible candidates in the +9 test, and nonempty retained plans in each unknown-coverage test, preventing vacuous loops from hiding future admission regressions. A timed multi-day fixture with differing position scarcity would be necessary before claiming the drop heuristic repairs those broader cases. A fixture where the unknown owned member itself is explicitly dropped would directly preserve the original coverage-basis bug, although the reviewed source already retains that member.

The evaluator consumes the schedule completeness declaration; these four files do not establish that the loader has earned it. Thus this review does not close checklist 2.6, real-feed readback, categories, release, model quality, global optimality, or whole-pool coverage. No unsupported confidence claim was found in the new source comments or test names; broader delivery claims need these limitations.

Verification independently run from `web/`:

`npm test -- --run lib/rosterScheduleOptimizer/planning.test.ts lib/rosterScheduleOptimizer/candidatePlanMetrics.test.ts`

**Passed: 2 files, 156 tests (113 planning + 43 candidate metrics), 4.02 seconds.** No browser, remote, full build, or full-suite claim.

Reviewed SHA-256 pins:

```text
862094beee25015fc650e5462449a398f6cc79f07f594201aa8f65cc27717f78 planning.ts
f09c08a671c64f1e5d541c070523219dd52457ef2587fae69c112310cfedb616 candidatePlanMetrics.ts
c935008e78f3596c63531f22dafd03945cb0129f42044642c1abe0e342832f26 planning.test.ts
5b36ea13eca9e715edf143c254f24dd287dafd1c4a7b02de44de368d19b70437 candidatePlanMetrics.test.ts
```
