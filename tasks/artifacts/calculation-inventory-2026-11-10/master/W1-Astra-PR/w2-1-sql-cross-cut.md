# Independent peer review: W2-1 SQL cross-cut

Reviewed 2026-11-11 in `/Users/tim/Code/fhfhockey.com`, `octoberBranch`. Audit: `7988a1fef6` (`audits/sql-cross-cut.md`, citing source `6d574deab`). Review checkout: `3e81061cb60105e984ae7724365b2d9f22ba6d11`. The named implementation files supporting the corrections below are unchanged from the audit commit. Concurrent changes were preserved.

Scope: W2-1's 52 named inventory entries, its prompt, `OWNER-DECISIONS.md` through decision 68, the two Wave 1 consolidations, related packets and relevant Wave 1 reviews. `BASE` means `supabase/migrations/20260716112908_production_schema_baseline.sql`; other paths are repository-relative. Only this review file was authored. No separate diary was created because the assignment expressly limits saved work to this file.

## Verdict

**Retain the major SQL lineage and aggregation concerns, but do not adopt this audit unchanged as a fix plan.** Several findings describe real source defects. However, its silent-fallback claim, mock-ADP labelling criticism, and short-history weight argument are contradicted or unsupported by the actual code. The PP-share denominator is an explicit existing conditional contract, not an established mathematical defect.

Most consequential changes:

1. **FORGE already reports the absent physical-totals RPC.** Its player hit/block estimates do not simply become constants: observed history and recent form still enter. Remove the claim that this fallback is silent.
2. **Human Mock ADP is already labelled exactly as the SQL computes it.** It is contributor-balanced, human-only, provisional and explicitly not real-league ADP. Do not “fix” it by including bots.
3. **The two `nhl_team_data` readers have different guards.** FORGE tolerates a one-game lag; the bridge can fall back to last season. A new synthetic counterexample proves FORGE's equal-GP ambiguity selects whichever season arrives first.
4. **Incomplete metric support survives the SQL's pooling.** Null NST numerators can be treated as zero with their time retained. `player_totals_unified` additionally divides WGO counts by NST-only exposure. These are distinct from a zero denominator or the known EV/all-strength mismatch.
5. **Fixing the Game Score RPC alone leaves the WiGO calendar contaminated.** Its companion calendar uses the same season-only WGO filter and determines the chart's actual rows.

The original **7 sound / 26 mis-specified / 17 wrong / 2 undetermined** tally mechanically reconciles to all 52 named entries. It is Fable's classification, not 52 independently production-verified results. The scope correction about the Codex records is supported: `packets/player-forecasts-season-part1.md:72,82-162` maps those SQL/runtime records into M-PFC-001. No replacement tally is offered because several entries combine arithmetic, deployment state, consumer behaviour and policy choices.

## Evidence boundaries

- **Source-confirmed:** the implementation and consumer paths below. Source inspection is not a fresh production-state check.
- **Executed:** four focused, mocked Vitest files, **161 tests passed**; actual extracted TypeScript selectors on synthetic rows; arithmetic counterexamples for missing support and weight cancellation. The extraction used local TypeScript and a VM, not application/service initialization.
- **Reported only:** all production catalog matches, applied/missing migrations, object kinds, populated/unscanned claims, cron activity, row counts, sample game classifications and stored magnitudes in Fable's audit. No production DB, provider, deployment, cron or application request was made here.
- **Not established:** current deployed application SHA, feature-flag values, runtime frequency of any new edge case, or population-wide prevalence. A source reader is not proof every affected row is currently displayed.
- No source edits, migrations, recomputes, data repair, cleanup, git commit/push or deployment were performed.

## A. Additional defects and incomplete remedies

### PR-SQL-1. Matched units do not ensure matched observations

**P1, source-confirmed conditional data defect; M-UST-006/008/038 and downstream M-WIGO-001.** Fable correctly identifies several units and empty-denominator issues, but calling the other pooled columns sound is too broad (`audits/sql-cross-cut.md:79,82`).

**NST season views:** `BASE:5729-5737` permits independently null `toi`, goals, shots and ixG. `BASE:20392,20400` sums TOI independently while `COALESCE(ixg,0)` turns an unknown count into zero. `BASE:20483` divides those sums. The same pattern exists for other counts and on-ice components (`BASE:20432-20463`). This is not limited to a 0/0 season.

Executed arithmetic fixture: two 1,200-second observations, ixG `0.6` and `NULL`, yield **0.9 ixG/60**. The supported observation's rate is **1.8**, and the complete two-game rate is **unknown**, not 0.9. If both ixG values are null, the count/rate view can publish a confident zero. Conversely, a known count with missing TOI can inflate a rate by retaining the numerator alone.

**Unified totals:** `BASE:23036-23039` left-joins NST onto WGO. `BASE:23384,23388-23389,23397,23399-23402` divides all WGO goals, shots, PIM, giveaways, takeaways, hits and blocks by `SUM(nst_toi)`. A missing NST row therefore removes exposure but not these numerators. Fixture: two WGO games, each 1 goal and 1,200 seconds, only one with NST exposure, produce **6 goals/60**, rather than the aligned full-WGO or supported-NST **3**. The ixG/ICF/HDCF columns use NST numerator and NST TOI (`BASE:23390-23394`), but still need per-metric support alignment when a partially populated NST row exists. `bool_or(has_nst_counts)` at `BASE:23480` proves any support, not complete support.

**Readers/reach:** NST views feed WiGO's AS source (`supabase/migrations/20261104011002_nst_percentile_as_from_gamelogs.sql:24-69,71-102`), the radar and matrix readers already enumerated in D1. Sustainability's live-code league-reference reader consumes the supposedly safe ixG/ICF/HDCF rates in `web/lib/sustainability/score.ts:29-54`. Other hybrid total columns need an explicit reader inventory; no new visible-user magnitude is asserted.

**Fix/test:** retain metric-specific count/exposure support and coverage. Sum both over the same valid observations; return an explicitly partial estimate with support, or unknown when the full-window contract cannot be met. Do not impute missing counts as observed zeros. Test missing numerator, missing exposure, an entirely missing NST game, a genuine zero with known exposure, and all-missing windows. Check the final WiGO/sustainability payload, not just division-by-zero guards.

### PR-SQL-2. An equal-GP match still lets input order pick the season

**P1, conditional; M-TEAM-002 / D4.** The SQL fan-out is real (`BASE:14237-14238`). The proposed season join is directionally correct, but fixing or retaining the consumer heuristic requires a tie test as well.

`web/lib/projections/queries/team-context-queries.ts:246-255` accepts the first row with the smallest gap and changes the selection only for a **strictly smaller** gap. Its query orders by date alone (`:360-367`). Two same-date NST season rows with the same implied GP but different xGF therefore have no valid season identity.

**Executed actual selector:** standings GP 70; old row `(xGA 140, xGA/GP 2, xGF/GP 2)` and current row `(280,4,4)`. Both imply 70 games. Reversing the input changes the selected xGF/game from **2 to 4**. This is not a claim that this collision has already happened in production.

**Fix/test:** join and expose actual source season/situation rather than infer them from xGA. Verify one logical row per team/season/situation. An unresolved multiple-row state must be explicit and permutation-invariant; a deterministic first-row tie-break would merely make the wrong-season choice repeatable. Keep an independent freshness/completeness guard after the join. Include the existing no-cutoff historical fallback in the fix inventory (`team-context-queries.ts:370-379`, already W1-6 D6), so the season repair does not imply historical replay is safe.

### PR-SQL-3. D3 must repair the shared calendar, not only the SQL score function

**P1, conditional on contaminated requested-season rows; M-UST-004 / M-WIGO-003.** The RPC's season-only filter is confirmed at `BASE:1367-1375`. The visible chart does not render the RPC rows directly:

- `web/components/WiGO/GameScoreLineChart/index.tsx:79-99` maps scores onto `useWigoGameLog`'s dates and makes missing/ambiguous scores null.
- `web/hooks/useWigoGameLog.ts:5-10` calls `fetchPlayerGameLogConsistencyData`.
- `web/utils/fetchWigoPlayerStats.ts:925-944` filters WGO by player, season and `games_played=1`, **without a canonical season/date or game-type validation**. `:953-965` deduplicates game identities but does not validate which season owns them.

Thus a date guard added only to the score RPC removes bad scores but leaves invalid dates in the chart calendar as gaps. Those dates also occupy the 5-/10-game windows. Points and consistency share that calendar. This is a reader-completeness extension of Fable's valid diagnosis, not a newly measured production magnitude.

**Fix/test:** canonical game ID, season, game type and appropriate finality validation must agree between the RPC and shared calendar. Extend the existing chart test (`web/components/WiGO/GameScoreLineChart/index.test.tsx`) with an out-of-season WGO row. It must be absent from both labels and windows, while a valid game with genuinely missing score remains a labelled gap. Keep the latter distinction; never drop all unknown-score games.

## B. Corrections to Fable's claims and proposed fixes

### C1. D5: fallback is observable and does not replace all player estimates with constants

- Missing RPC handling is explicit in `web/lib/projections/queries/skater-queries.ts:470-474`.
- The producer increments `metrics.data_quality.physical_league_totals_unavailable` and emits **`physical_league_totals_rpc_missing:without_league_rescale`** in `web/lib/projections/stages/skater-stage.ts:1581-1595`.
- The existing producer test asserts both at `web/lib/projections/nativeGoalAccounting.test.ts:378-380`; it passed in this review. Query tests distinguish RPC absence from other failures at `web/lib/projections/queries/skater-queries.test.ts:676-695`.
- `web/lib/projections/calculators/skater-adjustments.ts:493-526` falls back for the **league reference and league rescale**, but retains the player's observed history and recent rate. “Constant F/D priors with scale 1” is accurate for that component, not a constant final hit/block estimate.

**Disposition:** retain Fable's reported migration absence and the owner choice about deployment. Remove “silent”, “nothing reports”, and the test request for an already-tested missing-RPC diagnostic (`audits/sql-cross-cut.md:48,152-155`). Verify persisted/run-visible diagnostics if operational visibility remains a concern; their current production presence was not read here. An absent optional migration is not authorization to apply it.

### C2. D4: distinguish FORGE's lag tolerance from the bridge and its fallback

Fable says both readers require a 0.5-game match and a one-game lag causes FORGE to lose the prior (`audits/sql-cross-cut.md:146-150`). That is false:

- FORGE uses **1.5** tolerance (`web/lib/projections/queries/team-context-queries.ts:226,252`). Its existing one-game-lag test (`team-context-queries.test.ts:175-181`) passed. Executed selector fixture: standings 9, implied NST 8, prior retained.
- The bridge uses **strictly less than 0.5**, and rejects multiple matches (`web/lib/rosterScheduleData/forgeDailyBridge.ts:97-101`). However, `:106-117` then blends or installs the previous-season prior. Its loader actually requests that prior at `:784-785`. A missing current match is not necessarily a missing team prior.
- Executed bridge fixture: a one-game-lag row plus a 70-game prior at 3 xGA/xGF per game yields a last-season-only prior with effective xGA 60, rates 3, and `sourceDate:null`.

Retain the cross-season fan-out, stale-source and ambiguity concerns; add PR-SQL-2. Qualify “fails silently” by the actual reader and available fallback. Do not reject a legitimate one-game lag as an arithmetic failure merely to match the audit.

### C3. D15: Human Mock ADP already satisfies its disclosed definition

**Withdraw the human-only labelling defect for M-DRF-002/004.**

`web/components/DraftDashboard/MockAdpBoard.tsx:72-77` says **“Human Mock ADP · Provisional”**, explicit human selections in the last 30 days, equal contributor weighting, bot influence on availability, and **not real-league ADP or Community Rankings**. The SQL computes exactly that: human seat and contribution filter at `supabase/migrations/20260917133519_mock_draft_adp.sql:115-119`, per-user means followed by their mean at `:121-125`, weighted quantiles at `:126-133`, five-contributor minimum at `:138-141`. It is not simply the unweighted mean of all human picks.

There is no universal requirement to include bot choices in a statistic explicitly labelled Human Mock ADP. Including them would change the estimand and can amplify the engine's own priors. Keep selection bias as a disclosed limitation, not a demonstrated SQL formula defect.

The separate **deployment** concern remains Fable-reported. `web/lib/mockDraft/flags.ts:10-12` defaults all three flags off; `web/lib/mockDraft/api.ts:55-67` returns an explicit unavailable state before most RPCs when disabled, and `:155-189` returns errors rather than silently manufacturing ADP. Released/enabled state is unverified. Preserve the separate mixed-source draft-seeding concern (M-DRF-001); this correction does not clear it.

### C4. D7: PP unit share has an explicit conditional denominator

The table's documented contract is **share within player/season/game_type/deployment_group** (`web/supabase/migrations/20260629020121_create_player_lineup_deployment_tallies.sql:284-288`; packet M-LINE-002/004 quotes it). `BASE:3038-3059` implements it. A player observed on PP1 in all three of his PP-unit games correctly has conditional PP1 share 100%, even if he dressed 20 times.

A separate **share of all dressed games** would be 15%, and may be useful, but it is a different measure. Owner decisions 1–68 do not select that denominator; Fable itself lists it as open question 5. Do not install the 0.15 assertion as a mandatory correctness test before that choice.

The **forward-slot defect remains**: `BASE:2908-2918,2933,2942` uses current roster position instead of the line-array slot, drops unsupported positions and can label two centres on one line. Confirm what ordering the producer guarantees before using ordinality as a replacement. Preserve conditional shares or version/add explicitly named dressed-game shares, with known source coverage and a no-unit category, if the owner chooses the latter.

### C5. M-SUS-001: missing-season weight renormalization is not proven wrong

`migrations/20250930_add_baseline_3yr_career.sql:1-3,35` explicitly calls this an illustrative sample. It stores **weighted numerators and weighted TOI**, with identical 0.6/0.3/0.1 weights (`:16-27`), not a weighted mean of already-computed rates.

Renormalizing both sums by the same available weight cancels in the resulting rate. Executed one-season fixture: ixG 2, TOI 1,200; `(0.6×2)/(0.6×1200)×3600 = 6`, identical after dividing both components by 0.6. If these weighted counts are later used as evidence mass, weight normalization is an estimator choice, not an algebraic necessity.

**Disposition:** withdraw “weights are not renormalised” as sufficient proof of the mis-specified verdict (`audits/sql-cross-cut.md:110`). A cutoff-safe, non-overlapping baseline and per-metric matched support still need review before activation (decisions 34/61/68); the view uses latest available seasons and has no cutoff parameter. It is reported not deployed, so do not create a production fix solely for this sample.

### C6. D9 must include OZFO%, and zero exposure extends to M-UST-003

`BASE:20558` uses OZ/(OZ+NZ+DZ) for starts; **`:20559` makes the same mistake for faceoffs**. Decision 9 covers both OZS% and OZFO%. Extend D9's test to both fields and their strength twins. Example: OZ=2, NZ=2, DZ=1 yields 40% today versus the required 66.7%.

The pooled goalie-week league view (`BASE:11806-11809`) also returns 0 when all included goalies have zero shots. Its GAA denominator is positive for included rows, but SV% still needs unknown handling. M-UST-003 is sound only conditional on valid matched coverage and positive SA, not unconditionally exempt from D14.

### C7. D1's remedy needs game identity and source-grain validation

Retain the missing game-type filter (`BASE:20421-20422,20464-20465`) and reported contamination. Narrow the statement **“every completed season is affected now”**: one player's two historical seasons prove those sampled rows, not every player/season. The report already admits ES/PP/PK playoff presence was inferred, not measured (`audits/sql-cross-cut.md:185-186`).

A join on team/date is safe only after proving unambiguous game identity and the historical team of record. NST game-log count rows do not themselves carry that team/game identity (`BASE:5724-5759`), so do not infer it from today's roster. Missing/ambiguous matches should remain an explicit unresolved population.

Fable also reports GP sum 99 from 85 rows. A type/season filter does **not in general repair aggregate rows with GP>1**, duplicate source coverage, or a wrongly attached date. That observation needs a separate source-grain fixture and ingest review; the sample is insufficient to say which rows account for the extra GP. Do not silently divide goals by GP or clamp GP to repair it. The view test must include a same-season regular-season-looking aggregate row and prove it is rejected/quarantined or reconstructed from identified games before aggregation.

### C8. Other boundaries that must survive consolidation

- **Game Score reference:** all-strength goal terms are source-confirmed (`BASE:1364-1365`), but `sat_for=19` versus AS CF=25 is not alone proof the provider's field is exactly 5v5. Preserve that as Fable's source/sample assessment until pinned provider semantics establish it. Retain the formula-scope mismatch for investigation; the estimated +0.05/game is not a measured bias.
- **M-PFC-001:** current-roster candidate selection is explicit (`20260805003121_add_player_forecast_runtime_context_rates.sql:21-31`); it is not automatically wrong for current issuance. It is unsafe as a historical candidate universe. Started-before-cutoff (`:59-60`) is not finality or knowledge-time safety. Query shape supports a potentially broad historical scan, not the assertion that every execution physically scans all rows; no execution plan was inspected here.
- **M-FRG-001/002:** date-bounded is not general point-in-time proof. The opponent matview uses `current_date-500` with no issuance snapshot (`20261019211444_opponent_skater_allowed_by_position.sql:20-24`). The physical-totals RPC's prior-season branch ends at the requested season start, not `p_cutoff` (`20261020211500_forge_league_skater_physical_totals.sql:39-41`); its “strictly before cutoff” claim presumes the cutoff is in/after that season, a relationship the caller's validation does not check (`skater-queries.ts:454-456`). Reject incompatible season/cutoff scopes before any future activation.
- **M-SUS-038:** a unique player/date/window key defeats the specific simultaneous cross-version-row lead; the SQL also filters model/config/season/date (`20260725223034_add_sustainability_version_provenance.sql:325-345`). Tie-splitting under `ntile` is a defined equal-count-bin policy, not intrinsically erroneous. Versioned pre-window reference/population requirements remain; merely partitioning by position will not satisfy decision 68.
- **Cleanup:** D10's “fix or remove columns” and D16's inventory do not authorize removal. Decisions about dormant objects, triggers and tombstones remain separate, with dependency inventory and a reversible plan.

## C. Deployment and reproducibility claims

Fable's “byte-equivalent” language is too strong for its stated method (`audits/sql-cross-cut.md:28,193-217`):

1. Whitespace-stripped hashes establish only the selected normalized text, not byte equivalence. Unconditionally deleting whitespace can even hide differences inside SQL string literals (`'a b'` versus `'ab'`).
2. Function `prosrc` excludes argument/return signatures, language, volatility, `SECURITY DEFINER`, `search_path`, permissions and other execution-relevant properties. Function name plus argument count is not an overload identity.
3. No per-object identity/hash manifest or exact catalog output is retained. Reproduction SQL contains `<scoped names>` and `...`; the two scratch scripts are absent. The 62-view/16-function assertion is therefore reported, not independently reproducible from the committed artifact alone.
4. “Unscanned” statistics since an unknown reset do not prove never used. Static fixed-string search excludes scripts/SQL, computed names and external clients; “no reader found in stated search” is safer than absolute “no reader”.

For any later, separately authorized definition check, retain schema plus full function identity arguments, full `pg_get_functiondef`/view definition, properties/grants relevant to execution, object kind, catalog snapshot time, repo SHA, and a per-object comparison outcome. Use a parser-aware comparison or explicit reviewed differences. No production verification was attempted for this review.

## D. Disposition coverage for all 52 entries

“Retain” below means retain the source/prior-audit finding with the evidence limits above, not a new production validation. Wave 1 mathematics was not repeated merely to inflate coverage.

| Entries | Disposition |
|---|---|
| M-TEAM-001,017 | Retain dormant/not-deployed distinctions; stub/table/cron state is reported. No deletion recommendation. |
| M-TEAM-002 | Retain SQL fan-out. Correct lag/fallback claims (C2), add tie defect (PR-SQL-2), carry W1-6 historical fallback. |
| M-TEAM-003,004,005,033 | Retain Wave 1 legacy Game Grid defect and decision 64. New cron/date claims are reported, not rechecked. Writer activity alone does not prove odds remain visible. |
| M-TEAM-006,034 | Retain limited dormant classification; no new arithmetic finding. |
| M-TEAM-007 | Retain rating-sign issue and conditional stale page reach from W1; no live frequency established. |
| M-TEAM-008 | Keep undetermined TOI provenance, dormant reach reported; do not guess units from the column name. |
| M-TEAM-009 | Retain per-game versus per-60 mismatch; enabled trigger/write counts are reported. Cleanup decision remains open. |
| M-TEAM-010 | Retain Wave 1 own-record/current-date SOS issue, not a new live defect. |
| M-UST-001 | Retain aggregate-GSAA contract violation (decision 10); refresh/usage state reported. |
| M-UST-002 | Retain pooled-rate arithmetic with missing/zero-SA qualification. |
| M-UST-003 | Qualify sound verdict for zero-SA and coverage, C6. |
| M-UST-004 | Retain season-only filter; extend fix to shared calendar, PR-SQL-3. Counts remain dated reported samples. |
| M-UST-005 | Retain absent game-type/finality filters. A configurable exposure/cohort policy is needed; no universal minimum-games value is established. |
| M-UST-006 | Retain game-type/season contamination; add missing support, PR-SQL-1, and source-grain caveat C7. |
| M-UST-007 | Retain tie arithmetic (all-equal cohort returns 1.5) and rate direction review; higher is not better for all defensive fields. Dormancy reported. |
| M-UST-008 | Retain wrong EV denominator and misnamed 5v5-share columns; add hybrid-count and partial-support defects, PR-SQL-1. |
| M-UST-009 | Retain team-of-record requirement (decision 16), without assuming current-team GP can repair historical trades. |
| M-UST-010 | Retain malformed PDO/season-overload findings from the audit; no new reader established. |
| M-UST-038,039 | Retain inherited contamination and rate/unknown issues; include OZFO% and partial support, C6/PR-SQL-1. |
| M-WIGO-001 | Pass-through arithmetic only: not end-to-end sound given inherited source defects. |
| M-WIGO-003 | Retain all-strength goal terms, qualify provider-strength proof/estimated magnitude, C8; shared calendar matters. |
| M-LINE-001 | Retain player-second versus team-clock mismatch if clock share is intended. About 0.2 is a nominal five-skater example, not a hard bound under missing rows or other manpower. |
| M-LINE-002,004 | Retain roster-position slot defect; withdraw dressed-game denominator as already-settled contract, C4. |
| M-LINE-013 | Retain generated pooled-player-second ratio with null guard (`BASE:26007-26020`); not proof of upstream unit allocation quality. |
| M-MISC-001 | Retain z-score arithmetic only; caller/production use not independently established. |
| M-MISC-002 | Retain lack of finality and outcome-population distinction (`BASE:8685-8694`); don't equate team LOSS with an individual goalie's credited loss. |
| M-FRG-001 | Retain bounded current descriptive sums; historical replay needs explicit as-of data, C8. |
| M-FRG-002 | Retain normal-scope pooled formula; qualify scope/cutoff and fallback claims, C1/C8. Not deployed is reported. |
| M-FRG-003 | Retain scoring-rule/population concerns and decisions 41/65; no new live reader established. |
| M-PFC-001 | Retain started-versus-known cutoff concern; current-roster and scan-cost claims need purpose/plan qualification, C8. |
| M-GST-001,003 | Retain defective legacy worker finding from W1-5; an intentional coordinator tombstone is not itself a new wrong-number calculation. |
| M-SUS-001 | Withdraw weight-normalization argument; sample/nondeployed and temporal-contract caveats, C5. |
| M-SUS-002 | Retain baseline-join/blended-contract concern under decision 32; reach reported dormant. |
| M-SUS-037 | Keep undetermined; missing relation does not alone prove which production caller uses the Python fallback. No config read made. |
| M-SUS-038 | Retain reference/population qualification, not a universal tie-equality rule; C8/decision 68. |
| M-SUS-039 | Retain W1 direction mismatch; no new reader established. |
| M-SKO-001,002,003,016 | Retain legacy look-ahead/method concerns; quarantined reach and unverified streak-lag lead stay explicit. No cleanup implied. |
| M-DRF-001 | Retain distinct-source seed precedence concern; W2-5 owns consumer/model consequences. |
| M-DRF-002,004 | Withdraw human-ADP mislabelling/formula allegation, C3. Deployment absence and feature activation remain separate. |
| M-DRF-047 | Retain limited search-rule soundness; not a hockey-model validation. |

## E. Verification and handoff

### Checks actually run

1. Read-only git status, audit commit/stat inspection and source comparisons. Audit and existing source files were not edited.
2. Mechanical per-entry count: 52, matching the original verdict totals.
3. From `web/`, with explicit inert test credentials:

```sh
NEXT_PUBLIC_SUPABASE_URL=https://unit-tests.supabase.invalid \
NEXT_PUBLIC_SUPABASE_PUBLIC_KEY=synthetic-public-key \
SUPABASE_SERVICE_ROLE_KEY=synthetic-service-role-key \
./node_modules/.bin/vitest run \
  lib/projections/queries/team-context-queries.test.ts \
  lib/projections/queries/skater-queries.test.ts \
  lib/projections/nativeGoalAccounting.test.ts \
  components/WiGO/GameScoreLineChart/index.test.tsx --maxWorkers=1
```

Result: **4 files, 161 tests passed** (11 + 110 + 37 + 3). These tests use mocked Supabase/provider boundaries. Existing passing tests are supporting evidence for the corrected claims, not regression coverage for all new findings.

4. Inline Node fixture runner used TypeScript AST extraction of `toFiniteOrNull`, `buildTeamStrengthPriorFromNhlTeamDataRows`, and `teamStrengthPriors` from their source files, transpiled to CommonJS in an isolated VM. Only the source constants 1.5 and 20 were supplied. No imports ran. Reproduction inputs/results:

| Fixture | Actual result |
|---|---|
| Same-date, standings GP=70; rows `{xga:140,xga_per_game:2,xgf_per_game:2}` and `{xga:280,xga_per_game:4,xgf_per_game:4}`; reverse rows | xGF/game **2**, then **4** |
| Standings GP=9; one row xGA=24, xGA/game=3 | FORGE retains implied GP **8** |
| Same lag row for TOR; previous-season `{gp:70,xga:210,xgf:210}` | Bridge returns `{xga:60,xgaPerGame:3,xgfPerGame:3,sourceDate:null}` |
| `.6×2` ixG / `.6×1200` seconds; normalize both by `.6` | **6 per 60** both ways |
| ixG/seconds pairs `(0.6,1200),(null,1200)` with SQL-style coalesce/sums | Published **0.9**; observed-support **1.8**; complete rate unknown |

SQL counterexamples are expression-level synthetic arithmetic, **not an executed PostgreSQL replay or a measured production count**. No full application build, lint/typecheck suite, browser run or production check was necessary for this documentation-only review.

### What should happen before implementation

- Carry the retained SQL defects plus the three additions into the consolidated fix plan, with source-supported versus reported-production evidence kept distinct.
- Remove already-satisfied or unjustified remedies: missing-RPC diagnostic, Human Mock ADP label/bot inclusion, blanket renormalization, and the unapproved dressed-game denominator assertion.
- Keep existing owner decisions authoritative: withheld Game Grid odds/Week Score nudge (64), NST definitions (9/10/15), team-of-record availability (16), cutoff-safe baselines (34/61/68), unknowns preserved, no math-driven deletion.
- A later implementation can use offline identified-game fixtures first. Any production read, migration, data repair, trigger change or deployment requires its own authorized scope. This review requests none.


## F. Deeper causal review and adversarial validation (2026-11-11)

This is a depth pass on PR-SQL-1, C7 and PR-SQL-2, not three additional independent defect counts. It follows admission, storage, aggregation and the relevant consumers, challenges plausible incomplete fixes, and distinguishes a reproduced failure mode from the cause of Fable's historical production sample. Checkout remains `3e81061cb60105e984ae7724365b2d9f22ba6d11`; only this individual review was extended. No production database, provider, application endpoint, migration or deployment was used.

### F1. D1/C7: a game-type filter cannot restore observation identity lost at admission

**Causal chain confirmed in current source:**

1. `web/pages/api/v1/db/update-nst-gamelog.ts:1555-1588` requests a single date and a season/type. However, the parser accepts the returned table's numeric `GP` without establishing that it is one game (`:1357-1459`). It stamps the requested URL date and supplied season onto each row (`:1457-1458`). Player/team/position presence is checked, but the response's team is not retained in the persisted row and no canonical game ID is attached.
2. Its success outcome tests resolved row count against HTML row count (`:1509-1513`), not whether a row is a single identified appearance. `processUrls` passes successful rows directly to `upsertData` (`:1833-1846`), whose conflict identity is `player_id,date_scraped` (`:1163-1165`). The baseline schema permits nullable GP/counts and has no game ID (`BASE:5724-5759`); its unique player/date constraint (`:31693-31695`) prevents a duplicate stored date, not aggregate content hidden inside that date.
3. The season count view then sums the admitted GP and counts (`BASE:20388-20422`). The AS percentile views pass these aggregates through (`20261104011002:24-102`). `sanitizePercentileCohortGp` can replace the selected player's GP or remove other rows' GP (`fetchWigoPercentiles.ts:154-176`), but cannot reconstruct which games contributed to their rates. The selected player's rates and time remain untouched.

**Executed actual-parser counterexample:** fake HTML with valid Player/Position/Team, `GP=2`, `TOI=20:00`, `ixG=1.2` is accepted as `{player_id:123,date_scraped:'2026-10-20',season:20262027,gp:2,toi:1200,ixg:1.2}` with `success:true` and parser outcome `rows_persisted`. No write occurred: this is the parser's returned label, not a claimed database receipt. A valid canonical regular-season game on October 20 would let a date/type join retain this row unchanged. Neither a correct season join nor a unique date proves its two-game content belongs to that game.

**What this proves, and does not:** the current admission path lacks the invariant needed by the season aggregation. It does **not** prove NST returned this HTML in production, that the current URL scheduler chose a wrong season, or that this path created the sampled 99-GP history. The historical cause could be older ingestion, a response with the wrong scope, or another writer. Pinning that incident requires existing response/receipt history or separately authorized source evidence. Do not re-scrape to infer it during this review.

**Required remediation boundary:** validate the requested and returned scope; retain canonical appearance identity, historical team and source receipt; distinguish aggregate/malformed/unresolved rows before accepting them as game logs. A GP-not-equal-to-one check is a useful adversarial gate, not a complete proof: a misdated row can still say GP=1. Missing identity must stay unresolved rather than being attached to the current roster. For stored bad rows, quarantine/reconstruct from identified observations under separate authorization; clamping GP, dividing all counts by GP, or adding only `games.type=2` cannot recover the lost information.

**Regression gate:** start with a known valid one-game HTML fixture and assert unchanged counts, explicit zero and date/game identity. Change only GP to 2, response scope, or canonical identity and assert the row cannot reach the accepted game-log population. Then run valid regular-season, playoff, wrong-season, unmatched and aggregate rows through the view/consumer fixture. The regular-season filter must remove playoffs without accidentally certifying the aggregate row. Verify raw rates and cohort membership, not just the displayed GP.

### F2. PR-SQL-1: SQL null preservation alone leaves a second zero-imputation path

The same missing-support problem reappears independently in the sustainability window consumer. It is not enough to repair `nst_seasonlong_*` or `player_totals_unified`.

**Trace and exact distinction:** `player_stats_unified` left-joins NST by player/date/season (`BASE:23036-23039`); `player_totals_unified` sums its numerators and exposure independently (`:23370-23394`). `fetchSkillLeagueRef` accepts the resulting finite rates without any coverage fields (`web/lib/sustainability/score.ts:29-54`). The window side bypasses the totals matview and reads `player_stats_unified` directly (`:86-94`), then replaces each missing count with zero whenever TOI is positive (`:101-110`). Its one shared denominator cannot express separate ixG, iCF and HDCF support.

The SQL pathways are not identical: the season views use `SUM(COALESCE(metric,0))`; unified totals use `SUM(metric)`. Therefore **all-null positive-TOI ixG stays NULL in unified totals but becomes zero in the season views and in the TypeScript window consumer**. Removing `COALESCE` fixes that all-null SQL case, but not the mixed known/unknown case: `SUM` still silently excludes the missing numerator while retaining its exposure.

**Executed actual `fetchSkillWindowRates` and `zClip`:**

| Input, newest first | Current output | What is known |
|---|---|---|
| Two 1,200-second games, ixG `NULL, 0.6` | ixG/60 **0.9**; with reference μ=1.8, σ=0.9, z=**−1** | The supported game's rate is 1.8; the full two-game rate is unknown. |
| One 1,200-second game; ixG/iCF/HDCF all NULL | Three **0** rates; ixG z=**−2** with the same reference | No observed numerator exists. These are not observed zero production. |
| Nov 10: no NST TOI/counts; Oct 20: 1,200 seconds and ixG 0.6 | ixG/60 **1.8**, `sourceDate:'2026-11-10'`, `appearanceCount:2` | The rate's actual NST observation is Oct 20; the reported date describes the latest WGO calendar row. |

The latter source date may be a legitimate **calendar** cutoff, but it does not establish metric freshness. Likewise `appearanceCount` counts queried rows, not supported metric observations. The problem is not cured by checking that the calendar itself is fresh.

Downstream, `zClip` treats fabricated zeros as numeric (`:162-167`). `buildScoreForPlayerWindow` detects missing skill only when the z is null (`:233-237`), so these cases do not get `missing_skill_window_*` or a true `missing_skill_stats` flag (`:247-263`). `rebuild-score.ts:113-114,195` supplies the league references and persists assembled rows through `upsertScores`. This is a confirmed code path in the legacy blended producer, not a fresh assertion that this retired model should be preserved or is the currently displayed methodology; owner decision 32 still governs replacement.

**Counterexample to a tempting fix:** globally dropping every row with any missing NST metric would avoid false zeros but throw away known iCF/HDCF when only ixG is missing. Conversely, retaining a known numerator with missing TOI inflates the SQL rate. The TypeScript already excludes nonpositive/missing TOI, so preserve that protection. Track each metric's numerator, matched exposure, supported identities and cutoff separately. Choose the contract explicitly: complete-window unknown, or labelled partial observed-support rate. Do not silently present partial support as the complete window or fabricate coverage from `bool_or(has_nst_counts)`.

**Regression gate:** partial numerator, all-null numerator, genuine zero, missing/zero exposure, newer unsupported appearance and different missing fields per metric. Assert rates **and** support/diagnostics at the score payload boundary; a finite answer and a fresh calendar date are insufficient. Validate both the position-group reference and the window estimator so one side is not repaired against a still-contaminated other side. The existing `score.test.ts` tests no-NST-time and entirely absent rows, but does not test positive TOI with a missing numerator. Its **5 tests passed** in this pass, which confirms the coverage gap rather than clearing the defect.

### F3. PR-SQL-2: rejecting ties still admits a uniquely wrong old season

The order-sensitive tie is only one manifestation of trying to recover season identity from a coincidentally similar GP. An ambiguity-only fix can pass permutation tests and still be wrong.

**Executed source-selector and downstream-calculator fixture:** standings GP=70; old-season candidate xGA=140, xGA/GP=2, xGF/GP=2; current-season candidate xGA=276, xGA/GP=4, xGF/GP=4, implying GP=69. Both have the same view date. The old row has gap 0 and current row gap 1, both within the current 1.5 tolerance. In **both input orders**, the current selector chooses the old row. After retaining only the current row through a true season filter, it correctly accepts the one-game lag.

`computeSkaterTeamLevelContextAdjustments` uses both the selected rates **and its total xGA as evidence mass** (`skater-adjustments.ts:257-280`). With all other profiles null, the actual outputs are:

| Selected source | Sample weight | Shot multiplier | Goal multiplier | Assist multiplier |
|---|---:|---:|---:|---:|
| Old season chosen by closest GP | 0.1225 | 0.9962 | 0.9957 | 0.9951 |
| Current season only, one-game lag | 0.1802 | 1.0056 | 1.0063 | 1.0071 |

These are synthetic intermediate multipliers, **not** a measured production forecast error or a promise that final projections change by exactly these percentages. The stage supplies these priors at `skater-stage.ts:1847-1864,1895-1908` and applies the resulting multipliers at `:2197,2282-2287`; later adjustments/allocation also matter. `fetchTeamStrengthPrior` prefers an available configured in-house xG aggregate (`team-context-queries.ts:349-351`), so the faulty fallback does not run for every player or team. The current environment flags, fallback frequency and deployed SHA were not read.

**Why a season join is necessary but not point-in-time sufficient:** `nhl_team_data` exposes only the global latest standings date (`BASE:14196-14198`), not historical snapshots, and labels all joined NST rows with that standings date. Joining `ns.season=ls.season_id` removes the cross-season fan-out given the baseline `(team_abbreviation,season)` primary key (`:32165-32167`), but neither proves source freshness nor supplies past snapshots. A requested earlier cutoff can still hit the no-cutoff retry (`team-context-queries.ts:370-379`). Reporting the standings date as the xG source date cannot reveal stale NST data. Keep requested cutoff, standings date, actual NST season and NST observation/update provenance distinct.

**Regression gate:** exact-season identity first; a current one-game lag must not lose to an old exact-GP match. Test both permutations, an exact tie, missing current season, missing NST xGA, and a historical cutoff with only later snapshots. Require an explicit unavailable/stale/partial state where identity or as-of support is absent. Keep the in-house-prior preferred branch and fallback diagnostics intact. Do not replace the heuristic with a stable first-row choice or merely fail on ties.

### F4. Reproducibility and verification limits for this depth pass

The following compact reproduction is retained here rather than in an untracked scratch script. Run from the repository root. It extracts **only named function/constant AST nodes** from current source, transpiles them with the installed TypeScript package and supplies fixture HTML/query results in a VM. No application module, environment file, Supabase client or provider transport is initialized; `nstGet` is replaced before execution. `cheerio` parses local HTML only. Assertions describe the **present failing behavior**, not acceptance tests for a future fix. After a fix they should fail and be replaced by corrected-contract assertions.

<!-- deeper-review-fixture:start -->
```js
const fs = require('fs'), vm = require('vm'), assert = require('assert/strict');
const ts = require('./web/node_modules/typescript');
const cheerio = require('./web/node_modules/cheerio');
function extract(path, names, bindings = {}) {
  const src = ts.createSourceFile(path, fs.readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);
  const nodes = src.statements.filter(s =>
    (ts.isFunctionDeclaration(s) && s.name && names.includes(s.name.text)) ||
    (ts.isVariableStatement(s) && s.declarationList.declarations.some(d => names.includes(d.name.getText(src)))));
  assert.equal(nodes.length, names.length);
  const code = nodes.map(s => s.getText(src)).join('\n') + '\nmodule.exports={' + names.join(',') + '};';
  const box = { exports: {}, module: { exports: {} }, URL,
    console: { log() {}, warn() {}, error(...args) { throw new Error(args.join(' ')); } }, ...bindings };
  vm.runInNewContext(ts.transpileModule(code, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, box);
  return box.module.exports;
}
(async () => {
  let html = '';
  const parser = extract('web/pages/api/v1/db/update-nst-gamelog.ts',
    ['cleanHeader', 'isDashPlaceholder', 'mapHeaderToColumn', 'getDateFromUrl', 'fetchAndParseData'],
    { cheerio, nstGet: async () => ({ data: html }), getPlayerIdByName: async () => 123 });
  for (const [name, gp, ixg, expected] of [
    ['aggregate', 2, '1.2', 1.2], ['missing', 1, '', null],
    ['dash', 1, '-', 0], ['observed-zero', 1, '0', 0]]) {
    html = '<table><thead><tr>' + ['Player','Position','Team','GP','TOI','ixG']
      .map(x => '<th>' + x + '</th>').join('') + '</tr></thead><tbody><tr>' +
      ['Fixture Player','C','TOR',gp,'20:00',ixg].map(x => '<td>' + x + '</td>').join('') +
      '</tr></tbody></table>';
    const got = await parser.fetchAndParseData('https://fixture.invalid/?fd=2026-10-20',
      'allStrengthsCounts', '2026-10-20', '20262027', 1);
    assert.equal(got.success, true); assert.equal(got.outcome, 'rows_persisted');
    assert.equal(got.data[0].gp, gp); assert.equal(got.data[0].ixg, expected);
    console.log('parser', name, JSON.stringify(got.data[0]));
  }
  const score = extract('web/lib/sustainability/score.ts', ['fetchSkillWindowRates', 'zClip']);
  const row = (date, toi, ixg, icf = 2, hdcf = 1) =>
    ({ date, nst_toi: toi, nst_ixg: ixg, nst_icf: icf, nst_hdcf: hdcf });
  for (const [name, data, expected] of [
    ['partial', [row('2026-11-10',1200,null), row('2026-11-09',1200,0.6)], 0.9],
    ['all-missing', [row('2026-11-10',1200,null,null,null)], 0],
    ['newest-unsupported', [row('2026-11-10',null,null,null,null), row('2026-10-20',1200,0.6)], 1.8],
    ['known-count-missing-time', [row('2026-11-10',null,10), row('2026-10-20',1200,0.6)], 1.8],
    ['observed-zero', [row('2026-11-10',1200,0,0,0)], 0]]) {
    const q = { select() { return this; }, eq() { return this; }, lte() { return this; },
      order() { return this; }, limit: async () => ({ data, error: null }) };
    const got = await score.fetchSkillWindowRates(123, '2026-11-11', 10, { client: { from: () => q } });
    assert.equal(got.ixg60, expected); assert.equal(got.sourceDate, '2026-11-10');
    assert.equal(got.appearanceCount, data.length);
    console.log('window', name, JSON.stringify(got), 'z', score.zClip(got.ixg60,1.8,0.9));
  }
  const select = extract('web/lib/projections/queries/team-context-queries.ts',
    ['toFiniteOrNull','buildTeamStrengthPriorFromNhlTeamDataRows','NHL_TEAM_DATA_GP_MATCH_TOLERANCE']);
  const nums = extract('web/lib/projections/utils/number-utils.ts', ['clamp','finiteOrNull']);
  const names = ['TEAM_XG_BASELINE_PER_GAME','TEAM_5V5_PDO_BASELINE','TEAM_5V5_SAVE_PCT_BASELINE',
    'TEAM_NST_XGA_PER60_BASELINE', ...['SHOT','GOAL','ASSIST'].flatMap(stat =>
      ['MIN','MAX'].map(bound => `SKATER_TEAM_LEVEL_${stat}_${bound}_MULTIPLIER`))];
  const constants = extract('web/lib/projections/constants/projection-weights.ts', names);
  const calc = extract('web/lib/projections/calculators/skater-adjustments.ts',
    ['normalizeRateOrPercent','computeSkaterTeamLevelContextAdjustments'], { ...nums, ...constants });
  const old = { date:'2026-11-10', games_played:70, xga:140, xga_per_game:2, xgf_per_game:2 };
  const current = { ...old, xga:276, xga_per_game:4, xgf_per_game:4 };
  for (const rows of [[old,current],[current,old]])
    assert.equal(select.buildTeamStrengthPriorFromNhlTeamDataRows(rows).xgfPerGame, 2);
  for (const [name, rows, expectedGoal] of [
    ['old-selected',[old,current],0.9957], ['season-filtered',[current],1.0063]]) {
    const got = calc.computeSkaterTeamLevelContextAdjustments({
      teamStrengthPrior:select.buildTeamStrengthPriorFromNhlTeamDataRows(rows),
      opponentStrengthPrior:null, teamFiveOnFiveProfile:null, opponentFiveOnFiveProfile:null,
      teamNstProfile:null, opponentNstProfile:null });
    assert.equal(got.goalRateMultiplier, expectedGoal);
    console.log('context', name, JSON.stringify(got));
  }
})().catch(error => { console.error(error); process.exit(1); });
```
<!-- deeper-review-fixture:end -->

Additional check run from `web/`: `NEXT_PUBLIC_SUPABASE_URL=https://unit-tests.supabase.invalid NEXT_PUBLIC_SUPABASE_PUBLIC_KEY=synthetic-public-key SUPABASE_SERVICE_ROLE_KEY=synthetic-service-role-key ./node_modules/.bin/vitest run lib/sustainability/score.test.ts --maxWorkers=1`. Result: **1 file, 5 tests passed**, 358 ms. This supplements, and does not rerun or relabel, the earlier 161-test result. No PostgreSQL engine replay was performed; SQL semantics and lineage were inspected, while the parser, window and selector/calculator fixtures above execute actual extracted TypeScript.

SHA-256 pins of the principal source bytes used:

| Source | SHA-256 |
|---|---|
| `web/pages/api/v1/db/update-nst-gamelog.ts` | `b2d81075043e45a22bb12ae62be8aff7d804ece1faa64596e322fd328cd5c750` |
| `web/lib/sustainability/score.ts` | `e9b2f976e1d245bfbea4193a390508aec5fbe36d3e67a79f75047b346db9457d` |
| `web/lib/projections/queries/team-context-queries.ts` | `8b8e8523431b0b94d24059e92c42130ab8cf01ec6382acd64804a17cecd84939` |
| `web/lib/projections/calculators/skater-adjustments.ts` | `258e9b4699d01ccdc89a30d746cc6332f3c708210c4598c69fe7c8f47f2ba9b6` |
| `BASE` | `27067d2221516be147d5cf71492b1fee3f0fd377d0ccd14e49557931ad1b791d` |

**Implementation ordering:** first establish source identity/grain and metric support, then repair aggregation, then verify consumer admission, diagnostics and cohort consequences. Separately repair team-season identity and cutoff-safe provenance before tuning tolerance. No new coefficients, production prevalence, deletion, migration or backfill authorization is implied. The unresolved historical-cause and deployed-state questions are explicit evidence limits, not blockers to this completed offline review.
