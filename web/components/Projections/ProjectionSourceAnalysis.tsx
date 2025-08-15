// components/Projections/ProjectionSourceAnalysis.tsx

import React, { useState } from "react";
import {
  useProjectionSourceAnalysis,
  PositionSourceRanking,
  RoundSourceRanking
} from "hooks/useProjectionSourceAnalysis";
import { ProcessedPlayer } from "hooks/useProcessedProjectionsData";
import styles from "./ProjectionSourceAnalysis.module.scss";

interface ProjectionSourceAnalysisProps {
  players: ProcessedPlayer[];
  fantasyPointSettings: Record<string, number>;
  sourceControls: Record<string, { isSelected: boolean; weight: number }>;
  activePlayerType: "skater" | "goalie";
}

export const ProjectionSourceAnalysis: React.FC<
  ProjectionSourceAnalysisProps
> = ({ players, fantasyPointSettings, sourceControls, activePlayerType }) => {
  const [selectedView, setSelectedView] = useState<
    "overall" | "positions" | "rounds" | "detailed"
  >("overall");
  const [usePerGameMetrics, setUsePerGameMetrics] = useState<boolean>(false);

  const analysis = useProjectionSourceAnalysis(
    players,
    fantasyPointSettings,
    sourceControls
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
  positionRankings: PositionSourceRanking[],
  usePerGameMetrics: boolean
): PositionSourceRanking[] {
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
  roundRankings: RoundSourceRanking[],
  usePerGameMetrics: boolean
): RoundSourceRanking[] {
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
