import { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import useSWR from "swr";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import styles from "./start-chart.module.scss";

import { teamsInfo } from "lib/teamsInfo";

type StartChartPlayer = {
  player_id: number;
  name: string;
  positions: string[];
  ownership: number | null;
  percent_ownership: number | null;
  opponent_abbrev: string | null;
  team_id?: number | null;
  team_abbrev: string | null;
  proj_fantasy_points: number | null;
  proj_goals: number | null;
  proj_assists: number | null;
  proj_shots: number | null;
  matchup_grade: number | null;
  start_probability?: number | null;
  projected_gsaa?: number | null;
  games_remaining_week?: number;
};

type TeamRating = {
  offRating: number;
  defRating: number;
  paceRating: number;
  ppTier: number;
  pkTier: number;
  trend10: number;
};

type GoalieInfo = {
  player_id: number;
  name: string;
  start_probability: number | null;
  projected_gsaa_per_60: number | null;
  confirmed_status: boolean | null;
};

type GameRow = {
  id: number;
  date: string;
  homeTeamId: number;
  awayTeamId: number;
  homeRating?: TeamRating;
  awayRating?: TeamRating;
  homeGoalies?: GoalieInfo[];
  awayGoalies?: GoalieInfo[];
};

type ApiResponse = {
  dateUsed: string;
  projections: number;
  players: StartChartPlayer[];
  ctpi: ({ date: string } & Record<string, number | null>)[];
  games: GameRow[];
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const POSITION_ORDER = ["C", "LW", "RW", "D", "G"] as const;

// Helper to calculate color distance
const getColorDistance = (hex1: string, hex2: string) => {
  const r1 = parseInt(hex1.slice(1, 3), 16);
  const g1 = parseInt(hex1.slice(3, 5), 16);
  const b1 = parseInt(hex1.slice(5, 7), 16);
  const r2 = parseInt(hex2.slice(1, 3), 16);
  const g2 = parseInt(hex2.slice(3, 5), 16);
  const b2 = parseInt(hex2.slice(5, 7), 16);
  return Math.sqrt(
    Math.pow(r1 - r2, 2) + Math.pow(g1 - g2, 2) + Math.pow(b1 - b2, 2)
  );
};

// Helper to adjust color brightness
const adjustBrightness = (hex: string, percent: number) => {
  const num = parseInt(hex.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = ((num >> 8) & 0x00ff) + amt;
  const B = (num & 0x0000ff) + amt;
  return (
    "#" +
    (
      0x1000000 +
      (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
      (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
      (B < 255 ? (B < 1 ? 0 : B) : 255)
    )
      .toString(16)
      .slice(1)
  );
};

const CustomDot = (props: any) => {
  const { cx, cy, index, dataKey, payload } = props;
  // Only render for the last data point
  // We need to know the total length of the data array.
  // Recharts passes `points` array in some contexts, but here we might need to check payload or index.
  // However, `payload` is the data object for this point.
  // A simpler way is to check if this is the last point in the dataset.
  // But `props` doesn't directly give us `data.length`.
  // We can pass `dataLength` as a custom prop if we wrap this.
  // Alternatively, we can check if the date matches the last date in the dataset.

  if (!props.isLast) return null;

  return (
    <image
      x={cx - 10}
      y={cy - 10}
      width={20}
      height={20}
      href={`/teamLogos/${dataKey}.png`}
    />
  );
};

const RenderGoalie = ({ goalies }: { goalies?: GoalieInfo[] }) => {
  if (!goalies || goalies.length === 0) return null;

  return (
    <div className={styles.goalieBarContainer}>
      {goalies.map((g, i) => {
        const prob = (g.start_probability ?? 0) * 100;
        if (prob < 5) return null; // Hide < 5% to avoid clutter

        // Color logic
        let barColor = "#ef476f"; // redish
        if (prob >= 80)
          barColor = "#3bd4ae"; // green
        else if (prob >= 50)
          barColor = "#ffd166"; // yellow
        else if (prob >= 30)
          barColor = "#118ab2"; // blueish
        else barColor = "#6c757d"; // gray

        const hexToRgba = (hex: string, alpha: number) => {
          const r = parseInt(hex.slice(1, 3), 16);
          const g = parseInt(hex.slice(3, 5), 16);
          const b = parseInt(hex.slice(5, 7), 16);
          return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        };

        const name = g.name.split(" ").pop();
        const showText = i === 0; // Only show text for the top goalie

        return (
          <div
            key={g.player_id}
            className={styles.goalieSegment}
            style={{
              width: `${prob}%`,
              backgroundColor: hexToRgba(barColor, 0.4),
              borderColor: barColor
            }}
            title={`${g.name} (${prob.toFixed(0)}%)`}
          >
            {showText && prob > 20 && (
              <span className={styles.goalieSegmentText}>
                {name} {prob.toFixed(0)}%
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};

const RenderRating = ({
  rating,
  opponentRating
}: {
  rating?: TeamRating;
  opponentRating?: TeamRating;
}) => {
  if (!rating) return null;

  let offClass = "";
  let defClass = "";

  if (opponentRating) {
    if (rating.offRating > opponentRating.offRating)
      offClass = styles.glowGreen;
    else if (rating.offRating < opponentRating.offRating)
      offClass = styles.glowRed;

    if (rating.defRating > opponentRating.defRating)
      defClass = styles.glowGreen;
    else if (rating.defRating < opponentRating.defRating)
      defClass = styles.glowRed;
  }

  return (
    <div className={styles.teamRating}>
      <div className={styles.ratingRow}>
        <span className={styles.ratingLabel}>OFF</span>
        <span className={`${styles.ratingValue} ${offClass}`}>
          {rating.offRating.toFixed(0)}
        </span>
      </div>
      <div className={styles.ratingRow}>
        <span className={styles.ratingLabel}>DEF</span>
        <span className={`${styles.ratingValue} ${defClass}`}>
          {rating.defRating.toFixed(0)}
        </span>
      </div>
    </div>
  );
};

export default function StartChartPage() {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [date, setDate] = useState(today);
  const [search, setSearch] = useState("");
  const [ownershipMax, setOwnershipMax] = useState(50);
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null);
  const [posFilter, setPosFilter] = useState<Record<string, boolean>>({
    C: true,
    LW: true,
    RW: true,
    D: true,
    G: true
  });

  const { data, isLoading, mutate } = useSWR<ApiResponse>(
    `/api/v1/start-chart?date=${date}`,
    fetcher
  );

  useEffect(() => {
    mutate();
  }, [date, mutate]);

  const filteredByUi = useMemo(() => {
    if (!data?.players) return [];

    // If a game is selected, find the two team IDs involved
    let allowedTeamIds: Set<number> | null = null;
    if (selectedGameId && data.games) {
      const game = data.games.find((g) => g.id === selectedGameId);
      if (game) {
        allowedTeamIds = new Set([game.homeTeamId, game.awayTeamId]);
      }
    }

    return data.players.filter((p) => {
      const owned = p.ownership ?? p.percent_ownership;
      const ownedVal = owned == null ? 0 : owned; // if unknown, treat as 0% owned
      const passesOwnership = ownedVal <= ownershipMax;
      const passesSearch = !search
        ? true
        : p.name.toLowerCase().includes(search.toLowerCase());
      const hasAllowedPos =
        p.positions.length === 0
          ? true
          : p.positions.some((pos) => posFilter[pos]);

      const passesGameFilter = allowedTeamIds
        ? p.team_id != null && allowedTeamIds.has(p.team_id)
        : true;

      return (
        passesOwnership && passesSearch && hasAllowedPos && passesGameFilter
      );
    });
  }, [
    data?.players,
    ownershipMax,
    search,
    posFilter,
    selectedGameId,
    data?.games
  ]);

  const playersByPos = useMemo(() => {
    const map = new Map<string, StartChartPlayer[]>();
    POSITION_ORDER.forEach((p) => map.set(p, []));
    filteredByUi.forEach((p) => {
      p.positions.forEach((pos) => {
        if (map.has(pos)) {
          map.get(pos)!.push(p);
        }
      });
    });
    POSITION_ORDER.forEach((pos) => {
      map.set(
        pos,
        (map.get(pos) ?? []).sort((a, b) => {
          if (pos === "G") {
            return (b.start_probability ?? 0) - (a.start_probability ?? 0);
          }
          return (b.proj_fantasy_points ?? 0) - (a.proj_fantasy_points ?? 0);
        })
      );
    });
    return map;
  }, [filteredByUi]);

  const ctpiData = useMemo(() => {
    if (!data?.ctpi) return [];
    return data.ctpi;
  }, [data?.ctpi]);

  const teamsPlaying = useMemo(() => {
    if (!data?.games) return [];
    const teams = new Set<string>();
    data.games.forEach((g) => {
      const home = Object.values(teamsInfo).find((t) => t.id === g.homeTeamId);
      const away = Object.values(teamsInfo).find((t) => t.id === g.awayTeamId);
      if (home?.abbrev) teams.add(home.abbrev);
      if (away?.abbrev) teams.add(away.abbrev);
    });
    return Array.from(teams);
  }, [data?.games]);

  const teamColors = useMemo(() => {
    const colors: Record<string, string> = {};
    const usedColors: string[] = [];

    teamsPlaying.forEach((abbrev) => {
      const team = Object.values(teamsInfo).find((t) => t.abbrev === abbrev);
      if (!team) return;

      let color = team.primaryColor;
      let isTooClose = usedColors.some((c) => getColorDistance(c, color) < 50);

      if (isTooClose) {
        // Try secondary
        color = team.secondaryColor;
        isTooClose = usedColors.some((c) => getColorDistance(c, color) < 50);
      }

      if (isTooClose) {
        // Try lightening primary
        color = adjustBrightness(team.primaryColor, 40);
        isTooClose = usedColors.some((c) => getColorDistance(c, color) < 50);
      }

      if (isTooClose) {
        // Try darkening primary
        color = adjustBrightness(team.primaryColor, -40);
      }

      colors[abbrev] = color;
      usedColors.push(color);
    });

    return colors;
  }, [teamsPlaying]);

  const yAxisDomain = useMemo(() => {
    if (!ctpiData || ctpiData.length === 0) return [0, 100];
    let min = 100;
    let max = 0;

    ctpiData.forEach((row) => {
      teamsPlaying.forEach((team) => {
        const val = row[team];
        if (typeof val === "number") {
          if (val < min) min = val;
          if (val > max) max = val;
        }
      });
    });

    if (min > max) return [0, 100]; // No data

    return [
      Math.max(0, Math.floor(min - 5)),
      Math.min(100, Math.ceil(max + 5))
    ];
  }, [ctpiData, teamsPlaying]);

  const togglePos = (pos: string) =>
    setPosFilter((prev) => ({ ...prev, [pos]: !prev[pos] }));

  return (
    <div className={styles.page}>
      <Head>
        <title>Start Chart</title>
      </Head>

      <div style={{ marginBottom: "1rem" }}>
        <a href="/trends">Visit the unified dashboard →</a>
      </div>

      <section className={styles.chartPanel}>
        <div className={styles.chartHeader}>
          <div className={styles.chartTitle}>CTPI Pulse</div>
          <div className={styles.meta}>Date: {data?.dateUsed ?? date}</div>
        </div>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={ctpiData} margin={{ right: 20 }}>
            <XAxis
              dataKey="date"
              tick={{ fill: "#9ea7b3" }}
              padding={{ right: 20 }}
            />
            <YAxis domain={yAxisDomain} width={30} tick={{ fill: "#9ea7b3" }} />
            <Tooltip
              contentStyle={{
                background: "rgba(0,0,0,0.8)",
                border: "1px solid #333",
                color: "#fff"
              }}
              labelStyle={{ color: "#fff" }}
            />
            {teamsPlaying.map((abbrev) => {
              return (
                <Line
                  key={abbrev}
                  type="monotone"
                  dataKey={abbrev}
                  stroke={teamColors[abbrev] ?? "#fff"}
                  strokeWidth={2}
                  dot={(props: any) => {
                    const isLast = props.index === ctpiData.length - 1;
                    return (
                      <CustomDot {...props} dataKey={abbrev} isLast={isLast} />
                    );
                  }}
                  activeDot={{ r: 4 }}
                  name={abbrev}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </section>

      {/* Game Strip */}
      {data?.games && data.games.length > 0 && (
        <section className={styles.gameStrip}>
          {data.games.map((g) => {
            const home = Object.values(teamsInfo).find(
              (t) => t.id === g.homeTeamId
            );
            const away = Object.values(teamsInfo).find(
              (t) => t.id === g.awayTeamId
            );
            const isSelected = selectedGameId === g.id;

            return (
              <div
                key={g.id}
                className={`${styles.gameCard} ${
                  isSelected ? styles.selected : ""
                }`}
                onClick={() => setSelectedGameId(isSelected ? null : g.id)}
                style={
                  {
                    "--away-color": away?.primaryColor ?? "#333",
                    "--home-color": home?.primaryColor ?? "#333"
                  } as React.CSSProperties
                }
              >
                {/* Away Team */}
                <div className={styles.teamRow}>
                  <div className={styles.teamRowHeader}>
                    <div className={styles.teamIdentity}>
                      {away?.abbrev && (
                        <img
                          src={`/teamLogos/${away.abbrev}.png`}
                          alt={away.abbrev}
                          className={styles.teamLogo}
                        />
                      )}
                      <span className={styles.teamAbbrev}>{away?.abbrev}</span>
                    </div>
                    <RenderRating
                      rating={g.awayRating}
                      opponentRating={g.homeRating}
                    />
                  </div>
                  <RenderGoalie goalies={g.awayGoalies} />
                </div>

                {/* Divider */}
                <div className={styles.gameDivider}>
                  <div className={styles.dividerLine} />
                  <div className={styles.vsCircle}>vs</div>
                  <div className={styles.dividerLine} />
                </div>

                {/* Home Team */}
                <div className={styles.teamRow}>
                  <div className={`${styles.teamRowHeader} ${styles.reverse}`}>
                    <div className={`${styles.teamIdentity} ${styles.reverse}`}>
                      {home?.abbrev && (
                        <img
                          src={`/teamLogos/${home.abbrev}.png`}
                          alt={home.abbrev}
                          className={styles.teamLogo}
                        />
                      )}
                      <span className={styles.teamAbbrev}>{home?.abbrev}</span>
                    </div>
                    <RenderRating
                      rating={g.homeRating}
                      opponentRating={g.awayRating}
                    />
                  </div>
                  <RenderGoalie goalies={g.homeGoalies} />
                </div>
              </div>
            );
          })}
        </section>
      )}

      <section className={styles.filters}>
        <div className={styles.filterGroup}>
          <input
            className={styles.search}
            placeholder="Player name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className={styles.filterGroup}>
          <label>Date</label>
          <input
            type="date"
            className={styles.dateInput}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <div className={styles.filterGroup}>
          <label>Positions</label>
          <div className={styles.checkboxRow}>
            {POSITION_ORDER.map((pos) => (
              <label key={pos}>
                <input
                  type="checkbox"
                  checked={posFilter[pos]}
                  onChange={() => togglePos(pos)}
                />{" "}
                {pos}
              </label>
            ))}
          </div>
        </div>

        <div className={styles.filterGroup}>
          <label>Ownership ≤ {ownershipMax}%</label>
          <input
            className={styles.rangeInput}
            type="range"
            min={0}
            max={100}
            value={ownershipMax}
            onChange={(e) => setOwnershipMax(Number(e.target.value))}
          />
        </div>

        <div className={styles.legendContainer}>
          <div className={styles.legendIcon}>i</div>
          <div className={styles.legendTooltip}>
            <div className={styles.legendItem}>
              <strong>CTPI (Cumulative Team Power Index):</strong> Measures
              overall team strength based on recent performance metrics like xG,
              Corsi, and PDO.
            </div>
            <div className={styles.legendItem}>
              <strong>PTS (Fantasy Points):</strong> Projected fantasy points
              based on standard scoring (G=3, A=2, SOG=0.4, etc.).
            </div>
            <div className={styles.legendItem}>
              <strong>MATCHUP:</strong> A 0-100 grade indicating the
              favorability of the opponent (100 = easiest matchup).
            </div>
            <div className={styles.legendItem}>
              <strong>G / A / SOG:</strong> Projected Goals, Assists, and Shots
              on Goal for this specific game.
            </div>
          </div>
        </div>
      </section>

      <section className={styles.columns}>
        {data?.games && data.games.length > 0 && data.players.length === 0 && (
          <div
            style={{
              gridColumn: "1 / -1",
              padding: "2rem",
              textAlign: "center",
              color: "#ff6b6b",
              background: "rgba(255, 107, 107, 0.1)",
              border: "1px solid rgba(255, 107, 107, 0.3)",
              borderRadius: "8px",
              marginBottom: "1rem"
            }}
          >
            <strong>No Player Projections Found</strong>
            <p style={{ fontSize: "0.9em", marginTop: "0.5rem", opacity: 0.8 }}>
              We found {data.games.length} games for this date, but the player
              projections have not been populated yet. Please check back later.
            </p>
          </div>
        )}
        {POSITION_ORDER.map((pos) => {
          const list = playersByPos.get(pos) ?? [];
          const className = `${styles.column} ${
            styles[`pos${pos as typeof pos}`]
          }`;
          return (
            <div className={className} key={pos}>
              <div className={styles.columnHeader}>
                <span>{pos}</span>
                <span className={styles.pill}>{list.length}</span>
              </div>
              <div className={styles.cardList}>
                {isLoading ? (
                  <div className={styles.meta}>Loading...</div>
                ) : list.length === 0 ? (
                  <div className={styles.emptyState}>No players.</div>
                ) : (
                  list.map((p) => (
                    <div className={styles.card} key={`${pos}-${p.player_id}`}>
                      <div className={styles.header}>
                        <div className={styles.name} title={p.name}>
                          {p.name}
                        </div>
                        <div className={styles.meta}>
                          <span>
                            {p.team_abbrev ?? "??"} vs{" "}
                            {p.opponent_abbrev ?? "??"}
                          </span>
                        </div>
                      </div>

                      <div className={styles.statsContainer}>
                        {pos === "G" ? (
                          <>
                            <div className={styles.statBox}>
                              <div className={styles.statLabel}>Start %</div>
                              <div className={styles.statValue}>
                                {p.start_probability != null
                                  ? `${(p.start_probability * 100).toFixed(0)}%`
                                  : "--"}
                              </div>
                            </div>
                            <div className={styles.statBox}>
                              <div className={styles.statLabel}>GSAA</div>
                              <div className={styles.statValue}>
                                {(p.projected_gsaa ?? 0).toFixed(2)}
                              </div>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className={styles.statBox}>
                              <div className={styles.statLabel}>PTS</div>
                              <div className={styles.statValue}>
                                {(p.proj_fantasy_points ?? 0).toFixed(2)}
                              </div>
                            </div>

                            {/* Combined G/A/SOG Box */}
                            <div className={styles.statBox}>
                              <div className={styles.splitStatRow}>
                                <div className={styles.splitStatItem}>
                                  <div className={styles.statLabel}>G</div>
                                  <div className={styles.statValue}>
                                    {(p.proj_goals ?? 0).toFixed(1)}
                                  </div>
                                </div>
                                <div className={styles.splitStatDivider} />
                                <div className={styles.splitStatItem}>
                                  <div className={styles.statLabel}>A</div>
                                  <div className={styles.statValue}>
                                    {(p.proj_assists ?? 0).toFixed(1)}
                                  </div>
                                </div>
                                <div className={styles.splitStatDivider} />
                                <div className={styles.splitStatItem}>
                                  <div className={styles.statLabel}>S</div>
                                  <div className={styles.statValue}>
                                    {(p.proj_shots ?? 0).toFixed(1)}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </>
                        )}

                        <div className={styles.statBox}>
                          <div className={styles.statLabel}>Matchup</div>
                          <div className={styles.statValue}>
                            {p.matchup_grade != null
                              ? p.matchup_grade.toFixed(0)
                              : "--"}
                          </div>
                        </div>
                      </div>

                      <div
                        className={styles.meta}
                        style={{ marginTop: "auto" }}
                      >
                        <span>
                          Own:{" "}
                          {p.percent_ownership != null
                            ? `${p.percent_ownership.toFixed(0)}%`
                            : "n/a"}
                        </span>
                      </div>

                      <div className={styles.gamesRemaining}>
                        <span
                          className={
                            p.games_remaining_week === 4
                              ? styles.gamesRemaining4
                              : p.games_remaining_week === 3
                                ? styles.gamesRemaining3
                                : p.games_remaining_week === 2
                                  ? styles.gamesRemaining2
                                  : p.games_remaining_week === 1
                                    ? styles.gamesRemaining1
                                    : ""
                          }
                        >
                          {p.games_remaining_week} Games Remaining
                        </span>{" "}
                        <span style={{ color: "#fff" }}>This Week</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
