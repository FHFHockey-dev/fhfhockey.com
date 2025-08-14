// components/Projections/ProjectionSourceAnalysis.tsx

import React, { useState } from "react";
import { useProjectionSourceAnalysis } from "hooks/useProjectionSourceAnalysis";
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
    "overall" | "positions" | "detailed"
  >("overall");
  const analysis = useProjectionSourceAnalysis(
    players,
    fantasyPointSettings,
    sourceControls
  );

  if (analysis.overallRankings.length === 0) {
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
            className={`${styles.viewButton} ${selectedView === "detailed" ? styles.active : ""}`}
            onClick={() => setSelectedView("detailed")}
          >
            Detailed Metrics
          </button>
        </div>
      </div>

      {selectedView === "overall" && (
        <OverallRankingsView rankings={analysis.overallRankings} />
      )}

      {selectedView === "positions" && (
        <PositionRankingsView positionRankings={analysis.positionRankings} />
      )}

      {selectedView === "detailed" && (
        <DetailedMetricsView sourceMetrics={analysis.sourceMetrics} />
      )}
    </div>
  );
};

const OverallRankingsView: React.FC<{ rankings: any[] }> = ({ rankings }) => {
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
        {rankings.map((source, index) => (
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
                {source.qualityScore.toFixed(1)}
              </span>
            </div>
            <div className={styles.metricColumn}>
              {source.averageAccuracyPercentage.toFixed(1)}%
            </div>
            <div className={styles.metricColumn}>
              {source.averageMarginOfError.toFixed(1)} pts
            </div>
            <div className={styles.metricColumn}>
              {(
                (source.withinTwentyPercent /
                  source.playersWithBothProjectedAndActual) *
                100
              ).toFixed(1)}
              %
            </div>
            <div className={styles.metricColumn}>
              {source.playersWithBothProjectedAndActual} players
            </div>
            <div className={styles.metricColumn}>
              <span className={getBiasClassName(source.overProjectionBias)}>
                {source.overProjectionBias > 0 ? "+" : ""}
                {source.overProjectionBias.toFixed(1)}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.summaryCards}>
        <div className={styles.summaryCard}>
          <h3>Best Overall</h3>
          <p className={styles.bestSource}>{rankings[0]?.sourceName}</p>
          <p className={styles.bestScore}>
            Quality Score: {rankings[0]?.qualityScore.toFixed(1)}
          </p>
        </div>
        <div className={styles.summaryCard}>
          <h3>Most Accurate</h3>
          <p className={styles.bestSource}>
            {
              [...rankings].sort(
                (a, b) =>
                  b.averageAccuracyPercentage - a.averageAccuracyPercentage
              )[0]?.sourceName
            }
          </p>
          <p className={styles.bestScore}>
            {[...rankings]
              .sort(
                (a, b) =>
                  b.averageAccuracyPercentage - a.averageAccuracyPercentage
              )[0]
              ?.averageAccuracyPercentage.toFixed(1)}
            % Accuracy
          </p>
        </div>
        <div className={styles.summaryCard}>
          <h3>Lowest Error</h3>
          <p className={styles.bestSource}>
            {
              [...rankings].sort(
                (a, b) => a.averageMarginOfError - b.averageMarginOfError
              )[0]?.sourceName
            }
          </p>
          <p className={styles.bestScore}>
            {[...rankings]
              .sort(
                (a, b) => a.averageMarginOfError - b.averageMarginOfError
              )[0]
              ?.averageMarginOfError.toFixed(1)}{" "}
            pts error
          </p>
        </div>
      </div>
    </div>
  );
};

const PositionRankingsView: React.FC<{ positionRankings: any[] }> = ({
  positionRankings
}) => {
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
            {positionData.rankings.map((ranking: any) => (
              <div
                key={ranking.sourceId}
                className={`${styles.positionRow} ${getPositionRankClassName(ranking.rank)}`}
              >
                <div className={styles.posRankCol}>
                  <span className={styles.posRankBadge}>#{ranking.rank}</span>
                </div>
                <div className={styles.posSourceCol}>{ranking.sourceName}</div>
                <div className={styles.posMetricCol}>
                  {ranking.averageAccuracy.toFixed(1)}%
                </div>
                <div className={styles.posMetricCol}>
                  {ranking.averageMarginOfError.toFixed(1)} pts
                </div>
                <div className={styles.posMetricCol}>{ranking.playerCount}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

const DetailedMetricsView: React.FC<{ sourceMetrics: any[] }> = ({
  sourceMetrics
}) => {
  return (
    <div className={styles.detailedView}>
      {sourceMetrics.map((source) => (
        <div key={source.sourceId} className={styles.sourceDetailCard}>
          <div className={styles.sourceDetailHeader}>
            <h3>{source.sourceName}</h3>
            <div className={styles.qualityBadge}>
              Quality Score: {source.qualityScore.toFixed(1)}
            </div>
          </div>

          <div className={styles.metricsGrid}>
            <div className={styles.metricGroup}>
              <h4>Accuracy Metrics</h4>
              <div className={styles.metricItem}>
                <span className={styles.metricLabel}>Average Accuracy:</span>
                <span className={styles.metricValue}>
                  {source.averageAccuracyPercentage.toFixed(1)}%
                </span>
              </div>
              <div className={styles.metricItem}>
                <span className={styles.metricLabel}>Average Error:</span>
                <span className={styles.metricValue}>
                  {source.averageMarginOfError.toFixed(1)} pts
                </span>
              </div>
              <div className={styles.metricItem}>
                <span className={styles.metricLabel}>Median Error:</span>
                <span className={styles.metricValue}>
                  {source.medianMarginOfError.toFixed(1)} pts
                </span>
              </div>
            </div>

            <div className={styles.metricGroup}>
              <h4>Consistency</h4>
              <div className={styles.metricItem}>
                <span className={styles.metricLabel}>Within 10%:</span>
                <span className={styles.metricValue}>
                  {source.withinTenPercent} players
                </span>
              </div>
              <div className={styles.metricItem}>
                <span className={styles.metricLabel}>Within 20%:</span>
                <span className={styles.metricValue}>
                  {source.withinTwentyPercent} players
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
                  className={`${styles.metricValue} ${getBiasClassName(source.overProjectionBias)}`}
                >
                  {source.overProjectionBias > 0
                    ? "Over-projects"
                    : source.overProjectionBias < 0
                      ? "Under-projects"
                      : "Neutral"}
                </span>
              </div>
              <div className={styles.metricItem}>
                <span className={styles.metricLabel}>Bias Amount:</span>
                <span className={styles.metricValue}>
                  {source.overProjectionBias > 0 ? "+" : ""}
                  {source.overProjectionBias.toFixed(1)} pts
                </span>
              </div>
            </div>
          </div>

          <div className={styles.positionBreakdown}>
            <h4>Position Breakdown</h4>
            <div className={styles.positionGrid}>
              {Object.entries(source.positionMetrics).map(
                ([position, metrics]: [string, any]) => (
                  <div key={position} className={styles.positionMetric}>
                    <span className={styles.positionName}>{position}</span>
                    <span className={styles.positionAccuracy}>
                      {metrics.averageAccuracy.toFixed(1)}%
                    </span>
                    <span className={styles.positionCount}>
                      ({metrics.playerCount})
                    </span>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      ))}
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

function getBiasClassName(bias: number): string {
  if (bias > 5) return styles.overBias;
  if (bias < -5) return styles.underBias;
  return styles.neutralBias;
}

export default ProjectionSourceAnalysis;
