# Wave 2 audit: Underlying stats summaries, part 2 (M-UST-061 to M-UST-098)

Auditor: Claude (Fable), 2026-11-11. Checkout: `octoberBranch` at `6d574deab`. Read-only: no code, data, migration or deployment was changed. Packet: [../packets/underlying-stats-summaries-part2.md](../packets/underlying-stats-summaries-part2.md).

Evidence labels (from BATCH-BC-CONSOLIDATED): **reproduced** = the real source function was run on a synthetic fixture; **source-confirmed** = traced in code, not run; **data sample** = a bounded production read, quoted with its date range and size (never a population rate). Reach labels: **live**, **conditional**, **dormant**, **dead**.

---

## 0. Brief (written before the audit)

TRIAGE gives this packet one line: "OT game-clock bug; PBP-only fallback mixes xG models and skips the score-state filter on shots" (rank 19, M). Section 4 item 5 asks whether HDCF, SCF, GSAA and Leading/Trailing are meant to equal NST's (M-UST-079, 080). Decisions 6, 7, 9, 10, 11, 12 and 13 have since answered that.

**Questions to answer**
1. Do the aggregation rules (per-60, percentages, GP, TOI per game, trade grouping, per-season and per-game views) compute what their labels say, as ratios of sums on the right denominators and units?
2. Do the scope windows (last N games, last N team games, date range, minimum TOI) select the games the labels promise, for players and for teams?
3. Does the game clock, the finished-game rule and the refresh selection feed the right games and event times into the summaries?
4. Do the two strength classifiers (shift-backed and PBP-only) and every reader of `strength_exact` agree on which side is home?
5. Are the team summary rows (shots, goals, danger, xG, TOI, standings) internally consistent across strength and score-state splits?
6. Which heuristics carry an NST or percentile label they have not earned (danger buckets, bucket xG, GSAA, heatmap "percentiles", trust tags)?
7. For the small or legacy entries (variance skaters, xG explorer, SoS scripts, shots by coordinate, legacy TOI), is the code live, and if live is it right?

**Reference standards**
- Natural Stat Trick glossary conventions as fixed by owner decisions 9–11: per 60 = count × 60 ÷ TOI minutes; on-ice share = for ÷ (for + against) on pooled counts; IPP = points ÷ on-ice goals for; HDGAA = high-danger goals against per 60 of goalie TOI; GSAA = SA × (1 − league SV%) − GA at the aggregate level; Leading and Trailing include one-goal margins.
- NHL.com definitions: SH% = G ÷ SOG; PP% = PPG ÷ PP opportunities; PK% = 1 − PPGA ÷ times shorthanded; standings points 2/1/0 with ROW = regulation plus overtime wins; a playoff overtime loss is a loss with no point; regular-season OT is 5 minutes, playoff OT 20 minutes.
- NHL api-web play-by-play `situationCode`: four digits, away goalie, away skaters, home skaters, home goalie (as coded in `nhlStrengthState.ts:24-37` and pinned by its tests).
- Public xG practice (MoneyPuck, Evolving-Hockey): xG is outcome-blind and excludes blocked attempts. Used here only by citing W1-1 and W1-2; not re-audited.
- Where no public formula exists (trust tags, narrative bullets, heatmap grade, coverage ratios): internal soundness and honest labelling.

**Upstream audits cited, not repeated**
- [xg-part1.md](xg-part1.md) (W1-1): shot features, rebound and rush flags, bucket xG, leaky champion.
- [nst-derived-stats.md](nst-derived-stats.md) (W1-2): parity counts, score-state exposure (D1), bucket xG on the pages (D2), penalty classes (D3), GSAA (D4), danger and scoring-chance definitions (D5), radar cohort (D6).
- [team-ratings-power-ctpi-sos.md](team-ratings-power-ctpi-sos.md) (W1-4): the ratings that feed the trust tags and narratives, and the live SoS writer.
- [sustainability-part1.md](sustainability-part1.md) (W1-9): the `/charts` routes that call `parseTime`.
- TRIAGE C36 (goalie MD/LD double count) and C37 (skater split key) belong to part 1 of this family; noted where they touch an entry here.

**Fixtures and data**
- A temporary Vitest file (described in Limits) calling `buildStoredPbpEventSequence`, `buildLandingApiResultFromAggregationRows` and `formatStrengthExact`.
- Existing tests: `playerStatsLandingServer.test.ts`, `nhlStrengthState.test.ts`, `nhlPlayByPlayParser.test.ts`.
- Bounded production reads: `team_underlying_stats_summary` aggregates on indexed columns by season, strength, score state and date; one game of `nhl_api_pbp_events` (scalar columns only); six rows of `wgo_skater_stats`; existence probes on `nhl_api_shift_rows` and `nhl_api_game_roster_spots`. No jsonb or payload reads, so the player and goalie summary partitions (stored as payloads) were not read.

**Done criteria**
- Every one of the 38 entries has a verdict with file:line evidence and a reach label.
- Every defect has a magnitude (reproduced, data sample, or "not measured" with what would measure it), its readers, a fix and a test.
- Every query and the scratch test are recorded in Limits.

---

## 1. Summary

**Verdicts (38 entries):** sound 12 · mis-specified 13 · wrong 13 · undetermined 0.

Of the 13 wrong entries: 6 are live (M-UST-080, 081, 085, 090, 091, 098); 1 is live but low-impact (073, the OT clock); 2 are conditional (072, 092); 2 are dormant on the sample (062, 064); 2 are dead code (078, 083).

**Top 5 findings by user impact**

1. **Team special-teams rows show the other side's shots (P0, live, data sample).** `teamStatsSummaryRefresh.ts:334-346,631-633` reads `strength_exact` as home-v-away. The parser writes it away-v-home (`nhlStrengthState.ts:40-45`). TOI comes from a separate, correct path. So a team's power-play row pairs its PP ice time with the shots taken while it was short-handed.
   - 106 games (212 team-games), 2026-10-25 to 2026-11-09: `powerPlay` rows sum to CF 317 against CA 2,227, and GF 48 against GA 190. `penaltyKill` is the mirror image. 1 of 106 home teams out-attempted its opponent on its own power play.
   - The same misread is in the goalie shot-feature filter (`playerStatsLandingServer.ts:1708-1720,1888-1890`), so goalie danger-split goals and danger xG under PP/PK filters come from the wrong man-advantage state (source-confirmed).
2. **Team score-state filters have zero ice time (P0, live, data sample).** `home_score`/`away_score` are stored only on goal events (7 of 365 events in game 2026020281), and the team TOI segments need a score on every event (`teamStatsSummaryRefresh.ts:323-324,539-567,570-605`). Over the same 212 team-games, `toi_seconds` is 0 for tied, leading, trailing, up one, down one and within one, while the shot counts are populated (tied CF 3,880). Every per-60 rate is blank and any minimum-TOI filter empties the table. Team "Leading" and "Trailing" also exclude one-goal margins (leading CF 1,893 + up-one 1,789 are disjoint), against decision 11.
3. **Descending sort puts empty values first (P0, live, reproduced).** `compareNullable` returns "null last", then the direction flip negates it (`playerStatsLandingServer.ts:5179-5216`; teams `teamStatsQueries.ts:392-395,784-794`). First click on any column sorts descending, so a skater with no shots tops SH%, and players with no on-ice goals top IPP.
4. **Variance skaters "CF/60" is not Corsi-for per 60; IPP and iXG/60 are always blank (P0, live, source-confirmed plus data sample).** The page never selects the three `nst_*` fields (`seasonSkaterRows.ts:4-33`; the columns don't exist on `wgo_skater_stats`). "CF/60" therefore always falls back to an unweighted mean of per-game individual shot attempts per 60 (`skaterMetrics.ts:381-383`), about 4–20 in six sampled rows where on-ice CF/60 is about 55–60.
5. **Team "# of GP — Last X games" is the league's last X games, not each team's (P1, live, source-confirmed).** `teamStatsQueries.ts:880-886` keeps the N highest game ids across all teams. "Last 10" gives most teams zero or one game.

Also live and already owned upstream: the bucket xG (M-UST-080) overstates goals by 57% on the same sample (xG 1,069.8 against 681 goals, all strengths, 106 games), which adds a calibration number to W1-1 D6 / W1-2 D2.

---

## 2. Per-entry table

| ID | Verdict | Evidence | Reference | Magnitude | Downstream / reach |
|---|---|---|---|---|---|
| M-UST-061 per-60, GAA | **Sound** | `playerStatsLandingServer.ts:2059-2079`: count × 3600 ÷ TOI seconds, null when TOI is unknown or ≤ 0. Danger GAA divides by total goalie TOI (`:5094,5103,5112`). | NST per 60; NST HDGAA is also per 60 of total TOI | None. Inputs inherit W1-2 and C36. PIM/60 and faceoffs/60 use the player's own TOI, which is the NST convention. | Player, goalie landing, detail, chart. Live. |
| M-UST-062 PBP-only strength | **Wrong** | `:2395-2401`: 5v4 PP needs `strength_exact === "5v4"`, but the string is away-v-home, so a home power play is `"4v5"` and never matches; same for home 4v5 PK. `classifyTeamStrengthState` returns `EN` whenever either net is empty (`nhlStrengthState.ts:76-82`), so EV/PP/PK exclude every extra-attacker event, while the shift-backed path counts 6v5 as a power play (`:1793-1795`). | NHL `situationCode` | Home-team 5v4 and 4v5 counts are zero in fallback games. Fallback games: 0 of 277 regular-season games, 2026-10-01 to 2026-11-09. | Fallback only. **Dormant** on this sample. |
| M-UST-063 appearance and GP | **Sound**, definition to confirm | `:2461-2465,2868-2873,2938-2943`: one appearance per game with split TOI > 0 and a shift row. Team comes from the first shift row. | NST GP by situation (not verified against a saved NST page) | GP in a PP or PK split counts only games with that ice time, so TOI/GP is "per game with PP time". | All player and goalie views. Live. See owner question 2. |
| M-UST-064 PBP-only fallback counts | **Wrong** | Shot loop has no score-state filter (`:2721-2766`), the event loop does (`:2544-2564`). The event filter reads `home_score` on the event (`:1840-1841`), which is null except on goals, so under any score-state filter hits, faceoffs, penalties, giveaways, takeaways and blocks are dropped while shots are all kept. A context is created for a player whose only event failed the filter (`:2432-2435`), giving GP 1 with all zeros; a player with no event gets no row. 4-minute penalties get no class; ≥ 10 is one class (`:2616-2622`; decision 13, W1-2 D3). ixG is the bucket heuristic. | NST individual counts; decisions 11–13 | Not measured: no fallback game in the 277-game sample. | Individual counts only. **Dormant** on this sample; test it separately (Batch A, W1-2 A). |
| M-UST-065 trade mode | **Sound** | `:3089-3096,4359-4366`; label joins distinct teams (`playerStatsQueries.ts:205-209`). | PRD lines 142-143 | None. | Live. |
| M-UST-066 scope windows | **Mis-specified** | Last N keeps the N most recent rows that exist for the chosen split (`:3098-3114,4368-4384`); rows exist only where split TOI > 0. By-team-games in combine mode unions the last N games of every team the player appeared for (`:3311-3333,4416-4438`). | PRD lines 58, 138-139; decision 16 (team of record by date) | "Last 10" on a PP split is the last 10 games with PP time, however far back. A traded player gets up to 2N team games; the reported window start is the older team's (`:3181-3207`). | Landing, detail, chart. Live. Owner question 1. |
| M-UST-067 minimum TOI, TOI/GP | **Sound** | `:4196-4204,4239-4242`: seconds; a row with any unknown-TOI game is null and is dropped when a minimum is set. | NST minimum TOI | None. Unknown stays unknown (rule 5). | Live. |
| M-UST-068 per-season detail | **Sound** | `:4693-4770`: same ratio-of-sums merge, one game counted once. | — | None. | Detail pages. Live. |
| M-UST-069 per-game chart | **Mis-specified** | `:4859-4866` passes a single game through `createLandingRowFromSummaryRows`, which applies the table's minimum TOI to that one game. | — | A 300-minute season minimum (18,000 s) removes every chart point. Default minimum is null (`playerStatsFilters.ts:516,547`). | Expanded-row chart. Live when a minimum is set. |
| M-UST-070 points, IPP, SH%, FO% | **Sound** | `:4916-4951`: pooled ratios, 0–1; IPP null when any game lacks on-ice counts. | NST IPP; NHL SH% | None in the formula. On-ice GF inherits W1-2. | Live. |
| M-UST-071 on-ice shares | **Sound** (formula) | `:4997-5042`: for ÷ (for + against) on window totals. | NST | None in the formula. HDCF, SCF and xG inputs are W1-2 D2/D5. No oiSH%, oiSV% or PDO; only `ldcf` is exposed. | Live. |
| M-UST-072 finished-game filter | **Wrong** | `:805-825` compares the game's local date with the UTC date. The 8-hour guard runs only when the two are equal. | — | A 22:00 ET game on 11-08 starts 03:00Z on 11-09; from 00:00Z (three hours before puck drop) its date is "before today" and it counts as finished. The refresh selectors apply both tests and are right (`adminRouteHelpers.ts:317-322`, `playerStatsRefreshWindow.ts:68-73`). | Landing source games, by-team-games windows, live summary build (`:4609-4618`). **Conditional** on live build and on PBP being ingested mid-game; not measured. |
| M-UST-073 game clock | **Wrong** | `:929-935`: for period ≥ 4, completed periods × that period's own duration. `time_remaining_seconds` is not in the select list (`:225-250`), so the duration is always the period-type default: 300 s for any OT, including playoff OT. | NHL clock | **Reproduced:** P3 at 19:58 → 3,598 s; OT at 0:10 → 910 s (should be 3,610), gap −2,688 s; an OT event at 11:40 → 1,600 s. Effects are small: on-ice attribution and TOI use period-relative time (`nhlOnIceAttribution.ts:63-69`, `nhlNstParityMetrics.ts:608-613`); the rush scan stops at a period change (`nhlRush.ts:209`); a rebound needs a positive gap (`nhlRebounds.ts:146`). What breaks: a power play carried into OT gets a negative age (`nhlContextualFeatures.ts:347-366`), and stored `gameSecondsElapsed` is wrong for OT shots. | Shot features → parity and team summaries. Live, low impact. Copy at `teamStatsSummaryRefresh.ts:243-265`. |
| M-UST-074 position | **Mis-specified** | `playerStatsQueries.ts:249-253`: `F`, `W`, blank → null; null is excluded from every skater group including "all skaters" (`:270-275`). | — | Not measured (needs a count of null or F/W positions among players with appearances). | Every skater view. Live. An unknown position silently removes the player (rule 5). |
| M-UST-075 season fallback | **Sound** as a labelled fallback | `playerStatsFilters.ts:222-237,451-459`; copy in `teamStatsFilters.ts:400-415,665-670`. | NHL calendar | Sep 1–Jun 30 bounds and a local-time September rollover; used only when no canonical season is passed. Two copies. | Filter validation. Live, low impact. |
| M-UST-076 refresh watermark | **Mis-specified** | Player selection retries uncovered games back 7 days (`playerStatsRefreshWindow.ts:134-144`); goalie and team selections have no retry (`goalieStatsRefreshWindow.ts:86-125`). | — | Team coverage on the sample is complete: 277 of 277 games, 2026-10-01 to 2026-11-09. | Refresh routes. A failed older goalie or team game behind a newer covered one is never reselected. |
| M-UST-077 coverage | **Mis-specified** | `teamStatsQueries.ts:957-978`: summarized = ceil(rows ÷ 2), completed = games dated before UTC today (postponed included). The rebuild selector is stricter: two teams with TOI > 0 (`teamStatsSummaryRefresh.ts:1121-1170`). | — | One team row counts as a whole game. No gap on the sample. | Team page status panel. Live, low impact. |
| M-UST-078 shots by coordinate | **Wrong**, dead | `lib/supabase/shotsByCoord.js`: read-increment-upsert, no season or strength, raw x/y, UTA id 59 (`:41`). | Rink-normalised shot maps | Not measured. | No importer, no reader of `shots_goals_by_coord`. **Dead.** Don't delete on this finding (rule 6). |
| M-UST-079 danger buckets | **Mis-specified** | Three copies: `:2328-2342`, `:3433-3442`, `teamStatsSummaryRefresh.ts:462-479,517-523`. | Decision 9; W1-2 D5 | Data sample, 106 games: HD is 20.0% of team attempts (2,418 of 12,090) and scoring chances 54.0% (6,534). Aggregate shares are not event-level agreement with NST. | Team HD/MD/LD/SC columns, goalie danger splits, fallback iSCF/iHDCF. Live. Owned by W1-2 D5. |
| M-UST-080 bucket xG | **Wrong** (decisions 6, 12) | `:2344-2359`; `teamStatsSummaryRefresh.ts:481-515`; team rows give xG to blocked attempts (`:660,681-683`). A third variant in the goalie split floors only high-danger goals and has no rebound, rush or royal-road terms (`:3443-3452`). | Decisions 6, 7, 12; W1-1 D6; W1-2 D2 | **Data sample:** 106 games, all strengths: xG 1,069.8 against 681 goals (1.57×). 5v5: 782.7 against 421 (1.86×). | Team xGF, xGA, xGF% and the default rates sort (`teamStatsFilters.ts:333`, still `xgfPct`); fallback ixG. Live. Owned upstream. |
| M-UST-081 variance skater metrics | **Wrong** | Count per 60 = Σcount ÷ Σ`toi_per_game` × 3600 (`skaterMetrics.ts:338-366`); WGO game rows are seconds (data sample: 1,003–1,388 on 2026-11-08), so those are right. "CF/60" = mean of `nst_oi_cf_per_60`, else mean of `individual_sat_for_per_60` (`:381-383`); IPP and iXG/60 = means of `nst_ipp`, `nst_ixg_per_60` (`:384-389`). None of the three is selected (`seasonSkaterRows.ts:4-33`) or exists on the table. | NST CF/60 (on-ice) | "CF/60" shows individual attempts per 60, as an unweighted mean of game rates: 4.3–19.5 in six rows, against roughly 55–60 for on-ice CF/60. IPP and iXG/60 are blank for every player. | `/variance/skaters` advanced table (`SkaterAdvancedMetricsTable.tsx:56-58`). **Live.** |
| M-UST-082 bucket averages | **Mis-specified** | `skaterMetrics.ts:466-510`: unweighted mean across players, including SH% and variances. | — | A bucket SH% is the mean of player rates, not goals ÷ shots; the row is labelled "Avg", which is honest for counts. | Variance tables. Live, low impact. |
| M-UST-083 SoS game-log partition | **Wrong**, dead | `fetchSoSgameLog.js:288-291,302-305`: the inner `gameDateObj` shadows the outer, so past = all games and future = none. | Decision 21 | Every row, if it ran. | No importer. **Dead.** Live SoS is W1-4. |
| M-UST-084 SoS opponent totals script | **Mis-specified**, legacy | `lib/supabase/sosStandings.js`: past = date ≤ row date; missing opponent record → 0-0-0; opponents' records include games against the subject team. | Decision 21 (past = final only) | Not measured. | No importer; the live writer is `update-team-sos.ts` (W1-4). Legacy. If revived it breaks decision 21. |
| M-UST-085 sort, pagination, rank | **Wrong** | `:5179-5216`: null is "greater", then descending negates it. Fallback keys ignore direction (`:5227-5236`, fine). Teams: `teamStatsQueries.ts:392-395,784-794`. Team `rank` = row index after the user's sort (`:1020-1023`). | — | **Reproduced:** SH% descending returns the no-shot skater (null) above 30% and 0%. Team rank 1 is the worst team when sorted ascending; ties get different ranks. | Every landing and detail table. **Live.** |
| M-UST-086 goalie start share | **Mis-specified**, near-dead | `goalieTrends.js:12-34` (starts ÷ team games), bars use starts ÷ Σ starts; `gamesPlayed` holds `gamesStarted`. | — | Two denominators for "share" on one page. | Only `pages/statsPlaceholder.tsx:14`. |
| M-UST-087 trust type | **Mis-specified** | `teamLandingDashboard.ts:186-229`: hand-set cuts (103, 102, 0.12, 4×z, 6, 7). | None | Not measurable without a target. Inputs are the W1-4 ratings (slate-normalised power, decision 19). | `/underlying-stats` quadrant text ("needs a heat check", "could rebound"). Live. Predictive wording with no validation. |
| M-UST-088 narrative bullets | **Mis-specified** | `teamRatingNarrative.ts:228-285`: ±0.015 SOS, PDO z ±1, ratings 105/95, no sample-size gate. | None | Not measurable. "May cool toward normal" and "could rebound" are forecasts. | Team-rating narratives. Live. |
| M-UST-089 WGO team aggregation | **Sound** | `percentUnits.ts:165-206`: pooled PPG ÷ PPO, 1 − PPGA ÷ TSH, FOW ÷ (FOW + FOL), per-game shots weighted by games. | NHL.com; W1-4 direction (pooled) | None found. A row with null `games_played` is kept in the sums but adds no games; not observed. | Team Dashboard, L10/L5. Live. |
| M-UST-090 team scope and min TOI | **Wrong** | `teamStatsQueries.ts:880-886`: game range = N highest game ids league-wide. By-team range is per team (`:888-903`). UI label "# of GP", placeholder "Last X games" (`TeamStatsFilters.tsx:278-296`). Recency is by game id, not date. | NST last-N; PRD line 23 | "Last 10" covers at most 20 teams with one game each. | Team stats table. **Live.** |
| M-UST-091 team counts per split | **Wrong** | (a) PP/PK shots swapped: `:334-346,631-633` against `nhlStrengthState.ts:40-45`. (b) Score-state TOI zero: `:570-605` with scores only on goals. (c) `matchesTeamScoreState` (`:365-382`) uses the same bucket as players (`playerStatsLandingServer.ts:1722-1736`), where leading/trailing mean two or more. (d) Bucket xG. Counts close otherwise: CF = CA, HD + MD + LD = CF. | NST team tables; decisions 9, 11, 12 | **Data sample**, 212 team-games, 2026-10-25 to 11-09. (a) powerPlay CF 317 / CA 2,227, SF 191 / SA 1,130, GF 48 / GA 190; 5v4 CF 225 / CA 1,754. (b) TOI 0 in all six score states; allScores 775,800 s. (c) tied 3,880 + leading 1,893 + trailing 2,330 + up-one 1,789 + down-one 2,198 = 12,090. | Team stats page; `teams.ts` API. **Live.** |
| M-UST-092 outcome and points | **Wrong**, conditional | `:931-971`: an OT or SO loss gets OTL 1 and 1 point for every game type. Event fallback returns no winner for a shootout (`:813-818`) and both teams get zeros. Standings repeat on every split row. | NHL standings | **Data sample:** 3,208 team-games (2025-26 and 2026-27 regular season): 0 unresolved; W = L + OTL in both seasons. No playoff rows exist, so the playoff branch has not run. | Team W/L/OTL/ROW/points. Regular season right on the sample; playoffs **dormant**; fallback not observed. |
| M-UST-093 legacy TOI parsing | **Sound** (`parseTime`); rest dead | `lib/NHL/TOI.ts:82-91`: NST TOI is decimal minutes, passed through; callers compute shots ÷ minutes × 60. `fetchTOIData` targets the retired statsapi and has no importer. | NST TOI minutes | An integer TOI with no "." gives NaN → 0 at the callers. Not observed. | `/api/SustainabilityStats`, `/api/CareerAverages`, `/api/Teams` (W1-9 D3, D12 own their averaging). |
| M-UST-094 xG explorer rows | **Mis-specified** | Rolling-window xG sits beside transition and rebound fields summed over every season row the route returns (`xg.ts:391-398,416-419`; `xgExplorer.ts:345-354`). Missing created xG becomes 0 (`:381`). `expectedPrimaryAssists` is `shotAssistCreatedXg` (`:388`). Model version = the latest row's (`xg.ts:123-134`). | Decisions 5, 22; W1-1 | A 10-game xG beside season-to-date entries, exits and rebounds on one row. | xG Lab. Live. Inherits the leaky champion (W1-1 P0 1). |
| M-UST-095 coverage ratios | **Sound** | `xgExplorer.ts:254-330`. | — | The 2% cut is arbitrary but only drives a warning. | xG Lab. |
| M-UST-096 heatmap grade | **Mis-specified** | `PlayerPerformanceHeatmap.tsx:99-117,119-173`: hand-typed thresholds mapped to 95/85/60/35/15/5, weighted, then cut at 90/75/60/40/25/10; labels say "90th+ percentile" (`:197-205`). | None | "Elite" needs nearly every selected stat above its top threshold. Single-game SH% and CF% are graded against season-style cuts. | Player page calendar. Live. Not a percentile of anything. |
| M-UST-097 radar ratios | **Sound** | `PlayerRadarChart.tsx:242-254`: 100·a ÷ (a + b), or a ÷ b for SH%. | NHL SH%, FO% | None. Cohort and strength are W1-2 D6, decision 15. | Player radar. |
| M-UST-098 goalie aggregate | **Wrong** | (a) PP/PK swap in `filterGoalieShotFeaturesForState` (`:1888-1890`): HD goals and all danger xGA come from the opposite state, HD shots and saves from parity. (b) MD/LD goals added twice (C36, `:3548,3551,3458,3461`). (c) "GSAA" = bucket xGA − GA (`:5085-5088`; decision 10, W1-2 D4). (d) Danger xGA uses the third heuristic variant on SOG and goals only, so HD + MD + LD xGA ≠ total xGA. SV%, GAA, per 60 and distance averages are right arithmetic (`:5083-5084,5119-5126,3554-3563`). | Decisions 7, 10; NST goalie tables | (a) not measured: goalie summaries are payloads. On the team sample the two states differ about 7:1 in attempts, so the PP/PK danger splits are not close. (b) about 2× by construction. | Goalie landing, detail, chart. **Live.** |

---

## 3. Defects, with fix, test and priority

P0 = a user-visible wrong number on a live surface today. Rule 4 applies to every fix: each reader listed gets its own selection test.

### P0

**D1 · `strength_exact` read with home and away reversed (M-UST-091, 098, 062)**
- Where: `teamStatsSummaryRefresh.ts:334-346` used at `:631-633`; `playerStatsLandingServer.ts:1708-1720` used at `:1888-1890`; literal compares at `:2384-2404`.
- Why: `formatStrengthExact` writes `${awaySkaters}v${homeSkaters}` (`nhlStrengthState.ts:40-45`; tests `nhlStrengthState.test.ts:76-84` pin `1451` → `"4v5"` with the home team on the power play). Stored data agrees: game 2026020281 has 15 events with `situation_code = '1451'` and `strength_exact = '4v5'`, none with `'5v4'`.
- Magnitude: see finding 1. Symmetric states (5v5, 3v3, all, even) and empty-net filters are unaffected.
- Readers: team stats page and `/api/v1/underlying-stats/teams` (powerPlay, penaltyKill, fiveOnFourPP, fourOnFivePK rows of `team_underlying_stats_summary`); goalie landing, detail and chart danger splits and danger xG; PBP-only individual counts.
- Fix: stop parsing the string. Read skater counts from `situation_code` through `parseSituationCode` (the TOI path already does), or carry `homeSkaters`/`awaySkaters` on the shot feature row. One shared helper, used by all three readers. Then rebuild the affected team rows and player/goalie partitions as a separately approved, bounded step.
- Tests: a home power-play shot (`1451`) lands in the home `powerPlay` row and the away `penaltyKill` row; same for the goalie filter and the fallback path; an invariant on fixtures that team PP attempts-for ≥ attempts-against is **not** asserted (it can legitimately fail in one game); instead recompute each split from events with the situation code.

**D2 · Team score-state rows have no ice time; Leading/Trailing exclude one-goal margins (M-UST-091)**
- Where: `teamStatsSummaryRefresh.ts:268-331` (segment scores from the event), `:570-605`; the team score-state matcher `:365-382`.
- Why: scores are stored only on goal events, so a segment's score is null and never matches a state. The team path is separate from the parity path that W1-2 D1 covers.
- Magnitude: TOI 0 in all six score states over 212 team-games; per-60 columns null; minimum-TOI filter returns nothing.
- Readers: team stats page score-state filter, rates mode and counts mode TOI columns.
- Fix: carry the running score forward across events (the last known score applies until the next goal), classify intervals by the score after the event and events by the score before it, as Batch A requires for W1-2 D1. Make Leading and Trailing include one-goal margins (decision 11), with Up 1 and Down 1 as subsets. Rebuild as an approved step.
- Tests: conservation on a fixture (tied + leading-by-any + trailing-by-any TOI = all-scores TOI; up-one ⊂ leading); a goal at a segment boundary; a game with no goals is all tied.

**D3 · Descending sort lists nulls first (M-UST-085)**
- Where: `playerStatsLandingServer.ts:5210-5216`; `teamStatsQueries.ts:784-794`.
- Magnitude: reproduced (null above 0.30 above 0). Any column with a null (SH% with no shots, IPP, FO%, xG shares, every rate when TOI is unknown).
- Readers: player, goalie and team landing, detail tables, server pagination (page 1 can be all nulls).
- Fix: decide null placement before applying direction, so nulls are last both ways.
- Test: three rows (null, 0.3, 0) sorted both directions; nulls last in each. Add the same for teams.

**D4 · Variance skaters: "CF/60" mislabelled, IPP and iXG/60 never populated (M-UST-081)**
- Where: `skaterMetrics.ts:381-389`; `seasonSkaterRows.ts:4-33`.
- Magnitude: see finding 4.
- Readers: `/variance/skaters` advanced metrics table and leaderboard.
- Fix: either supply real on-ice CF, IPP and ixG (pooled: ΣCF ÷ ΣTOI, Σpoints ÷ Σon-ice GF, ΣixG ÷ ΣTOI) from a source that has them, or relabel the column "iCF/60" computed as Σattempts ÷ ΣTOI and hide IPP and iXG/60 until they have data. Don't average per-game rates.
- Test: recompute each rate from the matching counts and ice time on a frozen fixture (not a range check).

### P1

**D5 · Team "Last X games" is league-wide (M-UST-090).** `teamStatsQueries.ts:880-886`. Fix: per-team last N by date then id, or remove the control in favour of "# of Team GP" if they are meant to be the same. Test: 3 teams with staggered schedules; each keeps its own last 2. Owner question 3.

**D6 · Goalie danger splits beyond D1 (M-UST-098).** Danger xGA comes from a third heuristic on a different shot population than total xGA; MD/LD goals double (C36, part 1). Fix with W1-2 D4 and decisions 7, 10, 12: one population, bucket-specific league baselines for danger GSAA (Batch A, W1-2 A). Test: HD + MD + LD goals = total non-empty-net goals with known geometry; same for shots.

**D7 · Finished-game rule mixes local date and UTC (M-UST-072).** `playerStatsLandingServer.ts:805-825`. Fix: decide finished from `startTime` (start ≤ now − 8 h), or from a stored game state, as the refresh selectors already do. Test: a 22:00 ET game at 00:05Z, 04:00Z and 11:30Z. Conditional on mid-game data being available; verify before sizing.

**D8 · Scope windows for split strengths and traded players (M-UST-066).** Awaiting owner question 1. If "last N" means the player's last N games, select the games first (all-strength appearances, team of record by date per decision 16), then read the split inside them. Test: a player with PP time in 3 of his last 10 games shows GP 3 on the PP split for "last 10".

**D9 · xG explorer mixes windows (M-UST-094).** Limit the supplemental sums to the same games as the rolling row (or label them season-to-date), keep missing created xG as null with the coverage warning, drop or rename the `expectedPrimaryAssists` alias (decision 22). Test: rows outside the window don't change the output.

### P2

- **D10 · OT game clock (M-UST-073).** Use 1,200 s for periods 1–3 as the base for all later periods and add prior OT durations; select `time_remaining_seconds` or take playoff OT length from game type. Two copies. Test: the reproduced fixture gives 3,610 and a +12 s gap; a playoff OT event at 11:40 gives 4,300.
- **D11 · PBP-only fallback (M-UST-064).** Apply one score-state rule to events and shots using a carried-forward score; create a context only for dressed players (roster spot), with GP 1 for all of them; penalty classes per W1-2 D3 and decision 13; no bucket ixG (decision 12). Tests on the existing fixture at `playerStatsLandingServer.test.ts:3141` extended with a score-state case and a home power play.
- **D12 · Playoff overtime loss and unresolved shootout (M-UST-092).** No OTL or point when game type is 3; when the winner is unknown store nulls and exclude the game from the record, never zeros. Test per game type.
- **D13 · Chart minimum TOI (M-UST-069).** Apply the minimum to the row, not to each chart point.
- **D14 · Unknown positions (M-UST-074).** Keep F/W/blank players in "all skaters" with position shown as unknown; count them first.
- **D15 · Refresh retry and coverage (M-UST-076, 077).** Give goalie and team selection the same uncovered-game retry; count a game as summarized only with two team rows; exclude postponed games from "completed".
- **D16 · Honest labels (M-UST-082, 086, 087, 088, 096).** Heatmap: drop "percentile" unless thresholds come from a labelled reference distribution. Trust tags and narrative bullets: describe, don't forecast, until validated; they also wait on the W1-4 rating fix. Bucket SH%: pool goals ÷ shots.
- **D17 · Team rank (M-UST-085).** Rank by the metric's good direction with shared ranks for ties, or label it "#".
- **Dead or legacy, no action beyond a note (rule 6):** M-UST-078, 083, 084, and `fetchTOIData` in 093.

---

## 4. Owner questions not answered by decisions 1–68

1. **"Last N games" on a strength split (M-UST-066).** The player's last N games played, with the split's numbers inside them (a player with no PP time in some shows fewer PP games), or his last N games that had ice time in that split (today's behaviour)? And for a traded player in combined mode, should "last N team games" follow the team of record by date (decision 16), giving N games in total?
2. **Games played in a split (M-UST-063).** Should GP and TOI/GP on PP, PK, 3-on-3 and score-state views count only games with ice time in that state (today), or all games the player dressed for?
3. **Team "# of GP" against "# of Team GP" (M-UST-090).** Is "# of GP" meant to be each team's own last N games (making the two controls the same), or something else?
4. **Players with no recorded position (M-UST-074).** Show them under "all skaters" as position unknown, or keep them hidden?
5. **Variance skaters advanced columns (M-UST-081).** Supply true on-ice CF/60, IPP and ixG/60 (from which source: NST per decision 6, or the in-house summaries), or relabel to iCF/60 and hide the two empty columns?
6. **Team W/L and points under a strength or score-state filter (M-UST-092).** Show the record of the games in the window (today), or hide the record columns when a split is selected?

---

## 5. Limits

**Not done or not measurable here**
- Player and goalie summaries are jsonb payloads (`nhl_api_game_payloads_raw`, `goalie_underlying_summary_partitions`); the read rules forbid them. Goalie magnitudes for D1 and D6 are source-confirmed only.
- No NST page was fetched, so NST conventions are from decisions 9–11 and the Wave 1 audits, not from a saved reference.
- The PBP-only fallback (M-UST-062, 064) was not run end to end; no fallback game exists in the sample to measure.
- M-UST-072 depends on whether the live summary build is enabled for the public API and whether play-by-play arrives mid-game. Neither was checked.
- Unknown-position counts (M-UST-074) were not queried.
- Part 1 entries (M-UST-001–060, including C36 and C37) were not audited.
- All magnitudes are dated samples (rule 1). The data sample is 106 games; the fixture checks are three synthetic cases.

**Scratch test (run once, then deleted; nothing left in the tree)**
A Vitest file placed temporarily in `web/` and run with `npx vitest run <file>`:
1. `buildStoredPbpEventSequence` on three rows (period 3 REG at 1,198 s; period 4 OT at 10 s; period 4 OT at 700 s; no `time_remaining_seconds`), home 10, away 20. Output: durations 1200/300/300; `game_seconds_elapsed` 3598/910/1600; `seconds_since_previous_event` null/−2688/690.
2. `buildLandingApiResultFromAggregationRows` with the default landing state, individual counts, sort `shootingPct` descending, three rows (0 goals/0 shots; 3/10; 0/12). Output order: null, 0.3, 0.
3. `formatStrengthExact(parseSituationCode("1451"))` → `4v5`; `"1541"` → `5v4`.

**Queries (project `fyhftlxokyjtpndbkfse`, read-only, 2026-11-11; `pg_stat_activity` showed 1–2 active queries, longest 0.3 s, before the reads)**
1. Catalog: columns and indexes of `team_underlying_stats_summary`; indexes of `nhl_api_shift_rows`, `nhl_api_game_roster_spots`, `games`, `wgo_skater_stats`; `wgo_skater_stats` column names.
2. Strength sample:
   `select strength, count(*), sum(toi_seconds), sum(cf), sum(ca), sum(sf), sum(sa), sum(gf), sum(ga), sum(xgf), sum(xga), count(*) filter (where is_home and cf>ca), count(*) filter (where is_home), count(*) filter (where not is_home and cf>ca) from team_underlying_stats_summary where strength in ('powerPlay','penaltyKill','fiveOnFourPP','fourOnFivePK','fiveOnFive','allStrengths') and score_state='allScores' and season_id=20262027 and game_type=2 and game_date between '2026-10-25' and '2026-11-09' group by strength;`
3. Score-state sample: same table, `strength='allStrengths'`, same season, type and dates, grouped by `score_state`, summing TOI, CF, SF, GF, the HD/MD/LD for/against columns, SCF, wins, losses, OTL, points, and counting rows with `wins+losses+otl=0`.
4. One game of events: `nhl_api_pbp_events` for game 2026020281 (picked as the lowest id with an OT loss on 2026-11-08): counts of events, of rows with `home_score`, of goals, of non-goal rows with a score, max period, period types, OT event count and max elapsed, and counts of `situation_code`/`strength_exact` pairs (`1451`/`4v5`, `1451`/`5v4`, `1541`/`5v4`). Scalar columns only.
5. Fallback frequency: `games` dated 2026-10-01 to 2026-11-09 grouped by season and type, with `not exists` probes on `nhl_api_shift_rows`, `exists` on `nhl_api_game_roster_spots`, and `not exists` on the all/all team summary row. Result: 277 regular-season games, 0 without shifts, 0 without a team summary.
6. WGO units: `select player_id, date, games_played, toi_per_game, pp_toi, pp_toi_per_game, individual_sat_for_per_60, shooting_percentage from wgo_skater_stats where date='2026-11-08' order by player_id limit 6;`
7. Outcomes: all/all rows for seasons 20252026 and 20262027 grouped by season and game type: team-games, W, L, OTL, points, unresolved, min and max date. Result: 2,624 and 584 team-games, regular season only, 0 unresolved.
