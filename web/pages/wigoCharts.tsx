// /pages/wigoCharts.tsx

import React, { useState, useEffect, useRef } from "react";
import styles from "styles/wigoCharts.module.scss";
import {
  Player,
  TeamColors,
  defaultColors,
  TableAggregateData,
  CombinedPlayerStats
} from "components/WiGO/types";
import NameSearchBar from "../components/WiGO/NameSearchBar";
import Image from "next/image";
import { getTeamInfoById } from "lib/teamsInfo";
import { fetchPlayerAggregatedStats } from "../utils/fetchWigoPlayerStats";
import TeamNameSVG from "../components/WiGO/TeamNameSVG"; // Import the new SVG component

const WigoCharts: React.FC = () => {
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [headshotUrl, setHeadshotUrl] = useState<string | null>(null);
  const [teamColors, setTeamColors] = useState<TeamColors>(defaultColors);
  const [countsTableData, setCountsTableData] = useState<TableAggregateData[]>(
    []
  );
  const [ratesTableData, setRatesTableData] = useState<TableAggregateData[]>(
    []
  );
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [teamName, setTeamName] = useState<string>("");

  const placeholderImage = "/pictures/player-placeholder.jpg";

  const handlePlayerSelect = (player: Player, headshot: string) => {
    setSelectedPlayer(player);
    setHeadshotUrl(headshot);

    if (player.team_id) {
      const teamInfo = getTeamInfoById(player.team_id);
      if (teamInfo) {
        setTeamName(teamInfo.name);
        setTeamColors({
          primaryColor: teamInfo.primaryColor,
          secondaryColor: teamInfo.secondaryColor,
          accentColor: teamInfo.accent,
          altColor: teamInfo.alt,
          jerseyColor: teamInfo.jersey
        });
      } else {
        setTeamColors(defaultColors);
        setTeamName("");
      }
    } else {
      setTeamColors(defaultColors);
      setTeamName("");
    }
  };

  const formatSecondsToMMSS = (seconds: number): string => {
    const totalSeconds = Math.round(seconds);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const formatCell = (
    label: string,
    value?: number,
    column?: string
  ): string => {
    if (value == null) return "-";

    // Apply two decimal places for "CA", "3YA", and "PP%"
    if (column === "CA" || column === "3YA") {
      return value.toFixed(2);
    }

    if (label === "PP%") {
      return `${value.toFixed(2)}%`;
    }

    // Existing formatting rules
    switch (label) {
      case "ATOI":
      case "PPTOI/GM":
        return formatSecondsToMMSS(value);
      default:
        return value.toFixed(2);
    }
  };

  useEffect(() => {
    if (!selectedPlayer) {
      setCountsTableData([]);
      setRatesTableData([]);
      setDataError(null);
      return;
    }

    const fetchData = async () => {
      setIsLoadingData(true);
      setDataError(null);
      try {
        const aggregatedData: CombinedPlayerStats =
          await fetchPlayerAggregatedStats(selectedPlayer.id);

        if (
          aggregatedData.counts.length === 0 &&
          aggregatedData.rates.length === 0
        ) {
          setDataError("No statistics available for the selected player.");
        }

        setCountsTableData(aggregatedData.counts);
        setRatesTableData(aggregatedData.rates);
      } catch (error) {
        console.error("Error fetching aggregated stats:", error);
        setDataError("Failed to load player statistics.");
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchData();
  }, [selectedPlayer]);

  return (
    <div
      className={styles.wigoChart}
      style={
        {
          "--primary-color": teamColors.primaryColor,
          "--secondary-color": teamColors.secondaryColor,
          "--accent-color": teamColors.accentColor,
          "--alt-color": teamColors.altColor,
          "--jersey-color": teamColors.jerseyColor
        } as React.CSSProperties
      }
    >
      <div className={styles.nameSearchBar}>
        <NameSearchBar onSelect={handlePlayerSelect} />
        {selectedPlayer ? (
          <span className={styles.selectedPlayerName}>
            {selectedPlayer.fullName}
          </span>
        ) : (
          <span>No player selected</span>
        )}
      </div>

      <div className={styles.playerHeadshot}>
        <div className={styles.headshot}>
          {teamName && (
            <TeamNameSVG
              teamName={teamName}
              primaryColor={teamColors.primaryColor}
              secondaryColor={teamColors.secondaryColor}
            />
          )}

          {headshotUrl ? (
            <Image
              src={headshotUrl}
              alt={`${selectedPlayer?.fullName} headshot`}
              className={styles.headshotImage}
              layout="fill"
              objectFit="cover"
              style={{
                border: `6px solid ${teamColors.primaryColor}`
              }}
            />
          ) : (
            <Image
              src={placeholderImage}
              alt="No headshot available"
              className={styles.headshotImage}
              layout="fill"
              objectFit="cover"
              style={{
                border: `6px solid #07aae2`,
                borderRadius: "90px"
              }}
            />
          )}
        </div>
      </div>

      {/* Offense/Defense Ratings */}
      <div className={styles.offenseDefenseRatings}>
        {/* Offense/Defense Ratings content here */}
      </div>

      {/* Consistency Chart */}
      <div className={styles.consistencyChart}>
        {/* Consistency Chart content here */}
      </div>

      {/* Rates Table */}
      <div className={styles.ratesTable}>
        <table aria-label="Rates Table">
          <thead>
            <tr>
              <th>Stat</th>
              <th>CA</th>
              <th>3YA</th>
              <th>LY</th>
              <th>L5</th>
              <th>L10</th>
              <th>L20</th>
              <th>STD</th>
            </tr>
          </thead>
          <tbody>
            {isLoadingData ? (
              <tr>
                <td colSpan={8}>Loading rates data...</td>
              </tr>
            ) : dataError ? (
              <tr>
                <td colSpan={8}>{dataError}</td>
              </tr>
            ) : ratesTableData.length > 0 ? (
              ratesTableData.map((row, rowIndex) => (
                <tr
                  key={`rates-row-${rowIndex + 1}`}
                  className={row.label === "GP" ? styles.gpRow : ""}
                >
                  <td className={styles.statLabel}>{row.label}</td>
                  <td>{formatCell(row.label, row.CA)}</td>
                  <td>{formatCell(row.label, row.threeYA)}</td>
                  <td>{formatCell(row.label, row.LY)}</td>
                  <td>{formatCell(row.label, row.L5)}</td>
                  <td>{formatCell(row.label, row.L10)}</td>
                  <td>{formatCell(row.label, row.L20)}</td>
                  <td>{formatCell(row.label, row.STD)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8}>No data available.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Line Chart Rolling Averages */}
      <div className={styles.lineChartRollingAverages}>
        {/* Line Chart content here */}
      </div>

      {/* Counts Table */}
      <div className={styles.countsTable}>
        <table aria-label="Counts Table">
          <thead>
            <tr>
              <th>Stat</th>
              <th>CA</th>
              <th>3YA</th>
              <th>LY</th>
              <th>L5</th>
              <th>L10</th>
              <th>L20</th>
              <th>STD</th>
            </tr>
          </thead>
          <tbody>
            {isLoadingData ? (
              <tr>
                <td colSpan={8}>Loading counts data...</td>
              </tr>
            ) : dataError ? (
              <tr>
                <td colSpan={8}>{dataError}</td>
              </tr>
            ) : countsTableData.length > 0 ? (
              countsTableData.map((row, rowIndex) => (
                <tr
                  key={`counts-row-${rowIndex + 1}`}
                  className={row.label === "GP" ? styles.gpRow : ""}
                >
                  <td className={styles.statLabel}>{row.label}</td>
                  <td>{formatCell(row.label, row.CA)}</td>
                  <td>{formatCell(row.label, row.threeYA)}</td>
                  <td>{formatCell(row.label, row.LY)}</td>
                  <td>{formatCell(row.label, row.L5)}</td>
                  <td>{formatCell(row.label, row.L10)}</td>
                  <td>{formatCell(row.label, row.L20)}</td>
                  <td>{formatCell(row.label, row.STD)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8}>No data available.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Averages Table */}
      <div className={styles.averagesTable}>
        {/* Averages Table if needed */}
      </div>

      {/* Player Bio */}
      <div className={styles.playerBio}>{/* Player Bio content here */}</div>

      {/* Bar Chart */}
      <div className={styles.barChart}>{/* Bar Chart content here */}</div>

      {/* On-Ice Label */}
      <div className={styles.onIceLabel}>On Ice Data</div>

      {/* Percentile Chart */}
      <div className={styles.percentileChart}>
        {/* Percentile Chart content here */}
      </div>

      {/* On-Ice Table */}
      <div className={styles.onIceTable}>{/* On Ice Table content here */}</div>

      {/* Doughnut Charts */}
      <div className={styles.doughnutCharts}>
        {/* Doughnut Charts content here */}
      </div>
    </div>
  );
};

export default WigoCharts;
