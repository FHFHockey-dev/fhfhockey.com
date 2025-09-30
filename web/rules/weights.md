# Legend:
	•	HI = high importance (core luck/skill levers)
	•	MED = medium importance (good stabilizers/context)
	•	LOW = low importance (texture/QA)
	•	NONE = exclude for this barometer (not useful for regression-to-mean of finishing)

##
```
1) Individual production (all strengths unless noted)
	•	Goals — goals (stats, totals) — LOW (useful for bands, but raw counts confound TOI)
	•	Assists — assists (stats, totals) — LOW
	•	Points — points (stats, totals) — LOW
	•	Shots — shots (stats, totals) — MED (volume stabilizer)
	•	Shooting% (all) — shooting_percentage (stats), recomputed in totals — HI
	•	Missed shots — missed_shots (stats), sum in totals — LOW
	•	GWG — gw_goals (stats, totals) — NONE
	•	Plus/Minus — plus_minus (stats, totals) — NONE

5v5 (ES) individual rates
	•	Goals/60 (5v5) — goals_per_60_5v5 (stats), totals recompute — HI (for finishing-vs-xG residual)
	•	Assists/60 (5v5) — assists_per_60_5v5 (stats), totals recompute — LOW
	•	Points/60 (5v5) — points_per_60_5v5 (stats), totals recompute — MED (context for form)
	•	Goals 5v5 (count) — goals_5v5 (stats, totals) — LOW
	•	Assists 5v5 (count) — assists_5v5 (stats, totals) — LOW
	•	Points 5v5 (count) — points_5v5 (stats, totals) — LOW
	•	Primary/Secondary assists 5v5 (counts & /60) — primary_assists_5v5, secondary_assists_5v5, primary_assists_per_60_5v5, secondary_assists_per_60_5v5 (stats; totals recompute some) — LOW

Power Play (PP) individual
	•	PP Goals/60 — pp_goals_per_60 (stats, totals) — MED (compare to baseline for “PP finishing over baseline”)
	•	PP Points/60 — pp_points_per_60 (stats, totals) — MED
	•	PP Goals (count) — pp_goals (stats, totals) — LOW
	•	PP Assists / Primary / Secondary (/60) — pp_assists, pp_primary_assists, pp_secondary_assists, pp_primary_assists_per_60, pp_secondary_assists_per_60 (stats, totals) — LOW
	•	PP Shots (count & /60) — pp_shots, pp_shots_per_60 (stats, totals) — MED (volume context)
	•	PP Shooting% — pp_shooting_percentage (stats, totals) — HI
	•	PP Individual SAT For (/60) — pp_individual_sat_for, pp_individual_sat_per_60 (stats, totals) — LOW–MED (volume-ish)
	•	PP TOI (sec) & % of team — pp_toi, pp_toi_pct_per_game (stats), totals adds pp_toi_pct_of_team — LOW (context for role)
	•	PP Goals For/Against & GF/60 — pp_goals_for, pp_goals_against, pp_goals_for_per_60 (stats, totals) — LOW (on-ice team context on PP)

Short-handed (SH/PK) individual
	•	SH Goals/Assists (counts & /60) — sh_goals, sh_assists, sh_primary_assists, sh_secondary_assists, and /60 variants (stats, totals) — NONE for finishing sustainability of skaters
	•	SH Shots & SH Shooting% — sh_shots, sh_shooting_percentage (stats, totals) — NONE (rare/role-driven)
	•	SH TOI — sh_time_on_ice (stats, totals) — NONE

Per-60 (all-strengths) via NST (individual)
	•	Goals/60 — nst_goals_per_60 (stats rates, totals proxy) — LOW
	•	Assists/60 / First/Second Assists/60 — nst_assists_per_60, nst_first_assists_per_60, nst_second_assists_per_60 — LOW
	•	Points/60 — nst_points_per_60 — MED (context)
	•	Shots/60 — nst_shots_per_60 — MED (volume stabilizer)
	•	ixG (/60 & level) — nst_ixg_per_60, nst_ixg — HI (best stabilizer)
	•	ICF (/60 & level) — nst_icf_per_60, nst_icf — MED
	•	IFF (/60 & level) — nst_iff_per_60, nst_iff — LOW
	•	ISCFS (/60 & level) — nst_iscfs_per_60, nst_iscfs — LOW
	•	HDCF (/60 & level) — nst_hdcf_per_60, nst_hdcf — MED
	•	Rush attempts (/60 & level) — nst_rush_attempts_per_60, nst_rush_attempts — LOW
	•	Rebounds created (/60 & level) — nst_rebounds_created_per_60, nst_rebounds_created — LOW
	•	PIM/60, Penalties drawn (/60) — nst_pim_per_60, nst_penalties_drawn_per_60, plus totals’ penalty_minutes, penalties_drawn — NONE
	•	Giveaways/60, Takeaways/60 — nst_giveaways_per_60, nst_takeaways_per_60, plus totals’ giveaways, takeaways — NONE (role/score effects)
	•	Hits/60, Shots blocked/60, Hits taken/60 — nst_hits_per_60, nst_shots_blocked_per_60, nst_hits_taken_per_60, plus totals’ counts — NONE

Time on Ice
	•	NST TOI (all) — nst_toi (stats, totals) — MED (denominator for per-60)
	•	TOI (all), ES TOI, 5v5 TOI proxy — toi_per_game, es_toi_per_game, ev_time_on_ice, toi_per_game_5v5 (stats, totals) — MED (denominators/context)
	•	Shifts & TOI/shift — shifts, time_on_ice_per_shift (stats, totals) — LOW

⸻

2) On-ice (5v5) team context — counts, shares, rates (NST)

Counts (5v5)
	•	CF, CA, FF, FA, SF, SA — nst_oi_cf, nst_oi_ca, nst_oi_ff, nst_oi_fa, nst_oi_sf, nst_oi_sa (stats, totals) — LOW (use shares or per-60)
	•	GF, GA — nst_oi_gf, nst_oi_ga — MED (for oiSH%, IPP denom)
	•	xGF, xGA — nst_oi_xgf, nst_oi_xga — MED (quality context)
	•	SCF, SCA; HDCF, HDCA; MD/LDCF, MD/L DCA; HDGF, HDGA; MD/LDGF, MD/LDGA — nst_oi_* family — LOW–MED (use share %)
	•	Zone starts (O/N/D) — nst_oi_off_zone_starts, nst_oi_neu_zone_starts, nst_oi_def_zone_starts — LOW

Shares / Percentages (recomputed in totals)
	•	CF% / FF% / SF% / GF% — nst_oi_cf_pct, nst_oi_ff_pct, nst_oi_sf_pct, nst_oi_gf_pct — MED (CF% lower than xGF%)
	•	xGF% — nst_oi_xgf_pct — MED (best of the shares)
	•	SCF% / HDCF% / HDGF% / MDCF% / MDGF% / LDCF% / LDGF% — corresponding % fields — LOW–MED
	•	On-ice Shooting% (5v5) — nst_oi_shooting_pct — HI
	•	On-ice Save% (5v5) — nst_oi_save_pct — HI (as PDO part)
	•	PDO (5v5) — nst_oi_pdo — HI
	•	Off-zone start % — nst_oi_off_zone_start_pct — LOW

Per-60 on-ice rates (5v5) — from *_rates_oi in stats, full recompute in totals
	•	CF/60, CA/60, FF/60, FA/60, SF/60, SA/60, GF/60, GA/60 — nst_oi_*_per_60 — LOW
	•	xGF/60, xGA/60, SCF/60, SCA/60, HDCF/60, HDCA/60, HDGF/60, HDGA/60, … — nst_oi_*_per_60 — LOW–MED (context)
	•	CF%/FF%/SF%/GF%/xGF%/SCF%/HDCF%/HDGF% … (rates variants) — *_pct_rates — LOW (duplicates of shares above)
	•	On-ice SH% (rates), SV% (rates), PDO (rates) — nst_oi_sh_pct_rates, nst_oi_sv_pct_rates, nst_oi_pdo_rates — LOW (redundant with all-situations share fields)
	•	Zone starts per 60; OZ start % (rates) — nst_oi_*starts_per_60, nst_oi_off_zone_start_pct_rates — LOW

⸻

3) Finishing vs shot quality residuals (derived)
	•	Level residual — goals − nst_ixg (derive from stats/totals) — HI
	•	Rate residual (5v5) — goals_per_60_5v5 − nst_ixg_per_60 — HI (until you add 5v5 ixG/60 later)

⸻

4) “Luck” composites and parts
	•	IPP (all-sits, NST) — nst_ipp (stats) — HI (use with care on small n; EB later)
	•	On-ice SH% (all-sits, WGO) — on_ice_shooting_pct (stats) — HI (alt source to NST)
	•	On-ice SH% (5v5, WGO) — on_ice_shooting_pct_5v5 (stats) — HI
	•	Skater Save% 5v5 (WGO) — skater_save_pct_5v5 (stats) — MED (contextual PDO part; NST one preferred)
	•	Skater SH%+SV% 5v5 (WGO “PDO”) — skater_shooting_plus_save_pct_5v5 — MED (redundant if using NST PDO)

⸻

5) Role/usage & other derived fields
	•	Team PP TOI estimate (helper) — team_pp_toi_est (totals) — NONE
	•	PP TOI % of team — pp_toi_pct_of_team (totals) — LOW (role)
	•	ES GF% — es_goals_for_percentage (stats) — LOW (coarse team form)
	•	Goals% (share of points that are goals) — goals_pct (stats; totals recompute too) — NONE
	•	Zone start % (WGO proxies) — zone_start_pct, zone_start_pct_5v5 (stats; totals proxy) — LOW
	•	Individual shots-for per 60 (WGO) — individual_shots_for_per_60 (stats) — MED
	•	Individual SAT for per 60 (WGO) — individual_sat_for_per_60 (stats) — LOW–MED
	•	Proxy ratio (shots / ICF) — individual_shots_for_per_60_proxy_ratio (totals) — LOW

⸻

6) Faceoffs
	•	Total faceoffs, FOW, FOL, FO% — total_faceoffs, total_fow, total_fol, fow_percentage (stats/totals) — NONE
	•	DZ/NZ/OZ faceoffs & FO% — d_zone_faceoffs, n_zone_faceoffs, o_zone_faceoffs, with % fields and helpers in totals — NONE
	•	EV faceoffs & FO% — ev_faceoffs, ev_faceoff_percentage — NONE
	•	Faceoff % at 5v5 — faceoff_pct_5v5 — NONE
	•	NST FO won/lost (/60) — nst_faceoffs_won, nst_faceoffs_lost, /60 variants — NONE

⸻

7) Defensive & physical peripherals
	•	Hits, Blocks — hits, blocked_shots (stats/totals), /60 variants — NONE
	•	Takeaways, Giveaways — takeaways, giveaways (stats/totals), /60 variants — NONE
	•	Hits taken — nst_hits_taken, /60 — NONE
	•	Penalties, Penalties drawn — penalties, penalties_drawn, NST /60 — NONE
	•	PIM — penalty_minutes, NST pim_per_60 — NONE

⸻

8) Small safety/flag fields (not model inputs)
	•	shots_safe, shooting_pct_safe, possession_pct_safe (stats; totals also aggregate) — NONE (use for data quality only)
	•	has_nst_counts / has_nst_counts_oi / has_nst_rates / has_nst_rates_oi — NONE (flags)
	•	materialized_at — NONE

⸻

Quick priority recap (what to actually weight)

HI (core):
	•	Shooting% (all, 5v5, PP)
	•	On-ice SH% (NST, 5v5 preferred; WGO variants OK)
	•	On-ice SV% (NST, 5v5) and PDO (NST, 5v5)
	•	IPP (NST)
	•	Finishing residuals: goals − ixG, goals/60 (5v5) − ixG/60
	•	ixG/60 (NST)

MED (stabilizers/context):
	•	Shots (raw), Shots/60 (NST), Individual shots-for/60 (WGO)
	•	ICF(/60), HDCF(/60) (NST)
	•	xGF% (on-ice), CF%/SCF% (on-ice)
	•	Points/60 (5v5)
	•	PP G/60, PP P/60 vs your player baseline
	•	TOI (NST/all) as denominators & role context
	•	On-ice GF/GA counts as IPP/oiSH% denominators

LOW (keep for QA/visuals, tiny or zero weight):
	•	IFF(/60), ISCFS(/60), detailed on-ice per-60 families, zone starts, rush attempts, rebounds created, WGO SAT variants, goals/assists raw, shift metrics, proxies

NONE (exclude from V1 scoring):
	•	Faceoffs, hits/blocks/PIM/drawn, takeaways/giveaways, plus/minus, GWG, SH (PK) scoring/shooting, most role-only PP/PK usage metrics, data quality flags

⸻

Sanity pass for completeness
	•	Covered all WGO columns present in player_stats_unified that are metrics (incl. 5v5 splits, PP/SH, SAT, on-ice SH%, 5v5 skater SV/PDO proxy, FO, usage).
	•	Covered all NST individual metrics (counts and /60).
	•	Covered all NST on-ice (5v5) metrics: counts, share %, /60, %_rates variants, zone starts and their per-60 & % variants.
	•	Covered all recomputed/derived fields in player_totals_unified (per-60 recomputes, share % recomputes, PDO, PP team % estimate, proxy ratios).
	•	Marked flags/safety fields as NONE.
	•	Included residuals you intend to derive (not stored) since they are central to “sustainability”.
```