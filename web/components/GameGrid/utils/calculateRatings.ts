// components/GameGrid/utils/calculateRatings.ts

import supabase from "lib/supabase";
import { StrengthEnum, TeamsState, TeamScores } from "../PDHC/types";

/**
 * Fetches attack and defense scores along with TOI_diff data for each team from `nst_att_def_scores`.
 * Also fetches league average goals from `nst_league_averages`.
 * @returns An object containing team scores, TOI_diff data, and league average goals.
 */
export const fetchTeamScoresAndTOI = async (): Promise<{
  teams: TeamsState;
  leagueAvgGoalsFor: number;
}> => {
  console.log("Starting fetchTeamScoresAndTOI...");

  try {
    // Fetch data from `nst_att_def_scores`
    const { data: scoresData, error: scoresError } = await supabase
      .from("nst_att_def_scores")
      .select("*");

    if (scoresError) throw scoresError;

    // Fetch league average goals from `nst_league_averages` where strength = 'all_per_game'
    const { data: leagueAvgData, error: leagueAvgError } = await supabase
      .from("nst_league_averages")
      .select("gf")
      .eq("strength", "all_per_game")
      .single(); // only one row for 'all_per_game'

    if (leagueAvgError) throw leagueAvgError;

    const leagueAvgGoalsFor = leagueAvgData.gf;

    // Process and set the state
    const teams: TeamsState = {};

    (scoresData as TeamScores[]).forEach((teamData) => {
      const key = teamData.team_id; // Keyed by team_id (number)
      teams[key] = {
        general: {
          team_abbreviation: teamData.team_abbreviation,
          team_name: teamData.team_name,
          gp: teamData.gp,
          w_per_game: teamData.w_per_game,
          l_per_game: teamData.l_per_game,
          otl_per_game: teamData.otl_per_game,
          points_per_game: teamData.points_per_game,
          logo: teamData.logo,
        },
        attScores: {
          [StrengthEnum.ALL]: teamData.att_score_all,
          [StrengthEnum.FIVE_V_FIVE]: teamData.att_score_5v5,
          [StrengthEnum.PP]: teamData.att_score_pp,
          [StrengthEnum.PK]: teamData.att_score_pk,
        },
        defScores: {
          [StrengthEnum.ALL]: teamData.def_score_all,
          [StrengthEnum.FIVE_V_FIVE]: teamData.def_score_5v5,
          [StrengthEnum.PP]: teamData.def_score_pp,
          [StrengthEnum.PK]: teamData.def_score_pk,
        },
        toi_diff: {
          [StrengthEnum.ALL]: teamData.all_toi_diff,
          [StrengthEnum.FIVE_V_FIVE]: teamData["5v5_toi_diff"],
          [StrengthEnum.PP]: teamData.pp_toi_diff,
          [StrengthEnum.PK]: teamData.pk_toi_diff,
        },
      };
    });

    console.log("Completed fetchTeamScoresAndTOI.");

    return { teams, leagueAvgGoalsFor };
  } catch (error: any) {
    console.error("Error in fetchTeamScoresAndTOI:", error);
    throw error;
  }
};
