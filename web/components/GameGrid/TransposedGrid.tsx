import React, { useState } from "react";
import { addDays, format } from "date-fns";
import Image from "next/legacy/image";
import styles from "./TransposedGrid.module.scss";
import { DAYS, DAY_ABBREVIATION, EXTENDED_DAYS } from "lib/NHL/types";
import { useTeamsMap } from "hooks/useTeams";
import VerticalMatchupCell from "./VerticalMatchupCell";
import Toggle from "./Toggle";
import { startAndEndOfWeek } from "./utils/date-func";
import useSchedule from "./utils/useSchedule";

type TransposedGridProps = {
  sortedTeams: Array<{
    teamId: number;
    totalGamesPlayed: number;
    totalOffNights: number;
    weekScore: number;
    // Each day key holds game data or undefined.
    [day: string]: any;
  }>;
  games: number[];
  excludedDays: DAY_ABBREVIATION[];
  setExcludedDays: React.Dispatch<React.SetStateAction<DAY_ABBREVIATION[]>>;
  extended: boolean;
  start: string;
  mode: "7-Day" | "10-Day-Forecast";
};

export default function TransposedGrid({
  sortedTeams,
  games,
  excludedDays,
  setExcludedDays,
  extended,
  start,
  mode
}: TransposedGridProps) {
  const daysToRender = extended ? EXTENDED_DAYS : DAYS;
  const [dates] = useState<[string, string]>(() => startAndEndOfWeek());
  const [currentSchedule, currentNumGamesPerDay] = useSchedule(
    format(new Date(dates[0]), "yyyy-MM-dd"),
    mode === "10-Day-Forecast"
  );
  const teamsMap = useTeamsMap();

  // Use a state key to sort columns.
  const [teamSortKey, setTeamSortKey] = useState<
    "totalGamesPlayed" | "totalOffNights" | "weekScore"
  >("totalGamesPlayed");
  const [hoveredColumn, setHoveredColumn] = useState<number | null>(null);

  // We sort team columns by the selected key.
  const sortedTeamColumns = React.useMemo(() => {
    return [...sortedTeams].sort((a, b) => b[teamSortKey] - a[teamSortKey]);
  }, [sortedTeams, teamSortKey]);

  const sortedDays = daysToRender;

  const toggleDay = (day: DAY_ABBREVIATION) => {
    setExcludedDays((prev) => {
      const newSet = new Set(prev);
      newSet.has(day) ? newSet.delete(day) : newSet.add(day);
      return Array.from(newSet);
    });
  };

  // Compute weekScore ranking using the unsorted full list so that ranking is always by weekScore.
  const scoreRankings = React.useMemo(() => {
    const validTeams = sortedTeams.filter((team) => team.weekScore !== -100);
    const sortedByScore = [...validTeams].sort(
      (a, b) => b.weekScore - a.weekScore
    );
    const ranking: Record<number, number> = {};
    sortedByScore.forEach((team, index) => {
      ranking[team.teamId] = index + 1;
    });
    return ranking;
  }, [sortedTeams]);

  function getDailyTotalCellClass(numGames: number): string {
    return numGames <= 8 ? styles.greenBorder : styles.redBorder;
  }

  const totalWeekGames = games.reduce((acc, num) => acc + num, 0);
  const offDayCount = games.filter((num) => num <= 8).length;

  function getColorMapping(values: number[]): Record<number, string> {
    const unique = Array.from(new Set(values)).sort((a, b) => b - a);
    const mapping: Record<number, string> = {};
    if (unique.length === 1) {
      mapping[unique[0]] = "green";
    } else if (unique.length === 2) {
      mapping[unique[0]] = "green";
      mapping[unique[1]] = "red";
    } else if (unique.length === 3) {
      mapping[unique[0]] = "green";
      mapping[unique[1]] = "orange";
      mapping[unique[2]] = "red";
    } else if (unique.length === 4) {
      mapping[unique[0]] = "green";
      mapping[unique[1]] = "yellow";
      mapping[unique[2]] = "orange";
      mapping[unique[3]] = "red";
    } else {
      mapping[unique[0]] = "green";
      mapping[unique[unique.length - 1]] = "red";
      for (let i = 1; i < unique.length - 1; i++) {
        mapping[unique[i]] = "orange";
      }
    }
    return mapping;
  }

  const totalGPValues = sortedTeamColumns.map((team) => team.totalGamesPlayed);
  const totalOffValues = sortedTeamColumns.map((team) => team.totalOffNights);
  const totalGPColorMapping = getColorMapping(totalGPValues);
  const totalOffColorMapping = getColorMapping(totalOffValues);

  // For game-day cells, apply alternating backgrounds and, if ranked in top/bottom 10, use tinted versions.
  const getTeamCellClass = (teamId: number, index: number) => {
    let baseClass = "";
    const rank = scoreRankings[teamId];
    if (rank !== undefined) {
      if (rank <= 10) {
        baseClass =
          index % 2 === 0
            ? styles.altColumnGreenEven
            : styles.altColumnGreenOdd;
      } else if (rank >= sortedTeamColumns.length - 10 + 1) {
        baseClass =
          index % 2 === 0 ? styles.altColumnRedEven : styles.altColumnRedOdd;
      } else {
        baseClass = index % 2 === 0 ? styles.altColumn : styles.altColumnHover;
      }
    } else {
      baseClass = index % 2 === 0 ? styles.altColumn : styles.altColumnHover;
    }
    // Append hover class if this column is hovered.
    return hoveredColumn === index
      ? `${baseClass} ${styles.columnHovered}`
      : baseClass;
  };

  // For totals row cells, we use just the base alternating colors (no top/bottom tint).
  const getTotalsCellClass = (index: number) => {
    const baseClass =
      index % 2 === 0 ? styles.altColumn : styles.altColumnHover;
    return hoveredColumn === index
      ? `${baseClass} ${styles.columnHovered}`
      : baseClass;
  };

  return (
    <div className={styles.gridWrapper}>
      <table className={styles.transposedGrid}>
        <thead>
          <tr>
            <th className={styles.dayHeader}>
              <div className={styles.cellContent}>Day / Date</div>
            </th>
            <th>
              <div className={styles.cellContent}>Total GP</div>
            </th>
            {sortedTeamColumns.map((team, index) => {
              const teamData = teamsMap[team.teamId];
              return (
                <th
                  key={team.teamId}
                  className={getTeamCellClass(team.teamId, index)}
                  onMouseEnter={() => setHoveredColumn(index)}
                  onMouseLeave={() => setHoveredColumn(null)}
                >
                  <div className={styles.cellContent}>
                    {teamData ? (
                      <Image
                        src={teamData.logo}
                        alt={teamData.name}
                        width={30}
                        height={30}
                        objectFit="contain"
                      />
                    ) : (
                      "Team " + team.teamId
                    )}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sortedDays.map((day, dayIndex) => {
            const cellDate = format(addDays(new Date(start), dayIndex), "M/d");
            const isDisabled = excludedDays.includes(day as DAY_ABBREVIATION);
            return (
              <tr key={day} className={isDisabled ? styles.disabledRow : ""}>
                <th className={styles.dayHeader}>
                  <div className={styles.cellContent}>
                    {day} {cellDate}
                    {!extended && (
                      <Toggle
                        checked={isDisabled}
                        onChange={() => toggleDay(day as DAY_ABBREVIATION)}
                      />
                    )}
                  </div>
                </th>
                <td className={getDailyTotalCellClass(games[dayIndex] || 0)}>
                  <div className={styles.cellContent}>
                    {games[dayIndex] !== undefined ? games[dayIndex] : "-"}
                  </div>
                </td>
                {sortedTeamColumns.map((team, colIndex) => (
                  <td
                    key={team.teamId}
                    className={getTeamCellClass(team.teamId, colIndex)}
                    onMouseEnter={() => setHoveredColumn(colIndex)}
                    onMouseLeave={() => setHoveredColumn(null)}
                  >
                    <div className={styles.cellContent}>
                      {team[day] ? (
                        <VerticalMatchupCell
                          gameData={team[day]}
                          teamId={team.teamId}
                        />
                      ) : (
                        "-"
                      )}
                    </div>
                  </td>
                ))}
              </tr>
            );
          })}
          <tr className="totalsRow">
            <th
              onClick={() => setTeamSortKey("totalGamesPlayed")}
              style={{ cursor: "pointer" }}
            >
              <div className={styles.cellContent}>Total GP</div>
            </th>
            <td className={getDailyTotalCellClass(totalWeekGames)}>
              <div className={styles.cellContent}>{totalWeekGames}</div>
            </td>
            {sortedTeamColumns.map((team, colIndex) => (
              <td
                key={team.teamId}
                className={`${getTotalsCellClass(colIndex)} ${
                  styles[`${totalGPColorMapping[team.totalGamesPlayed]}Border`]
                }`}
                onMouseEnter={() => setHoveredColumn(colIndex)}
                onMouseLeave={() => setHoveredColumn(null)}
              >
                <div className={styles.cellContent}>
                  {team.totalGamesPlayed}
                </div>
              </td>
            ))}
          </tr>
          <tr className="totalsRow">
            <th
              onClick={() => setTeamSortKey("totalOffNights")}
              style={{ cursor: "pointer" }}
            >
              <div className={styles.cellContent}>Off</div>
            </th>
            <td className={getDailyTotalCellClass(offDayCount)}>
              <div className={styles.cellContent}>{offDayCount}</div>
            </td>
            {sortedTeamColumns.map((team, colIndex) => (
              <td
                key={team.teamId}
                className={`${getTotalsCellClass(colIndex)} ${
                  styles[`${totalOffColorMapping[team.totalOffNights]}Border`]
                }`}
                onMouseEnter={() => setHoveredColumn(colIndex)}
                onMouseLeave={() => setHoveredColumn(null)}
              >
                <div className={styles.cellContent}>{team.totalOffNights}</div>
              </td>
            ))}
          </tr>
          {/* Score row – uses original rank-color classes without hover/alternating effects */}
          <tr className="totalsRow">
            <th
              onClick={() => setTeamSortKey("weekScore")}
              style={{ cursor: "pointer" }}
            >
              <div className={styles.cellContent}>Score</div>
            </th>
            <td className={getDailyTotalCellClass(0)}>
              <div className={styles.cellContent}>-</div>
            </td>
            {sortedTeamColumns.map((team) => (
              <td
                key={team.teamId}
                className={
                  team.weekScore !== -100
                    ? styles[`rank-color-${scoreRankings[team.teamId]}`]
                    : ""
                }
              >
                <div className={styles.cellContent}>
                  {team.weekScore === -100 ? "-" : team.weekScore.toFixed(1)}
                </div>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
