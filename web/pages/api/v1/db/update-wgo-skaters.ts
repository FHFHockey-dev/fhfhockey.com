// /Users/tim/Desktop/FHFH/fhfhockey.com/web/pages/api/v1/db/update-wgo-skaters.ts

import { NextApiRequest, NextApiResponse } from "next";
import supabase from "lib/supabase";
import Fetch from "lib/cors-fetch";
import { format, parseISO, addDays, isBefore, formatISO } from "date-fns";
import { getCurrentSeason } from "lib/NHL/server";
import {
  WGOSummarySkaterStat,
  WGOSkatersBio,
  WGORealtimeSkaterStat,
  WGOFaceoffSkaterStat,
  WGOFaceOffWinLossSkaterStat,
  WGOGoalsForAgainstSkaterStat,
  WGOPenaltySkaterStat,
  WGOPenaltyKillSkaterStat,
  WGOPowerPlaySkaterStat,
  WGOPuckPossessionSkaterStat,
  WGOSatCountSkaterStat,
  WGOSatPercentageSkaterStat,
  WGOScoringRatesSkaterStat,
  WGOScoringCountsSkaterStat,
  WGOShotTypeSkaterStat,
  WGOToiSkaterStat
} from "lib/NHL/types";

// Types
interface NHLApiResponse {
  data: any[];
}

type SkaterDbRecord = {
  [key: string]: any;
  player_id: number;
  player_name: string;
  date: string;
};

type AllSkaterStats = {
  skaterStats: WGOSummarySkaterStat[];
  skatersBio: WGOSkatersBio[];
  miscSkaterStats: WGORealtimeSkaterStat[];
  faceOffStats: WGOFaceoffSkaterStat[];
  faceoffWinLossStats: WGOFaceOffWinLossSkaterStat[];
  goalsForAgainstStats: WGOGoalsForAgainstSkaterStat[];
  penaltiesStats: WGOPenaltySkaterStat[];
  penaltyKillStats: WGOPenaltyKillSkaterStat[];
  powerPlayStats: WGOPowerPlaySkaterStat[];
  puckPossessionStats: WGOPuckPossessionSkaterStat[];
  satCountsStats: WGOSatCountSkaterStat[];
  satPercentagesStats: WGOSatPercentageSkaterStat[];
  scoringRatesStats: WGOScoringRatesSkaterStat[];
  scoringPerGameStats: WGOScoringCountsSkaterStat[];
  shotTypeStats: WGOShotTypeSkaterStat[];
  timeOnIceStats: WGOToiSkaterStat[];
};

type DataMaps = {
  bioMap: Map<number, WGOSkatersBio>;
  miscMap: Map<number, WGORealtimeSkaterStat>;
  faceOffMap: Map<number, WGOFaceoffSkaterStat>;
  faceoffWinLossMap: Map<number, WGOFaceOffWinLossSkaterStat>;
  goalsForAgainstMap: Map<number, WGOGoalsForAgainstSkaterStat>;
  penaltiesMap: Map<number, WGOPenaltySkaterStat>;
  penaltyKillMap: Map<number, WGOPenaltyKillSkaterStat>;
  powerPlayMap: Map<number, WGOPowerPlaySkaterStat>;
  puckPossessionMap: Map<number, WGOPuckPossessionSkaterStat>;
  satCountsMap: Map<number, WGOSatCountSkaterStat>;
  satPercentagesMap: Map<number, WGOSatPercentageSkaterStat>;
  scoringRatesMap: Map<number, WGOScoringRatesSkaterStat>;
  scoringPerGameMap: Map<number, WGOScoringCountsSkaterStat>;
  shotTypeMap: Map<number, WGOShotTypeSkaterStat>;
  timeOnIceMap: Map<number, WGOToiSkaterStat>;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function mapApiDataToDbRecord(
  stat: WGOSummarySkaterStat,
  allData: DataMaps,
  formattedDate: string,
  seasonId?: number
): SkaterDbRecord {
  const bioStats = allData.bioMap.get(stat.playerId);
  const miscStats = allData.miscMap.get(stat.playerId);
  const faceOffStat = allData.faceOffMap.get(stat.playerId);
  const faceoffWinLossStat = allData.faceoffWinLossMap.get(stat.playerId);
  const goalsForAgainstStat = allData.goalsForAgainstMap.get(stat.playerId);
  const penaltiesStat = allData.penaltiesMap.get(stat.playerId);
  const penaltyKillStat = allData.penaltyKillMap.get(stat.playerId);
  const powerPlayStat = allData.powerPlayMap.get(stat.playerId);
  const puckPossessionStat = allData.puckPossessionMap.get(stat.playerId);
  const satCountsStat = allData.satCountsMap.get(stat.playerId);
  const satPercentagesStat = allData.satPercentagesMap.get(stat.playerId);
  const scoringRatesStat = allData.scoringRatesMap.get(stat.playerId);
  const scoringPerGameStat = allData.scoringPerGameMap.get(stat.playerId);
  const shotTypeStat = allData.shotTypeMap.get(stat.playerId);
  const timeOnIceStat = allData.timeOnIceMap.get(stat.playerId);

  const record: SkaterDbRecord = {
    player_id: stat.playerId,
    player_name: stat.skaterFullName,
    date: formattedDate,
    shoots_catches: stat.shootsCatches,
    position_code: stat.positionCode,
    games_played: stat.gamesPlayed,
    points: stat.points,
    points_per_game: stat.pointsPerGame,
    goals: stat.goals,
    assists: stat.assists,
    shots: stat.shots,
    shooting_percentage: stat.shootingPct,
    plus_minus: stat.plusMinus,
    ot_goals: stat.otGoals,
    gw_goals: stat.gameWinningGoals,
    pp_points: stat.ppPoints,
    fow_percentage: stat.faceoffWinPct,
    toi_per_game: stat.timeOnIcePerGame,
    birth_date: bioStats?.birthDate,
    current_team_abbreviation: bioStats?.currentTeamAbbrev,
    current_team_name: bioStats?.currentTeamName,
    birth_city: bioStats?.birthCity,
    birth_country: bioStats?.birthCountryCode,
    height: bioStats?.height,
    weight: bioStats?.weight,
    draft_year: bioStats?.draftYear,
    draft_round: bioStats?.draftRound,
    draft_overall: bioStats?.draftOverall,
    first_season_for_game_type: bioStats?.firstSeasonForGameType,
    nationality_code: bioStats?.nationalityCode,
    blocked_shots: miscStats?.blockedShots,
    blocks_per_60: miscStats?.blockedShotsPer60,
    empty_net_assists: miscStats?.emptyNetAssists,
    empty_net_goals: miscStats?.emptyNetGoals,
    empty_net_points: miscStats?.emptyNetPoints,
    first_goals: miscStats?.firstGoals,
    giveaways: miscStats?.giveaways,
    giveaways_per_60: miscStats?.giveawaysPer60,
    hits: miscStats?.hits,
    hits_per_60: miscStats?.hitsPer60,
    missed_shot_crossbar: miscStats?.missedShotCrossbar,
    missed_shot_goal_post: miscStats?.missedShotGoalpost,
    missed_shot_over_net: miscStats?.missedShotOverNet,
    missed_shot_short_side: miscStats?.missedShotShort,
    missed_shot_wide_of_net: miscStats?.missedShotWideOfNet,
    missed_shots: miscStats?.missedShots,
    takeaways: miscStats?.takeaways,
    takeaways_per_60: miscStats?.takeawaysPer60,
    d_zone_fo_percentage: faceOffStat?.defensiveZoneFaceoffPct,
    d_zone_faceoffs: faceOffStat?.defensiveZoneFaceoffs,
    ev_faceoff_percentage: faceOffStat?.evFaceoffPct,
    ev_faceoffs: faceOffStat?.evFaceoffs,
    n_zone_fo_percentage: faceOffStat?.neutralZoneFaceoffPct,
    n_zone_faceoffs: faceOffStat?.neutralZoneFaceoffs,
    o_zone_fo_percentage: faceOffStat?.offensiveZoneFaceoffPct,
    o_zone_faceoffs: faceOffStat?.offensiveZoneFaceoffs,
    pp_faceoff_percentage: faceOffStat?.ppFaceoffPct,
    pp_faceoffs: faceOffStat?.ppFaceoffs,
    sh_faceoff_percentage: faceOffStat?.shFaceoffPct,
    sh_faceoffs: faceOffStat?.shFaceoffs,
    total_faceoffs: faceOffStat?.totalFaceoffs,
    d_zone_fol: faceoffWinLossStat?.defensiveZoneFaceoffLosses,
    d_zone_fow: faceoffWinLossStat?.defensiveZoneFaceoffWins,
    ev_fol: faceoffWinLossStat?.evFaceoffsLost,
    ev_fow: faceoffWinLossStat?.evFaceoffsWon,
    n_zone_fol: faceoffWinLossStat?.neutralZoneFaceoffLosses,
    n_zone_fow: faceoffWinLossStat?.neutralZoneFaceoffWins,
    o_zone_fol: faceoffWinLossStat?.offensiveZoneFaceoffLosses,
    o_zone_fow: faceoffWinLossStat?.offensiveZoneFaceoffWins,
    pp_fol: faceoffWinLossStat?.ppFaceoffsLost,
    pp_fow: faceoffWinLossStat?.ppFaceoffsWon,
    sh_fol: faceoffWinLossStat?.shFaceoffsLost,
    sh_fow: faceoffWinLossStat?.shFaceoffsWon,
    total_fol: faceoffWinLossStat?.totalFaceoffLosses,
    total_fow: faceoffWinLossStat?.totalFaceoffWins,
    es_goal_diff: goalsForAgainstStat?.evenStrengthGoalDifference,
    es_goals_against: goalsForAgainstStat?.evenStrengthGoalsAgainst,
    es_goals_for: goalsForAgainstStat?.evenStrengthGoalsFor,
    es_goals_for_percentage: goalsForAgainstStat?.evenStrengthGoalsForPct,
    es_toi_per_game: goalsForAgainstStat?.evenStrengthTimeOnIcePerGame,
    pp_goals_against: goalsForAgainstStat?.powerPlayGoalsAgainst,
    pp_goals_for: goalsForAgainstStat?.powerPlayGoalFor,
    pp_toi_per_game: goalsForAgainstStat?.powerPlayTimeOnIcePerGame,
    sh_goals_against: goalsForAgainstStat?.shortHandedGoalsAgainst,
    sh_goals_for: goalsForAgainstStat?.shortHandedGoalsFor,
    sh_toi_per_game: goalsForAgainstStat?.shortHandedTimeOnIcePerGame,
    game_misconduct_penalties: penaltiesStat?.gameMisconductPenalties,
    major_penalties: penaltiesStat?.majorPenalties,
    match_penalties: penaltiesStat?.matchPenalties,
    minor_penalties: penaltiesStat?.minorPenalties,
    misconduct_penalties: penaltiesStat?.misconductPenalties,
    net_penalties: penaltiesStat?.netPenalties,
    net_penalties_per_60: penaltiesStat?.netPenaltiesPer60,
    penalties: penaltiesStat?.penalties,
    penalties_drawn: penaltiesStat?.penaltiesDrawn,
    penalties_drawn_per_60: penaltiesStat?.penaltiesDrawnPer60,
    penalties_taken_per_60: penaltiesStat?.penaltiesTakenPer60,
    penalty_minutes: penaltiesStat?.penaltyMinutes,
    penalty_minutes_per_toi: penaltiesStat?.penaltyMinutesPerTimeOnIce,
    penalty_seconds_per_game: penaltiesStat?.penaltySecondsPerGame,
    pp_goals_against_per_60: penaltyKillStat?.ppGoalsAgainstPer60,
    sh_assists: penaltyKillStat?.shAssists,
    sh_goals: penaltyKillStat?.shGoals,
    sh_points: penaltyKillStat?.shPoints,
    sh_goals_per_60: penaltyKillStat?.shGoalsPer60,
    sh_individual_sat_for: penaltyKillStat?.shIndividualSatFor,
    sh_individual_sat_per_60: penaltyKillStat?.shIndividualSatForPer60,
    sh_points_per_60: penaltyKillStat?.shPointsPer60,
    sh_primary_assists: penaltyKillStat?.shPrimaryAssists,
    sh_primary_assists_per_60: penaltyKillStat?.shPrimaryAssistsPer60,
    sh_secondary_assists: penaltyKillStat?.shSecondaryAssists,
    sh_secondary_assists_per_60: penaltyKillStat?.shSecondaryAssistsPer60,
    sh_shooting_percentage: penaltyKillStat?.shShootingPct,
    sh_shots: penaltyKillStat?.shShots,
    sh_shots_per_60: penaltyKillStat?.shShotsPer60,
    sh_time_on_ice: penaltyKillStat?.shTimeOnIce,
    sh_time_on_ice_pct_per_game: penaltyKillStat?.shTimeOnIcePctPerGame,
    pp_assists: powerPlayStat?.ppAssists,
    pp_goals: powerPlayStat?.ppGoals,
    pp_goals_for_per_60: powerPlayStat?.ppGoalsForPer60,
    pp_goals_per_60: powerPlayStat?.ppGoalsPer60,
    pp_individual_sat_for: powerPlayStat?.ppIndividualSatFor,
    pp_individual_sat_per_60: powerPlayStat?.ppIndividualSatPer60,
    pp_points_per_60: powerPlayStat?.ppPointsPer60,
    pp_primary_assists: powerPlayStat?.ppPrimaryAssists,
    pp_primary_assists_per_60: powerPlayStat?.ppPrimaryAssistsPer60,
    pp_secondary_assists: powerPlayStat?.ppSecondaryAssists,
    pp_secondary_assists_per_60: powerPlayStat?.ppSecondaryAssistsPer60,
    pp_shooting_percentage: powerPlayStat?.ppShootingPct,
    pp_shots: powerPlayStat?.ppShots,
    pp_shots_per_60: powerPlayStat?.ppShotsPer60,
    pp_toi: powerPlayStat?.ppTimeOnIce,
    pp_toi_pct_per_game: powerPlayStat?.ppTimeOnIcePctPerGame,
    goals_pct: puckPossessionStat?.goalsPct,
    faceoff_pct_5v5: puckPossessionStat?.faceoffPct5v5,
    individual_sat_for_per_60: puckPossessionStat?.individualSatForPer60,
    individual_shots_for_per_60: puckPossessionStat?.individualShotsForPer60,
    on_ice_shooting_pct: puckPossessionStat?.onIceShootingPct,
    sat_pct: puckPossessionStat?.satPct,
    toi_per_game_5v5: puckPossessionStat?.timeOnIcePerGame5v5,
    usat_pct: puckPossessionStat?.usatPct,
    zone_start_pct: puckPossessionStat?.zoneStartPct,
    sat_against: satCountsStat?.satAgainst,
    sat_ahead: satCountsStat?.satAhead,
    sat_behind: satCountsStat?.satBehind,
    sat_close: satCountsStat?.satClose,
    sat_for: satCountsStat?.satFor,
    sat_tied: satCountsStat?.satTied,
    sat_total: satCountsStat?.satTotal,
    usat_against: satCountsStat?.usatAgainst,
    usat_ahead: satCountsStat?.usatAhead,
    usat_behind: satCountsStat?.usatBehind,
    usat_close: satCountsStat?.usatClose,
    usat_for: satCountsStat?.usatFor,
    usat_tied: satCountsStat?.usatTied,
    usat_total: satCountsStat?.usatTotal,
    sat_percentage: satPercentagesStat?.satPercentage,
    sat_percentage_ahead: satPercentagesStat?.satPercentageAhead,
    sat_percentage_behind: satPercentagesStat?.satPercentageBehind,
    sat_percentage_close: satPercentagesStat?.satPercentageClose,
    sat_percentage_tied: satPercentagesStat?.satPercentageTied,
    sat_relative: satPercentagesStat?.satRelative,
    shooting_percentage_5v5: satPercentagesStat?.shootingPct5v5,
    skater_save_pct_5v5: satPercentagesStat?.skaterSavePct5v5,
    skater_shooting_plus_save_pct_5v5:
      satPercentagesStat?.skaterShootingPlusSavePct5v5,
    usat_percentage: satPercentagesStat?.usatPercentage,
    usat_percentage_ahead: satPercentagesStat?.usatPercentageAhead,
    usat_percentage_behind: satPercentagesStat?.usatPercentageBehind,
    usat_percentage_close: satPercentagesStat?.usatPrecentageClose,
    usat_percentage_tied: satPercentagesStat?.usatPercentageTied,
    usat_relative: satPercentagesStat?.usatRelative,
    zone_start_pct_5v5: satPercentagesStat?.zoneStartPct5v5,
    assists_5v5: scoringRatesStat?.assists5v5,
    assists_per_60_5v5: scoringRatesStat?.assistsPer605v5,
    goals_5v5: scoringRatesStat?.goals5v5,
    goals_per_60_5v5: scoringRatesStat?.goalsPer605v5,
    net_minor_penalties_per_60: scoringRatesStat?.netMinorPenaltiesPer60,
    o_zone_start_pct_5v5: scoringRatesStat?.offensiveZoneStartPct5v5,
    on_ice_shooting_pct_5v5: scoringRatesStat?.onIceShootingPct5v5,
    points_5v5: scoringRatesStat?.points5v5,
    points_per_60_5v5: scoringRatesStat?.pointsPer605v5,
    primary_assists_5v5: scoringRatesStat?.primaryAssists5v5,
    primary_assists_per_60_5v5: scoringRatesStat?.primaryAssistsPer605v5,
    sat_relative_5v5: scoringRatesStat?.satRelative5v5,
    secondary_assists_5v5: scoringRatesStat?.secondaryAssists5v5,
    secondary_assists_per_60_5v5: scoringRatesStat?.secondaryAssistsPer605v5,
    assists_per_game: scoringPerGameStat?.assistsPerGame,
    blocks_per_game: scoringPerGameStat?.blocksPerGame,
    goals_per_game: scoringPerGameStat?.goalsPerGame,
    hits_per_game: scoringPerGameStat?.hitsPerGame,
    penalty_minutes_per_game: scoringPerGameStat?.penaltyMinutesPerGame,
    primary_assists_per_game: scoringPerGameStat?.primaryAssistsPerGame,
    secondary_assists_per_game: scoringPerGameStat?.secondaryAssistsPerGame,
    shots_per_game: scoringPerGameStat?.shotsPerGame,
    total_primary_assists: scoringPerGameStat?.totalPrimaryAssists,
    total_secondary_assists: scoringPerGameStat?.totalSecondaryAssists,
    goals_backhand: shotTypeStat?.goalsBackhand,
    goals_bat: shotTypeStat?.goalsBat,
    goals_between_legs: shotTypeStat?.goalsBetweenLegs,
    goals_cradle: shotTypeStat?.goalsCradle,
    goals_deflected: shotTypeStat?.goalsDeflected,
    goals_poke: shotTypeStat?.goalsPoke,
    goals_slap: shotTypeStat?.goalsSlap,
    goals_snap: shotTypeStat?.goalsSnap,
    goals_tip_in: shotTypeStat?.goalsTipIn,
    goals_wrap_around: shotTypeStat?.goalsWrapAround,
    goals_wrist: shotTypeStat?.goalsWrist,
    shooting_pct_backhand: shotTypeStat?.shootingPctBackhand,
    shooting_pct_bat: shotTypeStat?.shootingPctBat,
    shooting_pct_between_legs: shotTypeStat?.shootingPctBetweenLegs,
    shooting_pct_cradle: shotTypeStat?.shootingPctCradle,
    shooting_pct_deflected: shotTypeStat?.shootingPctDeflected,
    shooting_pct_poke: shotTypeStat?.shootingPctPoke,
    shooting_pct_slap: shotTypeStat?.shootingPctSlap,
    shooting_pct_snap: shotTypeStat?.shootingPctSnap,
    shooting_pct_tip_in: shotTypeStat?.shootingPctTipIn,
    shooting_pct_wrap_around: shotTypeStat?.shootingPctWrapAround,
    shooting_pct_wrist: shotTypeStat?.shootingPctWrist,
    shots_on_net_backhand: shotTypeStat?.shotsOnNetBackhand,
    shots_on_net_bat: shotTypeStat?.shotsOnNetBat,
    shots_on_net_between_legs: shotTypeStat?.shotsOnNetBetweenLegs,
    shots_on_net_cradle: shotTypeStat?.shotsOnNetCradle,
    shots_on_net_deflected: shotTypeStat?.shotsOnNetDeflected,
    shots_on_net_poke: shotTypeStat?.shotsOnNetPoke,
    shots_on_net_slap: shotTypeStat?.shotsOnNetSlap,
    shots_on_net_snap: shotTypeStat?.shotsOnNetSnap,
    shots_on_net_tip_in: shotTypeStat?.shotsOnNetTipIn,
    shots_on_net_wrap_around: shotTypeStat?.shotsOnNetWrapAround,
    shots_on_net_wrist: shotTypeStat?.shotsOnNetWrist,
    ev_time_on_ice: timeOnIceStat?.evTimeOnIce,
    ev_time_on_ice_per_game: timeOnIceStat?.evTimeOnIcePerGame,
    ot_time_on_ice: timeOnIceStat?.otTimeOnIce,
    ot_time_on_ice_per_game: timeOnIceStat?.otTimeOnIcePerOtGame,
    shifts: timeOnIceStat?.shifts,
    shifts_per_game: timeOnIceStat?.shiftsPerGame,
    time_on_ice_per_shift: timeOnIceStat?.timeOnIcePerShift
  };
  if (seasonId) {
    record.season_id = seasonId;
  }
  Object.keys(record).forEach(
    (key) => record[key] === undefined && delete record[key]
  );
  return record;
}

async function fetchDataForGameType(
  gameTypeId: number,
  formattedDate: string,
  limit: number = 100
): Promise<AllSkaterStats> {
  let start = 0;
  let moreDataAvailable = true;
  const allData: AllSkaterStats = {
    skaterStats: [],
    skatersBio: [],
    miscSkaterStats: [],
    faceOffStats: [],
    faceoffWinLossStats: [],
    goalsForAgainstStats: [],
    penaltiesStats: [],
    penaltyKillStats: [],
    powerPlayStats: [],
    puckPossessionStats: [],
    satCountsStats: [],
    satPercentagesStats: [],
    scoringRatesStats: [],
    scoringPerGameStats: [],
    shotTypeStats: [],
    timeOnIceStats: []
  };
  const getUrl = (
    reportName: string,
    sort: string,
    factCayenneExp: string = "gamesPlayed>=1"
  ) =>
    `https://api.nhle.com/stats/rest/en/skater/${reportName}?isAggregate=true&isGame=true&sort=${encodeURIComponent(sort)}&start=${start}&limit=${limit}&factCayenneExp=${factCayenneExp}&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedDate}%22%20and%20gameTypeId=${gameTypeId}`;
  while (moreDataAvailable) {
    const urls = {
      skaterStats: getUrl(
        "summary",
        '[{"property":"points","direction":"DESC"},{"property":"goals","direction":"DESC"},{"property":"assists","direction":"DESC"},{"property":"playerId","direction":"ASC"}]'
      ),
      skatersBio: getUrl(
        "bios",
        '[{"property":"lastName","direction":"ASC_CI"},{"property":"skaterFullName","direction":"ASC_CI"},{"property":"playerId","direction":"ASC"}]',
        ""
      ),
      miscSkaterStats: getUrl(
        "realtime",
        '[{"property":"hits","direction":"DESC"},{"property":"playerId","direction":"ASC"}]'
      ),
      faceOffStats: getUrl(
        "faceoffpercentages",
        '[{"property":"totalFaceoffs","direction":"DESC"},{"property":"playerId","direction":"ASC"}]'
      ),
      faceoffWinLossStats: getUrl(
        "faceoffwins",
        '[{"property":"totalFaceoffWins","direction":"DESC"},{"property":"faceoffWinPct","direction":"DESC"},{"property":"playerId","direction":"ASC"}]'
      ),
      goalsForAgainstStats: getUrl(
        "goalsForAgainst",
        '[{"property":"evenStrengthGoalDifference","direction":"DESC"},{"property":"playerId","direction":"ASC"}]'
      ),
      penaltiesStats: getUrl(
        "penalties",
        '[{"property":"penaltyMinutes","direction":"DESC"},{"property":"playerId","direction":"ASC"}]'
      ),
      penaltyKillStats: getUrl(
        "penaltykill",
        '[{"property":"shTimeOnIce","direction":"DESC"},{"property":"playerId","direction":"ASC"}]'
      ),
      powerPlayStats: getUrl(
        "powerplay",
        '[{"property":"ppTimeOnIce","direction":"DESC"},{"property":"playerId","direction":"ASC"}]'
      ),
      puckPossessionStats: getUrl(
        "puckPossessions",
        '[{"property":"satPct","direction":"DESC"},{"property":"playerId","direction":"ASC"}]'
      ),
      satCountsStats: getUrl(
        "summaryshooting",
        '[{"property":"satTotal","direction":"DESC"},{"property":"usatTotal","direction":"DESC"},{"property":"playerId","direction":"ASC"}]'
      ),
      satPercentagesStats: getUrl(
        "percentages",
        '[{"property":"satPercentage","direction":"DESC"},{"property":"playerId","direction":"ASC"}]'
      ),
      scoringRatesStats: getUrl(
        "scoringRates",
        '[{"property":"pointsPer605v5","direction":"DESC"},{"property":"goalsPer605v5","direction":"DESC"},{"property":"playerId","direction":"ASC"}]'
      ),
      scoringPerGameStats: getUrl(
        "scoringpergame",
        '[{"property":"pointsPerGame","direction":"DESC"},{"property":"goalsPerGame","direction":"DESC"},{"property":"playerId","direction":"ASC"}]'
      ),
      shotTypeStats: getUrl(
        "shottype",
        '[{"property":"shootingPct","direction":"DESC"},{"property":"shootingPctBat","direction":"DESC"},{"property":"playerId","direction":"ASC"}]'
      ),
      timeOnIceStats: getUrl(
        "timeonice",
        '[{"property":"timeOnIce","direction":"DESC"},{"property":"playerId","direction":"ASC"}]'
      )
    };
    const responses = await Promise.all(
      Object.values(urls).map((url) =>
        Fetch(url).then((res) => res.json() as Promise<NHLApiResponse>)
      )
    );
    const [
      skaterStatsResponse,
      bioStatsResponse,
      miscSkaterStatsResponse,
      faceOffStatsResponse,
      faceoffWinLossResponse,
      goalsForAgainstResponse,
      penaltiesResponse,
      penaltyKillResponse,
      powerPlayResponse,
      puckPossessionResponse,
      satCountsResponse,
      satPercentagesResponse,
      scoringRatesResponse,
      scoringPerGameResponse,
      shotTypeResponse,
      timeOnIceResponse
    ] = responses;
    allData.skaterStats.push(...skaterStatsResponse.data);
    allData.skatersBio.push(...bioStatsResponse.data);
    allData.miscSkaterStats.push(...miscSkaterStatsResponse.data);
    allData.faceOffStats.push(...faceOffStatsResponse.data);
    allData.faceoffWinLossStats.push(...faceoffWinLossResponse.data);
    allData.goalsForAgainstStats.push(...goalsForAgainstResponse.data);
    allData.penaltiesStats.push(...penaltiesResponse.data);
    allData.penaltyKillStats.push(...penaltyKillResponse.data);
    allData.powerPlayStats.push(...powerPlayResponse.data);
    allData.puckPossessionStats.push(...puckPossessionResponse.data);
    allData.satCountsStats.push(...satCountsResponse.data);
    allData.satPercentagesStats.push(...satPercentagesResponse.data);
    allData.scoringRatesStats.push(...scoringRatesResponse.data);
    allData.scoringPerGameStats.push(...scoringPerGameResponse.data);
    allData.shotTypeStats.push(...shotTypeResponse.data);
    allData.timeOnIceStats.push(...timeOnIceResponse.data);
    moreDataAvailable = responses.some((res) => res.data.length === limit);
    start += limit;
  }
  return allData;
}

async function processAndUpsertGameTypeData(
  allData: AllSkaterStats,
  tableName: "wgo_skater_stats" | "wgo_skater_stats_playoffs",
  formattedDate: string,
  seasonId?: number
): Promise<number> {
  if (allData.skaterStats.length === 0) return 0;

  const dataMaps: DataMaps = {
    bioMap: new Map(allData.skatersBio.map((s) => [s.playerId, s])),
    miscMap: new Map(allData.miscSkaterStats.map((s) => [s.playerId, s])),
    faceOffMap: new Map(allData.faceOffStats.map((s) => [s.playerId, s])),
    faceoffWinLossMap: new Map(
      allData.faceoffWinLossStats.map((s) => [s.playerId, s])
    ),
    goalsForAgainstMap: new Map(
      allData.goalsForAgainstStats.map((s) => [s.playerId, s])
    ),
    penaltiesMap: new Map(allData.penaltiesStats.map((s) => [s.playerId, s])),
    penaltyKillMap: new Map(
      allData.penaltyKillStats.map((s) => [s.playerId, s])
    ),
    powerPlayMap: new Map(allData.powerPlayStats.map((s) => [s.playerId, s])),
    puckPossessionMap: new Map(
      allData.puckPossessionStats.map((s) => [s.playerId, s])
    ),
    satCountsMap: new Map(allData.satCountsStats.map((s) => [s.playerId, s])),
    satPercentagesMap: new Map(
      allData.satPercentagesStats.map((s) => [s.playerId, s])
    ),
    scoringRatesMap: new Map(
      allData.scoringRatesStats.map((s) => [s.playerId, s])
    ),
    scoringPerGameMap: new Map(
      allData.scoringPerGameStats.map((s) => [s.playerId, s])
    ),
    shotTypeMap: new Map(allData.shotTypeStats.map((s) => [s.playerId, s])),
    timeOnIceMap: new Map(allData.timeOnIceStats.map((s) => [s.playerId, s]))
  };

  const recordsToUpsert: SkaterDbRecord[] = allData.skaterStats.map((stat) =>
    mapApiDataToDbRecord(stat, dataMaps, formattedDate, seasonId)
  );

  if (recordsToUpsert.length > 0) {
    const CHUNK_SIZE = 100;
    for (let i = 0; i < recordsToUpsert.length; i += CHUNK_SIZE) {
      const chunk = recordsToUpsert.slice(i, i + CHUNK_SIZE);

      const { error } = await supabase.from(tableName).upsert(chunk, {
        onConflict: "player_id, date"
      });

      if (error) {
        console.error(
          `Error upserting chunk to ${tableName} for date ${formattedDate}:`,
          error
        );
        throw new Error(
          `Supabase upsert failed for ${tableName} (chunk starting at index ${i}): ${error.message}`
        );
      }
    }
  }
  return recordsToUpsert.length;
}

async function updateSkaterStats(date: string) {
  console.log(`Updating skater stats for ${date}`);
  const currentSeason = await getCurrentSeason();
  const seasonId = currentSeason.seasonId;

  // [*] OPTIMIZATION: Fetch regular season and playoff data in parallel for the same day.
  const [regularSeasonData, playoffData] = await Promise.all([
    fetchDataForGameType(2, date),
    fetchDataForGameType(3, date)
  ]);

  // [*] OPTIMIZATION: Process and upsert data in parallel as they are independent operations.
  const [regularSeasonUpdates, playoffUpdates] = await Promise.all([
    processAndUpsertGameTypeData(
      regularSeasonData,
      "wgo_skater_stats",
      date,
      seasonId
    ),
    processAndUpsertGameTypeData(playoffData, "wgo_skater_stats_playoffs", date)
  ]);

  const totalUpdates = regularSeasonUpdates + playoffUpdates;
  return {
    message: `Skater stats updated for ${date}. Regular Season: ${regularSeasonUpdates}, Playoffs: ${playoffUpdates}.`,
    success: true,
    totalUpdates
  };
}

async function getMostRecentDateFromDB(): Promise<string | null> {
  const { data, error } = await supabase
    .from("wgo_skater_stats")
    .select("date")
    .order("date", { ascending: false })
    .limit(1);
  if (error) {
    console.error("Error fetching most recent date:", error);
    return null;
  }
  return data && data.length > 0 ? data[0].date : null;
}

async function updateAllSkatersFromMostRecentDate(
  fullRefresh: boolean = false
) {
  let startDate: Date;
  const today = new Date();
  const currentSeason = await getCurrentSeason();
  if (fullRefresh) {
    startDate = parseISO(currentSeason.regularSeasonStartDate);
    console.log(
      "Full refresh: Starting from season start date:",
      formatISO(startDate, { representation: "date" })
    );
  } else {
    const mostRecentDate = await getMostRecentDateFromDB();
    if (mostRecentDate) {
      startDate = addDays(parseISO(mostRecentDate), 1);
      console.log(
        "Incremental update: Starting from",
        formatISO(startDate, { representation: "date" })
      );
    } else {
      startDate = parseISO(currentSeason.regularSeasonStartDate);
      console.log(
        "No existing data: Starting from season start date:",
        formatISO(startDate, { representation: "date" })
      );
    }
  }

  const endDate = today;
  let totalUpdates = 0;
  const datesProcessed: string[] = [];
  const failedDates: string[] = []; // Now collects dates that failed ALL retry attempts
  let currentDate = startDate;

  // --- NEW: Retry Constants ---
  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 2000; // 2 seconds

  if (isBefore(endDate, startDate)) {
    return {
      message: "Database is already up to date.",
      success: true,
      totalUpdates: 0,
      datesProcessed: [],
      failedDates: []
    };
  }

  console.log(
    `Processing dates from ${formatISO(startDate, {
      representation: "date"
    })} to ${formatISO(endDate, { representation: "date" })}`
  );

  while (
    isBefore(currentDate, endDate) ||
    currentDate.toDateString() === endDate.toDateString()
  ) {
    const formattedDate = formatISO(currentDate, { representation: "date" });
    let success = false;

    // --- NEW: Immediate Retry Loop ---
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(
          `Processing skater stats for ${formattedDate} (Attempt ${attempt})...`
        );
        const result = await updateSkaterStats(formattedDate);
        totalUpdates += result.totalUpdates;
        datesProcessed.push(formattedDate);
        success = true;
        break; // Succeeded, exit the retry loop and move to the next date
      } catch (error: any) {
        console.error(
          `Attempt ${attempt} failed for ${formattedDate}: ${error.message}`
        );
        if (attempt < MAX_RETRIES) {
          console.log(`Waiting ${RETRY_DELAY_MS}ms before next attempt...`);
          await sleep(RETRY_DELAY_MS);
        }
      }
    }

    if (!success) {
      console.error(
        `All ${MAX_RETRIES} attempts failed for ${formattedDate}. Adding to final failed list.`
      );
      failedDates.push(formattedDate);
    }

    currentDate = addDays(currentDate, 1);
  }

  // This final logging is still useful to report on dates that could not be processed at all.
  if (failedDates.length > 0) {
    console.error(
      `--- Could not process ${failedDates.length} dates after all retries: ${failedDates.join(", ")} ---`
    );
  }

  return {
    message: `All skater stats updated successfully. Processed ${datesProcessed.length} dates with ${totalUpdates} total updates.`,
    success: true,
    totalUpdates,
    datesProcessed,
    failedDates // This list now contains only the dates that failed all retries
  };
}

async function getAllSeasonsFromDB(): Promise<
  { seasonId: number; startDate: string; endDate: string }[]
> {
  console.log("Fetching all seasons from the 'seasons' database table...");

  const { data, error } = await supabase
    .from("seasons")
    .select("id, startDate, endDate")
    .order("startDate", { ascending: true });

  if (error) {
    console.error("Error fetching seasons from database:", error);
    throw new Error(`Failed to fetch seasons from Supabase: ${error.message}`);
  }

  if (!data || data.length === 0) {
    console.warn("No seasons found in the 'seasons' table.");
    return [];
  }

  console.log(`Found ${data.length} seasons to process.`);

  return data.map((season) => ({
    seasonId: season.id,
    startDate: season.startDate,
    endDate: season.endDate
  }));
}

/**
 * [NEW HELPER] Processes all data for a single date. Encapsulates logic for reuse in the main and retry loops.
 * Throws an error on failure, which is caught by the calling function.
 * @returns The total number of player records updated for the date.
 */
async function processDate(
  formattedDate: string,
  seasonId: number
): Promise<number> {
  console.log(`Processing date: ${formattedDate} for season ${seasonId}`);

  // 1. Fetch data for both game types in parallel
  const [regularSeasonData, playoffData] = await Promise.all([
    fetchDataForGameType(2, formattedDate),
    fetchDataForGameType(3, formattedDate)
  ]);

  // 2. Upsert data for both game types in parallel
  const [regularSeasonUpdates, playoffUpdates] = await Promise.all([
    processAndUpsertGameTypeData(
      regularSeasonData,
      "wgo_skater_stats",
      formattedDate,
      seasonId
    ),
    processAndUpsertGameTypeData(
      playoffData,
      "wgo_skater_stats_playoffs",
      formattedDate
      // Note: Playoff data typically doesn't need a seasonId if your schema doesn't require it,
      // as playoffs are implicitly tied to the season they conclude.
    )
  ]);

  const dailyUpdates = regularSeasonUpdates + playoffUpdates;
  if (dailyUpdates > 0) {
    console.log(
      `Completed ${formattedDate}: ${dailyUpdates} player records updated.`
    );
  }
  return dailyUpdates;
}

/**
 * [OPTIMIZED & ROBUST] Processes all historical stats for all seasons sequentially,
 * with a retry mechanism for failed dates.
 */
async function updateAllStatsForAllSeasons() {
  const allSeasons = await getAllSeasonsFromDB();
  let totalUpdates = 0;
  const failedDates: { date: string; seasonId: number }[] = [];

  if (allSeasons.length === 0) {
    return {
      message: "No seasons found in the database to refresh.",
      success: true,
      totalUpdates: 0
    };
  }

  console.log(`Starting full refresh for ${allSeasons.length} seasons.`);

  // --- NEW: Retry Constants ---
  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 2000; // 2 seconds

  for (const season of allSeasons) {
    console.log(
      `--- Processing Season: ${season.seasonId} (${season.startDate} to ${season.endDate}) ---`
    );
    let currentDate = parseISO(season.startDate);
    const endDate = parseISO(season.endDate);

    while (
      isBefore(currentDate, endDate) ||
      currentDate.toDateString() === endDate.toDateString()
    ) {
      const formattedDate = formatISO(currentDate, { representation: "date" });
      let success = false;

      // --- NEW: Immediate Retry Loop ---
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          console.log(
            `Processing ${formattedDate} for season ${season.seasonId} (Attempt ${attempt})...`
          );
          const dailyUpdates = await processDate(
            formattedDate,
            season.seasonId
          );
          totalUpdates += dailyUpdates;
          success = true;
          break; // Succeeded, exit retry loop
        } catch (error: any) {
          console.error(
            `Attempt ${attempt} failed for ${formattedDate}: ${error.message}`
          );
          if (attempt < MAX_RETRIES) {
            console.log(`Waiting ${RETRY_DELAY_MS}ms before next attempt...`);
            await sleep(RETRY_DELAY_MS);
          }
        }
      }

      if (!success) {
        console.error(
          `All ${MAX_RETRIES} attempts for ${formattedDate} failed. Adding to final failed list.`
        );
        failedDates.push({ date: formattedDate, seasonId: season.seasonId });
      }

      currentDate = addDays(currentDate, 1);
    }
  }

  // The final report on permanently failed dates.
  if (failedDates.length > 0) {
    console.error(
      `\n--- SUMMARY: ${failedDates.length} dates could not be processed after all retries: ${failedDates.map((f) => f.date).join(", ")} ---\n`
    );
  }

  const message = `All-time refresh complete. Processed ${allSeasons.length} seasons with a total of ${totalUpdates} updates.`;
  console.log(message);
  return {
    message,
    success: true,
    totalUpdates,
    failedDates: failedDates.map((f) => f.date)
  };
}

async function fetchDataForPlayer(playerId: string, playerName: string) {
  console.log(`Fetching data for player ${playerName} (${playerId})`);
  const today = new Date();
  const formattedDate = formatISO(today, { representation: "date" });
  const currentSeason = await getCurrentSeason();

  const seasonStartDate = currentSeason.regularSeasonStartDate;

  const fetchPlayerDataForGameType = async (gameTypeId: number) => {
    const cayenneExp = `gameDate<="${formattedDate} 23:59:59" and gameDate>="${seasonStartDate}" and gameTypeId=${gameTypeId} and playerId=${playerId}`;
    const url = `https://api.nhle.com/stats/rest/en/skater/summary?isAggregate=true&isGame=false&sort=[{"property":"points","direction":"DESC"}]&factCayenneExp=gamesPlayed>=1&cayenneExp=${encodeURIComponent(cayenneExp)}`;
    const response = await Fetch(url).then(
      (res) => res.json() as Promise<NHLApiResponse>
    );
    return response.data;
  };
  const regularSeasonData = await fetchPlayerDataForGameType(2);
  const playoffData = await fetchPlayerDataForGameType(3);
  return { regularSeasonData, playoffData };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const jobName = "update-wgo-skaters";
  let status: "success" | "failure" = "success";
  let details: any = {};
  let totalUpdates = 0;

  try {
    const {
      date,
      playerId,
      action,
      fullRefresh: fullRefreshParam,
      playerFullName: rawPlayerFullName
    } = req.query;
    const fullRefresh = fullRefreshParam === "true" || fullRefreshParam === "1";
    const playerFullName = Array.isArray(rawPlayerFullName)
      ? rawPlayerFullName[0]
      : rawPlayerFullName;
    let result: any;

    if (action === "all_seasons_full_refresh") {
      console.log("Action 'all_seasons_full_refresh' triggered.");
      result = await updateAllStatsForAllSeasons();
      totalUpdates = result.totalUpdates;
      details = { message: result.message, failedDates: result.failedDates };
      res.status(200).json(result);
    } else if (action === "all") {
      console.log(`Action 'all' triggered. Full refresh: ${fullRefresh}`);
      result = await updateAllSkatersFromMostRecentDate(fullRefresh);
      totalUpdates = result.totalUpdates;
      details = {
        message: result.message,
        datesProcessed: result.datesProcessed,
        failedDates: result.failedDates,
        fullRefresh
      };
      res.status(200).json({ ...result, fullRefresh });
    } else if (date && typeof date === "string") {
      console.log(`Date parameter found: ${date}`);
      result = await updateSkaterStats(date);
      totalUpdates = result.totalUpdates;
      details = { message: result.message };
      res.status(200).json(result);
    } else if (playerId && typeof playerId === "string") {
      console.log(`Player ID parameter found: ${playerId}`);
      const name = playerFullName || `PlayerID ${playerId}`;
      const resultData = await fetchDataForPlayer(playerId, name);
      result = {
        message: `Data fetched successfully for player ${name}.`,
        success: true,
        data: resultData
      };
      details = { message: result.message, playerId };
      res.status(200).json(result);
    } else {
      status = "failure";
      details = {
        message:
          "Missing or invalid parameters. Provide 'action=all_seasons_full_refresh', 'action=all', 'date', or 'playerId'."
      };
      res.status(400).json(details);
    }
  } catch (e: any) {
    console.error("Handler error:", e);
    status = "failure";
    details = { error: e.message, stack: e.stack };
    res.status(500).json(details);
  } finally {
    if (req.query.action) {
      // Only log cron jobs for actions
      await supabase.from("cron_job_audit").insert({
        job_name: jobName,
        status: status,
        rows_affected: totalUpdates,
        details: details
      });
    }
  }
}
