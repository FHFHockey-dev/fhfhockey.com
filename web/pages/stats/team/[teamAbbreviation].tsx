import { GetServerSidePropsContext } from "next";
import supabase from "lib/supabase";
import { formatPercent, formatSeason } from "../../../utils/stats/formatters";
import styles from "styles/TeamStatsPage.module.scss";
import { getTeamAbbreviationById, getTeamInfoById } from "lib/teamsInfo";
import React, { useEffect, useState } from "react";
import Image from "next/image";
import useCurrentSeason from "hooks/useCurrentSeason";
import { useShotData, ShotDataFilters } from "hooks/useShotData";
import { ShotVisualization } from "components/ShotVisualization/ShotVisualization";
import { teamsInfo } from "lib/teamsInfo";

// Shot data interface
interface ShotData {
  xcoord: number;
  ycoord: number;
  typedesckey: string; // 'goal' or 'shot'
}

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
  const currentSeason = useCurrentSeason();
  const teamId = summaries[0]?.team_id;

  // State for event and game type filters
  const [filters, setFilters] = useState<ShotDataFilters>({
    eventTypes: ["goal", "shot-on-goal"],
    gameTypes: ["02"] // Regular season by default
  });

  // Use our custom hook to fetch shot data with filters
  const { shotData, opponentShotData, isLoading, error } = useShotData(
    teamId,
    currentSeason?.seasonId.toString(),
    filters
  );

  // Handle filter changes from the visualization component
  const handleFilterChange = (newFilters: ShotDataFilters) => {
    setFilters(newFilters);
  };

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

      {/* Add Event Visualization section with filtering */}
      <div className={styles.sectionTitle}>
        <h3>Event Visualization</h3>
        <p>
          Event data for the {currentSeason?.seasonId} season. Use the filters
          to select event types and game types to display.
        </p>
      </div>
      <div className={styles.shotVisualizationContainer}>
        <ShotVisualization
          shotData={shotData}
          opponentShotData={opponentShotData}
          isLoading={isLoading}
          onFilterChange={handleFilterChange}
          filters={filters}
          teamAbbreviation={teamAbbreviation}
        />
      </div>
      {error && (
        <div className={styles.errorMessage}>
          Error loading event data: {error.message}
        </div>
      )}
    </div>
  );
}

export async function getServerSideProps(context: GetServerSidePropsContext) {
  const { teamAbbreviation } = context.query;
  if (!teamAbbreviation || Array.isArray(teamAbbreviation)) {
    return { notFound: true };
  }
  // Look up team info by abbreviation
  const teamInfo = teamsInfo[teamAbbreviation as string];
  if (!teamInfo) {
    return { notFound: true };
  }
  const teamIdNum = teamInfo.id;
  const { data } = await supabase
    .from("team_summary_years")
    .select("*")
    .eq("team_id", teamIdNum)
    .order("season_id", { ascending: false });

  if (!data || data.length === 0) {
    return { notFound: true };
  }

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
