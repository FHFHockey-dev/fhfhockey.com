import Link from "next/link";
import Image from "next/image";
import { format, parseISO } from "date-fns";
import { useEffect, useMemo, useRef, useState } from "react";

import Spinner from "components/Spinner";
import { useTeamsMap } from "hooks/useTeams";
import { teamsInfo } from "lib/teamsInfo";
import { GameData } from "lib/NHL/types";

import useDateRangeTeamGrid, {
  DateMeta,
  summarizeTeamDateRange,
  TeamDateGames,
} from "./utils/useDateRangeTeamGrid";

import styles from "./DateRangeTeamGrid.module.scss";
import GameGridContext, { GoaliePresentationProvider } from "./contexts/GameGridContext";
import GoalieMatchupCell from "./GoalieMatchupCell";
import useGoalieGameView, { GoalieGridReader } from "./utils/useGoalieGameView";
import { goalieScheduleKey } from "./utils/goalieGameView";

type DateRangeTeamGridProps = {
  start: string;
  end: string;
  goalieView?: boolean;
  onGoalieViewChange?: (enabled: boolean) => void;
  goalieReader?: GoalieGridReader;
};

type SortKey = "off" | "b2b" | "home" | "away";
type SortDirection = "ascending" | "descending";

function getOpponentTeamId(teamIds: Set<number>, game: GameData) {
  if (teamIds.has(game.homeTeam.id)) return game.awayTeam.id;
  if (teamIds.has(game.awayTeam.id)) return game.homeTeam.id;
  return game.homeTeam.id;
}

function getTeamLogo(teamId: number, teams: ReturnType<typeof useTeamsMap>) {
  const t = teams[teamId];
  if (t?.logo) return t.logo;
  const info = Object.values(teamsInfo).find((x) => x.id === teamId);
  if (info?.abbrev) return `/teamLogos/${info.abbrev}.png`;
  return "/teamLogos/FHFH.png";
}

function classForDay(game: GameData | undefined, meta: DateMeta | undefined) {
  if (game?.gameType === 1) return styles.preseasonGame;
  if (game?.gameType === 3) return styles.postseasonGame;
  const games = meta?.regularSeasonGames ?? 0;
  if (games < 7) return styles.offNight;
  if (games <= 8) return styles.mediumNight;
  if (games >= 9) return styles.heavyNight;
  return styles.normalNight;
}

export default function DateRangeTeamGrid({
  start,
  end,
  goalieView = false,
  onGoalieViewChange,
  goalieReader,
}: DateRangeTeamGridProps) {
  const teams = useTeamsMap();
  const { dates, teamDateGames, dateMetaByDate, loading, error } =
    useDateRangeTeamGrid(start, end);
  const scheduleCurrent = !loading && !error && dates[0] === start && dates.at(-1) === end;
  const games = useMemo(() => scheduleCurrent
    ? [...new Map(Object.values(teamDateGames).flatMap(byDate => Object.values(byDate)).map(game => [game.id, game])).values()]
    : [], [scheduleCurrent, teamDateGames]);
  const goaliePresentation = useGoalieGameView(games, goalieScheduleKey(games, `${start}/${end}/${scheduleCurrent}`), goalieView, goalieReader);
  const tableRef = useRef<HTMLTableElement | null>(null);
  const [monthDividerLefts, setMonthDividerLefts] = useState<number[]>([]);
  const [sortConfig, setSortConfig] = useState<{
    key: SortKey;
    direction: SortDirection;
  } | null>(null);

  const parsedRange = useMemo(() => {
    try {
      const startDate = parseISO(start);
      const endDate = parseISO(end);
      if (
        Number.isNaN(startDate.getTime()) ||
        Number.isNaN(endDate.getTime())
      ) {
        return null;
      }
      return { startDate, endDate };
    } catch {
      return null;
    }
  }, [start, end]);

  const canonicalTeams = useMemo(() => {
    return Object.entries(teamsInfo)
      .map(([abbreviation, info]) => ({
        abbreviation,
        info,
      }))
      .sort((a, b) => a.info.name.localeCompare(b.info.name));
  }, []);

  const teamRows = useMemo(() => {
    return canonicalTeams.map(({ abbreviation, info }) => {
      const canonicalId = info.id;
      const t = teams[canonicalId] ?? {
        id: canonicalId,
        name: info.name,
        abbreviation: info.abbrev ?? abbreviation,
        logo: `/teamLogos/${(info.abbrev ?? abbreviation).toUpperCase()}.png`,
      };

      const sourceIds = [canonicalId, ...(info.legacyIds ?? [])];
      const sourceIdSet = new Set<number>(sourceIds);
      const gamesByDate: Record<string, GameData> = {};
      sourceIds.forEach((id) => {
        const byDate = (teamDateGames as TeamDateGames)[id];
        if (!byDate) return;
        Object.entries(byDate).forEach(([d, g]) => {
          gamesByDate[d] = g;
        });
      });

      const { off, b2b, home, away } = summarizeTeamDateRange(
        dates,
        gamesByDate,
        dateMetaByDate,
        sourceIdSet,
      );

      return {
        teamId: canonicalId,
        team: t,
        gamesByDate,
        off,
        b2b,
        home,
        away,
        sourceIdSet,
      };
    });
  }, [canonicalTeams, teams, teamDateGames, dates, dateMetaByDate]);

  const sortedTeamRows = useMemo(() => {
    const rows = [...teamRows];
    if (!sortConfig) return rows;

    const { key, direction } = sortConfig;
    rows.sort((a, b) => {
      const aVal = a[key];
      const bVal = b[key];
      if (aVal < bVal) return direction === "ascending" ? -1 : 1;
      if (aVal > bVal) return direction === "ascending" ? 1 : -1;

      // tie-breaker: alphabetical team name
      const nameA = a.team.name.toUpperCase();
      const nameB = b.team.name.toUpperCase();
      return nameA.localeCompare(nameB);
    });
    return rows;
  }, [teamRows, sortConfig]);

  const toggleSort = (key: SortKey) => {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        return {
          key,
          direction:
            prev.direction === "ascending" ? "descending" : "ascending",
        };
      }
      return { key, direction: "descending" }; // numeric columns default to desc
    });
  };

  const ariaSortFor = (key: SortKey) => {
    if (sortConfig?.key !== key) return undefined;
    return sortConfig.direction === "ascending" ? "ascending" : "descending";
  };

  const handleSortKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    key: SortKey,
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (event.repeat) return;
      toggleSort(key);
    }
  };

  const monthStartDates = useMemo(() => {
    if (!dates.length) return [];
    return dates.filter((d) => parseISO(d).getDate() === 1);
  }, [dates]);

  useEffect(() => {
    const table = tableRef.current;
    if (!table || monthStartDates.length === 0) {
      setMonthDividerLefts([]);
      return;
    }

    const compute = () => {
      const lefts: number[] = [];
      monthStartDates.forEach((d) => {
        const th = table.querySelector<HTMLTableCellElement>(
          `th[data-date="${d}"]`,
        );
        if (!th) return;
        lefts.push(th.offsetLeft);
      });
      setMonthDividerLefts(lefts);
    };

    compute();

    const ro = new ResizeObserver(() => compute());
    ro.observe(table);

    return () => {
      ro.disconnect();
    };
  }, [monthStartDates]);

  return (
    <GameGridContext><GoaliePresentationProvider value={{ ...goaliePresentation, requested: goalieView }}>
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerBar}>
          <div>
            <h1 className={styles.title}>Date Range Grid</h1>
            <p className={styles.subtitle}>
              {parsedRange
                ? `${format(parsedRange.startDate, "MMM d, yyyy")} – ${format(
                    parsedRange.endDate,
                    "MMM d, yyyy",
                  )}`
                : `${start} – ${end}`}
            </p>
          </div>
          {onGoalieViewChange && <div role="group" aria-label="Player view" className={styles.viewControls}>
            <button type="button" aria-pressed={!goalieView} onClick={() => onGoalieViewChange(false)}>Skater</button>
            <button type="button" aria-pressed={goalieView} onClick={() => onGoalieViewChange(true)}>Goalie</button>
          </div>}
          <Link className={styles.backLink} href={`/game-grid/7-Day-Forecast${goalieView ? "?view=goalies" : ""}`}>
            Back to Game Grid
          </Link>
        </div>
      </header>

      <main className={styles.content}>
        {goalieView && <p className={styles.subtitle}>Goalie forecasts cover up to ten calendar dates from the first upcoming game. Later games show unavailable values. Scroll to see all dates; Team stays pinned.</p>}
        {!parsedRange && (
          <div className={styles.error}>Invalid date range in URL.</div>
        )}
        {error && <div className={styles.error}>{error}</div>}
        {loading && (
          <div className={styles.stateRow}>
            <Spinner />
          </div>
        )}

        {!loading && !error && parsedRange && dates.length > 0 && (
          <div className={styles.tableScroll} role={goalieView ? "region" : undefined} aria-label={goalieView ? "Goalie Date Range grid" : undefined} tabIndex={goalieView ? 0 : undefined}>
            <div className={styles.tableInner}>
              {monthDividerLefts.length > 0 && (
                <div className={styles.monthDividerOverlay} aria-hidden="true">
                  {monthDividerLefts.map((left, i) => (
                    <div
                      key={`month-divider-${i}-${left}`}
                      className={styles.monthDivider}
                      style={{ left }}
                    />
                  ))}
                </div>
              )}
              <table ref={tableRef} className={`${styles.rangeTable} ${goalieView ? styles.goalieRange : ""}`}>
                <colgroup>
                  <col style={{ width: "var(--col-team)" }} />
                  <col style={{ width: "var(--col-metric)" }} />
                  <col style={{ width: "var(--col-metric)" }} />
                  <col style={{ width: "var(--col-metric)" }} />
                  <col style={{ width: "var(--col-metric)" }} />
                  {dates.map((d) => (
                    <col key={`col-${d}`} className={styles.dayCol} />
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    <th title="Team">TEAM</th>
                    <th
                      title="Off-night games (≤8 NHL games)"
                      className={styles.sortableMetricHeader}
                      aria-sort={ariaSortFor("off")}
                    >
                      <button
                        type="button"
                        className={styles.metricSortButton}
                        aria-label="Sort by off-night games"
                        onClick={() => toggleSort("off")}
                        onKeyDown={(event) => handleSortKeyDown(event, "off")}
                      >
                        OFF
                      </button>
                    </th>
                    <th
                      title="Back-to-backs (consecutive game days)"
                      className={styles.sortableMetricHeader}
                      aria-sort={ariaSortFor("b2b")}
                    >
                      <button
                        type="button"
                        className={styles.metricSortButton}
                        aria-label="Sort by back-to-back games"
                        onClick={() => toggleSort("b2b")}
                        onKeyDown={(event) => handleSortKeyDown(event, "b2b")}
                      >
                        B2B
                      </button>
                    </th>
                    <th
                      title="Home games"
                      className={styles.sortableMetricHeader}
                      aria-sort={ariaSortFor("home")}
                    >
                      <button
                        type="button"
                        className={styles.metricSortButton}
                        aria-label="Sort by home games"
                        onClick={() => toggleSort("home")}
                        onKeyDown={(event) => handleSortKeyDown(event, "home")}
                      >
                        HOME
                      </button>
                    </th>
                    <th
                      title="Away games"
                      className={styles.sortableMetricHeader}
                      aria-sort={ariaSortFor("away")}
                    >
                      <button
                        type="button"
                        className={styles.metricSortButton}
                        aria-label="Sort by away games"
                        onClick={() => toggleSort("away")}
                        onKeyDown={(event) => handleSortKeyDown(event, "away")}
                      >
                        AWAY
                      </button>
                    </th>
                    {dates.map((d) => {
                      const dt = parseISO(d);
                      const dayLabel = format(dt, "d");
                      const isMonthStart = dt.getDate() === 1;
                      const monthLabel = isMonthStart ? format(dt, "MMM") : "";
                      return (
                        <th
                          key={d}
                          data-date={d}
                          title={format(dt, "MMM d, yyyy")}
                          className={[
                            styles.dayHeaderCell,
                            isMonthStart ? styles.monthStartHeader : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          <div className={styles.dayHeader}>
                            {monthLabel && (
                              <span className={styles.monthMarker}>
                                {monthLabel}
                              </span>
                            )}
                            <span className={styles.dayNumber}>{dayLabel}</span>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {sortedTeamRows.map((row) => {
                    return (
                      <tr key={row.teamId}>
                        <td>
                          <div className={styles.teamCell}>
                            <span className={styles.teamName}>
                              {row.team.abbreviation}
                            </span>
                            <Image
                              src={getTeamLogo(row.teamId, teams)}
                              alt={`${row.team.name} logo`}
                              width={22}
                              height={22}
                              style={{ objectFit: "contain" }}
                            />
                          </div>
                        </td>
                        <td>
                          <div className={styles.metricCell}>{row.off}</div>
                        </td>
                        <td>
                          <div className={styles.metricCell}>{row.b2b}</div>
                        </td>
                        <td>
                          <div className={styles.metricCell}>{row.home}</div>
                        </td>
                        <td>
                          <div className={styles.metricCell}>{row.away}</div>
                        </td>

                        {dates.map((d) => {
                          const g = row.gamesByDate[d];
                          const meta = dateMetaByDate[d];
                          const cls = classForDay(g, meta);
                          const wrapperClass = styles.dayCellWrapper;

                          if (!g?.id) {
                            return (
                              <td key={`${row.teamId}-${d}`}>
                                <div className={wrapperClass}>
                                  <div className={`${styles.dayCell} ${cls}`} />
                                </div>
                              </td>
                            );
                          }

                          const opponentId = getOpponentTeamId(
                            row.sourceIdSet,
                            g,
                          );
                          const opponentLogo = getTeamLogo(opponentId, teams);
                          const opponent = teams[opponentId];
                          const title = opponent
                            ? `${d}: vs ${opponent.abbreviation}`
                            : d;

                          return (
                            <td key={`${row.teamId}-${d}`}>
                              <div className={wrapperClass} title={title}>
                                <div className={`${styles.dayCell} ${cls}`}>
                                  <GoalieMatchupCell game={g} teamId={row.sourceIdSet.has(g.homeTeam.id) ? g.homeTeam.id : g.awayTeam.id} fallback={<Image
                                    src={opponentLogo}
                                    alt={
                                      opponent ? opponent.name : "Opponent logo"
                                    }
                                    width={22}
                                    height={22}
                                    style={{ objectFit: "contain" }}
                                  />} />
                                </div>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
    </GoaliePresentationProvider></GameGridContext>
  );
}
