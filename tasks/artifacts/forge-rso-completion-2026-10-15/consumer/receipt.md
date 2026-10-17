# Consumer fixes, local synthetic evidence

Implemented locally:
- Connected RSO category planning snapshots now consume manager own realized and opponent realized/remaining totals, retain provider opponent roster and untouched raw totals, and change snapshot identity only when evaluation inputs differ. Saved read-only snapshots remain unchanged.
- Category compared-drop selection no longer requires netPoints. The existing measured AGP gain and legality/budget selection gates remain; this is no approval of a scalar category utility.
- FORGE invalidates the displayed read at the earliest represented contribution/participation/source expiry, checks again on focus/visibility, and recovers on explicit fresh read. Expired originals for unavailable targets do not invalidate unrelated fresh values. Original source clocks remain preserved.
- FORGE offers next 1–20 team-game horizons (shared reader/API changes owned separately).

Reproduction before correction:
- reproduction.log: category drop callback not called because netPoints=null; FORGE continued displaying tables at the expiry deadline; 20-game control absent. Initial connected regression setup failed before assertions and was corrected.
- reproduction-category-inputs.log: corrected UI regression against exact intake component bytes fails: received own realized {} instead of {STAT:5}. The same connected input regression passes after correction, including provider opponent roster and original input preservation.

Verification:
- verification-final.log: 223 tests passed in the three touched existing suites. Includes existing provider refresh/save/undo/eligibility flows. Existing cast-only CandidateBrowser test fixtures were completed to match required input fields; saved lock fixture now declares synthetic complete schedule explicitly.
- page-final.log: page suite rerun after refining expired-original handling (final result in log).
- start-chart-expiry.log: four existing StartChart expiry/deadline/recovery tests pass; StartChart source untouched.
- lint-final.log: scoped ESLint exits zero; three existing hook dependency warnings in RosterScheduleOptimizer remain.
- No builds, production requests, writes, deployment, publish, commit, or private pilot access.

Remaining acceptance:
- 2.5 remains incomplete: owner must establish the category decision objective and approve category tradeoff/recommendation semantics. No category scalar utility introduced. Current UI selection still requires measured AGP/points gain, and this does not establish category optimality.
- 2.6 loader completeness and whole-consumer end-to-end genuine-data acceptance owned by lead/other workers; this receipt proves only local synthetic UI behavior.
- Genuine common revision readback, native transport, production freshness and 10/20-game coverage remain separate integration/production evidence requirements.

## Category owner decision follow-up

Owner selected losing-category priority when supported by a matchup probability model; otherwise show category tradeoffs and let the manager choose. The probability model is unavailable. CategoryGains now puts baseline losing categories first using provisional mean comparisons, preserves original league category order within groups, and explicitly says these are not win probabilities and the manager chooses the plan. No scalar utility, win chance, or automatic plan recommendation was introduced. Existing full-lineup goalie ratio and partial-input gates remain.

Connected opponent overlay now preserves unknown `remaining=null` when both provider and manager have no remaining totals, and preserves known provider remaining totals when manager remaining is null (no override). Explicit manual statistic entries still overlay provider values. The null regression fails before the correction (reproduction-opponent-null.log), then focused five cases pass (category-fallback.log). CategoryGains full existing suite passes 19 tests (category-gains-final.log). Scoped lint exits zero with the same three preexisting RSO hook warnings (category-lint.log); diff whitespace check passes.

This implements the approved presentation fallback. It does not supply an unavailable category win-probability model or prove genuine-feed matchup recommendations.
