// /lib/supabase/Upserts/fetchWGOdata.js

import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";
import { parseISO, format, addDays, isBefore, isValid } from "date-fns";
import ProgressBar from "progress";

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);
if (!supabaseUrl || !supabaseKey) {
  console.warn(
    "[fetchWGOdata] Supabase URL or Service Role Key is missing. Upserts will likely fail."
  );
}

/**
 * QUERY PARAMETERS:
 *
 * ?allDates=true          - Process all dates from season start to end (including playoffs)
 * ?recent=true            - Process only recent dates (from last processed date to today) - DEFAULT
 * ?date=YYYY-MM-DD        - Process only a specific date (e.g., ?date=2024-01-15)
 * ?allSeasons=true        - Process all historical seasons, not just recent ones
 * ?allDates=true&allSeasons=true - Process ALL dates for ALL seasons
 *
 * NO QUERY PARAMETERS     - Defaults to recent=true (incremental processing from last processed date)
 */

// Parse command line arguments for query parameters
function parseQueryParams() {
  const args = process.argv.slice(2);
  const params = {};

  // Parse query string style arguments
  args.forEach((arg) => {
    if (arg.startsWith("?")) {
      const queryString = arg.substring(1);
      const pairs = queryString.split("&");
      pairs.forEach((pair) => {
        const [key, value] = pair.split("=");
        params[key] =
          value === "true" ? true : value === "false" ? false : value;
      });
    }
  });

  return params;
}

// Teams mapping – please ensure this is complete as needed
const teamsInfo = {
  NJD: { name: "New Jersey Devils", franchiseId: 23, id: 1 },
  NYI: { name: "New York Islanders", franchiseId: 22, id: 2 },
  NYR: { name: "New York Rangers", franchiseId: 10, id: 3 },
  PHI: { name: "Philadelphia Flyers", franchiseId: 16, id: 4 },
  PIT: { name: "Pittsburgh Penguins", franchiseId: 17, id: 5 },
  BOS: { name: "Boston Bruins", franchiseId: 6, id: 6 },
  BUF: { name: "Buffalo Sabres", franchiseId: 19, id: 7 },
  MTL: { name: "Montréal Canadiens", franchiseId: 1, id: 8 },
  OTT: { name: "Ottawa Senators", franchiseId: 30, id: 9 },
  TOR: { name: "Toronto Maple Leafs", franchiseId: 5, id: 10 },
  CAR: { name: "Carolina Hurricanes", franchiseId: 26, id: 12 },
  FLA: { name: "Florida Panthers", franchiseId: 33, id: 13 },
  TBL: { name: "Tampa Bay Lightning", franchiseId: 31, id: 14 },
  WSH: { name: "Washington Capitals", franchiseId: 24, id: 15 },
  CHI: { name: "Chicago Blackhawks", franchiseId: 11, id: 16 },
  DET: { name: "Detroit Red Wings", franchiseId: 12, id: 17 },
  NSH: { name: "Nashville Predators", franchiseId: 34, id: 18 },
  STL: { name: "St. Louis Blues", franchiseId: 18, id: 19 },
  CGY: { name: "Calgary Flames", franchiseId: 21, id: 20 },
  COL: { name: "Colorado Avalanche", franchiseId: 27, id: 21 },
  EDM: { name: "Edmonton Oilers", franchiseId: 25, id: 22 },
  VAN: { name: "Vancouver Canucks", franchiseId: 20, id: 23 },
  ANA: { name: "Anaheim Ducks", franchiseId: 32, id: 24 },
  DAL: { name: "Dallas Stars", franchiseId: 15, id: 25 },
  LAK: { name: "Los Angeles Kings", franchiseId: 14, id: 26 },
  SJS: { name: "San Jose Sharks", franchiseId: 29, id: 28 },
  CBJ: { name: "Columbus Blue Jackets", franchiseId: 36, id: 29 },
  MIN: { name: "Minnesota Wild", franchiseId: 37, id: 30 },
  WPG: { name: "Winnipeg Jets", franchiseId: 35, id: 52 },
  ARI: { name: "Arizona Coyotes", franchiseId: 28, id: 53 },
  VGK: { name: "Vegas Golden Knights", franchiseId: 38, id: 54 },
  SEA: { name: "Seattle Kraken", franchiseId: 39, id: 55 },
  UTA: { name: "Utah Hockey Club", franchiseId: 40, id: 59 }
};

// Helper fetch function
async function Fetch(url) {
  const response = await fetch(url);
  return response.json();
}

async function fetchNHLSeasons() {
  const url =
    "https://api.nhle.com/stats/rest/en/season?sort=%5B%7B%22property%22:%22id%22,%22direction%22:%22DESC%22%7D%5D";
  const response = await Fetch(url);
  return response.data;
}

async function fetchAllGamesForTeamOnDate(formattedDate, teamId) {
  const pageSize = 1000;
  let allGames = [];
  let page = 0;

  while (true) {
    const { data, error } = await supabase
      .from("games")
      .select("id, homeTeamId, awayTeamId")
      .eq("date", formattedDate)
      .or(`homeTeamId.eq.${teamId},awayTeamId.eq.${teamId}`)
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error(
        `Error fetching games for team ${teamId} on ${formattedDate}:`,
        error
      );
      break;
    }

    allGames = allGames.concat(data);
    if (data.length < pageSize) {
      break;
    }
    page++;
  }

  return allGames;
}

async function fetchNHLData(startDate, effectiveEndDate, seasonId, bar) {
  let currentDate = parseISO(startDate);

  while (format(currentDate, "yyyy-MM-dd") <= effectiveEndDate) {
    const formattedDate = format(currentDate, "yyyy-MM-dd");

    const { data: existing, error: existErr } = await supabase
      .from("wgo_team_stats")
      .select("date")
      .eq("season_id", seasonId)
      .eq("date", formattedDate)
      .limit(1);

    if (existErr) {
      console.error(
        `Error checking processed date ${formattedDate}:`,
        existErr
      );
    }

    if (existing && existing.length > 0) {
      console.log(
        `Overwriting previously processed data for: ${formattedDate}`
      );
    } else {
      console.log(`Processing date: ${formattedDate}`);
    }

    console.time(`Processing ${formattedDate}`);

    const statsResponse = await Fetch(
      //   https://api.nhle.com/stats/rest/en/team/summary?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22points%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22wins%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22franchiseId%22,%22direction%22:%22ASC%22%7D%5D&start=0&limit=50&cayenneExp=gameDate%3C=%222025-10-15%2023%3A59%3A59%22%20and%20gameDate%3E=%222025-10-15%22%20and%20gameTypeId=2
      `https://api.nhle.com/stats/rest/en/team/summary?isAggregate=true&isGame=true&sort=[{"property":"points","direction":"DESC"},{"property":"wins","direction":"DESC"},{"property":"franchiseId","direction":"ASC"}]&start=0&limit=50&factCayenneExp=gamesPlayed>=1&cayenneExp=gameDate<='${formattedDate}' and gameDate>='${formattedDate}'`
    );
    const miscStatsResponse = await Fetch(
      `https://api.nhle.com/stats/rest/en/team/realtime?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22hits%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22franchiseId%22,%22direction%22:%22ASC%22%7D%5D&start=0&limit=50&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedDate}%22`
    );
    const penaltyResponse = await Fetch(
      `https://api.nhle.com/stats/rest/en/team/penalties?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22penaltyMinutes%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22franchiseId%22,%22direction%22:%22ASC%22%7D%5D&start=0&limit=50&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedDate}%22`
    );
    const penaltyKillResponse = await Fetch(
      `https://api.nhle.com/stats/rest/en/team/penaltykill?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22penaltyKillPct%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22franchiseId%22,%22direction%22:%22ASC%22%7D%5D&start=0&limit=50&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedDate}%22`
    );
    const powerPlayResponse = await Fetch(
      `https://api.nhle.com/stats/rest/en/team/powerplay?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22powerPlayPct%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22franchiseId%22,%22direction%22:%22ASC%22%7D%5D&start=0&limit=50&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedDate}%22`
    );
    const ppToiResponse = await Fetch(
      `https://api.nhle.com/stats/rest/en/team/powerplaytime?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22timeOnIcePp%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22franchiseId%22,%22direction%22:%22ASC%22%7D%5D&start=0&limit=50&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedDate}%22`
    );
    const pkToiResponse = await Fetch(
      `https://api.nhle.com/stats/rest/en/team/penaltykilltime?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22timeOnIceShorthanded%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22franchiseId%22,%22direction%22:%22ASC%22%7D%5D&start=0&limit=50&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedDate}%22`
    );
    const shootingResponse = await Fetch(
      `https://api.nhle.com/stats/rest/en/team/summaryshooting?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22satTotal%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22franchiseId%22,%22direction%22:%22ASC%22%7D%5D&start=0&limit=50&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedDate}%22`
    );
    const shPercentageResponse = await Fetch(
      `https://api.nhle.com/stats/rest/en/team/percentages?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22satPct%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22franchiseId%22,%22direction%22:%22ASC%22%7D%5D&start=0&limit=50&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedDate}%22`
    );
    const faceOffResponse = await Fetch(
      `https://api.nhle.com/stats/rest/en/team/faceoffpercentages?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22faceoffWinPct%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22franchiseId%22,%22direction%22:%22ASC%22%7D%5D&start=0&limit=50&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedDate}%22`
    );
    const faceOffWinLossResponse = await Fetch(
      `https://api.nhle.com/stats/rest/en/team/faceoffwins?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22faceoffsWon%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22faceoffWinPct%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22franchiseId%22,%22direction%22:%22ASC%22%7D%5D&start=0&limit=50&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedDate}%22`
    );

    const counts = {
      summary: statsResponse?.data?.length || 0,
      realtime: miscStatsResponse?.data?.length || 0,
      penalties: penaltyResponse?.data?.length || 0,
      penaltykill: penaltyKillResponse?.data?.length || 0,
      powerplay: powerPlayResponse?.data?.length || 0,
      pptoi: ppToiResponse?.data?.length || 0,
      pktoi: pkToiResponse?.data?.length || 0,
      shooting: shootingResponse?.data?.length || 0,
      percentages: shPercentageResponse?.data?.length || 0,
      faceoff: faceOffResponse?.data?.length || 0,
      faceoffWins: faceOffWinLossResponse?.data?.length || 0
    };
    const allDatasetsPresent = Object.values(counts).every((n) => n > 0);
    if (allDatasetsPresent) {
      let upsertsForDate = 0;
      for (const stat of statsResponse.data) {
        const additionalStats = miscStatsResponse.data.find(
          (addStat) => addStat.franchiseId === stat.franchiseId
        );
        const penaltyData = penaltyResponse.data.find(
          (penaltyStat) => penaltyStat.franchiseId === stat.franchiseId
        );
        const penaltyKillData = penaltyKillResponse.data.find(
          (penaltyKillStat) => penaltyKillStat.franchiseId === stat.franchiseId
        );
        const powerPlayData = powerPlayResponse.data.find(
          (powerPlayStat) => powerPlayStat.franchiseId === stat.franchiseId
        );
        const ppToiData = ppToiResponse.data.find(
          (ppToiStat) => ppToiStat.franchiseId === stat.franchiseId
        );
        const pkToiData = pkToiResponse.data.find(
          (pkToiStat) => pkToiStat.franchiseId === stat.franchiseId
        );
        const shootingData = shootingResponse.data.find(
          (shootingStat) => shootingStat.franchiseId === stat.franchiseId
        );
        const shPercentageData = shPercentageResponse.data.find(
          (shPercentageStat) =>
            shPercentageStat.franchiseId === stat.franchiseId
        );
        const faceOffData = faceOffResponse.data.find(
          (faceOffStat) => faceOffStat.franchiseId === stat.franchiseId
        );
        const faceOffWinLossData = faceOffWinLossResponse.data.find(
          (faceOffWinLossStat) =>
            faceOffWinLossStat.franchiseId === stat.franchiseId
        );
        const team = Object.values(teamsInfo).find(
          (team) => team.franchiseId === stat.franchiseId
        );
        if (!team) {
          console.warn(
            `No matching team found for franchiseId ${stat.franchiseId} on ${formattedDate}`
          );
          continue;
        }

        const allGames = await fetchAllGamesForTeamOnDate(
          formattedDate,
          team.id
        );
        let gameId = null;
        let opponentId = null;
        if (allGames.length > 0) {
          const game = allGames[0];
          gameId = game.id;
          opponentId =
            game.homeTeamId === team.id ? game.awayTeamId : game.homeTeamId;
        } else {
          console.warn(
            `No matching game found for team ${team.id} on ${formattedDate}`
          );
        }

        const { error: upsertError } = await supabase
          .from("wgo_team_stats")
          .upsert(
            {
              team_id: team.id,
              franchise_name: stat.franchiseName,
              date: formattedDate,
              season_id: seasonId,
              faceoff_win_pct: stat.faceoffWinPct,
              games_played: stat.gamesPlayed,
              goals_against: stat.goalsAgainst,
              goals_against_per_game: stat.goalsAgainstPerGame,
              goals_for: stat.goalsFor,
              goals_for_per_game: stat.goalsForPerGame,
              losses: stat.losses,
              ot_losses: stat.otLosses,
              penalty_kill_net_pct: stat.penaltyKillNetPct,
              penalty_kill_pct: stat.penaltyKillPct,
              point_pct: stat.pointPct,
              points: stat.points,
              power_play_net_pct: stat.powerPlayNetPct,
              power_play_pct: stat.powerPlayPct,
              regulation_and_ot_wins: stat.regulationAndOtWins,
              shots_against_per_game: stat.shotsAgainstPerGame,
              shots_for_per_game: stat.shotsForPerGame,
              wins: stat.wins,
              wins_in_regulation: stat.winsInRegulation,
              wins_in_shootout: stat.winsInShootout,
              // Miscellaneous Stats from miscStatsResponse
              blocked_shots: additionalStats.blockedShots,
              blocked_shots_per_60: additionalStats.blockedShotsPer60,
              empty_net_goals: additionalStats.emptyNetGoals,
              giveaways: additionalStats.giveaways,
              giveaways_per_60: additionalStats.giveawaysPer60,
              hits: additionalStats.hits,
              hits_per_60: additionalStats.hitsPer60,
              missed_shots: additionalStats.missedShots,
              sat_pct: additionalStats.satPct,
              takeaways: additionalStats.takeaways,
              takeaways_per_60: additionalStats.takeawaysPer60,
              time_on_ice_per_game_5v5: additionalStats.timeOnIcePerGame5v5,
              // Penalty Stats from penaltyResponse
              bench_minor_penalties: penaltyData.benchMinorPenalties,
              game_misconducts: penaltyData.gameMisconducts,
              major_penalties: penaltyData.majors,
              match_penalties: penaltyData.matchPenalties,
              minor_penalties: penaltyData.minors,
              misconduct_penalties: penaltyData.misconducts,
              net_penalties: penaltyData.netPenalties,
              net_penalties_per_60: penaltyData.netPenaltiesPer60,
              penalties: penaltyData.penalties,
              penalties_drawn_per_60: penaltyData.penaltiesDrawnPer60,
              penalties_taken_per_60: penaltyData.penaltiesTakenPer60,
              penalty_minutes: penaltyData.penaltyMinutes,
              penalty_seconds_per_game: penaltyData.penaltySecondsPerGame,
              total_penalties_drawn: penaltyData.totalPenaltiesDrawn,
              // Penalty Kill Stats from penaltyKillResponse
              pk_net_goals: penaltyKillData.pkNetGoals,
              pk_net_goals_per_game: penaltyKillData.pkNetGoalsPerGame,
              pp_goals_against: penaltyKillData.ppGoalsAgainst,
              pp_goals_against_per_game: penaltyKillData.ppGoalsAgainstPerGame,
              sh_goals_for: penaltyKillData.shGoalsFor,
              sh_goals_for_per_game: penaltyKillData.shGoalsForPerGame,
              times_shorthanded: penaltyKillData.timesShorthanded,
              times_shorthanded_per_game:
                penaltyKillData.timesShorthandedPerGame,
              // Power Play Stats from powerPlayResponse
              power_play_goals_for: powerPlayData.powerPlayGoalsFor,
              pp_goals_per_game: powerPlayData.ppGoalsPerGame,
              pp_net_goals: powerPlayData.ppNetGoals,
              pp_net_goals_per_game: powerPlayData.ppNetGoalsPerGame,
              pp_opportunities: powerPlayData.ppOpportunities,
              pp_opportunities_per_game: powerPlayData.ppOpportunitiesPerGame,
              pp_time_on_ice_per_game: powerPlayData.ppTimeOnIcePerGame,
              sh_goals_against: powerPlayData.shGoalsAgainst,
              sh_goals_against_per_game: powerPlayData.shGoalsAgainstPerGame,
              // Power Play Time on Ice from ppToiResponse
              goals_4v3: ppToiData.goals4v3,
              goals_5v3: ppToiData.goals5v3,
              goals_5v4: ppToiData.goals5v4,
              opportunities_4v3: ppToiData.opportunities4v3,
              opportunities_5v3: ppToiData.opportunities5v3,
              opportunities_5v4: ppToiData.opportunities5v4,
              overall_power_play_pct: ppToiData.overallPowerPlayPct,
              pp_pct_4v3: ppToiData.powerPlayPct4v3,
              pp_pct_5v3: ppToiData.powerPlayPct5v3,
              pp_pct_5v4: ppToiData.powerPlayPct5v4,
              toi_4v3: ppToiData.timeOnIce4v3,
              toi_5v3: ppToiData.timeOnIce5v3,
              toi_5v4: ppToiData.timeOnIce5v4,
              toi_pp: ppToiData.timeOnIcePp,
              // Penalty Kill Time on Ice from pkToiResponse
              goals_against_3v4: pkToiData.goalsAgainst3v4,
              goals_against_3v5: pkToiData.goalsAgainst3v5,
              goals_against_4v5: pkToiData.goalsAgainst4v5,
              overall_penalty_kill_pct: pkToiData.overallPenaltyKillPct,
              pk_3v4_pct: pkToiData.penaltyKillPct3v4,
              pk_3v5_pct: pkToiData.penaltyKillPct3v5,
              pk_4v5_pct: pkToiData.penaltyKillPct4v5,
              toi_3v4: pkToiData.timeOnIce3v4,
              toi_3v5: pkToiData.timeOnIce3v5,
              toi_4v5: pkToiData.timeOnIce4v5,
              toi_shorthanded: pkToiData.timeOnIceShorthanded,
              times_shorthanded_3v4: pkToiData.timesShorthanded3v4,
              times_shorthanded_3v5: pkToiData.timesShorthanded3v5,
              times_shorthanded_4v5: pkToiData.timesShorthanded4v5,
              // Shooting Stats from shootingResponse
              sat_against: shootingData.satAgainst,
              sat_behind: shootingData.satBehind,
              sat_close: shootingData.satClose,
              sat_for: shootingData.satFor,
              sat_tied: shootingData.satTied,
              sat_total: shootingData.satTotal,
              shots_5v5: shootingData.shots5v5,
              usat_against: shootingData.usatAgainst,
              usat_ahead: shootingData.usatAhead,
              usat_behind: shootingData.usatBehind,
              usat_close: shootingData.usatClose,
              usat_for: shootingData.usatFor,
              usat_tied: shootingData.usatTied,
              usat_total: shootingData.usatTotal,
              // Shooting Percentage Stats from shPercentageResponse
              goals_for_percentage: shPercentageData.goalsForPct,
              sat_percentage: shPercentageData.satPct,
              sat_pct_ahead: shPercentageData.satPctAhead,
              sat_pct_behind: shPercentageData.satPctBehind,
              sat_pct_close: shPercentageData.satPctClose,
              sat_pct_tied: shPercentageData.satPctTied,
              save_pct_5v5: shPercentageData.savePct5v5,
              shooting_pct_5v5: shPercentageData.shootingPct5v5,
              shooting_plus_save_pct_5v5:
                shPercentageData.shootingPlusSavePct5v5,
              usat_pct: shPercentageData.usatPct,
              usat_pct_ahead: shPercentageData.usatPctAhead,
              usat_pct_behind: shPercentageData.usatPctBehind,
              usat_pct_close: shPercentageData.usatPctClose,
              usat_pct_tied: shPercentageData.usatPctTied,
              zone_start_pct_5v5: shPercentageData.zoneStartPct5v5,
              // Faceoff Stats from faceOffResponse
              d_zone_faceoff_pct: faceOffData.defensiveZoneFaceoffPct,
              d_zone_faceoffs: faceOffData.defensiveZoneFaceoffs,
              ev_faceoff_pct: faceOffData.evFaceoffPct,
              ev_faceoffs: faceOffData.evFaceoffs,
              neutral_zone_faceoff_pct: faceOffData.neutralZoneFaceoffPct,
              neutral_zone_faceoffs: faceOffData.neutralZoneFaceoffs,
              o_zone_faceoff_pct: faceOffData.offensiveZoneFaceoffPct,
              o_zone_faceoffs: faceOffData.offensiveZoneFaceoffs,
              pp_faceoff_pct: faceOffData.ppFaceoffPct,
              pp_faceoffs: faceOffData.ppFaceoffs,
              sh_faceoff_pct: faceOffData.shFaceoffPct,
              sh_faceoffs: faceOffData.shFaceoffs,
              total_faceoffs: faceOffData.totalFaceoffs,
              // Faceoff Win/Loss Stats from faceOffWinLossResponse
              d_zone_fol: faceOffWinLossData.defensiveZoneFaceoffLosses,
              d_zone_fow: faceOffWinLossData.defensiveZoneFaceoffWins,
              d_zone_fo: faceOffWinLossData.defensiveZoneFaceoffs,
              ev_fo: faceOffWinLossData.evFaceoffs,
              ev_fol: faceOffWinLossData.evFaceoffsLost,
              ev_fow: faceOffWinLossData.evFaceoffsWon,
              faceoffs_lost: faceOffWinLossData.faceoffsLost,
              faceoffs_won: faceOffWinLossData.faceoffsWon,
              neutral_zone_fol: faceOffWinLossData.neutralZoneFaceoffLosses,
              neutral_zone_fow: faceOffWinLossData.neutralZoneFaceoffWins,
              neutral_zone_fo: faceOffWinLossData.neutralZoneFaceoffs,
              o_zone_fol: faceOffWinLossData.offensiveZoneFaceoffLosses,
              o_zone_fow: faceOffWinLossData.offensiveZoneFaceoffWins,
              o_zone_fo: faceOffWinLossData.offensiveZoneFaceoffs,
              pp_fol: faceOffWinLossData.ppFaceoffsLost,
              pp_fow: faceOffWinLossData.ppFaceoffsWon,
              sh_fol: faceOffWinLossData.shFaceoffsLost,
              sh_fow: faceOffWinLossData.shFaceoffsWon,
              game_id: gameId,
              opponent_id: opponentId
            },
            { onConflict: ["season_id", "team_id", "date"] }
          );
        if (upsertError) {
          console.error(
            `Upsert error for team ${team.id} on ${formattedDate} (season ${seasonId}):`,
            upsertError
          );
        } else {
          upsertsForDate++;
        }
      }
      console.log(
        `Upserts for ${formattedDate} (season ${seasonId}): ${upsertsForDate}`
      );
    } else {
      const missing = Object.entries(counts)
        .filter(([, n]) => n === 0)
        .map(([k]) => k)
        .join(", ");
      console.warn(
        `Skipping upserts for ${formattedDate} (season ${seasonId}) due to missing datasets: ${missing}`
      );
    }

    bar.tick();
    console.timeEnd(`Processing ${formattedDate}`);
    currentDate = addDays(currentDate, 1);
  }
}

async function main(options = {}) {
  // This script can be run from the command line or an API route.
  // We check for command-line args first.
  const queryParams =
    typeof process !== "undefined" && process.argv ? parseQueryParams() : {};

  const {
    allDates = queryParams.allDates || false,
    recent = queryParams.recent !== undefined ? queryParams.recent : true,
    date = queryParams.date || null,
    allSeasons = queryParams.allSeasons || false
  } = { ...options, ...queryParams };

  let specificDate = null;
  if (date) {
    const parsedDate = parseISO(date);
    if (!isValid(parsedDate)) {
      throw new Error(
        `Invalid date format: ${date}. Please use YYYY-MM-DD format.`
      );
    }
    specificDate = format(parsedDate, "yyyy-MM-dd");
    console.log(`Processing specific date: ${specificDate}`);
  }

  const processAllDates = allDates;
  const processRecentDates = recent && !date && !allDates;
  const processOneDay = !!date;
  const processAllSeasons = allSeasons;

  console.log("=== STARTING MAIN FUNCTION ===");
  console.log("Query parameters:", queryParams);
  console.log("Final options:", {
    allDates,
    recent,
    date: specificDate,
    allSeasons,
    processAllDates,
    processRecentDates,
    processOneDay,
    processAllSeasons
  });
  console.time("Total Process Time");

  try {
    console.log("Fetching NHL seasons...");
    const seasons = await fetchNHLSeasons();
    console.log(`Fetched ${seasons?.length || 0} seasons from NHL API`);

    if (!seasons || seasons.length === 0) {
      console.error("No seasons data available from NHL API");
      throw new Error("No seasons data available.");
    }

    let seasonsToProcess;
    if (processAllDates || processAllSeasons) {
      seasonsToProcess = seasons;
      console.log(
        `Processing ALL ${seasons.length} seasons because ${
          processAllDates ? "allDates" : "allSeasons"
        }=true`
      );
    } else {
      const numberOfSeasonsToFetch = 15;
      seasonsToProcess = seasons.slice(0, numberOfSeasonsToFetch).reverse();
      console.log(
        `Processing subset of ${seasonsToProcess.length} seasons (limited to ${numberOfSeasonsToFetch})`
      );
    }

    console.log(
      "Seasons to process:",
      seasonsToProcess.map((s) => s.formattedSeasonId)
    );

    for (let i = 0; i < seasonsToProcess.length; i++) {
      const season = seasonsToProcess[i];
      console.log(
        `\n=== PROCESSING SEASON ${i + 1}/${seasonsToProcess.length}: ${
          season.formattedSeasonId
        } ===`
      );

      const currentDate = new Date();
      const todayStr = format(currentDate, "yyyy-MM-dd");
      console.log(`Today's date: ${todayStr}`);
      console.log(`Season start: ${season.startDate}`);
      console.log(`Season regular end: ${season.regularSeasonEndDate}`);
      console.log(`Season full end (including playoffs): ${season.endDate}`);

      const seasonStarted = isBefore(parseISO(season.startDate), currentDate);
      const seasonEndDate = parseISO(season.endDate.split("T")[0]);
      const isSeasonActive = seasonEndDate >= parseISO(todayStr);

      console.log(`Season started: ${seasonStarted}`);
      console.log(`Season active: ${isSeasonActive}`);
      console.log(`Process all seasons: ${processAllSeasons}`);

      if (seasonStarted && (processAllSeasons || isSeasonActive)) {
        console.log(`✓ Season ${season.formattedSeasonId} will be processed`);

        let newStartDate;
        let effectiveEndDate;

        if (processOneDay) {
          const seasonStartStr = season.startDate.split("T")[0];
          const seasonFullEndStr = season.endDate.split("T")[0];

          if (
            specificDate >= seasonStartStr &&
            specificDate <= seasonFullEndStr
          ) {
            newStartDate = specificDate;
            effectiveEndDate = specificDate;
            console.log(
              `Processing specific date ${specificDate} for season ${season.formattedSeasonId}`
            );
          } else {
            console.log(
              `Skipping season ${season.formattedSeasonId} - date ${specificDate} not in range (${seasonStartStr} to ${seasonFullEndStr})`
            );
            continue;
          }
        } else if (processAllDates) {
          newStartDate = season.startDate.split("T")[0];
          effectiveEndDate = season.endDate.split("T")[0];
          console.log(
            `Processing all dates for season ${season.formattedSeasonId} from ${newStartDate} to ${effectiveEndDate} (including playoffs).`
          );
        } else if (processRecentDates) {
          console.log(
            `Looking up most recent processed date for season ${season.id}...`
          );
          const { data: processedDates, error } = await supabase
            .from("wgo_team_stats")
            .select("date")
            // season_id is stored as a string; ensure we compare apples to apples
            .eq("season_id", season.id.toString())
            .order("date", { ascending: false })
            .limit(1);

          if (error) {
            console.error(
              `Error fetching processed dates for season ${season.formattedSeasonId}:`,
              error
            );
            newStartDate = season.startDate.split("T")[0];
          } else if (processedDates && processedDates.length > 0) {
            newStartDate = processedDates[0].date;
            console.log(
              `Latest processed date for season ${season.formattedSeasonId} is ${newStartDate}. Fetching from that date until today.`
            );
          } else {
            newStartDate = season.startDate.split("T")[0];
            console.log(
              `No processed dates found for season ${season.formattedSeasonId}. Starting from season start date: ${newStartDate}`
            );
          }

          const seasonFullEndStr = season.endDate.split("T")[0];
          effectiveEndDate = isBefore(
            parseISO(todayStr),
            parseISO(seasonFullEndStr)
          )
            ? todayStr
            : seasonFullEndStr;
        } else {
          newStartDate = season.startDate.split("T")[0];
          effectiveEndDate = season.endDate.split("T")[0];
          console.log(
            `Using default date range: ${newStartDate} to ${effectiveEndDate}`
          );
        }

        console.log(`Date range: ${newStartDate} to ${effectiveEndDate}`);

        const seasonRegularEndStr = season.regularSeasonEndDate.split("T")[0];
        if (effectiveEndDate > seasonRegularEndStr) {
          console.log(
            `Note: Including playoff data - processing beyond regular season end (${seasonRegularEndStr}) up to ${effectiveEndDate}`
          );
        }

        let totalDays = 0;
        let tempDate = parseISO(newStartDate);
        while (format(tempDate, "yyyy-MM-dd") <= effectiveEndDate) {
          totalDays++;
          tempDate = addDays(tempDate, 1);
        }

        console.log(`Total days to process: ${totalDays}`);

        if (totalDays > 0) {
          const bar = new ProgressBar(
            `Fetching data for season ${season.formattedSeasonId} [:bar] :percent :etas`,
            { total: totalDays, width: 40 }
          );

          await fetchNHLData(
            newStartDate,
            effectiveEndDate,
            season.id.toString(),
            bar
          );

          console.log(
            `✓ Completed processing season ${season.formattedSeasonId}`
          );
        } else {
          console.log(
            `⚠ No days to process for season ${season.formattedSeasonId} (start: ${newStartDate}, end: ${effectiveEndDate})`
          );
        }
      } else {
        console.log(
          `✗ Skipping season ${season.formattedSeasonId} (started: ${seasonStarted}, active: ${isSeasonActive}, processAllSeasons: ${processAllSeasons})`
        );
      }
    }

    console.log("\n=== MAIN FUNCTION COMPLETED SUCCESSFULLY ===");
  } catch (error) {
    console.error("=== ERROR IN MAIN FUNCTION ===");
    console.error("Error:", error);
    throw error;
  }

  console.timeEnd("Total Process Time");
}

// Export the main function for use in API routes.
export { main };
