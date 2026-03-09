import Head from "next/head";
import { useEffect, useMemo, useState } from "react";

import supabase from "lib/supabase/client";
import type { Database } from "lib/supabase/database-generated.types";
import {
  buildSustainabilityScore,
  derivePerformanceFlags,
  extractFeatureImportance,
  generateExplanationBullets,
  generateExplanationText,
  predictSustainabilityProbabilities,
  projectCountMetric,
  projectFaceoffWinPct,
  trainSustainabilityProbabilityModel,
  type ExplanationOptions,
  type ProjectableCountMetric
} from "lib/sustainability/model";
import styles from "./trendsDebug.module.scss";

type PlayerRow = Database["public"]["Tables"]["players"]["Row"];
type RollingMetricRow =
  Database["public"]["Tables"]["rolling_player_game_metrics"]["Row"];

type PlayerSearchResult = {
  id: number;
  fullName: string;
  position: string | null;
};

type PlayerDebugSnapshot = {
  playerId: number;
  fullName: string;
  position: string | null;
  gameDate: string;
  metrics: Pick<
    RollingMetricRow,
    | "sog_per_60_avg_last5"
    | "sog_per_60_avg_career"
    | "ixg_per_60_avg_last5"
    | "ixg_per_60_avg_career"
    | "pp_share_pct_avg_last5"
    | "pp_share_pct_avg_career"
    | "toi_seconds_avg_last5"
    | "toi_seconds_avg_career"
    | "pdo_avg_last5"
    | "pdo_avg_career"
    | "goals_avg_last5"
    | "goals_avg_career"
    | "assists_avg_last5"
    | "assists_avg_career"
    | "points_avg_last5"
    | "points_avg_career"
    | "pp_points_avg_last5"
    | "pp_points_avg_career"
    | "hits_avg_last5"
    | "hits_avg_career"
    | "blocks_avg_last5"
    | "blocks_avg_career"
    | "on_ice_sh_pct_avg_last5"
    | "on_ice_sh_pct_avg_career"
  >;
  faceoffWinPct: number | null;
  faceoffAttemptsPerGame: number | null;
};

type NumericInputProps = {
  id: string;
  label: string;
  value: number;
  step?: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
};

const MODEL_FEATURE_KEYS = [
  "shots_per_60",
  "ixg_per_60",
  "pp_toi_pct",
  "usage_delta",
  "pdo"
] as const;

const PROJECTION_METRICS: ProjectableCountMetric[] = [
  "goals",
  "assists",
  "shots",
  "points",
  "pp_points",
  "hits",
  "blocks"
];

const DEMO_MODEL = trainSustainabilityProbabilityModel(
  [
    { features: [-1.8, -1.5, -1.2, -0.7, -0.6], label: "cold" },
    { features: [-1.2, -1.1, -0.9, -0.5, -0.3], label: "cold" },
    { features: [-0.3, -0.2, 0.1, -0.1, 0.1], label: "normal" },
    { features: [0.1, 0.2, -0.1, 0.05, -0.1], label: "normal" },
    { features: [1.1, 1.3, 0.8, 0.4, 0.6], label: "hot" },
    { features: [1.6, 1.8, 1.2, 0.7, 0.9], label: "hot" }
  ],
  {
    iterations: 900,
    learningRate: 0.12,
    calibrationIterations: 350
  }
);

function NumericInput({
  id,
  label,
  value,
  step = 0.01,
  min,
  max,
  onChange
}: NumericInputProps) {
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="number"
        value={value}
        step={step}
        min={min}
        max={max}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}

function formatNumber(value: number, digits = 2): string {
  return value.toFixed(digits);
}

function normalizePercentLike(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return value > 1 ? value / 100 : value;
}

function normalizePdo(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 1;
  if (value > 10) return value / 1000;
  return value;
}

function safeNumber(value: number | null | undefined, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function safePercentChange(recent: number, baseline: number): number {
  if (!Number.isFinite(baseline) || Math.abs(baseline) < 1e-9) return 0;
  return (recent - baseline) / Math.abs(baseline);
}

function toPer60(countPerGame: number, toiSeconds: number): number {
  if (!Number.isFinite(toiSeconds) || toiSeconds <= 0) return 0;
  return (countPerGame * 3600) / toiSeconds;
}

async function searchPlayersByName(query: string): Promise<PlayerSearchResult[]> {
  const { data, error } = await supabase
    .from("players")
    .select("id, fullName, position")
    .ilike("fullName", `%${query}%`)
    .order("fullName", { ascending: true })
    .limit(10);

  if (error) throw error;

  return ((data as PlayerRow[] | null) ?? []).map((row) => ({
    id: Number(row.id),
    fullName: row.fullName,
    position: row.position ?? null
  }));
}

async function fetchLatestPlayerSnapshot(
  playerId: number
): Promise<PlayerDebugSnapshot | null> {
  const [playerResult, rollingResult, totalsResult] = await Promise.all([
    supabase
      .from("players")
      .select("id, fullName, position")
      .eq("id", playerId)
      .maybeSingle(),
    supabase
      .from("rolling_player_game_metrics")
      .select(
        [
          "game_date",
          "sog_per_60_avg_last5",
          "sog_per_60_avg_career",
          "ixg_per_60_avg_last5",
          "ixg_per_60_avg_career",
          "pp_share_pct_avg_last5",
          "pp_share_pct_avg_career",
          "toi_seconds_avg_last5",
          "toi_seconds_avg_career",
          "pdo_avg_last5",
          "pdo_avg_career",
          "goals_avg_last5",
          "goals_avg_career",
          "assists_avg_last5",
          "assists_avg_career",
          "points_avg_last5",
          "points_avg_career",
          "pp_points_avg_last5",
          "pp_points_avg_career",
          "hits_avg_last5",
          "hits_avg_career",
          "blocks_avg_last5",
          "blocks_avg_career",
          "on_ice_sh_pct_avg_last5",
          "on_ice_sh_pct_avg_career"
        ].join(",")
      )
      .eq("player_id", playerId)
      .eq("strength_state", "all")
      .order("game_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    (supabase as any)
      .from("wgo_skater_stats_totals")
      .select("fow_percentage,total_faceoffs,games_played,season")
      .eq("player_id", playerId)
      .order("season", { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);

  if (playerResult.error) throw playerResult.error;
  if (rollingResult.error) throw rollingResult.error;
  if (totalsResult.error) throw totalsResult.error;

  if (!playerResult.data || !rollingResult.data) return null;

  const rollingData = rollingResult.data as unknown as Pick<
    RollingMetricRow,
    | "game_date"
    | "sog_per_60_avg_last5"
    | "sog_per_60_avg_career"
    | "ixg_per_60_avg_last5"
    | "ixg_per_60_avg_career"
    | "pp_share_pct_avg_last5"
    | "pp_share_pct_avg_career"
    | "toi_seconds_avg_last5"
    | "toi_seconds_avg_career"
    | "pdo_avg_last5"
    | "pdo_avg_career"
    | "goals_avg_last5"
    | "goals_avg_career"
    | "assists_avg_last5"
    | "assists_avg_career"
    | "points_avg_last5"
    | "points_avg_career"
    | "pp_points_avg_last5"
    | "pp_points_avg_career"
    | "hits_avg_last5"
    | "hits_avg_career"
    | "blocks_avg_last5"
    | "blocks_avg_career"
    | "on_ice_sh_pct_avg_last5"
    | "on_ice_sh_pct_avg_career"
  >;

  const totals = totalsResult.data as
    | {
        fow_percentage?: number | null;
        total_faceoffs?: number | null;
        games_played?: number | null;
      }
    | null;

  const attemptsPerGame =
    totals &&
    typeof totals.total_faceoffs === "number" &&
    typeof totals.games_played === "number" &&
    totals.games_played > 0
      ? totals.total_faceoffs / totals.games_played
      : null;

  return {
    playerId,
    fullName: playerResult.data.fullName,
    position: playerResult.data.position ?? null,
    gameDate: rollingData.game_date,
    metrics: rollingData,
    faceoffWinPct:
      typeof totals?.fow_percentage === "number" ? totals.fow_percentage : null,
    faceoffAttemptsPerGame: attemptsPerGame
  };
}

export default function TrendsDebugPage() {
  const [playerQuery, setPlayerQuery] = useState("");
  const [playerSuggestions, setPlayerSuggestions] = useState<PlayerSearchResult[]>(
    []
  );
  const [playerSearchLoading, setPlayerSearchLoading] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerSearchResult | null>(
    null
  );
  const [playerSnapshot, setPlayerSnapshot] = useState<PlayerDebugSnapshot | null>(
    null
  );
  const [playerLoadError, setPlayerLoadError] = useState<string | null>(null);
  const [playerLoadLoading, setPlayerLoadLoading] = useState(false);

  const [shotsPer60, setShotsPer60] = useState(10.8);
  const [ixgPer60, setIxgPer60] = useState(0.92);
  const [ppToiPct, setPpToiPct] = useState(0.34);
  const [usageDelta, setUsageDelta] = useState(0.21);
  const [pdo, setPdo] = useState(1.018);
  const [recentDelta, setRecentDelta] = useState(0.58);
  const [recentZScore, setRecentZScore] = useState(1.22);
  const [toiSeconds, setToiSeconds] = useState(1040);
  const [projectionMetric, setProjectionMetric] =
    useState<ProjectableCountMetric>("shots");
  const [ratePer60, setRatePer60] = useState(10.8);
  const [foWinPct, setFoWinPct] = useState(0.56);
  const [foAttemptsPerGame, setFoAttemptsPerGame] = useState(17.5);
  const [oppXgaPer60, setOppXgaPer60] = useState(3.02);
  const [oppCaPer60, setOppCaPer60] = useState(59);
  const [oppHdcaPer60, setOppHdcaPer60] = useState(10.8);
  const [oppSvPct, setOppSvPct] = useState(0.897);
  const [oppPkTier, setOppPkTier] = useState(21);
  const [oppGamesPlayed, setOppGamesPlayed] = useState(62);

  useEffect(() => {
    let cancelled = false;
    const trimmed = playerQuery.trim();
    if (trimmed.length < 2) {
      setPlayerSuggestions([]);
      setPlayerSearchLoading(false);
      return;
    }

    setPlayerSearchLoading(true);
    const timeout = window.setTimeout(async () => {
      try {
        const results = await searchPlayersByName(trimmed);
        if (!cancelled) {
          setPlayerSuggestions(results);
        }
      } catch (error: any) {
        if (!cancelled) {
          setPlayerSuggestions([]);
          setPlayerLoadError(error?.message ?? "Failed to search players.");
        }
      } finally {
        if (!cancelled) {
          setPlayerSearchLoading(false);
        }
      }
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [playerQuery]);

  useEffect(() => {
    let cancelled = false;
    async function hydratePlayer() {
      if (!selectedPlayer) return;

      setPlayerLoadLoading(true);
      setPlayerLoadError(null);
      try {
        const snapshot = await fetchLatestPlayerSnapshot(selectedPlayer.id);
        if (cancelled) return;

        if (!snapshot) {
          setPlayerSnapshot(null);
          setPlayerLoadError("No rolling metrics found for that player.");
          return;
        }

        const metrics = snapshot.metrics;
        const shotsRecent = safeNumber(metrics.sog_per_60_avg_last5);
        const shotsCareer = safeNumber(metrics.sog_per_60_avg_career);
        const ixgRecent = safeNumber(metrics.ixg_per_60_avg_last5);
        const ixgCareer = safeNumber(metrics.ixg_per_60_avg_career);
        const toiRecent = safeNumber(metrics.toi_seconds_avg_last5, 900);
        const toiCareer = safeNumber(metrics.toi_seconds_avg_career, toiRecent);
        const ppRecent = normalizePercentLike(metrics.pp_share_pct_avg_last5);
        const ppCareer = normalizePercentLike(metrics.pp_share_pct_avg_career);
        const pdoRecent = normalizePdo(metrics.pdo_avg_last5);
        const goalsRecent = toPer60(safeNumber(metrics.goals_avg_last5), toiRecent);
        const assistsRecent = toPer60(
          safeNumber(metrics.assists_avg_last5),
          toiRecent
        );
        const pointsRecent = toPer60(
          safeNumber(metrics.points_avg_last5),
          toiRecent
        );
        const ppPointsRecent = toPer60(
          safeNumber(metrics.pp_points_avg_last5),
          toiRecent
        );
        const hitsRecent = toPer60(safeNumber(metrics.hits_avg_last5), toiRecent);
        const blocksRecent = toPer60(safeNumber(metrics.blocks_avg_last5), toiRecent);

        const usage = safePercentChange(toiRecent, toiCareer);
        const aggregateDelta =
          (safePercentChange(shotsRecent, shotsCareer) +
            safePercentChange(ixgRecent, ixgCareer) +
            safePercentChange(ppRecent, ppCareer)) /
          3;
        const zLike =
          ((shotsRecent - shotsCareer) / Math.max(shotsCareer * 0.2, 0.4) +
            (ixgRecent - ixgCareer) / Math.max(ixgCareer * 0.2, 0.08)) /
          2;

        setPlayerSnapshot(snapshot);
        setShotsPer60(shotsRecent);
        setIxgPer60(ixgRecent);
        setPpToiPct(ppRecent);
        setUsageDelta(usage);
        setPdo(pdoRecent);
        setRecentDelta(aggregateDelta);
        setRecentZScore(zLike);
        setToiSeconds(toiRecent);
        setFoWinPct(normalizePercentLike(snapshot.faceoffWinPct));
        setFoAttemptsPerGame(snapshot.faceoffAttemptsPerGame ?? 0);

        const metricRateMap: Record<ProjectableCountMetric, number> = {
          goals: goalsRecent,
          assists: assistsRecent,
          shots: shotsRecent,
          points: pointsRecent,
          pp_points: ppPointsRecent,
          hits: hitsRecent,
          blocks: blocksRecent
        };
        setRatePer60(metricRateMap[projectionMetric] ?? shotsRecent);
      } catch (error: any) {
        if (!cancelled) {
          setPlayerSnapshot(null);
          setPlayerLoadError(error?.message ?? "Failed to load player snapshot.");
        }
      } finally {
        if (!cancelled) {
          setPlayerLoadLoading(false);
        }
      }
    }

    hydratePlayer();
    return () => {
      cancelled = true;
    };
  }, [projectionMetric, selectedPlayer]);

  const explanationOptions = useMemo<ExplanationOptions>(() => {
    if (!playerSnapshot) return { topN: 3 };
    const metrics = playerSnapshot.metrics;
    return {
      topN: 3,
      featureContexts: {
        shots_per_60: {
          recent: safeNumber(metrics.sog_per_60_avg_last5),
          baseline: safeNumber(metrics.sog_per_60_avg_career),
          comparisonLabel: "career"
        },
        ixg_per_60: {
          recent: safeNumber(metrics.ixg_per_60_avg_last5),
          baseline: safeNumber(metrics.ixg_per_60_avg_career),
          comparisonLabel: "career"
        },
        pp_toi_pct: {
          recent: normalizePercentLike(metrics.pp_share_pct_avg_last5),
          baseline: normalizePercentLike(metrics.pp_share_pct_avg_career),
          comparisonLabel: "career",
          format: "percent"
        },
        usage_delta: {
          recent: safeNumber(metrics.toi_seconds_avg_last5),
          baseline: safeNumber(metrics.toi_seconds_avg_career),
          comparisonLabel: "career TOI"
        },
        pdo: {
          recent: normalizePdo(metrics.pdo_avg_last5),
          baseline: normalizePdo(metrics.pdo_avg_career),
          comparisonLabel: "career"
        }
      }
    };
  }, [playerSnapshot]);

  const computed = useMemo(() => {
    const features = [shotsPer60, ixgPer60, ppToiPct, usageDelta, pdo];

    const probabilityResult = predictSustainabilityProbabilities(
      DEMO_MODEL,
      features
    );

    const importances = extractFeatureImportance(
      DEMO_MODEL,
      features,
      probabilityResult.label,
      [...MODEL_FEATURE_KEYS]
    );

    const countProjection = projectCountMetric({
      metric: projectionMetric,
      ratePer60,
      toiSeconds,
      opponentAdjustment: {
        gamesPlayed: oppGamesPlayed,
        xgaPer60: oppXgaPer60,
        caPer60: oppCaPer60,
        hdcaPer60: oppHdcaPer60,
        svPct: oppSvPct,
        pkTier: oppPkTier
      },
      horizons: [5, 10]
    });

    const score = buildSustainabilityScore({
      probabilities: probabilityResult.probabilities,
      recentVsBaselineDelta: recentDelta,
      recentVsBaselineZScore: recentZScore,
      usageDelta,
      opponentDefenseScore: countProjection.opponentAdjustment.defenseScore
    });

    const explicitFlags = derivePerformanceFlags({
      score: score.score,
      probabilities: probabilityResult.probabilities,
      recentVsBaselineZScore: recentZScore
    });

    const faceoffProjection = projectFaceoffWinPct({
      winPct: foWinPct,
      attemptsPerGame: foAttemptsPerGame,
      horizons: [5, 10]
    });

    return {
      probabilityResult,
      importances,
      explanations: generateExplanationText(
        importances,
        probabilityResult.label,
        explanationOptions
      ),
      explanationBullets: generateExplanationBullets(
        importances,
        probabilityResult.label,
        explanationOptions
      ),
      score,
      explicitFlags,
      countProjection,
      faceoffProjection
    };
  }, [
    explanationOptions,
    foAttemptsPerGame,
    foWinPct,
    ixgPer60,
    oppCaPer60,
    oppGamesPlayed,
    oppHdcaPer60,
    oppPkTier,
    oppSvPct,
    oppXgaPer60,
    pdo,
    ppToiPct,
    projectionMetric,
    ratePer60,
    recentDelta,
    recentZScore,
    shotsPer60,
    toiSeconds,
    usageDelta
  ]);

  const activeStateClass =
    computed.explicitFlags.state === "overperforming"
      ? styles.pillStrong
      : computed.explicitFlags.state === "underperforming"
        ? styles.pillWeak
        : styles.pillNeutral;

  return (
    <>
      <Head>
        <title>Trends Debug | Sustainability Workbench</title>
      </Head>
      <main className={styles.page}>
        <div className={styles.shell}>
          <section className={styles.hero}>
            <p className={styles.eyebrow}>Internal Debug Surface</p>
            <h1>Trends Debug</h1>
            <p className={styles.lede}>
              Search a real player, load the latest rolling metrics snapshot, and
              inspect how the sustainability model turns those values into
              probabilities, score/flags, projections, and explanation bullets.
            </p>
          </section>

          <div className={styles.layout}>
            <aside className={`${styles.panel} ${styles.controls}`}>
              <section className={styles.section}>
                <h2>Player Search</h2>
                <p className={styles.sectionHint}>
                  This now hydrates the page from real player rows in Supabase.
                </p>
                <div className={styles.field}>
                  <label htmlFor="player-search">Find Player</label>
                  <input
                    id="player-search"
                    type="text"
                    value={playerQuery}
                    placeholder="Type at least 2 letters"
                    onChange={(event) => {
                      setPlayerQuery(event.target.value);
                      setPlayerLoadError(null);
                    }}
                  />
                </div>
                {playerSearchLoading ? (
                  <p className={styles.sectionHint}>Searching players...</p>
                ) : null}
                {playerSuggestions.length ? (
                  <div className={styles.suggestionList}>
                    {playerSuggestions.map((player) => (
                      <button
                        key={player.id}
                        type="button"
                        className={styles.suggestion}
                        onClick={() => {
                          setSelectedPlayer(player);
                          setPlayerQuery(player.fullName);
                          setPlayerSuggestions([]);
                        }}
                      >
                        <span>{player.fullName}</span>
                        <span className={styles.subtle}>
                          {player.position ?? "N/A"}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
                {selectedPlayer ? (
                  <div className={styles.snapshotBanner}>
                    <strong>{selectedPlayer.fullName}</strong>
                    <span className={styles.subtle}>
                      {selectedPlayer.position ?? "N/A"}
                    </span>
                    {playerSnapshot ? (
                      <span className={styles.subtle}>
                        latest snapshot {playerSnapshot.gameDate}
                      </span>
                    ) : null}
                  </div>
                ) : null}
                {playerLoadLoading ? (
                  <p className={styles.sectionHint}>Loading rolling metrics...</p>
                ) : null}
                {playerLoadError ? (
                  <p className={styles.errorText}>{playerLoadError}</p>
                ) : null}
              </section>

              <section className={styles.section}>
                <h2>Hydrated Model Inputs</h2>
                <p className={styles.sectionHint}>
                  These values are auto-populated from the latest
                  <span className={styles.mono}> rolling_player_game_metrics </span>
                  row, but you can still tweak them manually.
                </p>
                <div className={styles.fields}>
                  <div className={styles.fieldGrid}>
                    <NumericInput
                      id="shots-per-60"
                      label="Shots / 60"
                      value={shotsPer60}
                      step={0.1}
                      onChange={setShotsPer60}
                    />
                    <NumericInput
                      id="ixg-per-60"
                      label="ixG / 60"
                      value={ixgPer60}
                      step={0.01}
                      onChange={setIxgPer60}
                    />
                  </div>
                  <div className={styles.fieldGrid}>
                    <NumericInput
                      id="pp-toi-pct"
                      label="PP Share"
                      value={ppToiPct}
                      step={0.01}
                      min={0}
                      max={1}
                      onChange={setPpToiPct}
                    />
                    <NumericInput
                      id="usage-delta"
                      label="Usage Delta"
                      value={usageDelta}
                      step={0.01}
                      onChange={setUsageDelta}
                    />
                  </div>
                  <div className={styles.fieldGrid}>
                    <NumericInput
                      id="pdo"
                      label="PDO"
                      value={pdo}
                      step={0.001}
                      onChange={setPdo}
                    />
                    <NumericInput
                      id="recent-delta"
                      label="Aggregate Delta"
                      value={recentDelta}
                      step={0.01}
                      onChange={setRecentDelta}
                    />
                  </div>
                  <NumericInput
                    id="recent-z"
                    label="Z-Like Momentum"
                    value={recentZScore}
                    step={0.01}
                    onChange={setRecentZScore}
                  />
                </div>
              </section>

              <section className={styles.section}>
                <h2>Projection Inputs</h2>
                <div className={styles.fields}>
                  <div className={styles.field}>
                    <label htmlFor="projection-metric">Projection Metric</label>
                    <select
                      id="projection-metric"
                      value={projectionMetric}
                      onChange={(event) =>
                        setProjectionMetric(
                          event.target.value as ProjectableCountMetric
                        )
                      }
                    >
                      {PROJECTION_METRICS.map((metric) => (
                        <option key={metric} value={metric}>
                          {metric}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.fieldGrid}>
                    <NumericInput
                      id="rate-per-60"
                      label="Projection Rate / 60"
                      value={ratePer60}
                      step={0.1}
                      onChange={setRatePer60}
                    />
                    <NumericInput
                      id="toi-seconds"
                      label="Projected TOI Seconds"
                      value={toiSeconds}
                      step={1}
                      onChange={setToiSeconds}
                    />
                  </div>
                  <div className={styles.fieldGrid}>
                    <NumericInput
                      id="fo-win-pct"
                      label="FO Win %"
                      value={foWinPct}
                      step={0.01}
                      min={0}
                      max={1}
                      onChange={setFoWinPct}
                    />
                    <NumericInput
                      id="fo-attempts"
                      label="FO Attempts / Game"
                      value={foAttemptsPerGame}
                      step={0.5}
                      onChange={setFoAttemptsPerGame}
                    />
                  </div>
                </div>
              </section>

              <section className={styles.section}>
                <h2>Opponent Context</h2>
                <p className={styles.sectionHint}>
                  Opponent values remain manual for now. Player-side values are
                  live.
                </p>
                <div className={styles.fields}>
                  <div className={styles.fieldGrid}>
                    <NumericInput
                      id="opp-xga"
                      label="Opponent xGA / 60"
                      value={oppXgaPer60}
                      step={0.01}
                      onChange={setOppXgaPer60}
                    />
                    <NumericInput
                      id="opp-ca"
                      label="Opponent CA / 60"
                      value={oppCaPer60}
                      step={0.1}
                      onChange={setOppCaPer60}
                    />
                  </div>
                  <div className={styles.fieldGrid}>
                    <NumericInput
                      id="opp-hdca"
                      label="Opponent HDCA / 60"
                      value={oppHdcaPer60}
                      step={0.1}
                      onChange={setOppHdcaPer60}
                    />
                    <NumericInput
                      id="opp-sv"
                      label="Opponent SV%"
                      value={oppSvPct}
                      step={0.001}
                      min={0}
                      max={1}
                      onChange={setOppSvPct}
                    />
                  </div>
                  <div className={styles.fieldGrid}>
                    <NumericInput
                      id="opp-pk-tier"
                      label="Opponent PK Tier"
                      value={oppPkTier}
                      step={1}
                      onChange={setOppPkTier}
                    />
                    <NumericInput
                      id="opp-gp"
                      label="Opponent GP"
                      value={oppGamesPlayed}
                      step={1}
                      onChange={setOppGamesPlayed}
                    />
                  </div>
                </div>
              </section>
            </aside>

            <section className={`${styles.panel} ${styles.results}`}>
              <div className={styles.summaryGrid}>
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}>Predicted State</span>
                  <strong className={styles.metricValue}>
                    {computed.probabilityResult.label}
                  </strong>
                  <span className={styles.metricDetail}>
                    hot {formatNumber(computed.probabilityResult.probabilities.hot)} |
                    normal {formatNumber(computed.probabilityResult.probabilities.normal)} |
                    cold {formatNumber(computed.probabilityResult.probabilities.cold)}
                  </span>
                </div>
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}>Sustainability Score</span>
                  <strong className={styles.metricValue}>
                    {formatNumber(computed.score.score)}
                  </strong>
                  <span className={styles.metricDetail}>
                    raw {formatNumber(computed.score.rawScore)}
                  </span>
                </div>
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}>Per-Game {projectionMetric}</span>
                  <strong className={styles.metricValue}>
                    {formatNumber(computed.countProjection.expectedPerGame)}
                  </strong>
                  <span className={styles.metricDetail}>
                    rate/60 {formatNumber(computed.countProjection.adjustedRatePer60)}
                  </span>
                </div>
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}>FO Win %</span>
                  <strong className={styles.metricValue}>
                    {formatNumber(computed.faceoffProjection.expectedWinPct * 100)}%
                  </strong>
                  <span className={styles.metricDetail}>
                    wins/game {formatNumber(computed.faceoffProjection.expectedWinsPerGame)}
                  </span>
                </div>
              </div>

              <div className={styles.statePillRow}>
                <div className={`${styles.pill} ${activeStateClass}`}>
                  Flag State: {computed.explicitFlags.state}
                </div>
                <div className={`${styles.pill} ${styles.pillNeutral}`}>
                  Opponent Defense Score:{" "}
                  {formatNumber(
                    computed.countProjection.opponentAdjustment.defenseScore,
                    3
                  )}
                </div>
                <div className={`${styles.pill} ${styles.pillNeutral}`}>
                  Snapshot Player: {playerSnapshot?.fullName ?? "none selected"}
                </div>
              </div>

              <div className={styles.cardGrid}>
                <article className={styles.card}>
                  <h3>Live Player Snapshot</h3>
                  <div className={styles.statList}>
                    <div className={styles.statRow}>
                      <span>Player</span>
                      <strong>{playerSnapshot?.fullName ?? "Choose a player"}</strong>
                    </div>
                    <div className={styles.statRow}>
                      <span>Position</span>
                      <strong>{playerSnapshot?.position ?? "—"}</strong>
                    </div>
                    <div className={styles.statRow}>
                      <span>Latest rolling date</span>
                      <strong>{playerSnapshot?.gameDate ?? "—"}</strong>
                    </div>
                    <div className={styles.statRow}>
                      <span>Career shots/60 baseline</span>
                      <strong>
                        {playerSnapshot
                          ? formatNumber(
                              safeNumber(
                                playerSnapshot.metrics.sog_per_60_avg_career
                              )
                            )
                          : "—"}
                      </strong>
                    </div>
                  </div>
                </article>

                <article className={styles.card}>
                  <h3>Score Components</h3>
                  <div className={styles.statList}>
                    <div className={styles.statRow}>
                      <span>Probability Edge</span>
                      <strong>{formatNumber(computed.score.components.probabilityEdge)}</strong>
                    </div>
                    <div className={styles.statRow}>
                      <span>Delta Impact</span>
                      <strong>{formatNumber(computed.score.components.deltaImpact)}</strong>
                    </div>
                    <div className={styles.statRow}>
                      <span>Z-Score Impact</span>
                      <strong>{formatNumber(computed.score.components.zScoreImpact)}</strong>
                    </div>
                    <div className={styles.statRow}>
                      <span>Usage Impact</span>
                      <strong>{formatNumber(computed.score.components.usageImpact)}</strong>
                    </div>
                    <div className={styles.statRow}>
                      <span>Opponent Impact</span>
                      <strong>{formatNumber(computed.score.components.opponentImpact)}</strong>
                    </div>
                  </div>
                </article>

                <article className={styles.card}>
                  <h3>{projectionMetric} Projection Bands</h3>
                  <div className={styles.bandList}>
                    <div className={styles.bandRow}>
                      <span>1 Game Mean</span>
                      <strong>{formatNumber(computed.countProjection.perGame.mean)}</strong>
                    </div>
                    <div className={styles.bandRow}>
                      <span>5 Game 80% Band</span>
                      <strong>
                        {formatNumber(computed.countProjection.horizons[5].band80.lower)} to{" "}
                        {formatNumber(computed.countProjection.horizons[5].band80.upper)}
                      </strong>
                    </div>
                    <div className={styles.bandRow}>
                      <span>10 Game 80% Band</span>
                      <strong>
                        {formatNumber(computed.countProjection.horizons[10].band80.lower)} to{" "}
                        {formatNumber(computed.countProjection.horizons[10].band80.upper)}
                      </strong>
                    </div>
                    <div className={styles.bandRow}>
                      <span>Variance</span>
                      <strong>{formatNumber(computed.countProjection.perGame.variance)}</strong>
                    </div>
                  </div>
                </article>

                <article className={styles.card}>
                  <h3>FO% Projection Bands</h3>
                  <div className={styles.bandList}>
                    <div className={styles.bandRow}>
                      <span>1 Game 80% Band</span>
                      <strong>
                        {formatNumber(
                          computed.faceoffProjection.perGameBand80.lower * 100
                        )}
                        % to{" "}
                        {formatNumber(
                          computed.faceoffProjection.perGameBand80.upper * 100
                        )}
                        %
                      </strong>
                    </div>
                    <div className={styles.bandRow}>
                      <span>5 Game Attempts</span>
                      <strong>{formatNumber(computed.faceoffProjection.horizons[5].attempts)}</strong>
                    </div>
                    <div className={styles.bandRow}>
                      <span>10 Game Attempts</span>
                      <strong>{formatNumber(computed.faceoffProjection.horizons[10].attempts)}</strong>
                    </div>
                    <div className={styles.bandRow}>
                      <span>10 Game 80% Band</span>
                      <strong>
                        {formatNumber(
                          computed.faceoffProjection.horizons[10].band80.lower * 100
                        )}
                        % to{" "}
                        {formatNumber(
                          computed.faceoffProjection.horizons[10].band80.upper * 100
                        )}
                        %
                      </strong>
                    </div>
                  </div>
                </article>

                <article className={styles.card}>
                  <h3>Feature Drivers</h3>
                  <ul className={styles.driverList}>
                    {computed.explanationBullets.map((bullet, index) => (
                      <li key={`${bullet.featureKey}-${index}`} className={styles.driverRow}>
                        <div className={styles.driverMeta}>
                          <span className={styles.driverLabel}>{bullet.featureLabel}</span>
                          <p className={styles.driverCopy}>
                            {computed.explanations[index] ?? "No explanation generated."}
                          </p>
                        </div>
                        <div className={styles.driverBadgeStack}>
                          <span className={styles.subtle}>
                            {bullet.direction}
                            {bullet.magnitude != null
                              ? ` ${formatNumber(bullet.magnitude, bullet.magnitudeUnit === "%" ? 1 : 2)}${bullet.magnitudeUnit ?? ""}`
                              : ""}
                          </span>
                          {computed.importances[index] ? (
                            <span className={styles.subtle}>
                              contrib {formatNumber(computed.importances[index].contribution, 3)}
                            </span>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                </article>
              </div>

              <div className={styles.card}>
                <h3>Raw Snapshot</h3>
                <p className={styles.sectionHint}>
                  Quick readout of the current loaded values before API wiring.
                </p>
                <div className={styles.statList}>
                  <div className={styles.statRow}>
                    <span>Class Probabilities</span>
                    <strong className={styles.mono}>
                      {JSON.stringify(computed.probabilityResult.probabilities)}
                    </strong>
                  </div>
                  <div className={styles.statRow}>
                    <span>Flags</span>
                    <strong className={styles.mono}>
                      {JSON.stringify(computed.explicitFlags)}
                    </strong>
                  </div>
                  <div className={styles.statRow}>
                    <span>Player Snapshot Source</span>
                    <strong className={styles.mono}>
                      {playerSnapshot
                        ? JSON.stringify({
                            playerId: playerSnapshot.playerId,
                            gameDate: playerSnapshot.gameDate,
                            shotsPer60Last5:
                              playerSnapshot.metrics.sog_per_60_avg_last5,
                            shotsPer60Career:
                              playerSnapshot.metrics.sog_per_60_avg_career
                          })
                        : "No player loaded"}
                    </strong>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
    </>
  );
}
