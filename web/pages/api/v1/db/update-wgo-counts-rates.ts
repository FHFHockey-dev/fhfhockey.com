////////// CA, 3YA, LY, L5, L10, L20 and STD for each of:
// - Average Time on Ice (ATOI)
// - Power Play Time on Ice (PPTOI)
// - Power Play Percentage (PP%)
// - Goals (G)
// - Assists (A)
// - Points (PTs)
// - Primary Points Percentage (PTs1%)
// - Shots on Goal (SOG)
// - Shooting Percentage (S%)
// - Individual Expected Goals (ixG)
// - Individual Points Percentage (IPP)
// - On Ice Shooting Percentage (oiSH%)
// - Offensive Zone Start Percentage (OZs%)
// - Individual Corsi For (iCF)
// - Power Play Goals (PPG)
// - Power Play Assists (PPA)
// - Power Play Points (PPP)
// - Hits (HIT)
// - Blocks (BLK)
// - Penalty Minutes (PIM)

////////// Per 60 Minute Stats:
// - Goals Per 60 (G/60)
// - Assists Per 60 (A/60)
// - Points Per 60 (PTs/60)
// - Primary Points Per 60 (PTs1/60)
// - Shots on Goal Per 60 (SOG/60)
// - Individual Expected Goals per 60 (ixG/60)
// - Individual Corsi For Per 60 (iCF/60)
// - Power Play Goals Per 60 (PPG/60)
// - Power Play Assists Per 60 (PPA/60)
// - Power Play Points Per 60 (PPP/60)
// - Hits Per 60 (HIT/60)
// - Blocks Per 60 (BLK/60)
// - Penalty Minutes Per 60 (PIM/60)

// GP (Games Played)
// CA: wgo_career_averages (via supabaseLabelMap['GP'])
// 3YA: wgo_three_year_averages (via supabaseLabelMap['GP'])
// LY: wgo_skater_stats_totals (previous) (games_played column) OR API (YearlyCounts) (GP field) - Override applied
// L5: Calculation (WGO Current) (Min(5, games count))
// L10: Calculation (WGO Current) (Min(10, games count))
// L20: Calculation (WGO Current) (Min(20, games count))
// STD: Calculation (WGO Current) (Total games count)

// G (Goals)
// CA: wgo_career_averages (via supabaseLabelMap['G'])
// 3YA: wgo_three_year_averages (via supabaseLabelMap['G'])
// LY: wgo_skater_stats_totals (previous) (goals column) - Override applied
// L5: wgo_skater_stats (current) (Sum over last 5)
// L10: wgo_skater_stats (current) (Sum over last 10)
// L20: wgo_skater_stats (current) (Sum over last 20)
// STD: wgo_skater_stats (current) (Sum over season)

// A (Assists)
// CA: wgo_career_averages (via supabaseLabelMap['A'])
// 3YA: wgo_three_year_averages (via supabaseLabelMap['A'])
// LY: wgo_skater_stats_totals (previous) (assists column) - Override applied
// L5: wgo_skater_stats (current) (Sum over last 5)
// L10: wgo_skater_stats (current) (Sum over last 10)
// L20: wgo_skater_stats (current) (Sum over last 20)
// STD: wgo_skater_stats (current) (Sum over season)

// SOG (Shots On Goal)
// CA: wgo_career_averages (via supabaseLabelMap['SOG'])
// 3YA: wgo_three_year_averages (via supabaseLabelMap['SOG'])
// LY: wgo_skater_stats_totals (previous) (shots column) - Override applied
// L5: wgo_skater_stats (current) (Sum over last 5)
// L10: wgo_skater_stats (current) (Sum over last 10)
// L20: wgo_skater_stats (current) (Sum over last 20)
// STD: wgo_skater_stats (current) (Sum over season)

// ixG (Individual Expected Goals)
// CA: API (3YA/Career) (careerAverageCounts['ixG'])
// 3YA: API (3YA/Career) (threeYearCountsAverages['ixG'])
// LY: API (YearlyCounts) (ixG field) - Override applied
// L5: nst_gamelog_as_counts (current) (Sum over last 5)
// L10: nst_gamelog_as_counts (current) (Sum over last 10)
// L20: nst_gamelog_as_counts (current) (Sum over last 20)
// STD: nst_gamelog_as_counts (current) (Sum over season)

// PPG (Power Play Goals)
// CA: wgo_career_averages (via supabaseLabelMap['PPG'])
// 3YA: wgo_three_year_averages (via supabaseLabelMap['PPG'])
// LY: wgo_skater_stats_totals (previous) (pp_goals column) - Override applied
// L5: wgo_skater_stats (current) (Sum over last 5)
// L10: wgo_skater_stats (current) (Sum over last 10)
// L20: wgo_skater_stats (current) (Sum over last 20)
// STD: wgo_skater_stats (current) (Sum over season)

// PPA (Power Play Assists)
// CA: wgo_career_averages (via supabaseLabelMap['PPA'])
// 3YA: wgo_three_year_averages (via supabaseLabelMap['PPA'])
// LY: wgo_skater_stats_totals (previous) (pp_assists column) - Override applied
// L5: wgo_skater_stats (current) (Sum over last 5)
// L10: wgo_skater_stats (current) (Sum over last 10)
// L20: wgo_skater_stats (current) (Sum over last 20)
// STD: wgo_skater_stats (current) (Sum over season)

// PPP (Power Play Points - Derived)
// CA: wgo_career_averages (via supabaseLabelMap['PPP'])
// 3YA: wgo_three_year_averages (via supabaseLabelMap['PPP'])
// LY: wgo_skater_stats_totals (previous) (pp_points column) - Override applied
// L5: wgo_skater_stats (current) (Derived sum over last 5)
// L10: wgo_skater_stats (current) (Derived sum over last 10)
// L20: wgo_skater_stats (current) (Derived sum over last 20)
// STD: wgo_skater_stats (current) (Derived sum over season)

// HIT (Hits)
// CA: wgo_career_averages (via supabaseLabelMap['HIT'])
// 3YA: wgo_three_year_averages (via supabaseLabelMap['HIT'])
// LY: wgo_skater_stats_totals (previous) (hits column) - Override applied
// L5: wgo_skater_stats (current) (Sum over last 5)
// L10: wgo_skater_stats (current) (Sum over last 10)
// L20: wgo_skater_stats (current) (Sum over last 20)
// STD: wgo_skater_stats (current) (Sum over season)

// BLK (Blocked Shots)
// CA: wgo_career_averages (via supabaseLabelMap['BLK'])
// 3YA: wgo_three_year_averages (via supabaseLabelMap['BLK'])
// LY: wgo_skater_stats_totals (previous) (blocked_shots column) - Override applied
// L5: wgo_skater_stats (current) (Sum over last 5)
// L10: wgo_skater_stats (current) (Sum over last 10)
// L20: wgo_skater_stats (current) (Sum over last 20)
// STD: wgo_skater_stats (current) (Sum over season)

// PIM (Penalty Minutes)
// CA: wgo_career_averages (via supabaseLabelMap['PIM'])
// 3YA: wgo_three_year_averages (via supabaseLabelMap['PIM'])
// LY: wgo_skater_stats_totals (previous) (penalty_minutes column) - Override applied
// L5: wgo_skater_stats (current) (Sum over last 5)
// L10: wgo_skater_stats (current) (Sum over last 10)
// L20: wgo_skater_stats (current) (Sum over last 20)
// STD: wgo_skater_stats (current) (Sum over season)

// ATOI (Average Time On Ice)
// CA: wgo_career_averages (via supabaseLabelMap['ATOI'])
// 3YA: wgo_three_year_averages (via supabaseLabelMap['ATOI'])
// LY: Calculation (WGO Previous) (Average TOI)
// L5: Calculation (WGO Current) (Average TOI over last 5)
// L10: Calculation (WGO Current) (Average TOI over last 10)
// L20: Calculation (WGO Current) (Average TOI over last 20)
// STD: Calculation (WGO Current) (Average TOI over season)

// PPTOI (Average Power Play Time On Ice)
// CA: wgo_career_averages (via supabaseLabelMap['PPTOI'])
// 3YA: wgo_three_year_averages (via supabaseLabelMap['PPTOI'])
// LY: Calculation (WGO Previous) (Average PP TOI)
// L5: Calculation (WGO Current) (Average PP TOI over last 5)
// L10: Calculation (WGO Current) (Average PP TOI over last 10)
// L20: Calculation (WGO Current) (Average PP TOI over last 20)
// STD: Calculation (WGO Current) (Average PP TOI over season)

// PP% (Power Play TOI Percentage)
// CA: wgo_career_averages (via supabaseLabelMap['PP%'], value * 100)
// 3YA: wgo_three_year_averages (via supabaseLabelMap['PP%'], value * 100)
// LY: Calculation (WGO Previous) (Average PP TOI %)
// L5: Calculation (WGO Current) (Average PP TOI % over last 5)
// L10: Calculation (WGO Current) (Average PP TOI % over last 10)
// L20: Calculation (WGO Current) (Average PP TOI % over last 20)
// STD: Calculation (WGO Current) (Average PP TOI % over season)

// G/60, SOG/60, HIT/60, BLK/60, PIM/60
// CA: API (3YA/Career) (careerAverageRates[label])
// 3YA: API (3YA/Career) (threeYearRatesAverages[label])
// LY: API (YearlyRates) (previousSeasonRatesObj[label]) - Override applied
// L5: wgo_skater_stats (current) (Calculated Rate over last 5)
// L10: wgo_skater_stats (current) (Calculated Rate over last 10)
// L20: wgo_skater_stats (current) (Calculated Rate over last 20)
// STD: wgo_skater_stats (current) (Calculated Rate over season)

// A/60
// CA: API (3YA/Career) (Sum of careerAverageRates['A1/60'] + ['A2/60'])
// 3YA: API (3YA/Career) (Sum of threeYearRatesAverages['A1/60'] + ['A2/60'])
// LY: API (YearlyRates) (previousSeasonRatesObj['A/60']) - Override applied
// L5: wgo_skater_stats (current) (Calculated Rate over last 5)
// L10: wgo_skater_stats (current) (Calculated Rate over last 10)
// L20: wgo_skater_stats (current) (Calculated Rate over last 20)
// STD: wgo_skater_stats (current) (Calculated Rate over season)

// ixG/60
// CA: API (3YA/Career) (careerAverageRates['ixG/60'])
// 3YA: API (3YA/Career) (threeYearRatesAverages['ixG/60'])
// LY: API (YearlyRates) (previousSeasonRatesObj['ixG/60']) - Override applied
// L5: Calculation (WGO+NST Current) (Rate over last 5)
// L10: Calculation (WGO+NST Current) (Rate over last 10)
// L20: Calculation (WGO+NST Current) (Rate over last 20)
// STD: Calculation (WGO+NST Current) (Rate over season)

// PPG/60, PPA/60
// CA: wgo_career_averages (Sum of relevant fields via rateCA3YAMap)
// 3YA: wgo_three_year_averages (Sum of relevant fields via rateCA3YAMap)
// LY: API (YearlyRates) (previousSeasonRatesObj[label]) - Override applied
// L5: wgo_skater_stats (current) (Calculated PP Rate over last 5)
// L10: wgo_skater_stats (current) (Calculated PP Rate over last 10)
// L20: wgo_skater_stats (current) (Calculated PP Rate over last 20)
// STD: wgo_skater_stats (current) (Calculated PP Rate over season)

// PPP/60 (Derived)
// CA: wgo_career_averages (Sum of relevant fields via rateCA3YAMap)
// 3YA: wgo_three_year_averages (Sum of relevant fields via rateCA3YAMap)
// LY: API (YearlyRates) (previousSeasonRatesObj['PPP/60']) - Override applied
// L5: wgo_skater_stats (current) (Calculated Derived PP Rate over last 5)
// L10: wgo_skater_stats (current) (Calculated Derived PP Rate over last 10)
// L20: wgo_skater_stats (current) (Calculated Derived PP Rate over last 20)
// STD: wgo_skater_stats (current) (Calculated Derived PP Rate over season)
