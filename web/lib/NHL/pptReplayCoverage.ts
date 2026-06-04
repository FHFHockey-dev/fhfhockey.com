import { fetchPbpGame } from "lib/projections/ingest/pbp";

export type PptReplayPlay = {
  eventId?: number | string | null;
  typeDescKey?: string | null;
  sortOrder?: number | string | null;
  periodDescriptor?: {
    number?: number | string | null;
    periodType?: string | null;
  } | null;
  timeInPeriod?: string | null;
  pptReplayUrl?: string | null;
  details?: {
    highlightClip?: number | string | null;
    highlightClipSharingUrl?: string | null;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
};

export type PptReplayPbpResponse = {
  id: number | string;
  season?: number | string | null;
  gameType?: number | string | null;
  gameDate?: string | null;
  gameState?: string | null;
  plays?: PptReplayPlay[] | null;
};

export type PptReplayEvent = {
  seasonId: number | null;
  gameId: number;
  gameDate: string | null;
  gameType: number | null;
  gameState: string | null;
  eventId: number;
  eventType: string | null;
  sortOrder: number | null;
  periodNumber: number | null;
  periodType: string | null;
  timeInPeriod: string | null;
  pptReplayUrl: string;
  highlightClip: string | null;
  highlightClipSharingUrl: string | null;
};

export type PptReplayGameCoverage = {
  gameId: number;
  seasonId: number | null;
  gameDate: string | null;
  gameType: number | null;
  gameState: string | null;
  playCount: number;
  replayEventCount: number;
  replayEventTypes: Record<string, number>;
  nonGoalReplayEventCount: number;
  events: PptReplayEvent[];
};

function toNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toStringOrNull(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function countByType(events: PptReplayEvent[]): Record<string, number> {
  return events.reduce<Record<string, number>>((counts, event) => {
    const key = event.eventType ?? "unknown";
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

export function discoverPptReplayEventsFromPbp(
  game: PptReplayPbpResponse
): PptReplayGameCoverage {
  const gameId = toNumber(game.id);
  if (gameId == null) {
    throw new Error("Cannot discover pptReplayUrl events without a numeric game id.");
  }

  const seasonId = toNumber(game.season);
  const gameType = toNumber(game.gameType);
  const events = (game.plays ?? []).flatMap<PptReplayEvent>((play) => {
    const replayUrl = toStringOrNull(play.pptReplayUrl);
    const eventId = toNumber(play.eventId);
    if (!replayUrl || eventId == null) return [];

    return [
      {
        seasonId,
        gameId,
        gameDate: toStringOrNull(game.gameDate),
        gameType,
        gameState: toStringOrNull(game.gameState),
        eventId,
        eventType: toStringOrNull(play.typeDescKey),
        sortOrder: toNumber(play.sortOrder),
        periodNumber: toNumber(play.periodDescriptor?.number),
        periodType: toStringOrNull(play.periodDescriptor?.periodType),
        timeInPeriod: toStringOrNull(play.timeInPeriod),
        pptReplayUrl: replayUrl,
        highlightClip: toStringOrNull(play.details?.highlightClip),
        highlightClipSharingUrl: toStringOrNull(play.details?.highlightClipSharingUrl),
      },
    ];
  });

  return {
    gameId,
    seasonId,
    gameDate: toStringOrNull(game.gameDate),
    gameType,
    gameState: toStringOrNull(game.gameState),
    playCount: game.plays?.length ?? 0,
    replayEventCount: events.length,
    replayEventTypes: countByType(events),
    nonGoalReplayEventCount: events.filter((event) => event.eventType !== "goal").length,
    events,
  };
}

export async function fetchPptReplayCoverageForGame(
  gameId: number
): Promise<PptReplayGameCoverage> {
  const game = await fetchPbpGame(gameId);
  return discoverPptReplayEventsFromPbp(game as PptReplayPbpResponse);
}
