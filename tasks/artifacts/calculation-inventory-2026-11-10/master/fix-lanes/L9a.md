# L9a · FORGE skater path, context, uncertainty and markets

**Stage 3 (models).** Depends on: L1 (predicate), L4a (`nhl_team_data` season key), L6 (rolling count fields). Validates FORGE's band reader with L7 (decision 26); reviews L12's change to `pages/api/v1/forge/players.ts`. Read `_COMMON.md` first. Codex's 2026-11-04 reservation pattern covers `web/lib/projections/**`: do the claim step in `_COMMON.md` rule 3 before editing.

## Owned files
`web/lib/projections/**` **except**: L9b's goalie files (listed in L9b.md), `verifiedForgeReleases*` and `forgeProducerIdentity.ts` (Codex). Includes `run-forge-projections.ts`, `stages/{skater,metrics-finalization,persistence,preflight}-stage.ts`, `calculators/{skater-adjustments,team-context-adjustments,scenario-blending}.ts`, `queries/{skater,team-context,market,line-combo,run-lifecycle}-queries.ts`, `utils/**`, `derived/**` except `buildGoalieGameV2.ts`, `ingest/**`, `research/**`, `uncertainty.ts`, `seasonBootstrap.ts`, `reconcile.ts`, `dispersion.ts`, `promotionGates.ts`, `rosterEvents.ts`, `accuracy/**`, `researchGameGoals.ts`. Also `web/pages/api/v1/forge/{forecasts,accuracy,roster-events}.ts`, `web/scripts/fit-forge-dispersion.ts`, `web/scripts/forge-counterfactual-backtest.ts`.

## Findings
| ID | P | Reach | Fix (corrected wording) | Source |
|---|---|---|---|---|
| W1 P0 #18 | P0 | live | Skater lines omit the explicit **PK bucket** (not "all EA/EN"): all-situation totals ES+PP+PK+extra-attacker with EN goals in their own named bucket, built from **mutually exclusive** strength × net-state × regulation/OT buckets so EN is never counted twice (decision 24); TOI split ES/PP/PK reconciling to total (`proj_toi_pk_seconds`, decision 59). | BC §W1-6 B (D1), C; §W1-7 C |
| W1 P0 #19 | P0 | live | Hits and blocks count PK time twice: derive ES/PP/PK/EA seconds from manpower and apply physical rates once. 18,000 s is nominal, not a law; drop "exactly 300 minutes". | BC §W1-6 B (D4); §W1-7 |
| W1 P0 #21 | P0 | live | Opponent-goalie adjustment: fixed .900 GSAA, unshrunk, clamped after mixing (largest goal lever). Build a **shared, independently estimated goalie-quality input** (not FORGE's own modelled SV%: circular, `run-forge-projections.ts:1035-1050`); NST GSAA stays descriptive (decision 10); give the shrunk predictive feature its own name; fit on held-out games. | BC §W1-6 B (D3), D |
| BC W1-6 A1 / W1-7 N1 | P1 | cond. | Season bootstrap re-splits after reconciliation (3 → 3.857 shots); candidate intervals use pre-bootstrap scenario lines: reconcile final serialized heads (or bootstrap first); apply bootstrap to each scenario. Test final outputs (rule 7). | BC §W1-6 A, §W1-7 A |
| BC W1-6 A2 | P1 | live | Known zero-shot history loses exposure (`skater-adjustments.ts:643-645`, `(0,0)` = `(null,null)` = 6.62): pass matched seconds; also `reserveProjections.ts:67-72` (tell L9b). | BC §W1-6 A |
| BC W1-6 D5 / BA W1-3 D3 | P1 | live | Evidence weight: only the TOI component is mis-scaled; refit scale, scope, thresholds and the second shrink together; monotonicity test (the call-up test is withdrawn). | BC §W1-6 B (D5); BA §W1-3 B |
| BC W1-6 D6 / W1-7 D8 | P1 | live | NST team xGA/60 60× low (3 xGA / 3600 s → .05); WGO seconds-as-minutes normalizer has **two** copies (`queries/skater-queries.ts:142-147,529-532`): declared adapters. PDO is not in the goal multiplier. | BC §W1-6 B (D6), §W1-7 A |
| W2-1 PR-SQL-2/F3, C8 | P1 | cond. | `team-context-queries.ts:226,252` accepts a 1.5-game gap and infers season: join on L4a's exact season key; physical-totals RPC ignores `p_cutoff` for the prior season (guard before Q3). | W2 §W2-1 B, A D5 |
| W2-6 §1 | P1 | live | FORGE event counts and PP exposure in one strength row use incompatible classifiers (`ingest/shifts.ts` raw counts vs `derived/situation.ts`): one classifier (adopt L1's predicate where it fits). | W2 §W2-6 B |
| BC W1-6 D16 / M-FRG-010 | P1 | live | Null fantasy points ranked as 0 (`[120, null, −4]` → `[1,2,3]`): nulls unranked. | BC §W1-6 B |
| BC W1-6 M-FRG-017 | P1 | live | Null-actual coercion, latest-team PP history (decision 16), PP over-allocation 1,400 vs 1,200 target. | BC §W1-6 B (D28) |
| BC W1-7 N2, N3, N4 | P1/P2 | live/offline | Zero own-goal mean collapses assist distribution (`uncertainty.ts:362-369`); dispersion `n/(n−1)` with unequal exposures; residual TOI variance compounding. | BC §W1-7 A |
| BC W1-7 D5 | P1 | live | Bands → "typical range" with real coverage, exact quantiles **preserving the scenario/TOI mixture** (not one NB), PIT and interval score (decision 29). | BC §W1-7 B, C |
| BC W1-7 D7 | P1 | live | Pool guard `min(18000, n × 1200)` rejected: completeness gate or constrained allocator with explicit infeasibility. | BC §W1-7 B |
| BC W1-7 D2 | P0 cond. | cond. | Scratch tweets as 30-hour injuries; default L3/PP2 tags: scratches scoped to a game id, injuries end on RETURN, "if he plays" line + 0 expected (decision 31). First step: bounded `forge_roster_events` count (approval). | BC §W1-7 B (D2); decision 31 |
| BC W1-6 D4b, D17, D18; W1-7 D6; W3-4 N2 | P1 | dormant | Spread flag sign (+2.30 vs −0.70); yes-only de-vig discontinuity (`utils/devig.ts`); `confidence_0_to_100` saturates on a wrong-way flag (`market-output-builders.ts:77-90,590`): cover probability vs de-vigged price per book, monotone de-vig (decision 30); name the stored quantity honestly (a literal rename creates a new unit error). Blocks resuming odds ingestion. | BC §W1-6 B, §W1-7 B; W3 §W3-4 A N2 |
| BC W1-9 A7 / decision 26 | P1 | inert | FORGE band reader (`queries/skater-queries.ts:643-694`, `utils/trend-adjustments.ts:69-109`) uses own-value-vs-own-interval: regress toward the band, size fitted; validate with L7's redesign before it switches on. | BC §W1-9 A |
| BC W1-6 D8, D13, D14 | P2 | live | Goalie SA context baseline may be non-zero; residual home term only for the non-market branch; assist allocation: drop the ±5% gate. | BC §W1-6 B |
| W3-4 N3, N4, N5 | P2 | research | `research/skater-candidates/context.ts` shot volume moves goals not assists; MAE-only folds → squared error/deviance primary (decision 65); opponent blend: compare fitted forms. Before any promotion only. | W3 §W3-4 A, E #3 |
| Decision 27 | — | model | Opponent and venue shot terms fitted on held-out games: backlog item; implement only with a held-out evaluation. | decision 27 |

## Decisions and rules
10, 16, 24, 25, 26, 27, 28, 29, 30, 31, 59, 65; rules 7, 9, 11, 12, 13, 17. **Traps:** P(start) × E[start] is not the unconditional goalie line (L9b); 1 − ∏(1 − p) is only an independence formula; Fable's coefficients are hypotheses.

## Readers and tests
Readers: FORGE skater rows (`/api/v1/forge/players`, L12 serves), fantasy points, served ledger (L10), RSO bridge (L11), Start Chart (L9b), goalie win λ (L9b), game-prediction FORGE features (L22). Tests at the final serialized payload: PK bucket present and totals reconcile; physical rates applied once over manpower seconds; zero shots at increasing exposure falls toward zero; null rank; NST 3/3600; spread fixture −0.70.

## Production steps (TJ approval)
Reconcile held rolling/FORGE writes before any FORGE rerun; bounded `forge_roster_events` count; any column add for `proj_toi_pk_seconds` (migration via L4a's pattern); physical-totals migration (Q3); FORGE rerun after landing.

## Tier B questions (Chef asks at start)
Q3 physical-totals migration timing.

## Out of scope
Goalie stage and starters (L9b); `run-projection-accuracy.ts` and `update-goalie-projections-v2.ts` (Codex: write proposals); ledger (L10).

## Done
Three P0s fixed and proven on final payload fixtures; market items fixed behind their dormant flag; research items listed as backlog.

## Reader tickets from L4a (2026-11-11; migrations 125–132 written, unapplied)
`nhl_team_data` (migration 129) becomes one row per team with `nst_season` and `nst_updated_at`; NST columns NULL when the standings season has no NST row; per-game values NULL at 0 GP. Join on `nst_season` in `team-context-queries.ts`.
