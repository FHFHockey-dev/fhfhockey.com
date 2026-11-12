# Wave 2: Fable audits merged with Astra peer reviews

Claude (consolidation session for Chef), 2026-11-11, `octoberBranch` at `ef5b14562`. This file is the authoritative reading of Wave 2 for the fix sprint wherever an audit and its review disagree. The original audits and reviews are **not edited**. Nothing here authorizes implementation, production reads or writes, refits, rebuilds, migrations, env changes or deployment.

## Inputs

| Pass | Fable audit (commit) | Astra review (commit) |
|---|---|---|
| W2-1 SQL cross-cut | [audits/sql-cross-cut.md](audits/sql-cross-cut.md) (`7988a1fef`, source `6d574deab`) | [w2-1-sql-cross-cut.md](W1-Astra-PR/w2-1-sql-cross-cut.md) (`356d79a53`) |
| W2-2 Underlying stats, part 1 | [audits/underlying-stats-summaries-part1.md](audits/underlying-stats-summaries-part1.md) (`3e81061cb`) | [w2-2-underlying-stats-part1.md](W1-Astra-PR/w2-2-underlying-stats-part1.md) (`356d79a53`) |
| W2-3 Underlying stats, part 2 | [audits/underlying-stats-summaries-part2.md](audits/underlying-stats-summaries-part2.md) (`5bfdc98c4`) | [w2-3-underlying-stats-part2.md](W1-Astra-PR/w2-3-underlying-stats-part2.md) (`356d79a53`) |
| W2-4 Rankings, part 1 | [audits/rankings-part1.md](audits/rankings-part1.md) (`576dc57a3`) | [w2-rankings-part1.md](W1-Astra-PR/w2-rankings-part1.md) (`ef5b14562`) |
| W2-5 Draft tools | [audits/draft-tools.md](audits/draft-tools.md) (`68d907dc2`) | [w2-draft-tools.md](W1-Astra-PR/w2-draft-tools.md) (`ef5b14562`) |
| W2-6 Lines, TOI, PP units | [audits/lines-toi-pp-units.md](audits/lines-toi-pp-units.md) (`1ef2e55ae`) | [w2-lines-toi-pp-units.md](W1-Astra-PR/w2-lines-toi-pp-units.md) (`ef5b14562`) |
| W2-7 Player forecasts, season part 2 | [audits/player-forecasts-season-part2.md](audits/player-forecasts-season-part2.md) (`76b25fb8f`) | [w2-player-forecasts-season-part2.md](W1-Astra-PR/w2-player-forecasts-season-part2.md) (`ef5b14562`) |
| W2-8 Player forecasts, season part 3 | [audits/player-forecasts-season-part3.md](audits/player-forecasts-season-part3.md) (`82856e0b1`) | [w2-player-forecasts-season-part3.md](W1-Astra-PR/w2-player-forecasts-season-part3.md) (`ef5b14562`) |
| W2-9 BLSH | [audits/blsh-buy-low-sell-high.md](audits/blsh-buy-low-sell-high.md) (`aa264b4bc`) | [w2-blsh-buy-low-sell-high.md](W1-Astra-PR/w2-blsh-buy-low-sell-high.md) (`ef5b14562`) |

Binding context: [RULES-DIGEST.md](RULES-DIGEST.md) (decisions 1–68, rules 1–12), [OWNER-DECISIONS.md](OWNER-DECISIONS.md), [BATCH-A-CONSOLIDATED.md](BATCH-A-CONSOLIDATED.md), [BATCH-BC-CONSOLIDATED.md](BATCH-BC-CONSOLIDATED.md), [FIX-SPRINT-PLAN.md](FIX-SPRINT-PLAN.md).

## How the merge was done, and its limits

- Each audit was read for its summary, defect list and owner questions; each review for its verdict, additions, corrections and disposition table. Deep-dive sections (Astra's "deeper review" passes) were read for their conclusions and fixtures, not re-run.
- **Where Fable and Astra disagree, both views are recorded with their evidence.** Astra's correction wins only where it rests on stronger evidence: an executed fixture through the actual source function, or a traced call graph that contradicts a Fable claim. Fable's production samples stand as dated samples where Astra could not re-read them (Astra made no database reads in any review).
- **Evidence labels** (as in Batch B/C): *Reproduced* = the actual source function was executed on synthetic inputs (by Astra unless stated). *Source-confirmed* = the code path was traced but not executed. *Reported* = a Fable production read or scratch script not retained in the repo; per rule 1 it is a dated sample with its n, not a population rate.
- **Verdict tallies** (sound / mis-specified / wrong / undetermined) are Fable's own classifications. Every review declined to certify them; they are quoted for orientation only.
- This consolidation made **no database reads, no network calls and no code execution**, and used no sub-agents. Nothing was re-measured here. File references are as the audits and reviews give them (paths under `web/` unless shown otherwise); line numbers may have drifted.
- Two pairs of findings are the same code seen from two packets: W2-2 D1 = W2-3 D1 (strength string reversed) and W2-2 D4 = W2-3 D2 (team score-state time). Each is written up once, under W2-2, and cross-referenced from W2-3.

---

## New cross-cutting rules for the fix plan (13 onward)

Rules 1–12 apply unchanged. Each rule below was raised by Astra in two or more Wave 2 reviews.

13. **A count and its exposure must come from the same observations.** Summing numerators and denominators independently, coalescing a missing count to zero while keeping its time, or keeping a count whose time is missing, produces a confident wrong rate. Report a full-window rate only when every required field is known; otherwise return unknown, or an explicitly labelled covered-subset rate with its coverage. Raised in W2-1, W2-2, W2-3, W2-4, W2-6, W2-7, W2-9.
14. **A fix is proven at the served reader, not at the writer.** "Rebuild the summaries" is not a repair instruction. Name the reader, the storage keys it selects, the input and formula revisions, the expected rows and the observed recomputed output. Legacy-migration and snapshot-seeding paths copy old values without recomputing; a payload-version bump can silently drop data; a hash update cannot admit a new method. Raised in W2-1, W2-2, W2-3, W2-9.
15. **Identities that hold by construction are not acceptance tests.** Mirror sums (home PP-for = away PK-against, Σ finishing luck + Σ save luck = 0), share × total = part, and a normaliser's a'Va = 1 all pass when the defect is symmetric or the model is wrong. Use oriented fixtures whose correct answer differs from the defect's answer, plus held-out checks (rule 11). Raised in W2-2, W2-3, W2-4, W2-9.
16. **A disclosed, coherent alternative estimand is not a defect, and a fail-closed null is not a defect.** Before calling a formula wrong, check its declared label and contract. If the label is honest, the finding is a product or labelling question for the owner. Do not replace a safe null with a partial ratio. Raised in W2-1 (C3 Human Mock ADP, C4 conditional PP share, C5), W2-2 (R4, R6), W2-3 (C2, C4), W2-4 (MCM disclaims "percentile"), W2-5 (6.3), W2-6 (D5 both denominators valid), W2-8 (PR9), W2-9 (R2).
17. **Units are declared by adapters, not guessed from magnitudes.** Write the conversion explicitly (GA × 60 ÷ TOI minutes, or GA × 3600 ÷ TOI seconds). A range check ("TOI per game above 65 must be seconds", "five skaters is the PP ceiling") is an alarm, never the conversion rule: relief stints, 6-on-4 and 4-on-3 break it. Raised in W2-2, W2-3, W2-4, W2-6.
18. **Reach is established from the traced call graph.** A zero-row table estimate (`n_live_tup`), a grep that finds no page, or a passing component test proves neither live nor dormant. Trace the route, flags and admission branch, and say which was traced. Raised in W2-3, W2-5, W2-7, W2-8, W2-9.
19. **Game dates are NHL schedule dates, and finality comes from a game state.** UTC calendar days split a slate and mis-flag back-to-backs. "Start + 8 h" is a heuristic, not proof a game is final. Changing the date basis is a versioned contract change shared by every consumer (issuance, replay, bridge, coverage, planning, evaluation). Raised in W2-3, W2-7, W2-8.
20. **Rank and selection must not depend on input order or display sort.** Ties need an explicit competition or dense rank; a heuristic that picks "the first row with the smallest gap" must become an identity join; quality rank must not flip when the user reverses the sort. Raised in W2-1, W2-2, W2-3, W2-4.
21. **Issued evidence stays as issued; repairs are versioned successors.** Do not loosen a validator, rewrite a preregistered verdict or relabel a historical artifact to make new data pass. Keep the old artifact as historical, and admit the new method through a reviewed successor contract. Raised in W2-7, W2-8, W2-9.

---

## Wave 1 items that Wave 2 confirms, contradicts or extends

| Wave 1 item | What Wave 2 adds | Effect |
|---|---|---|
| **P0 #2** bucket-heuristic xG (decisions 6, 12) | New reader: rankings team matrix style and luck (W2-4 D2). Reported alarms: team 5v5 xG 87% above goals (568 team-games); all-strength 1.57× (106 games, W2-3). Astra: partial totals accepted (W2-4 A1); Σ luck = 0 is not calibration. | **Extends**; W2-P0-10. |
| **P0 #4** score-state filters (W1-2 D1) | The team summary writer is a separate copy: zero or partial score-state TOI; Leading/Trailing exclude one-goal margins (W2-2 D4 = W2-3 D2). | **Extends**; W2-P0-5. |
| **P0 #5** "GSAA" = xGA − GA (decision 10) | More readers: doubled MD/LD buckets (W2-2 D2); variance page and roster-matrix fallback sum per-game GSAA (W2-2 D6, R2); rankings goalie matrix (W2-4 D1); bucket and parity xG are different recipes (Astra W2-2 E2). | **Extends**. |
| **P0 #7**, W1-2 D12 NST definitions, OZS% (decision 9) | SQL rates views include neutral-zone starts **and faceoffs** (W2-1 D9, Astra C6); WiGO percentile views inherit (W2-2 D11). | **Extends** to SQL. |
| **P0 #9**, W1-3 D1 seconds vs minutes | Rankings GSAA/60 60× (W2-4 D1); roster-matrix GAA 60× (W2-2 D7); `goalie_totals_unified` (W2-2 D16); `TOI.ts` integer minutes → NaN (Astra W2-3 A5). | **Extends**; rule 17. |
| **P0 #10** luck reads a per-60 rate as a count (W1-3 D2) | Second reader: last-N GAx and Unrealized xG (W2-4 D4). Astra: the index is **not** sign-inverted; −0.45 (n = 61) is an alarm; a matched neutral fixture publishes 65, not 100. | **Extends**, **corrects** "inverted"; W2-P0-11. |
| W1-3 D6 PP share reconstruction | Fable: M-RNK-057 inherits it. Astra: PP points/60 uses the player's own PP TOI; withdrawn. | **Contradicts** a W2 claim. |
| Decision 17 xS% | Rankings xS%/SAX% divide by iCF under a "verified Fenwick" flag (W2-4 D5). | **Extends**. |
| **P0 #13** PP/PK from one game (W1-4 D3) | Landing PP%/PK% read the same single row; no season bound; order-dependent ties (W2-2 D5, PR-U5). | **Extends**; W2-P0-6. |
| **P0 #14** Game Grid odds (decision 64) | Cron 390 active and `expected_goals` updated 2026-11-11 (reported, W2-1 D2): decision 64 not yet in the data path. | **Confirms**; add cron and readers. |
| W1-4 D11, W1-6 D6 `nhl_team_data` season join, no-cutoff fallback | Fan-out per NST season (W2-1 D4). Astra: FORGE tolerates a 1.5-game lag, the bridge falls back to last season; equal-GP ties and a uniquely wrong old season can win (PR-SQL-2, F3). | **Extends**, with corrections. |
| W1-5 credited start, decision 40 | Splits QS uses .910 (W2-4 D9); line card shows team result and unknown = win (W2-6 D2); season goalie heads unreconciled (W2-8 D12); `gameOutcomes` no finality (W2-1 D11). | **Extends** readers. |
| W1-5 / W1-7 starter mass over 1 | Bridge rounding to 4 decimals trips the 1.000001 tolerance and nulls all lines (W2-8 D2; 12.6% of simulated three-way draws). | **Extends**. |
| **P0 #18** skater lines omit PK (Astra-narrowed) | Fable W2-9 D8 repeats "FORGE omits extra-attacker production"; Astra W2-9 R5: already corrected in Wave 1. | **Confirms the correction**. |
| W1-6 D15 PP segments, two classifiers | Reported 5.96 vs 4.97 PP player-seconds per PP second (316 team-games); 77 over-team cases (W2-6 D1). Astra: counts and exposure in one row use different classifiers; 5 is not a ceiling. | **Extends**; W2-P0-13. |
| W1-6 M-FRG-002 physical totals | Migration reported unapplied (W2-1 D5); Astra C1: FORGE reports the missing RPC and keeps player history. | **Corrects** "silent". |
| W1-8 D6 ledger basis (decision 41) | 0 of 11,547 rows `dressed = false` (reported, W2-8 D1); Astra: row-count receipts unsafe, and the count scorer keeps its dressed filter (PR1, PR2). Naive "last 5" uses 10 starts; missing team win = 0.5 (W2-7 D6). | **Confirms, extends**. |
| W1-8 PR-P10, M-PFC-004 | TS twin returns SV% 0, GAA 0 (W2-8 D11); feature champion picked by `is_champion` (W2-7 D10). | **Confirms, extends**. |
| W1-9 league reference (decisions 32, 68) | `sustainability/score.ts` zero-fills missing counts at positive TOI (Astra W2-1 F2). | **Extends** (legacy producer). |
| **P0 #27** no-line zeros | Calendar coverage counts a zeroed unknown-goalie line as eligible, 3 of 3 (W2-8 D3, PR4). | **Extends**. |
| **P0 #30** category z (decision 62) | Draft readers: whole-pool VORP and tiers, mean-z standings, points-based draft winner, "percentile" tooltip (W2-5 D6); points unknown → 0 (W2-5 §4.2). | **Extends**. |
| W1-12 D5 off-night (decision 53) | Draft's raw off-night count is disclosed, not a multiplier (Astra W2-5 §6.3). | **Qualifies**. |
| Decision 65 proper scores | MAE in season selection, settlement composite (zero scores about 89), draft source accuracy, BLSH rule, walk-forward pilot (W2-7 D2, W2-5 D1, W2-9 D5). | **Extends**. |
| Batch A rule 5 | About a dozen new unknown-as-value sites, listed under each pass and in the defect map. | **Confirms** rules 5 and 13. |

---

## How each pass section reads

- **Verdict:** the merged reading in one paragraph.
- **A. Fable P0/P1 defects and Astra's disposition:** *confirmed*, *corrected* (wording given), *downgraded* or *withdrawn*.
- **B. Astra's new findings:** now part of the defect list.
- **C. Rejected or replaced tests** (rule 11, and rules 15–17 above).
- **D. Reach:** live, conditional, dormant or research (rule 8), with what was traced.

---

## W2-1 · SQL cross-cut ([audit](audits/sql-cross-cut.md), [Astra](W1-Astra-PR/w2-1-sql-cross-cut.md))

**Verdict.** Keep the SQL lineage and aggregation concerns; do not adopt the audit unchanged. The season-view contamination, `nhl_team_data` fan-out and Game Score season filter are real. Fable's "silent fallback", Human Mock ADP mislabelling and short-history renormalisation claims are contradicted by the code. The PP-share denominator is an existing, explicit conditional contract. Fable's "byte-equivalent to production" is reported, not reproducible: whitespace-stripped hashes miss differences inside string literals, function signatures and properties, and no per-object manifest was retained (Astra §C).

**A. Fable defects and dispositions**

| Fable | Finding | Fable priority | Astra disposition |
|---|---|---|---|
| D1 | NST season-long views (`*_counts`, `*_counts_oi`) include playoff and mis-tagged games (M-UST-006, 038, 039; M-WIGO-001). Reported: player 8478402, 2026-11-11, season 20242025 GP 99 and 36 goals against 67 GP / 26 goals regular season; 85 game-log rows (67 regular, 17 playoff, 1 unmatched). Current season clean (19 of 19). | P0 | **Confirmed, narrowed (C7).** "Every completed season is affected" becomes "the sampled rows (one player, two seasons) are affected". A team/date join is safe only after proving game identity and historical team; a type filter cannot repair rows whose GP > 1. **F1 (reproduced):** the NST game-log parser accepts a row with GP = 2 as one game and stamps the requested date and season; the unique key `player_id,date_scraped` hides aggregate content. Remedy moves upstream: validate requested and returned scope, keep canonical appearance identity, and quarantine aggregate rows. |
| D2 | Game Grid legacy views remain live; cron 390 active (reported). | P0 (= W1 P0 #14) | **Confirmed** as Wave 1 + decision 64; cron and `expected_goals` facts reported, not rechecked. Writer activity alone does not prove odds are visible. |
| D3 | Game Score RPC filters `wgo_skater_stats` by `season_id` only; 20242025 label carries rows dated 2010–2017 (reported: 91 of 158, 452 of 517, 340 of 420 rows out of season for three players). | P1 (conditional on season) | **Confirmed and extended (PR-SQL-3).** The chart's calendar comes from `fetchWigoPlayerStats.ts:925-944`, which has the same season-only filter; fixing the RPC alone leaves invalid dates as gaps that occupy the 5- and 10-game windows. |
| D4 | `nhl_team_data` returns one row per stored NST season (96 rows for 32 teams, reported). | P1 | **Confirmed, reader facts corrected (C2).** FORGE accepts a 1.5-game gap (`team-context-queries.ts:226,252`), so a one-game lag keeps the prior. The bridge requires < 0.5 and falls back to last season's prior. See PR-SQL-2 and F3 for the new failures. |
| D5 | Unapplied migrations: FORGE physical totals run on "constant F/D priors, scale 1" silently; mock-draft ADP has no backing objects. | P1 | **Corrected (C1).** FORGE emits `physical_league_totals_rpc_missing:without_league_rescale` and the test asserts it; player history and recent rate still enter. Withdraw "silent", "nothing reports" and the requested diagnostic test. The migration absence and its owner choice stand (reported). |
| D6 | Game Score goal terms are all-strength; the reference uses 5v5. | P1 | **Qualified (C8).** All-strength goal terms are source-confirmed. The claim that `sat_for` is exactly 5v5 rests on one sample; the +0.05/game is an estimate, not a measured bias. Owner question Q2. |
| D7 | Lineup deployment share uses a per-group denominator; forwards labelled by roster position. | P1 | **Split.** Denominator **withdrawn as a defect (C4)**: the table documents "share within player/season/game_type/deployment_group"; 100% conditional PP1 share over 3 PP-unit games is correct. A dressed-game share is a different measure (owner question Q4). Forward-slot defect **confirmed**: current roster position, not line slot, can label two centres on one line. |
| D9 | OZS% includes neutral-zone starts in `nst_seasonlong_*_rates_oi`; zero denominators return 0, 50, 100. | P2 | **Confirmed and extended (C6):** OZFO% has the same error (OZ 2, NZ 2, DZ 1 gives 40% against the required 66.7%); `goalie_weekly_aggregates` league SV% returns 0 when all shots are zero. |
| D8, D10–D16 | No game-type filter in `get_skaters_avg_stats`; `player_totals_unified` column defects; no final-state filter in `gameOutcomes`; current-team `percent_games`; pooled sustainability quintiles; mixed ADP seed; dormant wrong objects. | P2 | **Retained** (D16 inventory only; no deletion, rule 6). **D15 Human Mock ADP withdrawn (C3):** the UI says "Human Mock ADP · Provisional", human picks, contributor-balanced, not real-league ADP; the SQL computes exactly that. Mixed-source draft seed (M-DRF-001) stands. **M-SUS-001 weight argument withdrawn (C5):** renormalising weighted numerators and weighted TOI by the same weight cancels in the rate. |

**B. Astra's new findings**
- **PR-SQL-1 (P1, conditional): count and exposure are not matched.** `COALESCE(ixg,0)` with independent `SUM(toi)` turns unknown counts into zeros: two 1,200 s games with ixG 0.6 and NULL give 0.9 ixG/60 (supported rate 1.8; full window unknown). `player_totals_unified` divides WGO goals, shots, PIM, hits and blocks by NST-only TOI: one goal per game over two games, one without NST exposure, gives 6 goals/60 instead of 3. `bool_or(has_nst_counts)` proves any support, not complete support. Readers: WiGO AS percentiles, radar, matrix, sustainability league reference.
- **F2 (reproduced): the same zero-imputation recurs in TypeScript.** `web/lib/sustainability/score.ts:101-110` replaces missing counts with zero when TOI is positive; all-null ixG at positive TOI gives z = −2 against a 1.8/0.9 reference and raises no `missing_skill_*` flag. Removing `COALESCE` in SQL fixes only the all-null case.
- **PR-SQL-2 and F3 (P1, conditional): season inferred from GP is unsafe.** Equal implied GP lets input order choose the season (xGF/game 2 or 4). A uniquely wrong old season can win on gap 0 versus 1 in both orders; the synthetic intermediate multipliers differ (sample weight .1225 against .1802). The view exposes only the global latest standings date, so the season join is necessary but not point-in-time sufficient.

**C. Rejected or replaced tests**
- Remove the request for a missing-RPC diagnostic test (it exists and passes).
- Do not install "PP1 3 of 20 dressed shows 0.15" as mandatory before owner question Q4.
- Do not accept "a deterministic first-row tie-break" or "fail on ties" as the `nhl_team_data` fix; test exact season identity, a one-game lag against an old exact match, both permutations, missing current season and a historical cutoff.
- D1's view test must include an aggregate row that looks like a regular-season game and prove it is rejected or reconstructed, not just filter playoffs.
- Definition-equivalence checks need full function identity, properties and a per-object manifest, not whitespace-stripped hashes.

**D. Reach.** Live: D1 (completed seasons, sampled), D2, D4 (masked today), D6, D7 forward slot, PR-SQL-1 via WiGO and sustainability. Conditional: D3 (season requested), PR-SQL-2/F3 (fallback branch; in-house xG prior is preferred when configured). Dormant: D5 RPC (reported unapplied), D10, D16. All deployment-state facts are reported.

---

## W2-2 · Underlying stats summaries, part 1 ([audit](audits/underlying-stats-summaries-part1.md), [Astra](W1-Astra-PR/w2-2-underlying-stats-part1.md))

**Verdict.** Accept the five leading diagnoses; Astra reproduced the strength reversal, the five skater fall-throughs, the missing score-state time and the duplicate-goal mechanism through the unchanged pipeline (E1, E2: 52 existing tests pass, which shows the tests encode the behaviours under review). Revise the remedies: the goalie MD/LD error is not a uniform 2×, the proposed tie fix produces "Abysmal" instead of "Average", the "double fantasy weight" is redundancy rather than extra weight, and D20's safe null is not a defect.

**A. Fable defects and dispositions**

| Fable | Finding | Fable priority | Astra disposition |
|---|---|---|---|
| D1 | `strength_exact` is written away-first (`nhlStrengthState.ts:44`) but parsed home-first in `teamStatsSummaryRefresh.ts:334-346` and `playerStatsLandingServer.ts:1708-1720`. Team PP rows show short-handed shots. Reported, 66 games 2026-11-01 to 11-10: "5v4 PP" rows CF 140, GF 8, GA 88 in 43,639 s; "4v5 PK" rows CF 1,133. | P0 | **Confirmed (R1, reproduced).** Correction: a reciprocity test (home PP CF = away PK CA) passes when both teams are swapped consistently; use oriented fixtures with a known advantaged team. Astra W2-3 DR2 adds that fixing orientation alone can mis-file 6-on-5 pulled-goalie events, because parity classes a missing goalie as `EN` before PP/SH while the team and goalie matchers use the raw skater inequality: one manpower/net-state predicate must govern time, shots, danger features and the PBP fallback. |
| D2 | Goalie MD and LD goals against are added twice (`playerStatsLandingServer.ts:3548,3551` and again at `:3458,3461,3564`); HD goals only from the second routine. | P0 | **Confirmed, magnitude corrected.** "Exactly 2×" holds only where both paths include the same goal. With the reversed parser they see different events: one home-PP MD goal gives MD GA 2 in all strengths, 1 in PP, and a spurious 1 in PK where PK GA is 0. **E2:** repairing only the decoder makes PP look worse; removing only the duplicate leaves a positive PK "MDGSAA" from a PP shot; both are needed, and neither implements decision 10 (MD bucket xG is a flat .08, parity xG floors goals at .25). Own goals need an explicit residual (parity excludes them from buckets; the feature routine does not). |
| D3 | `resolveSkaterSplitKey` returns `pk` for 5v4 PP, 4v5 PK, 3v3, With EN and Against EN. | P0 | **Confirmed (reproduced).** |
| D4 | Team score-state segments take the score from event fields set only on goals; Leading/Trailing need a two-goal margin. Reported 2026-11-10 (7 games, 14 team rows per split): `toi_seconds` 0 in all six states. | P0 | **Confirmed, sharpened (E1).** Score time can be partially known: in a fixture the down-one row shows 9:00 against a true 19:00. Decision 11 needs overlapping predicates (tied/leading/trailing partition; up-one and down-one are subsets; within-one overlaps). The 7- and 66-game zeros stay dated samples. |
| D5 | Landing PP%/PK% read each team's latest `wgo_team_stats` row (one game); `Number(null)` = 0 ranks last. Reported 2026-11-10: 11 of 14 teams PP% 0; 12 of 14 PK% 0 or 1. | P0 | **Confirmed and extended (R2):** no season lower bound (an early-season team can borrow last season's game); add PR-U5 tie ranks. |
| D6 | Goalie variance page "GSAA" sums per-game NST values (decision 10). Reported 2026-11-08: 12 goalies sum to −0.01. | P1 | **Confirmed, test qualified (R7):** "league GSAA sums to zero" holds only for the identical complete event universe; filtered subsets need not. |
| D7 | Roster-matrix goalie fallback: GAA 60× high; LD saves built from HD saves. | P1 | **Confirmed, wording corrected (R2):** write GAA = GA × 60 ÷ TOI minutes (or × 3600 ÷ seconds after an explicit conversion); "divide by TOI minutes × 60" is ambiguous. The fallback also sums per-game GSAA (another decision-10 reader). |
| D8 | Goalie week tier: bar includes relief; ties count as better. | P1 | **Corrected (R3, reproduced).** Current `>=`/`<=` makes all-tied Elite; Fable's strict fix makes it Abysmal; half credit gives Average. The live `/goalies` baseline is built locally in `goalies.js:210-276`, not from `league_weekly_goalie_averages`, so fixing the SQL view alone does not repair the page. "Every multi-start week clears the bar" is withdrawn. |
| D9 | Value tier rewards single samples and counts FP twice. | P1 | **Split (R4).** Singleton zero SD is **confirmed**, and `toFiniteNumber` maps null to 0 before the percentile, so null alone will not fix it. Double count **withdrawn**: (p + p) / 2 = p; the fantasy component stays 35%; removal is score-neutral. |
| D10 | Eleven unknown-as-value sites (weekly SV%/GAA 0, empty percentile 0, null PP% 0, zero-TOI shares 0/50/100, SD of one sample 0, and others). | P1 | **Retained**; extended by PR-U2 and PR-U4. |
| D11 | OZS% and OZFO% include the neutral zone. | P1 | **Confirmed**; coordinate with W2-1 D9 rather than fixing only the parity copy. |
| D12 | Official overlay mixes sources inside one metric; proposed test SF% × (SF + SA) = SF. | P1 | **Test rejected (R5):** the identity already passes the mixed-source code (SF 6, native SA 4). Mixed sources are not wrong if they cover the same events. Keep the provenance and coverage concern; test frozen official/native disagreements. |
| D13 | Split-strength standings columns. | P1 | Retained as an owner question (Q13). |
| D14 | Entity rating overlay ignores the table's season. | P1 | **Corrected (R2):** the server already returns `ratingSnapshotDate`; the fix is to display it or hide the overlay. Offense and defense dates can differ under one displayed date. |
| D15 | PP/PK include extra-attacker time. | P1 | **Downgraded (R7):** depends on NST's pulled-goalie rule, which is not pinned. Not a settled P1 until the reference is saved. Owner question Q5. |
| D19 | Expanded-row chart averages game ratios. | P2 | **Upgraded to P1 if the line claims pooled SV% (R2):** the chart is an active reader. `[1, .5]` gives .75; pooled 6/11 = .545. A labelled "mean game SV%" is a valid different estimand. |
| D20 | One unreliable game nulls every rate. | P2 | **Withdrawn as a defect (R6):** failing closed is safe. A covered-subset rate is an optional enhancement that must filter numerator and denominator together. |

**B. Astra's new findings**
- **PR-U1 (P1, live): advanced goalie metrics ignore the selected range and can be truncated.** `goalies.js:608-635` fetches `goalie_stats_unified` by season only, unpaged; the value tier mixes season-wide QS% with date-filtered leaderboard rows. E4 (reproduced): with fixed inputs, a goalie's tier moves from 4 (52.78) to 3 (55.00 or 57.22) depending on one unknown quality start.
- **PR-U2 (P1, live): unmatched coverage; missing QS counted as a failure.** Two 60-minute starts, xGA `[3, null]`, QS `[1, null]` give xGA/60 1.5 and QS% 0.5; the full-window values are unknown.
- **PR-U3 (P1, live): goalie average distance reweighted by all shots.** `(10 × 10 + 30 × 1) / 11` = 11.8 ft where the two observed distances average 20 ft. Carry distance sums and measured counts through parity, summaries and merges.
- **PR-U4 (P1, live): a week with no comparable metrics is "Abysmal"** with 0% and ranking points.
- **PR-U5 (P1 presentation): equal special-team percentages get different ranks**, set by row order.
- **E3: "rebuild summaries" is not a repair instruction** (rule 14). The legacy migration path repartitions old rows without recomputing; a payload-version bump made the reader return zero rows with live builds disabled.

**C. Rejected or replaced tests**
- PP-for = PK-against alone (passes a consistent swap): replace with oriented fixtures (rule 15).
- Universal SA − saves = GA: own goals and unclassified geometry need explicit residuals.
- Strict-inequality ties "all ties = Average": contradictory; specify the tie rule first.
- D9 translation-invariance test: already passes.
- D12 share identity: vacuous.
- A test that checks only corrected MD GA: falsely passes (E2); assert MD GA, MDGAA and MD "GSAA" per strength together.

**D. Reach.** Live: D1–D5 (team and player landing, goalie landing via `goalieStatsServer.ts`), D6–D11, D19, PR-U1–U5. Stored summaries carry D1–D4 and need one separately approved bounded rebuild with key-level receipts. Dormant: D16–D18, D25 (no deletion).

---

## W2-3 · Underlying stats summaries, part 2 ([audit](audits/underlying-stats-summaries-part2.md), [Astra](W1-Astra-PR/w2-3-underlying-stats-part2.md))

**Verdict.** Accept the principal diagnoses (seven existing test files, 101 tests pass; fixtures confirm D1–D3). M-UST-095 is not sound, M-UST-093 fails on valid input, and Fable's blanket endorsement of goalie distance aggregation is wrong. Do not implement the WGO null-games caveat.

**A. Fable defects and dispositions**

| Fable | Finding | Fable priority | Astra disposition |
|---|---|---|---|
| D1 | `strength_exact` read reversed (team, goalie, PBP literal compares). Reported 106 games, 2026-10-25 to 11-09: team `powerPlay` rows CF 317 against CA 2,227. | P0 | **Same defect as W2-2 D1; confirmed (reproduced).** Correction (C1): the PBP fallback's broad PP/PK uses a different classifier, so not every fallback PP count is reversed. |
| D2 | Team score-state TOI zero; Leading/Trailing exclude one-goal margins. Reported 212 team-games: TOI 0 in all six states. | P0 | **Same defect as W2-2 D4; confirmed.** "All six states zero" is a reported sample, not a theorem. |
| D3 | Descending sort lists nulls first (`playerStatsLandingServer.ts:5210-5216`; `teamStatsQueries.ts:784-794`). | P0 | **Confirmed (reproduced: null, .3, 0).** Test both directions, all-null columns, stable tie-break and pagination on player, goalie and team paths. DR4: fix before pagination. |
| D4 | Variance skaters "CF/60" is an unweighted mean of individual attempts per 60; IPP and iXG/60 always blank (fields not selected). | P0 | **Confirmed.** The "on-ice ≈ 55–60" comparison is illustrative, not matched. A repaired rate needs matched counts and seconds (rule 13). Heuristic in-house xG cannot be reintroduced (decisions 6, 12). Owner question Q18. |
| D5 | Team "Last X games" is the league's last X games. | P1 | **Confirmed and extended (C4):** both branches order by game id, not date (reproduced: id 200 on Nov 9 selected over id 100 on Nov 10). Intended semantics are owner question Q16. |
| D6 | Goalie danger splits use a third xG heuristic and double MD/LD goals. | P1 | **Confirmed with W2-2 D2's correction:** not a universal 2×. |
| D7 | Finished-game rule mixes local date and UTC; "verify the serving flag". | P1 (conditional) | **Corrected (C3):** the live-build branch is resolvable from source (scoped, team, venue, split states and chart/detail readers enable live builds). Mid-game data exposure stays unmeasured. "Start + 8 h" is a heuristic, not finality (rule 19). |
| D8, D9 | Last-N on splits and traded players; xG explorer mixes windows. | P1 | **Retained, qualified:** D9 must align as-of date and game identities, not just `windowGames` (C6). D8 depends on owner question Q15. |
| D10–D17 | OT clock; PBP-only fallback; playoff OTL and unresolved shootouts; chart minimum TOI; unknown positions; refresh retry; honest labels; team rank. | P2 | **Retained, with corrections (C4, C6):** an unweighted "Avg" player SH% is a valid labelled estimand (M-UST-082); row index after sorting is an ordinal, so relabel "#" or adopt a rank contract; the two start-share denominators are equal on complete data (M-UST-086); D12 must also drop unresolved games from the point-% denominator; D13 is source-confirmed. |
| Caveat | "A null-GP WGO row enters sums but contributes no games." | — | **Withdrawn (C2, reproduced):** `percentUnits.ts` nulls the games sum and every aggregate. Preserve this fail-closed behaviour. |

**B. Astra's new findings**
- **A1 (P1, live): goalie average distance weighted by the wrong population** (same root as W2-2 PR-U3): 13.6 ft against a correct 30 ft.
- **A2 (P1, conditional): team exposure runs past a sudden-death end.** An OT game ending at 1:00 is credited 300 s; a matched per-60 rate is about 6.15% low on the fixture. DR3 negative control: only when the terminal marker carries a valid situation code.
- **A3 (P1, live): variance per-60 rates keep counts whose TOI is unknown.** Two one-goal games, TOI 1,200 s and unknown, give 6 G/60.
- **A4 (P1, live): xG Lab reports coverage "ok" with no transition or rebound data**; raw row-count ratios do not prove overlap of entity, window or model.
- **A5 (P2): `TOI.ts` parses "20" as NaN**; a caller then shows zero via `|| 0`.
- **DR1:** a goalie-only refresh writes `goalie_underlying_summary_partitions`, but the public goalie readers read `nhl_api_game_payloads_raw`; snapshot seeding can copy a stale partition (reproduced).
- **DR3:** a nullable-TOI fix at the writer is re-broken by the team reader's numeric `+=` (TOI 1,200 and null → CF/60 6).

**C. Rejected or replaced tests**
- "Team PP attempts-for ≥ attempts-against" (Fable already declined it) and any league-range oracle per game.
- "All listed UI strengths sum to all strengths": 5v5 ⊂ even strength, 5v4 ⊂ PP; declare an exclusive reconciliation basis first.
- "Any 2% threshold proves xG coverage" (A4).
- Repair receipts must show reader, storage key and readback equivalence (rule 14).

**D. Reach.** Live: D1–D5, D9, A1, A3, A4. Conditional: D7, A2. Dead: M-UST-078, 083, 084, `fetchTOIData`.

---

## W2-4 · Rankings, part 1 ([audit](audits/rankings-part1.md), [Astra](W1-Astra-PR/w2-rankings-part1.md))

**Verdict.** Accept the main diagnoses; nine test files (196 tests) pass, and several fixtures encode the wrong units. Astra reproduced the GSAA/60 factor, the last-N count/rate mismatch, the xGA sample-exposure mismatch, the broken luck baseline, composite formatting and rank flips, and the stale default season. Corrections: the luck index is not sign-inverted; MCM already disclaims being a percentile; M-RNK-042 is a demonstrated wrong game count; M-RNK-057's inheritance is withdrawn.

**A. Fable defects and dispositions**

| Fable | Finding | Fable priority | Astra disposition |
|---|---|---|---|
| D1 | Goalie GSAA/60 divides by NST 5v5 TOI in **minutes** as if seconds (`goalieMatrix.ts:619-622,727-731`): −0.39 GSAA in 48.05 min shows −29.22 (correct −0.49). Also sums per-game GSAA (decision 10). Reported: six rows, 2026-11-05. | P0 | **Confirmed (reproduced: −29.219563 against −0.486993).** Two fixes: unit adapter and aggregate baseline (the sum differs by Σ SA_j (L_window − L_j)). Corrections: the aggregate fix can change order, so "rank unaffected" holds only for the unit fix; **reject the "seconds ≥ 200" rule** (rule 17). `playerImpactRatings.ts` does not divide by NST TOI; do not copy the factor fix there. The committed season goalie view repeats the minutes × 3600 expression; include it in dependency checks. |
| D2 | Team style and luck read the bucket-heuristic xG; NST fallback per team mixes models in one ranked column. Reported 568 team-games: xGF 2,122.8 against GF 1,134. | P0 | **Confirmed (source).** A new reader of W1 P0 #2. Corrections: Σ Fin Luck + Σ Save Luck = 0 holds even for wrong xG, so it is not calibration evidence; a level bias does not cancel in each team's net luck (GF 3, GA 2, xGF 2, xGA 1 nets 0; doubling xG nets −1). |
| D3 | Results Luck Index: rate aliases subtracted from season counts; on-ice counts over unequal exposure; baseline flag from field presence. Reported: corr −0.449 with the window's GAx rate (n = 61, 2025-26, 2026-04-16); current season 0 of 732 rows. | P1 now, P0 when published | **Confirmed mechanism, "inverted" withdrawn (§4).** The index increases in current minus baseline. A matched neutral fixture publishes 65 with no warning (should be 100). Multiplying by −1 would not repair it. "Every signed component is (G − ixG)/TOI" is too broad: the SAX component is a percentage-point difference. The tile clamps to 100 while the sort payload emits the raw index. |
| D4 | Last-N "Goals Above Expected" and "Unrealized xG" are per-60 differences labelled as goals. Reported: Draisaitl last-20 +0.85 against about +5.8 goals. | P0 | **Confirmed (reproduced: identical 20-game set gives season 2, last-20 0.4).** Change producer support fields, selectors, both consumers, stored snapshots and tests as one contract; do not infer counts by multiplying a rate by a generic TOI. Count vs rate is owner question Q22. |
| D5 | xS% and SAX% divide by iCF under a "verified Fenwick" label. | P1 | **Confirmed from the producer** (`fetchRollingPlayerAverages.ts:1207-1217`). The 25% blocked share is an assumption, not a correction factor. Replace the provenance flag as well. |
| D6 | Season xGA/60 sample gate uses per-game TOI. Reported 2026-11-07: 5 skaters with ≥ 10 GP excluded, 1 with ≤ 2 GP passes. | P1 | **Confirmed; fix qualified.** Average × GP is right only if GP counts the observations behind the average; prefer stored matched exposure. |
| D7 | Composite scales: MCM centred near 61; Offense/Defense stored as `percentile_0_to_100` but are weighted means; published only at 1 GP / 300 s; Offense/Defense silently reweight. | P1 | **Split (§5).** Offense/Defense percentile contract and the "%" percentile formatting: **confirmed**. Silent reweighting: **confirmed** (goals-only gives 80). MCM centre: **withdrawn as a defect**: `skaterCompositeMethodology.ts:73-100` names a weighted score and says it is not a percentile; a mean of 59 is not a wrong formula. Do not change MCM or BEAST thresholds to centre at 50. The all-50 test passes today and proves nothing about percentiles. |
| D8 | All-strength TOI per game in last-N divides by season GP; fix divides by N. | P1 | **Fix rejected (A2):** for three lifetime appearances the correct TOI/game is 900; current code gives 1,350 and the proposed `TOI/N` gives 135. Persist actual window membership. |
| D9 | Quality-start family: Splits uses .910; matrix uses the NHL flag; RBS% is a 5v5 GSAx rule. | P1 | **Confirmed.** Six NHL flags away from boundaries cannot prove equivalence; do not "fix" by relabelling NHL QS while calling it Quality Start elsewhere. RBS/Steal naming open (Q25). |
| D10 | Impact ratings stale since 2026-03-08 (reported); pooled F/D z. | P1 | **Reader-specific (§6):** the underlying-stats overlay picks the latest row with no season or as-of predicate; `featureBuilder.ts` already requires `snapshot_date < sourceAsOfDate`; the QoT/QoC writer limits to the requested season. A producer refresh alone is not a remedy. |
| D11, D13 | Sample floors; smaller items. | P2 | Retained. The exclusive-below percentile convention is explicit; do not change it to mid-rank because another route has a sort bug. |
| D12 | `/rankings` default season hard-coded to 2025-26. | P1 (not observed in browser) | **Source-proven including Reset.** A "max season id" resolver is insufficient (future seasons exist); define active-season and off-season behaviour and test rollover. |

**B. Astra's new findings**
- **A1 (P1, conditional): the team matrix accepts partial xG totals as full-window evidence** (two games, one missing xGF: Fin Luck 4, Save Luck −2). The NST branch rejects null fields but cannot detect an absent game row. Define an eligible game ledger and require matched coverage.
- **A2 (upgrade of M-RNK-042): the last-N GP heuristic fabricates a full window.** Three appearances across two seasons are reported as 20 GP and can earn a "high" sample label at min-GP 5.
- **A3 (P1, live): composite rank changes with sort direction.** MCM 80 is rank 1 descending and rank 2 ascending while the displayed "percentile" stays 80. Keep score, rank and percentile as separate fields.
- **M-RNK-057 withdrawn:** PP points/60 uses the player's own PP TOI; replacing it with team PP time would add an error.

**C. Rejected or replaced tests**
- "Seconds must be ≥ 200" (D1): replace with a declared-unit adapter and fixtures including a short relief stint.
- Σ Fin + Σ Save = 0 as a calibration check (D2): keep as an identity only on paired complete records.
- Monotonicity alone for the luck index (passes the broken code): add the equal-rate unequal-exposure fixture expecting exactly 100 or unavailable.
- All-components-50 → 50 (D7): true today; does not test percentile calibration.
- `TOI/N` (D8): wrong for incomplete history.

**D. Reach.** Live: D1, D2, D4–D9, D12, A1 (conditional on null fields), A3. Conditional: D3 (last-N cohorts publish rarely; 0 of 732 current season, reported). The `_v1` stored methodology against `_v2` code is an unresolved provenance observation, not permission to rebuild.

---

## W2-5 · Draft tools ([audit](audits/draft-tools.md), [Astra](W1-Astra-PR/w2-draft-tools.md))

**Verdict.** Retain the candidate-relative VONA, moving replacement level, unscaled need weighting and missing-value findings. Withdraw the live Source Accuracy P0 (the component is not imported by any page). Fable's 473-player experiment is reported and not exactly reproducible (no frozen input, LCG constants or tie rule retained). Five test files (30 tests) pass.

**A. Fable defects and dispositions**

| Fable | Finding | Fable priority | Astra disposition |
|---|---|---|---|
| D1 | Source accuracy compares full-season projections with season-to-date actuals: 0% for an exactly right per-game source at 15 of 84 games; 0.01 floor makes one zero actual a 10,000% error. | P0 | **Downgraded to P2, "repair before activation" (§1.1).** `git grep` finds only the component, helper and their tests: no runtime render. Arithmetic confirmed. **M-DRF-010 split out and kept:** the projections table's per-stat and fantasy-point diff columns are active and compare year-to-date actuals with full-season projections (P1, live). |
| D2 | Recommendation score = value − .42 replacement − .07 last starter − .51 next baseline; the "VONA" baseline is the candidate's own rank + expected departures, so a cliff below a worse player lifts him. Reported: 10 to 47 same-eligibility inversions in the top 60. | P0 in draft season | **Confirmed (reproduced: centres 100, 99, 0 score 42.58, 92.07, −6.93).** Corrections: "VONA is negative for anyone not best at his position" is false with several departures; flooring fractional departures zeroes VONA for split-eligibility players; interpolation is not the expected best survivor; the dominance test applies to the base score with common baselines, not the final score. The 51% is the effective heuristic weight, to be chosen by replay evidence, not a forbidden coefficient. The free path's extra 0.25 × (1 − availability) × VBD term must be fixed too. |
| D3 | Replacement level falls during the draft (remaining-pool mode keeps the full index). | P1 | **Confirmed (reproduced: replacement 80 → 70, held player's VORP 20 → 30, no projection change).** Correction: freezing each player's VORP at his pick embeds a different comparator per player; use one frozen full-league reference for totals and awards, and a separately versioned dynamic board using real league-wide fills. Pro scenario/report adapters copy the moving VORP too. |
| D4 | Multi-position forwards sit in every pool; UTIL split to forwards only; bench ignored. Reported: 247 pooled-forward baseline. | P1 | **Retained, oracle rejected (§3.2):** the 247 baseline relaxes position constraints and is not a true assignment; a greedy "fill C, LW, RW, D, G, then UTIL" fails an exhaustive two-slot counterexample. The dashboard allocator already allows any non-goalie in UTIL. |
| D5 | Need weighting: boost = alpha × fit × max score; category needs are raw count deficits for six skater categories. | P1 | **Confirmed and strengthened (§4.1):** the scale is max |score|, so an unrelated −1,000 candidate turns a needed player's 90 into 540; doubling the units of hits breaks a tie (0.118 vs 0). My Roster passes no category inputs at all. |
| D6 | Category-league draft readers of the W1 z-score defects. | P1 | **Retained, two corrections (§5):** a below-average player lowers a team's mean only if below the team's current mean; sum over starting slots alone does not meet decision 62. Do not resurrect the `Math.abs` weight claim (already disproven in Wave 1). |
| D7–D14 | ADP truncation and one spread; community prior scale; steals/reaches; display percentiles; default-weight label; source blend; mock bots; smaller items. | P2 (D13 P1 when mocks ship) | **Mostly qualified (§6).** Community candidates are verified identities in three lifecycle states, not 4,378 rows; setting F to the ranked field puts unranked players above half the field (reproduced sensitivity: rank-150 score 0.006 → 1.036 when 300 unranked candidates are added). Steal/reach and rate blending are alternative definitions, not defects (rule 16). Compare modal missing → 50th percentile and missing → 0 are real. D11 (decision 54 label) stands but verify the settings surface before claiming every user sees defaults. D13 confirmed (raw vs effective roster config). |

**B. Astra's new findings**
- **§1.2 (P2, unwired): source ranks use different observation populations.** A source that omits the hard stat wins (A 50, B 90, both "100% coverage").
- **§4.1:** negative-tail scaling and unit-dependent category needs (above).
- **§4.2 (P1, conditional): points inputs turn unknown into zero.** `[null, −5]` becomes `[0, −5]`, so an unknown player outranks a supported negative one; partial fantasy-point subtotals look complete.

**C. Rejected or replaced tests**
- "A zero actual changes the score by a bounded amount" (squared error is not bounded): use an exact expected-loss assertion.
- Final-score dominance (blocks legitimate wait-and-pick).
- "Players above replacement equals starting slots" (ties, overlapping pools).
- "A player three rounds worse never passes one with no need" (needs an owner-chosen cap first).

**D. Reach.** Live (Draft Dashboard computes now; traffic low outside draft season): D2–D6, D10, M-DRF-010, §4.2. Unwired: D1 Source Accuracy. Conditional: D13 (mock drafts behind default-off flags).

---

## W2-6 · Lines, TOI and PP units ([audit](audits/lines-toi-pp-units.md), [Astra](W1-Astra-PR/w2-lines-toi-pp-units.md))

**Verdict.** Retain the strength-clock, goalie-ratio and label findings; do not implement the repairs verbatim. Seven test files (104 tests) pass and encode the current zero fallback and 100% cap. The triage claims are settled: PP units are a pivot co-deployment heuristic (not a rank slice), PP timing does not assume 20-minute periods (488 of 501 team-games within 5 s of NHL.com, reported), and the penalty-code mapping is a dormant no-op.

**A. Fable defects and dispositions**

| Fable | Finding | Fable priority | Astra disposition |
|---|---|---|---|
| D1 | FORGE "PP TOI" is not power-play time; `/api/toi` divides it by the NHL team PP clock, turns missing data into 0 and caps at 100%. Reported 316 team-games: 5.96 against 4.97 PP player-seconds per NHL PP second; 77 team-games with a skater above his team's PP time. | P0 | **Confirmed as a source-reachable defect; magnitude and oracle corrected (§1).** The 5.96 / 4.97 is a ~20% difference between two producers, not a measured error against truth, and "five is the ceiling" is false (4v3 gives 4, a 6-skater PP gives 6 per clock second, reproduced). Keep the stronger check: one player's unioned PP seconds ≤ team PP clock on the same complete intervals. **Fix corrected:** the proposed swap to `powerPlayCombinations.PPTOI` needs a coverage contract first (the writer omits zero-PP players and can retain stale rows); do not just remove the cap; withhold or flag impossible shares. The rolling PP-share fallback reads WGO, not FORGE: drop it from the FORGE reader list. PowerPlayCombos ignores a failed FORGE query and shows fabricated zero exposure. |
| D2 | Line-card goalie SV% and GAA are means of per-game ratios; a missing outcome counts as a win. Shutout + 10-min relief (1 save on 3 shots): .667 / 6.00 against pooled .939 / 1.71. | P0 | **Confirmed and extended (§2, reproduced).** The "SEASON" collection is the latest ten **team games with line data**, identical to "LAST 10"; neither is the goalie's season or last ten appearances. The record is the team's result; both starter and reliever can get the same win; "No starts yet" has no start input; `GoalieCard.tsx` turns null into 0 with `|| 0`. |
| D3 | Stored "lines" come from all-strength shared time. Reported 320 team-games: stored line 1 = most-used 5v5 trio 217 times (68%). | P1 | **Retained; proposed replacement source needs repair first (§3).** See B. A 68% match rate is not a correctness test. |
| D4 | PP unit labels have no minimum time and force five skaters. Reported 501 team-games: 153 of 2,366 "unit 2" rows under 20 s. | P1 | **Qualified (§4):** units hold up to five; PP3 already exists and is rendered. A minimum is a role-definition choice to validate; "5 s can never be PP2" fails when the whole opportunity is 5 s. `exactFivePp` is a 5v4/5v3 research comparator, not a PP clock. Owner question Q8. |
| D5 | "% TOI with" has two denominators; `es_shifts` includes PK. | P1 | **Retained as naming:** both fractions are valid descriptive measures with different names; shared seconds are symmetric, own-TOI percentages are not. |
| D6, D7 | `pp_timeframes` rows wrong (dormant); `vw_pp_unit_share_recent` (dormant). | P2 | **Retained, dormant.** The only reader takes scores, not PP rows; decouple before any retirement (rule 6). D7 per W2-1 C4. |
| D8 | Heuristics shown near probabilities. | P2 | **Retained as presentation;** separate arithmetic defects (mixed clocks, completeness) from policy (uncalibrated confidence, shading). |

**B. Astra's new findings**
- **§3 (P1, conditional): overlapping shift rows become two skaters in `team_unit_toi`.** `teamUnitToiBuilder.ts` drops exact duplicates only; a second, overlapping shift for player 101 yields a "complete" forward trio `[101, 101, 102]` (reproduced). Union intervals per player and count distinct IDs.
- **§3: coverage is not proven by equal home/away clocks.** A missing goalie shift still emits "complete" 5v5 units; one-second fragments pass; legitimate 4F/1D deployment gives different eligible clocks. The nightly completion helper and the next-run loader use two definitions (the loader checks forward rows only), and "completed games" has no final-state predicate.
- **§3: observed units are not disjoint lineup slots.** Top four trios can share players; a disjoint-assignment output needs its own contract.
- **§1: FORGE event counts and PP exposure in one strength row use incompatible classifiers** (`shifts.ts` raw skater counts vs `situation.ts` pulled-goalie adjustment).

**C. Rejected or replaced tests**
- `sum(player PP) / 5 = team PP` and the five-skater ceiling (rule 17): use separate `1560` (no penalty), `1460` (penalty + pulled goalie) and `0551` fixtures with explicit penalty history.
- "Line 1 equals the 5v5 trio at rate X": not a correctness test.
- "Season equals last ten" style goalie checks: assert pooled count/exposure identities and honest window labels.
- Symmetric "% TOI with" percentages: not required.

**D. Reach.** Live: D1 (`/api/toi`, TimeOnIce chart, PowerPlayCombos, FORGE strength readers), D2 (`/lines/[abbreviation]`), D3–D5. Conditional: §3 overlap (prevalence unmeasured). Dormant: D6, D7. Fable's 501/316/320-game samples are reported.

---

## W2-7 · Player forecasts, season part 2 ([audit](audits/player-forecasts-season-part2.md), [Astra](W1-Astra-PR/w2-player-forecasts-season-part2.md))

**Verdict.** No P0: the season release and native catalog tables were reported empty on 2026-11-11, so the Python season model is dormant (Astra: a table estimate is weaker than proof; the serving readers do require an active release pointer and a valid catalog head). Keep the placeholder-label, improper mean-score, training/serving mismatch and UTC-date findings; Astra strengthened the label findings with producer evidence, qualified the GLM, and closed the 17 undetermined entries (14 sound within their narrow contract, 1 mis-specified, 2 wrong). Six test files (217 tests) pass.

**A. Fable defects and dispositions**

| Fable | Finding | Fable priority | Astra disposition |
|---|---|---|---|
| D1 | Season skater labels carry placeholder zeros: `powerPlayToi`, `shorthandedToi` `00:00` and `faceoffs` `0/0` on every sampled row from 2024-25 (reported 5,544 rows, three weeks). EN goals over-counted 35% (97 games: PBP 58 vs WGO 43); shootout games fail `pbp_complete`. | P1, dormant | **Confirmed and traced to the producer (§1).** `update-stats/[gameId].ts:669-672` writes the placeholders explicitly, so ingestion is live. `nhlRawGamecenter.mjs:78-122` returns `EN` when **either** goalie is pulled (situation `1560` home scoring with its own net empty → `EN`, reproduced); an SO goal returns `is_goal = true`. Do not reject a genuine all-zero history merely for being zero. |
| D2 | Means selected and scored by MAE; settlement composite rewards forecasting zero. | P1 | **Confirmed, claims corrected (§2).** Analytic Poisson(0.2) example: forecast 0 has MAE .200 vs .327 for the true mean and a composite of 88.9 vs 48.0. Corrections: "any low-biased candidate wins" becomes the median mechanism; a perfect baseline gives 50 (reproduced), not 0 or 100; aggregate the proper loss before forming skill. `forge_walk_forward.py` also selects by MAE: change it in a new disclosed experiment, do not relabel the issued pilot (rule 21). |
| D3 | GLM regresses each player's mean on its own shrunk copy (slopes 1.06–1.39). | P1 | **Confirmed as stationary de-shrinkage (§3, reproduced slopes 1.14–1.86).** Not proof of future-label leakage; "slope ≤ 1" and "GLM never beats EB" are not valid universal tests. NB dispersion understatement not established (residuals clipped at zero before summing). |
| D4 | Validated v4 ≠ served v4 (exposure overwrite). | P1 | **Confirmed as an evidence-to-served mismatch (§4);** the artifact discloses `servingRateBasis`, and context effects on replaced heads are reset to 1. Exposure support counted in games: 60 s and 15,000 s of PP time both get support 20 (reproduced). |
| D4b | Back-to-back flag from UTC dates (reported 2026-27: 564 flagged vs 377 true). | P1 | **Confirmed (two reproduced examples, §5);** impact needs a non-unit context multiplier, which v4 exposure heads reset, so do not convert the counts into an error rate. |
| D5 | Roster-adjusted GA counts each on-ice event ~5×. | P1 | Not re-certified by Astra; retained as Fable's finding. |
| D6 | Ledger naive controls: participation 1; goalie "last 5" uses 10; missing team win = 0.5. | P1, live | **Confirmed (§6, reproduced: saves 20 where a true last-5 is 30; win 0.5).** Nulling the win head alone does not meet decisions 38/63. The "12% high over the full set" belongs to W2-8 and is withdrawn there. |
| D7–D10 | Recency anchor; team and venue multipliers; research and input defects; other (champion pick by `is_champion`, missing actuals → 0, prop means conditional, `FACEOFFS_LOST` = taken). | P2 | **Retained.** D7 corrected: moving the anchor only rescales weights; the real mismatch is intra-season validation vs season-ahead serving. |

**B. Astra's new findings**
- **M-PFC-110 (P2, research): assist-split history contaminated before the completeness gate.** Unavailable A1/A2 splits enter history as observed zeros (career A1 rate 0 after a two-assist game).
- **M-PFC-120 (P2, conditional): PIM units change with representation.** Resolved forecasts carry `minutes`, raw ones `count`; a mixed horizon returns `expected = null, reason = "incompatible_units"`.
- Closures of 081, 082 (mis-specified: MAE selection in the walk-forward pilot), 087, 090, 092–094, 103–108, 115, 117 (narrow-contract sound).

**C. Rejected or replaced tests**
- "A zero forecast must score below 50 / lose in every sample": use expected-loss assertions or a pre-specified powered simulation.
- "GLM slope ≤ 1" and "GLM error never exceeds shrinkage".
- "Flag counts equal 377" as a permanent assertion: pin the frozen input hash.

**D. Reach.** Live: D6 (ledger), the ingestion producer of D1's placeholders. Dormant (no season release): D1 labels, D2–D5, D7–D9. Research: 081, 082, 110.

---

## W2-8 · Player forecasts, season part 3 ([audit](audits/player-forecasts-season-part3.md), [Astra](W1-Astra-PR/w2-player-forecasts-season-part3.md))

**Verdict.** No P0 established. Retain the rounding rejection, ledger population mismatch, unknown-as-zero coverage, explicit goalie-basis requirement and undefined-ratio findings. Correct the proposed DNP proof, the claimed full-population bias reversal, "silent" missing mass and several dormant remedies. Astra adds that "no public page shows a wrong number" is not established either, because the bridge feeds other live-capable consumers.

**A. Fable defects and dispositions**

| Fable | Finding | Fable priority | Astra disposition |
|---|---|---|---|
| D1 | The ledger cannot settle a non-appearance (no completeness receipt): 0 of 11,547 rows `dressed = false`; scored goalie rows look 36% low on saves, "the full set says 12% high" (reported). | P1, live | **Confirmed gap; magnitude and remedy corrected (PR1, PR2).** Missing WGO rows are not proven DNPs; the "12% high" is a zero-imputation scenario, not a measurement. A row-count receipt fails (official IDs [201, 202] vs ingested [201, 999] both count two). Even a valid receipt leaves the count scorer's `dressedRows` filter (reproduced: count-score n stays 1 with the backup settled). Binary W/SO/start already use all known outcomes: do not add a dressed filter there. Rows lack a basis field; the snapshot route does not persist the assembled universe. |
| D2 | Bridge rounds start chances to four decimals; the resolver rejects groups above 1.000001 and nulls every line. Reported 1 of 156 groups; simulated 12.6% for three goalies. | P1, live | **Confirmed (reproduced: .33337/.33337/.33326 → all three lines null).** Preferred fix: keep unrounded probabilities through emission and the wire; round only for display. An n × 0.00005 tolerance only for a proven rounded vector. `rosterScheduleOptimizer/planning.ts:534` caps rather than rejects: a different fix. The served-group count mixes `bridge_exact` and `bridge_reaimed`. |
| D3 | Start mass below 1 is silent; placeholder rows count as covered. | P2 | **Narrowed and upgraded to P1 for false completeness (PR4):** the bridge already emits "start chances sum to less than 1" warnings, so not silent; but an unknown goalie gets a zeroed line with all uses allowed and coverage reports 3 of 3 eligible (reproduced). Keep a residual unknown bucket; do not deny all reserve codes (a confirmed-out zero is real). |
| D4 | No relief term in the unconditional goalie line (decision 63). | P2 | **Confirmed, with an upstream caveat (PR5):** the selected goalie row is a top-starter scenario mixture read as "per start"; adding relief to it without repairing candidate identity does not give the required decomposition. Label "starts only" until qualified. |
| D5 | `conditionalStats` basis implied. | P2, conditional | **Confirmed (PR5, reproduced):** the preview's per-appearance 21.6 saves become 13.5 only after a hypothetical permission change; keep preview permissions denied. |
| D6 | Calendar lead days are UTC days. | P2 | **Reproducible, reclassified as a product-definition change (PR6):** the policy declares UTC. Moving to NHL dates is a versioned cross-consumer contract (rule 19). Owner question Q35. |
| D7 | PP points need PP assists as a primitive. | P2, dormant | **Downgraded (PR7):** the canonical target list already includes PP_ASSISTS; applies only to reduced artifacts. |
| D8 | Scratches cannot settle; per-game GAA/SV% scored as outcomes. | P2 | Absence: keep unknown until identity evidence (PR1). Per-game ratios: **not wrong** for a per-game target; prefer counts for aggregate ratios (PR9). |
| D9 | Participation shrinkage: divides by 82; median prior; borrowed pseudo-count. | P2 | **Partly withdrawn (PR9):** fixed denominators are real; a median prior is a policy choice and need not sit between the modes. Compare priors on held-out outcomes. |
| D10 | Missing variance scale gives a zero-width interval. | P2 | **Corrected (PR8):** the normal fitter always writes the key; unconditional variance adds p(1 − p)μ² (μ 10, p .5 gives 25). New: the evaluator gives Bernoulli GP/GS variances .96/.75 instead of .16/.25 (reproduced). |
| D11 | Undefined season ratios become 0 (14 entries). | P2 | **Confirmed (reproduced: empty goalie input gives SV% 0, GAA 0, win% 0).** |
| D12 | Goalie heads not reconciled to starts; wins/starts includes relief wins. | P2 | **Confirmed;** QS is not mutually exclusive with W/L/OTL, so constrain it separately to credited starts (decision 40). SA = SV + GA is also broken by reconciliation. |

**B. Astra's new findings**
- **PR8: Bernoulli variance violation** in `evaluatePortableSeasonGame` (above).
- **PR9: reconciliation leaves SA = 1, GA = 2, saves = 0** and 1.4 decisions per 0.8 GP on accepted synthetic input.

**C. Rejected or replaced tests**
- "Summed expected starts equal summed actual starts" on a two-candidate fixture: true by construction, not calibration (rule 15).
- "No p10 equals p90 for a positive mean": invalid for discrete or deterministic outcomes.
- A count-based completeness receipt: unsafe; use identity-complete stored evidence.

**D. Reach.** Live: D1 (ledger settle and `/api/v1/forge/scoreboard`, audience unknown: owner question Q36), D2, D3 (bridge path, under its own admission flags), D4, D6. Conditional: D5. Dormant: D7–D12 (`fantasy-projections/`, `season.py`).

---

## W2-9 · BLSH ([audit](audits/blsh-buy-low-sell-high.md), [Astra](W1-Astra-PR/w2-blsh-buy-low-sell-high.md))

**Verdict.** No production-visible P0: the preview and trade pages return 404 in production and the player-card reader is test-only. Retain the frozen-snapshot and forecast-rule findings; Astra reproduced Fable's 167 of 448 gate failures exactly and added two defects in arm C and the opportunity context. Several recommendations reopen choices already made in the BLSH decision record of 2026-11-03 (top 25 per side and position; league-scoring headline; retrospective purpose). **This family is Codex-owned (`web/scripts/blsh/**` and the BLSH lane); its fixes route to that lane, not to Claude fix lanes.** Ten test files pass (296 passed, 111 skipped).

**A. Fable defects and dispositions**

| Fable | Finding | Fable priority | Astra disposition |
|---|---|---|---|
| D1 | Served lists ignore the current gates (mapper v1 snapshot): 167 of 448 listed fail ≥ 1 gate. | P1, conditional | **Confirmed (exact recount).** Remedy incomplete: the reader accepts only the stale arm-A policy, fixed October dates and 2022–24 references, so regeneration plus a hash update cannot admit arm C. Design a successor admission contract; keep the old artifact as historical (rule 21). |
| D2 | Sign-only membership on a skewed gap (448 of 551 listed). | P1, conditional | **Corrected (R2):** top 25 per side and position is already decided and implemented in v3. Reject the mid-p Poisson / equal BL-SH test: fantasy points and Game Score are not Poisson counts. |
| D3 | Served reference is the stale arm A (894–1,451 days old). | P1, conditional | **Confirmed as a migration requirement;** current-season weight 1.0 in arm C is already chosen and frozen. Fix A1 before adopting arm C. |
| D4 | Support adjustment unvalidated; list names overclaim. | P1, conditional | **Qualified (R2):** the adverse P2_transfer result (RMSE +.0084, CI .0044 to .0122) blocks it as a forecast, not as a retrospective descriptive adjustment. Whether decision 35 renames BLSH is open (owner question Q37). |
| D5 | Forecast rule passes on a point estimate against the reference; MAE first. | P2, research | **Confirmed and narrowed (R3, reproduced):** passes on an arbitrarily small apparent MAE gain while P2 − P1 RMSE is +0.1 [+0.05, +0.15]. Freeze a squared-error primary contrast in a new protocol version. |
| D6 | Game Score track uses all-situation on-ice goals. Reported 3,282 player-games: +0.058/game for heavy-PP players. | P2 | **Corrected (R5):** ES goals are not 5v5 (include 4v4, 3v3); the SAT strength was inferred. Keep the named house variant and disclose it, or get a true matching-strength source (owner question Q2). |
| D7 | Scalar weight across tracks; noise "counted twice" in the metric; regulars-only donors. | P2 | **Partly withdrawn (R4):** the metric is a choice of PSD-projection units, not double noise in the final covariance. The SD .998 is not a calibration test (counterexample: normaliser a'Va = 1 with true SD 3). |
| D8 | M-BLSH-002 inherits "FORGE omits extra-attacker production"; M-003 z overstated; stale label. | P2 | **M-002 claim withdrawn (R5)** per Wave 1. M-003 reclassified: see A2. Stale label is true under the current contract (a successor-migration item). |

**B. Astra's new findings**
- **A1 (P1 before arm-C adoption): partially observed tracks get the precision of fully observed ones.** One Game Score game borrows 20 games' exposure; reference-error variance understated 19.1× at the same weight (reproduced). Build per-track masks into the measurement covariance.
- **A2 (P1 before promoting opportunity context): PP shrinkage reported as an opportunity change.** Unchanged TOI and PP usage give a −4.55 FP "opportunity effect" and adjusted z 2.26 (reproduced). Separate opportunity-only effect from reference-estimation adjustment.

**C. Rejected or replaced tests**
- Mid-p Poisson tail and equal BL/SH counts (R2).
- "P2 equals P1 plus noise must return false" as a stochastic oracle: use the fixed-contrast counterexample.
- Cross-sectional SD ≈ 1 as calibration (R4).

**D. Reach.** Research preview only (404 in production); trade/watchlist runs on fixtures; the player-card reader is unmounted. All findings are conditional on promotion.

---
## Cross-packet defect map (Wave 2)

One owner per defect; each reader gets its own selection test (rule 4). "W1 link" names the row in [BATCH-BC-CONSOLIDATED.md](BATCH-BC-CONSOLIDATED.md) that shares code or readers.

| Defect | Owner | Readers | W1 link | Decision / rule |
|---|---|---|---|---|
| Strength string reversed; no shared manpower/net-state predicate | W2-2 D1 (= W2-3 D1) | Team PP/PK rows and API; goalie danger splits; PBP 5v4/4v5; stored summaries | W1-2 D8; W1-6 D15 | 9, 59; 14, 15 |
| Score state not carried; one-goal margins excluded | W2-2 D4 (= W2-3 D2) | Team score-state tables and filters; stored team summaries | P0 #4 (W1-2 D1) | 11 |
| Goalie danger buckets: duplicate goals, distance weights, bucket xG | W2-2 D2, PR-U3 (= W2-3 D6, A1) | Goalie landing, detail, chart; stored summaries | P0 #5; P0 #2 | 7, 10, 12 |
| Per-game GSAA summed (decision 10 readers) | W1-2 D4 | Variance page (W2-2 D6); roster matrix (R2); rankings goalie matrix and Value Signal (W2-4 D1); `goalie_totals_unified`; `playerImpactRatings.ts` | P0 #5; GSAA .900 row | 10 |
| Seconds vs minutes | Each packet | Rankings GSAA/60; roster-matrix GAA; goalie totals and season views; `TOI.ts` | Seconds-as-minutes row | 17 |
| Count and exposure from different observations | W2-1 PR-SQL-1, W2-2 PR-U2, W2-3 A3 | NST season views, `player_totals_unified`, sustainability `score.ts`, advanced goalie metrics, variance skaters, team matrix xG (W2-4 A1), team reader `+=`, PowerPlayCombos | Unknowns-as-zeros row | 5, 13 |
| NST season views: playoff and aggregate rows; no game identity at admission | W2-1 D1, F1 | WiGO percentiles and ratings, radar, Roster Matrix | P0 #8 | 9, 15 |
| WGO season-only filter | W2-1 D3, PR-SQL-3 | Game Score chart, points and consistency windows | — | 16 |
| Season inferred from GP in `nhl_team_data` | W2-1 D4, PR-SQL-2, F3 | FORGE team prior; RSO bridge prior | W1-4 D11; W1-6 D6 | 10, 20 |
| OZS% / OZFO% include neutral zone | W2-1 D9, W2-2 D11 | Rates views, WiGO percentiles | W1-2 D12 | 9 |
| Single-game PP%/PK% | W1-4 D3 | Landing PP%/PK% and rank | P0 #13 | 20 |
| Bucket-heuristic xG | W1-1 D6 / W1-2 D2 | Rankings team matrix; danger xG | P0 #2 | 6, 7, 12 |
| Per-60 read as count | W1-3 D2 | Last-N GAx, Unrealized xG, Results Luck, composite finishing | P0 #10 | 23, 34 |
| Last-N membership not persisted | W2-4 A2 | Rankings GP and confidence; matrix TOI/game | W1-3 windows | Q21 |
| Quality Start and credited outcome | W1-5 | Splits QS; line-card record; season goalie heads; `gameOutcomes` | Credited-start row | 40, 46, 63 |
| PP clock vs FORGE strength exposure | W1-6 D15 | `/api/toi`, TimeOnIce chart, PowerPlayCombos, FORGE splits | P0 #18, #19 | 24, 59 |
| `team_unit_toi` overlaps and coverage | W2-6 §3 | Rankings top-unit share; proposed 5v5 lines | — | 14 |
| Line-card goalie windows and ratios | W2-6 D2 | GoalieCard | Credited-start row | 40 |
| Ledger population and basis | W1-8 D6 | Settle cron, `scoreLedger`, paired scores, scoreboard, naive controls | Ledger row | 38, 41, 63 |
| Start-probability rounding and unknown mass | W1-5 | Bridge, resolver, calendar coverage, reserve codes | Starter row; P0 #27 | 3, 47 |
| Proper scores | Decision 65 | Season selection and settlement; walk-forward; draft accuracy; BLSH rule | Ledger row | 65 |
| `0/0`, `00:00` placeholders; EN when either goalie pulled | W2-7 D1 | Season labels; PBP `EN` readers | P0 #18 (EN bucket) | 7, 24 |
| Undefined ratios; unreconciled goalie heads | W2-8 D11, D12 | Fantasy projections, Draft Dashboard, season editor (dormant) | W1-8 PR-P10 | 46, 63 |
| Draft valuation (VONA, replacement, need scale, unknown points) | W2-5 D2–D5, §4.2 | Suggested Picks, My Roster, Draft Pro, team VORP, draft winner | P0 #30 | 62, 65 |
| Composite scale, rank direction, missing inputs | W2-4 D7, A3 | Matrix tiles and sort, BEAST tiers, snapshots | — | 20 |
| UTC vs NHL date | W2-7 D4b, W2-8 D6, W2-3 D7 | Season B2B; lead days and blends; finished-game rule | Decision 18 | 19 |
| BLSH arm C precision, opportunity attribution (Codex) | W2-9 A1, A2 | Preview lists, opportunity context, retained card | W1-9 | 32, 34, 61, 68 |

---

## Wave 2 P0 list

P0 = a user-visible wrong number on a live surface today, after Astra's corrections. **14 rows: 13 live and 1 conditional** (draft season). "Shares root with" means the fix is shared with a Wave 1 item; the row is counted because it is a separate live surface. Magnitudes stay dated samples (rule 1).

| # | Defect | Area | File:symbol | Reach | Source (audit + Astra) | Evidence |
|---:|---|---|---|---|---|---|
| W2-P0-1 | NST season-long views include playoff and mis-tagged games; GP > 1 rows admitted as one game | WiGO / NST SQL | `nst_seasonlong_*_counts(_oi)` views (`BASE:20388-20465`); `update-nst-gamelog.ts` parser | Live (completed seasons, sampled) | W2-1 D1; Astra C7, F1 | One player, two seasons reported; parser admission reproduced |
| W2-P0-2 | `strength_exact` parsed home-first: team PP rows hold PK shots; goalie danger splits filter the wrong state | Underlying stats | `teamStatsSummaryRefresh.ts` strength parser (`:334-346`); `playerStatsLandingServer.ts:1708-1720` | Live | W2-2 D1, W2-3 D1; Astra W2-2 R1/E1, W2-3 C1/DR2 | Reproduced; 66- and 106-game samples reported |
| W2-P0-3 | Goalie MD/LD goals against added twice; MD/LD "GSAA" wrong | Underlying stats | `playerStatsLandingServer.ts`: `accumulateLandingMetrics` / `accumulateGoalieShotFeatureBucketMetrics` | Live | W2-2 D2, W2-3 D6; Astra W2-2 R1/E2 | Reproduced (not a uniform 2×) |
| W2-P0-4 | Five skater strength filters show PK numbers | Underlying stats | `playerStatsLandingServer.ts`: `resolveSkaterSplitKey` | Live | W2-2 D3; Astra R1 | Reproduced |
| W2-P0-5 | Team score-state rows have no (or partial) ice time; Leading/Trailing exclude one-goal margins | Underlying stats | `teamStatsSummaryRefresh.ts` segment scores and score matcher | Live | W2-2 D4, W2-3 D2; Astra W2-2 E1 | Reproduced; 7- and 212-team-game samples reported. Shares root with W1 P0 #4 |
| W2-P0-6 | Landing PP%/PK% from one game; null → 0 ranked last; no season bound | Underlying stats | `teamSpecialTeamsContext.ts`: `fetchUnderlyingStatsTeamSpecialTeamsContext` | Live | W2-2 D5; Astra R2, PR-U5 | Source-confirmed; 2026-11-10 sample reported. Shares root with W1 P0 #13 |
| W2-P0-7 | Descending sort puts nulls first (page 1 can be all nulls) | Underlying stats | `playerStatsLandingServer.ts:5179-5216` `compareNullable`; `teamStatsQueries.ts:784-794` | Live | W2-3 D3; Astra C1, DR4 | Reproduced |
| W2-P0-8 | Variance skaters "CF/60" is mean individual attempts/60; IPP and iXG/60 always blank | Variance pages | `skaterMetrics.ts:381-389`; `seasonSkaterRows.ts:4-33` | Live | W2-3 D4; Astra C1 | Source-confirmed; six-row sample reported |
| W2-P0-9 | Goalie matrix GSAA/60 is 60× (NST minutes read as seconds) and sums per-game GSAA | Rankings | `goalieMatrix.ts`: `aggregateGoalieGameRows` / `metricValue` (`:619-622,727-731`) | Live | W2-4 D1; Astra §1 | Reproduced (−29.22 vs −0.49) |
| W2-P0-10 | Team matrix xGF%, Shot Quality, Event Rate and luck use bucket-heuristic xG; per-team NST fallback mixes models in one ranked column | Rankings | `teamMatrix.ts:1204-1228,1425-1442`; `teamStyleMethodology.ts` | Live | W2-4 D2; Astra §2, A1 | Source-confirmed; 568-team-game aggregate reported. Shares root with W1 P0 #2 |
| W2-P0-11 | Last-N "Goals Above Expected" and "Unrealized xG" are per-60 differences labelled as goals | Rankings / rolling | `skaterWindowAggregation.ts:314-321,417-431`; producer aliases in `fetchRollingPlayerAverages.ts:2854-2879` | Live | W2-4 D4; Astra §3 | Reproduced (2 vs 0.4). Shares root with W1 P0 #10 |
| W2-P0-12 | Line-card goalie SV%/GAA are means of game ratios; "SEASON" = last 10 team games with line data; unknown outcome = win; record is team result | Lines | `LineCombinations/utilities.ts:91-101,241-259,506-559`; `GoalieCard.tsx` | Live | W2-6 D2; Astra §2 | Reproduced (.667 / 6.00 vs .939 / 1.71) |
| W2-P0-13 | `/api/toi` PP share divides FORGE PP seconds by the NHL PP clock, turns missing into 0 and caps at 100 | Lines / TOI | `pages/api/toi.ts:88-95,136-154`; `TimeOnIceChart.tsx` | Live | W2-6 D1; Astra §1 | Source-confirmed; 316-team-game discrepancy reported. Shares root with W1-6 D15 |
| W2-P0-14 | Draft recommendation score uses a candidate-relative "VONA" at 51% effective weight; a worse player outranks a better one at the same position | Draft | `useVORPCalculations.ts:166-227` (VONA baseline); `usePlayerRecommendations.ts:57-79`; `SuggestedPicks.tsx:404-415` | **Conditional** (draft season; dashboard computes now, low traffic) | W2-5 D2; Astra §2 | Reproduced (100/99/0 → 42.58/92.07/−6.93) |

**Fable P0s not carried, and why**
- **W2-1 D2 Game Grid legacy views:** already W1 P0 #14; Wave 2 adds the cron 390 and `expected_goals` readers to that row.
- **W2-5 D1 Source Accuracy 0%:** the component is not rendered anywhere (Astra §1.1). P2, repair before activation. Its active sibling, the projections-table diff columns (M-DRF-010), is P1.
- **W2-4 D3 Results Luck Index:** 0 of 732 current-season rows publish (reported). P1 now; becomes P0 if last-N cohorts publish. Do not "fix" by inverting it.
- **W2-8 D1 ledger:** P1; becomes P0 only if `/api/v1/forge/scoreboard` has a reader outside the repo (owner question Q36).

### Combined Waves 1 + 2 P0 count

| Wave | Live | Conditional | Total |
|---|---:|---:|---:|
| Wave 1 (Batch A + B/C) | 29 | 1 (W1 #17 Start Chart) | 30 |
| Wave 2 | 13 | 1 (W2-P0-14 draft season) | 14 |
| **Combined** | **42** | **2** | **44** |

Four Wave 2 rows share a root fix with a Wave 1 P0 (W2-P0-5 with #4, 6 with #13, 10 with #2, 11 with #10). Counted by distinct root cause, the combined list is **40** (38 live + 2 conditional). W2-P0-13 shares its root with W1-6 D15, which was not a Wave 1 P0.

---
## Owner decisions still open (not answered by decisions 1–68)

For Chef's pop-ups. Recommended answer first, then one alternative. **Tier A** blocks a Wave 2 P0 or P1 fix; **Tier B** can wait for its lane. 37–39 belong to the Codex BLSH lane.

| # | Question (source) | Recommended | Alternative | Why it matters | Tier |
|---:|---|---|---|---|---|
| 1 | NST season-long views: regular season only? (W2-1) | Yes, type 2 only; playoff views later | One view with a game-type parameter | Target of W2-P0-1 | A |
| 2 | Game Score definition, WiGO and BLSH (W2-1, W2-9) | Keep the house variant, labelled "FHFH Game Score (all-situation goals)" with its formula, until a verified 5v5 goal source exists | Even-strength goals now (not true 5v5: includes 4v4, 3v3) | One name, two definitions | B |
| 3 | Apply physical-totals migration `20261020211500`? (W2-1) | Not yet: keep the reported fallback; apply later as its own approval after a season/cutoff guard (Astra C8) | Apply now | Production migration; RPC ignores `p_cutoff` for the prior season | B |
| 4 | PP deployment share denominator (W2-1, W2-6) | Keep the conditional share, labelled "share of PP-unit games"; add a named dressed-game share only if wanted | Switch to games dressed | Tallies, social, draft, RSO read it; Astra withdrew it as a defect | B |
| 5 | Where do 6v5 without a penalty, 4v4 and 3v3 go in PP/PK filters and skater TOI? (W2-2, W2-6; decision 59 says "classified", not where) | PP/PK = penalty-advantage intervals; pulled-goalie time its own bucket; 4v4/3v3 in ES; one predicate for time and events; pin NST's rule from a saved reference first | Raw skater inequality (today 6v5 = PP) | Scope of the W2-P0-2 fix and the FORGE split | A |
| 6 | Canonical PP clock for displayed PP TOI and share (W2-6) | Penalty-box simulation, once its coverage contract exists; FORGE split stays a model input | Repair FORGE's classifier and display it | Blocks W2-P0-13 | A |
| 7 | What is a "line"? (W2-6) | Most-used observed 5v5 units, after the overlap repair; all-strength kept as legacy | All-strength pivot grouping, labelled | `/lines`, tallies, FORGE prior | B |
| 8 | PP2 minimum (W2-6) | Below a validated share of team PP time = "incidental" | No minimum; show seconds | Trend-card moves | B |
| 9 | Line-card goalie record (W2-6) | Goalie's own credited decisions | Team record in his appearances, labelled | Part of W2-P0-12 | A |
| 10 | Goalie week bar and ties (W2-2; Astra R3) | Starters only (≥ 1 start, ≥ 20 min); half credit for ties; missed weeks excluded, weeks played shown | All goalie-weeks, per-60 | Tier contract | B |
| 11 | Sample floors: variance pages and composites (W2-2, W2-4) | Visible, user-lowerable default (e.g. 5 starts) with "insufficient sample"; composites at page defaults | Keep 0 GP and 1 GP / 300 s | Percentiles vs a 1-GP population | B |
| 12 | Ratings overlay on historical tables (W2-2) | Hide for non-current ranges; date it when current | Always show latest, dated | Wrong-season ratings | B |
| 13 | Record columns under split filters (W2-2, W2-3) | Hide outside all strengths / all scores | Relabel "games with time in this split" | Presentation | B |
| 14 | Landing SOS (W2-2) | Record-only, labelled; revisit after W1-4 fixes | PRD 50/50 now | Depends on unfixed ratings | B |
| 15 | "Last N" on a split, and split GP (W2-3) | Player's last N games played (decision 16), split numbers inside; split GP = games with split time, labelled | Last N games with split time (today) | Split window membership | B |
| 16 | Team "# of GP" (W2-3) | Each team's last N by date; merge with "# of Team GP" | League-wide slice, relabelled | "Last 10" gives most teams 0–1 games | B |
| 17 | Players with no position (W2-3) | Show as position unknown | Hide | Rule 5 | B |
| 18 | Variance skaters advanced columns (W2-3) | Relabel pooled iCF/60 now; hide IPP and iXG/60 until an NST on-ice source is wired | Wire NST on-ice CF, IPP, ixG now | Blocks W2-P0-8 | A |
| 19 | Composite scale (W2-4) | "Score 0–100, not a percentile"; no percentile formatting; BEAST thresholds stay on the score | True percentile in cohort, thresholds re-derived | Offense/Defense contract, tiles | A |
| 20 | Composite missing inputs (W2-4) | Refuse for all composites (MCM policy) | Labelled partial score with coverage | Silent reweighting | B |
| 21 | Rankings last-N across seasons (W2-4) | Decision 61 pattern: current season default with actual n; optional labelled cross-season | Cross-season by default | Window membership (W2-4 A2) | B |
| 22 | Unit of ranked GAx and Unrealized xG (W2-4) | Window count in goals; per-60 as separate columns | Per-60 everywhere | Labelling of W2-P0-11 | A |
| 23 | Goalie matrix strength mix, Value Signal (W2-4) | One strength per view; drop Value Signal until defined | Keep mix, per-column labels | Mixed strengths | B |
| 24 | Deployment peer group (W2-4) | Usual line over the window | Last game's line, labelled | Peer cohorts | B |
| 25 | RBS and Steal (W2-4) | Separately named FHFH measures | Vollman RBS (SV% < .850) | Decision 40 covers QS only | B |
| 26 | Draft base score (W2-5) | VORP only; VONA its own column until a replay test supports a blend | Blend with a replay-fitted VONA share | Blocks W2-P0-14 | A |
| 27 | Replacement reference (W2-5) | Frozen full-league reference for totals, awards, scenarios; live board may use real league fills; bench excluded | Remaining-pool baseline everywhere, with fills | VORP drifts during a draft | A |
| 28 | UTIL eligibility (W2-5) | Any non-goalie (matches the allocator) | Forwards only, documented | D replacement level | B |
| 29 | Category-league draft winner (W2-5) | Projected category standings from starting slots, ratio-aware (decision 62) | Summed category z over starters | Uses fantasy points today | B |
| 30 | `0/0` and `00:00` placeholders (W2-7) | Writer stores null when absent; labels from WGO or shift seconds; history repair approved separately | Keep writer; drop these targets | Live ingestion writes them | B |
| 31 | Empty-net definition (W2-7) | Scored into the opponent's empty net; own-net-empty goals keep official strength | Either goalie pulled (today) | EN over-count (35%, 97 games) | B |
| 32 | `LEDGER_MARKET_ENABLED` (W2-7) | Off until decision 30's fixes (env change, own approval) | Leave on (no rows today) | Avoid silent market rows | B |
| 33 | Evidence to settle a non-appearance (W2-8, reframed by Astra PR1) | Lane builds identity-complete receipts from stored final boxscores (no provider calls) | Unconditional scores stay unavailable until a new producer | Unblocks W2-8 D1; row counts are unsafe | A |
| 34 | Unassigned start share (W2-8) | Show it on the team-game; mark totals incomplete (decision 47) | Flag totals only | RSO goalie planning | B |
| 35 | Forecast lead-day unit (W2-8) | NHL schedule dates, one versioned change for all consumers | Keep UTC, disclosed | Evening games split from their slate | B |
| 36 | Is `/api/v1/forge/scoreboard` read outside the repo? (W2-8) | No (W2-8 D1 stays P1) | Yes (D1 becomes P0) | Ledger fix priority | A |
| 37 | Does decision 35 rename BLSH lists? (W2-9) | Yes, e.g. "Below / above own reference (retrospective)" | Keep names with a retrospective disclaimer | Codex lane | B |
| 38 | Legacy BLSH snapshot (W2-9) | Disallow legacy directional lists; keep a labelled historical view until a successor contract | Render legacy lists, gate failures flagged | Codex lane | B |
| 39 | BLSH β (W2-9) | Descriptive context only, out of membership until validated | Refit and keep in membership | Codex lane | B |
| 40 | `team_discipline_stats` trigger (W2-1) | Leave until the cleanup inventory (rule 6) | Disable now | Writes unread wrong-unit rows | B |

Tier A: 1, 5, 6, 9, 18, 19, 22, 26, 27, 33, 36 (11 questions).

**Not carried:** mock-draft release and `wgo_skater_stats` label repair (approvals, below); dormant goalie totals view (rule 6 cleanup); community top-250 admission (Astra rejected the monotone-admission premise); source-accuracy stats (component unwired); first 2026-27 season-release contract (after blockers); season-ahead labelling (decision 39); BLSH list size and ranking basis (decided 2026-11-03).

**Approvals the sprint will need (actions):** one bounded underlying-stats summary rebuild after L1 and L2, with key-level receipts (rule 14); SQL migrations (NST season views, Game Score RPC, `nhl_team_data`, `goalie_weekly_aggregates` and others); the `wgo_skater_stats` 2010–2017 label repair; the physical-totals migration (Q3); the mock-draft migration if released; historical ledger resettlement; the `LEDGER_MARKET_ENABLED` change; the BLSH successor snapshot (Codex). Wave 1 approvals still stand.

---

## Suggested fix-lane grouping (draft for FIX-SPRINT-PLAN step 3)

Grouped by code area so that no two lanes own the same files. Paths are directories or files named by the audits; Chef should confirm exact paths when writing each brief. Every lane also inherits its Wave 3 findings. "Reads from" marks a dependency on another lane's output, not shared ownership.

| Lane | Owns | Wave 1 P0s | Wave 2 P0s | Other Wave 2 findings | Reads from / order | Owner Qs |
|---|---|---|---|---|---|---|
| **L1 Event state, parity and PBP ingestion** | `web/lib/supabase/Upserts/nhlStrengthState.ts`, `nhlNstParityMetrics.ts`, `nhlRawGamecenter.mjs`; `web/pages/api/v1/db/update-stats/[gameId].ts` | #4 (parity path), #6, #7 | Shared parser and manpower/net-state predicate for #2; running-score helper for #5 | Distance sums and counts in parity (W2-2 PR-U3); EN and SO classification, `0/0` placeholders (W2-7 D1) | First (definitions) | 5, 30, 31 |
| **L2 Underlying-stats landing and team summaries** | `web/lib/underlying-stats/**`, `web/pages/api/v1/underlying-stats/**`, `web/pages/underlying-stats/**`, `web/components/underlying-stats/**` | #2 (hide bucket xG and xGF% sort here), #5 | W2-P0-2, 3, 4, 5, 6, 7 | W2-2 D10–D14, D19, PR-U5, E3; W2-3 D5, D7, D9–D17, A1, A2, A4, C5, DR1–DR5 | After L1; pooled PP/PK helper from L12 | 12–17 |
| **L3 Variance pages, roster matrix, TOI parser** | `web/components/GoaliePage/**`, `web/pages/goalies.js`, `web/components/SkaterPage/**`, `web/components/RosterMatrix/**`, `web/lib/NHL/TOI.ts` | — | W2-P0-8 | W2-2 D6–D10, PR-U1, PR-U2, PR-U4; W2-3 A3, A5 | Parallel with L2 | 10, 11, 18 |
| **L4 NST SQL views, WiGO and Game Score** | New migrations for `nst_seasonlong_*`, `get_skaters_avg_stats`, Game Score RPC, `nhl_team_data`, `goalie_weekly_aggregates`, `player_totals_unified`, `gameOutcomes`; `web/pages/api/v1/db/update-nst-gamelog.ts`; `web/utils/fetchWigo*.ts`; `web/hooks/useWigoGameLog.ts`; `web/components/WiGO/**`; `web/components/PlayerStats/PlayerRadarChart.tsx` | #8 (radar) | W2-P0-1 | W2-1 D3, D4 (view), D6, D8–D14, PR-SQL-1, PR-SQL-3, F1 | First (definitions); migrations need approval | 1, 2, 4, 40 |
| **L5 Rankings** | `web/lib/rankings/**` (including `teamUnitToi*`), rankings components, `web/pages/rankings.tsx`, `web/lib/splits/splitsServer.ts`, `web/lib/ratings/**` | #10 (consumer: luck index) | W2-P0-9, 10, 11 (consumer side) | W2-4 D3, D5–D13, A1–A3; W2-6 §3 overlap, coverage and nightly loader | After L6 (count/exposure support fields) | 11, 19–25 |
| **L6 Rolling player averages and trends** | `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts`, `rollingPlayerPpShareContract.ts`, `web/lib/rollingPlayer*.ts`, trend page and `web/lib/trends/**` | #9, #11, #10 (producer aliases) | W2-P0-11 (producer side) | W2-4 D5 (iCF → iFF and provenance flag) | First (units) | 21 |
| **L7 Sustainability** | `web/lib/sustainability/**`, `/charts` sustainability routes (`web/pages/api/SustainabilityStats/**`), Sandbox | #23, #24, #25 | — | W2-1 F2 (`score.ts` zero imputation, source date) | After L3 (`TOI.ts`) | — |
| **L8 Lines, PP combinations and TOI API** | `web/components/LineCombinations/**`, `web/pages/lines/**`, `web/components/LinemateMatrix/**`, `web/utils/getPowerPlayBlocks.ts`, `web/utils/extractPPDetails.ts`, `web/pages/api/toi.ts`, `web/components/TimeOnIceChart/**`, `web/components/PowerPlayCombos/**`, `web/pages/api/v1/db/update-power-play-combinations/**`, `web/lib/supabase/Upserts/powerPlay*`, shift-chart and `web/components/DateRangeMatrix/**` readers, `web/lib/socialShare/trends.ts` | — | W2-P0-12, 13 | W2-6 D3–D8 | Parallel; FORGE classifier change stays in L9 | 6–9 |
| **L9a FORGE skater path** | `web/lib/projections/` skater stage, calculators, queries (incl. `team-context-queries.ts`), `ingest/shifts.ts`, `derived/**` | #18, #19, #21, #22 | — | W2-1 PR-SQL-2/F3 reader, C8 cutoff scope; W2-6 §1 one classifier for counts and exposure | After L4 (`nhl_team_data`) | 3 |
| **L9b FORGE goalie path, starters, accuracy** | `web/lib/projections/stages/goalie-stage.ts`, goalie queries and outcomes, starter model, Start Chart, `web/pages/api/v1/db/run-projection-accuracy.ts` | #16, #17 (cond.), #20 | — | W2-8 PR5 upstream mixture identity (relief needs candidate identity first) | Parallel with L9a | — |
| **L10 Served ledger and player-forecast planning (TS)** | `web/lib/player-forecasts/**`, `web/lib/fantasy-projections/**`, `web/lib/forecast-diagnostics/**`, `web/pages/api/v1/db/forge-served-forecast-*.ts`, `web/pages/api/v1/forge/scoreboard.ts` | — | — | W2-7 D6, M-PFC-120; W2-8 D1–D5, D8, D11, D12, PR8, PR9 (TS twins) | After L9b; resolver tolerance coordinated with L11 | 32–36 |
| **L11 RSO bridge and roster optimizer** | `web/lib/rosterScheduleData/**`, `web/lib/rosterScheduleOptimizer/**`, `web/components/RosterScheduleOptimizer/**` | #26, #27, #28 | — | W2-8 D2 (emit unrounded probabilities), D3 (reserve codes); W2-1 C2 bridge `nhl_team_data` reader | After L9b and L10 | 34 |
| **L12 Team ratings, Game Grid, pickup, Week Score** | `web/lib/power-ratings.ts`, `teamRatingsService.ts`, `teamRatingsTrend.ts`, `web/pages/api/v1/db/update-team-power-ratings*.ts`, `web/components/GameGrid/**`, `web/components/PlayerPickupTable/**`, `web/lib/gameGoalProjections/**` and the cron 390 route | #12, #13, #14, #15, #29 | Shared pooled PP/PK helper used by W2-P0-6 | W2-1 D2 (cron 390, `expected_goals` readers) | Parallel | — |
| **L13 Draft Dashboard, Draft Pro, category value** | `web/components/DraftDashboard/**`, `web/lib/draftDashboard/**` (incl. `playerValues.ts`, `categoryStandings.ts`), `web/lib/draft-pro/**`, `web/hooks/useVORPCalculations.ts`, `usePlayerRecommendations.tsx`, `useProcessedProjectionsData.tsx`, `web/lib/mockDraft/**`, community ranking files | #30 (if its core is `playerValues.ts`; confirm) | W2-P0-14 | W2-5 D3–D14, §1.2, §4.2 | Parallel; before next draft season | 26–29 |
| **L14 xG model and shot map** | xG modelling code, `web/components/ShotVisualization/**` | #1, #3 (and the model side of #2) | — | — | Demotion of `cfg9bac2706` is its own approval (decision 5) | — |
| **L15 Python season and forecast models** | `modeling/player_forecasts/**` | — | — | W2-7 D1 (Python side), D2–D5, D7–D10, M-PFC-110; W2-8 D9, D10 | Last (dormant) | — |
| **Codex: BLSH (out of scope for Claude lanes)** | `web/lib/buyLowSellHigh/**`, `web/scripts/blsh/**`, BLSH preview and trade pages, `web/lib/player-cards/retainedBlsh.ts` | — | — | W2-9 A1, A2, D1–D8 | Codex lane | 37–39 |

**Suggested order (at most 4 lanes at once):**
1. Definitions and units: **L1, L4, L6, L14**.
2. Readers of those definitions: **L2, L3, L5, L8**.
3. Models and planners: **L9a, L9b, L12, L13**.
4. Evaluation and downstream: **L10, L11, L7, L15**.

L2 carries the most P0s (six) and the largest single file (`playerStatsLandingServer.ts`); if it proves too large, split it by file (landing/goalie server vs team summaries and queries), never by finding. The underlying-stats rebuild runs once, after L1 and L2 both land (rule 14).
