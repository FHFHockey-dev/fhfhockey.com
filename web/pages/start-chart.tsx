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
  ctpi: { date: string; value: number | null }[];
  games: GameRow[];
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const POSITION_ORDER = ["C", "LW", "RW", "D", "G"] as const;

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
    return data.ctpi.filter((d) => d.value != null);
  }, [data?.ctpi]);

  const togglePos = (pos: string) =>
    setPosFilter((prev) => ({ ...prev, [pos]: !prev[pos] }));

  return (
    <div className={styles.page}>
      <Head>
        <title>Start Chart</title>
      </Head>

      <section className={styles.chartPanel}>
        <div className={styles.chartHeader}>
          <div className={styles.chartTitle}>CTPI Pulse</div>
          <div className={styles.meta}>Date: {data?.dateUsed ?? date}</div>
        </div>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={ctpiData}>
            <XAxis dataKey="date" tick={{ fill: "#9ea7b3" }} />
            <YAxis domain={[0, 100]} width={30} tick={{ fill: "#9ea7b3" }} />
            <Tooltip
              contentStyle={{
                background: "rgba(0,0,0,0.8)",
                border: "1px solid #333",
                color: "#fff"
              }}
              labelStyle={{ color: "#fff" }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="var(--primary-color, #3bd4ae)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
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

            const renderGoalie = (goalies?: GoalieInfo[]) => {
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

                    const name = g.name.split(" ").pop();
                    const showText = i === 0; // Only show text for the top goalie

                    return (
                      <div
                        key={g.player_id}
                        className={styles.goalieSegment}
                        style={{
                          width: `${prob}%`,
                          backgroundColor: barColor
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

            const renderRating = (rating?: TeamRating) => {
              if (!rating) return null;
              return (
                <div className={styles.teamRating}>
                  <div className={styles.ratingRow}>
                    <span className={styles.ratingLabel}>OFF</span>
                    <span className={styles.ratingValue}>
                      {rating.offRating.toFixed(0)}
                    </span>
                  </div>
                  <div className={styles.ratingRow}>
                    <span className={styles.ratingLabel}>DEF</span>
                    <span className={styles.ratingValue}>
                      {rating.defRating.toFixed(0)}
                    </span>
                  </div>
                </div>
              );
            };

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
                    {renderRating(g.awayRating)}
                  </div>
                  {renderGoalie(g.awayGoalies)}
                </div>

                {/* Divider */}
                <div className={styles.gameDivider}>
                  <div className={styles.dividerLine} />
                  <div className={styles.vsCircle}>vs</div>
                  <div className={styles.dividerLine} />
                </div>

                {/* Home Team */}
                <div className={styles.teamRow}>
                  <div className={styles.teamRowHeader}>
                    <div className={styles.teamIdentity}>
                      {home?.abbrev && (
                        <img
                          src={`/teamLogos/${home.abbrev}.png`}
                          alt={home.abbrev}
                          className={styles.teamLogo}
                        />
                      )}
                      <span className={styles.teamAbbrev}>{home?.abbrev}</span>
                    </div>
                    {renderRating(g.homeRating)}
                  </div>
                  {renderGoalie(g.homeGoalies)}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* Legend */}
      <section className={styles.legend}>
        <div className={styles.legendItem}>
          <strong>CTPI (Cumulative Team Power Index):</strong> Measures overall
          team strength based on recent performance metrics like xG, Corsi, and
          PDO.
        </div>
        <div className={styles.legendItem}>
          <strong>PTS (Fantasy Points):</strong> Projected fantasy points based
          on standard scoring (G=3, A=2, SOG=0.4, etc.).
        </div>
        <div className={styles.legendItem}>
          <strong>MATCHUP:</strong> A 0-100 grade indicating the favorability of
          the opponent (100 = easiest matchup).
        </div>
        <div className={styles.legendItem}>
          <strong>G / A / SOG:</strong> Projected Goals, Assists, and Shots on
          Goal for this specific game.
        </div>
      </section>

      <section className={styles.filters}>
        <div className={styles.filterGroup}>
          <label>Date</label>
          <input
            type="date"
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

        <div className={styles.filterGroup}>
          <label>Search</label>
          <input
            className={styles.search}
            placeholder="Player name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
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
                          {p.team_abbrev ?? "??"} vs {p.opponent_abbrev ?? "??"}
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

                    <div className={styles.meta} style={{ marginTop: "auto" }}>
                      <span>
                        Own:{" "}
                        {p.percent_ownership != null
                          ? `${p.percent_ownership.toFixed(0)}%`
                          : "n/a"}
                      </span>
                    </div>

                    <div className={styles.gamesRemaining}>
                      {p.games_remaining_week} Games Remaining
                    </div>
                  </div>
                ))
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}
