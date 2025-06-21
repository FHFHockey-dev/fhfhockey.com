import React, { useState, useEffect } from "react";
import supabase from "lib/supabase";
import useCurrentSeason from "hooks/useCurrentSeason";
import styles from "./TeamDashboard.module.scss";

interface TeamLeadersProps {
  teamAbbrev: string;
  seasonId?: string;
}

interface PlayerLeader {
  player_id: number;
  player_name: string | null;
  position_code: string | null;
  value: number;
  games_played: number;
  image_url?: string | null;
}

interface TeamLeadersData {
  pointsLeaders: PlayerLeader[];
  goalsLeaders: PlayerLeader[];
  bshLeaders: PlayerLeader[];
}

export function TeamLeaders({ teamAbbrev, seasonId }: TeamLeadersProps) {
  const currentSeason = useCurrentSeason();
  const effectiveSeasonId = seasonId || currentSeason?.seasonId?.toString();

  const [leadersData, setLeadersData] = useState<TeamLeadersData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTeamLeaders = async () => {
      try {
        setIsLoading(true);
        setError(null);

        if (!effectiveSeasonId) {
          throw new Error("No valid season ID available");
        }

        // Convert season ID to the format used in wgo_skater_stats_totals (e.g., "20242025")
        const formattedSeasonId =
          effectiveSeasonId.length === 4
            ? `${effectiveSeasonId}${(parseInt(effectiveSeasonId) + 1).toString()}`
            : effectiveSeasonId;

        // Fetch all skaters for the team and season
        const { data: skatersData, error: skatersError } = await supabase
          .from("wgo_skater_stats_totals")
          .select(
            `
            player_id,
            player_name,
            position_code,
            games_played,
            points,
            goals,
            blocked_shots,
            shots,
            hits
          `
          )
          .eq("current_team_abbreviation", teamAbbrev)
          .eq("season", formattedSeasonId)
          .gte("games_played", 5); // Minimum 5 games played to qualify

        if (skatersError) throw skatersError;

        if (!skatersData || skatersData.length === 0) {
          setLeadersData({
            pointsLeaders: [],
            goalsLeaders: [],
            bshLeaders: []
          });
          return;
        }

        // Fetch player images separately
        const playerIds = skatersData.map((player) => player.player_id);
        const { data: playersData } = await supabase
          .from("players")
          .select("id, image_url")
          .in("id", playerIds);

        // Create a map of player_id to image_url for quick lookup
        const playerImageMap = new Map(
          playersData?.map((p) => [p.id, p.image_url]) || []
        );

        // Calculate BSH (Blocked Shots + Shots + Hits) for each player
        const playersWithBSH = skatersData.map((player) => ({
          ...player,
          image_url: playerImageMap.get(player.player_id) || null,
          bsh:
            (player.blocked_shots || 0) +
            (player.shots || 0) +
            (player.hits || 0)
        }));

        // Get top 3 in each category
        const pointsLeaders = [...playersWithBSH]
          .sort((a, b) => (b.points || 0) - (a.points || 0))
          .slice(0, 3)
          .map((p) => ({
            player_id: p.player_id,
            player_name: p.player_name,
            position_code: p.position_code,
            value: p.points || 0,
            games_played: p.games_played || 0,
            image_url: p.image_url
          }));

        const goalsLeaders = [...playersWithBSH]
          .sort((a, b) => (b.goals || 0) - (a.goals || 0))
          .slice(0, 3)
          .map((p) => ({
            player_id: p.player_id,
            player_name: p.player_name,
            position_code: p.position_code,
            value: p.goals || 0,
            games_played: p.games_played || 0,
            image_url: p.image_url
          }));

        const bshLeaders = [...playersWithBSH]
          .sort((a, b) => b.bsh - a.bsh)
          .slice(0, 3)
          .map((p) => ({
            player_id: p.player_id,
            player_name: p.player_name,
            position_code: p.position_code,
            value: p.bsh,
            games_played: p.games_played || 0,
            image_url: p.image_url
          }));

        setLeadersData({
          pointsLeaders,
          goalsLeaders,
          bshLeaders
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
        console.error("Error fetching team leaders:", err);
      } finally {
        setIsLoading(false);
      }
    };

    if (teamAbbrev && effectiveSeasonId) {
      fetchTeamLeaders();
    }
  }, [teamAbbrev, effectiveSeasonId, currentSeason]);

  const renderLeaderCategory = (
    title: string,
    leaders: PlayerLeader[],
    statName: string
  ) => (
    <div className={styles.leaderCategory}>
      <h4 className={styles.categoryTitle}>{title}</h4>
      <div className={styles.leadersList}>
        {leaders.length > 0 ? (
          leaders.map((leader, index) => (
            <div key={leader.player_id} className={styles.leaderItem}>
              <div className={styles.playerHeadshotContainer}>
                <img
                  src={
                    leader.image_url ||
                    `https://cms.nhl.bamgrid.com/images/headshots/current/168x168/${leader.player_id}.jpg`
                  }
                  alt={leader.player_name || "Player"}
                  className={styles.playerHeadshot}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
                <div className={styles.leaderRank}>{index + 1}</div>
              </div>
              <div className={styles.leaderInfo}>
                <div className={styles.leaderName}>{leader.player_name}</div>
                <div className={styles.leaderPosition}>
                  {leader.position_code}
                </div>
              </div>
              <div className={styles.leaderStats}>
                <div className={styles.leaderValue}>{leader.value}</div>
                <div className={styles.leaderGames}>
                  {leader.games_played}GP
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className={styles.noLeaders}>No data available</div>
        )}
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className={styles.teamLeaders}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <span>Loading team leaders...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.teamLeaders}>
        <div className={styles.error}>
          <h4>⚠️ Error Loading Team Leaders</h4>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.teamLeaders}>
      <div className={styles.leadersGrid}>
        {leadersData && (
          <>
            {renderLeaderCategory(
              "Points Leaders",
              leadersData.pointsLeaders,
              "PTS"
            )}
            {renderLeaderCategory(
              "Goals Leaders",
              leadersData.goalsLeaders,
              "G"
            )}
            {renderLeaderCategory("BSH Leaders", leadersData.bshLeaders, "BSH")}
          </>
        )}
      </div>
    </div>
  );
}
