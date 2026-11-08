# L4 — primary decisions recovered; executable next adapter

2026-11-04. Current installed observation trio still matches `APP-MANIFEST.json` at the start of this pass. No application file writes in this task. Chef's requested recovery was confined to the named Claude project and the single exact-match session below; no full transcript was exported.

## Primary evidence, not planner quotation

Source: `/Users/tim/.claude/projects/-Users-tim-Code-fhfhockey-com/137b8a66-e83e-4955-b832-31d6af48d4eb.jsonl`. Session `137b8a66-e83e-4955-b832-31d6af48d4eb`.

`DECISION-RECEIPTS.json` retains only five exact AskUserQuestion inputs and their original `type=user`, `role=user`, matching `tool_use_id` responses, with line hashes, UUIDs, parent UUIDs and timestamps. Each answer's parent UUID matches its question record UUID. Repeated `api-request-blob` copies, assistant explanations, plan edits and command outputs were excluded as primary evidence.

| Decision | Question → response lines | Response UUID | Authenticated choice |
| --- | --- | --- | --- |
| D1 | 253 → 254 | `2eb0a378-ecc4-4030-9821-50b9252cdeca` | Automated page reads, storage beyond 24 hours, public display and all three products |
| D2 | 264 → 265 | `e101cef1-b85f-4f1a-ae93-dece31b4fadb` | “Scrape and upsert to supabase” |
| D3 | 269 → 270 | `82d0464a-d370-4876-b41b-bece304ac069` | Wider daily universe |
| D4 | 272 → 273 | `9a947a5b-0011-4b20-95e5-40e8bc1385c5` | VOR, raw season actuals and projected points, with ADP consideration |
| D4 follow-up | 276 → 282 | `f1d22c1a-1408-4d1f-9b8a-1852655c744d` | Weighted ADP plus plausibility guard; buy-low exception when current value/rank contradict draft value; test the ADP weight |

Responses occurred November 4, 00:08–00:19 UTC (November 3, 19:08–19:19 Eastern). The plan's “2026-11-04 pop-ups” date reflects UTC rather than the user's local calendar day.

This **closes the primary user-choice provenance gap** in earlier L4 receipts. The selected D3 option itself described all rostered NHL skaters/goalies, approximately 700, paced over a week at the same spacing; that contextual description was presented with the selected answer. Earlier L4 wording that approximately 700 was solely a planner invention was too strong. The later exact 15-minute/96-per-day budget remains a planner proposal rather than the selected option's wording. D1 authenticates TJ's reported permission; it does not inspect Yahoo's agreement or demonstrate real source access. These historical choices do not expand this task's no-provider/no-database execution bounds.

## Smallest executable next adapter

Artifact implementation: `valuationAdapter.ts`, export `leagueValuationComponents`. It reuses `scoreBoardStats` from `web/lib/projections/starterBoardScoring.ts`, with explicit existing `TradeScoring` input and a versioned league-profile identifier/origin. No ADP/VOR blend or new scoring formula is invented. Existing scorer rounds league points to four decimals.

The trusted input is the existing `GameExpectationsResponse` produced at the same cutoff by `buildGameExpectations`, downstream of existing consumer admission and contribution resolution. `admitConsumerGameRevisions` / `publicPlanningForecasts` retain authority for issued evidence; `resolvePlanningContributions` retains its policy boundary. The adapter adds no database reads and never calls admission as a fake certification step. It cannot authenticate an arbitrarily supplied response or check newly accepted news against a cached response. It requires equal response/as-of clocks, but that equality alone is not admission proof.

For each nonzero scored target it requires complete distinct next-5/10/20 game coverage, unique player identity with NHL bridge, admitted-view `totals` and `comparison` allowed-use flags, nonempty source IDs, finite counts with consistent units, ordered cutoff/issue clocks, unexpired output, and aggregate totals equal to the sum of game expectations. Unknown or unsupported inputs withhold projected points. Supplied league scoring is explicit; the adapter does not silently substitute FHFH Standard or treat unsupported categories as a scalar utility.

Output keeps projected league points separate from VOR, season actual points/rank, dated ADP, combined value and plausibility. Those other results remain unavailable with specific reasons. A qualified replacement level and slot/team-count method are not invented. No observed market bundle is an input. There is no trade fairness, roster benefit or counterparty acceptance output.

This is a **trusted-input arithmetic adapter**, not a complete valuation producer. Future installation should add league season/horizon identity assertions at its real call site and preserve real consumer admission lineage; no call site or input loader is included here. Proposed future files, ungranted: `web/lib/tradeValue/valuationComponents.ts` and `valuationComponents.test.ts`. Keep the existing observation trio frozen.

## Checks actually run

Seven synthetic checks passed by executing the artifact with existing `vite-node` and explicit alias configuration. They cover two league scoring profiles, legitimate zero, missing view/target, denied comparison, expiry, incomplete horizon, stale cutoff, inconsistent aggregates, categories/invalid weights, and unchanged unavailable downstream components. Synthetic allowed-use fields exercise the trusted-input contract; they are not proof that any real forecast was admitted.

```sh
web/node_modules/.bin/vite-node --config tasks/artifacts/six-lanes-2026-11-04/L4/valuation-check.config.mts tasks/artifacts/six-lanes-2026-11-04/L4/valuationAdapter.checks.ts
```

`VALUATION-CHECKS.json` records the actual result and two preceding harness failures: running outside the web root failed to resolve the artifact; changing the root with automatic tsconfig discovery timed out scanning an unrelated mounted directory. The final explicit alias config eliminates that discovery. No unrelated content was used. Each attempt acquired/released only L4's shared heavy lock. The final command exited 0; no full suite/build/browser/production checks ran. Vite execution transpiles TypeScript; no static typecheck or lint of this new artifact is claimed. The previously accepted installed slice's checks were reused without rerunning them.

## Selected development method and executable prerequisites

The user's component/ADP choices are authentic. Chef has selected chronological development comparisons against VOR-only, actuals-only and projected-points baselines for the later combined-value experiment. This is an engineering method choice, not a new TJ product decision, numerical weight vector or empirical qualification. The earlier question is closed; TJ does not need to invent weights.

The remaining executable prerequisites are qualified cutoff-aligned forecast/actual/rank/dated-ADP inputs; versioned league scoring, team counts, roster slots and player eligibility; an explicit replacement-universe/selection policy for VOR; and a chronological experiment specification that pins eligible development periods, normalization candidates, objective, baseline comparisons and acceptance criteria before fitting. Time ordering must exclude later outcomes from inputs and normalization fitting. Reserved evaluation data stays excluded. No experiment, empirical result, accepted normalization, fitted weights or guard threshold exists from this task. Combined values and suggestions remain unavailable until those data/method gates are met and validation supports them.

The two projected-component paths were subsequently granted and installed; see `VALUATION-APP-INTEGRATION.md`. Next work is to pin qualified development inputs and write the bounded chronological normalization/weight experiment, within a separate exact scope. No new app grant, data access, reserved-data run or empirical certification follows from the method selection. Source collection, schema, schedules, runtime wiring and combined-value publication remain separate tasks. The blocker is qualified data and an accepted executable experiment specification, not another vague approval question. L4 stops here.
