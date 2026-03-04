import { useState, useEffect, useMemo, type CSSProperties } from "react";
import type { NextPage } from "next";
import Head from "next/head";
import Image from "next/image";
import styles from "styles/Forge.module.scss";
import classNames from "classnames";
import { teamsInfo } from "lib/teamsInfo";

type StatUncertainty = {
  p10: number;
  p50: number;
  p90: number;
};

type StarterSelectionMeta = {
  model_context?: {
    is_back_to_back?: boolean;
    opponent_is_weak?: boolean;
    team_is_weaker?: boolean;
  };
  opponent_offense_context?: {
    context_adjustment_pct?: number;
  };
  candidate_goalies?: Array<{
    goalie_id?: number;
    last_played_date?: string | null;
    days_since_last_played?: number | null;
    l10_starts?: number | null;
  }>;
};

type AccuracyPoint = {
  date: string;
  accuracy: number;
};

type GoalieCalibrationHints = {
  sourceDate: string | null;
  projectionDate: string | null;
  sampleCount30d: number | null;
  starterBrier: number | null;
  winBrier: number | null;
  shutoutBrier: number | null;
  savesMae30d: number | null;
  goalsAgainstMae30d: number | null;
  savesIntervalHitRate: number | null;
  goalsAllowedIntervalHitRate: number | null;
};

type GoalieApiMeta = {
  modelVersion: string | null;
  scenarioCount: number | null;
  calibrationHints: GoalieCalibrationHints | null;
  diagnosticsNotes: string[];
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
    model?: {
      starter_selection?: StarterSelectionMeta;
    };
    [key: string]: unknown;
  };
};

type TeamRating = {
  offRating: number;
  defRating: number;
  paceRating: number;
  ppTier: number;
  pkTier: number;
  trend10: number;
};

type StartChartGoalieInfo = {
  player_id: number;
  name: string;
  start_probability: number | null;
  projected_gsaa_per_60: number | null;
  confirmed_status: boolean | null;
};

type StartChartGameRow = {
  id: number;
  date: string;
  homeTeamId: number;
  awayTeamId: number;
  homeRating?: TeamRating;
  awayRating?: TeamRating;
  homeGoalies?: StartChartGoalieInfo[];
  awayGoalies?: StartChartGoalieInfo[];
};

type GoalieGameStripData = {
  dateUsed: string;
  games: StartChartGameRow[];
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

const formatSignedPercent = (value: number | null | undefined) => {
  if (value == null || Number.isNaN(value)) return "--";
  const pct = value * 100;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
};

function getStarterDriverRows(goalie: GoalieProjection) {
  const starterSelection = goalie.uncertainty?.model?.starter_selection;
  const selectedGoalie = starterSelection?.candidate_goalies?.find(
    (candidate) => candidate.goalie_id === goalie.goalie_id
  );

  const recencyText =
    selectedGoalie?.days_since_last_played != null
      ? `${selectedGoalie.days_since_last_played}d ago`
      : selectedGoalie?.last_played_date
        ? selectedGoalie.last_played_date
        : "Unavailable";
  const l10StartsText =
    selectedGoalie?.l10_starts != null ? `${selectedGoalie.l10_starts}/10` : "Unavailable";
  const b2bText =
    starterSelection?.model_context?.is_back_to_back == null
      ? "Unavailable"
      : starterSelection.model_context.is_back_to_back
        ? "Yes"
        : "No";

  const opponentContext = starterSelection?.opponent_offense_context;
  const opponentStrengthBits: string[] = [];
  if (starterSelection?.model_context?.opponent_is_weak != null) {
    opponentStrengthBits.push(
      starterSelection.model_context.opponent_is_weak
        ? "Weak opponent"
        : "Neutral/strong opponent"
    );
  }
  if (opponentContext?.context_adjustment_pct != null) {
    opponentStrengthBits.push(
      `Context ${formatSignedPercent(opponentContext.context_adjustment_pct)}`
    );
  }
  const opponentStrengthText =
    opponentStrengthBits.length > 0 ? opponentStrengthBits.join(" • ") : "Unavailable";

  return [
    { label: "Recency", value: recencyText },
    { label: "L10 Starts", value: l10StartsText },
    { label: "Back-to-Back", value: b2bText },
    { label: "Opponent Context", value: opponentStrengthText }
  ];
}

function getConfidenceBadgeClass(confidenceTier: string | null) {
  const tier = (confidenceTier ?? "").toUpperCase();
  if (tier === "HIGH") return styles.confidenceHigh;
  if (tier === "MEDIUM") return styles.confidenceMedium;
  if (tier === "LOW") return styles.confidenceLow;
  return "";
}

function getVolatilityClass(volatilityIndex: number | null) {
  if (volatilityIndex == null || Number.isNaN(volatilityIndex)) {
    return { label: "Unknown", className: "", tooltip: "Volatility data unavailable." };
  }
  if (volatilityIndex <= 0.95) {
    return {
      label: "Stable",
      className: styles.volatilityStable,
      tooltip:
        "Stable volatility profile: outcomes are more consistent than average."
    };
  }
  if (volatilityIndex <= 1.2) {
    return {
      label: "Moderate",
      className: styles.volatilityModerate,
      tooltip: "Moderate volatility profile: normal spread of outcomes."
    };
  }
  return {
    label: "Volatile",
    className: styles.volatilityHigh,
    tooltip:
      "High volatility profile: wider outcome spread and larger downside tails."
  };
}

function getRiskClass(blowupRisk: number | null) {
  if (blowupRisk == null || Number.isNaN(blowupRisk)) {
    return { label: "Unknown", className: "", tooltip: "Blowup risk unavailable." };
  }
  if (blowupRisk < 0.15) {
    return {
      label: "Low Risk",
      className: styles.riskLow,
      tooltip: "Low blowup risk: lower chance of severe downside start."
    };
  }
  if (blowupRisk < 0.25) {
    return {
      label: "Medium Risk",
      className: styles.riskMedium,
      tooltip: "Medium blowup risk: downside risk is present but not extreme."
    };
  }
  return {
    label: "High Risk",
    className: styles.riskHigh,
    tooltip: "High blowup risk: elevated chance of severe downside start."
  };
}

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
    if (rating.offRating > opponentRating.offRating) offClass = styles.glowGreen;
    else if (rating.offRating < opponentRating.offRating) offClass = styles.glowRed;
    if (rating.defRating > opponentRating.defRating) defClass = styles.glowGreen;
    else if (rating.defRating < opponentRating.defRating) defClass = styles.glowRed;
  }

  return (
    <div className={styles.gameStripTeamRating}>
      <div className={styles.gameStripRatingRow}>
        <span className={styles.gameStripRatingLabel}>OFF</span>
        <span className={classNames(styles.gameStripRatingValue, offClass)}>
          {rating.offRating.toFixed(0)}
        </span>
      </div>
      <div className={styles.gameStripRatingRow}>
        <span className={styles.gameStripRatingLabel}>DEF</span>
        <span className={classNames(styles.gameStripRatingValue, defClass)}>
          {rating.defRating.toFixed(0)}
        </span>
      </div>
    </div>
  );
};

const RenderGoalieBar = ({ goalies }: { goalies?: StartChartGoalieInfo[] }) => {
  if (!goalies || goalies.length === 0) return null;

  const toRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  return (
    <div className={styles.goalieBarContainer}>
      {goalies.map((goalie, idx) => {
        const probability = (goalie.start_probability ?? 0) * 100;
        if (probability < 5) return null;
        let barColor = "#ef476f";
        if (probability >= 80) barColor = "#3bd4ae";
        else if (probability >= 50) barColor = "#ffd166";
        else if (probability >= 30) barColor = "#118ab2";
        else barColor = "#6c757d";
        const displayName = goalie.name.split(" ").pop();
        const showText = idx === 0 && probability > 20;
        return (
          <div
            key={goalie.player_id}
            className={styles.goalieSegment}
            style={{
              width: `${probability}%`,
              backgroundColor: toRgba(barColor, 0.4),
              borderColor: barColor
            }}
            title={`${goalie.name} (${probability.toFixed(0)}%)`}
          >
            {showText && (
              <span className={styles.goalieSegmentText}>
                {displayName} {probability.toFixed(0)}%
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
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
  const [goalieApiMeta, setGoalieApiMeta] = useState<GoalieApiMeta>({
    modelVersion: null,
    scenarioCount: null,
    calibrationHints: null,
    diagnosticsNotes: []
  });
  const [goalieGameStripData, setGoalieGameStripData] =
    useState<GoalieGameStripData | null>(null);

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
        setGoalieApiMeta({
          modelVersion:
            typeof data.modelVersion === "string" ? data.modelVersion : null,
          scenarioCount:
            Number.isFinite(data.scenarioCount) && Number(data.scenarioCount) >= 0
              ? Number(data.scenarioCount)
              : null,
          calibrationHints:
            data.calibrationHints && typeof data.calibrationHints === "object"
              ? (data.calibrationHints as GoalieCalibrationHints)
              : null,
          diagnosticsNotes: Array.isArray(data?.diagnostics?.notes)
            ? data.diagnostics.notes.filter((n: unknown) => typeof n === "string")
            : []
        });
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
    const fetchGoalieGameStrip = async () => {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const res = await fetch(`/api/v1/start-chart?date=${today}`);
        if (!res.ok) throw new Error("Failed to fetch game strip data");
        const data = await res.json();
        const games = Array.isArray(data?.games)
          ? (data.games as StartChartGameRow[])
          : [];
        const dateUsed =
          typeof data?.dateUsed === "string" ? data.dateUsed : today;
        setGoalieGameStripData({ dateUsed, games });
      } catch (_err) {
        setGoalieGameStripData(null);
      }
    };

    fetchGoalieGameStrip();
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

  const goalieGameStripGames = useMemo(() => {
    if (!goalieGameStripData?.games?.length) return [];
    const modeledTeamAbbrevs = new Set(
      goalieProjections
        .map((g) => g.team_abbreviation)
        .filter((abbr): abbr is string => typeof abbr === "string" && abbr.length > 0)
    );
    if (!modeledTeamAbbrevs.size) return goalieGameStripData.games;

    return goalieGameStripData.games.filter((game) => {
      const home = Object.values(teamsInfo).find((team) => team.id === game.homeTeamId);
      const away = Object.values(teamsInfo).find((team) => team.id === game.awayTeamId);
      return Boolean(
        (home?.abbrev && modeledTeamAbbrevs.has(home.abbrev)) ||
          (away?.abbrev && modeledTeamAbbrevs.has(away.abbrev))
      );
    });
  }, [goalieGameStripData, goalieProjections]);

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
          <a href="/forge/dashboard">Visit the Forge dashboard →</a>
        </div>
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
                Model Accuracy ({viewMode === "goalies" ? "Goalie" : "Skater"},
                Last 30 Days)
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
              placeholder={
                viewMode === "goalies"
                  ? "Search goalies..."
                  : "Search players..."
              }
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
            {filteredProjections.map((p, index) => (
              <div
                key={`${p.player_id}-${index}`}
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
                      <h3>Uncertainty Range (Floor / Typical / Ceiling)</h3>
                      <abbr
                        className={styles.uncertaintyLegend}
                        title="Floor/Typical/Ceiling represent the 10th/50th/90th percentile outcomes."
                      >
                        ?
                      </abbr>
                    </div>
                    <p className={styles.uncertaintyNote}>
                      Floor/Typical/Ceiling is a conservative, expected, and
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
                              <span>
                                Floor {formatUncertaintyValue(item.value?.p10)}
                              </span>
                              <span>
                                Typical{" "}
                                {formatUncertaintyValue(item.value?.p50)}
                              </span>
                              <span>
                                Ceiling{" "}
                                {formatUncertaintyValue(item.value?.p90)}
                              </span>
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
          <>
            {goalieGameStripGames.length > 0 && (
              <section
                className={styles.goalieGameStrip}
                aria-label="Goalie game ticker"
              >
                <h3>
                  Today's Slate ({goalieGameStripData?.dateUsed ?? "N/A"})
                </h3>
                <div className={styles.goalieGameStripTrack}>
                  {goalieGameStripGames.map((game) => {
                    const home = Object.values(teamsInfo).find(
                      (team) => team.id === game.homeTeamId
                    );
                    const away = Object.values(teamsInfo).find(
                      (team) => team.id === game.awayTeamId
                    );
                    return (
                      <div
                        key={game.id}
                        className={styles.goalieGameCard}
                        style={
                          {
                            "--away-color": away?.primaryColor ?? "#333",
                            "--home-color": home?.primaryColor ?? "#333"
                          } as CSSProperties
                        }
                      >
                        <div className={styles.gameStripTeamRow}>
                          <div className={styles.gameStripTeamRowHeader}>
                            <div className={styles.gameStripTeamIdentity}>
                              {away?.abbrev && (
                                <img
                                  src={`/teamLogos/${away.abbrev}.png`}
                                  alt={away.abbrev}
                                  className={styles.gameStripTeamLogo}
                                />
                              )}
                              <span className={styles.gameStripTeamAbbrev}>
                                {away?.abbrev}
                              </span>
                            </div>
                            <RenderRating
                              rating={game.awayRating}
                              opponentRating={game.homeRating}
                            />
                          </div>
                          <RenderGoalieBar goalies={game.awayGoalies} />
                        </div>

                        <div className={styles.gameStripDivider}>
                          <div className={styles.gameStripDividerLine} />
                          <div className={styles.gameStripVsCircle}>vs</div>
                          <div className={styles.gameStripDividerLine} />
                        </div>

                        <div className={styles.gameStripTeamRow}>
                          <div
                            className={classNames(
                              styles.gameStripTeamRowHeader,
                              styles.gameStripReverse
                            )}
                          >
                            <div
                              className={classNames(
                                styles.gameStripTeamIdentity,
                                styles.gameStripReverse
                              )}
                            >
                              {home?.abbrev && (
                                <img
                                  src={`/teamLogos/${home.abbrev}.png`}
                                  alt={home.abbrev}
                                  className={styles.gameStripTeamLogo}
                                />
                              )}
                              <span className={styles.gameStripTeamAbbrev}>
                                {home?.abbrev}
                              </span>
                            </div>
                            <RenderRating
                              rating={game.homeRating}
                              opponentRating={game.awayRating}
                            />
                          </div>
                          <RenderGoalieBar goalies={game.homeGoalies} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
            <section className={styles.goalieDisclosure}>
              <h3>Goalie Model Disclosure</h3>
              <div className={styles.disclosureMeta}>
                <span>
                  Model: {goalieApiMeta.modelVersion ?? "Unavailable"}
                </span>
                <span>
                  Starter scenarios:{" "}
                  {goalieApiMeta.scenarioCount != null
                    ? goalieApiMeta.scenarioCount
                    : "Unavailable"}
                </span>
                <span>
                  Starter calibration (Brier):{" "}
                  {goalieApiMeta.calibrationHints?.starterBrier != null
                    ? goalieApiMeta.calibrationHints.starterBrier.toFixed(3)
                    : "Unavailable"}
                </span>
              </div>
              <ul>
                <li>
                  Starter probabilities are model estimates, not confirmed
                  lineup locks.
                </li>
                <li>
                  Public data cannot fully capture pre-shot movement,
                  traffic/screening, or coaching intent.
                </li>
                <li>
                  Calibration hints summarize recent historical performance and
                  do not guarantee single-game outcomes.
                </li>
                <li>
                  Back-to-back, recency, and opponent context are heuristic
                  signals and can be overridden by late news.
                </li>
              </ul>
              {goalieApiMeta.diagnosticsNotes.length > 0 && (
                <p className={styles.disclosureNotes}>
                  Diagnostics:{" "}
                  {goalieApiMeta.diagnosticsNotes.slice(0, 2).join(" | ")}
                </p>
              )}
            </section>

            <div className={styles.grid}>
              {filteredGoalies.map((g, index) => {
                const volatilityBadge = getVolatilityClass(g.volatility_index);
                const riskBadge = getRiskClass(g.blowup_risk);
                return (
                  <div
                    key={`${g.goalie_id}-${index}`}
                    className={classNames(styles.card, styles["pos-G"])}
                  >
                    <h2>{g.goalie_name}</h2>
                    <p>
                      G - {g.team_abbreviation || g.team_name} vs{" "}
                      {g.opponent_team_abbreviation || g.opponent_team_name}
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
                      <span title="Quality tier summarizes modeled goalie performance level versus league baseline.">
                        {g.quality_tier ?? "--"}
                      </span>
                      <span title="Reliability tier summarizes expected consistency of goalie outcomes.">
                        {g.reliability_tier ?? "--"}
                      </span>
                      <span
                        className={classNames(
                          styles.indicatorBadge,
                          getConfidenceBadgeClass(g.confidence_tier)
                        )}
                        title="Confidence tier indicates model confidence level based on evidence sample size and stability."
                      >
                        Confidence: {g.confidence_tier ?? "--"}
                      </span>
                    </div>
                    <div className={styles.goalieMetaRow}>
                      <span
                        className={classNames(
                          styles.indicatorBadge,
                          volatilityBadge.className
                        )}
                        title={volatilityBadge.tooltip}
                      >
                        Volatility: {volatilityBadge.label}
                      </span>
                      <span
                        className={classNames(
                          styles.indicatorBadge,
                          riskBadge.className
                        )}
                        title={`${riskBadge.tooltip} (${formatPercent(g.blowup_risk)})`}
                      >
                        Risk: {riskBadge.label}
                      </span>
                      <span>Call: {g.recommendation ?? "--"}</span>
                    </div>

                    <div className={styles.starterDrivers}>
                      <h3>Starter Confidence Drivers</h3>
                      <ul>
                        {getStarterDriverRows(g).map((driver) => (
                          <li key={driver.label}>
                            <span>{driver.label}</span>
                            <strong>{driver.value}</strong>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {g.uncertainty && (
                      <div className={styles.uncertainty}>
                        <div className={styles.uncertaintyHeader}>
                          <h3>Uncertainty Range (Floor / Typical / Ceiling)</h3>
                        </div>
                        <ul>
                          {[
                            { label: "Saves", value: g.uncertainty.saves },
                            {
                              label: "Goals Allowed",
                              value: g.uncertainty.goals_allowed
                            }
                          ]
                            .filter((item) => item.value)
                            .map((item) => (
                              <li key={item.label}>
                                <span>{item.label}</span>
                                <span className={styles.uncertaintyValues}>
                                  <span>
                                    Floor{" "}
                                    {formatUncertaintyValue(item.value?.p10)}
                                  </span>
                                  <span>
                                    Typical{" "}
                                    {formatUncertaintyValue(item.value?.p50)}
                                  </span>
                                  <span>
                                    Ceiling{" "}
                                    {formatUncertaintyValue(item.value?.p90)}
                                  </span>
                                </span>
                              </li>
                            ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default FORGEPage;
