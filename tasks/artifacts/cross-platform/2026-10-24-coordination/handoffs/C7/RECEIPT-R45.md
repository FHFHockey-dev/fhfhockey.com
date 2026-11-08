# C7 review R45: `e2038b17a` (RSO bridge N2/N4, run proofs to the client) and `6c36c8e8c` (FR9/FR10 acceptance packet)

**Verdict: accept with limits.**
- **`e2038b17a`:**
  - Proofs travel **only** on the response wire; they never enter `PlanningData`, the strict transport, or any workspace or account save.
  - Flag-off output is unchanged apart from the new `runProofs` / `proofs` field.
  - N2 and N4 are correct.
  - **The new producer closure `dd6ec27d…fdae44` reproduces from the commit with 0 findings, but isn't allowlisted (release gate G1),** like R43 X1.
- **`6c36c8e8c`:** its oracles are independent of the implementation, and **both pinned defects, FR9-D1 and FR9-D2, are real**: removing `.fails` reproduces each exactly as described.

**Reviewer:** Claude C7 lane session (not the author). Read-only: no edits, no Git mutations, no `GIT_DIR`, no production reads.
- I reviewed the **commits** (`git archive` at `/private/tmp/c7-r45`: `6c36c8e8c`, `e2038b17a` and the parent `c8178b7e3`).
- Tests ran under the outbound network-deny preload with `TZ=UTC`, and with `FORGE_RESERVE_PASS_ENABLED` unset.
- **Reviewer error:** my first script failed at a doubled `web/` in one path, after the closure scans had finished. I resumed it without recreating the directory (`r45-run2.sh`).
- Evidence is in `r45-evidence/`.

## Tests

| Run | Result |
| --- | --- |
| **`6c36c8e8c`** (both commits): bridge, planning, `roster-schedule-optimizer/data`, categories packet | **223/223.** The categories packet's 2 `it.fails` cases pass, because the defects are still present. |
| **Parent** (`c8178b7e3` source, with `e2038b17a`'s tests) | **196/210.** The new N2, N4 and proof cases fail: bridge 8, planning 1, data route 5. |
| **Flag-off regression** (the **parent's** unchanged bridge tests, run against `e2038b17a`'s bridge) | **74/77.** The 3 failures are exact `toEqual` checks on the empty-result object, which now carries the new `runProofs: []`. Nothing else differs, which matches "unchanged apart from the new field". |
| **Defect controls** (the categories packet with `it.fails` changed to `it`) | **11/13.** FR9-D1: "keeps the opponent's ratio unknown when its remaining denominator is missing" fails, because the opponent's `SAVE_PERCENTAGE` is **known**. FR9-D2: "reports no scalar category score…" fails with **`expected -4 to be null`**. |
| **Closure** (the committed scanner) | `e2038b17a`: **`dd6ec27d7ac0b38615d017035c46d169379a6224518ed6fa8a2a080342fdae44`**, 194 modules, **0 findings**. The parent is `c1f0129a…` with the **same module set**; only content changed (`bridgeForecastWire.ts`). The allowlist at `e2038b17a` lists `4bf0fce7` (`538100d41`), `4c06fd9e` and `c1f0129a`, but **not `dd6ec27d`**. |

## e2038b17a

| Question | Evidence | Result |
| --- | --- | --- |
| **Do proofs ever enter `PlanningData` or a workspace save?** | No. `loadPlanningData` passes them **only** through the `onBridgeRunProofs` callback; `PlanningData` gains no field. `data.ts` and `yahoo-current-data.ts` put them on `compactBridgeForecasts(…, proofs)`, which writes `wire.proofs`, and only for runs the wire carries. The strict `encodePlanningDataTransport` is unchanged. **Client:** the only consumers of `bridgeForecasts` (`RosterScheduleOptimizer.tsx:518`, `currentPlanningRead.ts:114`) call `expandBridgeForecasts`, which rebuilds forecasts and **ignores** `proofs`. Nothing stores the raw body. `bridgeRunProofs(wire)` has no caller yet (display only), and `provider.ts` passes no proofs (as the commit says). The proof fields are run id, basis, release SHA and closure hash, so even in the `public, s-maxage=300` cached response they're non-private. | Holds |
| **Is flag-off output byte-identical apart from the new field?** | **N2** changes only `skaterState` (reserve path, flag on). **N4:** `goalie:start_unknown_team_line` is reachable only on the `p === undefined` path, which needs `inputs.reserves !== undefined`; `goalie:team_line` is gated on `inputs.reserves !== undefined`. **Wire:** reserve detection moved from "row length 9" to `isReserveLine(row[8])`, so flag-off rows (8 fields) are unaffected, and `team_line` rows are never withheld. **Measured:** the parent's bridge tests pass except the 3 `runProofs: []` deep-equals. The response wire also gains `proofs` when the bridge serves, a few hundred bytes counted inside `fitBridgeWire`'s budget. | Holds (new field only) |
| **N2** | Confirmed out gives `confirmed_out`. Then confirmed lineup gives `confirmed_lineup` (now outranking an unconfirmed scratch). Then an unconfirmed out gives `projected_scratch`, and an unconfirmed lineup gives `projected_lineup`. Within a dimension a confirmed assertion is picked first. Tested in both orders (fails on the parent). | Closes R43 N2 |
| **N4** | `teamLine = source.goalie_id !== goalie.nhlId`. Unknown start chance gives `goalie:start_unknown_team_line`; a known chance gives a `goalie:team_line` label, never withheld. Fails on the parent. | Closes R43 N4 |
| **Does `dd6ec27d` reproduce with 0 findings?** | Yes, from `e2038b17a` (and unchanged at `6c36c8e8c`, which is test-only). | Holds; **not listed** (G1) |

| # | Severity | Finding |
| --- | --- | --- |
| **G1** | **Release gate** | **`dd6ec27d` isn't allowlisted.** A release containing `e2038b17a` stamps `dd6ec27d`, so its uncaptured runs are unproven until a **commit-backed** receipt lists it (as `7b9770e4b` did for `c1f0129a`). The commit message says so; recording it here so the release candidate checks it. |
| **I1** | Info (maintainability) | **RSO client modules sit inside the FORGE producer closure:** `rosterScheduleOptimizer/currentPlanningRead.ts`, `privatePlanningRead.ts`, `yahooEligibility.ts` and `rosterScheduleData/bridgeForecastWire.ts`, all reached through an import chain from the producer roots. So an RSO-only change (as here) changes the producer identity and forces re-verification, even though it can't affect FORGE runs. Consider cutting that import edge, or rooting the closure more narrowly, so release receipts track producer code only. |

## 6c36c8e8c: FR9/FR10 packet (test-only)

- **The oracles are independent.** Expected values are computed from the fixture's own numbers, not from planner output:
  - `pooled(data, plan)` sums each assigned player's fixture forecast plus banked totals;
  - `oracleValue` and `oracleResult` re-derive ratios and win/loss/tie;
  - the literals include goals `5.5 = 4 + 2×0.5 + 2×0.25`, pooled SV% `(50+54+44)/(55+58+50)` explicitly shown to differ from the mean of rates, GAA `(5+4+6)/(120+240)×60`, and shooting % `5.5/40`.
  - The assignment set is asserted as an explicit list; `pooled` only reads which players the plan started.
- **FR10 (goalie minimum):** credited, confirmed and projected starts stay separate; "cover" versus "accept risk" nulls the matchup projection under risk; probability is never counted as an appearance; incomplete semantics are flagged. These assert existing contract behaviour.

**FR9-D1 is real.** `opponentStats` (`planning.ts:78-82`) starts from `realized` and adds only the keys **present** in `opponent.remaining`. A missing remaining component (here `SHOTS_AGAINST_GOALIE`) leaves the banked value as the full-week total, so remaining is treated as **zero** and the opponent's SV% is reported as known. The control fails as described.

**FR9-D2 is real against FR9's rule.** In category mode, `projectedValue` is the sum of +1 for a win and −1 for a loss over category results (`planning.ts:900`): an equal-weight scalar shown as "projected". It doesn't rank plans (those stay a partial order), but FR9 allows no scalar blend. The control gives `-4`, not `null`.

Both pins are appropriate `it.fails` markers: their setup is valid, and only the defect assertion fails. **Accept.**
