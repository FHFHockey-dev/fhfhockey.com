import { resolveLatestStartedSeasonIdForDate } from "lib/NHL/server";
import supabase from "lib/supabase/server";

import {
  fetchGameMarketContextByGameIds,
  fetchPlayerPropContextByGameIds,
  type MarketTypeSummary,
} from "../queries/market-queries";
import { fetchTeamAbbreviationMap } from "../queries/team-context-queries";
import type {
  GameRow,
  RosterEventRow,
} from "../types/run-forge-projections.types";
import { toDayBoundsUtc } from "../utils/date-utils";
import { clamp } from "../utils/number-utils";

export type ProjectionPreflightStageResult = {
  currentSeasonId: number;
  games: GameRow[];
  teamIds: number[];
  gameIds: number[];
  teamAbbreviationById: Map<number, string>;
  playerAvailabilityMultiplier: Map<number, number>;
  availabilityEventByPlayer: Map<number, RosterEventRow>;
  roleEventByPlayer: Map<number, RosterEventRow>;
  goalieOverrideByTeamId: Map<
    number,
    { goalieId: number; starterProb: number }
  >;
  gameMarketContextByGameId: Map<number, Record<string, MarketTypeSummary>>;
  playerPropContextByGamePlayerKey: Map<
    string,
    Record<string, MarketTypeSummary>
  >;
};

export function availabilityMultiplierForEvent(
  eventType: string,
  confidence: number,
): number | null {
  const c =
    typeof confidence === "number" && Number.isFinite(confidence)
      ? confidence
      : 0.5;
  switch (eventType) {
    case "INJURY_OUT":
    case "INJURY_IR":
    case "IR":
    case "LTIR":
    case "SUSPENSION":
    case "NON_ROSTER":
    case "SENDDOWN":
      return 0;
    case "DTD":
      return clamp(1 - 0.6 * c, 0.2, 1);
    case "BENCHING":
      return clamp(1 - 0.45 * c, 0.35, 1);
    case "SCRATCH":
      return clamp(1 - 0.8 * c, 0.05, 1);
    case "RETURN":
    case "CALLUP":
      return 1;
    default:
      return null;
  }
}

export async function runProjectionPreflightStage(args: {
  asOfDate: string;
  requestedGameIds: number[];
}): Promise<ProjectionPreflightStageResult> {
  const currentSeasonId = await resolveLatestStartedSeasonIdForDate(
    args.asOfDate,
    supabase,
  );
  const { data: gameRows, error: gamesErr } = await supabase
    .from("games")
    .select("id,date,homeTeamId,awayTeamId")
    .eq("date", args.asOfDate);
  if (gamesErr) throw gamesErr;

  const requestedGameIds = new Set(
    args.requestedGameIds.filter((gameId) => Number.isFinite(gameId)),
  );
  const games = ((gameRows ?? []) as GameRow[]).filter(
    (game) => requestedGameIds.size === 0 || requestedGameIds.has(game.id),
  );
  const gameIds = games
    .map((game) => game.id)
    .filter((id): id is number => Number.isFinite(id));
  const { startTs, endTs } = toDayBoundsUtc(args.asOfDate);
  const teamIds = Array.from(
    new Set(
      games
        .flatMap((game) => [game.homeTeamId, game.awayTeamId])
        .filter((teamId) => teamId != null),
    ),
  );
  const teamAbbreviationById = await fetchTeamAbbreviationMap(teamIds);
  const playerAvailabilityMultiplier = new Map<number, number>();
  const availabilityEventByPlayer = new Map<number, RosterEventRow>();
  const roleEventByPlayer = new Map<number, RosterEventRow>();
  const goalieOverrideByTeamId = new Map<
    number,
    { goalieId: number; starterProb: number }
  >();
  const gameMarketContextByGameId = await fetchGameMarketContextByGameIds({
    snapshotDate: args.asOfDate,
    gameIds,
  });
  const playerPropContextByGamePlayerKey =
    await fetchPlayerPropContextByGameIds({
      snapshotDate: args.asOfDate,
      gameIds,
    });

  if (teamIds.length > 0) {
    const { data: events, error: eventsErr } = await supabase
      .from("forge_roster_events")
      .select(
        "event_id,team_id,player_id,event_type,confidence,payload,effective_from,effective_to",
      )
      .in("team_id", teamIds)
      .lte("effective_from", endTs)
      .order("effective_from", { ascending: false })
      .limit(5000);
    if (eventsErr) throw eventsErr;

    const bestAvailabilityEventByPlayer = new Map<number, RosterEventRow>();
    const bestRoleEventByPlayer = new Map<number, RosterEventRow>();

    for (const event of (events ?? []) as RosterEventRow[]) {
      if (event.effective_to != null && event.effective_to < startTs) {
        continue;
      }
      if (event.player_id != null) {
        const multiplier = availabilityMultiplierForEvent(
          event.event_type,
          event.confidence,
        );
        if (multiplier != null) {
          const existing = bestAvailabilityEventByPlayer.get(event.player_id);
          if (!existing || event.effective_from > existing.effective_from) {
            bestAvailabilityEventByPlayer.set(event.player_id, event);
          }
        }
        if (
          event.event_type === "LINE_CHANGE" ||
          event.event_type === "PP_UNIT_CHANGE"
        ) {
          const existing = bestRoleEventByPlayer.get(event.player_id);
          if (!existing || event.effective_from > existing.effective_from) {
            bestRoleEventByPlayer.set(event.player_id, event);
          }
        }
      }

      if (
        event.team_id != null &&
        event.player_id != null &&
        (event.event_type === "GOALIE_START_CONFIRMED" ||
          event.event_type === "GOALIE_START_LIKELY")
      ) {
        const starterProb =
          event.event_type === "GOALIE_START_CONFIRMED"
            ? 1
            : clamp(event.confidence ?? 0.75, 0.5, 1);
        const existing = goalieOverrideByTeamId.get(event.team_id);
        if (!existing || starterProb > existing.starterProb) {
          goalieOverrideByTeamId.set(event.team_id, {
            goalieId: event.player_id,
            starterProb,
          });
        }
      }
    }

    for (const [playerId, event] of bestAvailabilityEventByPlayer.entries()) {
      const multiplier = availabilityMultiplierForEvent(
        event.event_type,
        event.confidence,
      );
      if (multiplier != null) {
        playerAvailabilityMultiplier.set(playerId, multiplier);
        availabilityEventByPlayer.set(playerId, event);
      }
    }
    for (const [playerId, event] of bestRoleEventByPlayer.entries()) {
      roleEventByPlayer.set(playerId, event);
    }
  }

  return {
    currentSeasonId,
    games,
    teamIds,
    gameIds,
    teamAbbreviationById,
    playerAvailabilityMultiplier,
    availabilityEventByPlayer,
    roleEventByPlayer,
    goalieOverrideByTeamId,
    gameMarketContextByGameId,
    playerPropContextByGamePlayerKey,
  };
}
