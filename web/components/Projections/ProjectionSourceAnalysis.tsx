// components/Projections/ProjectionSourceAnalysis.tsx

import React, { useState, useMemo } from "react";
import { ProcessedPlayer } from "hooks/useProcessedProjectionsData";
import styles from "./ProjectionSourceAnalysis.module.scss";

interface ProjectionSourceAnalysisProps {
  players: ProcessedPlayer[];
  fantasyPointSettings: Record<string, number>;
  sourceControls: Record<string, { isSelected: boolean; weight: number }>;
  activePlayerType: "skater" | "goalie";
}

// --- Internal Types ---
interface SourcePerPlayerProjection {
  sourceId: string;
  projectedTotal: number | null;
  projectedPerGame: number | null;
  actualTotal: number | null;
  actualPerGame: number | null;
}

interface SourceOverallMetrics {
  sourceId: string;
  sourceName: string;
  playersWithBothProjectedAndActual: number;
  averageMarginOfError: number; // absolute
  medianMarginOfError: number;
  averageAccuracyPercentage: number;
  withinTenPercent: number;
  withinTwentyPercent: number;
  overProjectionBias: number; // signed average (actual - projected)
  qualityScore: number;
  averageMarginOfErrorPerGame: number;
  medianMarginOfErrorPerGame: number;
  averageAccuracyPercentagePerGame: number;
  withinTenPercentPerGame: number;
  withinTwentyPercentPerGame: number;
  overProjectionBiasPerGame: number;
  qualityScorePerGame: number;
  positionMetrics: Record<
    string,
    {
      playerCount: number;
      averageAccuracy: number;
      averageAccuracyPerGame: number;
    }
  >;
}

interface PositionRankingItem {
  position: string;
  rankings: Array<{
    sourceId: string;
    sourceName: string;
    rank: number;
    averageAccuracy: number;
    averageAccuracyPerGame: number;
    averageMarginOfError: number;
    averageMarginOfErrorPerGame: number;
    playerCount: number;
  }>;
}

interface RoundRankingItem {
  round: number;
  roundLabel: string;
  rankings: Array<{
    sourceId: string;
    sourceName: string;
    rank: number;
    averageAccuracy: number;
    averageAccuracyPerGame: number;
    averageMarginOfError: number;
    averageMarginOfErrorPerGame: number;
    playerCount: number;
  }>;
}

interface ComputedAnalysisResult {
  overallRankingsTotal: SourceOverallMetrics[];
  overallRankingsPerGame: SourceOverallMetrics[];
  positionRankings: PositionRankingItem[];
  roundRankings: RoundRankingItem[];
}

// --- Utility Functions ---
function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

// Build per-source fantasy point projections for each player from contributing stat details
function buildPerSourcePlayerProjections(
  player: ProcessedPlayer,
  fantasyPointSettings: Record<string, number>,
  selectedSourceIds: string[]
): SourcePerPlayerProjection[] {
  // We accumulate per source
  const perSourceTotals: Record<string, number> = {};
  const perSourceProjectedGP: Record<string, number | null> = {}; // Use player's projected GP (same for all sources) for per-game
  const projectedGP = player.combinedStats.GAMES_PLAYED?.projected ?? null;
  const actualGP = player.combinedStats.GAMES_PLAYED?.actual ?? null;

  // Iterate combinedStats (projectedDetail.contributingSources)
  Object.entries(player.combinedStats).forEach(([statKey, statObj]) => {
    const fpVal = fantasyPointSettings[statKey];
    if (!fpVal) return; // skip stats not used in scoring
    const detail = statObj.projectedDetail;
    if (!detail) return;
    detail.contributingSources.forEach((src: any) => {
      if (
        !selectedSourceIds.includes(src.name) &&
        !selectedSourceIds.includes(src.sourceId)
      )
        return; // attempt by display name; fallback
      const srcKey = src.name; // Use display name as key (assumes uniqueness)
      if (typeof src.value === "number" && src.value !== null) {
        perSourceTotals[srcKey] =
          (perSourceTotals[srcKey] || 0) + src.value * fpVal;
        if (!(srcKey in perSourceProjectedGP))
          perSourceProjectedGP[srcKey] = projectedGP;
      }
    });
  });

  const actualTotal = player.fantasyPoints.actual;
  const actualPerGame =
    actualTotal !== null && actualGP && actualGP > 0
      ? actualTotal / actualGP
      : null;

  return Object.keys(perSourceTotals).map((sourceName) => {
    const projectedTotal = perSourceTotals[sourceName] ?? null;
    const projectedPerGame =
      projectedTotal !== null && projectedGP && projectedGP > 0
        ? projectedTotal / projectedGP
        : null;
    return {
      sourceId: sourceName, // using name until a stable id is available
      projectedTotal,
      projectedPerGame,
      actualTotal,
      actualPerGame
    };
  });
}

function computeSourceMetrics(
  players: ProcessedPlayer[],
  fantasyPointSettings: Record<string, number>,
  sourceControls: Record<string, { isSelected: boolean; weight: number }>
): ComputedAnalysisResult {
  const selectedSourceIds = Object.entries(sourceControls)
    .filter(([, c]) => c.isSelected && c.weight > 0)
    .map(([id]) => id);
  if (!selectedSourceIds.length) {
    return {
      overallRankingsTotal: [],
      overallRankingsPerGame: [],
      positionRankings: [],
      roundRankings: []
    };
  }

  // Map: sourceName -> arrays
  interface AggBuckets {
    errors: number[]; // actual - projected
    absErrors: number[];
    projectedTotals: number[];
    accuracyPcts: number[]; // per-player accuracy % using projected baseline
    errorsPerGame: number[];
    absErrorsPerGame: number[];
    projectedPerGame: number[];
    accuracyPctsPerGame: number[];
    within10: number;
    within20: number;
    within10PerGame: number;
    within20PerGame: number;
    count: number;
    countPerGame: number;
    positions: Record<
      string,
      {
        acc: number[];
        accPg: number[];
        count: number;
        countPg: number;
        errors: number[];
        errorsPg: number[];
      }
    >; // for position metrics
  }

  const agg: Record<string, AggBuckets> = {};

  players.forEach((p) => {
    if (!p || p.fantasyPoints.actual === null) return;
    const position = (p.displayPosition || "UNK").split(",")[0].trim();
    const projections = buildPerSourcePlayerProjections(
      p,
      fantasyPointSettings,
      selectedSourceIds
    );
    projections.forEach((proj) => {
      if (proj.projectedTotal === null || proj.actualTotal === null) return;
      const key = proj.sourceId;
      if (!agg[key]) {
        agg[key] = {
          errors: [],
          absErrors: [],
          projectedTotals: [],
          accuracyPcts: [],
          errorsPerGame: [],
          absErrorsPerGame: [],
          projectedPerGame: [],
          accuracyPctsPerGame: [],
          within10: 0,
          within20: 0,
          within10PerGame: 0,
          within20PerGame: 0,
          count: 0,
          countPerGame: 0,
          positions: {}
        };
      }
      const bucket = agg[key];
      const error = proj.actualTotal - proj.projectedTotal;
      const absError = Math.abs(error);
      const accuracyPct =
        proj.projectedTotal !== 0
          ? (1 - absError / Math.max(1e-9, Math.abs(proj.projectedTotal))) * 100
          : 0;
      bucket.errors.push(error);
      bucket.absErrors.push(absError);
      bucket.projectedTotals.push(proj.projectedTotal);
      bucket.accuracyPcts.push(accuracyPct);
      if (absError / Math.max(1e-9, Math.abs(proj.projectedTotal)) <= 0.1)
        bucket.within10++;
      if (absError / Math.max(1e-9, Math.abs(proj.projectedTotal)) <= 0.2)
        bucket.within20++;
      bucket.count++;

      if (proj.projectedPerGame !== null && proj.actualPerGame !== null) {
        const errorPg = proj.actualPerGame - proj.projectedPerGame;
        const absErrorPg = Math.abs(errorPg);
        const accuracyPctPg =
          proj.projectedPerGame !== 0
            ? (1 -
                absErrorPg / Math.max(1e-9, Math.abs(proj.projectedPerGame))) *
              100
            : 0;
        bucket.errorsPerGame.push(errorPg);
        bucket.absErrorsPerGame.push(absErrorPg);
        bucket.projectedPerGame.push(proj.projectedPerGame);
        bucket.accuracyPctsPerGame.push(accuracyPctPg);
        if (absErrorPg / Math.max(1e-9, Math.abs(proj.projectedPerGame)) <= 0.1)
          bucket.within10PerGame++;
        if (absErrorPg / Math.max(1e-9, Math.abs(proj.projectedPerGame)) <= 0.2)
          bucket.within20PerGame++;
        bucket.countPerGame++;
      }

      if (!bucket.positions[position]) {
        bucket.positions[position] = {
          acc: [],
          accPg: [],
          count: 0,
          countPg: 0,
          errors: [],
          errorsPg: []
        };
      }
      bucket.positions[position].acc.push(accuracyPct);
      bucket.positions[position].errors.push(error);
      bucket.positions[position].count++;
      if (proj.projectedPerGame !== null && proj.actualPerGame !== null) {
        const lastAccPg =
          bucket.accuracyPctsPerGame[bucket.accuracyPctsPerGame.length - 1];
        bucket.positions[position].accPg.push(lastAccPg);
        bucket.positions[position].errorsPg.push(
          bucket.errorsPerGame[bucket.errorsPerGame.length - 1]
        );
        bucket.positions[position].countPg++;
      }
    });
  });

  const overallMetrics: SourceOverallMetrics[] = Object.entries(agg).map(
    ([sourceName, b]) => {
      const avgAbsError = b.absErrors.length
        ? b.absErrors.reduce((a, c) => a + c, 0) / b.absErrors.length
        : 0;
      const avgAcc = b.accuracyPcts.length
        ? b.accuracyPcts.reduce((a, c) => a + c, 0) / b.accuracyPcts.length
        : 0;
      const bias = b.errors.length
        ? b.errors.reduce((a, c) => a + c, 0) / b.errors.length
        : 0;
      const avgAbsErrorPg = b.absErrorsPerGame.length
        ? b.absErrorsPerGame.reduce((a, c) => a + c, 0) /
          b.absErrorsPerGame.length
        : 0;
      const avgAccPg = b.accuracyPctsPerGame.length
        ? b.accuracyPctsPerGame.reduce((a, c) => a + c, 0) /
          b.accuracyPctsPerGame.length
        : 0;
      const biasPg = b.errorsPerGame.length
        ? b.errorsPerGame.reduce((a, c) => a + c, 0) / b.errorsPerGame.length
        : 0;

      // Simple composite quality score (can be refined later)
      const qualityScore =
        avgAcc -
        avgAbsError +
        (b.within20 / Math.max(1, b.count)) * 100 -
        Math.abs(bias) * 0.5;
      const qualityScorePg =
        avgAccPg -
        avgAbsErrorPg +
        (b.within20PerGame / Math.max(1, b.countPerGame)) * 100 -
        Math.abs(biasPg) * 0.5;

      const positionMetrics: SourceOverallMetrics["positionMetrics"] = {};
      Object.entries(b.positions).forEach(([pos, pm]) => {
        positionMetrics[pos] = {
          playerCount: pm.count,
          averageAccuracy: pm.acc.length
            ? pm.acc.reduce((a, c) => a + c, 0) / pm.acc.length
            : 0,
          averageAccuracyPerGame: pm.accPg.length
            ? pm.accPg.reduce((a, c) => a + c, 0) / pm.accPg.length
            : 0
        };
      });

      return {
        sourceId: sourceName,
        sourceName,
        playersWithBothProjectedAndActual: b.count,
        averageMarginOfError: avgAbsError,
        medianMarginOfError: median(b.absErrors),
        averageAccuracyPercentage: avgAcc,
        withinTenPercent: b.within10,
        withinTwentyPercent: b.within20,
        overProjectionBias: bias,
        qualityScore: qualityScore,
        averageMarginOfErrorPerGame: avgAbsErrorPg,
        medianMarginOfErrorPerGame: median(b.absErrorsPerGame),
        averageAccuracyPercentagePerGame: avgAccPg,
        withinTenPercentPerGame: b.within10PerGame,
        withinTwentyPercentPerGame: b.within20PerGame,
        overProjectionBiasPerGame: biasPg,
        qualityScorePerGame: qualityScorePg,
        positionMetrics
      };
    }
  );

  // Sort for overall rankings (total)
  const overallRankingsTotal = [...overallMetrics].sort(
    (a, b) => b.qualityScore - a.qualityScore
  );
  const overallRankingsPerGame = [...overallMetrics].sort(
    (a, b) => b.qualityScorePerGame - a.qualityScorePerGame
  );

  // Position rankings
  const positions = new Set<string>();
  overallMetrics.forEach((m) =>
    Object.keys(m.positionMetrics).forEach((p) => positions.add(p))
  );
  const positionRankings: PositionRankingItem[] = Array.from(positions)
    .sort()
    .map((pos) => {
      const rankings = overallMetrics
        .filter((m) => m.positionMetrics[pos]?.playerCount > 0)
        .map((m) => ({
          sourceId: m.sourceId,
          sourceName: m.sourceName,
          rank: 0, // temp, will reassign
          averageAccuracy: m.positionMetrics[pos].averageAccuracy,
          averageAccuracyPerGame: m.positionMetrics[pos].averageAccuracyPerGame,
          averageMarginOfError: m.averageMarginOfError,
          averageMarginOfErrorPerGame: m.averageMarginOfErrorPerGame,
          playerCount: m.positionMetrics[pos].playerCount
        }))
        .sort((a, b) => b.averageAccuracy - a.averageAccuracy)
        .map((r, idx) => ({ ...r, rank: idx + 1 }));
      return { position: pos, rankings };
    });

  // Round rankings using yahooAvgPick (12 picks per round)
  const roundGroups: Record<number, ProcessedPlayer[]> = {};
  players.forEach((p) => {
    if (p.yahooAvgPick && p.yahooAvgPick > 0) {
      const round = Math.ceil(p.yahooAvgPick / 12);
      if (round <= 20) {
        if (!roundGroups[round]) roundGroups[round] = [];
        roundGroups[round].push(p);
      }
    }
  });

  const roundRankings: RoundRankingItem[] = Object.keys(roundGroups)
    .map(Number)
    .sort((a, b) => a - b)
    .map((round) => {
      const roundPlayers = roundGroups[round];
      // Recompute metrics limited to these players
      const subsetMetrics = computeSourceMetrics(
        roundPlayers,
        fantasyPointSettings,
        sourceControls
      ).overallRankingsTotal;
      const rankings = subsetMetrics
        .map((m) => ({
          sourceId: m.sourceId,
          sourceName: m.sourceName,
          rank: 0,
          averageAccuracy: m.averageAccuracyPercentage,
          averageAccuracyPerGame: m.averageAccuracyPercentagePerGame,
          averageMarginOfError: m.averageMarginOfError,
          averageMarginOfErrorPerGame: m.averageMarginOfErrorPerGame,
          playerCount: m.playersWithBothProjectedAndActual
        }))
        .sort((a, b) => b.averageAccuracy - a.averageAccuracy)
        .map((r, idx) => ({ ...r, rank: idx + 1 }));
      return { round, roundLabel: `Round ${round}`, rankings };
    });

  return {
    overallRankingsTotal,
    overallRankingsPerGame,
    positionRankings,
    roundRankings
  };
}

export const ProjectionSourceAnalysis: React.FC<
  ProjectionSourceAnalysisProps
> = ({ players, fantasyPointSettings, sourceControls }) => {
  const [selectedView, setSelectedView] = useState<
    "overall" | "positions" | "rounds" | "detailed"
  >("overall");
  const [usePerGameMetrics, setUsePerGameMetrics] = useState<boolean>(false);

  const analysis = useMemo(
    () => computeSourceMetrics(players, fantasyPointSettings, sourceControls),
    [players, fantasyPointSettings, sourceControls]
  );

  if ((analysis.overallRankingsTotal?.length || 0) === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <h3>No Projection Analysis Available</h3>
          <p>
            Select projection sources and ensure players have both projected and
            actual fantasy points data.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>
          Projection Source{" "}
          <span className={styles.accent}>Accuracy Analysis</span>
        </h2>
        <div className={styles.controlsSection}>
          {/* Per-Game vs Total Toggle */}
          <div className={styles.metricsToggle}>
            <button
              className={`${styles.toggleButton} ${!usePerGameMetrics ? styles.active : ""}`}
              onClick={() => setUsePerGameMetrics(false)}
            >
              Total Points
            </button>
            <button
              className={`${styles.toggleButton} ${usePerGameMetrics ? styles.active : ""}`}
              onClick={() => setUsePerGameMetrics(true)}
            >
              Per-Game
            </button>
          </div>

          {/* View Selector */}
          <div className={styles.viewSelector}>
            <button
              className={`${styles.viewButton} ${selectedView === "overall" ? styles.active : ""}`}
              onClick={() => setSelectedView("overall")}
            >
              Overall Rankings
            </button>
            <button
              className={`${styles.viewButton} ${selectedView === "positions" ? styles.active : ""}`}
              onClick={() => setSelectedView("positions")}
            >
              By Position
            </button>
            <button
              className={`${styles.viewButton} ${selectedView === "rounds" ? styles.active : ""}`}
              onClick={() => setSelectedView("rounds")}
            >
              By Round
            </button>
            <button
              className={`${styles.viewButton} ${selectedView === "detailed" ? styles.active : ""}`}
              onClick={() => setSelectedView("detailed")}
            >
              Detailed Metrics
            </button>
          </div>
        </div>
      </div>

      {selectedView === "overall" && (
        <OverallRankingsView
          rankings={
            (usePerGameMetrics
              ? analysis.overallRankingsPerGame
              : analysis.overallRankingsTotal) || []
          }
          usePerGameMetrics={usePerGameMetrics}
        />
      )}

      {selectedView === "positions" && (
        <PositionRankingsView
          positionRankings={getDynamicPositionRankings(
            analysis.positionRankings || [],
            usePerGameMetrics
          )}
          usePerGameMetrics={usePerGameMetrics}
        />
      )}

      {selectedView === "rounds" && (
        <RoundRankingsView
          roundRankings={getDynamicRoundRankings(
            analysis.roundRankings || [],
            usePerGameMetrics
          )}
          usePerGameMetrics={usePerGameMetrics}
        />
      )}

      {selectedView === "detailed" && (
        <DetailedMetricsView
          sourceMetrics={
            (usePerGameMetrics
              ? analysis.overallRankingsPerGame
              : analysis.overallRankingsTotal) || []
          }
          usePerGameMetrics={usePerGameMetrics}
        />
      )}
    </div>
  );
};

const OverallRankingsView: React.FC<{
  rankings: any[];
  usePerGameMetrics: boolean;
}> = ({ rankings, usePerGameMetrics }) => {
  return (
    <div className={styles.overallView}>
      <div className={styles.rankingsTable}>
        <div className={styles.tableHeader}>
          <div className={styles.rankColumn}>Rank</div>
          <div className={styles.sourceColumn}>Projection Source</div>
          <div className={styles.metricColumn}>Quality Score</div>
          <div className={styles.metricColumn}>Accuracy %</div>
          <div className={styles.metricColumn}>Avg Error</div>
          <div className={styles.metricColumn}>Within 20%</div>
          <div className={styles.metricColumn}>Sample Size</div>
          <div className={styles.metricColumn}>Bias</div>
        </div>
        {rankings.map((source, index) => {
          // Use per-game metrics if toggle is enabled
          const accuracy = usePerGameMetrics
            ? source.averageAccuracyPercentagePerGame
            : source.averageAccuracyPercentage;
          const marginOfError = usePerGameMetrics
            ? source.averageMarginOfErrorPerGame
            : source.averageMarginOfError;
          const withinTwenty = usePerGameMetrics
            ? source.withinTwentyPercentPerGame
            : source.withinTwentyPercent;
          const bias = usePerGameMetrics
            ? source.overProjectionBiasPerGame
            : source.overProjectionBias;
          const qualityScore = usePerGameMetrics
            ? source.qualityScorePerGame
            : source.qualityScore;

          return (
            <div
              key={source.sourceId}
              className={`${styles.tableRow} ${getRankClassName(index)}`}
            >
              <div className={styles.rankColumn}>
                <span className={styles.rankBadge}>#{index + 1}</span>
              </div>
              <div className={styles.sourceColumn}>
                <span className={styles.sourceName}>{source.sourceName}</span>
              </div>
              <div className={styles.metricColumn}>
                <span className={styles.qualityScore}>
                  {qualityScore.toFixed(1)}
                </span>
              </div>
              <div className={styles.metricColumn}>{accuracy.toFixed(1)}%</div>
              <div className={styles.metricColumn}>
                {marginOfError.toFixed(1)} pts
              </div>
              <div className={styles.metricColumn}>
                {(
                  (withinTwenty / source.playersWithBothProjectedAndActual) *
                  100
                ).toFixed(1)}
                %
              </div>
              <div className={styles.metricColumn}>
                {source.playersWithBothProjectedAndActual} players
              </div>
              <div className={styles.metricColumn}>
                <span className={getBiasClassName(bias)}>
                  {bias > 0 ? "+" : ""}
                  {bias.toFixed(1)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className={styles.summaryCards}>
        <div className={styles.summaryCard}>
          <h3>Best Overall</h3>
          <p className={styles.bestSource}>{rankings[0]?.sourceName}</p>
          <p className={styles.bestScore}>
            Quality Score:{" "}
            {(usePerGameMetrics
              ? rankings[0]?.qualityScorePerGame
              : rankings[0]?.qualityScore
            )?.toFixed(1)}
          </p>
        </div>
        <div className={styles.summaryCard}>
          <h3>Most Accurate</h3>
          <p className={styles.bestSource}>
            {
              [...rankings].sort((a, b) => {
                const accuracyA = usePerGameMetrics
                  ? a.averageAccuracyPercentagePerGame
                  : a.averageAccuracyPercentage;
                const accuracyB = usePerGameMetrics
                  ? b.averageAccuracyPercentagePerGame
                  : b.averageAccuracyPercentage;
                return accuracyB - accuracyA;
              })[0]?.sourceName
            }
          </p>
          <p className={styles.bestScore}>
            {[...rankings]
              .sort((a, b) => {
                const accuracyA = usePerGameMetrics
                  ? a.averageAccuracyPercentagePerGame
                  : a.averageAccuracyPercentage;
                const accuracyB = usePerGameMetrics
                  ? b.averageAccuracyPercentagePerGame
                  : b.averageAccuracyPercentage;
                return accuracyB - accuracyA;
              })[0]
              ?.[
                usePerGameMetrics
                  ? "averageAccuracyPercentagePerGame"
                  : "averageAccuracyPercentage"
              ].toFixed(1)}
            % Accuracy
          </p>
        </div>
        <div className={styles.summaryCard}>
          <h3>Lowest Error</h3>
          <p className={styles.bestSource}>
            {
              [...rankings].sort((a, b) => {
                const errorA = usePerGameMetrics
                  ? a.averageMarginOfErrorPerGame
                  : a.averageMarginOfError;
                const errorB = usePerGameMetrics
                  ? b.averageMarginOfErrorPerGame
                  : b.averageMarginOfError;
                return errorA - errorB;
              })[0]?.sourceName
            }
          </p>
          <p className={styles.bestScore}>
            {[...rankings]
              .sort((a, b) => {
                const errorA = usePerGameMetrics
                  ? a.averageMarginOfErrorPerGame
                  : a.averageMarginOfError;
                const errorB = usePerGameMetrics
                  ? b.averageMarginOfErrorPerGame
                  : b.averageMarginOfError;
                return errorA - errorB;
              })[0]
              ?.[
                usePerGameMetrics
                  ? "averageMarginOfErrorPerGame"
                  : "averageMarginOfError"
              ].toFixed(1)}{" "}
            pts error
          </p>
        </div>
      </div>
    </div>
  );
};

const PositionRankingsView: React.FC<{
  positionRankings: any[];
  usePerGameMetrics: boolean;
}> = ({ positionRankings, usePerGameMetrics }) => {
  return (
    <div className={styles.positionsView}>
      {positionRankings.map((positionData) => (
        <div key={positionData.position} className={styles.positionSection}>
          <h3 className={styles.positionTitle}>{positionData.position}</h3>
          <div className={styles.positionTable}>
            <div className={styles.positionHeader}>
              <div className={styles.posRankCol}>Rank</div>
              <div className={styles.posSourceCol}>Source</div>
              <div className={styles.posMetricCol}>Accuracy</div>
              <div className={styles.posMetricCol}>Avg Error</div>
              <div className={styles.posMetricCol}>Players</div>
            </div>
            {positionData.rankings.map((ranking: any) => {
              // Use per-game metrics if toggle is enabled
              const accuracy = usePerGameMetrics
                ? ranking.averageAccuracyPerGame
                : ranking.averageAccuracy;
              const marginOfError = usePerGameMetrics
                ? ranking.averageMarginOfErrorPerGame
                : ranking.averageMarginOfError;

              return (
                <div
                  key={ranking.sourceId}
                  className={`${styles.positionRow} ${getPositionRankClassName(ranking.rank)}`}
                >
                  <div className={styles.posRankCol}>
                    <span className={styles.posRankBadge}>#{ranking.rank}</span>
                  </div>
                  <div className={styles.posSourceCol}>
                    {ranking.sourceName}
                  </div>
                  <div className={styles.posMetricCol}>
                    {accuracy.toFixed(1)}%
                  </div>
                  <div className={styles.posMetricCol}>
                    {marginOfError.toFixed(1)} pts
                  </div>
                  <div className={styles.posMetricCol}>
                    {ranking.playerCount}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

const RoundRankingsView: React.FC<{
  roundRankings: any[];
  usePerGameMetrics: boolean;
}> = ({ roundRankings, usePerGameMetrics }) => {
  return (
    <div className={styles.roundsView}>
      <div className={styles.roundsHeader}>
        <h3>Projection Accuracy by Draft Round</h3>
        <p>
          Shows how well each source predicts players in different draft rounds
          (12-pick bins) -{" "}
          {usePerGameMetrics ? "Per-Game Analysis" : "Total Points Analysis"}
        </p>
      </div>
      <div className={styles.roundsGrid}>
        {roundRankings.map((roundData) => (
          <div key={roundData.round} className={styles.roundSection}>
            <h3 className={styles.roundTitle}>{roundData.roundLabel}</h3>
            <div className={styles.roundSubtitle}>
              Picks {(roundData.round - 1) * 12 + 1}-{roundData.round * 12}
            </div>
            <div className={styles.roundTable}>
              <div className={styles.roundHeader}>
                <div className={styles.roundRankCol}>Rank</div>
                <div className={styles.roundSourceCol}>Source</div>
                <div className={styles.roundMetricCol}>Accuracy</div>
                <div className={styles.roundMetricCol}>Avg Error</div>
                <div className={styles.roundMetricCol}>Players</div>
              </div>
              {roundData.rankings.map((ranking: any) => {
                // Use per-game metrics if toggle is enabled
                const accuracy = usePerGameMetrics
                  ? ranking.averageAccuracyPerGame
                  : ranking.averageAccuracy;
                const marginOfError = usePerGameMetrics
                  ? ranking.averageMarginOfErrorPerGame
                  : ranking.averageMarginOfError;

                return (
                  <div
                    key={ranking.sourceId}
                    className={`${styles.roundRow} ${getRoundRankClassName(ranking.rank)}`}
                  >
                    <div className={styles.roundRankCol}>
                      <span className={styles.roundRankBadge}>
                        #{ranking.rank}
                      </span>
                    </div>
                    <div className={styles.roundSourceCol}>
                      {ranking.sourceName}
                    </div>
                    <div className={styles.roundMetricCol}>
                      {accuracy.toFixed(1)}%
                    </div>
                    <div className={styles.roundMetricCol}>
                      {marginOfError.toFixed(1)} pts
                    </div>
                    <div className={styles.roundMetricCol}>
                      {ranking.playerCount}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const DetailedMetricsView: React.FC<{
  sourceMetrics: any[];
  usePerGameMetrics: boolean;
}> = ({ sourceMetrics, usePerGameMetrics }) => {
  return (
    <div className={styles.detailedView}>
      {sourceMetrics.map((source) => {
        // Use per-game metrics if toggle is enabled
        const accuracy = usePerGameMetrics
          ? source.averageAccuracyPercentagePerGame
          : source.averageAccuracyPercentage;
        const marginOfError = usePerGameMetrics
          ? source.averageMarginOfErrorPerGame
          : source.averageMarginOfError;
        const medianError = usePerGameMetrics
          ? source.medianMarginOfErrorPerGame
          : source.medianMarginOfError;
        const withinTen = usePerGameMetrics
          ? source.withinTenPercentPerGame
          : source.withinTenPercent;
        const withinTwenty = usePerGameMetrics
          ? source.withinTwentyPercentPerGame
          : source.withinTwentyPercent;
        const bias = usePerGameMetrics
          ? source.overProjectionBiasPerGame
          : source.overProjectionBias;
        const qualityScore = usePerGameMetrics
          ? source.qualityScorePerGame
          : source.qualityScore;

        return (
          <div key={source.sourceId} className={styles.sourceDetailCard}>
            <div className={styles.sourceDetailHeader}>
              <h3>{source.sourceName}</h3>
              <div className={styles.qualityBadge}>
                Quality Score: {qualityScore.toFixed(1)}
              </div>
            </div>

            <div className={styles.metricsGrid}>
              <div className={styles.metricGroup}>
                <h4>Accuracy Metrics</h4>
                <div className={styles.metricItem}>
                  <span className={styles.metricLabel}>Average Accuracy:</span>
                  <span className={styles.metricValue}>
                    {accuracy.toFixed(1)}%
                  </span>
                </div>
                <div className={styles.metricItem}>
                  <span className={styles.metricLabel}>Average Error:</span>
                  <span className={styles.metricValue}>
                    {marginOfError.toFixed(1)} pts
                  </span>
                </div>
                <div className={styles.metricItem}>
                  <span className={styles.metricLabel}>Median Error:</span>
                  <span className={styles.metricValue}>
                    {medianError.toFixed(1)} pts
                  </span>
                </div>
              </div>

              <div className={styles.metricGroup}>
                <h4>Consistency</h4>
                <div className={styles.metricItem}>
                  <span className={styles.metricLabel}>Within 10%:</span>
                  <span className={styles.metricValue}>
                    {withinTen} players
                  </span>
                </div>
                <div className={styles.metricItem}>
                  <span className={styles.metricLabel}>Within 20%:</span>
                  <span className={styles.metricValue}>
                    {withinTwenty} players
                  </span>
                </div>
                <div className={styles.metricItem}>
                  <span className={styles.metricLabel}>Sample Size:</span>
                  <span className={styles.metricValue}>
                    {source.playersWithBothProjectedAndActual} players
                  </span>
                </div>
              </div>

              <div className={styles.metricGroup}>
                <h4>Projection Bias</h4>
                <div className={styles.metricItem}>
                  <span className={styles.metricLabel}>Bias Direction:</span>
                  <span
                    className={`${styles.metricValue} ${getBiasClassName(bias)}`}
                  >
                    {bias > 0
                      ? "Over-projects"
                      : bias < 0
                        ? "Under-projects"
                        : "Neutral"}
                  </span>
                </div>
                <div className={styles.metricItem}>
                  <span className={styles.metricLabel}>Bias Amount:</span>
                  <span className={styles.metricValue}>
                    {bias > 0 ? "+" : ""}
                    {bias.toFixed(1)} pts
                  </span>
                </div>
              </div>
            </div>

            <div className={styles.positionBreakdown}>
              <h4>Position Breakdown</h4>
              <div className={styles.positionGrid}>
                {Object.entries(source.positionMetrics).map(
                  ([position, metrics]: [string, any]) => {
                    // Use per-game position metrics if toggle is enabled
                    const positionAccuracy = usePerGameMetrics
                      ? metrics.averageAccuracyPerGame
                      : metrics.averageAccuracy;

                    return (
                      <div key={position} className={styles.positionMetric}>
                        <span className={styles.positionName}>{position}</span>
                        <span className={styles.positionAccuracy}>
                          {positionAccuracy.toFixed(1)}%
                        </span>
                        <span className={styles.positionCount}>
                          ({metrics.playerCount})
                        </span>
                      </div>
                    );
                  }
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// Helper functions
function getRankClassName(rank: number): string {
  if (rank === 0) return styles.rank1;
  if (rank === 1) return styles.rank2;
  if (rank === 2) return styles.rank3;
  return "";
}

function getPositionRankClassName(rank: number): string {
  if (rank === 1) return styles.posRank1;
  if (rank === 2) return styles.posRank2;
  return "";
}

function getRoundRankClassName(rank: number): string {
  if (rank === 1) return styles.roundRank1;
  if (rank === 2) return styles.roundRank2;
  return "";
}

function getBiasClassName(bias: number): string {
  if (bias > 5) return styles.overBias;
  if (bias < -5) return styles.underBias;
  return styles.neutralBias;
}

// Helper function to dynamically re-rank position data based on metric type
function getDynamicPositionRankings(
  positionRankings: PositionRankingItem[],
  usePerGameMetrics: boolean
): PositionRankingItem[] {
  return positionRankings.map((positionData) => ({
    ...positionData,
    rankings: [...positionData.rankings]
      .sort((a, b) => {
        const metricA = usePerGameMetrics
          ? a.averageAccuracyPerGame
          : a.averageAccuracy;
        const metricB = usePerGameMetrics
          ? b.averageAccuracyPerGame
          : b.averageAccuracy;
        return metricB - metricA; // Sort by accuracy descending
      })
      .map((item, index) => ({ ...item, rank: index + 1 })) // Re-assign ranks
  }));
}

// Helper function to dynamically re-rank round data based on metric type
function getDynamicRoundRankings(
  roundRankings: RoundRankingItem[],
  usePerGameMetrics: boolean
): RoundRankingItem[] {
  return roundRankings.map((roundData) => ({
    ...roundData,
    rankings: [...roundData.rankings]
      .sort((a, b) => {
        const metricA = usePerGameMetrics
          ? a.averageAccuracyPerGame
          : a.averageAccuracy;
        const metricB = usePerGameMetrics
          ? b.averageAccuracyPerGame
          : b.averageAccuracy;
        return metricB - metricA; // Sort by accuracy descending
      })
      .map((item, index) => ({ ...item, rank: index + 1 })) // Re-assign ranks
  }));
}

export default ProjectionSourceAnalysis;
