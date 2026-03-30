import type { ParsedNhlPbpEvent } from "./nhlPlayByPlayParser";
import {
  classifyTeamStrengthState,
  parseSituationCode,
  type StrengthState,
} from "./nhlStrengthState";
import {
  findShiftStintAtTime,
  type NhlShiftStint,
  type NhlShiftStintTeam,
} from "./nhlShiftStints";

export type OnIceEntityKind = "player" | "pairing" | "line" | "team";

export type TeamOnIceAttribution = {
  teamId: number;
  playerIds: number[];
  strengthState: StrengthState | null;
  strengthExact: string | null;
  isEventOwner: boolean;
};

export type EventOnIceAttribution = {
  gameId: number;
  eventId: number;
  periodNumber: number | null;
  eventSecond: number | null;
  eventOwnerTeamId: number | null;
  stintFound: boolean;
  homeTeam: TeamOnIceAttribution;
  awayTeam: TeamOnIceAttribution;
  ownerPlayerIds: number[];
  opponentPlayerIds: number[];
  allPlayerIds: number[];
};

function sortNumbers(values: number[]): number[] {
  return [...values].sort((left, right) => left - right);
}

function getTeamPlayers(
  teams: NhlShiftStintTeam[] | null,
  teamId: number
): number[] {
  return sortNumbers(teams?.find((team) => team.teamId === teamId)?.playerIds ?? []);
}

export function buildOnIceAttributionForEvent(
  event: Pick<
    ParsedNhlPbpEvent,
    | "game_id"
    | "event_id"
    | "period_number"
    | "period_seconds_elapsed"
    | "event_owner_team_id"
    | "situation_code"
    | "strength_exact"
  >,
  stints: NhlShiftStint[],
  homeTeamId: number,
  awayTeamId: number
): EventOnIceAttribution {
  const periodNumber = event.period_number ?? null;
  const eventSecond = event.period_seconds_elapsed ?? null;
  const parsedSituation = parseSituationCode(event.situation_code);
  const stint =
    periodNumber == null || eventSecond == null
      ? null
      : findShiftStintAtTime(stints, periodNumber, eventSecond);

  const homePlayerIds = getTeamPlayers(stint?.teams ?? null, homeTeamId);
  const awayPlayerIds = getTeamPlayers(stint?.teams ?? null, awayTeamId);
  const ownerTeamId = event.event_owner_team_id ?? null;
  const ownerPlayerIds =
    ownerTeamId === homeTeamId
      ? homePlayerIds
      : ownerTeamId === awayTeamId
        ? awayPlayerIds
        : [];
  const opponentPlayerIds =
    ownerTeamId === homeTeamId
      ? awayPlayerIds
      : ownerTeamId === awayTeamId
        ? homePlayerIds
        : [];

  return {
    gameId: event.game_id,
    eventId: event.event_id,
    periodNumber,
    eventSecond,
    eventOwnerTeamId: ownerTeamId,
    stintFound: stint !== null,
    homeTeam: {
      teamId: homeTeamId,
      playerIds: homePlayerIds,
      strengthState: classifyTeamStrengthState(
        parsedSituation,
        homeTeamId,
        homeTeamId,
        awayTeamId
      ),
      strengthExact: event.strength_exact ?? null,
      isEventOwner: ownerTeamId === homeTeamId,
    },
    awayTeam: {
      teamId: awayTeamId,
      playerIds: awayPlayerIds,
      strengthState: classifyTeamStrengthState(
        parsedSituation,
        awayTeamId,
        homeTeamId,
        awayTeamId
      ),
      strengthExact: event.strength_exact ?? null,
      isEventOwner: ownerTeamId === awayTeamId,
    },
    ownerPlayerIds,
    opponentPlayerIds,
    allPlayerIds: sortNumbers([...homePlayerIds, ...awayPlayerIds]),
  };
}

function getAttributionTeam(
  attribution: EventOnIceAttribution,
  teamId: number
): TeamOnIceAttribution | null {
  if (attribution.homeTeam.teamId === teamId) return attribution.homeTeam;
  if (attribution.awayTeam.teamId === teamId) return attribution.awayTeam;
  return null;
}

export function isPlayerOnIce(
  attribution: EventOnIceAttribution,
  teamId: number,
  playerId: number
): boolean {
  return getAttributionTeam(attribution, teamId)?.playerIds.includes(playerId) ?? false;
}

export function arePlayersOnIceTogether(
  attribution: EventOnIceAttribution,
  teamId: number,
  playerIds: number[]
): boolean {
  const team = getAttributionTeam(attribution, teamId);
  if (!team || playerIds.length === 0) return false;
  return playerIds.every((playerId) => team.playerIds.includes(playerId));
}

export function isEntityOnIce(
  attribution: EventOnIceAttribution,
  kind: OnIceEntityKind,
  teamId: number,
  playerIds: number[] = []
): boolean {
  if (kind === "team") {
    return (getAttributionTeam(attribution, teamId)?.playerIds.length ?? 0) > 0;
  }

  if (kind === "player" && playerIds.length === 1) {
    return isPlayerOnIce(attribution, teamId, playerIds[0]);
  }

  if (kind === "pairing" && playerIds.length === 2) {
    return arePlayersOnIceTogether(attribution, teamId, playerIds);
  }

  if (kind === "line" && playerIds.length >= 3) {
    return arePlayersOnIceTogether(attribution, teamId, playerIds);
  }

  return false;
}
