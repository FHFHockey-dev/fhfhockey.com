import React, { useState, useEffect } from "react";
import styles from "styles/wgoChart.module.scss";
import supabase from "lib/supabase";
import axios from "axios";
import { getCurrentSeason } from "lib/NHL/client";
import { getPlayer } from "lib/NHL/client";
// import WGORadarChart from "components/WiGO/wgoRadarChart.js";
import usePercentileRank from "hooks/usePercentileRank";

type PlayerStatsKey = keyof PlayerStats;

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
  [key: string]: number;
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
  const [playerImage, setPlayerImage] = useState<string>("");
  const [playerName, setPlayerName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [position, setPosition] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [age, setAge] = useState("");

  const tableStats: StatItem[] = [
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
      return "0%";
    }

    const totalGoalsFor = es_goals_for + pp_goals_for + sh_goals_for;
    if (totalGoalsFor === 0) {
      console.log(`${periodLabel} IPP: N/A (no goals)`);
      return "N/A";
    }

    const ipp = (points / totalGoalsFor) * 100;
    const formattedIPP = ipp.toFixed(2) + "%";
    console.log(`${periodLabel} Calculated IPP: ${formattedIPP}`);

    return formattedIPP;
  };

  const formatStatValue = (statKey: string, statsPeriod: StatsPeriod) => {
    if (statKey === "pp_points_per_game") {
      return calculatePPPerGame(
        statsPeriod.pp_points,
        statsPeriod.games_played
      );
    }

    if (typeof statsPeriod[statKey] !== "number") return "-";
    const value = statsPeriod[statKey];

    if (statKey === "toi_per_game" || statKey === "pp_toi_per_game") {
      return formatTime(value);
    }

    if (statKey.endsWith("_per_game") && statKey !== "pp_toi_pct_per_game") {
      const paceMultiplier = displayMode === "season_pace" ? 82 : 1;
      const calculatedValue = statsPeriod[statKey] * paceMultiplier;

      if (displayMode === "season_pace") {
        return Math.round(calculatedValue).toString();
      } else {
        return calculatedValue.toFixed(2);
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

    if (statKey.endsWith("_per_game")) {
      if (displayMode === "season_pace") {
        return (value * 82).toFixed(2);
      } else {
        return value.toFixed(2);
      }
    }

    if (statKey.endsWith("_per_60_5v5") || statKey.endsWith("_per_60")) {
      return value.toFixed(2);
    }

    return value.toString();
  };

  const getStatLabel = (statItem: StatItem) => {
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
    if (totalAssists === 0) return "-";
    const secARatio = (secondary / totalAssists) * 100;
    return secARatio.toFixed(2) + "%";
  };

  const handleA1A2Display = (
    statKey: string,
    statsPeriod: StatsPeriod
  ): string => {
    if (statKey === "secondary_assist_ratio") {
      return calculateA1A2Ratio(
        statsPeriod.total_primary_assists,
        statsPeriod.total_secondary_assists
      );
    }
    return formatStatValue(statKey, statsPeriod);
  };

  const calculatePerGameStat = (
    statKey: string,
    statsPeriod: StatsPeriod,
    applySeasonPace: boolean = false
  ): string => {
    let actualKey = statKey.replace("_per_game", "");
    if (actualKey === "blocks") actualKey = "blocked_shots";
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

      const percentageDifference = ((valueFrom - valueTo) / valueTo) * 100 * -1;
      return percentageDifference.toFixed(2) + "%";
    }

    if (valueTo === 0 && valueFrom === 0) return "-";
    if (valueTo === 0) return "∞";
    if (valueFrom === 0) return "-100.00%";

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
    setQuery(playerName);
    setPlayers([]);
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

        // Log date ranges in the browser console
        console.log(
          "L7 Date Range:",
          statsResponse.data[playerId].stats.L7.date_range
        );
        console.log(
          "L14 Date Range:",
          statsResponse.data[playerId].stats.L14.date_range
        );
        console.log(
          "L30 Date Range:",
          statsResponse.data[playerId].stats.L30.date_range
        );
        console.log(
          "Totals Date Range:",
          statsResponse.data[playerId].stats.Totals.date_range
        );
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
              <option value="STD">STD</option>
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
              <option value="STD">STD</option>
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
        <div className={styles.wgoShotMap}>
          {/* {selectedPlayerStats ? (
            <WGORadarChart playerStats={selectedPlayerStats.Totals} />
          ) : (
            <p>No data available</p>
          )} */}
        </div>
        <div className={styles.wgoLineOne}> </div>
        <div className={styles.wgoLineTwo}> </div>
        <div className={styles.wgoLineThree}> </div>
        <div className={styles.wgoRadar}> </div>
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
                  {compareFrom} v. {compareTo}
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
