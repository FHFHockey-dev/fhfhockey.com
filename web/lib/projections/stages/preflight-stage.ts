import { starterBoardFlags } from "../starterBoardFlags";
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
import { loadDailyBoardEvidence, type DailyBoardEvidence } from "../dailyBoardEvidence";

export type ProjectionPreflightStageResult = {
  currentSeasonId: number;
  games: GameRow[];
  teamIds: number[];
  gameIds: number[];
  teamAbbreviationById: Map<number, string>;
  playerAvailabilityMultiplier: Map<number, number>;
  availabilityEventByPlayer: Map<number, RosterEventRow>;
  roleEventByPlayer: Map<number, RosterEventRow>;
  ppEventByPlayer: Map<number, RosterEventRow>;
  dailyBoardEvidence: DailyBoardEvidence;
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

export function scratchGameIdOf(event: Pick<RosterEventRow, "payload">): number | null {
  const payload = event.payload && typeof event.payload === "object" && !Array.isArray(event.payload)
    ? (event.payload as Record<string, unknown>) : {};
  const gameId = Number(payload.game_id);
  return Number.isSafeInteger(gameId) && gameId > 0 ? gameId : null;
}

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
    // Decision 31: scratched / not expected to dress means 0 expected for that game (the
    // "if he plays" line is the reserve row); never a confidence-scaled fraction.
    case "SCRATCH":
      return 0;
    case "RETURN":
    case "CALLUP":
      return 1;
    default:
      return null;
  }
}

/** Latest applicable roster events for one slate (decision 31: a scratch counts only for its own game). */
export function selectRosterEventsForSlate(args: {
  events: readonly RosterEventRow[];
  startTs: string;
  gameIds: readonly number[];
  goalieLikelyOverrides: boolean;
}) {
  const playerAvailabilityMultiplier = new Map<number, number>();
  const availabilityEventByPlayer = new Map<number, RosterEventRow>();
  const roleEventByPlayer = new Map<number, RosterEventRow>();
  const ppEventByPlayer = new Map<number, RosterEventRow>();
  const goalieOverrideByTeamId = new Map<number, { goalieId: number; starterProb: number }>();
  const bestAvailabilityEventByPlayer = new Map<number, RosterEventRow>();
  const bestRoleEventByPlayer = new Map<number, RosterEventRow>();

  const slateGameIds = new Set(args.gameIds);
  for (const event of args.events) {
    if (event.effective_to != null && event.effective_to < args.startTs) {
      continue;
    }
    // A scratch applies only to its own game (decision 31); an unresolved or other-game scratch
    // is ignored, so it neither benches the player today nor masks an earlier injury.
    if (event.event_type === "SCRATCH" && !slateGameIds.has(scratchGameIdOf(event) ?? -1)) {
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
      if (event.event_type === "LINE_CHANGE") {
        const existing = bestRoleEventByPlayer.get(event.player_id);
        if (!existing || event.effective_from > existing.effective_from) {
          bestRoleEventByPlayer.set(event.player_id, event);
        }
      }
      if (event.event_type === "PP_UNIT_CHANGE" && !ppEventByPlayer.has(event.player_id)) {
        ppEventByPlayer.set(event.player_id, event);
      }
    }

    if (
      event.team_id != null &&
      event.player_id != null &&
      (event.event_type === "GOALIE_START_CONFIRMED" ||
        (event.event_type === "GOALIE_START_LIKELY" && args.goalieLikelyOverrides))
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
  return { playerAvailabilityMultiplier, availabilityEventByPlayer, roleEventByPlayer, ppEventByPlayer, goalieOverrideByTeamId };
}

export async function runProjectionPreflightStage(args: {
  asOfDate: string;
  requestedGameIds: number[];
  decisionAsOf?: string;
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
  const ppEventByPlayer = new Map<number, RosterEventRow>();
  const goalieOverrideByTeamId = new Map<
    number,
    { goalieId: number; starterProb: number }
  >();
  const gameMarketContextByGameId = await fetchGameMarketContextByGameIds({
    snapshotDate: args.asOfDate,
    gameIds,
    decisionAsOf: args.decisionAsOf,
  });
  const playerPropContextByGamePlayerKey =
    await fetchPlayerPropContextByGameIds({
      snapshotDate: args.asOfDate,
      gameIds,
      decisionAsOf: args.decisionAsOf,
    });

  if (teamIds.length > 0) {
    const { data: events, error: eventsErr } = await supabase
      .from("forge_roster_events")
      .select(
        "event_id,team_id,player_id,event_type,confidence,payload,effective_from,effective_to",
      )
      .in("team_id", teamIds)
      .lte("created_at", args.decisionAsOf ?? endTs)
      .lte("effective_from", args.decisionAsOf && args.decisionAsOf < endTs ? args.decisionAsOf : endTs)
      .order("effective_from", { ascending: false })
      .limit(5000);
    if (eventsErr) throw eventsErr;

    const selected = selectRosterEventsForSlate({
      events: (events ?? []) as RosterEventRow[],
      startTs,
      gameIds,
      goalieLikelyOverrides: !starterBoardFlags().compute,
    });
    for (const [playerId, value] of selected.playerAvailabilityMultiplier) playerAvailabilityMultiplier.set(playerId, value);
    for (const [playerId, event] of selected.availabilityEventByPlayer) availabilityEventByPlayer.set(playerId, event);
    for (const [playerId, event] of selected.roleEventByPlayer) roleEventByPlayer.set(playerId, event);
    for (const [playerId, event] of selected.ppEventByPlayer) ppEventByPlayer.set(playerId, event);
    for (const [teamId, override] of selected.goalieOverrideByTeamId) goalieOverrideByTeamId.set(teamId, override);
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
    ppEventByPlayer,
    dailyBoardEvidence: starterBoardFlags().compute && args.decisionAsOf
      ? await loadDailyBoardEvidence(gameIds, args.decisionAsOf) : { assertions: [], conflicts: [] },
    goalieOverrideByTeamId,
    gameMarketContextByGameId,
    playerPropContextByGamePlayerKey,
  };
}
