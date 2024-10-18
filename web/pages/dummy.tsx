import React, { useEffect, useState } from "react";
import supabase from "lib/supabase"; // Adjust the import path if necessary
import styles from "styles/DummyPage.module.scss";
import { StrengthEnum } from "../components/GameGrid/PDHC/types";

// Define strengths using StrengthEnum values
const strengths: readonly StrengthEnum[] = [
  StrengthEnum.ALL,
  StrengthEnum.FIVE_V_FIVE,
  StrengthEnum.PP,
  StrengthEnum.PK,
] as const;

// Define the TeamScores type to match the view
type TeamScores = {
  team_abbreviation: string;
  team_name: string;
  gp: number;
  w_per_game: number;
  l_per_game: number;
  otl_per_game: number;
  points_per_game: number;
  att_score_all: number;
  def_score_all: number;
  att_score_5v5: number;
  def_score_5v5: number;
  att_score_pp: number;
  def_score_pp: number;
  att_score_pk: number;
  def_score_pk: number;
};

// Update the TeamsState type
type TeamsState = {
  [key: string]: {
    general: {
      team_abbreviation: string;
      team_name: string;
      gp: number;
      w_per_game: number;
      l_per_game: number;
      otl_per_game: number;
      points_per_game: number;
    };
    attScores: Record<StrengthEnum, number>;
    defScores: Record<StrengthEnum, number>;
    toi: Record<StrengthEnum, number>;
  };
};

const DummyPage: React.FC = () => {
  const [teams, setTeams] = useState<TeamsState>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch data from Supabase
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch team scores with attack and defense scores for all strengths
        const { data: scoresData, error: scoresError } = await supabase
          .from("nst_team_scores_all_strengths")
          .select("*");

        if (scoresError) throw scoresError;

        // Fetch TOI data for each strength
        const [
          { data: allTOIData, error: allTOIError },
          { data: fiveV5TOIData, error: fiveV5TOIError },
          { data: ppTOIData, error: ppTOIError },
          { data: pkTOIData, error: pkTOIError },
        ] = await Promise.all([
          supabase
            .from("nst_all_team_per_game")
            .select("team_abbreviation, toi_per_game"),
          supabase
            .from("nst_5v5_team_per_game")
            .select("team_abbreviation, toi_per_game"),
          supabase
            .from("nst_pp_team_per_game")
            .select("team_abbreviation, toi_per_game"),
          supabase
            .from("nst_pk_team_per_game")
            .select("team_abbreviation, toi_per_game"),
        ]);

        if (allTOIError) throw allTOIError;
        if (fiveV5TOIError) throw fiveV5TOIError;
        if (ppTOIError) throw ppTOIError;
        if (pkTOIError) throw pkTOIError;

        // Organize fetched data
        const fetchedTeams = scoresData as TeamScores[];

        // Create a mapping of team abbreviation to TOI data
        const allTOIMap = new Map(
          allTOIData.map((item) => [item.team_abbreviation, item.toi_per_game])
        );
        const fiveV5TOIMap = new Map(
          fiveV5TOIData.map((item) => [
            item.team_abbreviation,
            item.toi_per_game,
          ])
        );
        const ppTOIMap = new Map(
          ppTOIData.map((item) => [item.team_abbreviation, item.toi_per_game])
        );
        const pkTOIMap = new Map(
          pkTOIData.map((item) => [item.team_abbreviation, item.toi_per_game])
        );

        // Process and set the state
        const processedTeams: TeamsState = {};

        fetchedTeams.forEach((teamData) => {
          const key = teamData.team_abbreviation;
          processedTeams[key] = {
            general: {
              team_abbreviation: teamData.team_abbreviation,
              team_name: teamData.team_name,
              gp: teamData.gp,
              w_per_game: teamData.w_per_game,
              l_per_game: teamData.l_per_game,
              otl_per_game: teamData.otl_per_game,
              points_per_game: teamData.points_per_game,
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
            toi: {
              [StrengthEnum.ALL]: allTOIMap.get(key) || 0,
              [StrengthEnum.FIVE_V_FIVE]: fiveV5TOIMap.get(key) || 0,
              [StrengthEnum.PP]: ppTOIMap.get(key) || 0,
              [StrengthEnum.PK]: pkTOIMap.get(key) || 0,
            },
          };
        });

        setTeams(processedTeams);
      } catch (err: any) {
        console.error("Error fetching data:", err.message);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Display loading or error states
  if (loading) return <div className={styles.loading}>Loading data...</div>;
  if (error) return <div className={styles.error}>Error: {error}</div>;

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>
        Dummy Page - Team Attack & Defense Ratings
      </h1>
      {!loading && !error && (
        <>
          {/* Attack and Defense Scores */}
          <div className={styles.scoresContainer}>
            <h2>Team Attack & Defense Scores</h2>
            <table className={styles.scoreTable}>
              <thead>
                <tr>
                  <th>Team</th>
                  {strengths.flatMap((strength) => [
                    <th key={`${strength}-toi`}>TOI ({strength})</th>,
                    <th key={`${strength}-att`}>attScore ({strength})</th>,
                    <th key={`${strength}-def`}>defScore ({strength})</th>,
                  ])}
                </tr>
              </thead>
              <tbody>
                {Object.values(teams).map((team) => (
                  <tr key={`score-${team.general.team_abbreviation}`}>
                    <td>
                      {team.general.team_abbreviation} -{" "}
                      {team.general.team_name}
                    </td>
                    {strengths.map((strength) => (
                      <React.Fragment
                        key={`${team.general.team_abbreviation}-${strength}`}
                      >
                        <td>
                          {team.toi[strength] !== null &&
                          team.toi[strength] !== undefined
                            ? team.toi[strength].toFixed(2)
                            : "N/A"}
                        </td>
                        <td
                          className={
                            team.attScores[strength] > 0
                              ? styles.positive
                              : team.attScores[strength] < 0
                              ? styles.negative
                              : ""
                          }
                        >
                          {team.attScores[strength] !== null &&
                          team.attScores[strength] !== undefined
                            ? team.attScores[strength].toFixed(2)
                            : "N/A"}
                        </td>
                        <td
                          className={
                            team.defScores[strength] > 0
                              ? styles.positive
                              : team.defScores[strength] < 0
                              ? styles.negative
                              : ""
                          }
                        >
                          {team.defScores[strength] !== null &&
                          team.defScores[strength] !== undefined
                            ? (team.defScores[strength] * -1).toFixed(2)
                            : "N/A"}
                        </td>
                      </React.Fragment>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default DummyPage;
