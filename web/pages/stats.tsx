import React from "react";
import supabase from "lib/supabase";
import { getCurrentSeason } from "lib/NHL/server";
import styles from "styles/Stats.module.scss";

/* --- Skater Interfaces & Types --- */
interface PlayerRow {
  id: number;
  sweater_number: number | null;
  position: string;
  image_url: string | null;
}

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
  bsh: number;
  total_primary_assists: number;
  total_secondary_assists: number;
  pp_goals: number;
  sh_goals: number;
  pp_primary_assists?: number;
  pp_secondary_assists?: number;
  image_url: string;
  sweater_number?: number | null;
  position?: string | null;
};

/* --- Goalie Interfaces & Types --- */

/* --- Goalie Player Row (for image lookup) --- */
interface GoaliePlayerRow {
  id: number;
  image_url: string | null;
  sweater_number: number | null;
}

export type GoalieStat = {
  goalie_id: number;
  fullName: string;
  current_team_abbreviation: string;
  wins: number;
  save_pct: number;
  goals_against_avg: number;
  quality_starts_pct: number;
  games_played: number;
  image_url: string;
  sweater_number?: number | null;
};

/* --- Props --- */
type StatsProps = {
  pointsLeaders: SkaterStat[];
  goalsLeaders: SkaterStat[];
  pppLeaders: SkaterStat[];
  bshLeaders: SkaterStat[];
  goalieLeadersWins: GoalieStat[];
  goalieLeadersSavePct: GoalieStat[];
  goalieLeadersGAA: GoalieStat[];
  goalieLeadersQS: GoalieStat[];
};

/* --- Main Component --- */
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

/* --- Skater Leaderboard Components --- */
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
        let bar: JSX.Element | null = null;
        if (title === "Points" && player.points > 0) {
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
                color="#07aae2"
                label="G"
                isFirst={true}
                isLast={false}
              />
              <Segment
                flexValue={primaryFlex}
                color="#F0AD4E"
                label="A1"
                isFirst={false}
                isLast={false}
              />
              <Segment
                flexValue={secondaryFlex}
                color="#D9534F"
                label="A2"
                isFirst={false}
                isLast={true}
              />
            </div>
          );
        } else if (title === "Goals" && player.goals > 0) {
          const total = player.goals;
          const ppg = player.pp_goals;
          const shg = player.sh_goals;
          const esg = total - ppg - shg;
          bar = (
            <div className={styles.angledBarContainer}>
              <Segment
                flexValue={esg}
                color="#07aae2"
                label="ESG"
                isFirst={true}
                isLast={false}
              />
              <Segment
                flexValue={ppg}
                color="#F0AD4E"
                label="PPG"
                isFirst={false}
                isLast={false}
              />
              <Segment
                flexValue={shg}
                color="#D9534F"
                label="SHG"
                isFirst={false}
                isLast={true}
              />
            </div>
          );
        } else if (title === "PPP" && player.pp_points > 0) {
          const totalPPP = player.pp_points;
          const pppGoals = player.pp_goals;
          const remainingAssists = totalPPP - pppGoals;
          const primaryAssists = player.pp_primary_assists || 0;
          const secondaryAssists = player.pp_secondary_assists || 0;
          bar = (
            <div className={styles.angledBarContainer}>
              <Segment
                flexValue={pppGoals}
                color="#07aae2"
                label="G"
                isFirst={true}
                isLast={false}
              />
              {remainingAssists > 0 && (
                <>
                  <Segment
                    flexValue={primaryAssists}
                    color="#F0AD4E"
                    label="A1"
                    isFirst={false}
                    isLast={false}
                  />
                  <Segment
                    flexValue={secondaryAssists}
                    color="#D9534F"
                    label="A2"
                    isFirst={false}
                    isLast={true}
                  />
                </>
              )}
            </div>
          );
        }
        const rowClasses =
          index === 0
            ? `${styles.leaderRow} ${styles.leaderRowExpanded}`
            : styles.leaderRow;
        return (
          <div key={player.player_id} className={rowClasses}>
            <div className={styles.topRow}>
              <img
                src={
                  player.image_url ||
                  `https://cms.nhl.bamgrid.com/images/headshots/current/168x168/${player.player_id}.jpg`
                }
                alt={player.fullName}
                className={styles.playerHeadshot}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
              <div className={styles.leaderMain}>
                <div className={styles.nameValueRow}>
                  <div>
                    <div className={styles.leaderName}>{player.fullName}</div>
                    <div className={styles.playerDetails}>
                      {player.current_team_abbreviation} &middot; #
                      {player.sweater_number} &middot; {player.position}
                    </div>
                  </div>
                  <div className={styles.leaderValue}>{player[statKey]}</div>
                </div>
              </div>
            </div>
            {bar && <div className={styles.leaderBar}>{bar}</div>}
          </div>
        );
      })}
    </div>
  );
}

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
      {leaders.map((player, index) => {
        const blocks = player.blocked_shots;
        const shots = player.shots;
        const hits = player.hits;
        let bar: JSX.Element | null = null;
        if (player.bsh > 0) {
          bar = (
            <div className={styles.angledBarContainer}>
              <Segment
                flexValue={blocks}
                color="#07aae2"
                label="B"
                isFirst={true}
                isLast={false}
              />
              <Segment
                flexValue={shots}
                color="#F0AD4E"
                label="S"
                isFirst={false}
                isLast={false}
              />
              <Segment
                flexValue={hits}
                color="#D9534F"
                label="H"
                isFirst={false}
                isLast={true}
              />
            </div>
          );
        }
        const rowClasses =
          index === 0
            ? `${styles.leaderRow} ${styles.leaderRowExpanded}`
            : styles.leaderRow;
        return (
          <div key={player.player_id} className={rowClasses}>
            <div className={styles.topRow}>
              <img
                src={
                  player.image_url ||
                  `https://cms.nhl.bamgrid.com/images/headshots/current/168x168/${player.player_id}.jpg`
                }
                alt={player.fullName}
                className={styles.playerHeadshot}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
              <div className={styles.leaderMain}>
                <div className={styles.nameValueRow}>
                  <div>
                    <div className={styles.leaderName}>{player.fullName}</div>
                    <div className={styles.playerDetails}>
                      {player.current_team_abbreviation} &middot; #
                      {player.sweater_number} &middot; {player.position}
                    </div>
                  </div>
                  <div className={styles.leaderValue}>{player.bsh}</div>
                </div>
              </div>
            </div>
            {bar && <div className={styles.leaderBar}>{bar}</div>}
          </div>
        );
      })}
    </div>
  );
}

/* --- Updated Goalie Leaderboard Component --- */
function LeaderboardCategoryGoalie({
  title,
  leaders,
  statKey
}: {
  title: string;
  leaders: GoalieStat[];
  statKey: keyof GoalieStat;
}) {
  return (
    <div className={styles.card}>
      <h2 className={styles.cardTitle}>{title}</h2>
      {leaders.map((goalie, index) => {
        const rowClasses =
          index === 0
            ? `${styles.leaderRow} ${styles.leaderRowExpanded}`
            : styles.leaderRow;
        let statValue = goalie[statKey];
        if (statKey === "save_pct") {
          statValue = goalie.save_pct
            ? goalie.save_pct.toFixed(3).replace(/^0/, "")
            : "-";
        } else if (statKey === "goals_against_avg") {
          statValue = goalie.goals_against_avg
            ? goalie.goals_against_avg.toFixed(2)
            : "-";
        } else if (statKey === "quality_starts_pct") {
          statValue = goalie.quality_starts_pct
            ? (goalie.quality_starts_pct * 100).toFixed(1)
            : "-";
        }
        return (
          <div key={goalie.goalie_id} className={rowClasses}>
            <div className={styles.topRow}>
              <img
                src={
                  goalie.image_url ||
                  `https://cms.nhl.bamgrid.com/images/headshots/current/168x168/${goalie.goalie_id}.jpg`
                }
                alt={goalie.fullName}
                className={styles.playerHeadshot}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
              <div className={styles.leaderMain}>
                <div className={styles.nameValueRow}>
                  <div>
                    <div className={styles.leaderName}>{goalie.fullName}</div>
                    <div className={styles.playerDetails}>
                      {goalie.current_team_abbreviation} &middot; #
                      {goalie.sweater_number}
                    </div>
                  </div>
                  <div className={styles.leaderValue}>{statValue}</div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

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
      <div className={styles.segmentCore} style={{ backgroundColor: color }}>
        <span className={styles.segmentLabel}>{label}</span>
      </div>
      {!isFirst && (
        <div
          className={styles.leftTriangle}
          style={{ borderBottomColor: color }}
        />
      )}
      {!isLast && (
        <div
          className={styles.rightTriangle}
          style={{ borderTopColor: color }}
        />
      )}
    </div>
  );
}

/* --- Server-Side Data Fetching --- */
export async function getServerSideProps() {
  const currentSeason = await getCurrentSeason();

  // Fetch skater stats
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
      pp_primary_assists,
      pp_secondary_assists,
      sh_goals
    `
    )
    .eq("season", String(currentSeason.seasonId));

  if (error || !data) {
    console.error("Error fetching skater stats:", error);
    return {
      props: {
        pointsLeaders: [],
        goalsLeaders: [],
        pppLeaders: [],
        bshLeaders: [],
        goalieLeadersWins: [],
        goalieLeadersSavePct: [],
        goalieLeadersGAA: [],
        goalieLeadersQS: []
      }
    };
  }

  // Fetch player info for skaters
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

  const skaters: SkaterStat[] = data.map((row) => {
    const playerInfo = playersMap.get(row.player_id);
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
      pp_goals: row.pp_goals ?? 0,
      sh_goals: row.sh_goals ?? 0,
      pp_primary_assists: row.pp_primary_assists ?? 0,
      pp_secondary_assists: row.pp_secondary_assists ?? 0,
      image_url: playerInfo?.image_url || "",
      sweater_number: playerInfo?.sweater_number,
      position: playerInfo?.position
    };
  });

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

  // --- Fetch Goalie Stats (including games_played) ---
  // Note: We now select the team abbreviation from the column "team_abbrevs"
  const { data: goalieData, error: goalieError } = await supabase
    .from("wgo_goalie_stats_totals")
    .select(
      `
      goalie_id,
      goalie_name,
      team_abbrevs,
      season_id,
      wins,
      save_pct,
      goals_against_avg,
      quality_starts_pct,
      games_played
    `
    )
    .eq("season_id", currentSeason.seasonId);

  if (goalieError || !goalieData) {
    console.error("Error fetching goalie stats:", goalieError);
    return {
      props: {
        pointsLeaders,
        goalsLeaders,
        pppLeaders,
        bshLeaders,
        goalieLeadersWins: [],
        goalieLeadersSavePct: [],
        goalieLeadersGAA: [],
        goalieLeadersQS: []
      }
    };
  }

  // --- Fetch player info for goalies (including sweater_number) ---
  const goalieIds = Array.from(new Set(goalieData.map((row) => row.goalie_id)));
  const { data: goaliePlayersData, error: goaliePlayersError } = await supabase
    .from("players")
    .select("id, image_url, sweater_number")
    .in("id", goalieIds);

  if (goaliePlayersError || !goaliePlayersData) {
    console.error("Error fetching goalie player info:", goaliePlayersError);
  }
  const goaliePlayersMap = new Map<number, GoaliePlayerRow>();
  goaliePlayersData?.forEach((p) => goaliePlayersMap.set(p.id, p));

  // --- Determine minimum games played threshold ---
  const { data: standingsData, error: standingsError } = await supabase
    .from("nhl_standings_details")
    .select("date, games_played")
    .eq("season_id", currentSeason.seasonId)
    .order("date", { ascending: false });

  let minGamesThreshold = 0;
  if (!standingsError && standingsData && standingsData.length > 0) {
    const latestDate = standingsData.reduce(
      (max, row) => (row.date > max ? row.date : max),
      standingsData[0].date
    );
    const latestRows = standingsData.filter((row) => row.date === latestDate);
    const totalGames = latestRows.reduce(
      (sum, row) => sum + (row.games_played || 0),
      0
    );
    const avgGames = totalGames / latestRows.length;
    if (avgGames > 10) {
      minGamesThreshold = Math.floor(avgGames * 0.25);
    }
  }

  const goalieStats: GoalieStat[] = goalieData
    .map(
      (row: {
        goalie_id: number;
        goalie_name: string | null;
        team_abbrevs: string | null;
        season_id: number;
        wins: number | null;
        save_pct: number | null;
        goals_against_avg: number | null;
        quality_starts_pct: number | null;
        games_played: number | null;
      }) => ({
        goalie_id: row.goalie_id,
        fullName: row.goalie_name || "Unknown",
        current_team_abbreviation: row.team_abbrevs || "",
        wins: row.wins || 0,
        save_pct: row.save_pct || 0,
        goals_against_avg: row.goals_against_avg || 0,
        quality_starts_pct: row.quality_starts_pct || 0,
        games_played: row.games_played || 0,
        image_url: goaliePlayersMap.get(row.goalie_id)?.image_url || "",
        sweater_number:
          goaliePlayersMap.get(row.goalie_id)?.sweater_number || null,
        season_id: row.season_id.toString()
      })
    )
    .filter((goalie) =>
      minGamesThreshold > 0 ? goalie.games_played >= minGamesThreshold : true
    );

  const goalieLeadersWins = [...goalieStats]
    .sort((a, b) => b.wins - a.wins)
    .slice(0, 5);
  const goalieLeadersSavePct = [...goalieStats]
    .sort((a, b) => b.save_pct - a.save_pct)
    .slice(0, 5);
  const goalieLeadersGAA = [...goalieStats]
    .sort((a, b) => a.goals_against_avg - b.goals_against_avg)
    .slice(0, 5);
  const goalieLeadersQS = [...goalieStats]
    .sort((a, b) => b.quality_starts_pct - a.quality_starts_pct)
    .slice(0, 5);

  return {
    props: {
      pointsLeaders,
      goalsLeaders,
      pppLeaders,
      bshLeaders,
      goalieLeadersWins,
      goalieLeadersSavePct,
      goalieLeadersGAA,
      goalieLeadersQS
    }
  };
}
