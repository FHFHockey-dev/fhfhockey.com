// /pages/StatsPage.tsx

import React from "react";
import styles from "styles/Stats.module.scss";
import LeaderboardCategory from "components/StatsPage/LeaderboardCategory";
import LeaderboardCategoryBSH from "components/StatsPage/LeaderboardCategoryBSH";
import LeaderboardCategoryGoalie from "components/StatsPage/LeaderboardCategoryGoalie";
import { StatsProps } from "lib/NHL/statsPageTypes";
import { fetchStatsData } from "lib/NHL/statsPageFetch";
import PlayerSearchBar from "components/StatsPage/PlayerSearchBar";
import Link from "next/link";
import supabase from "lib/supabase";
import { getCurrentSeason } from "lib/NHL/client";
import { getTeamAbbreviationById, getTeamInfoById } from "lib/teamsInfo";
import { getTeams } from "lib/NHL/server";

interface TeamListItem {
  team_id: number;
  name: string;
  abbreviation: string;
}

export default function StatsPage({
  pointsLeaders,
  goalsLeaders,
  pppLeaders,
  bshLeaders,
  goalieLeadersWins,
  goalieLeadersSavePct,
  goalieLeadersGAA,
  goalieLeadersQS,
  teams = []
}: StatsProps & { teams: TeamListItem[] }) {
  return (
    <div className={styles.container}>
      <PlayerSearchBar />
      <div className={styles.teamsSection}>
        <h2 className={styles.teamsTitle}>Teams</h2>
        <div className={styles.teamList}>
          {teams.map((team) => (
            <Link
              key={team.team_id}
              href={`/stats/team/${team.abbreviation}`}
              className={styles.teamListItem}
              title={team.name}
            >
              <img
                src={`/teamLogos/${team.abbreviation}.png`}
                alt={team.name}
                className={styles.teamLogo}
                loading="lazy"
              />
              <span className={styles.teamAbbreviation}>
                {team.abbreviation}
              </span>
              <span className={styles.teamName}></span>
            </Link>
          ))}
        </div>
      </div>
      <div className={styles.leaderboardsContainer}>
        <h1 className={styles.title}>Skater Leaderboards</h1>
        <div className={styles.grid}>
          <LeaderboardCategory
            title="Points"
            leaders={pointsLeaders}
            statKey="points"
          />
          <LeaderboardCategory
            title="Goals"
            leaders={goalsLeaders}
            statKey="goals"
          />
          <LeaderboardCategory
            title="PPP"
            leaders={pppLeaders}
            statKey="pp_points"
          />
          <LeaderboardCategoryBSH title="BSH" leaders={bshLeaders} />
        </div>
        <h1 className={styles.title}>Goalie Leaderboards</h1>
        <div className={styles.grid}>
          <LeaderboardCategoryGoalie
            title="Wins"
            leaders={goalieLeadersWins}
            statKey="wins"
          />
          <LeaderboardCategoryGoalie
            title="Save %"
            leaders={goalieLeadersSavePct}
            statKey="save_pct"
          />
          <LeaderboardCategoryGoalie
            title="GAA"
            leaders={goalieLeadersGAA}
            statKey="goals_against_avg"
          />
          <LeaderboardCategoryGoalie
            title="QS %"
            leaders={goalieLeadersQS}
            statKey="quality_starts_pct"
          />
        </div>
      </div>
    </div>
  );
}

export async function getServerSideProps() {
  const data = await fetchStatsData();

  // Get teams for the current season using the existing getTeams function
  try {
    const teams = await getTeams();
    // Map to the expected format
    const formattedTeams = teams.map((team) => ({
      team_id: team.id,
      name: team.name,
      abbreviation:
        team.abbreviation?.trim() ||
        getTeamAbbreviationById(team.id) ||
        team.name
    }));

    // Sort alphabetically by abbreviation
    formattedTeams.sort((a, b) =>
      (a?.abbreviation ?? "").localeCompare(b?.abbreviation ?? "")
    );

    return { props: { ...data, teams: formattedTeams } };
  } catch (error) {
    console.error("Error fetching teams:", error);
    return { props: { ...data, teams: [] } };
  }
}
