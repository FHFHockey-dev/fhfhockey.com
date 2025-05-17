import { GetServerSidePropsContext } from "next";
import supabase from "lib/supabase";
import { formatPercent, formatSeason } from "../../../utils/stats/formatters";
import styles from "styles/TeamStatsPage.module.scss";
import { getTeamAbbreviationById, getTeamInfoById } from "lib/teamsInfo";
import React, { useEffect } from "react";
import { drawHockeyRink } from "lib/drawHockeyRink";
import Image from "next/image";

interface TeamSeasonSummary {
  season_id: number;
  team_id: number;
  team_full_name: string;
  games_played: number;
  wins: number;
  losses: number;
  ot_losses: number;
  points: number;
  goals_for: number;
  goals_against: number;
  goals_for_per_game: number;
  goals_against_per_game: number;
  shots_for_per_game: number;
  shots_against_per_game: number;
  faceoff_win_pct: number;
  penalty_kill_pct: number;
  penalty_kill_net_pct: number;
  power_play_pct: number;
  power_play_net_pct: number;
  regulation_and_ot_wins: number;
  point_pct: number;
}

interface TeamColors {
  primary: string;
  secondary: string;
  jersey: string;
  accent: string;
  alt: string;
}

export default function TeamStatsPage({
  teamName,
  summaries,
  teamAbbreviation,
  teamColors
}: {
  teamName: string;
  summaries: TeamSeasonSummary[];
  teamAbbreviation: string;
  teamColors: TeamColors | null;
}) {
  useEffect(() => {
    drawHockeyRink("#rink-d3-container");
  }, []);

  return (
    <div
      className={styles.teamStatsPageContainer}
      style={
        teamColors
          ? ({
              "--primary-color": teamColors.primary,
              "--secondary-color": teamColors.secondary,
              "--jersey": teamColors.jersey,
              "--accent": teamColors.accent,
              "--alt": teamColors.alt
            } as React.CSSProperties)
          : undefined
      }
    >
      <div className={styles.teamHeader}>
        <div className={styles.teamLogoContainer}>
          <img
            src={`/teamLogos/${teamAbbreviation}.png`}
            alt={teamAbbreviation}
            className={styles.teamLogo}
          />
          <h2 className={styles.teamName}>{teamName}</h2>
        </div>
      </div>
      <div className={styles.teamStatsTableContainer}>
        <table className={styles.teamStatsTable}>
          <thead>
            <tr>
              <th>Season</th>
              <th>GP</th>
              <th>W</th>
              <th>L</th>
              <th>OTL</th>
              <th>PTS</th>
              <th>PTS%</th>
              <th>ROW</th>
              <th>GF</th>
              <th>GA</th>
              <th>GF/GP</th>
              <th>GA/GP</th>
              <th>SF/GP</th>
              <th>SA/GP</th>
              <th>FO%</th>
              <th>PP%</th>
              <th>PP Net%</th>
              <th>PK%</th>
              <th>PK Net%</th>
            </tr>
          </thead>
          <tbody>
            {summaries.map((row, idx) => (
              <tr key={idx}>
                <td>{formatSeason(row.season_id)}</td>
                <td>{row.games_played ?? "-"}</td>
                <td>{row.wins ?? "-"}</td>
                <td>{row.losses ?? "-"}</td>
                <td>{row.ot_losses ?? "-"}</td>
                <td>{row.points ?? "-"}</td>
                <td>{formatPercent(row.point_pct)}</td>
                <td>{row.regulation_and_ot_wins ?? "-"}</td>
                <td>{row.goals_for ?? "-"}</td>
                <td>{row.goals_against ?? "-"}</td>
                <td>{row.goals_for_per_game?.toFixed(2) ?? "-"}</td>
                <td>{row.goals_against_per_game?.toFixed(2) ?? "-"}</td>
                <td>{row.shots_for_per_game?.toFixed(1) ?? "-"}</td>
                <td>{row.shots_against_per_game?.toFixed(1) ?? "-"}</td>
                <td>{formatPercent(row.faceoff_win_pct)}</td>
                <td>{formatPercent(row.power_play_pct)}</td>
                <td>{formatPercent(row.power_play_net_pct)}</td>
                <td>{formatPercent(row.penalty_kill_pct)}</td>
                <td>{formatPercent(row.penalty_kill_net_pct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div id="rink-d3-container" className={styles.rinkContainer}></div>
    </div>
  );
}

export async function getServerSideProps(context: GetServerSidePropsContext) {
  const { teamId } = context.query;
  if (!teamId || Array.isArray(teamId)) {
    return { notFound: true };
  }
  const teamIdNum = Number(teamId);
  const { data } = await supabase
    .from("team_summary_years")
    .select("*")
    .eq("team_id", teamIdNum)
    .order("season_id", { ascending: false });

  if (!data || data.length === 0) {
    return { notFound: true };
  }

  // Get abbreviation
  const teamAbbreviation = getTeamAbbreviationById(teamIdNum) || "";
  const teamInfo = getTeamInfoById(teamIdNum);

  return {
    props: {
      teamName: data[0].team_full_name,
      summaries: data,
      teamAbbreviation,
      teamColors: teamInfo
        ? {
            primary: teamInfo.primaryColor,
            secondary: teamInfo.secondaryColor,
            jersey: teamInfo.jersey,
            accent: teamInfo.accent,
            alt: teamInfo.alt
          }
        : null
    }
  };
}
