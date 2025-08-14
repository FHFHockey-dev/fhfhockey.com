// hooks/useProjectionSourceAnalysis.ts

import { useMemo } from "react";
import { ProcessedPlayer } from "./useProcessedProjectionsData";
import { PROJECTION_SOURCES_CONFIG } from "lib/projectionsConfig/projectionSourcesConfig";

export interface SourceAccuracyMetrics {
  sourceId: string;
  sourceName: string;

  // Overall metrics
  totalPlayers: number;
  playersWithBothProjectedAndActual: number;

  // Accuracy metrics
  averageAccuracyPercentage: number; // How close projections were to actual (100% = perfect)
  averageMarginOfError: number; // Average absolute difference in fantasy points
  medianMarginOfError: number;

  // Error distribution
  withinTenPercent: number; // Players within 10% of actual
  withinTwentyPercent: number; // Players within 20% of actual

  // Position-specific performance
  positionMetrics: Record<
    string,
    {
      playerCount: number;
      averageAccuracy: number;
      averageMarginOfError: number;
    }
  >;

  // Bias analysis
  overProjectionBias: number; // Tendency to over-project (positive) or under-project (negative)

  // Quality score (weighted combination of metrics)
  qualityScore: number;
}

export interface PositionSourceRanking {
  position: string;
  rankings: Array<{
    sourceId: string;
    sourceName: string;
    averageAccuracy: number;
    averageMarginOfError: number;
    playerCount: number;
    rank: number;
  }>;
}

export interface RoundSourceRanking {
  round: number;
  roundLabel: string;
  rankings: Array<{
    sourceId: string;
    sourceName: string;
    averageAccuracy: number;
    averageMarginOfError: number;
    playerCount: number;
    rank: number;
  }>;
}

export function useProjectionSourceAnalysis(
  players: ProcessedPlayer[],
  fantasyPointSettings: Record<string, number>,
  sourceControls: Record<string, { isSelected: boolean; weight: number }>
) {
  const analysis = useMemo(() => {
    // Get active sources
    const activeSources = PROJECTION_SOURCES_CONFIG.filter(
      (src) => sourceControls[src.id]?.isSelected
    );

    if (activeSources.length === 0 || players.length === 0) {
      return {
        sourceMetrics: [],
        positionRankings: [],
        overallRankings: []
      };
    }

    // Calculate metrics for each source
    const sourceMetrics: SourceAccuracyMetrics[] = activeSources.map(
      (source) => {
        const metrics = calculateSourceMetrics(
          source.id,
          source.displayName,
          players,
          fantasyPointSettings
        );
        return metrics;
      }
    );

    // Calculate position-specific rankings
    const positionRankings = calculatePositionRankings(sourceMetrics);

    // Calculate round-specific rankings
    const roundRankings = calculateRoundRankings(sourceMetrics, players, fantasyPointSettings);

    // Overall rankings sorted by quality score
    const overallRankings = [...sourceMetrics].sort(
      (a, b) => b.qualityScore - a.qualityScore
    );

    return {
      sourceMetrics,
      positionRankings,
      roundRankings,
      overallRankings
    };
  }, [players, fantasyPointSettings, sourceControls]);

  return analysis;
}

function calculateSourceMetrics(
  sourceId: string,
  sourceName: string,
  players: ProcessedPlayer[],
  fantasyPointSettings: Record<string, number>
): SourceAccuracyMetrics {
  // Filter players that have projections from this source and actual fantasy points
  const relevantPlayers = players.filter((player) => {
    const hasActualFP =
      player.fantasyPoints.actual !== null &&
      player.fantasyPoints.actual !== undefined;
    const hasProjectionFromSource = hasProjectionFromThisSource(
      player,
      sourceId,
      fantasyPointSettings
    );
    return hasActualFP && hasProjectionFromSource;
  });

  if (relevantPlayers.length === 0) {
    return createEmptyMetrics(sourceId, sourceName);
  }

  // Calculate individual projected fantasy points for this source
  const playerAccuracyData = relevantPlayers.map((player) => {
    const projectedFP = calculateSourceSpecificFantasyPoints(
      player,
      sourceId,
      fantasyPointSettings
    );
    const actualFP = player.fantasyPoints.actual!;

    const marginOfError = Math.abs(projectedFP - actualFP);
    const accuracyPercentage =
      actualFP === 0
        ? projectedFP === 0
          ? 100
          : 0
        : Math.max(0, 100 - (marginOfError / Math.abs(actualFP)) * 100);

    const withinTenPercent = accuracyPercentage >= 90;
    const withinTwentyPercent = accuracyPercentage >= 80;

    const bias = projectedFP - actualFP; // Positive = over-projection, negative = under-projection

    return {
      player,
      projectedFP,
      actualFP,
      marginOfError,
      accuracyPercentage,
      withinTenPercent,
      withinTwentyPercent,
      bias,
      position: player.displayPosition?.split(",")[0].trim() || "Unknown"
    };
  });

  // Calculate overall metrics
  const averageAccuracyPercentage =
    playerAccuracyData.reduce((sum, p) => sum + p.accuracyPercentage, 0) /
    playerAccuracyData.length;
  const averageMarginOfError =
    playerAccuracyData.reduce((sum, p) => sum + p.marginOfError, 0) /
    playerAccuracyData.length;
  const medianMarginOfError = calculateMedian(
    playerAccuracyData.map((p) => p.marginOfError)
  );

  const withinTenPercent = playerAccuracyData.filter(
    (p) => p.withinTenPercent
  ).length;
  const withinTwentyPercent = playerAccuracyData.filter(
    (p) => p.withinTwentyPercent
  ).length;

  const overProjectionBias =
    playerAccuracyData.reduce((sum, p) => sum + p.bias, 0) /
    playerAccuracyData.length;

  // Calculate position-specific metrics
  const positionGroups = playerAccuracyData.reduce(
    (groups, data) => {
      if (!groups[data.position]) {
        groups[data.position] = [];
      }
      groups[data.position].push(data);
      return groups;
    },
    {} as Record<string, typeof playerAccuracyData>
  );

  const positionMetrics: Record<string, any> = {};
  Object.entries(positionGroups).forEach(([position, posData]) => {
    positionMetrics[position] = {
      playerCount: posData.length,
      averageAccuracy:
        posData.reduce((sum, p) => sum + p.accuracyPercentage, 0) /
        posData.length,
      averageMarginOfError:
        posData.reduce((sum, p) => sum + p.marginOfError, 0) / posData.length
    };
  });

  // Calculate quality score (weighted combination of metrics)
  const qualityScore = calculateQualityScore({
    averageAccuracyPercentage,
    averageMarginOfError,
    withinTwentyPercent:
      (withinTwentyPercent / playerAccuracyData.length) * 100,
    playerCount: playerAccuracyData.length
  });

  return {
    sourceId,
    sourceName,
    totalPlayers: players.length,
    playersWithBothProjectedAndActual: relevantPlayers.length,
    averageAccuracyPercentage,
    averageMarginOfError,
    medianMarginOfError,
    withinTenPercent,
    withinTwentyPercent,
    positionMetrics,
    overProjectionBias,
    qualityScore
  };
}

function hasProjectionFromThisSource(
  player: ProcessedPlayer,
  sourceId: string,
  fantasyPointSettings: Record<string, number>
): boolean {
  // Check if player has any stat projections from this source that contribute to fantasy points
  for (const [statKey, points] of Object.entries(fantasyPointSettings)) {
    if (points !== 0) {
      const statData = player.combinedStats[statKey];
      if (
        statData?.projectedDetail?.contributingSources?.some(
          (cs) =>
            cs.name ===
            PROJECTION_SOURCES_CONFIG.find((src) => src.id === sourceId)
              ?.displayName
        )
      ) {
        return true;
      }
    }
  }
  return false;
}

function calculateSourceSpecificFantasyPoints(
  player: ProcessedPlayer,
  sourceId: string,
  fantasyPointSettings: Record<string, number>
): number {
  const sourceConfig = PROJECTION_SOURCES_CONFIG.find(
    (src) => src.id === sourceId
  );
  if (!sourceConfig) return 0;

  let totalFP = 0;

  // Calculate fantasy points using only this source's projections
  for (const [statKey, points] of Object.entries(fantasyPointSettings)) {
    if (points !== 0) {
      const statData = player.combinedStats[statKey];

      // Find this source's contribution to the stat
      const sourceContribution =
        statData?.projectedDetail?.contributingSources?.find(
          (cs) => cs.name === sourceConfig.displayName
        );

      if (
        sourceContribution?.value !== null &&
        sourceContribution?.value !== undefined
      ) {
        totalFP += sourceContribution.value * points;
      }
    }
  }

  return totalFP;
}

function calculateMedian(numbers: number[]): number {
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function calculateQualityScore(metrics: {
  averageAccuracyPercentage: number;
  averageMarginOfError: number;
  withinTwentyPercent: number;
  playerCount: number;
}): number {
  // Weighted score out of 100
  const accuracyWeight = 0.4;
  const marginOfErrorWeight = 0.3;
  const consistencyWeight = 0.2;
  const sampleSizeWeight = 0.1;

  const accuracyScore = metrics.averageAccuracyPercentage;

  // Margin of error score (lower is better, normalize to 0-100 scale)
  const marginOfErrorScore = Math.max(
    0,
    100 - metrics.averageMarginOfError * 2
  );

  const consistencyScore = metrics.withinTwentyPercent;

  // Sample size score (more players = higher confidence, cap at 100 players for full score)
  const sampleSizeScore = Math.min(100, (metrics.playerCount / 100) * 100);

  return (
    accuracyScore * accuracyWeight +
    marginOfErrorScore * marginOfErrorWeight +
    consistencyScore * consistencyWeight +
    sampleSizeScore * sampleSizeWeight
  );
}

function calculatePositionRankings(
  sourceMetrics: SourceAccuracyMetrics[]
): PositionSourceRanking[] {
  // Get all unique positions
  const allPositions = new Set<string>();
  sourceMetrics.forEach((source) => {
    Object.keys(source.positionMetrics).forEach((pos) => allPositions.add(pos));
  });

  const positionRankings: PositionSourceRanking[] = Array.from(
    allPositions
  ).map((position) => {
    const rankings = sourceMetrics
      .filter((source) => source.positionMetrics[position]?.playerCount > 0)
      .map((source) => ({
        sourceId: source.sourceId,
        sourceName: source.sourceName,
        averageAccuracy: source.positionMetrics[position].averageAccuracy,
        averageMarginOfError:
          source.positionMetrics[position].averageMarginOfError,
        playerCount: source.positionMetrics[position].playerCount,
        rank: 0 // Will be set below
      }))
      .sort((a, b) => b.averageAccuracy - a.averageAccuracy) // Sort by accuracy desc
      .map((item, index) => ({ ...item, rank: index + 1 }));

    return {
      position,
      rankings
    };
  });

  return positionRankings.sort((a, b) => a.position.localeCompare(b.position));
}

function calculateRoundRankings(
  sourceMetrics: SourceAccuracyMetrics[],
  players: ProcessedPlayer[],
  fantasyPointSettings: Record<string, number>
): RoundSourceRanking[] {
  // Group players by draft round (using the same 12-pick bin logic as your table)
  const roundGroups: Record<number, ProcessedPlayer[]> = {};
  
  players.forEach((player) => {
    if (player.yahooAvgPick && player.yahooAvgPick > 0) {
      const round = Math.ceil(player.yahooAvgPick / 12);
      if (round <= 15) { // Limit to first 15 rounds like your chart
        if (!roundGroups[round]) {
          roundGroups[round] = [];
        }
        roundGroups[round].push(player);
      }
    }
  });

  const rounds = Object.keys(roundGroups).map(Number).sort((a, b) => a - b);
  
  const roundRankings: RoundSourceRanking[] = rounds.map((round) => {
    const roundPlayers = roundGroups[round];
    
    const rankings = sourceMetrics
      .map((source) => {
        // Calculate this source's accuracy for players in this round
        const roundPlayerAccuracies: number[] = [];
        const roundPlayerErrors: number[] = [];
        
        roundPlayers.forEach((player) => {
          // Check if player has both actual fantasy points and this source's projections
          if (player.fantasyPoints.actual !== null && 
              hasProjectionFromThisSource(player, source.sourceId, fantasyPointSettings)) {
            
            // Calculate source-specific fantasy points
            const sourceProjectedFP = calculateSourceSpecificFantasyPoints(
              player,
              source.sourceId,
              fantasyPointSettings
            );
            
            if (sourceProjectedFP > 0) {
              const actualFP = player.fantasyPoints.actual;
              const marginOfError = Math.abs(sourceProjectedFP - actualFP);
              const accuracyPercentage = Math.max(0, 100 - (marginOfError / Math.abs(actualFP)) * 100);
              
              roundPlayerAccuracies.push(accuracyPercentage);
              roundPlayerErrors.push(marginOfError);
            }
          }
        });
        
        if (roundPlayerAccuracies.length === 0) {
          return null; // No data for this source in this round
        }
        
        const averageAccuracy = roundPlayerAccuracies.reduce((sum, acc) => sum + acc, 0) / roundPlayerAccuracies.length;
        const averageMarginOfError = roundPlayerErrors.reduce((sum, err) => sum + err, 0) / roundPlayerErrors.length;
        
        return {
          sourceId: source.sourceId,
          sourceName: source.sourceName,
          averageAccuracy,
          averageMarginOfError,
          playerCount: roundPlayerAccuracies.length,
          rank: 0 // Will be set below
        };
      })
      .filter((ranking): ranking is NonNullable<typeof ranking> => ranking !== null)
      .sort((a, b) => b.averageAccuracy - a.averageAccuracy) // Sort by accuracy desc
      .map((item, index) => ({ ...item, rank: index + 1 }));

    return {
      round,
      roundLabel: `Round ${round}`,
      rankings
    };
  });

  return roundRankings;
}

function createEmptyMetrics(
  sourceId: string,
  sourceName: string
): SourceAccuracyMetrics {
  return {
    sourceId,
    sourceName,
    totalPlayers: 0,
    playersWithBothProjectedAndActual: 0,
    averageAccuracyPercentage: 0,
    averageMarginOfError: 0,
    medianMarginOfError: 0,
    withinTenPercent: 0,
    withinTwentyPercent: 0,
    positionMetrics: {},
    overProjectionBias: 0,
    qualityScore: 0
  };
}
