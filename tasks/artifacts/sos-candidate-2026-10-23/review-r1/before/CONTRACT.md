# SoS candidate metric contract v1

Status: runnable offline research candidate. No selected production formula, calibrated NHL forecasts, public UI integration or numeric deployment. `sos_candidate.py` performs pure calculations; `run_candidate.py` is the local-file CLI. `record_core.py` is the unchanged prefix of the October20 exact-arithmetic prototype, pinned in CORE-PROVENANCE.json. No dependencies beyond Python's standard library.

## What is being measured

Team quality estimates a team's performance ability. Schedule difficulty averages the quality of the opponents in a specified set of fixtures. The focal team's own win chance, scheduled game count, off-nights and fantasy utility are different quantities.

| Output | Question | Status / scale |
|---|---|---|
| `own_record` | What result credit did this team earn through the cutoff? | Descriptive shrunk record; [0,1]. |
| `quality_colley` | What result-based team rating accounts jointly for opponents played? | Schedule-adjusted retrospective index; league-team mean .5; **not bounded to [0,1] or a win probability**. |
| `direct_sos` | How strong are the selected opponents' records, excluding games against this focal team? | Simple per-fixture baseline, [0,1]. |
| `rpi_sos` | What does a specified direct/indirect opponent-record blend say about this schedule? | Proposed FHFH two-hop variant, [0,1]. Not the full RPI team score. |
| `colley_sos` | What is the mean adjusted opponent index after removing this focal team's results? | Per-fixture adjusted index; no arbitrary logistic/percentage mapping. |

Higher schedule values mean harder opponents on the specified outcome measure. No one score means universally bad fantasy conditions. The full historical RPI form `.25*own + .50*OWP + .25*OOWP` includes team results and is deliberately not exposed as SoS. Its distinct behavior is tested in the retained core.

## Three time meanings

1. **Past retrospective at t**: select finalized fixtures in past `[start,end)`; estimate each opponent using eligible season results known before t. Outcomes after the selected past window but before t can affect the estimate. Direct/RPI are descriptive opponent records; Colley additionally adjusts opponent quality for schedule. This is useful retrospective context, not a replay of a contemporaneous forecast.
2. **Faced then**: `faced_then(past_payload, retained_pregame_snapshots)` evaluates each fixture with its own retained pregame cutoff and averages the per-fixture outputs. It requires the same season/cohort/config and exact fixture identity/start. Missing pregame snapshots return null; it never relabels today's reconstruction as historical knowledge. The snapshot cutoff must be strictly before kickoff.
3. **Future as of t**: only the outer opponent list changes. All inner records/second-hop graph/model fits come from results known before t. This is an as-of-frozen estimate of forthcoming difficulty, **not empirically qualified predictive performance**. A changing team's future skill is not modeled.

No future result, final-season standings, actual future starter or later schedule revision is admitted to a frozen evaluation. The calculator has no wall clock. All comparisons use supplied, timezone-aware timestamps. UTC is the comparison coordinate; the caller converts NHL/league calendar boundaries to instants, honoring DST. Date-only inputs are rejected.

## Input / temporal admission

`example-input.json` is a complete synthetic payload. Required envelope:

- `teams`: explicit, unique, canonical season team IDs, at least two. No guessed abbreviation/relocation aliases. The caller owns authoritative identity mapping.
- `season`: `{id,start,end}`. One regular season per run. All horizon instants lie within these bounds; results/schedule rows with another season ID are rejected. Cross-season requests must be split, not silently averaged. No 82/84-game denominator is hardcoded.
- `as_of`: one timestamp t; `horizon`: `{kind,start,end}`, with kind `past_retrospective` or `future_as_of`. Past end <= t; future start >= t. Bounds are `[start,end)`. Future fixtures additionally require kickoff > t.
- `config`: explicit `mode`, `kappa`, `prior_mean`, `prior_known_at`. No data-selected defaults. Mode is `final_win`, `regulation_equivalent` or `points_credit`; the last also requires `points_per_win:2`. The prior must be known before t.
- `history`: `{as_of,complete_teams,results}`. Completeness attestation must match t and means all season regular-season results available before t have been supplied for those teams. The calculator cannot verify this attestation against a provider. If any cohort team lacks completeness, **all** quality/SoS outputs are withheld rather than fitting a convenient subset.
- Each result: `{id,season,phase,home,away,start,end,available_at,outcome}` plus optional paired `home_points,away_points`. Eligible iff phase=regular, end<t and available_at<t; start<end<=available_at. A result published exactly at t is excluded. Supported outcomes are home/away × reg/ot/so. Unknown actual historical ties are rejected pending a season-specific points contract.
- A future `schedule`: `{observed_at,start,end,complete_teams,fixtures}` must be retained strictly before t and cover the complete requested horizon. Each fixture has `{id,season,phase,home,away,start,known_at,status}`. known_at <= snapshot observed_at. Only scheduled regular-season fixtures enter. Cancelled rows are excluded; unknown/postponed rows in-window block affected teams; contradictory future final/in-progress rows fail validation. A snapshot at/after t or mixed-in later revision is rejected. Snapshot age is output, but no unvalidated freshness SLA is invented.

The availability timestamp must refer to the **specific result revision being supplied**, not its original game date. A later correction cannot retain an earlier publication timestamp. For historical replay, the caller must supply the earlier retained revision, not overwrite it with final truth. Duplicate IDs within either ledger are rejected, including identical duplicates. Matching IDs across result and schedule must agree on teams/start. Different canonical IDs represent different fixtures and count separately; deduplication of provider aliases is the upstream identity adapter's responsibility.

No ingestion, historical snapshot fabrication, new captures, database reads or schedule acquisition is implemented here. JSON input hashes in CLI output pin exact local input bytes.

## Record arithmetic and exclusion

For team j after removing all games against exclusion set S:

`p(j,-S) = (sum eligible credits + kappa*mu)/(eligible games + kappa)`.

All historical results have unit weight; no time decay in v1. `kappa=2, mu=.5` in examples is a demonstration setting, not an NHL optimum. For binary/regulation-equivalent mode the prior mean is .5. Points mode requires an explicit prior mean; it must be fixed externally or learned entirely from earlier allowed data. Own-result invariance is conditional on holding this prior fixed; a prior recomputed using focal outcomes would reopen feedback. Prior-season team-specific carryover, rosters and decay are deferred, and any future version needs prior provenance, offseason drift and expansion-team policies.

Each outer fixture counts once, even against repeated opponents. For focal i and fixture-frequency weights w:

`OWP_i = sum_j w_ij * p(j,-{i})`.

For each intermediary j, form its **historical eligible** opponent mix excluding i; weight every historical fixture equally. The inner rate for k excludes both i and j:

`OOWP_i = sum_j w_ij * sum_k v_jk(-i) * p(k,-{i,j})`.

`rpi_sos = (2*OWP + OOWP)/3`.

This blocks i→j→i and all focal games from both terms. Other opponent cycles can appear, but it is exactly two finite hops, not recursive iteration or independent observations. If j has no eligible opponents besides i, its second-hop contribution uses the explicitly declared structural prior mu, with prior-only exposure reported. This preserved October20 rule applies even at kappa=0; it is not observed evidence. Any genuinely undefined rate with zero denominator propagates null to its component/composite. No dropping missing opponents, denominator pooling, unique-opponent averaging or silently replacing a missing composite with its surviving component.

Direct SoS can be available when RPI SoS is null. Inspect metric values and `rpi_sos_state`; a row `computable` means inputs can be evaluated, not every challenger is available or qualified. Empty outer schedule means null, not zero/easy. Observed winless 0/GP remains a valid zero.

## Outcome systems

- `final_win`: all final wins=1, all losses=0, including OT/SO; complementary credits. It answers opponent ability to win eventually, not regulation superiority.
- `regulation_equivalent`: regulation win/loss=1/0; any OT/SO game=.5/.5. This intentionally changes the target and is not an official standings rule. Colley uses this named fractional-credit extension only when explicitly selected.
- `points_credit`: ordinary win=1, regulation loss=0, OT/SO loss=.5. Optional explicit two-point ledger values override the ordinary mapping, allowing documented exceptional credits. Unsupported three-point/other systems fail rather than mix silently.

NHL awards one standings point for an overtime/shootout loss. [NHL explanation](https://www.nhl.com/news/nhl-standings-are-tight-at-quarter-mark-of-2025-26-season). Given the declared two-point normalization, ordinary OT credits total1.5. Thus league game-weighted mean = `.5 + .25*f_OT`, an algebraic derivation, and .500 is not a universal neutral points percentage. Points credit is not a complementary probability and is **not** passed to Colley.

## Schedule-adjusted challenger and cycles

For complementary outcomes solve `C*r=b`, with `C_ii=2+n_i`, `C_ij=-n_ij`, `b_i=1+sum_g(y_ig-.5)`. The matrix is `2I + graph Laplacian`; Cholesky gives a finite solution even for an isolated team. Numerical residual is checked. This implements the published Colley binary method, with the explicitly named regulation-equivalent extension. [Original derivation, pp.9–12](https://www.colleyrankings.com/matrate.pdf).

`quality_colley` fits the complete historical cohort once. For schedule values for i, remove i and all its results and refit; average opponents' fitted indices once per selected fixture. This strict leave-focal-out policy avoids a weak/strong focal team changing its own measured schedule by losing/winning. It costs information, can disconnect the graph, and changes the conditional estimate of the same opponent across focal teams. That tradeoff needs an empirical comparison against global fits; it is not an NHL theorem. The global fit must not be quietly substituted for the leave-out fit.

Colley retains outcome evidence while solving opponent cycles simultaneously; it is not indefinite averaging of neighbors. Common priors anchor disconnected components but do not create inter-component matchup evidence. Return global and leave-out components, per-team game counts and prior-only opponent exposure. No home, road, rest, travel, goalie or injury effects are estimated; fixture sides identify opponents only. A later contextual model must keep neutral team quality separate from difficulty for a fixed reference team, then apply venue/rest exactly once. Own-team win odds are not pure SoS.

## Scale, uncertainty and rankings

Direct/RPI results are on [0,1]. Colley is a centered outcome index whose extreme unbalanced synthetic chain produces values outside [0,1]. Never clamp it, call it a percentage, or convert it to win odds without fitted calibration. Do not compare the magnitudes of changes across these scales as if they were interchangeable effects.

Candidate ranks are competition ranks (1,1,3), highest/hardest first, using ten-decimal tie buckets to avoid floating noise. Nulls are unranked. The cohort and coverage are explicit; no alphabetical advantage or renormalized hidden subset. These are research ranks, including prior-only values, not a publication admission policy.

No calibrated confidence interval is claimed. Return eligible counts, direct prior weights, direct/second-hop prior-only shares, unique opponents, history/schedule coverage, graph components and numerical residual. `run_candidate.py --demo` additionally reports one-result rank/score perturbations and prior-strength sensitivity. Shared opponents and overlapping windows make fixture-level standard errors inappropriate. Future empirical intervals should use paired time/team-week blocks, and account for parameter/prior uncertainty; rankings near ties should not imply stable ordering.
