// fetchWGOdata.js

const { createClient } = require("@supabase/supabase-js");

const fetch = require("node-fetch"); // Ensure you have node-fetch or equivalent installed
const { parseISO, format, addDays, isBefore } = require("date-fns");
//require("dotenv").config();

// Simplified Fetch function for Node.js
async function Fetch(url) {
  const response = await fetch(url);
  return response.json();
}

// Initialize Supabase client
// const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://fyhftlxokyjtpndbkfse.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5aGZ0bHhva3lqdHBuZGJrZnNlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTY2NDUxMjY5MywiZXhwIjoxOTgwMDg4NjkzfQ.zh3bs4-GOR9E5TWbYlhJHp2MbG6tI_3NA9Ah9StRpVg" ||
  "";
const supabase = createClient(supabaseUrl, supabaseKey);

const teamsInfo = {
  NJD: {
    name: "New Jersey Devils",
    shortName: "Devils",
    primaryColor: "#000000",
    secondaryColor: "#a20620",
    jersey: "#FFFFFF",
    accent: "#154734",
    alt: "#FFFFFF",
    franchiseId: 23,
    id: 1,
  },
  NYI: {
    name: "New York Islanders",
    shortName: "Islanders",
    primaryColor: "#003087",
    secondaryColor: "#FFFFFF",
    jersey: "#FC4C02",
    accent: "#000000",
    alt: "#FFFFFF",
    franchiseId: 22,
    id: 2,
  },
  NYR: {
    name: "New York Rangers",
    shortName: "Rangers",
    primaryColor: "#0038A8",
    secondaryColor: "#FFFFFF",
    jersey: "#CE1126",
    accent: "#A2AAAD",
    alt: "#FFFFFF",
    franchiseId: 10,
    id: 3,
  },
  PHI: {
    name: "Philadelphia Flyers",
    shortName: "Flyers",
    primaryColor: "#cf3308",
    secondaryColor: "#FFFFFF",
    jersey: "#000000",
    accent: "#FFFFFF",
    alt: "#FFFFFF",
    franchiseId: 16,
    id: 4,
  },
  PIT: {
    name: "Pittsburgh Penguins",
    shortName: "Penguins",
    primaryColor: "#000000",
    secondaryColor: "#FFB81C",
    jersey: "#FFFFFF",
    accent: "#FFB81C",
    alt: "#FFFFFF",
    franchiseId: 17,
    id: 5,
  },
  BOS: {
    name: "Boston Bruins",
    shortName: "Bruins",
    primaryColor: "#000000",
    secondaryColor: "#FFB81C",
    jersey: "#FFFFFF",
    accent: "#FFB81C",
    alt: "#FFFFFF",
    franchiseId: 6,
    id: 6,
  },
  BUF: {
    name: "Buffalo Sabres",
    shortName: "Sabres",
    primaryColor: "#02235e",
    secondaryColor: "#FFB81C",
    jersey: "#FFFFFF",
    accent: "#ADAFAA",
    alt: "#FFFFFF",
    franchiseId: 19,
    id: 7,
  },
  MTL: {
    name: "Montréal Canadiens",
    shortName: "Canadiens",
    primaryColor: "#001E62",
    secondaryColor: "#6CACE4",
    jersey: "#A6192E",
    accent: "#FFFFFF",
    alt: "#FFFFFF",
    franchiseId: 1,
    id: 8,
  },
  OTT: {
    name: "Ottawa Senators",
    shortName: "Senators",
    primaryColor: "#000000",
    secondaryColor: "#a20620",
    jersey: "#B9975B",
    accent: "#FFFFFF",
    alt: "#B9975B",
    franchiseId: 30,
    id: 9,
  },
  TOR: {
    name: "Toronto Maple Leafs",
    shortName: "Maple Leafs",
    primaryColor: "#00205B",
    secondaryColor: "#FFFFFF",
    jersey: "#A2AAAD",
    accent: "#ffffff",
    alt: "#FFFFFF",
    franchiseId: 5,
    id: 10,
  },
  CAR: {
    name: "Carolina Hurricanes",
    shortName: "Hurricanes",
    primaryColor: "#000000",
    secondaryColor: "#b10018",
    jersey: "#A4A9AD",
    accent: "#FFFFFF",
    alt: "#FFFFFF",
    franchiseId: 26,
    id: 12,
  },
  FLA: {
    name: "Florida Panthers",
    shortName: "Panthers",
    primaryColor: "#041E42",
    secondaryColor: "#b9975B",
    jersey: "#c8102e",
    accent: "#FFFFFF",
    alt: "#000000",
    franchiseId: 33,
    id: 13,
  },
  TBL: {
    name: "Tampa Bay Lightning",
    shortName: "Lightning",
    primaryColor: "#00205B",
    secondaryColor: "#FFFFFF",
    jersey: "#A2AAAD",
    accent: "#000000",
    alt: "#",
    franchiseId: 31,
    id: 14,
  },
  WSH: {
    name: "Washington Capitals",
    shortName: "Capitals",
    primaryColor: "#041E42",
    secondaryColor: "#C8102E",
    jersey: "#FFFFFF",
    accent: "#A2AAAD",
    alt: "#",
    franchiseId: 24,
    id: 15,
  },
  CHI: {
    name: "Chicago Blackhawks",
    shortName: "Blackhawks",
    primaryColor: "#a20620",
    secondaryColor: "#000000",
    jersey: "#FFFFFF",
    accent: "#CC8A00",
    alt: "#00833E",
    franchiseId: 11,
    id: 16,
  },
  DET: {
    name: "Detroit Red Wings",
    shortName: "Red Wings",
    primaryColor: "#a20620",
    secondaryColor: "#FFFFFF",
    jersey: "#8D9093",
    accent: "#DDCBA4",
    alt: "#",
    franchiseId: 12,
    id: 17,
  },
  NSH: {
    name: "Nashville Predators",
    shortName: "Predators",
    primaryColor: "#041e42",
    secondaryColor: "#FFb81c",
    jersey: "#FFFFFF",
    accent: "#A2AAAD",
    alt: "#",
    franchiseId: 34,
    id: 18,
  },
  STL: {
    name: "St. Louis Blues",
    shortName: "Blues",
    primaryColor: "#041E42",
    secondaryColor: "#FCB514",
    jersey: "#1749a8",
    accent: "#FFFFFF",
    alt: "#",
    franchiseId: 18,
    id: 19,
  },
  CGY: {
    name: "Calgary Flames",
    shortName: "Flames",
    primaryColor: "#8a0113",
    secondaryColor: "#FAAF19",
    jersey: "#FFFFFF",
    accent: "#000000",
    alt: "#ffffff",
    franchiseId: 21,
    id: 20,
  },
  COL: {
    name: "Colorado Avalanche",
    shortName: "Avalanche",
    primaryColor: "#041e42",
    secondaryColor: "#902647",
    jersey: "#236192",
    accent: "#FFFFFF",
    alt: "#",
    franchiseId: 27,
    id: 21,
  },
  EDM: {
    name: "Edmonton Oilers",
    shortName: "Oilers",
    primaryColor: "#041E42",
    secondaryColor: "#FC4C02",
    jersey: "#FFFFFF",
    accent: "#A2AAAD",
    alt: "#",
    franchiseId: 25,
    id: 22,
  },
  VAN: {
    name: "Vancouver Canucks",
    shortName: "Canucks",
    primaryColor: "#00205B",
    secondaryColor: "#00843D",
    jersey: "#ffffff",
    accent: "#041C2C",
    alt: "#",
    franchiseId: 20,
    id: 23,
  },
  ANA: {
    name: "Anaheim Ducks",
    shortName: "Ducks",
    primaryColor: "#010101",
    secondaryColor: "#B9975B",
    jersey: "#FC4C02",
    accent: "#ffffff",
    alt: "#FFFFFF",
    franchiseId: 32,
    id: 24,
  },
  DAL: {
    name: "Dallas Stars",
    shortName: "Stars",
    primaryColor: "#000000",
    secondaryColor: "#44D62C",
    jersey: "#006847",
    accent: "#FFFFFF",
    alt: "#",
    franchiseId: 15,
    id: 25,
  },
  LAK: {
    name: "Los Angeles Kings",
    shortName: "Kings",
    primaryColor: "#000000",
    secondaryColor: "#A2AAAD",
    jersey: "#FFFFFF",
    accent: "#A2AAAD",
    alt: "#",
    franchiseId: 14,
    id: 26,
  },
  SJS: {
    name: "San Jose Sharks",
    shortName: "Sharks",
    primaryColor: "#006D75",
    secondaryColor: "#000000",
    jersey: "#FFFFFF",
    accent: "#EA7200",
    alt: "#",
    franchiseId: 29,
    id: 28,
  },
  CBJ: {
    name: "Columbus Blue Jackets",
    shortName: "Blue Jackets",
    primaryColor: "#002654",
    secondaryColor: "#7DA1C4",
    jersey: "#ffffff",
    accent: "#c8102e",
    alt: "#",
    franchiseId: 36,
    id: 29,
  },
  MIN: {
    name: "Minnesota Wild",
    shortName: "Wild",
    primaryColor: "#154734",
    secondaryColor: "#DDCBA4",
    jersey: "#A6192E",
    accent: "#FFFFFF",
    alt: "#",
    franchiseId: 37,
    id: 30,
  },
  WPG: {
    name: "Winnipeg Jets",
    shortName: "Jets",
    primaryColor: "#041E42",
    secondaryColor: "#A2AAAD",
    jersey: "#004C97",
    accent: "#55565A",
    alt: "#",
    franchiseId: 35,
    id: 52,
  },
  ARI: {
    name: "Arizona Coyotes",
    shortName: "Coyotes",
    primaryColor: "#8C2633",
    secondaryColor: "#DDCBA4",
    jersey: "#ffffff",
    accent: "#A9431E",
    alt: "#5F259F",
    franchiseId: 28,
    id: 53,
  },
  VGK: {
    name: "Vegas Golden Knights",
    shortName: "Knights",
    primaryColor: "#24292c",
    secondaryColor: "#B4975A",
    jersey: "#8d0519",
    accent: "#000000",
    alt: "#",
    franchiseId: 38,
    id: 54,
  },
  SEA: {
    name: "Seattle Kraken",
    shortName: "Kraken",
    primaryColor: "#001628",
    secondaryColor: "#68A2B9",
    jersey: "#99D9D9",
    accent: "#E9072B",
    alt: "#",
    franchiseId: 39,
    id: 55,
  },
};

async function upsertTeams() {
  const teamsArray = Object.values(teamsInfo);

  for (const team of teamsArray) {
    const { error } = await supabase.from("wgo_teams").upsert({
      franchise_id: team.franchiseId,
      franchise_name: team.name,
    });

    if (error) {
      console.error("Error upserting team:", error.message);
    } else {
      console.log(`Successfully upserted team: ${team.name}`);
    }
  }
}

upsertTeams().catch(console.error);

async function fetchNHLData() {
  const scheduleResponse = await Fetch(
    "https://api-web.nhle.com/v1/schedule/now"
  );
  let seasonStart = scheduleResponse.regularSeasonStartDate || "2023-10-10";

  let currentDate = parseISO(seasonStart);
  const today = new Date();

  while (
    isBefore(currentDate, today) ||
    currentDate.toISOString().split("T")[0] ===
      today.toISOString().split("T")[0]
  ) {
    let formattedDate = format(currentDate, "yyyy-MM-dd");

    const statsResponse = await Fetch(
      `https://api.nhle.com/stats/rest/en/team/summary?isAggregate=true&isGame=true&sort=[{"property":"points","direction":"DESC"},{"property":"wins","direction":"DESC"},{"property":"franchiseId","direction":"ASC"}]&start=0&limit=50&factCayenneExp=gamesPlayed>=1&cayenneExp=gameDate<='${formattedDate}' and gameDate>='${formattedDate}' and gameTypeId=2`
    );

    const miscStatsResponse = await Fetch(
      `https://api.nhle.com/stats/rest/en/team/realtime?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22hits%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22franchiseId%22,%22direction%22:%22ASC%22%7D%5D&start=0&limit=50&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedDate}%22%20and%20gameTypeId=2`
    );

    const penaltyResponse = await Fetch(
      `https://api.nhle.com/stats/rest/en/team/penalties?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22penaltyMinutes%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22franchiseId%22,%22direction%22:%22ASC%22%7D%5D&start=0&limit=50&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedDate}%22%20and%20gameTypeId=2`
    );

    const penaltyKillResponse = await Fetch(
      `https://api.nhle.com/stats/rest/en/team/penaltykill?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22penaltyKillPct%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22franchiseId%22,%22direction%22:%22ASC%22%7D%5D&start=0&limit=50&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedDate}%22%20and%20gameTypeId=2`
    );

    const powerPlayResponse = await Fetch(
      `https://api.nhle.com/stats/rest/en/team/powerplay?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22powerPlayPct%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22franchiseId%22,%22direction%22:%22ASC%22%7D%5D&start=0&limit=50&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedDate}%22%20and%20gameTypeId=2`
    );

    const ppToiResponse = await Fetch(
      `https://api.nhle.com/stats/rest/en/team/powerplaytime?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22timeOnIcePp%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22franchiseId%22,%22direction%22:%22ASC%22%7D%5D&start=0&limit=50&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedDate}%22%20and%20gameTypeId=2`
    );

    const pkToiResponse = await Fetch(
      `https://api.nhle.com/stats/rest/en/team/penaltykilltime?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22timeOnIceShorthanded%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22franchiseId%22,%22direction%22:%22ASC%22%7D%5D&start=0&limit=50&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedDate}%22%20and%20gameTypeId=2`
    );

    const shootingResponse = await Fetch(
      `https://api.nhle.com/stats/rest/en/team/summaryshooting?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22satTotal%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22franchiseId%22,%22direction%22:%22ASC%22%7D%5D&start=0&limit=50&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedDate}%22%20and%20gameTypeId=2`
    );

    const shPercentageResponse = await Fetch(
      `https://api.nhle.com/stats/rest/en/team/percentages?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22satPct%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22franchiseId%22,%22direction%22:%22ASC%22%7D%5D&start=0&limit=50&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedDate}%22%20and%20gameTypeId=2`
    );

    const faceOffResponse = await Fetch(
      `https://api.nhle.com/stats/rest/en/team/faceoffpercentages?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22faceoffWinPct%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22franchiseId%22,%22direction%22:%22ASC%22%7D%5D&start=0&limit=50&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedDate}%22%20and%20gameTypeId=2`
    );

    const faceOffWinLossResponse = await Fetch(
      `https://api.nhle.com/stats/rest/en/team/faceoffwins?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22faceoffsWon%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22faceoffWinPct%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22franchiseId%22,%22direction%22:%22ASC%22%7D%5D&start=0&limit=50&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedDate}%22%20and%20gameTypeId=2`
    );

    if (
      statsResponse &&
      statsResponse.data &&
      miscStatsResponse &&
      miscStatsResponse.data &&
      penaltyResponse &&
      penaltyResponse.data &&
      penaltyKillResponse &&
      penaltyKillResponse.data &&
      powerPlayResponse &&
      powerPlayResponse.data &&
      ppToiResponse &&
      ppToiResponse.data &&
      pkToiResponse &&
      pkToiResponse.data &&
      shootingResponse &&
      shootingResponse.data &&
      shPercentageResponse &&
      shPercentageResponse.data &&
      faceOffResponse &&
      faceOffResponse.data &&
      faceOffWinLossResponse &&
      faceOffWinLossResponse.data
    ) {
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

        if (additionalStats) {
          await supabase.from("wgo_team_stats").upsert({
            team_id: stat.franchiseId,
            franchise_name: stat.franchiseName,
            date: formattedDate,
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
            times_shorthanded_per_game: penaltyKillData.timesShorthandedPerGame,
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
            shooting_plus_save_pct_5v5: shPercentageData.shootingPlusSavePct5v5,
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
          });

          // console.log("Upserting Data: ", {
          //   team_id: stat.franchiseId,
          //   franchise_name: stat.franchiseName,
          //   date: formattedDate,
          //   faceoffWinPct: stat.faceoffWinPct,
          //   gamesPlayed: stat.gamesPlayed,
          //   goalsAgainst: stat.goalsAgainst,
          //   goalsAgainstPerGame: stat.goalsAgainstPerGame,
          //   goalsFor: stat.goalsFor,
          //   goalsForPerGame: stat.goalsForPerGame,
          //   losses: stat.losses,
          //   otLosses: stat.otLosses,
          //   penaltyKillNetPct: stat.penaltyKillNetPct,
          //   penaltyKillPct: stat.penaltyKillPct,
          //   pointPct: stat.pointPct,
          //   points: stat.points,
          //   powerPlayNetPct: stat.powerPlayNetPct,
          //   powerPlayPct: stat.powerPlayPct,
          //   regulationAndOtWins: stat.regulationAndOtWins,
          //   shotsAgainstPerGame: stat.shotsAgainstPerGame,
          //   shotsForPerGame: stat.shotsForPerGame,
          //   wins: stat.wins,
          //   winsInRegulation: stat.winsInRegulation,
          //   winsInShootout: stat.winsInShootout,

          //   blockedShots: additionalStats.blockedShots,
          //   blockedShotsPer60: additionalStats.blockedShotsPer60,
          //   emptyNetGoals: additionalStats.emptyNetGoals,
          //   giveaways: additionalStats.giveaways,
          //   giveawaysPer60: additionalStats.giveawaysPer60,
          //   hits: additionalStats.hits,
          //   hitsPer60: additionalStats.hitsPer60,
          //   missedShots: additionalStats.missedShots,
          //   satPct: additionalStats.satPct,
          //   takeaways: additionalStats.takeaways,
          //   takeawaysPer60: additionalStats.takeawaysPer60,
          //   timeOnIcePerGame5v5: additionalStats.timeOnIcePerGame5v5,

          //   benchMinorPenalties: penaltyData.benchMinorPenalties,
          //   gameMisconducts: penaltyData.gameMisconducts,
          //   majors: penaltyData.majors,
          //   matchPenalties: penaltyData.matchPenalties,
          //   minors: penaltyData.minors,
          //   misconducts: penaltyData.misconducts,
          //   netPenalties: penaltyData.netPenalties,
          //   netPenaltiesPer60: penaltyData.netPenaltiesPer60,
          //   penalties: penaltyData.penalties,
          //   penaltiesDrawnPer60: penaltyData.penaltiesDrawnPer60,
          //   penaltiesTakenPer60: penaltyData.penaltiesTakenPer60,
          //   penaltyMinutes: penaltyData.penaltyMinutes,
          //   penaltySecondsPerGame: penaltyData.penaltySecondsPerGame,
          //   totalPenaltiesDrawn: penaltyData.totalPenaltiesDrawn,

          //   pkNetGoals: penaltyKillData.pkNetGoals,
          //   pkNetGoalsPerGame: penaltyKillData.pkNetGoalsPerGame,
          //   ppGoalsAgainst: penaltyKillData.ppGoalsAgainst,
          //   ppGoalsAgainstPerGame: penaltyKillData.ppGoalsAgainstPerGame,
          //   shGoalsFor: penaltyKillData.shGoalsFor,
          //   shGoalsForPerGame: penaltyKillData.shGoalsForPerGame,
          //   timesShorthanded: penaltyKillData.timesShorthanded,
          //   timesShorthandedPerGame: penaltyKillData.timesShorthandedPerGame,

          //   powerPlayGoalsFor: powerPlayData.powerPlayGoalsFor,
          //   ppGoalsPerGame: powerPlayData.ppGoalsPerGame,
          //   ppNetGoals: powerPlayData.ppNetGoals,
          //   ppNetGoalsPerGame: powerPlayData.ppNetGoalsPerGame,
          //   ppOpportunities: powerPlayData.ppOpportunities,
          //   ppOpportunitiesPerGame: powerPlayData.ppOpportunitiesPerGame,
          //   ppTimeOnIcePerGame: powerPlayData.ppTimeOnIcePerGame,
          //   shGoalsAgainst: powerPlayData.shGoalsAgainst,
          //   shGoalsAgainstPerGame: powerPlayData.shGoalsAgainstPerGame,

          //   goals4v3: ppToiData.goals4v3,
          //   goals5v3: ppToiData.goals5v3,
          //   goals5v4: ppToiData.goals5v4,
          //   opportunities4v3: ppToiData.opportunities4v3,
          //   opportunities5v3: ppToiData.opportunities5v3,
          //   opportunities5v4: ppToiData.opportunities5v4,
          //   overallPowerPlayPct: ppToiData.overallPowerPlayPct,
          //   powerPlayPct4v3: ppToiData.powerPlayPct4v3,
          //   powerPlayPct5v3: ppToiData.powerPlayPct5v3,
          //   powerPlayPct5v4: ppToiData.powerPlayPct5v4,
          //   timeOnIce4v3: ppToiData.timeOnIce4v3,
          //   timeOnIce5v3: ppToiData.timeOnIce5v3,
          //   timeOnIce5v4: ppToiData.timeOnIce5v4,
          //   timeOnIcePp: ppToiData.timeOnIcePp,

          //   goalsAgainst3v4: pkToiData.goalsAgainst3v4,
          //   goalsAgainst3v5: pkToiData.goalsAgainst3v5,
          //   goalsAgainst4v5: pkToiData.goalsAgainst4v5,
          //   overallPenaltyKillPct: pkToiData.overallPenaltyKillPct,
          //   penaltyKillPct3v4: pkToiData.penaltyKillPct3v4,
          //   penaltyKillPct3v5: pkToiData.penaltyKillPct3v5,
          //   penaltyKillPct4v5: pkToiData.penaltyKillPct4v5,
          //   timeOnIce3v4: pkToiData.timeOnIce3v4,
          //   timeOnIce3v5: pkToiData.timeOnIce3v5,
          //   timeOnIce4v5: pkToiData.timeOnIce4v5,
          //   timeOnIceShorthanded: pkToiData.timeOnIceShorthanded,
          //   timesShorthanded3v4: pkToiData.timesShorthanded3v4,
          //   timesShorthanded3v5: pkToiData.timesShorthanded3v5,
          //   timesShorthanded4v5: pkToiData.timesShorthanded4v5,

          //   satAgainst: shootingData.satAgainst,
          //   satBehind: shootingData.satBehind,
          //   satClose: shootingData.satClose,
          //   satFor: shootingData.satFor,
          //   satTied: shootingData.satTied,
          //   satTotal: shootingData.satTotal,
          //   shots5v5: shootingData.shots5v5,
          //   usatAgainst: shootingData.usatAgainst,
          //   usatAhead: shootingData.usatAhead,
          //   usatBehind: shootingData.usatBehind,
          //   usatClose: shootingData.usatClose,
          //   usatFor: shootingData.usatFor,

          //   goalsForPct: shPercentageData.goalsForPct,
          //   satPct: shPercentageData.satPct,
          //   satPctAhead: shPercentageData.satPctAhead,
          //   satPctBehind: shPercentageData.satPctBehind,
          //   satPctClose: shPercentageData.satPctClose,
          //   satPctTied: shPercentageData.satPctTied,
          //   savePct5v5: shPercentageData.savePct5v5,
          //   shootingPct5v5: shPercentageData.shootingPct5v5,
          //   shootingPlusSavePct5v5: shPercentageData.shootingPlusSavePct5v5,
          //   usatPct: shPercentageData.usatPct,
          //   usatPctAhead: shPercentageData.usatPctAhead,
          //   usatPctBehind: shPercentageData.usatPctBehind,
          //   usatPctClose: shPercentageData.usatPctClose,
          //   usatPctTied: shPercentageData.usatPctTied,
          //   zoneStartPct5v5: shPercentageData.zoneStartPct5v5,

          //   defensiveZoneFaceoffPct: faceOffData.defensiveZoneFaceoffPct,
          //   defensiveZoneFaceoffs: faceOffData.defensiveZoneFaceoffs,
          //   evFaceoffPct: faceOffData.evFaceoffPct,
          //   evFaceoffs: faceOffData.evFaceoffs,
          //   neutralZoneFaceoffPct: faceOffData.neutralZoneFaceoffPct,
          //   neutralZoneFaceoffs: faceOffData.neutralZoneFaceoffs,
          //   offensiveZoneFaceoffPct: faceOffData.offensiveZoneFaceoffPct,
          //   offensiveZoneFaceoffs: faceOffData.offensiveZoneFaceoffs,
          //   ppFaceoffPct: faceOffData.ppFaceoffPct,
          //   shFaceoffPct: faceOffData.shFaceoffPct,
          //   totalFaceoffs: faceOffData.totalFaceoffs,

          //   defensiveZoneFaceoffLosses:
          //     faceOffWinLossData.defensiveZoneFaceoffLosses,
          //   defensiveZoneFaceoffWins:
          //     faceOffWinLossData.defensiveZoneFaceoffWins,
          //   defensiveZoneFaceoffs: faceOffWinLossData.defensiveZoneFaceoffs,
          //   evFaceoffs: faceOffWinLossData.evFaceoffs,
          //   evFaceoffsLost: faceOffWinLossData.evFaceoffsLost,
          //   evFaceoffsWon: faceOffWinLossData.evFaceoffsWon,
          //   faceoffsLost: faceOffWinLossData.faceoffsLost,
          //   faceoffsWon: faceOffWinLossData.faceoffsWon,
          //   neutralZoneFaceoffLosses:
          //     faceOffWinLossData.neutralZoneFaceoffLosses,
          //   neutralZoneFaceoffWins: faceOffWinLossData.neutralZoneFaceoffWins,
          //   neutralZoneFaceoffs: faceOffWinLossData.neutralZoneFaceoffs,
          //   offensiveZoneFaceoffLosses:
          //     faceOffWinLossData.offensiveZoneFaceoffLosses,
          //   offensiveZoneFaceoffWins:
          //     faceOffWinLossData.offensiveZoneFaceoffWins,
          //   offensiveZoneFaceoffs: faceOffWinLossData.offensiveZoneFaceoffs,
          //   ppFaceoffsLost: faceOffWinLossData.ppFaceoffsLost,
          //   ppFaceoffsWon: faceOffWinLossData.ppFaceoffsWon,
          //   shFaceoffsLost: faceOffWinLossData.shFaceoffsLost,
          //   shFaceoffsWon: faceOffWinLossData.shFaceoffsWon,
          // });
        }
      }
    } else {
      console.error(
        "Failed to fetch NHL stats for date " +
          formattedDate +
          ": Error or empty data"
      );
    }

    currentDate = addDays(currentDate, 1);
  }
}

fetchNHLData();
