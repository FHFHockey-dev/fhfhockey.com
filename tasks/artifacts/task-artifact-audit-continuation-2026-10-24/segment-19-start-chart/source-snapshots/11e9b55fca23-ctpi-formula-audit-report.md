# Recent Team Form (CTPI) Formula Audit

**Audit date:** 2026-08-28  
**Mode:** read-only; no database rows, formula weights, schedules, models, or deployments changed  
**Audited persisted season:** `20252026`  
**Independent game-log validation:** development `20222023` + `20232024`; untouched holdout `20242025`  
**Representative reconciliation date:** `2026-02-05`

## Verdict

The current CTPI calculation is **not fit for the user-facing Recent Team Form claim**. It can only be treated as an untrusted legacy/experimental series until its source grain, goaltending input, replay behavior, and temporal cutoff are repaired and the replacement is validated over more than one season.

The intended question remains useful:

> How strongly has this team been playing lately, relative to the rest of the league?

The persisted implementation does not currently answer that question reliably because its supposed last-10-game window contains thousands of cumulative multi-game snapshots, its persisted goaltending component is identically zero, historical rows do not replay from the current source state, and a same-date reader can expose results that were unavailable before the slate began. A subsequent three-season, one-row-per-team-game validation supports an inactive v2 candidate and the removal of PDO, but it does not make the existing persisted rows trustworthy or authorize activating the candidate.

## Implemented formula

For each team, `computeTrendMetrics` sorts source rows newest-first and applies linear weights `1.0, 0.9, …, 0.1` to the latest ten source rows. It then standardizes each metric against the same-date league population and computes:

```text
offense = 0.50 z(xGF/60) + 0.30 z(HDCF/60) + 0.20 z(GF/60)
defense = 0.50 -z(xGA/60) + 0.30 -z(HDCA/60) + 0.20 -z(CA/60)
goaltending = 0.40 z(season GSAx/60) + 0.60 z(last-10 GSAx/60)
special teams = 0.55 z(PP xGF/60) + 0.45 -z(PK xGA/60)
luck = z(PDO)

raw = 0.35 offense
    + 0.30 defense
    + 0.20 goaltending
    + 0.15 special teams
    + 0.10 luck

displayed score = 50 + 15 raw
```

The top-level coefficients total `1.10`, not `1.00`, and the displayed transform is not clipped despite the internal field name `ctpi_0_to_100`.

## Findings

### P0 — The “last ten games” are not ten games

The all-strength rates source contains 4,966 rows for the audited season:

- 2,534 rows have `GP = 1` and can represent one team-game.
- 2,432 rows have `GP > 1` and are cumulative/aggregate snapshots.
- Those aggregate rows occur on 76 dates, and every one of those dates contains all 32 teams.

The ingestion route requests every calendar date. On league-wide no-game dates, Natural Stat Trick can return a season aggregate rather than an empty game log. The writer persists that response under the requested date, and CTPI treats it as one observation. Consequently, the recency window is the latest ten mixed source rows—not the latest ten games—and season aggregates can be repeatedly overweighted.

**Impact:** the index cannot be described as recent team form. The representative `2026-02-05` reconstruction using only `GP = 1` rows changed scores by a median 5.06 points and a maximum 24.10 points. The median absolute rank shift was six places and the maximum was 26 places; Dallas moved from persisted rank 27 to corrected-input rank 1.

### P0 — Persisted goaltending contributes nothing

The daily writer obtains all-strength `ga` and `xga` from the rates table while obtaining only TOI from the counts table. In the audited data:

- Rates rows with raw `ga`: `0 / 4,966`.
- Rates rows with raw `xga`: `0 / 4,966`.
- Counts rows with both raw `ga` and `xga`: `4,956 / 4,956`.
- Persisted CTPI rows with nonzero goaltending: `0 / 8,064`.

The public on-the-fly reader already prefers counts for GSAx, but persisted rows always win when available, so the corrected fallback does not repair the served series.

**Impact:** a component advertised as 20% of all-around form is absent from every persisted score.

### P0 — Historical rows are not reproducible after source corrections

The daily writer resumes from only the latest persisted date. It does not identify or replay earlier CTPI dates when NST rows are corrected later. For example, CTPI for `2026-02-05` was computed at `2026-02-06T09:10:01.451Z`, while relevant NST source rows were updated as late as `2026-03-21T00:23:26.615Z`.

Re-running the checked-in legacy formula against the current source state for the representative date differs from persistence by:

- Median absolute score delta: `6.22`.
- Mean absolute score delta: `6.60`.
- Maximum absolute score delta: `26.10`.

**Impact:** the same formula/date/team cannot be reproduced from the current source tables, and downstream historical analysis silently mixes source vintages.

### P0 — Same-date CTPI can look ahead for a pregame surface

There are 2,534 persisted team-date rows whose date also has a `GP = 1` source result for that team. A CTPI row for a date is therefore capable of including the result of a game played on that same date. The Start Chart historically queried through the slate date, while the game-prediction feature builder correctly requires CTPI strictly before its prediction date.

**Impact:** a historical Starter Board can display postgame information as though it were pregame context. Start Chart must use a strict prior-date cutoff.

### P1 — PDO is rewarded and partially double-counted

Positive PDO contributes positively as a `0.10` top-level “luck” term. Realized GF is already present inside offense, and a repaired goaltending component would also capture realized saves versus expected goals. In the persisted series, `z(PDO)` and `z(GF/60)` correlate `0.662`.

**Impact:** the formula rewards a signal it explicitly calls luck and can count the same short-run finishing/save results more than once. That conflicts with a stable, underlying interpretation of form. PDO is better disclosed as a separate sustainability flag unless a validated target explicitly justifies including it.

### P1 — Missing values are indistinguishable from league-average evidence

The weighted mean returns zero when a metric has no observations. Z-scoring also returns zero for a missing/non-finite value or zero league standard deviation. Because trend metrics are typed and collected as finite numbers, some missing metrics enter league moments as real zero measurements, while others become a neutral z-score without an availability flag.

**Impact:** incomplete teams can be biased toward average or distort the league distribution, and consumers cannot distinguish “average” from “unavailable.”

### P1 — The game-prediction reader lacked publication approval

The audited `web/lib/game-predictions/featureBuilder.ts` path read the latest prior row from `team_ctpi_daily` without selecting formula, input, or publication metadata, while `homeMinusAwayCtpi` remained in the v6 baseline feature vector. The shared approval gate therefore protected Start Chart and the public Trends reader but did not protect this model-input path.

**Forward repair and model disposition:** the local reader now selects the four provenance aliases, applies the shared trust predicate before strict-as-of selection, uses an older approved row instead of a newer rejected row, and reports CTPI unavailable when no approved row exists. New snapshots preserve the same provenance inside each team feature. Feature-vector construction applies the trust predicate again, so a persisted numeric pair without approved publication/formula/input/game-count provenance contributes zero instead of bypassing the reader.

The read-only `web/scripts/audit-game-prediction-team-form.ts` audit finds 133 v6/v4 snapshots over 93 games. All 133 contain numeric CTPI pairs and none contain an approved provenance pair; the repaired contract excludes all 133 without modifying them. The prior playoff evidence also counted repeated prediction rows as games: 53 stored predictions cover 13 unique games, and only seven unique games have completed outcomes in the audited cohort. On those seven, the historical latest-per-game v6 predictions score 4/7 with Brier `0.227105` and log loss `0.646903`; a model retrained from 80 completed pre-cutoff v6 snapshots under the repaired contract scores 3/7, `0.255554`, and `0.697456`, while the goal-differential baseline scores 5/7, `0.205257`, and `0.601026`. The repaired candidate fails the minimum-sample, historical-comparison, and naive-baseline gates. The focused feature-builder and v6 baseline cohort passes 2 files/32 tests. The existing no-Production exception remains; no snapshot, training row, model artifact, prediction, metric, or Production state was rewritten.

### P1 — The “0–100” contract is not guaranteed

`50 + 15 × raw` is unbounded. The audited season happens to range from `26.95` to `70.30`, with standard deviation `7.55`, but an outlier can produce a value below 0 or above 100. Dashboard invariants nevertheless reject values outside `[0, 100]`.

**Impact:** a legitimate formula outlier can break a downstream response contract.

### P1 — Persisted history alone cannot validate stability or generalization

Only `20252026` exists in `team_ctpi_daily`: 8,064 rows, 32 teams, and 252 dates. There is no persisted multi-season cohort for era stability, year-over-year calibration, or a genuinely untouched final holdout.

**Impact:** persisted rows cannot establish cross-season comparability or support a safe replay/backfill. The independent three-season game-log validation below now evaluates the frozen candidate implementation, but no replacement formula has been activated, persisted, or replayed.

### P2 — Component redundancy and omitted context remain material

Persisted z-score correlations include:

- xGF with HDCF: `0.762`.
- xGA with HDCA: `0.778`.
- xGA with CA: `0.659`.
- HDCA with CA: `0.596`.

The formula also does not adjust for opponent quality, venue, score effects, rest, travel, starting goalie changes, injuries, trades, coaching changes, or continuity of the current roster/system. A league-relative score can move when other teams change even if the selected team does not.

**Impact:** CTPI is a descriptive mixed-performance index, not an opponent-adjusted team-strength estimate or game forecast. The UI must not imply those stronger meanings.

## One-season forward diagnostic

The read-only audit evaluated 2,214 as-of-safe team-game observations after ten prior valid games. These are unadjusted correlations—not causal estimates and not a weight-selection exercise.

Selected Pearson correlations:

| Predictor | Next-game GD | Next-3 GD | Next-5 GD | Next-10 GD |
| --- | ---: | ---: | ---: | ---: |
| Persisted legacy CTPI | 0.091 | 0.152 | 0.191 | 0.263 |
| Corrected-input formula | 0.101 | 0.183 | 0.236 | 0.323 |
| Corrected input without PDO | 0.104 | 0.185 | 0.237 | 0.317 |
| Last-10 goal differential | 0.088 | 0.159 | 0.202 | 0.289 |
| Last-10 expected-goal differential | 0.112 | 0.181 | 0.226 | 0.307 |

For forward expected-goal differential, the simple last-10 xG-differential baseline exceeds the corrected formula at horizons 1, 3, 5, and 10. Removing PDO is generally neutral or slightly better at short horizons, but the evidence is not sufficient to select final weights.

**Interpretation:** after obvious input repairs, the composite contains useful signal but does not consistently dominate a simple recent xG baseline. That supports retaining the plain-language “context” boundary and rejects using CTPI as a prediction or ranking input without a separate validated model.

## Three-season controlled validation

The follow-up audit reads Natural Stat Trick's season game-log endpoint, which returns one row per team-game and therefore avoids the contaminated daily-aggregate source path. It now calls the exact inactive implementation in `web/lib/trends/recentTeamFormV2.ts`: the established component weights total `1.00`, PDO is context-only, missing metrics remain unavailable with documented renormalization, confidence and effective sample size are explicit, and `100 / (1 + exp(-0.6 × raw))` guarantees the display range. The candidate was frozen before inspecting the `20242025` holdout; no weights were fit or selected.

Coverage is complete at the dataset-join level for all three 82-game seasons:

| Season | Team-games | Teams | Candidate scores | Complete formula rows | Missing PP/PK rows |
| --- | ---: | ---: | ---: | ---: | ---: |
| `20222023` | 2,624 | 32 | 2,303 | 2,562 | 32 each |
| `20232024` | 2,624 | 32 | 2,304 | 2,516 | 54 each |
| `20242025` holdout | 2,624 | 32 | 2,303 | 2,496 | 68 each |

The missing PP/PK values are real zero-opportunity/missing-stat rows, not missing dataset joins. Recency aggregation supplies full metric coverage for every otherwise eligible ten-game sample. The candidate deliberately withholds two of 6,912 possible scores: SJS on `2022-10-29` and NJD on `2024-10-25` were the only teams to have reached ten games, so a league-relative z-score population did not yet exist. It reports `insufficient_league_comparison` rather than manufacturing league-average evidence.

On 4,607 development samples, the candidate correlates `0.882` (95% Fisher interval `0.876–0.889`) with trailing ten-game xG differential. On the 2,303-sample holdout, the correlation is `0.837` (`0.825–0.849`). Holdout component-to-intended-signal correlations are:

- Offense to recent xGF/60: `0.867`.
- Defense to negative recent xGA/60: `0.880`.
- Goaltending to recent GSAx/60: `0.853`.
- Special teams to recent PP-minus-PK xG rate: `0.837`.

The five fixed score bands are monotonic for both contemporaneous and next-five-game xG differential in development and holdout. On holdout, mean recent xG differential rises from `-1.216` in the under-35 band to `+1.182` in the 65-plus band; mean next-five xG differential rises from `-0.788` to `+0.682`.

The candidate is stable but not static. Holdout snapshots have median consecutive-date Spearman rank correlation `0.959`; median absolute rank movement is one place and the 95th percentile is seven places. Across all three seasons, it ranges from `23.24` to `73.39`. The logistic transform guarantees every finite score is strictly inside `0–100`; the legacy linear transform remains theoretically unbounded.

Removing PDO improves every recorded forward association relative to the corrected legacy score. The candidate still trails the simple recent xG-differential baseline for future xG differential. On holdout, candidate versus simple-baseline correlations are `0.181` versus `0.187` over one game, `0.333` versus `0.345` over five games, and `0.403` versus `0.417` over ten games.

**Interpretation:** the inactive v2 candidate has strong concurrent validity as a descriptive all-around form summary, stable score bands on an untouched season, and honest sparse-population failure behavior. It is not a superior forecasting feature, and these results do not justify presenting it as team strength, win probability, or a Starter Board ranking input. The reported Fisher intervals do not correct for repeated team observations, so activation should retain that limitation or add team-clustered uncertainty.

## Blind spots requiring explicit treatment

- Opponent and schedule quality.
- Home/away, score effects, rest, back-to-backs, and travel.
- Injuries, trades, line/roster continuity, coaching changes, and starter changes.
- PP/PK opportunity volume versus efficiency.
- Empty-net, shootout, playoff, and era comparability.
- Effective sample size, freshness, confidence, and early-season shrinkage.
- Relative-score movement caused by changes elsewhere in the league.
- Leakage/double counting when a game model also consumes the underlying CTPI features.
- Historical/model-distribution risk from previously captured unapproved CTPI features; all 133 audited numeric pairs now fail closed, the seven-game diagnostic rejects promotion, and any future approved formula still requires a new adequately sized rollout before predictive use.

## Recommended replacement boundary

Do not overwrite or silently bless the current rows. Treat them as legacy/untrusted and introduce a versioned replacement only after review.

The smallest defensible v2 should:

1. Admit only verified one-team-game source rows (`GP = 1`) and record rejected aggregate counts.
2. Use source rows strictly before the consumer's pregame date/time.
3. Read GSAx numerator and denominator from compatible counts rows.
4. Persist formula version, input-contract version, source cutoff, source fingerprint/update watermark, game count, missing-component coverage, and computed-at time.
5. Replay affected dates when late source corrections change the watermark.
6. Make all top-level performance weights total `1.00`; keep PDO as a separate sustainability signal unless validation explicitly earns it a score weight.
7. Preserve unavailable metrics as unavailable, renormalize only documented available weights, and disclose effective sample/confidence.
8. Guarantee the public range through an explicit bounded transform or rename the field so it does not promise `[0, 100]`.
9. Compare the composite and ablations against last-10 xG differential, goal differential, points percentage, and canonical team power on multiple seasons with a final untouched holdout.
10. Keep Recent Team Form contextual and ranking-independent even if a later game-prediction model uses a validated version.

The inactive `recent-team-form-v2-candidate` now implements items 1–3, 6–8, and 10 as pure, tested code. The separate inactive provenance boundary prepares items 4–5: it hashes every score-affecting strict-prior source value, records the latest joined-source update watermark, and plans deterministic replay without switching a writer or reader. A local materialization boundary also proves that numeric scores can retain nullable components, unavailable scores can be omitted with explicit reasons, and PDO can remain payload-only. Approval, migration application, persistence, downstream model-reader repair, and bounded dry-run/backfill evidence remain open.

## Inactive provenance and replay proof

`web/lib/trends/recentTeamFormV2Provenance.ts` centralizes the future writer's pregame boundary. Its source fingerprint is order-independent and changes when a score-affecting source value changes. Its watermark advances when any joined all-strength, PP, or PK source record is corrected. Replay decisions distinguish missing or internally inconsistent persistence from formula, input, cutoff, fingerprint, and watermark changes. Because the season goaltending component consumes season-to-date results, the fingerprint deliberately covers every prior exact team-game—not only the latest ten.

The read-only `2026-02-05` audit produces this candidate snapshot:

- Exclusive source cutoff: `2026-02-05`; latest admitted game: `2026-02-04`.
- Exact source team-games: `1,802`; teams: `32`; rejected source rows: `0`.
- Candidate availability: `32` scored, `0` unavailable.
- Latest joined-source update: `2026-03-21T04:25:56.492Z`.
- Stable source fingerprint: `b358b0bb0e1373348284b1f86d36385b9ddb28580260fa95d5c32051371667cf`.

The corresponding legacy persisted snapshot is scheduled for replay for five explicit reasons: formula version changed, input version changed, cutoff changed, source fingerprint missing, and source watermark missing. This proves detection and planning only; the required raw→persisted→API trace remains open until the candidate is approved and persistence is explicitly authorized.

## Inactive materialization proof

`web/lib/trends/recentTeamFormV2Materialization.ts` maps score-bearing candidate snapshots into the existing `team_ctpi_daily` compatibility shape without performing an upsert. It keeps `ctpi_raw` and `ctpi_0_to_100` required, retains missing offense/defense/goaltending/special-teams components as `NULL`, omits unavailable scores with stable reason codes, stores PDO only in `payload.pdoContext`, rejects every non-finite payload number, and fixes publication status to `candidate_unapproved`.

The local migration `20260828142331_recent_team_form_nullable_components.sql` only drops `NOT NULL` from the five component/context columns. It does not weaken either score column, rewrite a row, alter RLS, or grant a new privilege. It is staged and has not been applied.

The read-only `2026-02-05` audit materializes 32/32 candidate teams in memory and reads every field back exactly: 32 exact score/component/provenance matches, zero omitted rows, 32 PDO context payloads, and 32 `luck = NULL` compatibility columns. The source cutoff, through-date, watermark, and fingerprint remain the values recorded above. The focused partial-coverage test separately proves that a numeric score persists with `special_teams = NULL`, while a four-game unavailable team produces no row. This is raw→candidate→materialized-shape evidence—not raw→database→API evidence.

## Publication safety boundary

Formula and input version strings are provenance, not product approval. The shared trust reader now also requires `publicationStatus: "approved"`; the checked-in legacy calculator stamps every newly computed v1 result `legacy_unapproved`. Start Chart therefore reports no active Team Form formula when it has no approved rows. The broader `/api/v1/trends/team-ctpi` reader resolves its season from the requested date, applies the same trust rule, and no longer falls back to an on-the-fly calculation of the rejected legacy formula. Existing response fields remain present, with added trusted/untrusted counts and plain-language unavailability warnings.

This is a fail-closed publication guard, not candidate activation. The inactive v2 candidate continues to have no writer, persisted row, public reader, or schedule. The game-prediction reader and feature vector are also fail closed locally; the available seven-game rollout diagnostic fails, so the existing no-Production disposition remains and a future approved formula would need fresh, adequately sized evidence.

## Reproduction

From `web/`:

```bash
NODE_PATH=. npx ts-node --transpile-only \
  --compiler-options '{"module":"commonjs","moduleResolution":"node"}' \
  scripts/audit-ctpi-formula.ts \
  --season=20252026 \
  --date=2026-02-05

NODE_PATH=. npx ts-node --transpile-only \
  --compiler-options '{"module":"commonjs","moduleResolution":"node"}' \
  scripts/audit-ctpi-multiseason.ts \
  --seasons=20222023,20232024,20242025 \
  --holdout-season=20242025

NODE_PATH=. npx ts-node --transpile-only \
  --compiler-options '{"module":"commonjs","moduleResolution":"node"}' \
  scripts/audit-game-prediction-team-form.ts
```

The first script reads only `team_ctpi_daily` and the four NST team source tables. The second makes bounded authenticated reads from four NST season game-log datasets per season and exercises the exact inactive candidate module. The third reads the bounded v6 feature-snapshot, history, game, and outcome cohorts, deduplicates evaluation by game, and retrains only in memory. None performs an upsert, RPC mutation, migration, backfill, model promotion, or publish.

## Decision required before formula activation

The user's rebrand direction establishes the first product choice. The replacement is implemented locally but cannot become a trusted writer/reader contract until the second is approved or revised:

1. **Established:** Recent Team Form is a descriptive, league-relative recent-performance index—not a forward strength estimate.
2. **Recommended with multi-season support:** PDO is removed from the score and shown separately as sustainability/luck context.

All source-grain, GSAx, strict-pregame, missingness, provenance, and replay repairs are correctness requirements independent of those choices.
