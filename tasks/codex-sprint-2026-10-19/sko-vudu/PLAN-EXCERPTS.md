# Plan excerpts for Phase 0 and P5

Source: `/Users/tim/Downloads/SKO-VuDu-directional-plan.pdf`; SHA-256 `e4b1381a4786762c998129530a66dd62bfbf7edf8e43a0129064d112ba52ed18`. Extracted read-only with pypdf; headings and acceptance prose retain PDF wording. The P2 ticket narrows work to local Phase 0 and supersedes the historical parity instruction.

## PDF page 3

5. A concrete score candidate to test
Start with natural units. For player i, statistic k, and forecast horizon H, calculate a comparable recent rate
R and a current expected rate M. State the denominator: per scheduled team game, per appearance, per
60 minutes, or per 100 on-net shots. Never subtract unlike quantities. For the first useful UI, use the same
appearance/game basis as the underlying forecast and show opportunity separately.
Define the directional gap D = M - R. Positive means an expected rebound from the recent rate; negative
means expected cooling. For lower-is-better categories such as GA rate, reverse the orientation for a
favorable-outlook display. Also show D in the category's native units.
Optional bounded display: Score = 100 * tanh(D / s). Here s is a positive scale fixed from development data
for the specified target, horizon and comparison basis. It is a display normalization, not uncertainty or a
scientific threshold. The score ranges from -100 to +100; zero means no modeled directional gap, not
proof of stability. A score of +60 does not mean a 60% chance of improvement.
Illustration only: suppose the recent points rate is 1.2, expected comparable rate 0.8, and display scale
0.4. D=-0.4 and Score is approximately -76. The explanation is “expected cooling of 0.4 points per
appearance,” not “sell immediately.” A player with recent 0.4 and expected 0.8 gets approximately +76
under that same illustrative scale. Neither player is being graded for absolute quality. The scale 0.4 is not a
proposed production setting.
For points leagues, aggregate forecast category means using the actual scoring weights, then compare on
the same denominator. An intentional PPP bonus is legitimate scoring overlap. Do not average arbitrary
category sustainability scores. Categories leagues should initially show a per-category vector; a single
league-specific utility requires roster/opponent context or an explicitly labeled approximation.
For VuDu, a natural starting gap is 100 * (expected save probability - comparable recent save rate),
expressed as additional saves per 100 on-net shots. Context-standardizing recent performance requires its
own model and uncertainty. Keep next-start quality and next-week availability/volume distinct. Aggregate
SV% and GAA from underlying totals; a ratio of means is not the full distribution of the realized ratio.
Confidence stays separate: expose sample size, source coverage, model uncertainty, and a prediction
interval when defensible. Do not suppress uncertainty by squeezing it into the headline score. A posterior
up-probability minus down-probability score can be zero under both high certainty of equivalence and a
very uncertain 50/50 split; it is not my first-release choice.

## PDF page 4

7. Dashboard and phased task list
Proposed dashboard: SKO and VuDu tabs; filters for window, horizon, league scoring and sample quality;
rows with recent production, expected production, directional gap, opportunity trend, confidence/coverage
and observed flag duration. Expand a row to show process and conversion explanations, source time and
the projected horizon curve. Use “Rebound watch” and “Cooling watch” until real market evidence
supports buy-low/sell-high claims. A user-entered trade offer can later supply a concrete market
comparison.
Phase 0 - reconcile the existing system:
- Document one meaning/sign for every score and label, with unit tests that distinguish hot-but-supported,
hot-and-overextended, cold-with-improving-role and cold-with-declining-role.
- Confirm current local/remote parity before any edits. Preserve historical quarantine and link the old task
dispositions to this new plan.

## PDF page 5

FHFH | SKO & VuDu | Research and proposed plan | 15 October 2026
5
- Inventory actual usable data, source versions and rights. Audit time units, strength states, identities,
missingness and original cutoff times.
Acceptance: a single executable contract and exact source map; no claim that old checkboxes mean this
product is complete.
Phase 1 - useful descriptive product after the shared forecast release:
- Consume FORGE's versioned per-game expectations and expose comparable recent rates, gaps and
opportunity changes.
- Reuse the existing UI/band plumbing after correcting as-of, missingness, serving identity and directional
semantics.
- Build skater and goalie views with honest unsupported/low-sample states and consistent scoring rules.
Acceptance: one real player trace from source through formula/API/UI, correct signs and units, no artificial
zero inputs, and no unvalidated streak probability or duration.
Phase 2 - evidence of predictive improvement:
- Benchmark baseline and candidate indicators by target on identical eligible cases.
- Run the predeclared within-player lead/lag and onset/continuation studies; report negative results and
subgroup limits.
- Test whether any indicator improves actual lineup/streaming decisions under fixed league rules.
Acceptance: frozen comparison report with paired uncertainty, leakage audit and documented promotion
criteria. No universal performance cutoff is invented here.
Phase 3 - actionable market layer:
- Collect authorized, timestamped market proxies or user trade offers; distinguish demand/popularity from
actual price.
- Evaluate expected rest-of-horizon value against the offered return, replacement options and RSO roster
fit.
- Add calibrated continuation/duration models only if they beat simpler alternatives prospectively.
Acceptance: trade labels have an actual price/value comparison and a clear uncertainty statement.
