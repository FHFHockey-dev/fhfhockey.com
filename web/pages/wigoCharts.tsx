// web/pages/wigoCharts.tsx

import React, { useState, useEffect } from "react";
import styles from "styles/wigoCharts.module.scss";
import {
  Player,
  TeamColors,
  defaultColors,
  TableAggregateData,
  CombinedPlayerStats,
  ThreeYearCountsAverages,
  ThreeYearRatesAverages,
  CareerAverageCounts,
  CareerAverageRates
} from "components/WiGO/types"; // CombinedPlayerStats is now exported from types.ts
import NameSearchBar from "../components/WiGO/NameSearchBar";
import Image from "next/image";
import { getTeamInfoById } from "lib/teamsInfo";
import { fetchPlayerAggregatedStats } from "../utils/fetchWigoPlayerStats"; // Import the utility

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

  const placeholderImage = "/pictures/player-placeholder.jpg";

  const handlePlayerSelect = (player: Player, headshot: string) => {
    setSelectedPlayer(player);
    setHeadshotUrl(headshot);

    if (player.team_id) {
      const teamInfo = getTeamInfoById(player.team_id);
      if (teamInfo) {
        setTeamColors({
          primaryColor: teamInfo.primaryColor,
          secondaryColor: teamInfo.secondaryColor,
          accentColor: teamInfo.accent,
          altColor: teamInfo.alt,
          jerseyColor: teamInfo.jersey
        });
      } else {
        setTeamColors(defaultColors);
      }
    } else {
      setTeamColors(defaultColors);
    }
  };

  /**
   * Formats a number of seconds into MM:SS format, rounded to the nearest second.
   *
   * @param {number} seconds - The total seconds.
   * @returns {string} - The formatted time string in MM:SS.
   */
  const formatSecondsToMMSS = (seconds: number): string => {
    const totalSeconds = Math.round(seconds); // Round to nearest second
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
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

        // Set counts and rates data
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
      className={styles.chartsContainer}
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
      {/* TRENDS CHART */}
      <div className={styles.trendsChartBorder}>
        <div className={styles.trendsChart}>
          <div className={styles.nameSearch}>
            <NameSearchBar onSelect={handlePlayerSelect} />
          </div>
          <div className={styles.notSureYet}></div>
        </div>
      </div>

      {/* WIGO CHART */}
      <div className={styles.wigoChartBorder}>
        <div className={styles.wigoChart}>
          <div className={styles.nameContainer}>
            {selectedPlayer ? (
              <span className={styles.selectedPlayerName}>
                {selectedPlayer.fullName}
              </span>
            ) : (
              <span>No player selected</span>
            )}
          </div>

          <div className={styles.headshotContainer}>
            <div className={styles.headshot}>
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

          <div className={styles.pptoiChart}></div>
          <div className={styles.atoiChart}></div>
          <div className={styles.doughnut}></div>
          <div className={styles.percentiles}></div>

          {/* Counts Table */}
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
                      <td>{row.CA ? row.CA.toFixed(2) : "-"}</td>{" "}
                      {/* Career Average */}
                      <td>{row.threeYA ? row.threeYA.toFixed(2) : "-"}</td>{" "}
                      {/* Three-Year Average */}
                      <td>
                        {["ATOI", "PPTOI/GM"].includes(row.label)
                          ? formatSecondsToMMSS(row.LY)
                          : row.LY}
                      </td>
                      <td>
                        {["ATOI", "PPTOI/GM"].includes(row.label)
                          ? formatSecondsToMMSS(row.L5)
                          : row.L5}
                      </td>
                      <td>
                        {["ATOI", "PPTOI/GM"].includes(row.label)
                          ? formatSecondsToMMSS(row.L10)
                          : row.L10}
                      </td>
                      <td>
                        {["ATOI", "PPTOI/GM"].includes(row.label)
                          ? formatSecondsToMMSS(row.L20)
                          : row.L20}
                      </td>
                      <td>
                        {["ATOI", "PPTOI/GM"].includes(row.label)
                          ? formatSecondsToMMSS(row.STD)
                          : row.STD}
                      </td>
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
                      <td>{row.CA ? row.CA.toFixed(2) : "-"}</td>{" "}
                      {/* Career Average */}
                      <td>{row.threeYA ? row.threeYA.toFixed(2) : "-"}</td>{" "}
                      {/* Three-Year Average */}
                      <td>
                        {["ATOI", "PPTOI/GM"].includes(row.label)
                          ? formatSecondsToMMSS(row.LY)
                          : row.LY}
                      </td>
                      <td>
                        {["ATOI", "PPTOI/GM"].includes(row.label)
                          ? formatSecondsToMMSS(row.L5)
                          : row.L5}
                      </td>
                      <td>
                        {["ATOI", "PPTOI/GM"].includes(row.label)
                          ? formatSecondsToMMSS(row.L10)
                          : row.L10}
                      </td>
                      <td>
                        {["ATOI", "PPTOI/GM"].includes(row.label)
                          ? formatSecondsToMMSS(row.L20)
                          : row.L20}
                      </td>
                      <td>
                        {["ATOI", "PPTOI/GM"].includes(row.label)
                          ? formatSecondsToMMSS(row.STD)
                          : row.STD}
                      </td>
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

          {/* Remove the Three-Year Averages Table */}
          {/* The data is now integrated into the Counts and Rates tables */}

          {/* Career Averages Table */}
          {/* If you still need a separate Career Averages table, you can keep it. 
              Otherwise, it's integrated above in the "CA" column */}
        </div>
      </div>
    </div>
  );
};

export default WigoCharts;
