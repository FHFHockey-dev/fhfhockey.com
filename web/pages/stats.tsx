// /pages/StatsPage.tsx

import React from "react";
import styles from "styles/Stats.module.scss";
import LeaderboardCategory from "components/StatsPage/LeaderboardCategory";
import LeaderboardCategoryBSH from "components/StatsPage/LeaderboardCategoryBSH";
import LeaderboardCategoryGoalie from "components/StatsPage/LeaderboardCategoryGoalie";
import { StatsProps } from "lib/NHL/statsPageTypes";
import { fetchStatsData } from "lib/NHL/statsPageFetch";

export default function StatsPage({
  pointsLeaders,
  goalsLeaders,
  pppLeaders,
  bshLeaders,
  goalieLeadersWins,
  goalieLeadersSavePct,
  goalieLeadersGAA,
  goalieLeadersQS
}: StatsProps) {
  return (
    <div className={styles.container}>
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
  );
}

export async function getServerSideProps() {
  const data = await fetchStatsData();
  return { props: data };
}
