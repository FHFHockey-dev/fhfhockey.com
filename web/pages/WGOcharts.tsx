import React, { useState, useEffect } from "react";
import styles from "styles/wgoChart.module.scss";
import supabase from "web/lib/supabase";
import axios from "axios";
import { getCurrentSeason } from "lib/NHL/client";
import { getPlayer } from "lib/NHL/client";
// import WGORadarChart from "components/WiGO/wgoRadarChart.js";
import usePercentileRank from "hooks/usePercentileRank";

type PlayerStatsKey = keyof PlayerStats;

// Define interfaces
interface StatItem {
  id: string;
  label: string;
  statKey: string;
}

interface Player {
  id: number;
  player_name: string;
}

interface StatsPeriod {
  [key: string]: number; // Adding index signature
  games_played: number;
  points: number;
  goals: number;
  assists: number;
  shots: number;
  hits: number;
  toi_per_game: number;
  points_per_game: number;
  goals_per_game: number;
  assists_per_game: number;
  blocks: number;
  blocks_per_game: number;
  on_ice_shooting_pct_5v5: number;
  o_zone_start_pct_5v5: number;
  pp_points: number;
  pp_points_per_game: number;
  pp_points_per_60: number;
  pp_toi_per_game: number;
  pp_toi_pct_per_game: number;
  points_per_60_5v5: number;
  secondary_assist_ratio: number;
  shooting_percentage: number;
  shots_per_game: number;
  hits_per_game: number;
  total_primary_assists: number;
  total_secondary_assists: number;
  es_goals_for: number;
  pp_goals_for: number;
  sh_goals_for: number;
}

interface PlayerStats {
  L7: StatsPeriod;
  L14: StatsPeriod;
  L30: StatsPeriod;
  Totals: StatsPeriod;
  LY: StatsPeriod;
}

const NHLAnalysisPage: React.FC = () => {
  const [query, setQuery] = useState("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayerStats, setSelectedPlayerStats] =
    useState<PlayerStats | null>(null);
  const [compareFrom, setCompareFrom] = useState<PlayerStatsKey>("L7");
  const [compareTo, setCompareTo] = useState<PlayerStatsKey>("Totals");
  const [displayMode, setDisplayMode] = useState("per_game");
  const [playerImage, setPlayerImage] = useState<string>(""); // State to store player image URL
  const [playerName, setPlayerName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [position, setPosition] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [age, setAge] = useState("");

  const tableStats: StatItem[] = [
    // DEV NOTE:
    // 1) GP done           14) GP done
    // 2) ATOI done         15) IPP
    // 3) Pts done          16) oiSH% done
    // 4) Pt Pace  done     17) PDO
    // 5) Goals   done      18) Hits done
    // 6) G Pace  done      19) Hits Pace done
    // 7) Assists  done     20) Blocks done
    // 8) A Pace   done     21) Blocks Pace done
    // 9) A1:A2 Ratio done  22) oZS% done
    // 10) SOG    done      23) PPP done
    // 11) SOG/60           24) PPP Pace
    // 12) SOG Pace done    26) PPTOI/GM
    // 13) Shooting %       26) PP%

    { id: "gp", label: "GP", statKey: "games_played" },
    { id: "atoi", label: "ATOI", statKey: "toi_per_game" },
    { id: "pts", label: "Pts", statKey: "points" },
    { id: "ptsPer60", label: "5v5 Pts/60", statKey: "points_per_60_5v5" },
    { id: "goals", label: "Goals", statKey: "goals" },
    { id: "assists", label: "Assists", statKey: "assists" },
    { id: "ipp", label: "IPP", statKey: "IPP" },
    { id: "a1a2", label: "A2 Rate", statKey: "secondary_assist_ratio" },
    { id: "shots", label: "Shots", statKey: "shots" },
    { id: "sogp60", label: "SOG/60", statKey: "individual_shots_for_per_60" },
    { id: "shooting", label: "Shooting %", statKey: "shooting_percentage" },
    { id: "hits", label: "Hits", statKey: "hits" },
    { id: "blocks", label: "Blocks", statKey: "blocked_shots" },
    { id: "ozs", label: "5v5 oZS%", statKey: "o_zone_start_pct_5v5" },
    { id: "oiSH", label: "5v5 oiSH%", statKey: "on_ice_shooting_pct_5v5" },
    { id: "ppp", label: "PPP", statKey: "pp_points" },
    { id: "ppoi", label: "PPP/60", statKey: "pp_points_per_60" },
    { id: "pptoi", label: "PPTOI/GM", statKey: "pp_toi_per_game" },
    { id: "pppct", label: "PP%", statKey: "pp_toi_pct_per_game" },
    { id: "gpg", label: "G | Per Game", statKey: "goals_per_game" },
    { id: "apg", label: "A | Per Game", statKey: "assists_per_game" },
    { id: "ppg", label: "Pt | Per Game", statKey: "points_per_game" },
    { id: "soppg", label: "SOG | Per Game", statKey: "shots_per_game" },
    { id: "hitspg", label: "Hits | Per Game", statKey: "hits_per_game" },
    { id: "blockspg", label: "Blocks | Per Game", statKey: "blocks_per_game" },
    { id: "pppg", label: "PPP | Per Game", statKey: "pp_points_per_game" },
  ];

  // Function to format seconds to MM:SS
  const formatTime = (seconds: number): string => {
    const roundedSeconds = Math.round(seconds);
    const minutes = Math.floor(roundedSeconds / 60);
    const remainingSeconds = roundedSeconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const calculatePPPerGame = (ppPoints: number, gamesPlayed: number) => {
    if (gamesPlayed > 0 && ppPoints !== undefined) {
      return (ppPoints / gamesPlayed).toFixed(2);
    }
    return "-";
  };

  const calculateIPP = (
    statsPeriod: StatsPeriod,

    periodLabel: string
  ): string => {
    const { es_goals_for, pp_goals_for, sh_goals_for, points } = statsPeriod;

    // Logging the input values for debugging
    console.log(`--- IPP Calculation for ${periodLabel} ---`);
    console.log(`ES Goals For: ${es_goals_for}`);
    console.log(`PP Goals For: ${pp_goals_for}`);
    console.log(`SH Goals For: ${sh_goals_for}`);
    console.log(
      `Total Goals For: ${es_goals_for + pp_goals_for + sh_goals_for}`
    );
    console.log(`Points: ${points}`);

    if (points === 0) {
      console.log(`${periodLabel} IPP: 0% (no points)`);
      return "0%"; // Avoid division by zero, handle according to your needs
    }

    const totalGoalsFor = es_goals_for + pp_goals_for + sh_goals_for;
    if (totalGoalsFor === 0) {
      console.log(`${periodLabel} IPP: N/A (no goals)`);
      return "N/A"; // Handle cases where no goals were scored while on ice
    }

    const ipp = (points / totalGoalsFor) * 100;
    const formattedIPP = ipp.toFixed(2) + "%";
    console.log(`${periodLabel} Calculated IPP: ${formattedIPP}`);

    return formattedIPP; // Format as a percentage with two decimals
  };

  const formatStatValue = (statKey: string, statsPeriod: StatsPeriod) => {
    if (statKey === "pp_points_per_game") {
      return calculatePPPerGame(
        statsPeriod.pp_points,
        statsPeriod.games_played
      );
    }

    // Other formatting logic
    if (typeof statsPeriod[statKey] !== "number") return "-";
    const value = statsPeriod[statKey];

    // Specific formatting for Time on Ice per game
    if (statKey === "toi_per_game" || statKey === "pp_toi_per_game") {
      return formatTime(value);
    }

    if (statKey.endsWith("_per_game") && statKey !== "pp_toi_pct_per_game") {
      const paceMultiplier = displayMode === "season_pace" ? 82 : 1;
      const calculatedValue = statsPeriod[statKey] * paceMultiplier;

      if (displayMode === "season_pace") {
        return Math.round(calculatedValue).toString(); // Rounded to nearest whole number
      } else {
        return calculatedValue.toFixed(2); // Keeping two decimal places for "per game" values
      }
    }

    if (
      statKey === "shooting_percentage" ||
      statKey === "on_ice_shooting_pct_5v5" ||
      statKey === "o_zone_start_pct_5v5" ||
      statKey === "pp_toi_pct_per_game"
    ) {
      return (value * 100).toFixed(2) + "%";
    }

    // Handle per game stats and per 60 minutes stats
    if (statKey.endsWith("_per_game")) {
      if (displayMode === "season_pace") {
        return (value * 82).toFixed(2); // Calculate season pace for per game stats
      } else {
        return value.toFixed(2);
      }
    }

    // Handle per 60 minutes stats
    if (statKey.endsWith("_per_60_5v5") || statKey.endsWith("_per_60")) {
      return value.toFixed(2);
    }

    return value.toString();
  };

  const getStatLabel = (statItem: StatItem) => {
    // Check if displayMode is "season_pace" and if statKey matches the expected per game stats
    if (
      displayMode === "season_pace" &&
      [
        "points_per_game",
        "goals_per_game",
        "assists_per_game",
        "shots_per_game",
        "hits_per_game",
        "blocks_per_game",
        "pp_points_per_game",
      ].includes(statItem.statKey)
    ) {
      return statItem.label.replace("| Per Game", "| 82GP Pace");
    }
    return statItem.label;
  };

  const calculateA1A2Ratio = (primary: number, secondary: number): string => {
    const totalAssists = primary + secondary;
    if (totalAssists === 0) return "-"; // Avoid division by zero
    const secARatio = (secondary / totalAssists) * 100;
    return secARatio.toFixed(2) + "%"; // Format as percentage with two decimals
  };

  const handleA1A2Display = (
    statKey: string,
    statsPeriod: StatsPeriod
  ): string => {
    if (statKey === "secondary_assist_ratio") {
      // Use this function to show the A1:A2 ratio where it calculates secondary assist ratio
      return calculateA1A2Ratio(
        statsPeriod.total_primary_assists,
        statsPeriod.total_secondary_assists
      );
    }
    return formatStatValue(statKey, statsPeriod); // Pass the entire statsPeriod object
  };

  const calculatePerGameStat = (
    statKey: string,
    statsPeriod: StatsPeriod,
    applySeasonPace: boolean = false
  ): string => {
    let actualKey = statKey.replace("_per_game", "");
    if (actualKey === "blocks") actualKey = "blocked_shots"; // Correcting the key
    const total = statsPeriod[actualKey];
    const gamesPlayed = statsPeriod.games_played;

    if (gamesPlayed === 0) return "-";
    let perGameStat = total / gamesPlayed;
    if (applySeasonPace) {
      perGameStat *= 82;
      return Math.round(perGameStat).toString();
    }
    return perGameStat.toFixed(2);
  };

  const handleComparison = (statKey: string): string => {
    if (!selectedPlayerStats) return "-";
    let valueFrom, valueTo;

    if (
      statKey === "toi_per_game" ||
      statKey === "pp_toi_per_game" ||
      statKey === "pp_toi_pct_per_game"
    ) {
      valueFrom = selectedPlayerStats[compareFrom]?.[statKey] ?? 0;
      valueTo = selectedPlayerStats[compareTo]?.[statKey] ?? 0;
    } else if (statKey.endsWith("_per_game")) {
      const key = statKey.replace("_per_game", "");
      valueFrom = calculatePerGameStat(
        key,
        selectedPlayerStats[compareFrom],
        displayMode === "season_pace"
      );
      valueTo = calculatePerGameStat(
        key,
        selectedPlayerStats[compareTo],
        displayMode === "season_pace"
      );
    } else {
      valueFrom = selectedPlayerStats[compareFrom]?.[statKey] ?? 0;
      valueTo = selectedPlayerStats[compareTo]?.[statKey] ?? 0;
    }

    if (statKey === "secondary_assist_ratio") {
      // Special handling for A2 Rate where a lower percentage is better
      valueFrom = parseFloat(
        calculateA1A2Ratio(
          selectedPlayerStats[compareFrom]?.total_primary_assists,
          selectedPlayerStats[compareFrom]?.total_secondary_assists
        ).replace("%", "")
      );
      valueTo = parseFloat(
        calculateA1A2Ratio(
          selectedPlayerStats[compareTo]?.total_primary_assists,
          selectedPlayerStats[compareTo]?.total_secondary_assists
        ).replace("%", "")
      );

      // Calculation adjusted to reflect desired A2 Rate logic
      const percentageDifference = ((valueFrom - valueTo) / valueTo) * 100 * -1;
      return percentageDifference.toFixed(2) + "%";
    }

    if (valueTo === 0 && valueFrom === 0) return "-";
    if (valueTo === 0) return "∞"; // Handle division by zero if necessary
    if (valueFrom === 0) return "-100.00%"; // Explicit handling when initial value is zero

    const percentageDifference =
      ((Number(valueFrom) - Number(valueTo)) / Number(valueTo)) * 100;
    return percentageDifference.toFixed(2) + "%";
  };

  const handleSearchChange = async (query: string) => {
    setQuery(query);
    if (!query) {
      setPlayers([]);
      return;
    }
    const { data, error } = await supabase
      .from("wgo_skater_stats")
      .select("player_id, player_name")
      .ilike("player_name", `%${query}%`);

    if (error) {
      console.error("Error fetching players", error);
      return;
    }

    // Removing duplicates
    const uniqueNames = new Set();
    const uniquePlayers = data
      .filter((player) => {
        const isDuplicate = uniqueNames.has(player.player_name);
        uniqueNames.add(player.player_name);
        return !isDuplicate;
      })
      .map((d) => ({
        id: d.player_id,
        player_name: d.player_name,
      }));

    setPlayers(uniquePlayers);
  };

  const handleStatDisplay = (
    statKey: string,
    statsPeriod: StatsPeriod,
    periodLabel: string
  ): string => {
    if (statKey === "IPP") {
      return calculateIPP(statsPeriod, periodLabel);
    } else {
      return handleA1A2Display(statKey, statsPeriod);
    }
  };

  const handlePlayerSelect = async (playerId: number, playerName: string) => {
    setQuery(playerName); // Update the search query
    setPlayers([]); // Clear dropdown
    try {
      const statsResponse = await axios.get(
        `/api/v1/db/skaterArray?playerId=${playerId}`
      );
      const lastYearStatsResponse = await supabase
        .from("wgo_skater_stats_totals_ly")
        .select("*")
        .eq("player_id", playerId)
        .single();
      const playerDetails = await getPlayer(playerId);

      if (
        statsResponse.status === 200 &&
        statsResponse.data[playerId] &&
        lastYearStatsResponse.data
      ) {
        setSelectedPlayerStats({
          ...statsResponse.data[playerId].stats,
          LY: lastYearStatsResponse.data,
        });

        const currentSeason = await getCurrentSeason();
        const imageURL = `https://assets.nhle.com/mugs/nhl/${currentSeason.seasonId}/${playerDetails.teamAbbreviation}/${playerId}.png`;
        setPlayerImage(imageURL);

        // Set player details with fallbacks to empty strings if undefined
        setPlayerName(playerDetails.fullName || "");
        setTeamName(playerDetails.teamName || "");
        setPosition(playerDetails.position || "");
        setHeight(
          playerDetails.heightInCentimeters
            ? `${playerDetails.heightInCentimeters} cm`
            : ""
        );
        setWeight(
          playerDetails.weightInKilograms
            ? `${playerDetails.weightInKilograms} kg`
            : ""
        );
        setAge(playerDetails.age ? `${playerDetails.age}` : "");
      } else {
        console.error("Failed to fetch player stats");
      }
    } catch (error) {
      console.error("Error fetching player stats: ", error);
    }
  };

  const handleCompareFromChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    setCompareFrom(event.target.value as PlayerStatsKey);
  };

  const handleCompareToChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    setCompareTo(event.target.value as PlayerStatsKey);
  };

  return (
    <div className={styles.wgoPage}>
      <div className={styles.wgoHeader}>
        <h1>WGO Charts</h1>
        <div className={styles.wgoHeaderSearchBar}>
          <input
            type="text"
            placeholder="Search Players"
            className={styles.playerSearchbar}
            value={query}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
          <div className={styles.dropdown}>
            {query &&
              players.map((player) => (
                <div
                  key={player.id}
                  className={styles.dropdownItem}
                  onClick={() =>
                    handlePlayerSelect(player.id, player.player_name)
                  }
                >
                  {player.player_name}
                </div>
              ))}
          </div>
        </div>
      </div>
      <div className={styles.wgoChart}>
        <div className={styles.wgoBio}>
          <div className={styles.wgoBioImage}>
            {playerImage && (
              <img
                className={styles.imageContent}
                src={playerImage}
                alt="Player"
              />
            )}
          </div>{" "}
          <div className={styles.wgoBioInfo}>
            <p className={styles.wgoPtext}>Name: {playerName}</p>
            <p className={styles.wgoPtext}>Team: {teamName}</p>
            <p className={styles.wgoPtext}>Position: {position}</p>
            <p className={styles.wgoPtext}>Height: {height}</p>
            <p className={styles.wgoPtext}>Weight: {weight}</p>
            <p className={styles.wgoPtext}>Age: {age}</p>
          </div>
        </div>
        <div className={styles.wgoRadar}>
          {/* {selectedPlayerStats ? (
            <WGORadarChart playerStats={selectedPlayerStats.Totals} />
          ) : (
            <p>No data available</p>
          )} */}
        </div>
        <div className={styles.wgoLineOne}> </div>
        <div className={styles.wgoLineTwo}> </div>
        <div className={styles.wgoTableOptions}>
          <h3>Filter Options</h3>
          <div>
            <div>Compare:</div>
            <select
              className={styles.selectDropdown}
              value={compareFrom}
              onChange={handleCompareFromChange}
            >
              <option value="L7">L7</option>
              <option value="L14">L14</option>
              <option value="L30">L30</option>
              <option value="Totals">STD</option>
              <option value="LY">LY</option>
            </select>
          </div>
          <div>
            <div>To:</div>
            <select
              className={styles.selectDropdown}
              value={compareTo}
              onChange={handleCompareToChange}
            >
              <option value="L7">L7</option>
              <option value="L14">L14</option>
              <option value="L30">L30</option>
              <option value="Totals">STD</option>
              <option value="LY">LY</option>
            </select>
          </div>
          <div className={styles.switchContainer}>
            <div>Per Game</div>
            <label className={styles.switch}>
              <input
                type="checkbox"
                checked={displayMode === "season_pace"}
                onChange={() =>
                  setDisplayMode(
                    displayMode === "per_game" ? "season_pace" : "per_game"
                  )
                }
              />
              <span className={styles.slider}></span>
            </label>
            <div>82GP Pace</div>
          </div>
        </div>
        <div className={styles.wgoTableContainer}>
          <table className={styles.wgoTable}>
            <thead>
              <tr>
                <th>Stat</th>
                <th>L7</th>
                <th>L14</th>
                <th>L30</th>
                <th>Season To Date</th>
                <th>Last Year</th>
                <th>
                  {compareFrom} VS. {compareTo}
                </th>
              </tr>
            </thead>
            <tbody>
              {tableStats.map((stat) => (
                <tr key={stat.id}>
                  <td>{getStatLabel(stat)}</td>
                  <td>
                    {selectedPlayerStats?.L7
                      ? handleStatDisplay(
                          stat.statKey,
                          selectedPlayerStats.L7,
                          "L7"
                        )
                      : "-"}
                  </td>
                  <td>
                    {selectedPlayerStats?.L14
                      ? handleStatDisplay(
                          stat.statKey,
                          selectedPlayerStats.L14,
                          "L14"
                        )
                      : "-"}
                  </td>
                  <td>
                    {selectedPlayerStats?.L30
                      ? handleStatDisplay(
                          stat.statKey,
                          selectedPlayerStats.L30,
                          "L30"
                        )
                      : "-"}
                  </td>
                  <td>
                    {selectedPlayerStats?.Totals
                      ? handleStatDisplay(
                          stat.statKey,
                          selectedPlayerStats.Totals,
                          "Totals"
                        )
                      : "-"}
                  </td>
                  <td>
                    {selectedPlayerStats?.LY
                      ? handleStatDisplay(
                          stat.statKey,
                          selectedPlayerStats.LY,
                          "LY"
                        )
                      : "-"}
                  </td>
                  <td
                    className={
                      parseFloat(handleComparison(stat.statKey)) > 0
                        ? styles.positive
                        : styles.negative
                    }
                  >
                    {handleComparison(stat.statKey)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default NHLAnalysisPage;
