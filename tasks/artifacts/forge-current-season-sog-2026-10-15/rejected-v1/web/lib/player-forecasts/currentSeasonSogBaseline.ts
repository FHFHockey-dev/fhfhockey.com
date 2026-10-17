import { createHash } from "node:crypto";
import { baselineAppearanceFromBoxscore } from "./baselineSourceLineage";
import { finalBoxscoreForGame, rawPlayerForOutput } from "./settlement";
import { playerForecastSourcePayloadHash } from "./sourceSnapshot";
import { timestampMicros } from "../projections/evidenceTime";

export const CURRENT_SEASON_SOG_VERSION = "current-season-sog-appearance-mean-v1";
/** One reviewed canary scope; expanding it requires an explicit new scope. */
export const CURRENT_SEASON_SOG_SCOPE = Object.freeze({
  playerId: 10047, nhlPlayerId: 8478444, teamId: 23, teamAbbreviation: "VAN",
  seasonId: 20262027, targetGameId: 2026020112, opponentTeamId: 13,
  startDate: "2026-10-01", endDate: "2026-10-14", maximumGames: 5,
  maximumResponses: 6, maximumSourceBytes: 2 * 1024 * 1024,
});

export type CurrentSeasonSogResponse = {
  url: string; capturedAt: string; bodySha256: string; rawBody: string;
};
export type CurrentSeasonSogResponses = {
  schedule: CurrentSeasonSogResponse; boxscores: CurrentSeasonSogResponse[];
};

function exactKeys(value: unknown, keys: string[]): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).length === keys.length && Object.keys(value).every(key => keys.includes(key));
}
const positiveId = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0;
const validDate = (value: unknown): value is string => typeof value === "string"
  && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value))
  && new Date(value).toISOString().slice(0, 10) === value;
const sha256 = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

function parseResponse(receipt: CurrentSeasonSogResponse, expectedUrl: string, cutoff: bigint) {
  if (!exactKeys(receipt, ["url", "capturedAt", "bodySha256", "rawBody"])
    || receipt.url !== expectedUrl || typeof receipt.rawBody !== "string" || !receipt.rawBody.length
    || typeof receipt.bodySha256 !== "string" || !/^[a-f0-9]{64}$/.test(receipt.bodySha256)
    || sha256(receipt.rawBody) !== receipt.bodySha256) throw new Error("Invalid original source receipt/hash/URL.");
  const captured = timestampMicros(receipt.capturedAt);
  if (captured === null || captured > cutoff) throw new Error("Invalid or future source capture clock.");
  const payload = JSON.parse(receipt.rawBody);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Incomplete source response.");
  return { payload, captured };
}

/** Offline assembly only: no fetch, database, projections, prior season or public admission. */
export function assembleCurrentSeasonSogBaseline(input: CurrentSeasonSogResponses, now = new Date()) {
  const scope = CURRENT_SEASON_SOG_SCOPE, cutoffAt = now.toISOString(), cutoff = timestampMicros(cutoffAt)!;
  if (!exactKeys(input, ["schedule", "boxscores"]) || !Array.isArray(input.boxscores)
    || input.boxscores.length > scope.maximumGames) throw new Error("Expected one schedule and at most five boxscores.");
  const responses = [input.schedule, ...input.boxscores];
  if (responses.some(row => !row || typeof row.rawBody !== "string")
    || responses.reduce((sum, row) => sum + Buffer.byteLength(row.rawBody, "utf8"), 0) > scope.maximumSourceBytes) {
    throw new Error("Source byte budget exceeded or incomplete response.");
  }
  const scheduleUrl = `https://api-web.nhle.com/v1/club-schedule-season/VAN/${scope.seasonId}`;
  const schedule = parseResponse(input.schedule, scheduleUrl, cutoff);
  if (cutoff - schedule.captured > BigInt(86400000000)) throw new Error("Current game schedule capture is older than 24 hours.");
  if (!Array.isArray(schedule.payload.games) || !schedule.payload.games.length
    || schedule.payload.games.length > 200) throw new Error("Incomplete or oversized club schedule.");
  const seen = new Set<number>();
  const games = schedule.payload.games.map((game: any) => {
    if (!game || !positiveId(game.id) || seen.has(game.id) || game.season !== scope.seasonId
      || !Number.isSafeInteger(game.gameType) || ![1, 2, 3].includes(game.gameType)
      || !validDate(game.gameDate) || timestampMicros(game.startTimeUTC) === null
      || !positiveId(game.homeTeam?.id) || !positiveId(game.awayTeam?.id)
      || game.homeTeam.id === game.awayTeam.id || ![game.homeTeam.id, game.awayTeam.id].includes(scope.teamId)
      || typeof game.gameState !== "string") throw new Error("Conflicting or invalid current-season schedule context.");
    seen.add(game.id);
    return game;
  });
  const target = games.find((game: any) => game.id === scope.targetGameId);
  if (!target || target.gameType !== 2 || target.gameDate !== "2026-10-15"
    || target.awayTeam.id !== scope.teamId || target.homeTeam.id !== scope.opponentTeamId
    || !["FUT", "PRE"].includes(target.gameState) || timestampMicros(target.startTimeUTC)! <= cutoff) {
    throw new Error("Target game is missing, mismatched or already started.");
  }
  const history = games.filter((game: any) => game.gameType === 2
    && game.gameDate >= scope.startDate && game.gameDate <= scope.endDate
    && ["OFF", "FINAL"].includes(game.gameState))
    .sort((a: any, b: any) => b.gameDate.localeCompare(a.gameDate) || b.id - a.id).slice(0, scope.maximumGames);
  if (!history.length || input.boxscores.length !== history.length) throw new Error("Missing exact selected historical boxscores.");
  const receipts = new Map<string, CurrentSeasonSogResponse>();
  for (const row of input.boxscores) {
    if (receipts.has(row.url)) throw new Error("Duplicate/conflicting boxscore response.");
    receipts.set(row.url, row);
  }
  const appearances = [], exclusions: Array<{ gameId: number; reason: string }> = [];
  for (const game of history) {
    const url = `https://api-web.nhle.com/v1/gamecenter/${game.id}/boxscore`, receipt = receipts.get(url);
    if (!receipt) throw new Error("Missing selected boxscore response.");
    const source = parseResponse(receipt, url, cutoff), start = timestampMicros(game.startTimeUTC)!;
    if (source.captured < start || schedule.captured < start) throw new Error("Historical final source predates the game.");
    // HTTP capture identity is explicit; this is not a fabricated database row ID.
    const rawRow = { id: `http:${receipt.bodySha256}`, endpoint: "boxscore", game_id: game.id,
      season_id: scope.seasonId, fetched_at: receipt.capturedAt, payload_hash: receipt.bodySha256, payload: source.payload };
    const canonicalGame = { id: game.id, seasonId: scope.seasonId, type: 2, date: game.gameDate,
      startTime: game.startTimeUTC, homeTeamId: game.homeTeam.id, awayTeamId: game.awayTeam.id };
    const final = finalBoxscoreForGame(rawRow, canonicalGame);
    if (!final || source.payload.gameDate !== game.gameDate || source.payload.gameType !== 2
      || source.payload.startTimeUTC == null || timestampMicros(source.payload.startTimeUTC) !== start) {
      throw new Error("Invalid final boxscore game/date/start context.");
    }
    const player = rawPlayerForOutput({ team_id: scope.teamId, player_id: scope.nhlPlayerId }, final);
    if (!player || player.goalie) throw new Error("Invalid or conflicting historical player identities.");
    if (!player.skater) { exclusions.push({ gameId: game.id, reason: "not_listed_in_complete_boxscore" }); continue; }
    const appearance = baselineAppearanceFromBoxscore({ rawRow, game: canonicalGame,
      teamId: scope.teamId, nhlPlayerId: scope.nhlPlayerId, cutoffAt, population: "skater" });
    if (!appearance) { exclusions.push({ gameId: game.id, reason: "zero_minutes" }); continue; }
    const shots = appearance.targets.SHOTS_ON_GOAL;
    if (!Number.isSafeInteger(shots) || shots! < 0) throw new Error("Positive-minute appearance lacks valid SOG.");
    appearances.push(appearance);
  }
  if (!appearances.length) throw new Error("No admitted positive-minute SOG appearances.");
  const totalShots = appearances.reduce((sum, row) => sum + row.targets.SHOTS_ON_GOAL!, 0);
  if (!Number.isSafeInteger(totalShots)) throw new Error("Aggregate SOG exceeds the exact count range.");
  const packet = {
    version: CURRENT_SEASON_SOG_VERSION, status: "unreleased_local" as const, scope,
    capturedAt: cutoffAt, cutoffAt, generatedAt: cutoffAt,
    expiresAt: new Date(Math.min(Date.parse(target.startTimeUTC), now.getTime() + 86400000)).toISOString(),
    target: { targetKey: "SHOTS_ON_GOAL", unit: "count", basis: "per_appearance",
      mean: totalShots / appearances.length, totalShots, sampleSize: appearances.length,
      sampleDates: appearances.map(row => row.gameDate), sampleGameIds: appearances.map(row => row.gameId) },
    selectedGameIds: history.map((game: any) => game.id), exclusions, appearances,
    sourceReceipts: structuredClone(input), sourceBytes: responses.reduce((sum, row) => sum + Buffer.byteLength(row.rawBody, "utf8"), 0),
    participation: null, uncertainty: null, calibration: "unavailable", publicUsesApproved: false,
    limitations: ["Uncalibrated small-sample current-season conditional SOG mean; no prior or uncertainty interval.",
      "Window is the latest up-to-five final VAN regular-season games within the declared dates; it is not a complete player-season history.",
      "Only valid positive-minute appearances enter the denominator; absent/zero-minute rows do not establish participation probability.",
      "Original source publication/correction clocks and receipt authenticity are not established by replaying supplied bytes.",
      "No unconditional totals, predictive qualification, persistence or public activation."],
  };
  return { ...packet, payloadHash: playerForecastSourcePayloadHash(packet) };
}
