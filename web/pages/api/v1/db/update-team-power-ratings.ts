import type { NextApiRequest, NextApiResponse } from "next";
import supabase from "lib/supabase/server";
import { fetchCurrentSeason } from "../../../../utils/fetchCurrentSeason";
import {
  fetchGameLogs,
  calculateEwma,
  calculateLeagueMetrics,
  calculateZScores,
  calculateRawScores,
  calculateRawDistribution,
  calculateFinalRating,
  fetchWgoStats,
  fetchAllRatings,
  LOOKBACK_GAMES,
  TeamGame,
  EwmaMetrics,
  LeagueMetrics,
  ZScored,
  RawScore,
  RawDistribution,
  FinalRating
} from "../../../../lib/power-ratings";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST" && req.method !== "GET") {
    res.setHeader("Allow", ["POST", "GET"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const targetDateParam =
    (req.method === "GET" ? (req.query.date as string) : req.body?.date) ||
    new Date().toISOString().slice(0, 10);

  try {
    // Check if table is empty to decide if we need to backfill
    const { count } = await supabase
      .from("team_power_ratings_daily")
      .select("*", { count: "exact", head: true });

    let startDateStr = targetDateParam;
    if (count === 0) {
      console.log("Table is empty. Fetching season start date...");
      const season = await fetchCurrentSeason();
      startDateStr = season.startDate;
      console.log(`Backfilling from season start: ${startDateStr}`);
    }

    const startDate = new Date(startDateStr);
    const endDate = new Date(targetDateParam);
    let processedCount = 0;
    let totalUpserts = 0;

    // Loop through each day from startDate to endDate
    for (
      let d = new Date(startDate);
      d <= endDate;
      d.setDate(d.getDate() + 1)
    ) {
      const targetDate = d.toISOString().slice(0, 10);
      console.log(`Processing ${targetDate}...`);

      // We need a lookback period for fetching logs.
      // 25 games is roughly 60 days. Let's fetch 90 days to be safe.
      const logEndDate = targetDate;
      const logStartDateObj = new Date(logEndDate);
      logStartDateObj.setDate(logStartDateObj.getDate() - 90);
      const logStartDate = logStartDateObj.toISOString().slice(0, 10);

      const logs = await fetchGameLogs(supabase, logStartDate, logEndDate);

      // Group by team
      const teamLogs = new Map<string, TeamGame[]>();
      logs.forEach((log) => {
        if (!teamLogs.has(log.team_abbreviation)) {
          teamLogs.set(log.team_abbreviation, []);
        }
      });

      // Sort and assign rn_desc
      for (const [team, teamGames] of teamLogs) {
        // Add all logs for this team
        const teamRawLogs = logs.filter((l) => l.team_abbreviation === team);
        teamRawLogs.sort((a, b) => b.date.localeCompare(a.date)); // DESC

        const processed: TeamGame[] = teamRawLogs.map((l, index) => ({
          ...l,
          rn_desc: index, // 0 is most recent
          gp_to_date: teamRawLogs.length - index // 1 is first game
        }));

        teamLogs.set(team, processed);
      }

      // Calculate EWMA for targetDate
      const ewmaMetrics: EwmaMetrics[] = [];
      for (const [team, games] of teamLogs) {
        const ewma = calculateEwma(games, targetDate);
        if (ewma) {
          ewmaMetrics.push(ewma);
        }
      }

      let finalRatings: FinalRating[] = [];

      if (ewmaMetrics.length > 0) {
        // Calculate League Metrics
        const leagueMetrics = calculateLeagueMetrics(ewmaMetrics);

        // Calculate Z-Scores
        const zScores: ZScored[] = ewmaMetrics.map((m) =>
          calculateZScores(m, leagueMetrics)
        );

        // Calculate Raw Scores
        const rawScores: RawScore[] = zScores.map((z) => calculateRawScores(z));

        // Calculate Raw Distribution
        const rawDist = calculateRawDistribution(rawScores);

        // Calculate Final Ratings
        finalRatings = rawScores.map((s) => calculateFinalRating(s, rawDist));
      } else {
        console.log(`No games found for ${targetDate}.`);
      }

      // Fetch latest ratings for ALL teams from DB (before today)
      const trendStartDate = new Date(targetDate);
      trendStartDate.setDate(trendStartDate.getDate() - 60);

      const latestRatings = await fetchAllRatings(
        supabase,
        "team_power_ratings_daily",
        targetDate,
        trendStartDate.toISOString().slice(0, 10)
      );

      // Map of team -> latest rating
      const latestMap = new Map<string, any>();
      // Map of team -> last 10 ratings (for trend)
      const historyMap = new Map<string, number[]>();

      latestRatings?.forEach((r) => {
        if (r.team_abbreviation) {
          if (!latestMap.has(r.team_abbreviation)) {
            latestMap.set(r.team_abbreviation, r);
          }

          if (!historyMap.has(r.team_abbreviation)) {
            historyMap.set(r.team_abbreviation, []);
          }
          const hist = historyMap.get(r.team_abbreviation)!;
          if (hist.length < 10) {
            hist.push(Number(r.off_rating));
          }
        }
      });

      // Fetch WGO stats for tiers
      const wgoStats = await fetchWgoStats(supabase, logStartDate, targetDate);
      // Group by team, sort by date desc
      const wgoMap = new Map<string, any>();
      wgoStats.forEach((s) => {
        if (
          !wgoMap.has(s.team_abbreviation) ||
          s.date > wgoMap.get(s.team_abbreviation).date
        ) {
          wgoMap.set(s.team_abbreviation, s);
        }
      });

      // Calculate Percentiles for Tiers
      const ppValues: number[] = [];
      const pkValues: number[] = [];

      const allTeams = new Set<string>([
        ...Array.from(teamLogs.keys()),
        ...Array.from(latestMap.keys())
      ]);

      for (const team of allTeams) {
        const wgo = wgoMap.get(team);
        if (wgo && wgo.power_play_pct != null)
          ppValues.push(wgo.power_play_pct);
        if (wgo && wgo.penalty_kill_pct != null)
          pkValues.push(wgo.penalty_kill_pct);
      }

      ppValues.sort((a, b) => a - b);
      pkValues.sort((a, b) => a - b);

      const getPercentile = (values: number[], p: number) => {
        if (values.length === 0) return 0;
        const index = Math.floor(values.length * p);
        return values[Math.min(index, values.length - 1)];
      };

      const pp33 = getPercentile(ppValues, 0.33);
      const pp67 = getPercentile(ppValues, 0.67);
      const pk33 = getPercentile(pkValues, 0.33);
      const pk67 = getPercentile(pkValues, 0.67);

      const getTier = (
        val: number | null | undefined,
        p33: number,
        p67: number
      ) => {
        if (val == null) return 3;
        if (val >= p67) return 1;
        if (val >= p33) return 2;
        return 3;
      };

      const upserts: any[] = [];
      for (const team of allTeams) {
        const calculated = finalRatings.find(
          (r) => r.team_abbreviation === team
        );

        // Calculate Trend
        const hist = historyMap.get(team) || [];
        const avgLast10 =
          hist.length > 0 ? hist.reduce((a, b) => a + b, 0) / hist.length : 0;

        // Tiers
        const wgo = wgoMap.get(team);
        const ppTier = getTier(wgo?.power_play_pct, pp33, pp67);
        const pkTier = getTier(wgo?.penalty_kill_pct, pk33, pk67);

        if (calculated) {
          upserts.push({
            ...calculated,
            trend10: Number((calculated.off_rating - avgLast10).toFixed(2)),
            pp_tier: ppTier,
            pk_tier: pkTier
          });
        } else {
          const latest = latestMap.get(team);
          if (latest) {
            upserts.push({
              team_abbreviation: team,
              date: targetDate,
              off_rating: latest.off_rating,
              def_rating: latest.def_rating,
              pace_rating: latest.pace_rating,
              xgf60: latest.xgf60,
              gf60: latest.gf60,
              sf60: latest.sf60,
              xga60: latest.xga60,
              ga60: latest.ga60,
              sa60: latest.sa60,
              pace60: latest.pace60,
              finishing_rating: latest.finishing_rating,
              goalie_rating: latest.goalie_rating,
              danger_rating: latest.danger_rating,
              special_rating: latest.special_rating,
              discipline_rating: latest.discipline_rating,
              variance_flag: latest.variance_flag,
              trend10: Number((latest.off_rating - avgLast10).toFixed(2)),
              pp_tier: ppTier,
              pk_tier: pkTier
            });
          }
        }
      }

      // Upsert
      if (upserts.length > 0) {
        const { error } = await supabase
          .from("team_power_ratings_daily" as any)
          .upsert(upserts, { onConflict: "team_abbreviation, date" });

        if (error) throw error;
        totalUpserts += upserts.length;
      }
      processedCount++;
    }

    return res.status(200).json({
      message: "Updated ratings",
      startDate: startDateStr,
      endDate: targetDateParam,
      processedDays: processedCount,
      totalUpserts
    });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
