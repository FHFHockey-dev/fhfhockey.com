import React from "react";
import supabase from "lib/supabase";
import { getCurrentSeason } from "lib/NHL/server";
import styles from "styles/Stats.module.scss";

/* Database row types. Now includes pp_goals, sh_goals. */
interface WgoSkaterStatsTotalsRow {
  player_id: number;
  player_name: string;
  season: string;
  current_team_abbreviation: string;
  points: number;
  goals: number;
  pp_points: number;
  blocked_shots: number;
  shots: number;
  hits: number;
  total_primary_assists: number;
  total_secondary_assists: number;

  /* Additional columns for goals: */
  pp_goals: number;
  sh_goals: number;
}

interface PlayerRow {
  id: number;
  sweater_number: number | null;
  position: string;
  image_url: string | null;
}

/* Merged UI type */
export type SkaterStat = {
  player_id: number;
  fullName: string;
  current_team_abbreviation: string;

  points: number;
  goals: number;
  pp_points: number;
  blocked_shots: number;
  shots: number;
  hits: number;

  /* For "Points" bar. */
  total_primary_assists: number;
  total_secondary_assists: number;

  /* For "Goals" bar. */
  pp_goals: number;
  sh_goals: number;

  /* BSH, etc. */
  bsh: number;

  /* Player info. */
  image_url: string;
  sweater_number?: number | null;
  position?: string | null;
};

type StatsProps = {
  pointsLeaders: SkaterStat[];
  goalsLeaders: SkaterStat[];
  pppLeaders: SkaterStat[];
  bshLeaders: SkaterStat[];
};

export default function StatsPage({
  pointsLeaders,
  goalsLeaders,
  pppLeaders,
  bshLeaders
}: StatsProps) {
  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Skater Leaderboards</h1>
      <div className={styles.grid}>
        {/* "Points" card */}
        <LeaderboardCategory
          title="Points"
          leaders={pointsLeaders}
          statKey="points"
        />

        {/* "Goals" card */}
        <LeaderboardCategory
          title="Goals"
          leaders={goalsLeaders}
          statKey="goals"
        />

        {/* "PPP" card */}
        <LeaderboardCategory
          title="PPP"
          leaders={pppLeaders}
          statKey="pp_points"
        />

        {/* "BSH" card */}
        <LeaderboardCategoryBSH title="BSH" leaders={bshLeaders} />
      </div>
    </div>
  );
}

/**
 * A generic leaderboard category.
 *  - For "Points": show G/A1/A2 bar.
 *  - For "Goals": show ESG/PPG/SHG bar.
 */
function LeaderboardCategory({
  title,
  leaders,
  statKey
}: {
  title: string;
  leaders: SkaterStat[];
  statKey: keyof SkaterStat;
}) {
  return (
    <div className={styles.card}>
      <h2 className={styles.cardTitle}>{title}</h2>

      {leaders.map((player, index) => {
        let bar = null;

        if (title === "Points" && player.points > 0) {
          // POINTS bar: G / A1 / A2
          const goalsFlex = player.goals;
          const assistTotal = player.points - player.goals;
          const primaryFlex =
            assistTotal > 0 ? player.total_primary_assists : 0;
          const secondaryFlex =
            assistTotal > 0 ? player.total_secondary_assists : 0;

          bar = (
            <div className={styles.angledBarContainer}>
              <Segment
                flexValue={goalsFlex}
                color="#0583AD"
                label="G"
                isFirst={true}
                isLast={false}
              />
              <Segment
                flexValue={primaryFlex}
                color="#07aae2"
                label="A1"
                isFirst={false}
                isLast={false}
              />
              <Segment
                flexValue={secondaryFlex}
                color="#64caed"
                label="A2"
                isFirst={false}
                isLast={true}
              />
            </div>
          );
        } else if (title === "Goals" && player.goals > 0) {
          // GOALS bar: ESG / PPG / SHG
          // total = player.goals
          // ppg = player.pp_goals
          // shg = player.sh_goals
          // esg = total - ppg - shg
          const total = player.goals;
          const ppg = player.pp_goals;
          const shg = player.sh_goals;
          const esg = total - ppg - shg;

          // only show bar if total > 0
          if (total > 0) {
            bar = (
              <div className={styles.angledBarContainer}>
                <Segment
                  flexValue={esg}
                  color="#0583AD"
                  label="ESG"
                  isFirst={true}
                  isLast={false}
                />
                <Segment
                  flexValue={ppg}
                  color="#07aae2"
                  label="PPG"
                  isFirst={false}
                  isLast={false}
                />
                <Segment
                  flexValue={shg}
                  color="#64caed"
                  label="SHG"
                  isFirst={false}
                  isLast={true}
                />
              </div>
            );
          }
        }

        // The top row includes player's headshot
        return index === 0 ? (
          <div key={player.player_id} className={styles.topLeaderRow}>
            <img
              src={
                player.image_url ||
                `https://cms.nhl.bamgrid.com/images/headshots/current/168x168/${player.player_id}@2x.jpg`
              }
              alt={player.fullName}
              className={styles.playerHeadshot}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
            <div className={styles.topLeaderDetails}>
              <div className={styles.leaderName}>{player.fullName}</div>
              <div className={styles.playerDetails}>
                {player.current_team_abbreviation} &middot; #
                {player.sweater_number} &middot; {player.position}
              </div>
              {bar}
            </div>
            <div className={styles.leaderValue}>{player[statKey]}</div>
          </div>
        ) : (
          <div key={player.player_id} className={styles.leaderRow}>
            <div className={styles.leaderName}>
              {player.fullName}
              {bar && <div className={styles.leaderBarSmall}>{bar}</div>}
            </div>
            <div className={styles.leaderValue}>{player[statKey]}</div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * A single trapezoid-based segment, same as your existing approach.
 */
function Segment({
  flexValue,
  color,
  label,
  isFirst,
  isLast
}: {
  flexValue: number;
  color: string;
  label: string;
  isFirst: boolean;
  isLast: boolean;
}) {
  if (flexValue <= 0) return null;

  return (
    <div className={styles.segmentContainer} style={{ flex: flexValue }}>
      {/* The rectangular core */}
      <div className={styles.segmentCore} style={{ backgroundColor: color }}>
        <span className={styles.segmentLabel}>{label}</span>
      </div>

      {/* Left angled shape if not first */}
      {!isFirst && (
        <div
          className={styles.leftTriangle}
          style={{ borderBottomColor: color }}
        />
      )}

      {/* Right angled shape if not last */}
      {!isLast && (
        <div
          className={styles.rightTriangle}
          style={{ borderTopColor: color }}
        />
      )}
    </div>
  );
}

/* 
  BSH category: simpler, no bar
*/
function LeaderboardCategoryBSH({
  title,
  leaders
}: {
  title: string;
  leaders: SkaterStat[];
}) {
  return (
    <div className={styles.card}>
      <h2 className={styles.cardTitle}>{title}</h2>
      {leaders.map((player, index) =>
        index === 0 ? (
          <div key={player.player_id} className={styles.topLeaderRow}>
            <img
              src={
                player.image_url ||
                `https://cms.nhl.bamgrid.com/images/headshots/current/168x168/${player.player_id}@2x.jpg`
              }
              alt={player.fullName}
              className={styles.playerHeadshot}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
            <div className={styles.topLeaderDetails}>
              <div className={styles.leaderName}>{player.fullName}</div>
              <div className={styles.playerDetails}>
                {player.current_team_abbreviation} &middot; #
                {player.sweater_number} &middot; {player.position}
              </div>
            </div>
            <div className={styles.leaderValue}>{player.bsh}</div>
          </div>
        ) : (
          <div key={player.player_id} className={styles.leaderRow}>
            <div className={styles.leaderName}>{player.fullName}</div>
            <div className={styles.leaderValue}>{player.bsh}</div>
          </div>
        )
      )}
    </div>
  );
}

/* Server-side data fetching */
export async function getServerSideProps() {
  const currentSeason = await getCurrentSeason();

  // Make sure you select pp_goals, sh_goals for the "Goals" bar
  const { data, error } = await supabase
    .from("wgo_skater_stats_totals")
    .select(
      `
      player_id,
      player_name,
      current_team_abbreviation,
      points,
      goals,
      pp_points,
      blocked_shots,
      shots,
      hits,
      total_primary_assists,
      total_secondary_assists,
      pp_goals,
      sh_goals
      `
    )
    .eq("season", String(currentSeason.seasonId));

  if (error || !data || !Array.isArray(data)) {
    console.error("Error fetching skater stats:", error);
    return {
      props: {
        pointsLeaders: [],
        goalsLeaders: [],
        pppLeaders: [],
        bshLeaders: []
      }
    };
  }

  // fetch player info
  const playerIds = Array.from(new Set(data.map((row) => row.player_id)));
  const { data: playersData, error: playersError } = await supabase
    .from("players")
    .select("id, sweater_number, position, image_url")
    .in("id", playerIds);

  if (playersError || !playersData) {
    console.error("Error fetching player info:", playersError);
  }

  const playersMap = new Map<number, PlayerRow>();
  playersData?.forEach((p) => playersMap.set(p.id, p));

  // build our SkaterStat array
  const skaters: SkaterStat[] = data.map((row) => {
    const playerInfo = playersMap.get(row.player_id);
    // BSH is blocked_shots + shots + hits
    const bsh = (row.blocked_shots || 0) + (row.shots || 0) + (row.hits || 0);

    return {
      player_id: row.player_id,
      fullName: row.player_name ?? "Unknown",
      current_team_abbreviation: row.current_team_abbreviation ?? "",

      points: row.points ?? 0,
      goals: row.goals ?? 0,
      pp_points: row.pp_points ?? 0,
      blocked_shots: row.blocked_shots ?? 0,
      shots: row.shots ?? 0,
      hits: row.hits ?? 0,
      bsh,

      total_primary_assists: row.total_primary_assists ?? 0,
      total_secondary_assists: row.total_secondary_assists ?? 0,

      /* new columns for the "Goals" bar */
      pp_goals: row.pp_goals ?? 0,
      sh_goals: row.sh_goals ?? 0,

      image_url: playerInfo?.image_url || "",
      sweater_number: playerInfo?.sweater_number,
      position: playerInfo?.position
    };
  });

  // sort & slice top 5 for each category
  const pointsLeaders = [...skaters]
    .sort((a, b) => b.points - a.points)
    .slice(0, 5);
  const goalsLeaders = [...skaters]
    .sort((a, b) => b.goals - a.goals)
    .slice(0, 5);
  const pppLeaders = [...skaters]
    .sort((a, b) => b.pp_points - a.pp_points)
    .slice(0, 5);
  const bshLeaders = [...skaters].sort((a, b) => b.bsh - a.bsh).slice(0, 5);

  return {
    props: {
      pointsLeaders,
      goalsLeaders,
      pppLeaders,
      bshLeaders
    }
  };
}
