import supabase from "lib/supabase/server";
import type { RosterEventRow } from "./types/run-forge-projections.types";

type TimedEvidence = {
  id: string; game_id: number; team_id: number; observed_at: string; available_at: string;
  created_at?: string; expires_at?: string | null; accepted: boolean;
  source_key: string; source_account?: string | null; source_url?: string | null;
};
export type BoardLineupEvidence = TimedEvidence & {
  parser_version: string;
  player_forecast_lineup_assignments: Array<{
    player_id: number | null; unit_type: string; unit_number: number | null;
    assignment_status: string; created_at?: string;
  }>;
};
export type BoardGoalieEvidence = TimedEvidence & { player_id: number | null; observation_status: string };
export type BoardConflict = {
  conflict_key?: string; conflict_version?: number;
  id: string; game_id: number; team_id: number; player_id: number | null;
  conflict_type: string; detected_at: string;
  player_forecast_conflict_resolutions: Array<{
    action: string; selected_observation_id: string | null; resolved_at: string; created_at?: string;
  }>;
};
export type BoardAssertion = {
  gameId: number; teamId: number; playerId: number;
  dimension: "ev" | "pp" | "availability" | "goalie";
  value: string; evidenceId: string; sourceKey: string; sourceUrl: string | null;
  publishedAt: string; receivedAt: string; confirmed: boolean;
};
export type DailyBoardEvidence = {
  assertions: BoardAssertion[];
  conflicts: Array<{ gameId: number; teamId: number; playerId: number | null; dimension: string; evidenceIds: string[] }>;
};

function available(evidence: TimedEvidence, cutoff: number): boolean {
  return evidence.accepted && [evidence.observed_at, evidence.available_at, evidence.created_at ?? evidence.available_at]
    .every((value) => Number.isFinite(Date.parse(value)) && Date.parse(value) <= cutoff)
    && (!evidence.expires_at || Date.parse(evidence.expires_at) > cutoff);
}

/** Partial assertions never imply the absence of an unmentioned player. */
export function resolveDailyBoardEvidence(args: {
  cutoff: string; lineups: BoardLineupEvidence[]; goalies: BoardGoalieEvidence[]; conflicts: BoardConflict[];
}): DailyBoardEvidence {
  const cutoff = Date.parse(args.cutoff);
  if (!Number.isFinite(cutoff)) throw new Error("Invalid daily evidence cutoff");
  const candidates: BoardAssertion[] = [];
  const add = (row: TimedEvidence, playerId: number, dimension: BoardAssertion["dimension"], value: string, confirmed: boolean) => {
    candidates.push({ gameId: row.game_id, teamId: row.team_id, playerId, dimension, value,
      evidenceId: row.id, sourceKey: row.source_account ?? row.source_key, sourceUrl: row.source_url ?? null,
      publishedAt: row.observed_at, receivedAt: row.available_at, confirmed });
  };
  for (const row of args.lineups.filter((item) => available(item, cutoff))) {
    for (const assignment of row.player_forecast_lineup_assignments) {
      if (assignment.player_id == null || (assignment.created_at && Date.parse(assignment.created_at) > cutoff)) continue;
      const { player_id: playerId, unit_type: unit, unit_number: rank, assignment_status: status } = assignment;
      if ((unit === "forward_line" || unit === "defense_pair") && rank != null) {
        add(row, playerId, "ev", `${unit === "forward_line" ? "L" : "D"}${rank}`, status === "confirmed");
      } else if (unit === "power_play" && (rank === 1 || rank === 2)) {
        add(row, playerId, "pp", `PP${rank}`, status === "confirmed");
      } else if (unit === "scratch") {
        add(row, playerId, "availability", "out", status === "ruled_out");
      } else if (unit === "injury") {
        // v1 classified all injury mentions as out. Never reuse that as an
        // explicit exclusion or train a participation label from it.
        const value = row.parser_version === "line-source-v2" && status === "ruled_out" ? "out"
          : row.parser_version === "line-source-v2" && status === "confirmed" ? "return" : "uncertain";
        add(row, playerId, "availability", value, value !== "uncertain");
      }
    }
  }
  for (const row of args.goalies.filter((item) => available(item, cutoff))) {
    if (row.player_id != null) add(row, row.player_id, "goalie", row.observation_status, row.observation_status === "confirmed");
  }

  const result: DailyBoardEvidence = { assertions: [], conflicts: [] };
  const latestConflicts = new Map<string, BoardConflict>();
  for (const conflict of args.conflicts.filter((item) => Date.parse(item.detected_at) <= cutoff)
    .sort((a, b) => (b.conflict_version ?? 1) - (a.conflict_version ?? 1))) {
    const key = conflict.conflict_key ?? conflict.id;
    if (!latestConflicts.has(key)) latestConflicts.set(key, conflict);
  }
  const reviews = [...latestConflicts.values()].map((conflict) => ({
    ...conflict,
    resolution: [...conflict.player_forecast_conflict_resolutions]
      .filter((resolution) => [resolution.resolved_at, resolution.created_at ?? resolution.resolved_at]
        .every((value) => Number.isFinite(Date.parse(value)) && Date.parse(value) <= cutoff))
      .sort((a, b) => Date.parse(b.resolved_at) - Date.parse(a.resolved_at))[0],
  }));
  const groups = new Map<string, BoardAssertion[]>();
  for (const assertion of candidates) {
    const key = `${assertion.gameId}:${assertion.teamId}:${assertion.dimension}:${assertion.dimension === "goalie" ? "team" : assertion.playerId}`;
    groups.set(key, [...groups.get(key) ?? [], assertion]);
  }
  for (const group of groups.values()) {
    const sample = group[0];
    const matchingReviews = reviews.filter((review) => review.game_id === sample.gameId && review.team_id === sample.teamId
      && (review.conflict_type === "goalie_start" ? sample.dimension === "goalie"
        : review.conflict_type === "lineup" && (review.player_id == null || review.player_id === sample.playerId)));
    const blocked = matchingReviews.some((review) => !review.resolution || review.resolution.action === "accept_mixture");
    const selectedIds = matchingReviews.flatMap((review) => review.resolution?.action === "select_observation" && review.resolution.selected_observation_id ? [review.resolution.selected_observation_id] : []);
    // Latest assertion from each original reporter supersedes its earlier
    // assertions. Arrival order and repost count do not increase credibility.
    const bySource = new Map<string, BoardAssertion>();
    for (const item of [...group].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt) || b.evidenceId.localeCompare(a.evidenceId))) {
      if (!bySource.has(item.sourceKey)) bySource.set(item.sourceKey, item);
    }
    const choices = selectedIds.length ? group.filter((item) => selectedIds.includes(item.evidenceId)) : [...bySource.values()];
    choices.sort((a, b) => Number(b.confirmed) - Number(a.confirmed) || Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
    const best = choices[0];
    if (!best) continue;
    const dismissed = matchingReviews.some((review) => ["dismiss", "supersede"].includes(review.resolution?.action ?? ""));
    const materialConflict = !dismissed && choices.some((other) => other.confirmed === best.confirmed
      && Math.abs(Date.parse(other.publishedAt) - Date.parse(best.publishedAt)) <= 10 * 60_000
      && (other.value !== best.value || (sample.dimension === "goalie" && other.playerId !== best.playerId)));
    if (blocked || materialConflict) {
      result.conflicts.push({ gameId: sample.gameId, teamId: sample.teamId,
        playerId: sample.dimension === "goalie" ? null : sample.playerId,
        dimension: sample.dimension, evidenceIds: [...new Set(group.map((item) => item.evidenceId))] });
    } else {
      result.assertions.push(best);
    }
  }
  return result;
}

export async function loadDailyBoardEvidence(gameIds: number[], cutoff: string): Promise<DailyBoardEvidence> {
  if (!gameIds.length) return { assertions: [], conflicts: [] };
  const db = supabase as any;
  const [lineups, goalies, conflicts] = await Promise.all([
    db.from("player_forecast_lineup_snapshots").select("*,player_forecast_lineup_assignments(*)")
      .in("game_id", gameIds).eq("accepted", true).lte("available_at", cutoff).lte("created_at", cutoff).limit(2000),
    db.from("player_forecast_goalie_start_observations").select("*")
      .in("game_id", gameIds).eq("accepted", true).lte("available_at", cutoff).lte("created_at", cutoff).limit(2000),
    db.from("player_forecast_observation_conflicts").select("*,player_forecast_conflict_resolutions(*)")
      .in("game_id", gameIds).lte("detected_at", cutoff).lte("created_at", cutoff).limit(2000),
  ]);
  for (const response of [lineups, goalies, conflicts]) {
    if (response.error) throw response.error;
    if (response.data?.length >= 2000) throw new Error("Daily evidence limit reached; refusing a truncated overlay.");
  }
  return resolveDailyBoardEvidence({ cutoff, lineups: lineups.data ?? [], goalies: goalies.data ?? [], conflicts: conflicts.data ?? [] });
}

export function applyDailyBoardEvidence(args: {
  gameId: number; evidence: DailyBoardEvidence;
  playerAvailabilityMultiplier: Map<number, number>;
  availabilityEventByPlayer: Map<number, RosterEventRow>;
  roleEventByPlayer: Map<number, RosterEventRow>;
  ppEventByPlayer: Map<number, RosterEventRow>;
  goalieOverrideByTeamId: Map<number, { goalieId: number; starterProb: number }>;
}) {
  const result = {
    playerAvailabilityMultiplier: new Map(args.playerAvailabilityMultiplier),
    availabilityEventByPlayer: new Map(args.availabilityEventByPlayer),
    roleEventByPlayer: new Map(args.roleEventByPlayer), ppEventByPlayer: new Map(args.ppEventByPlayer),
    goalieOverrideByTeamId: new Map(args.goalieOverrideByTeamId),
  };
  for (const assertion of args.evidence.assertions.filter((item) => item.gameId === args.gameId)) {
    const event: RosterEventRow = {
      event_id: 0, team_id: assertion.teamId, player_id: assertion.playerId,
      event_type: assertion.dimension === "ev" ? "LINE_CHANGE" : assertion.dimension === "pp" ? "PP_UNIT_CHANGE"
        : assertion.value === "out" ? "INJURY_OUT" : "RETURN",
      confidence: 1, effective_from: assertion.publishedAt, effective_to: null,
      payload: { evidenceId: assertion.evidenceId, source: "daily_board_evidence", role: assertion.value,
        lineNumber: Number(assertion.value.slice(1)), ppUnit: Number(assertion.value.slice(2)) },
    };
    if (assertion.dimension === "ev") result.roleEventByPlayer.set(assertion.playerId, event);
    if (assertion.dimension === "pp") result.ppEventByPlayer.set(assertion.playerId, event);
    if (assertion.dimension === "availability" && assertion.confirmed && assertion.value !== "uncertain") {
      result.playerAvailabilityMultiplier.set(assertion.playerId, assertion.value === "out" ? 0 : 1);
      result.availabilityEventByPlayer.set(assertion.playerId, event);
    }
    if (assertion.dimension === "goalie" && assertion.confirmed) {
      result.goalieOverrideByTeamId.set(assertion.teamId, { goalieId: assertion.playerId, starterProb: 1 });
    }
  }
  for (const conflict of args.evidence.conflicts.filter((item) => item.gameId === args.gameId)) {
    if (conflict.dimension === "goalie") result.goalieOverrideByTeamId.delete(conflict.teamId);
    if (conflict.playerId != null) {
      if (conflict.dimension === "ev") result.roleEventByPlayer.delete(conflict.playerId);
      if (conflict.dimension === "pp") result.ppEventByPlayer.delete(conflict.playerId);
      if (conflict.dimension === "availability") {
        result.availabilityEventByPlayer.delete(conflict.playerId);
        result.playerAvailabilityMultiplier.delete(conflict.playerId);
      }
    }
  }
  return result;
}
