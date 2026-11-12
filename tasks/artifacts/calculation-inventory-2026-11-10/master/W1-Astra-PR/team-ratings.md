# Independent peer review: W1-4 team ratings, CTPI and SOS

Reviewed 2026-11-11 on Tim's Mac, canonical checkout `/Users/tim/Code/fhfhockey.com`, branch `octoberBranch`, HEAD `f6cdee012b8c16d330362cb88f81435d17f975ff`.

This is an **addendum**, not a replacement for [Fable's audit](../audits/team-ratings-power-ctpi-sos.md). Sources include the W1-4 prompt and packet, TRIAGE section W1-4, OWNER-DECISIONS, and the primary implementation cited below. Original audit files were not edited. No application code, database, provider, deployment, or Git publication action was taken.

## Assessment

**The main rating defects are credible and remain actionable. The fix recommendations need corrections before implementation.** Local source confirms slate-only standardization, last-row special-team tiers, missing source-grain/season filters, all-history legacy goal inputs, and the Top Adds object-to-number failure. Offline executions of the actual pure functions reproduce additional problems the audit missed.

Most important corrections:

1. **Fixing games-played does not restore headline-rating shrinkage.** A second standardization cancels a common early-season shrink factor.
2. **CTPI v2 is not a fully vetted replacement.** Its special-team rates still average per-game rates, and its high-confidence status can come from only one measured game among ten rows.
3. **The proposed SOS helper does not enforce final-only past fixtures.** It selects by scheduled start time, despite D7 recommending it as the correct implementation.
4. **Several acceptance tests are mathematically wrong as stated.** League-relative scores may change when other teams improve; tied percentiles cannot always produce equal-sized tiers.
5. **D1's headline rank changes are a joint D1+D2 counterfactual, not an isolated estimate of the slate defect.** Exact production magnitudes remain Fable's reported evidence, not independently reproduced here.

This review does not certify all 56 entries or issue replacement totals. In particular, M-TEAM-015 and M-TEAM-027 should not retain an unqualified “sound” conclusion for the proposed replacements. The brief's requirement for **approved** intended definitions is still open: the owner questions in the original audit have not been answered by the inspected OWNER-DECISIONS file.

## Corrections and additions

### PR-T1 · Early-season shrinkage is canceled by final standardization

**New confirmed omission; P1 methodology, relevant to D2 and M-TEAM-020/021.**

`web/lib/power-ratings.ts:510-521` blends each metric toward the league mean with `w = min(1, gp_to_date / 10)`. For common positive `w`, the resulting z-score is `w × original_z`. The weighted offense/defense composites are therefore also multiplied by `w` (`:581-590`). But `calculateRawDistribution` recomputes their mean and sample SD (`:604-627`), and `calculateFinalRating` divides by that new SD (`:652-670`). The factor cancels exactly. Pace has the same issue.

**Executed fixture:** 32 synthetic teams, otherwise identical data, all at GP=1 versus all at GP=10. Maximum offense-rating difference was `7.11e-14`; both returned extreme ratings **75.2154 and 124.7846**. The stored raw xGF rate did shrink (team 0: 2.6975 versus 2.0), confirming this is cancellation downstream, not failure to execute the blend. With unequal GP the factor changes relative scores, but does not guarantee every score moves toward 100.

**Correction to D2:** filtering `gp=1`, applying the chosen season boundary, and fixing `gp_to_date` are necessary but insufficient. Decide whether the headline is a relative rank scale with fixed daily SD, or an uncertainty-shrunk strength estimate. If the latter, use a fixed/reference distribution or apply shrinkage after the final normalization, with an approved prior. Do not demand SD=15 every day and simultaneous shrinking of the whole early-season league toward 100.

**Test:** run the complete pipeline, not only `calculateZScores`, on the same rates with GP=1/3/10. Assert the chosen headline-rating behavior and raw-rate behavior separately.

### PR-T2 · CTPI v2 retains the special-team rate aggregation problem

**Correction to M-TEAM-015 “Sound (design)” and D8's “adopt the v2 candidate”; P1 before publication, currently dormant.**

`web/lib/trends/recentTeamFormV2.ts:140-157` names its helper `weightedRatio`, but it computes a weighted **mean of per-game ratios**. It is not a ratio of weighted totals. PP and PK use it at `:194-195`. V1 has the equivalent structure in `web/lib/trends/ctpi.ts:151-162,191-192`.

**Executed fixture:** newest game 1 xGF in 60 PP seconds; previous game 1 xGF in 600 PP seconds. With the actual 1.0/0.9 recency weights:

- Current v2 result: `(60 + 0.9 × 6) / 1.9 = 34.4211 xGF/60`.
- Recency- and exposure-pooled result: `3600 × (1 + 0.9) / (60 + 0.9 × 600) = 11.4 xGF/60`.

Equal-game averaging can be a deliberate estimand, but then it must be named and justified consistently. It does not satisfy D8's own recommendation to pool PP/PK rates by ice time. Under that proposed contract, v2 is not a drop-in fix.

**Test:** unequal-duration PP/PK games, zero exposure, and missing numerators/denominators. Calculate `3600 × Σ(w × xG) / Σ(w × TOI)` using the same valid observations in both sums if that is the approved definition.

### PR-T3 · CTPI v2's confidence ignores per-metric observation counts

**New qualification of M-TEAM-015; P1 before publication, currently dormant.**

The candidate records each metric's observation count (`recentTeamFormV2.ts:255-266`), but score readiness uses the number of source game rows (`:407-408`) and confidence uses `recentGameFraction × metricWeightCoverage` (`:409-418`). Metric coverage means whether a finite aggregate exists, not how many games support it. `effectiveRecentGames` also does not control this confidence value.

**Executed fixture:** each of 32 teams has ten valid `gp=1` rows, but only the newest row has any measured scoring, shot, PP/PK, TOI, or PDO values. Every metric observation count is 1. V2 nevertheless returns **status=`ready`, confidence tier=`high`, confidence≈1.0, recentGameCount=10**.

**Recommendation:** distinguish row count, component availability, and actual measured exposure. Set per-metric minimum evidence and/or effective weighted sample-size requirements. Report this confidence as heuristic coverage until calibrated; it is not a probability of correctness. Require sparse-observation tests before calling v2 validated or production-ready.

### PR-T4 · SOS research contract does not satisfy D7's final-only rule

**Correction to M-TEAM-027 “Sound” and D7's proposed replacement; P1 before reuse.**

The helper correctly filters **record-building results** by completion and knowledge time at `web/lib/trends/strengthOfScheduleContract.ts:86-116`. However, it selects the focal team's past fixtures using only `startsAt < cutoff` at `:118-123`; it never requires a completed, known result for the selected fixture.

**Executed fixture:** A–B starts at 17:00, evaluation cutoff is 18:00, and A–B has no result. B has a prior completed win over C. `past-retrospective` returns **fixtures=1, direct=1**, counting A–B as past while it is unfinished. A postponed fixture retaining its old start time has the same class of problem.

This may be an intentional “scheduled-before-cutoff” contract, but then D7 must not call it an implementation of “past means final.” Add a completed/known result requirement for past selection if final-only is the intended contract, and define an in-progress/overdue category rather than silently losing such games from both past and future views.

**Tests:** started but unfinished, postponed, completed but result not known at cutoff, and a completed-known control. Existing strict information cutoffs should be preserved.

The helper is an explicit repository research definition. “Matches RPI” is too broad without stating its equal-meeting weighting, head-to-head exclusions, information cutoffs, and missing-record policy. Simple opponent-WP SOS without an indirect term is not inherently mathematically wrong; its suitability depends on the owner-approved definition and label.

### PR-T5 · Repair the proposed tests and effect attribution

**Corrections to D1, D3 and D6.**

- **D1/D6 invariance:** a team's league-relative rating can legitimately change when other teams' measured strength changes, even if its own inputs stay constant. Correct invariance test: freeze *all 32 teams' input histories* and vary only the arbitrary slate-membership mask; output must be unchanged. Separately test that changing opponents' genuine data is allowed to move relative ratings.
- **SD:** the current implementation uses sample SD (`power-ratings.ts:410-413,609-612`). Specify this convention and allow all-equal/zero-variance inputs to return 100, rather than requiring SD=15 in every fixture. Do not combine fixed SD with the shrinkage acceptance criterion from PR-T1 without reconciling them.
- **D3 equal-sized tiers:** with ties at cut points, equal values should receive equal tiers, which can yield groups larger than 12. The proposed 10–12-per-tier assertion is appropriate only for a distinct-value fixture or an explicitly approved tie-breaking policy. A 10% PP does not necessarily imply Tier 3 without specifying the peer distribution.
- **D1 magnitude:** the original audit explicitly says its “league-wide” replay both removes cumulative rows **and** changes the standardization population. Label 9 teams moving ≥5 offense ranks, EDM/NYI movements, and RMS 6.2 as the combined intervention. Isolating D1 needs a four-way comparison: original; source-grain fix only; common-population fix only; both. The sample is also one date, not a measured long-run error distribution.
- “11 of 32 is chance” is a loose agreement comparison, not proof of predictive uselessness. A chance-adjusted tier-agreement claim requires the tier marginals and a specified null model.

### PR-T6 · Keep discretionary model choices separate from proven defects

**Context for D4, D8 and D9.**

- A linear index's weights summing to 1.10 is **not intrinsically invalid mathematics**. In v1 (`ctpi.ts:301-321`) it changes scale relative to a convex-weight interpretation. The unbounded `50 + 15 × raw` contradicts a guaranteed 0–100 label; that is the stronger specification finding. Dividing all weights by 1.10 changes dispersion but not rank. Removing PDO is a separate model change.
- PDO regression toward the mean does not by itself prove that PDO contains zero predictive signal at all sample sizes. Correlation with another component indicates overlap, not automatically an invalid composite. Keeping PDO as context is defensible, but holdout validation and the intended descriptive/predictive use should justify removal and replacement coefficients.
- Pace in a team-strength score and missing home ice in a displayed home-minus-away *rating difference* require product-definition decisions. They are concerning for a claim of win probability or team quality, but absence from Elo/SRS is not alone a proof that the arithmetic is wrong. The null-to-zero failure and the two inconsistent power-score definitions are concrete source facts (`teamContext.ts:34-39`; `teamRatingsTrend.ts:48-53`).
- Owner decision 7 already requires exclusion and separate reporting of empty-net shots in the specified xG totals. D9's “relabel **or** exclude” must not let relabeling substitute for that contract. Verify the xGA and GA populations together before calling their difference goaltending/GSAx. This review did not measure empty-net exposure.

### PR-T7 · Additional implementation constraints for the fix plan

- **Null tiers:** `fetchWgoStats` converts null PP/PK percentages to numeric zero via `Number` (`power-ratings.ts:735-736`). Changing only the writer's missing-tier branch cannot restore missing-data semantics. Fix null normalization at the adapter as well as the tiering and display consumers.
- **V2 publication:** trust requires both `approved` **and exact v1 formula/input versions** (`ctpi.ts:8-18`). V2's identifiers differ (`recentTeamFormV2.ts:3-6`). A future validated v2 needs an explicit compatible reader/version migration, not merely toggling publication status.
- **As-of is not knowledge-time proof:** M-TEAM-055's query prevents selecting a *later-dated* row (`teamRatingsService.ts:223-256`), but it does not prove that a backfilled/revised row was available at that historical instant. Keep the sound date-selection claim; qualify “no look-ahead” for historical model evaluation unless immutable generation/source-availability evidence is checked.
- **Start Chart exposure:** it ranks `components.xga60` (`start-chart.ts:715-725`), but persisted xGA is the blended value from `calculateZScores`, not universally the raw EWMA (`power-ratings.ts:518,673-674`). Under the reported GP inflation, blend weight is 1; after correcting GP, early-season Start Chart exposure also depends on the prior and reference population. “D2 only” is not a permanent invariant.

## Disposition of original findings

“Confirmed” here means source logic and, where noted, an offline fixture; it does not mean current production prevalence was remeasured.

| Finding | Peer-review disposition |
|---|---|
| D1 slate normalization | **Confirmed.** `calculateEwma` drops idle teams at `power-ratings.ts:328-330`; writer standardizes returned metrics at `update-team-power-ratings.ts:195-222`, then copies earlier ratings at `:325-354`. Amend tests and attribution under PR-T5. |
| D2 cumulative rows / GP / seasons | **Confirmed missing safeguards.** Queries filter date/situation but not GP or season at `power-ratings.ts:136-158`; writer GP is row count at `update-team-power-ratings.ts:183-190`. Exact contaminated-row counts/weights were not remeasured. Add PR-T1. |
| D3 PP/PK last row | **Confirmed selection logic.** Writer keeps the last dated row at `:248-259`, tiers it at `:270-314`; landing context also takes first/latest row at `teamSpecialTeamsContext.ts:97-108`. Last-game source-grain counts remain original-audit evidence. Add null/tie constraints. |
| D4 Power Score | **Confirm arithmetic and null behavior; keep meaning as owner decision.** `teamContext.ts:34-39,65-66`; see PR-T6. No independent validation of the proposed replacement weights. |
| D5 legacy Game Grid goals | **Confirmed source chain.** Baseline SQL `:15206-15246` has no season/date/grain filter; per-game division follows at `:15253+`; attack/defense ratios at `:16318,16322`; `gameGoalProjections/calculations.ts:167-186` uses them; `GameGrid/PDHC/PoissonHeatMap.tsx:130-168` reads expected goals. Current catalog definitions, running cron status and exact production weights were not rechecked. |
| D6 trend/PDO | **Confirmed mismatch mechanism.** History is rebuilt by slate (`teamRatingsTrend.ts:102-118,157-174`), then differenced (`:268-279`); missing PDO maps to 100 (`:287-293`). A common-date relative trend is useful, but not guaranteed zero when other teams change. |
| D7 SOS | **Confirmed live source problems.** Writer uses date rather than final state and sums full opponent records (`update-team-sos.ts:268-287`); landing future indirect term selects opponent future buckets (`teamScheduleStrength.ts:211-229`). Replacement needs PR-T4 and an approved definition. |
| D8 CTPI v1 | **Confirm null/range concerns; qualify arbitrary-weight/PDO rationale.** Keep publication gated. V2 needs PR-T2/3, validation and explicit version handling. |
| D9 subratings | **Formula confirmed, scale change is a contract decision.** `power-ratings.ts:678-684` gives special teams 0.2/0.2 terms without second normalization. Relabeling cannot waive owner decision 7. |
| D10 5v5 branch | **Confirmed contradictory filter and missing mode selection.** `power-ratings.ts:148-154,291,306`; writer passes all team logs (`:183-198`). “Zero live matching rows” is original-audit evidence, not independently recounted. Do not fix the filter alone. |
| D11 season join | **Not independently re-audited end to end.** Retain as original-audit finding pending join cardinality and consumer validation. |
| D12 legacy retirement | **Plan only.** Negative reader searches do not prove absence of deployed/DB/external dependencies. No drops or retirement authorization implied by this review. |
| D13 popovers | **Plausible inherited mismatch.** Fixing the reference population is necessary; exact displayed component values must still trace to the score's blend/composite normalization. Not browser-verified. |
| D14 Top Adds NaN | **Confirmed source and offline reproduction.** API passes uncertainty unchanged (`api/v1/forge/players.ts:394`); two page call sites pass it into numeric scoring (`FORGE.tsx:356`; `forge/player/[playerId].tsx:354`); scorer multiplies it (`topAddsRanking.ts:80`). Object fixture returns NaN. Browser prevalence not measured. |
| D15 trend percentiles | **Confirmed ordinal tie bug and incomparable latest indices.** `teamPercentiles.ts:77-90,135-147`. Exact 19-point spread is dataset-dependent. |
| D16 player trend units/ratios | **Confirm implementation risk.** Fallback multiplies by 60 at `playerTrendCalculator.ts:250-255`; averaging is per-record at `:182-193`. Stored source units and fallback frequency were not remeasured in this review. |
| D17 smaller displays | **Not independently re-audited end to end.** Preserve the original findings with their stated evidence limits; do not treat them as separately verified here. |

## Verification and limitations

**Executed successfully:** a local Node process transpiled the current TypeScript pure modules using the already-installed TypeScript package, evaluated them with a restricted relative-module loader, and ran synthetic fixtures. No API handlers, Supabase clients, cron routes, external services, or application server were invoked. Reproductions covered shrinkage cancellation, CTPI PP aggregation, CTPI sparse confidence, unfinished SOS fixture selection, and Top Adds NaN. These are focused reproductions, not a full application or registered Vitest-suite pass.

**Source comparison:** no committed differences from the audit's stated `c093e8d79` to the reviewed HEAD in the principal rating, CTPI, SOS-helper, and Top Adds files inspected. Relevant original working-tree state cannot be reconstructed merely from a SHA, so this is not a full provenance identity claim.

**Not run:** production DB reads/catalog comparison; NST/NHL/Yahoo requests; browser observation; builds; full tests; predictive backtests; the original real-data replay. The original audit's 6,900-row export and replay scripts are described as scratch material outside the repository, with no reproducible artifact path in its deliverable. Exact rank deltas, row counts, correlations, confidence intervals, and “all rows unapproved” claims are therefore attributed to Fable, not upgraded to independently replicated facts.

**Recommended evidence to retain before implementation:** immutable local input extract identity/hash; replay command/source; date cutoff and source grain; four-way D1/D2 ablation; sample-versus-population SD convention; approved definitions; and held-out validation for any model changes. No fresh production export is requested or authorized by this addendum.

**Next decision:** settle the rating estimand/prior, special-team aggregation and tie rules, SOS time semantics, and CTPI publication criteria. Then write the correction plan with the amendments above. Do not implement the original recommendations mechanically.

## Reproduction appendix

Run from the repository root. This equivalent fixture harness uses only installed TypeScript and the inspected pure modules; it does not import API handlers or invoke data readers. Expected checks are asserted explicitly. It is documentation for reproducing this review, not an application code change.

```sh
node <<'NODE'
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('./web/node_modules/typescript');
const cache = new Map();
function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file);
  const module = { exports: {} };
  cache.set(file, module.exports);
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  vm.runInNewContext(js, {
    exports: module.exports, module,
    require: (name) => {
      if (!name.startsWith('.')) throw Error('External import blocked: ' + name);
      return load(path.resolve(path.dirname(file), name) + '.ts');
    }
  }, { filename: file });
  return module.exports;
}
const p = load('web/lib/power-ratings.ts');
function ratings(gp) {
  const metrics = Array.from({ length: 32 }, (_, i) => ({
    team_abbreviation: 'T' + i, date: '2026-11-10', season_id: 20262027,
    gp_to_date: gp, xgf60_ewma: 2 + i / 20, gf60_ewma: 2 + i / 20,
    sf60_ewma: 20 + i / 2, xga60_ewma: 4 - i / 20,
    ga60_ewma: 4 - i / 20, sa60_ewma: 36 - i / 2,
    pace60_ewma: 45 + i / 2, hdcf60_ewma: 8 + i / 10,
    hdca60_ewma: 10 - i / 10, pdo_ewma: 1, pdo_observation_count: gp,
    pp_xgf60_ewma: 5 + i / 10, pk_xga60_ewma: 8 - i / 10,
    discipline_diff_ewma: i / 20
  }));
  const league = p.calculateLeagueMetrics(metrics);
  const raw = metrics.map(m => p.calculateRawScores(p.calculateZScores(m, league)));
  const distribution = p.calculateRawDistribution(raw);
  return raw.map(r => p.calculateFinalRating(r, distribution));
}
const one = ratings(1), ten = ratings(10);
const maxDifference = Math.max(...one.map((r, i) => Math.abs(r.off_rating - ten[i].off_rating)));
assert(maxDifference < 1e-10);
assert(Math.abs(one[0].xgf60 - ten[0].xgf60) > 0.6);
console.log('Headline shrinkage cancellation:', maxDifference, one[0].off_rating, one[31].off_rating);

const c = load('web/lib/trends/recentTeamFormV2.ts');
const pp = c.computeRecentTeamFormCandidateMetrics([
  { team: 'T', date: '2026-11-10', gp: 1, pp_xgf: 1, powerPlayToi: 60 },
  { team: 'T', date: '2026-11-09', gp: 1, pp_xgf: 1, powerPlayToi: 600 }
]);
assert(Math.abs(pp.values.pp_xgf_per_60 - 34.42105263157895) < 1e-10);
console.log('PP current / exposure-pooled:', pp.values.pp_xgf_per_60, 3600 * 1.9 / 600);

const sparse = Array.from({ length: 32 }, (_, i) =>
  c.computeRecentTeamFormCandidateMetrics(Array.from({ length: 10 }, (_, j) => ({
    team: 'T' + i, date: '2026-11-' + String(10 - j).padStart(2, '0'), gp: 1,
    ...(j === 0 ? {
      xgf_per_60: 2 + i / 20, hdcf_per_60: 8 + i / 10, gf_per_60: 2 + i / 20,
      xga_per_60: 4 - i / 20, hdca_per_60: 10 - i / 10, ca_per_60: 40 - i / 2,
      pp_xgf: 1 + i / 100, powerPlayToi: 600, pk_xga: 1.2 - i / 100,
      toi_shorthanded: 600, xga: 4 - i / 20, goals_against: 3,
      toi_all_seconds: 3600, pdo: 1
    } : {})
  })))
);
const score = c.computeRecentTeamFormCandidateV2(sparse)[0];
assert(Object.values(sparse[0].observationCounts).every(n => n === 1));
assert.equal(score.status, 'ready');
assert.equal(score.confidence.tier, 'high');
console.log('Sparse metric confidence:', score.confidence);

const sos = load('web/lib/trends/strengthOfScheduleContract.ts');
const result = sos.computeDescriptiveSos({
  team: 'A', view: 'past-retrospective', metric: 'win-pct',
  cutoff: '2026-11-10T18:00:00Z',
  fixtures: [{ id: 'AB', teamA: 'A', teamB: 'B',
    startsAt: '2026-11-10T17:00:00Z', scheduleKnownAt: '2026-11-01T00:00:00Z' }],
  results: [{ id: 'BC', teamA: 'B', teamB: 'C', winner: 'B', overtime: false,
    startsAt: '2026-11-08T17:00:00Z', scheduleKnownAt: '2026-11-01T00:00:00Z',
    completedAt: '2026-11-08T19:00:00Z', resultKnownAt: '2026-11-08T19:01:00Z' }]
});
assert.equal(result.fixtures, 1);
assert.equal(result.direct, 1);
console.log('Unfinished past fixture:', result.observations);

const top = load('web/lib/dashboard/topAddsRanking.ts');
const topScore = top.scoreTopAddsCandidate({
  delta: 1, ownership: 40, projectionPts: 1, ppp: 0.2, sog: 3, hit: 1, blk: 1,
  uncertainty: { pts: { mean: 1, std: 0.2 } },
  scheduleGamesRemaining: null, scheduleOffNightsRemaining: null
}, 'tonight');
assert(Number.isNaN(topScore.total));
console.log('Top Adds total:', topScore.total);
NODE
```
