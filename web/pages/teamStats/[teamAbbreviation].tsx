import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import supabase from "web/lib/supabase";
import styles from "../../styles/teamStats.module.scss";
import { teamsInfo } from "lib/teamsInfo";
import PPTOIChart from "components/PlayerPPTOIPerGameChart/PPTOIChart";

const curatedFields = [
  { key: "games_played", label: "GP" },
  { key: "wins", label: "W" },
  { key: "losses", label: "L" },
  { key: "ot_losses", label: "OTL" },
  { key: "points", label: "PTs" },
  { key: "goals_for", label: "GF" },
  { key: "goals_against", label: "GA" },
  { key: "goals_for_per_game", label: "GF/GP" },
  { key: "goals_against_per_game", label: "GA/GP" },
  { key: "goals_for_percentage", label: "GF%" },
  { key: "sat_percentage", label: "SAT%" },
  { key: "power_play_pct", label: "PP%" },
  { key: "penalty_kill_pct", label: "PK%" },
  { key: "pp_opportunities_per_game", label: "PPO/GP" },
  { key: "pp_time_on_ice_per_game", label: "PP TOI/GP" },
  { key: "shots_for_per_game", label: "SOG/GP" },
  { key: "shots_against_per_game", label: "SA" },
  { key: "faceoff_win_pct", label: "FOW%" },
  { key: "blocked", label: "BLK" },
  { key: "takeaways", label: "TA" },
  { key: "giveaways", label: "GA" },
  { key: "hits", label: "HIT" },
  { key: "save_pct_5v5", label: "SV% 5v5" },
  { key: "shooting_pct_5v5", label: "SH%" },
  { key: "zone_start_pct_5v5", label: "oZS%" },
];

const averagingFields = new Set([
  "goals_for_per_game",
  "goals_against_per_game",
  "goals_for_percentage",
  "sat_percentage",
  "power_play_pct",
  "penalty_kill_pct",
  "pp_opportunities_per_game",
  "pp_time_on_ice_per_game",
  "shots_for_per_game",
  "shots_against_per_game",
  "faceoff_win_pct",
  "save_pct_5v5",
  "shooting_pct_5v5",
  "zone_start_pct_5v5",
]);

const formatValue = (key: string, value: number | string) => {
  if (typeof value !== "number") return value;

  if (
    [
      "goals_for_per_game",
      "goals_against_per_game",
      "pp_opportunities_per_game",
      "shots_for_per_game",
      "shots_against_per_game",
    ].includes(key)
  ) {
    return value.toFixed(2);
  }

  if (
    [
      "goals_for_percentage",
      "sat_percentage",
      "power_play_pct",
      "penalty_kill_pct",
      "faceoff_win_pct",
      "save_pct_5v5",
      "shooting_pct_5v5",
      "zone_start_pct_5v5",
    ].includes(key)
  ) {
    return (value * 100).toFixed(2) + "%";
  }

  if (key === "pp_time_on_ice_per_game") {
    const minutes = Math.floor(value / 60);
    const seconds = Math.floor(value % 60);
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  }

  return value;
};

const TeamDetail = () => {
  const router = useRouter();
  const { teamAbbreviation, season } = router.query as {
    teamAbbreviation: string;
    season: string;
  };
  const [teamStats, setTeamStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAllRows, setShowAllRows] = useState(false);
  const [aggregatedStats, setAggregatedStats] = useState<{
    [season: string]: { [key: string]: number | string };
  }>({});

  useEffect(() => {
    if (teamAbbreviation) {
      fetchTeamStats(teamAbbreviation);
    }
  }, [teamAbbreviation]);

  const fetchTeamStats = async (abbreviation: string) => {
    const teamInfo = teamsInfo[abbreviation];
    if (!teamInfo) return;

    const { data, error } = await supabase
      .from("wgo_team_stats")
      .select("*")
      .eq("franchise_name", teamInfo.name);

    if (error) {
      console.error("Error fetching team stats:", error);
    } else {
      setTeamStats(data);
      aggregateStatsBySeason(data);
    }
    setLoading(false);
  };

  const aggregateStatsBySeason = (data: any[]) => {
    const aggregated = data.reduce((acc, item) => {
      const seasonId = item.season_id.toString();
      const season = `${seasonId.slice(2, 4)}-${seasonId.slice(6, 8)}`;

      if (!acc[season]) {
        acc[season] = curatedFields.reduce((fields, field) => {
          fields[field.key] = 0;
          return fields;
        }, {} as { [key: string]: number });
        acc[season].count = 0; // Count of records for averaging purposes
      }

      curatedFields.forEach((field) => {
        acc[season][field.key] += item[field.key] || 0;
      });
      acc[season].count += 1;

      return acc;
    }, {} as { [season: string]: { [key: string]: number | string; count: number } });

    // Compute averages for specific fields
    Object.keys(aggregated).forEach((season) => {
      averagingFields.forEach((field) => {
        if (aggregated[season][field]) {
          aggregated[season][field] =
            aggregated[season][field] / aggregated[season].count;
        }
      });
      delete aggregated[season].count; // Remove the count after use
    });

    setAggregatedStats(aggregated);
  };

  if (loading) return <div className={styles.loading}>Loading...</div>;

  // Sort the seasons in descending order
  const sortedSeasons = Object.keys(aggregatedStats).sort((a, b) => {
    const [aStart, aEnd] = a.split("-").map(Number);
    const [bStart, bEnd] = b.split("-").map(Number);
    return bEnd - aEnd || bStart - aStart;
  });

  const rowsToDisplay = showAllRows ? sortedSeasons : sortedSeasons.slice(0, 5);

  return (
    <div className={styles.teamStatsContainer}>
      <h1 className={styles.pageHeader}>
        {teamsInfo[teamAbbreviation]?.name}{" "}
        <span className={styles.spanColorBlue}>Stats</span>
      </h1>
      <div
        className={styles.teamCard}
        style={
          {
            "--primary-color": teamsInfo[teamAbbreviation]?.primaryColor,
            "--secondary-color": teamsInfo[teamAbbreviation]?.secondaryColor,
            "--jersey": teamsInfo[teamAbbreviation]?.jersey,
            "--accent-color": teamsInfo[teamAbbreviation]?.accent,
            "--alt-color": teamsInfo[teamAbbreviation]?.alt,
          } as React.CSSProperties
        }
      >
        <img
          src={`/teamLogos/${teamsInfo[teamAbbreviation]?.name.replace(
            /\s+/g,
            " "
          )}.png`}
          alt={teamsInfo[teamAbbreviation]?.name}
          className={styles.teamLogo}
        />
        <div className={styles.teamAbbrev}>{teamAbbreviation}</div>
      </div>
      <div className={styles.statsContainer}>
        <div className={`${styles.statsTableContainer} scrollbar`}>
          {Object.keys(aggregatedStats).length > 0 ? (
            <table className={styles.statsTable}>
              <thead>
                <tr>
                  <th>Season</th>
                  {curatedFields.map((field) => (
                    <th key={field.key}>{field.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rowsToDisplay.map((season) => (
                  <tr key={season}>
                    <td>{season}</td>
                    {curatedFields.map((field) => (
                      <td key={field.key}>
                        {formatValue(
                          field.key,
                          aggregatedStats[season][field.key]
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>No stats available for this team.</p>
          )}
        </div>
        {sortedSeasons.length > 5 && (
          <button
            className={styles.showMoreButton}
            onClick={() => setShowAllRows(!showAllRows)}
          >
            {showAllRows ? "Show Less" : "Show All Rows"}
          </button>
        )}
      </div>
      <div className={styles.chartSection}>
        <h2>Power Play TOI % Per Game</h2>
        <PPTOIChart teamAbbreviation={teamAbbreviation as string} />
      </div>
    </div>
  );
};

export default TeamDetail;
