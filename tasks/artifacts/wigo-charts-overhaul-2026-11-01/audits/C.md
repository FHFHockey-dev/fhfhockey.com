# Lane C: are the calculated numbers right? (2026-11-01)

Current season from the data: **20262027** (first regular-season game id `2026020001` on 2026-09-29, latest rows 2026-10-31; ledger C-08, C-10). Targets come from `TARGET-PLAYERS.md`: McDavid 8478402 (star), Imama 8478147 (depth), Bystedt 8483428 (rookie, low GP), Mercer 8482110 (traded).

**Short version.** The formulas are nearly all right. The numbers on the page are often wrong because of what feeds those formulas. Every formula I recomputed by hand matched its stored value (L-windows, 3YA, CA, DIFF, pace, Game Score, radar, team drivers) as long as its inputs were sound. Six problems put wrong or empty numbers on screen today. Five of them are in the writer or in `wigo_career` / `wigo_recent` data, and one is in the percentile source and how the client falls back from it.

Evidence tags: `code`, `production read (C-nn)`. Paths are relative to the repo root. `Writer` = `web/pages/api/v1/db/calculate-wigo-stats.ts`. New findings are numbered from C-20 so they don't collide with the 10-25 audit's C-01 to C-17. Ledger queries are also named C-01 to C-20: in an evidence note or the Evidence column, C-01 to C-19 means a ledger query, and "ledger C-20" means the last query rather than finding C-20. In the re-verified table's Item column, the IDs mean the old findings.

## Worst findings

### C-20 — P0 — The writer times out, so 84 current skaters keep stale rows and "STD" can be last season
- **Where:** Writer `:176-181` (ascending id order, from commit `1b5c36024`, 2026-10-25), `:256` (sequential loop), `:253` (flushes every 200 rows); `web/vercel.json:6` `maxDuration: 240`.
- **Failure:** The 11-01 run started at 08:50:07 and its last write was at 08:53:22. It wrote exactly 1000 rows (5 × 200), and the highest id was 8483787. Everything above that id was not rewritten. Up to 199 rows processed after the last flush are lost as well. Since 10-25 the order has been fixed, so the same high ids (mostly young players) starve on every run.
- **What the user sees:** 84 of 727 current skaters (379 points) have stale `wigo_career` and `wigo_recent` rows: 33 from 09-17/09-18, 2 from 10-01, 48 from 10-24, 1 from 10-31. The September rows predate the season, so "STD" holds 2025-26 and "LY" holds 2024-25. Player 8484144: STD 69 GP, 75 pts; the real season is 8 GP, 9 pts. 8485366: STD 82 GP, 59 pts; real 14 GP, 14 pts. 8484136: STD 66 GP; real 16 GP. On the same page, season production and pace read the correct totals, so the panels contradict each other. The page has no as-of signal.
- **Verified:** production read C-05, C-06, C-07. Code for the 240 s limit. The timeout as the cause is inferred from the 240 s window fitting the timestamps; I did not read cron logs (lane B has `cron_job_audit`).

### C-21 — P0 — 145 of the 643 current skaters in the 11-01 run show ATOI 0:00, ixG 0.0 and iCF 0, with every per-60 blank
- **Where:** Writer `:423-448` (initialises `toi_all`, `ixg_all`, `icf_all` to 0), `:524` (`safeDivide(0, gp)` returns 0, not null), `:536`, `:543`; same pattern for LY `:615`, 3YA `:759`, CA `:903`. Display: `statMetadata.ts:355`, `:379-385`.
- **Failure:** When a player has no NST seasonal row, the writer stores real-looking zeros. Matthew Tkachuk (14 GP, 20 pts, 18:50 per game in WGO): ATOI 0:00. With the default STD vs CA, DIFF reads −100% on ATOI, ixG and iCF. Also Elias Pettersson 8483678, Landeskog, Gritsyuk, Pospisil, Bystedt (real TOI 12:51, ixG 0.24, iCF 6 from his two game logs). Of the 145, 30 have 10+ GP, 57 have 5–9, 58 have under 5. Same symptom elsewhere: 158 LY rows (some of these are stale rows) and 33 3YA/CA rows.
- **Root cause, confirmed:** **215 of 740 current skaters have no 20262027 row at all** in `nst_seasonal_individual_counts` or `nst_seasonal_on_ice_counts`, at any strength; 71 of them have 10+ GP (ledger C-20). Those tables hold 528 rows for 525 players, `strength='all'` only. The 145 is the part of that gap inside the 11-01 run; the 215 also covers skaters the 11-01 run did not write (finding C-20) and the 13 current skaters with no `wigo_career` row (740 vs 727). Why the rows are absent is an NST ingest question (Codex lane); I did not determine it.
- **The data exists elsewhere:** those players have NST game-log rows (Tkachuk 13, Pettersson 16), and WGO TOI is complete.
- **Verified:** production read C-05, C-11, C-20.

### C-22 — P0 — Traded players: seasonal rows are summed, so TOI and NST counts inflate and per-60s deflate
- **Where:** Writer `:260` and `:270-278` select no `team` column, but the seasonal tables' primary key is `(player_id, season, team, strength)` (`supabase/migrations/20260716112908_production_schema_baseline.sql:32023,32039`). Writer `:463-478` then adds every row.
- **Failure (Mercer, STD):** real TOI 12,916 s = 215.27 min = 15:23 per game (the sum of 14 game rows equals `totals.toi_per_game` × 14). Stored `std_atoi` = 26.16 min, so 366.27 min: **exactly 151.00 min too many**. Results:

| Stat | Page shows | Correct | Note |
|---|---|---|---|
| ATOI | 26:10 | 15:23 | 1.70× |
| PTS/60, A/60 | 0.98 | 1.67 | |
| SOG/60 | 4.91 | 8.36 | |
| iCF | 80 | 45 | 35 + 45 summed |
| ixG | 5.06 | 2.89 | 2.17 + 2.89 summed |
| IPP | 37.5% | 66.7% | 6/16 stored; 6/9 correct |
| DIFF ATOI, STD vs CA | +51.3% | −11.0% | |
| DIFF PTS/60, STD vs CA | −44.4% | −5.5% | |

- **Scope:** ATOI more than 10% high on 4 STD rows and 65 LY rows (max 1.97×); 98 3YA and 60 CA rows among rows the 11-01 run wrote. Top STD ids: 8482094, 8482110, 8481593. This grows with every trade.
- **Root cause, confirmed:** a stale pre-trade row sits beside the cumulative multi-team row, and the writer adds them. Mercer has `N.J` (10 GP, 151.00 min, iCF 35, ixG 2.17, GF 7, SF 77) and `N.J, WPG` (14 GP, 215.27 min, iCF 45, ixG 2.89, GF 9, SF 101). Their sums reproduce the stored 366.27 min, 80, 5.06 and GF 16 exactly. The cumulative row alone is correct: its 215.27 min equals WGO. Same shape for 8482094 (`MIN` + `MIN, NSH`: 363.3 vs 207.8 min) and 8481593 (`MTL` + `MTL, NSH`: 231.9 vs 195.6 min). All 3 multi-row players this season are over by 10%+; none is fine (ledger C-20). The seasonal tables were read for 20262027 only, so the LY, 3YA and CA cases are inferred to share this shape.
- **Verified:** production read C-01, C-04, C-05, C-08, C-19, C-20; code for the sum and the primary key.

### C-23 — P0 — Default Rate Stat Percentiles (AS) has no current data, and for most established players all 16 tiles show about 50
- **Where:** `nst_percentile_as_offense` and `_defense` are tables with **no writer anywhere in the repo** (grep of `web/pages`, `web/lib`, `web/utils`, `web/scripts`, `functions`, `webhooks`, `sql`, `migrations` finds only readers and a security migration). `RateStatPercentiles.tsx:212` defaults to AS. Fallback at `fetchWigoPercentiles.ts:141-146`, `:301-323`. Cohort filter at `RateStatPercentiles.tsx:281-284`. Midrank at `web/utils/calculatePercentiles.ts:50`.
- **Data:** AS has **0 rows for 20262027**. 20252026 has 633 rows with **max GP 5**, an early-season stub. 20242025 has 925 rows with max GP 119 (219 rows above 84; McDavid 97, so it appears to include playoffs). ES, PP and PK are views and are current (739, 648 and 622 rows, max GP 15).
- **Failure, McDavid (14 GP):** the requested cohort is empty, so `playerSeasonLooksStale` is true. Fallback goes to 20252026, where he has a 3-GP row. Page min GP is 10 and nobody in that cohort reaches 10, so the cohort is just him. Midrank = (0 + 0.5×1)/1 = 0.5 on every stat. **Result: 16 tiles at 50, rank 1, from a 3-game sample a year old.** A small chip says "2025–26 values and cohort". The slider max becomes 5 while min GP is 10 (`:356`).
- **Other cases:** Mercer behaves the same (3-GP row). Imama has no 20252026 AS row, and Bystedt has under 10 GP so no fallback runs; both get "No AS data". Everyone must switch to ES, PP or PK to see real values, and those values are right (see the worked table).
- **Verified:** production read C-15, C-16; code path read. **The rendered wall of 50s was not observed by me;** lane D's page load can confirm it.
- **Same cause in ratings:** see C-24.

### C-24 — P0/P1 — Ratings: "All" cells are blank, and ratings and percentiles use different seasons (continues B-12)
- **Where:** `fetchWigoRatingStats.ts:63-67`, `calculateWigoRatings.ts:110-117` (an empty cohort skips the stat), help text `WigoDashboardSections.tsx:256`.
- **Failure:** AS has no current rows, so Offense All, Defense All and Overall All show "-" for every player, while the percentile panel beside them shows 2025-26 values. Even and PP/PK ratings are correct (hand-checked below).
- **Verified:** production read C-15, C-16, C-17; code. Rendered "-" not observed.

### C-25 — P0 — L5/L10/L20 per-60s are blank for everyone who played the night before the writer ran
- **Where:** Writer `:997-999`, `:1156-1160`, `:1187-1191` (one missing game nulls the window). Client `fetchWigoPlayerStats.ts:385-395`.
- **Failure:** **313 of 313** fresh rows whose player last played 10-31 have `l5_atoi` null (C-09). Their game rows are in NST now (360 of 360 for 10-31, C-10), and those rows did not count when the writer ran at 08:51 UTC; the seasonal row was already current (McDavid `std_icf` 75 includes 10-31). So the gamelog loads after the writer. McDavid today: L5, L10, L20 ATOI, G/60, A/60, PTS/60, SOG/60, ixG, iCF, IPP, oiSH%, OZS% all "-". True L5 ATOI is 23:13, PTS/60 5.68, G/60 1.03. Since most skaters play every other night, the blank moves around the league.
- **Second cause, a hole in the source:** `nst_gamelog_as_counts` has **no rows for 10-05 (144 skaters) or 10-06 (324)**, and on-ice has none for 10-04 (180) either (C-10). Any window reaching those dates stays null, which is why L20 is null for 75 of 86 fresh 10-30 players, and for Mercer and Imama. This persists until the backfill runs (Codex lane). In October, L20 will stay blank for most of the league.
- **Note:** WGO and NST TOI agree within 60 s on **every** joined row this season (0 off, C-10). WGO could supply the denominator for ATOI and for per-60s of WGO counts, which removes both causes for those metrics. Only ixG, iCF, iHDCF, iSCF, IPP, oiSH% and OZS% actually need NST.
- **Verified:** production read C-02, C-08, C-09, C-10. Load order is inferred from data; schedule not read.

### C-26 — P1 — OZS% is blank for STD and LY for almost everyone
- **Where:** Writer `:539-542`, `:630-633`.
- **Failure:** `std_ozs_pct` is null on 727 of 727 current skaters and `ly_ozs_pct` on 929 of 940 (C-05), with L-windows populated. **Root cause, confirmed for 20262027:** `off_zone_starts` and `def_zone_starts` are null on 528 of 528 `nst_seasonal_on_ice_counts` rows (ledger C-20), so the writer's 0/0 gives null. The 2025-26 column state is inferred from the 929 of 940 nulls. 3YA and CA still show a value, built only from older seasons (McDavid 3YA 71.3%), so a comparison with STD gives no DIFF and 3YA misrepresents its window.
- **Verified:** production read C-05, C-20. The writer is right; the source column is empty (Codex lane).

### C-27 — P1 — Game Score blank on about 20% of the last five nights' rows
- **Where:** `get_skater_game_scores_for_season` drops rows when any input is null (baseline `:1342-1379`).
- **Failure:** `es_goals_for` is null on 280 rows from 10-27 to 10-31 (116, 22, 67, 21, 54), and on none before (C-10). Imama's 10-27 and 10-30 have no score. The page says "unavailable for 2 of 14" (`GameScoreLineChart/index.tsx:276`) and the 5-GM line stops for the next five games. Whether this self-heals later is unknown; the clean cutoff suggests a late-arriving WGO report. Formula itself is right (exact match, table below).

### C-28 — P1 — Radar ranks small samples and mixed positions (C-03 re-verified, with numbers)
- **Where:** `usePercentileRank.ts:52-55`.
- **Failure:** 96 of 740 rows have under 5 games and 25 have one game (C-13). Bystedt (2 games) gets a radar like anyone else: SOG 62.5, Hits 1.9. A zero-goal season ranks 17.8 from ties. Excluding under-5-game players moves a zero-goal skater only to 14.1, so the bigger issue is position pooling and small-sample tails rather than a large shift for regulars. PIM ranks higher as more (a fantasy convention; not labelled).

### C-29 — P1 — Rate percentiles and ratings pool forwards and defensemen (C-04 re-verified, with numbers)
- **Where:** `fetchWigoPercentiles.ts:13-19`, `RateStatPercentiles.tsx:281-284`.
- **Failure:** Top-scoring defenseman 8480803, ES at min GP 10: ixG/60 **25.7** vs all, **76.6** vs D; iSCF/60 **42.8** vs **95.3**; iHDCF/60 **19.1** vs **58.4**; SOG/60 73.3 vs 95.3; PTS/60 95.1 vs 99.1. The same pooling moves forwards the other way: Imama iSCF/60 36.0 vs all, 10.3 vs F; ixG/60 55.1 vs 34.1. Ratings inherit this. Production read C-17.

### C-30 — P1 — PP% in 3YA and CA is a mean of seasons (B-06 re-verified)
- **Where:** Writer `:761`, `:905`.
- **Failure:** Formula confirmed: McDavid 3YA (0.761 + 0.792 + 0.864)/3 = 80.57%, matching the stored value; GP-weighted is 80.78%, so small for a regular. But 186 of 629 rows are off by over 2 points in CA and 79 in 3YA, worst 8481604: CA shows 38.6% vs 55.3% weighted, 8482758: 43.7% vs 28.3% (C-19).

### C-31 — P1 — 3YA and CA are distorted by seasons without NST (B-05 re-verified) and counts are per-season averages (B-07 still open)
- **Where:** Writer `:705-707`, `:759`, `:849-851`, `:903`.
- **B-05:** among 629 fresh rows, 3YA ATOI is 10%+ low on 46 and 10%+ high on 98, 33 exactly zero. CA is 46 low, 60 high, 33 zero (C-19). "High" is C-22; "low" is this item. 8480021 CA ATOI 0 vs WGO 10:49, 8483752 0 vs 12:14.
- **B-07:** help (`WigoComparisonMatrix.tsx:100-109`) still explains only DIFF and L-windows. "CA Points 111" for McDavid is a per-season average, with a 45-GP rookie year, not a career total; CA excludes this season; partial seasons count fully (Imama CA GP 6.6). DIFF stays correct because it divides by GP.

### C-32 — P2 — Rating cohorts have no TOI floor (B-11 re-verified)
- **Where:** `calculateWigoRatings.ts:46-49`.
- **Failure:** at GP ≥ 10, 69 of 272 PP rows have under 20 total minutes (3 under 5), and 85 of 269 PK rows are under 20 (0 under 5). Their per-60s enter the PP and PK cohorts unfiltered. ES is unaffected. Production read C-15. I did not measure how much this moves any player's rating.

### C-33 — P2 — Radar cohort sits under, but near, the 1000-row cap (C-02 measured)
- **Where:** `usePercentileRank.ts:88-93`, `supabase/config.toml:18`.
- **Measured:** 740 rows today (C-13), so **nothing is truncated now**. A full season: 940 skaters in 2025-26 totals (C-05). My wider Oct 1–Apr 30 window gives **1002** (C-14), but it includes preseason and playoff games (max 90 games), so it overstates a regular-season window. Late season gets close; a bad year would cross it silently, with no ORDER BY. Fix before spring, not today. The RPC completed both times under `execute_sql`; that doesn't prove anon PostgREST is fast enough. I couldn't confirm the production `max_rows`.

### C-34 — P3 — Smaller items
- **Fallback GP not sanitized:** `fetchWigoPercentiles.ts:318-319` returns `fallbackStats` raw; only the requested season goes through `sanitizePercentileCohortGp`. No effect today (2025-26 max GP 5). A later fallback to a contaminated season would show it (2024-25 max GP is 119). Partial reopening of C-05.
- **NST GP undercounts:** ES GP is below canonical on 512 of 739 rows because of the 10-05/10-06 hole (McDavid unaffected, Mercer 13 of 14, Imama 12 of 14). Same for "Player GP" on the panel. Client clamps only GP that is too high.
- **`std_gp` takes `max(NST, WGO)`** at Writer `:461`, `:494`. No contamination seen in fresh target rows. The C-05 mismatch count (75) is not separated from stale rows.

## Worked examples

"Page shows" = stored value through `normalizeWigoAggregateValue` and `formatWigoStatValue`. I computed it from stored or raw rows and did not read it off a rendered page (lane D does that). Arithmetic is in the ledger's raw rows (C-01, C-02, C-04, C-08, C-12, C-13, C-17, C-18).

| Number | Player | Raw inputs | Arithmetic | Page shows | Match? |
|---|---|---|---|---|---|
| Season production, S% | McDavid | 14 GP, 37 pts, 8 G, 36 SOG; logs sum 37 pts, 36 SOG | 37/14; 8/36 | 37 (2.64/GP), 22.2% | Yes; totals = logs |
| Pace/84 | McDavid | 37 pts, 8 G, 14 GP | 2.643×84; 0.571×84 | 222; 48 | Yes. 84 games confirmed: `games` has 84 per team (C-18) |
| Pace/84 | Mercer, Bystedt | 6 pts/14; 3 SOG/2 | 0.429×84; 1.5×84 | 36; 126 | Yes. Bystedt's 126 is a two-game pace, disclosed as constant-rate |
| STD ATOI | McDavid | 14 logs sum 19,724 s | /14/60 = 23.481 | 23:29 | Yes |
| STD ATOI | **Mercer** | logs 12,916 s = 15:23 | stored 26.162 | 26:10 | **No, data (C-22)** |
| STD ATOI, ixG, iCF | **Bystedt** | logs 1,542 s, ixG 0.24, iCF 6 | stored 0, 0, 0 | 0:00, 0.0, 0 | **No, data (C-21)** |
| STD G/60 | McDavid | 8 G, 328.73 min | 8×60/328.73 | 1.46 | Yes |
| STD PPTOI, PPP/60 | McDavid | pp_toi 3238 s; 14 PPP | 3238/14; 14×3600/3238 | 3:51; 15.57 | Yes. B-10 unit fix is live |
| LY PPP/60, PPTOI | Mercer | 7 PPP, 7898 s, 82 GP | 7×3600/7898; 7898/82 | 3.19; 1:36 | Yes |
| 3YA counts | McDavid | G 32, 26, 48; P 132, 100, 138; GP 76, 67, 82 | 106/3; 370/3; 225/3 | 35, 123, 75 | Yes, per-season average |
| 3YA S%, ATOI, G/60 | McDavid | 106 G/765 SOG; TOI weighted 1329.1 s | 13.86%; 22:09; 106×60/4984.9 | 13.9%, 22:09, 1.28 | Yes |
| CA GP, Points | McDavid | 794 GP, 1220 P, 11 seasons | /11 | 72, 111 | Yes, excludes this season |
| L5 full row | Mercer | TOI 1094, 873, 967, 922, 835 = 4691; A 2; SOG 9; ixG .75; iCF 12; oiGF 3, oiSF 28; OZ 14, DZ 11; PP 470 s | 15.637; 2×3600/4691; 3/28; 14/25; 470/5; mean PP% | 15:38, A/60 1.53, ixG 0.8, iCF 12, oiSH 10.7%, OZS 56.0%, PPTOI 1:34, PP% 30.1% | Yes, all |
| L10 | Imama | iCF sum 12, OZ 9, DZ 6, SOG 7 | 12; 9/15; 7 | 12, 60.0%, 7 | Yes |
| L5 per-60s | **McDavid** | TOI sum 6966, 2 G, 11 pts (all present now) | ATOI 23:13, G/60 1.03, PTS/60 5.68 | "-" | **No, timing (C-25)** |
| L5 PP rates | McDavid | PP 1284 s, 6 PPA | 256.8; 6×3600/1284 | 4:17; 16.82 | Yes |
| DIFF STD vs CA | McDavid | Pts 37/14 vs 110.91/72.18; S% 22.22 vs 15.08 | (2.643−1.537)/1.537; (22.22−15.08)/15.08 | +72.0%, +47.4% | Yes |
| DIFF STD vs CA | **Mercer** | ATOI 26.16 vs 17.29 | +51.3% | +51.3% | Formula yes; **data no**, true −11.0% |
| Rating ES | McDavid | 8 + 7 stats, cohort 496 at GP ≥ 10 (C-17) | Weighted midranks; off Σ/100, def Σ/100 | Off 84.2, Def 69.3, Overall 76.8 | Hand values from the formula. Stored page value not available to compare |
| Rating ES | Mercer; Imama | same | off, def | 66.8, 71.5; 35.1, 68.0 | Same note. Mercer's NST per-strength row is sound, unlike STD |
| Rating AS | all four | no AS rows | skipped | "-" | **No, data (C-24)** |
| Rate percentile ES | McDavid | G/60 1.66, n 496 | midrank | 93.9 | Same formula; not compared with a rendered value |
| Rate percentile AS | **McDavid** | Own 3-GP row, cohort of 1 | 0.5/1 | 50 on all 16 | **No, data (C-23)** |
| Consistency | McDavid | Points by game | 1: 4, 2: 4, 3: 2, 4: 1, 5: 3 of 14; 0-pt 0 | 28.6, 28.6, 14.3, 7.1, 21.4% | Yes |
| Consistency | Imama | 14 games at 0 pts; hits every game | Cardio needs 0 SOG, hits and blocks | 0 Pts 100%, Cardio 0 | Yes |
| Game Score | McDavid 10-31 | G0, A1 1, SOG 3, PD 1, FO 1−2, SAT 15−9, GF 2, GA 0 | .7+.225+.15−.01+.3+.3 | 1.665 | Yes, RPC = 1.665; all 14 games match |
| Game Score | Imama 10-27, 10-30 | `es_goals_for` null | null | Gap | Formula yes; **data gap (C-27)** |
| Radar | McDavid | 14 games; G 8, A 29, PPP 14, SOG 36, PIM 2, HIT 17 | Averages ÷ 14, match RPC | G 96.0, A 99.9, SOG 90.7, HIT 58.9 | Yes. Averages are right, cohort is C-28 |
| Radar | Bystedt | 2 games | RPC numgames 2, same sums as logs | SOG 62.5, HIT 1.9 | Yes; small sample |
| Team drivers | EDM | 5v5 14 GP, xGF 25.79, xGA 30.35, GF 34; PP 16/48; PK 10 GA/39 | per GP; 34/25.79; midrank over 32 | 1.84 (23rd pct), 2.17 (45th), 131.8% (92nd), PP 33.3%, PK 74.4%, ST 63rd | Hand values; full coverage, 32 teams, all abbreviations resolve |
| Team drivers | FLA | 14 GP, 26.12, 21.22, 22; 16/66; 9/59 | same | 1.87 (27th), 1.52 (98th), 84.2% (30th), PP 24.2%, PK 84.7%, ST 77th | Same |

Not hand-computed: low-GP regression with real rows (Bystedt, GP 2 at ES and PP). Formula read and correct: `(GP×M + (10−GP)×mean)/10` (`calculateWigoRatings.ts:26-28`), but my budget doesn't cover its full cohort.

**Code confirmed correct with no finding:** DIFF (`tableUtils.ts:15-91`), percentiles and rank (`calculatePercentiles.ts`), rating weights and directions (`ratingWeights.ts`; PK weights sum to 95 and are renormalised), per-60 helpers, `normalizeWigoAggregateValue` units (ATOI minutes → seconds; PPTOI seconds; S%, PP%, IPP, oiSH%, OZS% fractions → percent), TOI units (NST game logs are seconds, confirmed by exact agreement with WGO).

## Writer changes and recompute (all **ask-first for TJ**)

No change made. These are the exact items:

1. **Make the writer finish** (C-20). Limit the loop to players with a totals row in a relevant season, or add a resumable cursor, so a 240 s run can cover every current skater. Flush partial batches on the way out.
2. **Stop summing multi-team seasonal rows** (C-22). Per season, use only the row with the highest GP, which is the cumulative `A, B` row in all 3 current cases, on both the individual and on-ice reads. This fixes the page without deleting anything, and covers stale rows left by the NST writer. Check it against LY rows before relying on it for past seasons, since I read 20262027 only.
3. **Store null, not zero, when NST is absent** (C-21). For ATOI and per-60s of WGO counts use WGO `toi_per_game`, which is complete, so those 215 skaters get real values at once. ixG, iCF, iHDCF, iSCF, IPP and oiSH% stay null until NST seasonal rows exist. Summing game logs is an option for STD (McDavid iCF 75 and ixG 6.03 vs seasonal 75 and 6.02), but it undercounts across the 10-05/10-06 hole until that is backfilled (Mercer iCF 43 vs 45).
4. **Use WGO TOI as the denominator** for ATOI and WGO-count per-60s in L-windows and STD (C-25), keeping NST only for NST-only metrics. Also a per-metric coverage rule so one missing NST row can't blank ATOI.
5. **GP-weight PP%** in 3YA and CA (C-30), and sum numerator and denominator only over seasons having both (C-31).
6. **After 1–5, TJ runs `calculate-wigo-stats`** from the browser; expect more than one pass unless item 1 lands first. Do not run it for QA.

Client, no production change: don't fall back to a cohort whose max GP is below min GP (C-23); default the panel to ES while AS is empty, or derive AS; same-season source for ratings and percentiles (C-24); F/D split (C-29); TOI floor (C-32); help text on 3YA and CA (C-31).

**For the Codex lane (NST, report only):** gamelog holes on 10-04 (on-ice), 10-05, 10-06; `nst_percentile_as_*` has no writer and no current rows; no 20262027 seasonal row for 215 of 740 current skaters; stale pre-trade seasonal rows left beside the cumulative row (3 players now); `off_zone_starts` and `def_zone_starts` null on all 528 current on-ice rows; gamelog loads after the 08:50 UTC writer. Backfills are ask-first.

## Re-verified old items

| Item | Status | Evidence |
|---|---|---|
| B-05 | **Open**, measured | C-31; C-19 |
| B-06 | **Open**, measured | C-30; C-19 |
| B-07 | **Open** | C-31; code |
| B-10 | **Fixed** for rows the 11-01 run wrote (L5 Mercer, PPTOI McDavid). The 33 September rows may still hold old units; not checked | C-01, C-02, C-08 |
| B-11 | **Open**, measured | C-32; C-15 |
| B-12 | **Open, worse** | C-24; C-16 |
| B-13 | **Open** in code, lower risk: 58 sampled rows all `gp` = 1, TOI agrees everywhere. New issue is missing dates | C-08, C-10 |
| B-20 | **Open** in `StatsTable.tsx:283-288` (green for up) with no disclosure. Matrix also colours up as green, but its help says up isn't necessarily better | code |
| B-21 | Matrix **fixed**. `StatsTable.tsx:289-291` still prints "+0.0%" in green for 0.04 | code |
| B-22 | **Fixed** (`TimeframeComparison.tsx:9`) | code |
| B-23 | **Fixed** at one-page (`PlayerRatingsDisplay.module.scss:156` overrides the inline 3 px). Inline style remains | code |
| B-24 | **Open**: first paint depends on `viewportWidth` (`wigoCharts.tsx:37,50`). Lane A owns it | code, not run |
| B-25 | **Disclosed**. Effect is larger than thought: see C-25 | code |
| C-01 | **Disclosed**, model unchanged | `GameScoreSection.tsx:18` |
| C-02 | **Not truncating today**; latent | C-33 |
| C-03 | **Open**, measured | C-28 |
| C-04 | **Open**, measured | C-29 |
| C-05 | **Fixed** for the requested season; fallback path unsanitized | C-34 |
| C-12 | **Open** `CategoryCoverageChart.tsx:124` hides a 0.0 label in non-compact mode | code |
| C-14 | Not re-checked here; display only | lane A/D |
| C-15, C-16 | Not re-checked here; display only | lane A/D |

## Not checked

- **Seasonal tables for past seasons:** TJ approved one read scoped to 20262027 (ledger C-20). The STD causes of C-21, C-22 and C-26 are confirmed from rows. The LY, 3YA and CA cases, and the "low" half of C-31, are still proven by effect only. Why 215 skaters have no seasonal row was not determined.
- **Rendered values:** nothing here was read off a live page. Lane D can confirm C-23, C-24 and C-25.
- **Cron schedule and logs:** not read (lane B). Timeout and load-order causes are inferred.
- Production `max_rows`; radar latency through anon PostgREST; IPP, oiSH% and OZS% scale in NST game logs (the selected-stat chart); low-GP regression on real rows; stale-row units (September).
- Budget: 20 of 20 queries used, including one failed (C-03). Two RPC runs, both complete.
