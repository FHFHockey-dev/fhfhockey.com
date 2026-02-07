import { useState, useEffect, useMemo } from "react";
import type { NextPage } from "next";
import Head from "next/head";
import Image from "next/image";
import styles from "styles/Forge.module.scss";
import classNames from "classnames";

type StatUncertainty = {
  p10: number;
  p50: number;
  p90: number;
};

type AccuracyPoint = {
  date: string;
  accuracy: number;
};

type PlayerProjection = {
  player_id: number;
  player_name: string;
  team_name: string;
  position: string;
  g: number;
  a: number;
  pts: number;
  ppp: number;
  sog: number;
  hit: number;
  blk: number;
  fw: number;
  fl: number;
  uncertainty: {
    g?: StatUncertainty;
    a?: StatUncertainty;
    pts?: StatUncertainty;
    ppp?: StatUncertainty;
    sog?: StatUncertainty;
    hit?: StatUncertainty;
    blk?: StatUncertainty;
    fw?: StatUncertainty;
    fl?: StatUncertainty;
  };
};

type GoalieProjection = {
  goalie_id: number;
  goalie_name: string;
  team_name: string;
  team_abbreviation: string;
  opponent_team_name: string;
  opponent_team_abbreviation: string;
  starter_probability: number;
  proj_shots_against: number;
  proj_saves: number;
  proj_goals_allowed: number;
  proj_win_prob: number;
  proj_shutout_prob: number;
  modeled_save_pct: number | null;
  volatility_index: number | null;
  blowup_risk: number | null;
  confidence_tier: string | null;
  quality_tier: string | null;
  reliability_tier: string | null;
  recommendation: string | null;
  uncertainty: {
    saves?: StatUncertainty;
    goals_allowed?: StatUncertainty;
  };
};

const getPositionClass = (position: string) => {
  switch (position) {
    case "C":
      return styles["pos-C"];
    case "L":
    case "LW":
      return styles["pos-LW"];
    case "R":
    case "RW":
      return styles["pos-RW"];
    case "D":
      return styles["pos-D"];
    case "G":
      return styles["pos-G"];
    default:
      return "";
  }
};

const formatUncertaintyValue = (value?: number) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  return value.toFixed(2);
};

const formatPercent = (value: number | null | undefined) => {
  if (value == null || Number.isNaN(value)) return "--";
  return `${(value * 100).toFixed(1)}%`;
};

const clampPercent = (value: number) => Math.max(0, Math.min(100, value));

const FORGEPage: NextPage = () => {
  const [viewMode, setViewMode] = useState<"skaters" | "goalies">("skaters");
  const [projections, setProjections] = useState<PlayerProjection[]>([]);
  const [goalieProjections, setGoalieProjections] = useState<GoalieProjection[]>([]);
  const [loading, setLoading] = useState(true);
  const [goalieLoading, setGoalieLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [goalieError, setGoalieError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTeam, setSelectedTeam] = useState("");
  const [selectedPosition, setSelectedPosition] = useState("");
  const [accuracySeries, setAccuracySeries] = useState<AccuracyPoint[]>([]);
  const [accuracyLoading, setAccuracyLoading] = useState(true);
  const [accuracyError, setAccuracyError] = useState<string | null>(null);
  const [accuracyPlaceholder, setAccuracyPlaceholder] = useState(false);

  useEffect(() => {
    const fetchProjections = async () => {
      try {
        const res = await fetch("/api/v1/forge/players");
        if (!res.ok) {
          throw new Error("Failed to fetch skater projections");
        }
        const data = await res.json();
        const normalizedData = (data.data ?? []).map((p: PlayerProjection) => ({
          ...p,
          position:
            p.position === "L" ? "LW" : p.position === "R" ? "RW" : p.position
        }));
        setProjections(normalizedData);
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("An unknown error occurred");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchProjections();
  }, []);

  useEffect(() => {
    const fetchGoalies = async () => {
      try {
        const res = await fetch("/api/v1/forge/goalies");
        if (!res.ok) throw new Error("Failed to fetch goalie projections");
        const data = await res.json();
        setGoalieProjections(data.data ?? []);
      } catch (err) {
        if (err instanceof Error) setGoalieError(err.message);
        else setGoalieError("An unknown error occurred");
      } finally {
        setGoalieLoading(false);
      }
    };

    fetchGoalies();
  }, []);

  useEffect(() => {
    const fetchAccuracy = async () => {
      try {
        setAccuracyLoading(true);
        setAccuracyPlaceholder(false);
        setAccuracyError(null);
        const scope = viewMode === "goalies" ? "goalie" : "skater";
        const res = await fetch(`/api/v1/forge/accuracy?scope=${scope}`);
        if (!res.ok) {
          throw new Error("Failed to fetch accuracy data");
        }
        const data = await res.json();
        const series = (data.data ?? []).map((point: AccuracyPoint) => ({
          date: point.date,
          accuracy: clampPercent(point.accuracy)
        }));
        if (!series.length) {
          throw new Error("No accuracy data available");
        }
        setAccuracySeries(series);
      } catch (err) {
        const fallbackSeries: AccuracyPoint[] = [
          { date: "Day 1", accuracy: 62 },
          { date: "Day 2", accuracy: 64 },
          { date: "Day 3", accuracy: 66 },
          { date: "Day 4", accuracy: 63 },
          { date: "Day 5", accuracy: 67 },
          { date: "Day 6", accuracy: 69 },
          { date: "Day 7", accuracy: 71 }
        ];
        setAccuracySeries(fallbackSeries);
        setAccuracyPlaceholder(true);
        if (err instanceof Error) {
          setAccuracyError(err.message);
        } else {
          setAccuracyError("Accuracy data unavailable");
        }
      } finally {
        setAccuracyLoading(false);
      }
    };

    fetchAccuracy();
  }, [viewMode]);

  const accuracyChart = useMemo(() => {
    if (accuracySeries.length < 2) return null;
    const width = 600;
    const height = 160;
    const padding = 16;
    const min = 0;
    const max = 100;
    const range = max - min || 1;
    const step = (width - padding * 2) / (accuracySeries.length - 1);
    const points = accuracySeries.map((point, index) => {
      const x = padding + step * index;
      const y =
        padding +
        ((max - clampPercent(point.accuracy)) / range) *
          (height - padding * 2);
      return `${x},${y}`;
    });
    const path = `M ${points[0]} L ${points.slice(1).join(" L ")}`;
    const lastPoint = points[points.length - 1];
    return {
      width,
      height,
      path,
      lastPoint
    };
  }, [accuracySeries]);

  const uniqueTeams = useMemo(() => {
    if (viewMode === "goalies") {
      const teams = new Set(goalieProjections.map((g) => g.team_name));
      return Array.from(teams).sort();
    }
    const teams = new Set(projections.map((p) => p.team_name));
    return Array.from(teams).sort();
  }, [goalieProjections, projections, viewMode]);

  const filteredProjections = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return projections
      .filter((p) => {
        const isActive = p.pts > 0 || p.position === "G";
        if (!isActive) return false;

        if (query && !p.player_name.toLowerCase().includes(query)) {
          return false;
        }

        if (selectedTeam && p.team_name !== selectedTeam) {
          return false;
        }

        if (selectedPosition && p.position !== selectedPosition) {
          return false;
        }

        return true;
      })
      .sort((a, b) => b.pts - a.pts);
  }, [projections, searchQuery, selectedTeam, selectedPosition]);

  const filteredGoalies = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return goalieProjections
      .filter((g) => {
        if (query && !g.goalie_name.toLowerCase().includes(query)) return false;
        if (selectedTeam && g.team_name !== selectedTeam) return false;
        return true;
      })
      .sort((a, b) => b.starter_probability - a.starter_probability);
  }, [goalieProjections, searchQuery, selectedTeam]);

  const isLoading = viewMode === "goalies" ? goalieLoading : loading;
  const activeError = viewMode === "goalies" ? goalieError : error;

  return (
    <div className={styles.container}>
      <Head>
        <title>FORGE Player Projections | FHFHockey</title>
        <meta
          name="description"
          content="FORGE Player Projections for the upcoming games."
        />
      </Head>

      <main className={styles.main}>
        <div style={{ marginBottom: "1rem" }}>
          <a href="/trends">Visit the unified dashboard →</a>
        </div>
        <div className={styles.header}>
          <div className={styles.logoContainer}>
            <Image
              src="/pictures/FORGE.png"
              alt="FORGE Logo"
              width={400}
              height={100}
              objectFit="contain"
            />
          </div>

          <h1 className={styles.title}>
            <span className={styles.highlight}>F</span>orecasting &{" "}
            <span className={styles.highlight}>O</span>utcome{" "}
            <span className={styles.highlight}>R</span>econciliation{" "}
            <span className={styles.highlight}>G</span>ame{" "}
            <span className={styles.highlight}>E</span>ngine
          </h1>
        </div>

        <div className={styles.modeSwitch}>
          <button
            className={classNames(styles.modeButton, {
              [styles.activeModeButton]: viewMode === "skaters"
            })}
            onClick={() => {
              setViewMode("skaters");
              setSelectedPosition("");
            }}
          >
            Skaters
          </button>
          <button
            className={classNames(styles.modeButton, {
              [styles.activeModeButton]: viewMode === "goalies"
            })}
            onClick={() => {
              setViewMode("goalies");
              setSelectedPosition("");
            }}
          >
            Goalies
          </button>
        </div>

        <section className={styles.accuracySection}>
          <div className={styles.accuracyHeader}>
            <div>
              <h2>
                Model Accuracy ({viewMode === "goalies" ? "Goalie" : "Skater"}, Last
                30 Days)
              </h2>
              <p>
                This line shows how close recent projections were to actual
                results. Higher is better.
              </p>
            </div>
            {accuracySeries.length > 0 && (
              <div className={styles.accuracyValue}>
                <span>Latest</span>
                <strong>
                  {clampPercent(
                    accuracySeries[accuracySeries.length - 1]?.accuracy ?? 0
                  )}
                  %
                </strong>
              </div>
            )}
          </div>

          {accuracyLoading && <p>Loading accuracy...</p>}
          {!accuracyLoading && accuracyChart && (
            <div className={styles.accuracyChart}>
              <svg
                viewBox={`0 0 ${accuracyChart.width} ${accuracyChart.height}`}
                role="img"
                aria-label="Accuracy line chart from 0 to 100 percent"
              >
                <line
                  x1="0"
                  y1={accuracyChart.height - 16}
                  x2={accuracyChart.width}
                  y2={accuracyChart.height - 16}
                  className={styles.accuracyAxis}
                />
                <line
                  x1="0"
                  y1="16"
                  x2={accuracyChart.width}
                  y2="16"
                  className={styles.accuracyAxis}
                />
                <path d={accuracyChart.path} className={styles.accuracyLine} />
                <circle
                  cx={Number(accuracyChart.lastPoint.split(",")[0])}
                  cy={Number(accuracyChart.lastPoint.split(",")[1])}
                  r="4"
                  className={styles.accuracyDot}
                />
              </svg>
              <div className={styles.accuracyLabels}>
                <span>0%</span>
                <span>100%</span>
              </div>
            </div>
          )}

          {!accuracyLoading && !accuracyChart && <p>No accuracy data yet.</p>}

          {accuracyPlaceholder && (
            <p className={styles.accuracyNote}>
              Placeholder accuracy data shown until the live feed is connected.
            </p>
          )}
          {accuracyError && !accuracyPlaceholder && (
            <p className={styles.accuracyError}>
              Accuracy data unavailable: {accuracyError}
            </p>
          )}
        </section>

        <div className={styles.controlsContainer}>
          <div className={styles.filterGroup}>
            <input
              type="text"
              placeholder={viewMode === "goalies" ? "Search goalies..." : "Search players..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
          </div>

          <div className={styles.filterGroup}>
            <select
              value={selectedTeam}
              onChange={(e) => setSelectedTeam(e.target.value)}
              className={styles.teamSelect}
            >
              <option value="">All Teams</option>
              {uniqueTeams.map((team) => (
                <option key={team} value={team}>
                  {team}
                </option>
              ))}
            </select>
          </div>

          {viewMode === "skaters" && (
            <div className={styles.filterGroup}>
              <div className={styles.positionButtons}>
                {["C", "LW", "RW", "D", "G"].map((pos) => (
                  <button
                    key={pos}
                    className={classNames(styles.positionButton, {
                      [styles.active]: selectedPosition === pos
                    })}
                    onClick={() =>
                      setSelectedPosition(selectedPosition === pos ? "" : pos)
                    }
                  >
                    {pos}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {isLoading && <p>Loading projections...</p>}
        {activeError && <p>Error: {activeError}</p>}

        {!isLoading && !activeError && viewMode === "skaters" && (
          <div className={styles.grid}>
            {filteredProjections.map((p) => (
              <div
                key={p.player_id}
                className={classNames(
                  styles.card,
                  getPositionClass(p.position)
                )}
              >
                <h2>{p.player_name}</h2>
                <p>
                  {p.position} - {p.team_name}
                </p>
                <ul>
                  <li>
                    <span>Points</span>
                    <span>{p.pts?.toFixed(2)}</span>
                  </li>
                  <li>
                    <span>Goals</span>
                    <span>{p.g?.toFixed(2)}</span>
                  </li>
                  <li>
                    <span>Assists</span>
                    <span>{p.a?.toFixed(2)}</span>
                  </li>
                  <li>
                    <span>SOG</span>
                    <span>{p.sog?.toFixed(2)}</span>
                  </li>
                  <li>
                    <span>PPP</span>
                    <span>{p.ppp?.toFixed(2)}</span>
                  </li>
                  <li>
                    <span>Hits</span>
                    <span>{p.hit?.toFixed(2)}</span>
                  </li>
                  <li>
                    <span>Blocks</span>
                    <span>{p.blk?.toFixed(2)}</span>
                  </li>
                </ul>
                {p.uncertainty && (
                  <div className={styles.uncertainty}>
                    <div className={styles.uncertaintyHeader}>
                      <h3>Uncertainty Range (Low / Typical / High)</h3>
                      <abbr
                        className={styles.uncertaintyLegend}
                        title="Low/Typical/High represent the 10th/50th/90th percentile outcomes."
                      >
                        ?
                      </abbr>
                    </div>
                    <p className={styles.uncertaintyNote}>
                      Low/Typical/High is a conservative, expected, and
                      optimistic range for one game.
                    </p>
                    <ul>
                      {[
                        { label: "Points", value: p.uncertainty.pts },
                        { label: "Goals", value: p.uncertainty.g },
                        { label: "Assists", value: p.uncertainty.a },
                        { label: "SOG", value: p.uncertainty.sog }
                      ]
                        .filter((item) => item.value)
                        .map((item) => (
                          <li key={item.label}>
                            <span>{item.label}</span>
                            <span className={styles.uncertaintyValues}>
                              <span>Low {formatUncertaintyValue(item.value?.p10)}</span>
                              <span>Typical {formatUncertaintyValue(item.value?.p50)}</span>
                              <span>High {formatUncertaintyValue(item.value?.p90)}</span>
                            </span>
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {!isLoading && !activeError && viewMode === "goalies" && (
          <div className={styles.grid}>
            {filteredGoalies.map((g) => (
              <div
                key={g.goalie_id}
                className={classNames(styles.card, styles["pos-G"])}
              >
                <h2>{g.goalie_name}</h2>
                <p>
                  G - {g.team_abbreviation || g.team_name} vs {g.opponent_team_abbreviation || g.opponent_team_name}
                </p>
                <ul>
                  <li>
                    <span>Starter Prob</span>
                    <span>{formatPercent(g.starter_probability)}</span>
                  </li>
                  <li>
                    <span>Saves</span>
                    <span>{g.proj_saves?.toFixed(2)}</span>
                  </li>
                  <li>
                    <span>GA</span>
                    <span>{g.proj_goals_allowed?.toFixed(2)}</span>
                  </li>
                  <li>
                    <span>Win Prob</span>
                    <span>{formatPercent(g.proj_win_prob)}</span>
                  </li>
                  <li>
                    <span>SO Prob</span>
                    <span>{formatPercent(g.proj_shutout_prob)}</span>
                  </li>
                  <li>
                    <span>Modeled Sv%</span>
                    <span>{formatPercent(g.modeled_save_pct)}</span>
                  </li>
                </ul>

                <div className={styles.goalieMetaRow}>
                  <span>{g.quality_tier ?? "--"}</span>
                  <span>{g.reliability_tier ?? "--"}</span>
                  <span>{g.confidence_tier ?? "--"}</span>
                </div>
                <div className={styles.goalieMetaRow}>
                  <span>Risk: {formatPercent(g.blowup_risk)}</span>
                  <span>Call: {g.recommendation ?? "--"}</span>
                </div>

                {g.uncertainty && (
                  <div className={styles.uncertainty}>
                    <div className={styles.uncertaintyHeader}>
                      <h3>Uncertainty Range (Low / Typical / High)</h3>
                    </div>
                    <ul>
                      {[
                        { label: "Saves", value: g.uncertainty.saves },
                        { label: "Goals Allowed", value: g.uncertainty.goals_allowed }
                      ]
                        .filter((item) => item.value)
                        .map((item) => (
                          <li key={item.label}>
                            <span>{item.label}</span>
                            <span className={styles.uncertaintyValues}>
                              <span>Low {formatUncertaintyValue(item.value?.p10)}</span>
                              <span>Typical {formatUncertaintyValue(item.value?.p50)}</span>
                              <span>High {formatUncertaintyValue(item.value?.p90)}</span>
                            </span>
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default FORGEPage;
