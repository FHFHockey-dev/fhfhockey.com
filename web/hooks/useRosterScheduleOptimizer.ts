import { useEffect, useMemo, useState } from "react";

import type { ProcessedPlayer } from "hooks/useProcessedProjectionsData";
import type { PlayerVorpMetrics } from "hooks/useVORPCalculations";
import { DEFAULT_YAHOO_GAME_KEY } from "lib/rosterScheduleData/constants";
import {
  calculateCandidateDust,
  classifyDustRisk,
  createOptimizerCacheSignature,
  evaluateRosterSchedule,
  prepareTeamSchedule,
  rankAlternativeRecommendations,
  type AlternativeRecommendation,
  type CandidateDustEvaluation,
  type DustRiskLabel,
  type OptimizerPlayer,
  type RosterEvaluation,
  type TeamScheduleGame,
} from "lib/rosterScheduleOptimizer";

const DEFAULT_START_WEEK = 1;
const DEFAULT_END_WEEK = 30;
const STALE_AFTER_MS = 36 * 60 * 60 * 1000;

type RosterAssignmentLike = {
  playerId: string;
  teamId: string;
};

type ScheduleRow = {
  source_game_id: number | string;
  game_date: string;
  game_status: string;
  team_abbreviation: string;
  week: number;
};

type ScheduleSuccess = {
  success: true;
  data: {
    gameKey: string;
    startWeek: number;
    endWeek: number;
    version: string;
    freshness: {
      latestFetchedAt: string | null;
      oldestFetchedAt: string | null;
      rowCount: number;
    };
    games: ScheduleRow[];
  };
};

type ScheduleFailure = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export type DraftDashboardDustInsight = {
  marginalDustGames: number;
  candidateScheduledGames: number;
  activeGamesAdded: number;
  dustRate: number;
  risk: DustRiskLabel;
  alternative?: {
    playerId: string;
    playerName: string;
    dustReduction: number;
    valueDifference: number;
  };
};

export type RosterScheduleOptimizerState = {
  status: "loading" | "ready" | "empty" | "error";
  error: string | null;
  stale: boolean;
  freshness: string | null;
  baseline: RosterEvaluation | null;
  insights: ReadonlyMap<string, DraftDashboardDustInsight>;
  skippedCandidates: number;
  signature: string | null;
};

type UseRosterScheduleOptimizerInput = {
  players: readonly ProcessedPlayer[];
  rosterAssignments: readonly RosterAssignmentLike[];
  myTeamId: string;
  rosterConfig: Readonly<Record<string, number>>;
  vorpMetrics?: ReadonlyMap<string, PlayerVorpMetrics>;
  gameKey?: string;
  startWeek?: number;
  endWeek?: number;
};

function playerValue(
  player: ProcessedPlayer,
  vorpMetrics?: ReadonlyMap<string, PlayerVorpMetrics>,
): number {
  const value =
    vorpMetrics?.get(String(player.playerId))?.value ??
    player.fantasyPoints.projected ??
    0;
  return Number.isFinite(value) ? value : 0;
}

function toOptimizerPlayer(
  player: ProcessedPlayer,
  vorpMetrics?: ReadonlyMap<string, PlayerVorpMetrics>,
): OptimizerPlayer {
  return {
    id: String(player.playerId),
    name: player.fullName,
    teamAbbreviation: player.displayTeam,
    eligiblePositions:
      player.eligiblePositions?.length
        ? player.eligiblePositions
        : player.displayPosition,
    value: playerValue(player, vorpMetrics),
    available: true,
  };
}

function apiRowsToSchedule(rows: readonly ScheduleRow[]): TeamScheduleGame[] {
  return rows.map((row) => ({
    gameId: String(row.source_game_id),
    date: row.game_date,
    teamAbbreviation: row.team_abbreviation,
    yahooWeek: row.week,
    status: "scheduled",
  }));
}

function isStale(freshness: string | null): boolean {
  if (!freshness) return true;
  const timestamp = Date.parse(freshness);
  return !Number.isFinite(timestamp) || Date.now() - timestamp > STALE_AFTER_MS;
}

function bestAlternative(
  candidate: CandidateDustEvaluation,
  alternatives: readonly CandidateDustEvaluation[],
  rosterConfig: Readonly<Record<string, number>>,
): AlternativeRecommendation | undefined {
  return rankAlternativeRecommendations(
    candidate,
    alternatives,
    rosterConfig,
  )[0];
}

export function useRosterScheduleOptimizer({
  players,
  rosterAssignments,
  myTeamId,
  rosterConfig,
  vorpMetrics,
  gameKey = DEFAULT_YAHOO_GAME_KEY,
  startWeek = DEFAULT_START_WEEK,
  endWeek = DEFAULT_END_WEEK,
}: UseRosterScheduleOptimizerInput): RosterScheduleOptimizerState {
  const [schedule, setSchedule] = useState<ScheduleSuccess["data"] | null>(null);
  const [status, setStatus] = useState<RosterScheduleOptimizerState["status"]>(
    "loading",
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      gameKey,
      startWeek: String(startWeek),
      endWeek: String(endWeek),
    });
    setStatus("loading");
    setError(null);

    void fetch(`/api/v1/roster-schedule-optimizer/schedule?${params}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = (await response.json()) as ScheduleSuccess | ScheduleFailure;
        if (!response.ok || !body.success) {
          const message = body.success
            ? "Schedule data could not be loaded."
            : body.error.message;
          throw new Error(message);
        }
        setSchedule(body.data);
        setStatus(body.data.games.length ? "ready" : "empty");
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setSchedule(null);
        setStatus("error");
        setError(
          reason instanceof Error
            ? reason.message
            : "Schedule data could not be loaded.",
        );
      });

    return () => controller.abort();
  }, [endWeek, gameKey, startWeek]);

  const playerById = useMemo(
    () => new Map(players.map((player) => [String(player.playerId), player])),
    [players],
  );
  const optimizerPlayers = useMemo(
    () => players.map((player) => toOptimizerPlayer(player, vorpMetrics)),
    [players, vorpMetrics],
  );
  const optimizerById = useMemo(
    () => new Map(optimizerPlayers.map((player) => [player.id, player])),
    [optimizerPlayers],
  );
  const roster = useMemo(
    () =>
      rosterAssignments.flatMap((assignment) => {
        if (assignment.teamId !== myTeamId) return [];
        const player = optimizerById.get(assignment.playerId);
        return player ? [{ ...player, available: false }] : [];
      }),
    [myTeamId, optimizerById, rosterAssignments],
  );
  const selectedWeeks = useMemo(
    () =>
      Array.from(
        { length: Math.max(0, endWeek - startWeek + 1) },
        (_, index) => startWeek + index,
      ),
    [endWeek, startWeek],
  );
  const preparedSchedule = useMemo(
    () =>
      prepareTeamSchedule(apiRowsToSchedule(schedule?.games ?? []), {
        gameKey,
        selectedWeeks,
      }),
    [gameKey, schedule?.games, selectedWeeks],
  );
  const evaluationInput = useMemo(
    () => ({
      roster,
      rosterSlots: rosterConfig,
      schedule: preparedSchedule,
      lineupMode: "daily" as const,
    }),
    [preparedSchedule, roster, rosterConfig],
  );
  const baseline = useMemo(
    () =>
      status === "ready" || status === "empty"
        ? evaluateRosterSchedule(evaluationInput)
        : null,
    [evaluationInput, status],
  );
  const signature = useMemo(
    () =>
      schedule
        ? createOptimizerCacheSignature({
            roster,
            rosterSlots: rosterConfig,
            gameKey,
            selectedWeeks,
            scheduleVersion: `${schedule.version}:${schedule.freshness.latestFetchedAt ?? "unknown"}`,
            lineupMode: "daily",
          })
        : null,
    [gameKey, roster, rosterConfig, schedule, selectedWeeks],
  );
  const candidateDust = useMemo(() => {
    if (!baseline || status !== "ready") return [];
    const unavailableIds = new Set(
      rosterAssignments.map((assignment) => assignment.playerId),
    );
    return optimizerPlayers
      .filter((player) => !unavailableIds.has(player.id))
      .map((player) => calculateCandidateDust(evaluationInput, player, baseline));
  }, [baseline, evaluationInput, optimizerPlayers, rosterAssignments, status]);
  const validCandidateDust = useMemo(
    () =>
      candidateDust.filter(
        (candidate) =>
          !candidate.diagnostics.some(
            (diagnostic) => diagnostic.severity === "error",
          ),
      ),
    [candidateDust],
  );
  const insights = useMemo(() => {
    const next = new Map<string, DraftDashboardDustInsight>();
    for (const dust of validCandidateDust) {
      const risk = classifyDustRisk(
        dust.marginalDustGames,
        dust.candidateScheduledGames,
      );
      const alternative =
        risk.label === "elevated" || risk.label === "high"
          ? bestAlternative(dust, validCandidateDust, rosterConfig)
          : undefined;
      next.set(dust.player.id, {
        marginalDustGames: dust.marginalDustGames,
        candidateScheduledGames: dust.candidateScheduledGames,
        activeGamesAdded: dust.activeGamesAdded,
        dustRate: dust.dustRate,
        risk: risk.label,
        alternative: alternative
          ? {
              playerId: alternative.player.id,
              playerName:
                playerById.get(alternative.player.id)?.fullName ??
                alternative.player.name ??
                alternative.player.id,
              dustReduction: alternative.dustImprovement,
              valueDifference: alternative.valueDifference,
            }
          : undefined,
      });
    }
    return next;
  }, [playerById, rosterConfig, validCandidateDust]);

  return {
    status,
    error,
    stale: isStale(schedule?.freshness.latestFetchedAt ?? null),
    freshness: schedule?.freshness.latestFetchedAt ?? null,
    baseline,
    insights,
    skippedCandidates: candidateDust.length - validCandidateDust.length,
    signature,
  };
}
