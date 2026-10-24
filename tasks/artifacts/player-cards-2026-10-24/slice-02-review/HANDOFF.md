# Slice02 independent domain review

Verdict: **changes requested**, bounded to two P2 input-validity defects. Parent Scout retains acceptance/integration. No application source/test, frozen author packet, slice01 UI/TestingGrounds, or slice03 files were edited.

## Findings

1. **[P2] Validate per-game event exposure before pooling a rate.** `web/lib/player-cards/aggregation.ts:27–35,44–49` accepts each finite nonnegative field but never checks that a positive numerator has compatible exposure in that game. Two games with `(shots,TOIseconds)=(10,0),(0,600)` produce **valid SOG/60=60**, borrowing the second game's TOI for the first game's impossible shots. Through the real adapter this peer makes a valid player at SOG/60=6 rank **2 of 2, percentile25**, with `missingIncomplete=0` and full coverage true, instead of withholding the affected league rank. Reproduced in `counterexamples.cjs` probes **F01a,F01d**. Validate metric-specific row exposure before summing; preserve legitimate zero-events/zero-PP-time appearances and actual GP, and do not introduce minimum-TOI filters. This concerns source consistency, not statistical qualification.

2. **[P2] Validate each ratio row before pooling and before declaring zero-denominator data known undefined.** `aggregation.ts:44–48` checks `numerator > denominator` only after summing and after the zero-denominator early return. Thus games with `(goals,shots)=(2,1),(0,9)` become **valid SH%=20**; the same occurs for on-ice goals/shots. A single `(goals,shots)=(1,0)` becomes **undefined**, despite inconsistent counts. The adapter (`adapter.ts:64–67`) then calls that peer `knownUndefined=1`, `missingIncomplete=0`, full coverage true, and emits the other player's **1 of 1, percentile50**. Source uncertainty was converted into a known exclusion. Reproduced in probes **F01b,F01c,F02a,F02b**. Reject incompatible numerator/denominator rows as metric-specific missing before pooling; allow genuine compatible `(0,0)` rows and keep truly undefined complete values distinct. The existing author test `domain.test.ts:124–126` currently asserts the problematic positive-goals/zero-shots case is undefined and needs correction when implementation changes.

Both findings use exact typed records marked ready, matching game/source/season/strength/capture identities. They do not depend on malformed JavaScript inputs, a network service, a policy choice about short samples, or inferred full-league membership. No finding against the numeric competition/midrank convention itself.

## Independently confirmed

- Initial and final byte verification: all **22** scoped pins match EVIDENCE.json: four source files, three direct dependencies, fourteen listed author artifacts and one prior capture. EVIDENCE.json's own digest is independently recorded too. No Git used; branch/SHA not queried. S01 UI/TestingGrounds pins/review deliberately not duplicated.
- Unedited author `domain.test.ts`: **19/19** pass. Scoped TypeScript and four-file ESLint pass. Existing tools: Node22.11.0, npm10.9.0, Vitest3.2.7, Vite6.4.3, TypeScript5.7.3.
- Independent actual-source probes: **29 total;23 passed,6 failed**. Passes cover exact inclusive final timestamp and midnight cutoff, season/game-type/player filters before ownN, L5/L10/L20, calendar bounds, played/scratch/duplicate identity, history versus known-short/fullN alternatives, zero-strength official GP, pooled arithmetic, fractional xG, validzero/missing/nonfinite, missing selected-game source, metric-specific gaps, exact joins, full-population membership/unknown-coverage gates, competition ties, unrounded precision, singleton/all-tie/empty-value pools, and no hidden GP/TOI qualifier.
- Independent raw reductions from the pinned prior capture reproduce TOI6313sec, shots21, ixG1.82, iCF35; actual source returns ATOI21.043333333333333min (1262.6sec), SOG/60=11.975289086012989, ixG/60=1.0378583874544591, iCF/60=19.958815143354983. **Four values plus two unavailable controls pass.** The bounded current-season capture has10 NHL rows, with the L10 NST gap on2026-10-05. It provides neither complete-season history nor final-game proof and cannot establish a truly short L20.
- All live/premium activation remains false. The full-population/provider/history evidence fields are caller assertions at this pure boundary; validating their real contents remains a future inspected adapter's job. Singleton synthetic tests do not establish NHL population coverage.

## Exact commands and outcomes

From repository root:

```sh
node tasks/artifacts/player-cards-2026-10-24/slice-02-review/verify-pins.cjs initial
# PASSED:22/22
node tasks/artifacts/player-cards-2026-10-24/slice-02-review/run-check.cjs author-tests
# PASSED:19/19; underlying command below
node tasks/artifacts/player-cards-2026-10-24/slice-02-review/run-check.cjs types
# PASSED
node tasks/artifacts/player-cards-2026-10-24/slice-02-review/run-check.cjs lint
# PASSED
node tasks/artifacts/player-cards-2026-10-24/slice-02-review/counterexamples.cjs
# FAILED as expected against frozen source:23pass/6fail; exit1
node tasks/artifacts/player-cards-2026-10-24/slice-02-review/capture-reconciliation.cjs
# PASSED:4 values,2 unavailable controls,1 knownL10 gap; exit0
node tasks/artifacts/player-cards-2026-10-24/slice-02-review/verify-pins.cjs final
# PASSED:22/22
```

Underlying npm commands, run by `run-check.cjs` with cwd=`web/`, `npm_config_cache` confined to this review directory, update notifications/audit/fund disabled:

```sh
npm test -- --run --config ../tasks/artifacts/player-cards-2026-10-24/slice-02-review/vitest.review.config.mjs --configLoader native --no-cache lib/player-cards/domain.test.ts
npm exec --offline -- tsc --noEmit --project ../tasks/artifacts/player-cards-2026-10-24/slice-02/tsconfig.json
npm exec --offline -- eslint lib/player-cards/windows.ts lib/player-cards/aggregation.ts lib/player-cards/adapter.ts lib/player-cards/domain.test.ts
```

The author suite uses original source and original tests with an artifact-owned native ESM config: Node environment, no setup files, cache disabled, review-owned cache directory. It does **not** claim a rerun under the app's default jsdom/setup configuration. Each check has its own `.json` command/status receipt and `.log` output. Counterexample/capture scripts load the original TypeScript via the existing ts-node package; their HTTP/fetch/socket guards recorded **zero network attempts**.

One initial reviewer fixture accidentally inferred frame.playerId from a foreign row; that harness-only W02 error was corrected before the final29-probe run. Initial search/read misses and one corrected tool-version lookup were setup errors, not source findings. No source changes or repeated successful application checks followed.

## Bounds and remaining work

**Not run:** full app suite/typecheck/lint/build; browser/server/E2E; any provider/DB request; production read/write; migration/backfill; installs; Git/index; deployment; additional agents. No GIT_DIR. No production requests or remote builds/deployments.

**Blockers/approvals:** none for this review. Author corrections and a focused retest are needed before recommending slice02 acceptance. Real source completion/history/strength/definition/coverage/rights evidence and unresolved product policy approvals remain external integration gates; copies, supplied fixtures and captured arithmetic do not satisfy them. The frozen packet and source remain unchanged.
