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
  TeamDateGames
} from "./utils/useDateRangeTeamGrid";

import styles from "./DateRangeTeamGrid.module.scss";

type DateRangeTeamGridProps = {
  start: string;
  end: string;
};

type SortKey = "off" | "b2b" | "home" | "away";
type SortDirection = "ascending" | "descending";

function getOpponentTeamId(teamId: number, game: GameData) {
  if (game.homeTeam.id === teamId) return game.awayTeam.id;
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

function computeBackToBacks(dates: string[], gamesByDate: Record<string, GameData>) {
  let count = 0;
  for (let i = 0; i < dates.length - 1; i++) {
    const a = gamesByDate[dates[i]];
    const b = gamesByDate[dates[i + 1]];
    if (a?.id && b?.id) count++;
  }
  return count;
}

export default function DateRangeTeamGrid({ start, end }: DateRangeTeamGridProps) {
  const teams = useTeamsMap();
  const { dates, teamDateGames, dateMetaByDate, loading, error } =
    useDateRangeTeamGrid(start, end);
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
      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
        return null;
      }
      return { startDate, endDate };
    } catch {
      return null;
    }
  }, [start, end]);

  const teamIds = useMemo(() => {
    return Object.values(teams)
      .map((t) => t.id)
      .sort((a, b) => {
        const nameA = teams[a]?.name?.toUpperCase() ?? "";
        const nameB = teams[b]?.name?.toUpperCase() ?? "";
        return nameA.localeCompare(nameB);
      });
  }, [teams]);

  const teamRows = useMemo(() => {
    return teamIds.map((teamId) => {
      const t = teams[teamId];
      const gamesByDate: Record<string, GameData> =
        (teamDateGames as TeamDateGames)[teamId] ?? {};

      const off = dates.reduce((acc, d) => {
        const g = gamesByDate[d];
        const meta = dateMetaByDate[d];
        if (g?.gameType === 2 && (meta?.regularSeasonGames ?? 0) <= 8) return acc + 1;
        return acc;
      }, 0);

      const b2b = computeBackToBacks(dates, gamesByDate);

      const { home, away } = dates.reduce(
        (acc, d) => {
          const g = gamesByDate[d];
          if (!g?.id) return acc;
          if (g.homeTeam.id === teamId) acc.home++;
          if (g.awayTeam.id === teamId) acc.away++;
          return acc;
        },
        { home: 0, away: 0 }
      );

      return { teamId, team: t, gamesByDate, off, b2b, home, away };
    });
  }, [teamIds, teams, teamDateGames, dates, dateMetaByDate]);

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
      const nameA = a.team?.name?.toUpperCase() ?? "";
      const nameB = b.team?.name?.toUpperCase() ?? "";
      return nameA.localeCompare(nameB);
    });
    return rows;
  }, [teamRows, sortConfig]);

  const toggleSort = (key: SortKey) => {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        return {
          key,
          direction: prev.direction === "ascending" ? "descending" : "ascending"
        };
      }
      return { key, direction: "descending" }; // numeric columns default to desc
    });
  };

  const ariaSortFor = (key: SortKey) => {
    if (sortConfig?.key !== key) return undefined;
    return sortConfig.direction === "ascending" ? "ascending" : "descending";
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
        const th = table.querySelector<HTMLTableCellElement>(`th[data-date="${d}"]`);
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
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerBar}>
          <div>
            <h1 className={styles.title}>Date Range Grid</h1>
            <p className={styles.subtitle}>
              {parsedRange
                ? `${format(parsedRange.startDate, "MMM d, yyyy")} – ${format(
                    parsedRange.endDate,
                    "MMM d, yyyy"
                  )}`
                : `${start} – ${end}`}
            </p>
          </div>
          <Link className={styles.backLink} href="/game-grid/7-Day-Forecast">
            Back to Game Grid
          </Link>
        </div>
      </header>

      <main className={styles.content}>
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
          <div className={styles.tableScroll}>
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
              <table ref={tableRef} className={styles.rangeTable}>
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
                      role="button"
                      tabIndex={0}
                      aria-sort={ariaSortFor("off")}
                      onClick={() => toggleSort("off")}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggleSort("off");
                        }
                      }}
                    >
                      OFF
                    </th>
                    <th
                      title="Back-to-backs (consecutive game days)"
                      className={styles.sortableMetricHeader}
                      role="button"
                      tabIndex={0}
                      aria-sort={ariaSortFor("b2b")}
                      onClick={() => toggleSort("b2b")}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggleSort("b2b");
                        }
                      }}
                    >
                      B2B
                    </th>
                    <th
                      title="Home games"
                      className={styles.sortableMetricHeader}
                      role="button"
                      tabIndex={0}
                      aria-sort={ariaSortFor("home")}
                      onClick={() => toggleSort("home")}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggleSort("home");
                        }
                      }}
                    >
                      HOME
                    </th>
                    <th
                      title="Away games"
                      className={styles.sortableMetricHeader}
                      role="button"
                      tabIndex={0}
                      aria-sort={ariaSortFor("away")}
                      onClick={() => toggleSort("away")}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggleSort("away");
                        }
                      }}
                    >
                      AWAY
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
                          isMonthStart ? styles.monthStartHeader : ""
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        <div className={styles.dayHeader}>
                          {monthLabel && (
                            <span className={styles.monthMarker}>{monthLabel}</span>
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
                  if (!row.team) return null;

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
                            width={18}
                            height={18}
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

                        const opponentId = getOpponentTeamId(row.teamId, g);
                        const opponentLogo = getTeamLogo(opponentId, teams);
                        const opponent = teams[opponentId];
                        const title = opponent
                          ? `${d}: vs ${opponent.abbreviation}`
                          : d;

                        return (
                          <td key={`${row.teamId}-${d}`}>
                            <div className={wrapperClass} title={title}>
                              <div className={`${styles.dayCell} ${cls}`}>
                                <Image
                                  src={opponentLogo}
                                  alt={opponent ? opponent.name : "Opponent logo"}
                                  width={14}
                                  height={14}
                                  style={{ objectFit: "contain" }}
                                />
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
  );
}
