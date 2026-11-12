# Independent peer review: W1-3 rolling players

Reviewed 2026-11-11 in `/Users/tim/Code/fhfhockey.com`, `octoberBranch`, HEAD `f6cdee012b8c16d330362cb88f81435d17f975ff`. The original audit records `c093e8d79` plus its dirty tree. This is an additive review of `audits/rolling-player-averages-trends-part1.md`, not a replacement or implementation. The audit, owner decisions and application source remain unchanged.

## Verdict

**The central findings are credible and several reproduce directly, but the audit is not ready to be used verbatim as a fix specification.** Keep the rate/count reader defects, regular-season fallback unit error, page formatting/quick-view defects, zero-shot ixG omission and missing PP exposure. Correct the proposed acceptance tests and distinguish product decisions, source-code defects, observed historical rows and unverified production magnitude.

Most important additions:

1. The proposed FORGE repair and its call-up test contradict each other. Total TOI raises the evidence weight and cannot force an ordinary three-game player below the existing 0.22 threshold.
2. Current playoff code produces a correct shots/60 fallback by converting seconds to minutes first. Its TOI is wrong. Both pieces must change together; the historical playoff rows do not prove the current fallback is wrong in that same way.
3. The last-N availability behavior matches an explicit existing contract. Changing it to follow prior-team stints needs a decision; first appearance is not a safe substitute for roster eligibility.
4. “Expected shooting percentage” has **three** denominators across the relevant readers. Its SOG version is not inherently bounded by 1.
5. Existing season support pairs are not guaranteed to represent the same admitted observations as the published ratio. Do not copy that pattern uncritically into the proposed last-N repair.
6. Pruned social-share columns affect point-game streak evidence as well as hits and blocks.

## Evidence and limits

Read the W1-3 prompt, triage, packet, audit and `OWNER-DECISIONS.md`; independently followed the major producer/reader paths cited below. Used only local source, existing tests and synthetic fixtures. No DB queries, NHL/NST/Yahoo requests, application endpoint requests, writer runs, migrations, deployments, commits or pushes.

Executed five existing isolated Vitest files: **58 tests passed**. Also executed actual pure source functions through an in-memory TypeScript transpilation harness with only local module imports; inputs and numeric outputs are recorded below. The FORGE example evaluates the source equation with its actual constants, rather than running FORGE.

The audit's 108/108 newest-date rows, five-player database recomputations, 2026-03-08–04-16 truncation, provider arrival timing and historical coverage gaps were **not independently re-read**. Preserve them as dated reported observations, not a fresh production census. No full re-audit of all 60 inventory entries, historical loader code, SQL views or every consumer is claimed. This pass prioritizes consequential findings and defects in the proposed remediation.

## 1. D1 and D8: confirm the units, separate current playoffs from old rows

**Confirmed:** `web/lib/trends/playerTrendCalculator.ts:244-274` returns `shots / toi * 60` (and the analogous ixG formula). A seconds-valued regular-season input is 60 times too small. The independent fixture `shots=4, toi_per_game=1474` returns **0.1628222524**, against **9.7693351425** per 60 minutes.

**Correction:** `normalizePlayoffSkaterTrendRow`, lines 18–32, currently divides playoff TOI by 60. Running the same fixture through this adapter and then the shots accessor returns **9.7693351425**, correctly. The TOI accessor instead returns **24.5666666667**, which is minutes where downstream display expects seconds. The old stored playoff value reported by Fable, with a null calculation version, is evidence of historical corruption, not evidence that the present playoff shots fallback is still 60 times low.

Change the adapter and fallback in one unit-contract repair. Changing only `*60` to `*3600` makes current normalized playoff rates 60 times too large; changing only the adapter leaves playoff fallback rates too small.

The original test fixture is itself misleading: `web/lib/trends/playerTrendCalculator.test.ts:63-103` passes TOI `20` and expects 12 shots/60 from four shots, asserting a minutes contract. It passes today. Replace/add fixtures with real source units and both regular/postseason paths.

**Better acceptance:** exact dimensional equivalence, direct-NST/fallback parity for matching exposure, a short valid appearance, and a postseason case. Do not use the proposed `toi` range of 300–2,000 as a correctness rule: short appearances and long overtime are valid. Treat `0 < shots/60 < 1` as a diagnostic lead, not an unconditional corruption test across all game types. The error's occurrence depends on the NST rate being absent, not simply the calendar date. The reported daily recurrence is dated operational evidence.

## 2. D2 and M-ROLL-023: rate/count bug confirmed; repair must preserve matching coverage

**Confirmed:** `fetchRollingPlayerAverages.ts:2854-2880` emits the same pooled ratio under `_total_lastN` and `_avg_lastN`. `web/lib/rankings/resultsLuckSources.ts:105-123` treats three rate aliases as counts and subtracts them from season counts. `skaterWindowAggregation.ts:303-321,417-430` has the same last-N unit problem.

Independent synthetic fixture: 11 goals and 8.5 ixG in 27,600 seconds yield rate aliases 1.4347826 and 1.1086957. `buildResultsLuckRollingSourceFromRow` returns current goals-above-expected **0.326087**, not **2.5**. With season goals/ixG of 8/6, it returns baseline **1.673913**. A 17-game season combined with a last-20 window is nevertheless marked `baselineWindowExcluded=true`, `baselineSource=player_non_overlapping`, with no warnings when all fields are present. Presence is not proof of temporal exclusion (`resultsLuckSources.ts:155-165`).

**Additional correction to “season pairs are sound”:** the support writer for the simple per-60 families uses independent historical additive accumulators (`fetchRollingPlayerAverages.ts:2360-2499`), not the matched ratio component snapshot. For ixG, the numerator is accumulated only when xG exists while the denominator can include NHL-only TOI. For assists, the rate numerator uses NST only (`:1242-1246`), while the historical additive assists source can fall back to NHL. Thus a populated support pair need not reconstruct the published rate.

A source-derived counterexample: one game has 0.3 ixG and 600 seconds, a second has 600 seconds but neither NST ixG nor an ixG rate. The ratio admits only the first pair, producing **1.8 ixG/60**. Independently accumulated season support can contain **0.3 ixG and 1,200 seconds**, reconstructing **0.9**. This is a conditional source-contract counterexample, not a measured production count. M-ROLL-023 should not receive an unconditional “sound” conclusion from a small complete-coverage sample.

**Fix-plan requirements:**

- Give actual counts unambiguous names; never infer them from a `/60` alias.
- Use matching game/strength/exposure sets for goals, ixG and attempts. Merely copying separate counts does not fix missing-NST mismatches.
- Prove selected-window membership within the season, not only `season GP >= N`. Different metrics can select different observations. Reject overlapping/out-of-season or unknown baselines.
- `resultsLuckSources.ts:140-148` reconstructs on-ice season totals from averages times all season appearances. That overstates totals when the on-ice source covers fewer games. Prefer observed component totals and coverage, not total GP.
- Migrate readers before removing aliases; `rollingRankingSelectFields.ts` explicitly requests the old names.
- Even with correct counts, an absolute five-game goals-above-expected total and an absolute long-baseline total are different exposure lengths. Specify whether results luck compares a count, rate or standardized residual before considering the methodology settled.

## 3. D3: FORGE units confirmed; magnitude and acceptance need qualification

The caller passes `ev/pp.toi_seconds_avg_all` at `web/lib/projections/stages/skater-stage.ts:2149-2154`. The calculator sums them as evidence seconds (`skater-adjustments.ts:429-446`):

`weight = 0.58 × T/(T+900) + 0.42 × S/(S+45)`

The resulting weight also pulls TOI toward the career averages (`skater-stage.ts:2162-2173`). This is a real mismatch between exposure and average usage.

**Reject the proposed test “a 3-game call-up must fall below the call-up threshold.”** At 1,200 seconds/game, six total shots:

- Current average-TOI input: weight **0.3808403**.
- Proposed total-TOI input, 3,600 seconds: **0.5134118**.
- Even with zero shots, 3,600 seconds gives **0.464**, already above 0.22.

The constants are at `projection-weights.ts:83-86`. A unit correction alone makes the proposed call-up expectation less likely, not true. Select and calibrate evidence scope, exposure scale and low-sample/call-up thresholds together. A monotonicity test is appropriate; a three-game cutoff requires an explicit model decision.

The original ~0.76 cap is valid only under its illustrative `T <= 1300` range and saturated shots, not a universal mathematical maximum. Only the TOI contribution fails to grow with games; total weight can still grow through shots. “25% pull toward the prior” is not “25% lower projected TOI”: the actual change is `(1-weight) × (prior-current)`, which may be small, positive or negative. No production projection error was measured here.

## 4. D5: separate defects from the intended availability scope

Confirmed mechanisms:

- `fetchGames` has no game-type filter (`fetchRollingPlayerAverages.ts:2928-2948`). Whether all games in the denominator are eligible requires the declared numerator scope.
- A new season/team bucket starts from zero and adds its cumulative schedule count (`rollingHistoricalAverages.ts:151-178`). A synthetic switch from team counts 31 to 40 produces 71 total team games after two processed appearances.
- Ratios are clamped at 1 (`:184-186`), which can conceal missing historical denominator coverage.
- Current-team last-10 returns 1/10 for the first appearance on a team whose schedule count is 40 (`:231-272`).

**But the last point is not an established implementation violation:** `rollingPlayerAvailabilityContract.ts:99-114` explicitly calls for `current_team_last_n_team_games` in its intended replacement contract. The original audit instead proposes following the player across teams. That may be a better availability measure, but requires an owner decision and relabelling/contract changes. `OWNER-DECISIONS.md` contains no W1-3 decision that settles it.

**Do not use “first game played with the team” as the roster start without a stated limitation.** It excludes missed games before a debut or after a trade, exactly the absence a roster-availability measure may intend to count. Roster-effective dates and the snapshot cutoff are needed; if unavailable, call it an appearance-bounded proxy or return unknown rather than claiming roster availability.

A fixed 82-game ceiling is not a universal validation rule either: season lengths differ, and traded players can encounter a different number of roster-eligible games through schedule timing. Validate against the actual eligible stint ledger, plus missing/duplicate coverage checks. The original 31+27+6 example remains a useful dated fixture, not a replacement for a general eligibility contract.

## 5. D6: PP denominator defect confirmed; magnitude remains estimated

`rollingPlayerMetricMath.ts:35-52` cannot reconstruct team exposure from a 0/0 player-share pair. Actual helper invocation with player PP TOI 0 and share 0 returns **null**; with three seconds and share 0.005 it returns **600 seconds** of inferred team PP time.

The aggregate therefore omits zero-PP player games, confirming the structural finding. A team-level PP clock for every eligible dressed game is the right direction. Any reconstruction from a teammate must use a nonzero, matching game/team/source pair and account for rounding. Independently validate the PP clock rather than assuming “sound by construction” means accurate hockey exposure.

The audit correctly marks its 11.1% versus ~5.6% size as conditional on similar PP exposure in omitted games. Preserve that qualification. “Full-time PP players are right” also depends on the accuracy and consistency of their source clock.

## 6. D7, D14 and D16: keep known zeroes; reconcile all three definitions

The actual ratio helper discards a row whose denominator is zero (`rollingMetricAggregation.ts:245-254,369-374`). With pairs `(ixG=.2, SOG=2)` and `(.16,0)`, the current accumulator returns **0.1**, versus **0.18** for pooled ixG/SOG. The zero-shot game can carry ixG from missed unblocked attempts, so the finding is valid under the present SOG definition.

**Do not implement “accumulate numerator and denominator independently” as a general policy.** Keep the pairing/coverage safeguards for missing source data. A *known zero* SOG count and known ixG should contribute the ixG; an unknown SOG count must not silently become zero. Preserve final zero-denominator behavior explicitly.

There are three existing denominators:

1. Rolling `expected_sh_pct`: ixG / **shots on goal** (`fetchRollingPlayerAverages.ts:1364-1380`).
2. Trend `expected_shooting_pct`: ixG / **unblocked attempts**, times 100 (`playerTrendCalculator.ts:311-322`).
3. Rankings `expected_shooting_percentage` and SAX: ixG / **all individual attempts**, including blocked attempts (`skaterWindowAggregation.ts:391-413`; producer `fetchRollingPlayerAverages.ts:1207-1217`, using `icf`).

The owner must choose equivalence or distinct honest names. Aligning only the two tables leaves rankings inconsistent.

The SOG denominator does **not** make ixG/SOG a probability: xG from misses can exceed the SOG count. A synthetic 1.4 ixG / 1 SOG is 1.4, not invalid arithmetic. `rollingMetricScaleContract.ts` currently declares a 0–1 bound for this metric. If the SOG definition remains, distinguish representation scale from a valid domain and review that bound. A denominator/meaning change is not just multiplying by 100.

## 7. D4, D10, D11, D12 and D13: retain findings, amend remediation details

### Player page (D4)

Confirmed from `web/pages/trends/player/[playerId].tsx:523-590`: the calendar quick views read unsuffixed `row[metric.key]`; the selection builds scoped fields instead. Fractions are formatted directly with `%`, and PDO gets the same treatment. The proposed scale-contract formatter is appropriate after resolving the expected-SH domain above.

Differences of season totals are not a complete generic calendar-window repair. Pool rates from component differences, handle season boundaries and missing boundary rows, and define the cutoff. The existing L7/L14/L30 calculation is anchored to the last available game (`:542-552`), not today. Decide whether “last 7 days” means calendar recency or the seven-day span ending at the player's last game.

### Percentiles and pooled rates (D10–D11)

The game-index cohorts and arbitrary tie ordering are confirmed at `skater-power.ts:295-315,383-427` and `goalie-power.ts:216-236`. The producer is a simple mean of non-null per-game values (`playerTrendCalculator.ts:180-211`), not a pooled rate. Missing observations do not consume its window slots. Thus “Nth game” is more precisely the Nth non-null observation for that metric.

**Fix the D10 test:** equal values in the same as-of cohort should have equal **raw** mid-rank percentiles. They need not have equal displayed/stabilized scores if sample-size shrinkage is retained. The existing formula `50 + (raw-50) × min(GP/10,1)` (`skater-power.ts:317-332`) deliberately differentiates sample sizes. Test cohort/tie logic and confidence adjustment separately. Neither a particular freshness cutoff nor the goalie shrinkage strength is validated merely by matching skater code.

### Social-share pruning (D12)

Confirmed: `playerSources.ts:86-106` reads the wide table without sidecar hydration; `players.ts:254-255` consumes pruned hits/blocks averages. **Additional affected inputs:** `goals_total_all` and `assists_total_all` are also pruned and not in the keep-list. `players.ts:214-219` requires those fields on six rows before deriving `pointGames`, so compacted rows suppress that streak evidence too. Include the full recent-reader column contract in the fix, not just hits and blocks. This is missing evidence, not proof that all social output is wrong.

### Rankings exposure (D13)

Confirmed source mismatches: season `xga_per_60` uses per-game TOI as its denominator, and `resolveToiSeconds` returns that denominator as evidence seconds (`skaterWindowAggregation.ts:273-277,377-387,553-557`). The raw xGA rate can cancel per-game scaling when both averages have identical coverage; the sample-exposure field is still not total TOI. Missing coverage can also spoil the cancellation.

`playerMatrix.ts:649-668` divides cross-season last-N total TOI by `min(season GP,N)`. Retain this finding. A fix needs the selected-window appearance count, not a global substitution of N when a player has fewer observations.

## 8. Disposition of the remaining audit claims

- **D9 historical truncation:** plausible dated stored-data finding, not re-established here. A rebuild requires bounded dates/player counts, complete source history, explicit approval and a version/provenance marker. Do not treat a backwards GP count alone as proof of corruption without excluding legitimate source corrections and duplicate snapshots.
- **D15 short TOI heuristic:** independently reproduced. `normalizeWgoToiPerGame({toiPerGame:37})` returns 2,220 seconds; 67 seconds is rejected as above maximum (`rollingPlayerToiContract.ts:94-108`). Confirm the source contract and remove heuristic ambiguity, with short-game regression fixtures. This supports D1's source-unit concern.
- **D17 windows/aliases:** confirmed cross-season history selection and metric-specific slot behavior (`fetchRollingPlayerAverages.ts:3044-3050,2618-2637`; `rollingMetricAggregation.ts:263-304`). Document them, but documentation does not repair readers that subtract incompatible scopes.
- **D18 unit-share naming, D19 frozen legacy views, D20 script paging, D21 unused code, D22 validation trace:** not independently re-established in this pass. Preserve their original evidence and limits. Do not automatically approve deletion or retirement from a math audit, or infer current production usage solely from absence of a TypeScript import. Their lower-priority status is reasonable pending the owning reviews.
- The original “0 undetermined” summary overstates certainty if read as a completeness claim. Several intended definitions and production effects remain unresolved, including availability, calendar/as-of windows, expected-SH semantics and PP clock accuracy. The five-player numerical comparison does not close those questions.

## Verification receipt and next steps

Executed from `web/`:

`./node_modules/.bin/vitest --run lib/trends/playerTrendCalculator.test.ts lib/supabase/Upserts/rollingMetricAggregation.test.ts lib/supabase/Upserts/rollingHistoricalAverages.test.ts lib/supabase/Upserts/rollingPlayerToiContract.test.ts lib/supabase/Upserts/rollingPlayerPpShareContract.test.ts`

Result: **5 files / 58 tests passed**. These tests prove current assertions hold, not that the audit findings are fixed. The independent pure-function fixtures above reproduced defects despite that pass. No app-wide lint/typecheck/build was warranted or run for this document-only review.

Before implementation:

1. Decide availability eligibility/as-of scope, cross-season window contract and the three expected-SH definitions.
2. Repair producer/consumer units and matched coverage together, adding failing source-unit, missing-data, zero-denominator and cross-season fixtures.
3. Calibrate FORGE sample thresholds separately from the dimensional fix. Keep unmeasured projection-impact claims qualified.
4. Inventory exact consumers and stored writer versions before proposing bounded repair writes. Recheck current stored prevalence with authorized bounded reads; do not infer it from this static review.

No implementation or production repair is authorized or performed by this report.
