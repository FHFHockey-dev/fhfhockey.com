import React, { useState, useEffect, useRef } from "react";
import styles from "./sustainabilityTool.module.scss";
import useCurrentSeason from "hooks/useCurrentSeason";
import usePlayers from "hooks/usePlayers";
import useSustainabilityStats from "hooks/useSustainabilityStats";
import TimeOptions, { TimeOption } from "components/TimeOptions/TimeOptions";
import useCareerAveragesStats from "hooks/useCareerAveragesStats";
import { teamsInfo } from "web/lib/NHL/teamsInfo";
import supabase from "web/lib/supabase";
import WigoLineChart from "components/WiGO/WigoLineChart.js"; // Import the WigoLineChart component
import WigoDoughnutChart from "components/WiGO/WigoDoughnutChart.js"; // Import the WigoDoughnutChart component
import PlayerGameScoreLineChart from "components/WiGO/WigoGameScoreLine.js"; // Import the PlayerGameScoreLineChart component

// http://localhost:3000/api/ThreeYearAverages/8475786 example

function isLight(color) {
  const hex = color.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Using the luminance formula to calculate brightness
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5;
}

const SustainabilityTool = () => {
  const season = useCurrentSeason();
  const players = usePlayers();
  const [searchTerm, setSearchTerm] = useState("");
  const [placeholderText, setPlaceholderText] = useState("Search for a player");
  const [filteredPlayers, setFilteredPlayers] = useState([]);
  const [showPopup, setShowPopup] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [teamColors, setTeamColors] = useState({});
  const [playerId, setPlayerId] = useState(undefined);
  const [timeOption, setTimeOption] = useState("L7");
  const [playerGameLog, setPlayerGameLog] = useState(null);
  const [detailedPlayerStats, setDetailedPlayerStats] = useState(null);
  const [totalPlayerStats, setTotalPlayerStats] = useState(null);
  const [gameCategories, setGameCategories] = useState(null);
  const [gameScores, setGameScores] = useState([]);
  const [pointsDistributionData, setPointsDistributionData] = useState([]);

  const { stats: sustainabilityStats, loading: sustainabilityLoading } =
    useSustainabilityStats(playerId, timeOption);
  const { stats: careerStats, loading: careerLoading } =
    useCareerAveragesStats(playerId);

  const sketchRef = useRef(null);
  const [p5Instance, setP5Instance] = useState(null);

  useEffect(() => {
    if (searchTerm.length > 0) {
      const filtered = players
        .filter((player) =>
          player.fullName.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .sort((a, b) => a.fullName.localeCompare(b.fullName));
      setFilteredPlayers(filtered);
      setShowPopup(true);
    } else {
      setFilteredPlayers([]);
      setShowPopup(false);
    }
  }, [searchTerm, players]);

  useEffect(() => {
    if (
      selectedPlayer &&
      season &&
      season.seasonId &&
      typeof window !== "undefined"
    ) {
      const p5 = require("p5");

      // Remove the previous sketch if it exists
      if (p5Instance) {
        p5Instance.remove();
      }

      const s = (p) => {
        let img;

        p.preload = () => {
          img = p.loadImage(
            `https://assets.nhle.com/mugs/nhl/${season.seasonId}/${selectedPlayer.teamAbbreviation}/${selectedPlayer.id}.png`
          );
        };

        p.setup = () => {
          const scaleFactor = 1.15;
          const canvasWidth = img.width * scaleFactor;
          const canvasHeight = img.height * scaleFactor;

          p.createCanvas(canvasWidth, canvasHeight);
          p.noLoop();
        };

        p.draw = () => {
          p.clear();
          p.image(img, 0, 0, p.width, p.height);
          p.filter(p.POSTERIZE, 8);
        };
      };

      const instance = new p5(s, sketchRef.current);
      setP5Instance(instance);
    }
  }, [selectedPlayer, season]);

  const handleKeyDown = (event) => {
    if (event.key === "ArrowDown") {
      setShowPopup(true);
    }
  };

  // This function is called when a player is selected
  const handlePlayerSelect = async (player) => {
    setSelectedPlayer(player);
    setPlaceholderText(player.fullName);
    setSearchTerm("");
    setFilteredPlayers([]);
    setShowPopup(false);
    setTeamColors(teamsInfo[player.teamAbbreviation]);
    setPlayerId(player.id);
    fetchPlayerGameLog(player.id); // Fetch game log data
    setPointsDistributionData([]); // Reset points distribution data

    // Fetch and log the detailed stats from 'wgo_skater_stats'
    const { data, error } = await supabase
      .from("wgo_skater_stats")
      .select("*")
      .eq("player_id", player.id);

    if (data) {
      setDetailedPlayerStats(data);
    }

    if (error) {
      console.error("Error fetching stats:", error);
    } else {
      console.log("Player Detailed Stats:", data);
    }

    // Fetch and log the total stats from 'wgo_skater_stats_totals'
    const { data: totals, error: e } = await supabase
      .from("wgo_skater_stats_totals")
      .select("*")
      .eq("player_id", player.id);

    if (totals) {
      setTotalPlayerStats(totals);
    }
    if (e) {
      console.error("Error fetching total player stats:", e);
    } else {
      console.log("Player Total Stats:", totals);
    }

    if (data) {
      setDetailedPlayerStats(data);

      // Calculate game scores and accumulate them into an array
      const gameScores = data.map((game) => {
        const gameScore = calculateGameScore(game);
        return {
          date: game.date,
          gameScore: gameScore,
        };
      });

      // Log the entire gameScores array to the console
      console.log("All Game Scores:", gameScores);
    }

    if (data) {
      setDetailedPlayerStats(data);

      const gameCategories = {
        Elite: 0,
        Great: 0,
        Good: 0,
        Average: 0,
        Bad: 0,
        Abysmal: 0,
      };

      data.forEach((game) => {
        const gameScore = calculateGameScore(game);

        if (gameScore >= 3) gameCategories.Elite++;
        else if (gameScore >= 2) gameCategories.Great++;
        else if (gameScore >= 1) gameCategories.Good++;
        else if (gameScore >= 0) gameCategories.Average++;
        else if (gameScore >= -1) gameCategories.Bad++;
        else gameCategories.Abysmal++;
      });

      console.log("Game Categories:", gameCategories);
      setGameCategories(gameCategories);
    }

    const gameScoresCalculated = data.map((game) => {
      const gameScore = calculateGameScore(game);
      return {
        date: game.date,
        gameScore: gameScore,
      };
    });

    setGameScores(gameScoresCalculated);
    console.log("All Game Scores:", gameScoresCalculated);
  };

  useEffect(() => {
    if (playerGameLog) {
      const pointsDistribution = {};
      playerGameLog.forEach((game) => {
        const points = game.points;
        pointsDistribution[points] = (pointsDistribution[points] || 0) + 1;
      });

      const totalGames = playerGameLog.length;
      const pointsDistributionData = Object.keys(pointsDistribution).map(
        (points) => ({
          label: `${points} Points`,
          value: pointsDistribution[points],
          percentage: (pointsDistribution[points] / totalGames) * 100,
        })
      );

      console.log("Points Distribution Data:", pointsDistributionData);
      setPointsDistributionData(pointsDistributionData);
    }
  }, [playerGameLog]);

  useEffect(() => {
    if (playerId && season && season.seasonId) {
      fetchPlayerGameLog(playerId);
    }
  }, [playerId, season]);

  // Log playerGameLog to the console
  useEffect(() => {
    console.log("Player Game Log:", playerGameLog);
  }, [playerGameLog]);

  useEffect(() => {
    if (sustainabilityStats) {
      console.log("Sustainability stats:", sustainabilityStats);
    }
    if (careerStats) {
      console.log("Career stats:", careerStats);
    }
  }, [sustainabilityStats, careerStats]);

  const fetchPlayerGameLog = async (playerId) => {
    const response = await fetch(
      `/api/v1/player/${playerId}/game-log/${season.seasonId}/2`
    );
    const data = await response.json();
    if (data.success) {
      setPlayerGameLog(data.data);
      console.log(data.data);
    } else {
      console.error(data.message);
      setPlayerGameLog(null);
    }
  };

  const getColor = (seasonValue, careerValue, isLowerBetter = false) => {
    if (seasonValue === undefined || careerValue === undefined) {
      return ""; // No color if values are not present
    }

    const isBetter = isLowerBetter
      ? seasonValue < careerValue
      : seasonValue > careerValue;
    return isBetter ? "#4CB944" : "#EC9A29"; // green : red
  };

  const calculateGameScore = (game) => {
    const G = game.goals || 0;
    const A1 = game.primary_assists_per_game || 0;
    const A2 = game.secondary_assists_per_game || 0;
    const SOG = game.shots || 0;
    const BLK = game.blocked_shots || 0;
    const PD = game.penalties_drawn || 0;
    const PT = game.penalties || 0;
    const FOW = game.total_fow || 0;
    const FOL = game.total_fol || 0;
    const CF = game.sat_for || 0;
    const CA = game.sat_against || 0;
    const GF =
      (game.es_goals_for || 0) +
      (game.pp_goals_for || 0) +
      (game.sh_goals_for || 0);
    const GA =
      (game.es_goals_against || 0) +
      (game.pp_goals_against || 0) +
      (game.sh_goals_against || 0);

    return (
      0.75 * G +
      0.7 * A1 +
      0.55 * A2 +
      0.075 * SOG +
      0.05 * BLK +
      0.15 * PD -
      0.15 * PT +
      0.01 * FOW -
      0.01 * FOL +
      0.05 * CF -
      0.05 * CA +
      0.15 * GF -
      0.15 * GA
    );
  };

  const getColorForPoints = (pointsLabel) => {
    const points = parseInt(pointsLabel.split(" ")[0]); // Get the number of points from the label
    const colors = [
      "#E9F2FC", // Color for 0 points
      "#B1CDED", // Color for 1 point
      "#77ABE1", // Color for 2 points
      "#3D89D5", // Color for 3 points
      "#1B67B2", // Color for 4 points
      "#13497E", // Color for 5 points
      "#0B2B4A", // Color for 6 points
      "#030D16", // Color for 7 points
    ];
    return colors[points] || "#FFFFFF"; // Default color if out of range
  };

  return (
    <div
      className={styles.wigoPage}
      style={{
        "--primary-color": teamColors.primaryColor,
        "--secondary-color": teamColors.secondaryColor,
        "--jersey-color": teamColors.jersey,
        "--accent-color": teamColors.accent,
        "--alt-color": teamColors.alt,
      }}
    >
      <div className={styles.wigoHeader}>
        <h1 className={styles.headerWigo}>
          WiGO <span className={styles.spanColorBlue}>CHARTS</span>
        </h1>

        <div className={styles.dropdownContainer}>
          <input
            className={styles.searchInput}
            type="text"
            placeholder={placeholderText}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => {
              if (searchTerm && filteredPlayers.length === 0) {
                // Logic to filter players again if the searchTerm is not empty
                const filtered = players.filter((player) =>
                  player.fullName
                    .toLowerCase()
                    .includes(searchTerm.toLowerCase())
                );
                setFilteredPlayers(filtered);
              }
              setShowPopup(true);
            }}
            onKeyDown={handleKeyDown}
          />
          {showPopup && filteredPlayers.length > 0 && (
            <div className={styles.popupContainer}>
              <ul className={styles.scrollableList}>
                {filteredPlayers.map((player) => (
                  <li
                    key={player.id}
                    className={styles.popupListItem}
                    onClick={() => handlePlayerSelect(player)}
                  >
                    {player.fullName}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className={styles.wigoChartBorder}>
        <div className={styles.wigoContainer}>
          <div className={styles.wigoDoughnut}>
            <div className={styles.wigoDoughnutChart}>
              <div className={styles.wigoDoughnutLegendLeft}>
                <div className={styles.wigoDoughnutLegendLeftTitle}>
                  Game Score
                </div>
                <div
                  className={styles.wigoDoughnutLegendLeftValue}
                  style={{ backgroundColor: "#2B90ED" }}
                >
                  Elite
                </div>
                <div
                  className={styles.wigoDoughnutLegendLeftValue}
                  style={{ backgroundColor: "#4FA9DD" }}
                >
                  Great
                </div>
                <div
                  className={styles.wigoDoughnutLegendLeftValue}
                  style={{ backgroundColor: "#7CC47C" }}
                >
                  Good
                </div>
                <div
                  className={styles.wigoDoughnutLegendLeftValue}
                  style={{ backgroundColor: "#FFEB3B" }}
                >
                  Average
                </div>
                <div
                  className={styles.wigoDoughnutLegendLeftValue}
                  style={{ backgroundColor: "#FFA500" }}
                >
                  Bad
                </div>
                <div
                  className={styles.wigoDoughnutLegendLeftValue}
                  style={{ backgroundColor: "#E23F07" }}
                >
                  Abysmal
                </div>
              </div>

              <div className={styles.wigoDoughnutChartContent}>
                <WigoDoughnutChart
                  stats={sustainabilityStats}
                  detailedStats={detailedPlayerStats}
                  totalStats={totalPlayerStats}
                  gameCategories={gameCategories}
                  pointsDistributionData={pointsDistributionData}
                />
              </div>

              <div className={styles.wigoDoughnutLegendRight}>
                <div className={styles.wigoDoughnutLegendRightTitle}>
                  # of Pt/Gm
                </div>
                {pointsDistributionData.map((item, index) => {
                  const points = parseInt(item.label.split(" ")[0]); // Extract the number of points from the label
                  const displayLabel = `${points}pt Games:`; // Construct the display label
                  const backgroundColor = getColorForPoints(item.label);
                  const textColor = isLight(backgroundColor)
                    ? "#202020"
                    : "#FFF";

                  return (
                    <div
                      key={index}
                      className={styles.wigoDoughnutLegendRightValue}
                      style={{
                        backgroundColor: backgroundColor,
                        color: textColor,
                      }}
                    >
                      {displayLabel}
                      <br />
                      {""}({item.value})
                    </div>
                  );
                })}
              </div>
            </div>

            <div className={styles.wigoDoughnutFooter}>
              <div className={styles.wigoDoughnutLegend}>
                <div className={styles.wigoDoughnutDescriptors}>
                  <div className={styles.wigoDoughnutDescriptor}></div>
                  <div className={styles.wigoDoughnutDescriptor}>IPP</div>
                  <div className={styles.wigoDoughnutDescriptor}>S%</div>
                  <div className={styles.wigoDoughnutDescriptor}>SOG/60</div>
                  <div className={styles.wigoDoughnutDescriptor}>oZS%</div>
                  <div className={styles.wigoDoughnutDescriptor}>oiSH%</div>
                  <div className={styles.wigoDoughnutDescriptor}>A2%</div>
                  <div className={styles.wigoDoughnutDescriptor}>xS%</div>
                </div>
              </div>
              <div className={styles.wigoDoughnutHeader}>
                <div className={styles.wigoDoughnutHeaderCareer}>
                  <div className={styles.susLabelc}>Career</div>
                  <div className={styles.susIPPc}>
                    {careerStats && careerStats.IPP !== undefined
                      ? (careerStats.IPP * 100).toFixed(1) + "%"
                      : ""}
                  </div>
                  <div className={styles.susSPctc}>
                    {careerStats && careerStats["S%"] !== undefined
                      ? (careerStats["S%"] * 100).toFixed(1) + "%"
                      : ""}
                  </div>
                  <div className={styles.susSogP60c}>
                    {careerStats && careerStats["SOG/60"] !== undefined
                      ? careerStats["SOG/60"].toFixed(1)
                      : ""}
                  </div>
                  <div className={styles.susOZsc}>
                    {careerStats && careerStats["oZS%"] !== undefined
                      ? (careerStats["oZS%"] * 100).toFixed(1) + "%"
                      : ""}
                  </div>
                  <div className={styles.susoiSHc}>
                    {careerStats && careerStats["oiSH%"] !== undefined
                      ? (careerStats["oiSH%"] * 100).toFixed(1) + "%"
                      : ""}
                  </div>
                  <div className={styles.susSecAc}>
                    {careerStats && careerStats["secA%"] !== undefined
                      ? (careerStats["secA%"] * 100).toFixed(2) + "%"
                      : ""}
                  </div>
                  <div className={styles.susXSpctc}>
                    {careerStats && careerStats["xS%"] !== undefined
                      ? (careerStats["xS%"] * 100).toFixed(1) + "%"
                      : ""}
                  </div>
                </div>
                <div className={styles.wigoDoughnutHeaderSeason}>
                  <div className={styles.susLabeln}>Season</div>
                  <div
                    className={styles.susIPPn}
                    style={{
                      backgroundColor: getColor(
                        sustainabilityStats?.["IPP"],
                        careerStats?.["IPP"],
                        true // Lower is better
                      ),
                    }}
                  >
                    {sustainabilityStats &&
                    sustainabilityStats.IPP !== undefined
                      ? (sustainabilityStats.IPP * 100).toFixed(1) + "%"
                      : ""}
                  </div>
                  <div
                    className={styles.susSPctn}
                    style={{
                      backgroundColor: getColor(
                        sustainabilityStats?.["S%"],
                        careerStats?.["S%"],
                        true // Lower is better
                      ),
                    }}
                  >
                    {sustainabilityStats &&
                    sustainabilityStats["S%"] !== undefined
                      ? (sustainabilityStats["S%"] * 100).toFixed(1) + "%"
                      : ""}
                  </div>
                  <div
                    className={styles.susSogP60n}
                    style={{
                      backgroundColor: getColor(
                        sustainabilityStats?.["SOG/60"],
                        careerStats?.["SOG/60"],
                        true // Assuming lower is better for demonstration
                      ),
                    }}
                  >
                    {sustainabilityStats &&
                    sustainabilityStats["SOG/60"] !== undefined
                      ? sustainabilityStats["SOG/60"].toFixed(1)
                      : ""}
                  </div>
                  <div
                    className={styles.susOZsn}
                    style={{
                      backgroundColor: getColor(
                        sustainabilityStats?.["oZS%"],
                        careerStats?.["oZS%"],
                        false // Assuming lower is better for demonstration
                      ),
                    }}
                  >
                    {sustainabilityStats &&
                    sustainabilityStats["oZS%"] !== undefined
                      ? (sustainabilityStats["oZS%"] * 100).toFixed(1) + "%"
                      : ""}
                  </div>
                  <div
                    className={styles.susoiSHn}
                    style={{
                      backgroundColor: getColor(
                        sustainabilityStats?.["oiSH%"],
                        careerStats?.["oiSH%"],
                        false // Assuming lower is better for demonstration
                      ),
                    }}
                  >
                    {sustainabilityStats &&
                    sustainabilityStats["oiSH%"] !== undefined
                      ? (sustainabilityStats["oiSH%"] * 100).toFixed(1) + "%"
                      : ""}
                  </div>
                  <div
                    className={styles.susSecAn}
                    style={{
                      backgroundColor: getColor(
                        sustainabilityStats?.["secA%"],
                        careerStats?.["secA%"],
                        true // Assuming lower is better for demonstration
                      ),
                    }}
                  >
                    {sustainabilityStats &&
                    sustainabilityStats["secA%"] !== undefined
                      ? (sustainabilityStats["secA%"] * 100).toFixed(2) + "%"
                      : ""}
                  </div>
                  <div
                    className={styles.susXSpctn}
                    style={{
                      backgroundColor: getColor(
                        sustainabilityStats?.["xS%"],
                        careerStats?.["xS%"],
                        true // Assuming lower is better for demonstration
                      ),
                    }}
                  >
                    {sustainabilityStats &&
                    sustainabilityStats["xS%"] !== undefined
                      ? (sustainabilityStats["xS%"] * 100).toFixed(1) + "%"
                      : ""}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.bioHeadshot}>
            <div className={styles.bioHeadshotHeader}>
              <div className={styles.bioHeadshotHeaderLeft}>
                {selectedPlayer && selectedPlayer.firstName}
              </div>
              <div className={styles.bioHeadshotHeaderCenter}></div>
              <div className={styles.bioHeadshotHeaderRight}>
                <span className={styles.spanColorBlue}>
                  {selectedPlayer && selectedPlayer.lastName}
                </span>
              </div>
            </div>

            <div className={styles.bioHeadshotContent}>
              {selectedPlayer && (
                <div ref={sketchRef} className={styles.wigoHeadshotImage}></div>
              )}
            </div>
          </div>

          <div className={styles.wigoLineChart}>
            <div className={styles.wigoLineChartHeader}></div>
            <div className={styles.wigoLineChartContent}>
              <WigoLineChart stats={detailedPlayerStats} />
            </div>
          </div>

          <div className={styles.wigoStatList}></div>

          <div className={styles.wigoSusCells}></div>

          <div className={styles.wigoRollingAverage}>
            <PlayerGameScoreLineChart gameScores={gameScores} />
          </div>

          <div className={styles.wigoLinesDoughnuts}>
            <div className={styles.wigoLinesDoughnutsTop}>
              <div className={styles.wigoLinesTop}></div>
              <div className={styles.wigoDoughnutsTop}></div>
            </div>
            <div className={styles.wigoLinesDoughnutsBottom}>
              <div className={styles.wigoLinesBottom}></div>
              <div className={styles.wigoDoughnutsBottom}></div>
            </div>
          </div>

          <div className={styles.wigoPercentileLines}>
            <div className={styles.wigoPercentileLinesTop}></div>
            <div className={styles.wigoPercentileLinesBottom}></div>
          </div>

          <div className={styles.wigoBars}>
            <div className={styles.wigoBarsTop}></div>
            <div className={styles.wigoBarsBottom}></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SustainabilityTool;
