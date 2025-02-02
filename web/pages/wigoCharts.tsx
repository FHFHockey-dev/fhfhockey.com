// /pages/wigoCharts.tsx

// TODO
// GET IPP for L5, 10, 20
// Maybe I can have a L5, L10, L20 API endpoint specifically?

import React, { useState, useEffect } from "react";
import styles from "styles/wigoCharts.module.scss";
import {
  Player,
  TeamColors,
  defaultColors,
  TableAggregateData,
  CombinedPlayerStats,
} from "components/WiGO/types";
import NameSearchBar from "../components/WiGO/NameSearchBar";
import Image from "next/image";
import { getTeamInfoById, teamNameToAbbreviationMap } from "lib/teamsInfo";
import { fetchPlayerAggregatedStats } from "../utils/fetchWigoPlayerStats";
import TeamNameSVG from "../components/WiGO/TeamNameSVG";
import TimeframeComparison from "../components/WiGO/TimeframeComparison";
import CategoryCoverageChart from "components/CategoryCoverageChart";

/**
 * Helper that takes the tableData for (counts or rates)
 * and updates the .DIFF property based on comparing leftKey vs. rightKey
 * as a per-game difference.
 */
/**
 * For the COUNTS table:
 * We find the row labeled "GP" and do a ( value / GP ) comparison,
 * producing a percentage difference for each row.
 */
function computeDiffColumnForCounts(
  tableData: TableAggregateData[],
  leftKey: keyof TableAggregateData,
  rightKey: keyof TableAggregateData
) {
  const gpRow = tableData.find((r) => r.label === "GP");

  tableData.forEach((row) => {
    const leftVal = row[leftKey];
    const rightVal = row[rightKey];

    // If it's the "GP" row itself, we might skip or just set DIFF=undefined
    if (row.label === "GP") {
      row.DIFF = undefined;
      return;
    }

    // Safely get the GP # for each timeframe
    const gpLeft = gpRow ? gpRow[leftKey] : 0;
    const gpRight = gpRow ? gpRow[rightKey] : 0;

    if (
      typeof leftVal === "number" &&
      typeof rightVal === "number" &&
      typeof gpLeft === "number" &&
      typeof gpRight === "number" &&
      gpLeft > 0 &&
      gpRight > 0
    ) {
      const perGameLeft = leftVal / gpLeft;
      const perGameRight = rightVal / gpRight;
      row.DIFF = ((perGameLeft - perGameRight) / perGameRight) * 100;
    } else {
      row.DIFF = undefined;
    }
  });
}

/**
 * For the RATES table:
 * The data is already "per hour" (or per-60) for each timeframe,
 * so we just do a direct ( leftVal - rightVal ) / rightVal * 100 difference,
 * with no reference to "GP" needed.
 */
function computeDiffColumnForRates(
  tableData: TableAggregateData[],
  leftKey: keyof TableAggregateData,
  rightKey: keyof TableAggregateData
) {
  tableData.forEach((row) => {
    const leftVal = row[leftKey];
    const rightVal = row[rightKey];

    if (
      typeof leftVal === "number" &&
      typeof rightVal === "number" &&
      rightVal !== 0
    ) {
      row.DIFF = ((leftVal - rightVal) / rightVal) * 100;
    } else {
      row.DIFF = undefined;
    }
  });
}

const WigoCharts: React.FC = () => {
  // State
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
  const [teamAbbreviation, setTeamAbbreviation] = useState<string | null>(null);

  // The user's chosen timeframes for the “VS.” comparison
  // (We won’t use them except to re-calc the DIFF column)
  const [leftTimeframe, setLeftTimeframe] =
    useState<keyof TableAggregateData>("STD");
  const [rightTimeframe, setRightTimeframe] =
    useState<keyof TableAggregateData>("CA");

  const placeholderImage = "/pictures/player-placeholder.jpg";

  const handlePlayerSelect = (player: Player, headshot: string) => {
    setSelectedPlayer(player);
    setHeadshotUrl(headshot);

    if (player.team_id) {
      const teamInfo = getTeamInfoById(player.team_id);
      if (teamInfo) {
        const abbr = teamNameToAbbreviationMap[teamInfo.name] ?? null;
        setTeamName(teamInfo.name);
        setTeamAbbreviation(abbr);
        setTeamColors({
          primaryColor: teamInfo.primaryColor,
          secondaryColor: teamInfo.secondaryColor,
          accentColor: teamInfo.accent,
          altColor: teamInfo.alt,
          jerseyColor: teamInfo.jersey,
        });
      } else {
        setTeamName("");
        setTeamAbbreviation(null);
        setTeamColors(defaultColors);
      }
    } else {
      setTeamName("");
      setTeamAbbreviation(null);
      setTeamColors(defaultColors);
    }
  };

  // Simple function to format seconds as MM:SS
  const formatSecondsToMMSS = (seconds: number): string => {
    const totalSeconds = Math.round(seconds);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  // Format cell values for display
  const formatCell = (label: string, value?: number): string => {
    if (value == null) return "-";
    switch (label) {
      case "ATOI":
      case "PPTOI":
        return formatSecondsToMMSS(value);
      case "PP%":
        return `${value.toFixed(2)}%`;
      default:
        return value.toFixed(2);
    }
  };

  // Fetch data once a player is selected
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

        // Set the raw data
        setCountsTableData(aggregatedData.counts);
        setRatesTableData(aggregatedData.rates);

        // Then compute DIFF right away with the default left=STD, right=CA
        const updatedCounts = structuredClone(aggregatedData.counts);
        computeDiffColumnForCounts(updatedCounts, "STD", "CA");

        const updatedRates = structuredClone(aggregatedData.rates);
        computeDiffColumnForRates(updatedRates, "STD", "CA");

        setCountsTableData(updatedCounts);
        setRatesTableData(updatedRates);
      } catch (error) {
        console.error("Error fetching aggregated stats:", error);
        setDataError("Failed to load player statistics.");
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchData();
  }, [selectedPlayer]);

  // Render
  return (
    <div className={styles.wigoChartBorder}>
      <div
        className={styles.wigoChart}
        style={
          {
            "--primary-color": teamColors.primaryColor,
            "--secondary-color": teamColors.secondaryColor,
            "--accent-color": teamColors.accentColor,
            "--alt-color": teamColors.altColor,
            "--jersey-color": teamColors.jerseyColor,
          } as React.CSSProperties
        }
      >
        {/* Name Search Bar */}
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

        {/* Player Headshot / Team Logo Section */}
        <div className={styles.playerHeadshot}>
          {teamName && (
            <TeamNameSVG
              teamName={teamName}
              primaryColor={teamColors.primaryColor}
              secondaryColor={teamColors.secondaryColor}
            />
          )}

          <div className={styles.headshotContainer}>
            <div className={styles.leftSide}>
              <div className={styles.headshot}>
                {headshotUrl ? (
                  <Image
                    src={headshotUrl}
                    alt={`${selectedPlayer?.fullName} headshot`}
                    className={styles.headshotImage}
                    layout="fill"
                    objectFit="cover"
                    style={{ border: `6px solid ${teamColors.primaryColor}` }}
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
                      borderRadius: "90px",
                    }}
                  />
                )}
              </div>
            </div>
            <div className={styles.rightSide}>
              <div className={styles.teamLogo}>
                {teamAbbreviation ? (
                  <Image
                    src={`/teamLogos/${teamAbbreviation}.png`}
                    alt={`${teamName} logo`}
                    layout="intrinsic"
                    width={120}
                    height={120}
                  />
                ) : (
                  <p style={{ color: "#ccc", fontSize: "14px" }}>
                    No team logo found
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Offense / Defense / Per-Game / Opponent / Consistency ... */}
        <div className={styles.offenseRatings}></div>
        <div className={styles.overallRatings}></div>
        <div className={styles.defenseRatings}></div>
        <div className={styles.perGameStats}></div>
        <div className={styles.opponentLog}></div>
        <div className={styles.consistencyRating}></div>

        {/* Timeframe Comparison */}
        <div className={styles.timeframeComparison}>
          <TimeframeComparison
            onCompare={(left, right) => {
              setLeftTimeframe(left as keyof TableAggregateData);
              setRightTimeframe(right as keyof TableAggregateData);

              const updatedCounts = structuredClone(countsTableData);
              const updatedRates = structuredClone(ratesTableData);

              // We want to do “per-game” for counts...
              computeDiffColumnForCounts(
                updatedCounts,
                left as keyof TableAggregateData,
                right as keyof TableAggregateData
              );

              // ...and direct difference for rates
              computeDiffColumnForRates(
                updatedRates,
                left as keyof TableAggregateData,
                right as keyof TableAggregateData
              );

              setCountsTableData(updatedCounts);
              setRatesTableData(updatedRates);
            }}
          />
        </div>

        {/* Counts Table */}
        <div className={styles.countsTable}>
          <table aria-label="Counts Table">
            <thead>
              {/* "COUNTS" label row */}
              <tr className={styles.countsLabel}>
                {/* 9 columns total => 8 existing + 1 for DIFF */}
                <th colSpan={9}>COUNTS</th>
              </tr>
              {/* Column headers */}
              <tr>
                <th>Stat</th>
                <th>CA</th>
                <th>3YA</th>
                <th>LY</th>
                <th>L5</th>
                <th>L10</th>
                <th>L20</th>
                <th>STD</th>
                <th>DIFF</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingData ? (
                <tr>
                  <td colSpan={9}>Loading counts data...</td>
                </tr>
              ) : dataError ? (
                <tr>
                  <td colSpan={9}>{dataError}</td>
                </tr>
              ) : countsTableData.length > 0 ? (
                countsTableData.map((row, rowIndex) => (
                  <tr
                    key={`counts-row-${rowIndex}`}
                    className={row.label === "GP" ? styles.gpRow : ""}
                  >
                    <td className={styles.statLabel}>{row.label}</td>
                    <td>{formatCell(row.label, row.CA)}</td>
                    <td>{formatCell(row.label, row["3YA"])}</td>
                    <td>{formatCell(row.label, row.LY)}</td>
                    <td>{formatCell(row.label, row.L5)}</td>
                    <td>{formatCell(row.label, row.L10)}</td>
                    <td>{formatCell(row.label, row.L20)}</td>
                    <td>{formatCell(row.label, row.STD)}</td>
                    <td
                      style={{
                        color:
                          row.DIFF !== undefined
                            ? row.DIFF >= 0
                              ? "limegreen"
                              : "red"
                            : "#fff",
                      }}
                    >
                      {row.DIFF !== undefined ? `${row.DIFF.toFixed(1)}%` : "-"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9}>No data available.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Rates Table */}
        <div className={styles.ratesTable}>
          <table aria-label="Rates Table">
            <thead>
              {/* "RATES" label row */}
              <tr className={styles.ratesLabel}>
                <th colSpan={9}>RATES</th> {/* 8 + 1 DIFF */}
              </tr>
              <tr>
                <th>Stat</th>
                <th>CA</th>
                <th>3YA</th>
                <th>LY</th>
                <th>L5</th>
                <th>L10</th>
                <th>L20</th>
                <th>STD</th>
                <th>DIFF</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingData ? (
                <tr>
                  <td colSpan={9}>Loading rates data...</td>
                </tr>
              ) : dataError ? (
                <tr>
                  <td colSpan={9}>{dataError}</td>
                </tr>
              ) : ratesTableData.length > 0 ? (
                ratesTableData.map((row, rowIndex) => (
                  <tr
                    key={`rates-row-${rowIndex}`}
                    className={row.label === "GP" ? styles.gpRow : ""}
                  >
                    <td className={styles.statLabel}>{row.label}</td>
                    <td>{formatCell(row.label, row.CA)}</td>
                    <td>{formatCell(row.label, row["3YA"])}</td>
                    <td>{formatCell(row.label, row.LY)}</td>
                    <td>{formatCell(row.label, row.L5)}</td>
                    <td>{formatCell(row.label, row.L10)}</td>
                    <td>{formatCell(row.label, row.L20)}</td>
                    <td>{formatCell(row.label, row.STD)}</td>
                    <td
                      style={{
                        color:
                          row.DIFF !== undefined
                            ? row.DIFF >= 0
                              ? "limegreen"
                              : "red"
                            : "#fff",
                      }}
                    >
                      {row.DIFF !== undefined ? `${row.DIFF.toFixed(1)}%` : "-"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9}>No data available.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* The rest of your layout sections */}
        <div className={styles.paceTable}></div>
        <div className={styles.toiLineChart}></div>
        <div className={styles.ppgLineChart}></div>
        <div className={styles.gameScoreLineChart}></div>
        <div className={styles.rateStatBarPercentiles}></div>
        <div className={styles.percentileChart}>
          <CategoryCoverageChart
            playerId={selectedPlayer?.id}
            timeOption="L30"
          />
        </div>
      </div>
    </div>
  );
};

export default WigoCharts;
