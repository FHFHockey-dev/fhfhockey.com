import { createHash } from "node:crypto";
import { baselineAppearanceFromBoxscore } from "./baselineSourceLineage";
import { finalBoxscoreForGame, rawPlayerForOutput } from "./settlement";
import { playerForecastSourcePayloadHash } from "./sourceSnapshot";
import { timestampMicros } from "../projections/evidenceTime";

export const CURRENT_SEASON_SOG_VERSION = "current-season-sog-appearance-mean-v1";
/** Immutable original replay default; new games require an explicit validated scope. */
export const CURRENT_SEASON_SOG_SCOPE = Object.freeze({
  playerId: 10047, nhlPlayerId: 8478444, teamId: 23, teamAbbreviation: "VAN",
  seasonId: 20262027, targetGameId: 2026020112, opponentTeamId: 13,
  startDate: "2026-10-01", endDate: "2026-10-14", maximumGames: 5,
  maximumResponses: 6, maximumSourceBytes: 2 * 1024 * 1024,
});
export const CURRENT_SEASON_SOG_GAME_SCOPE_VERSION = "current-season-sog-game-scope-v1";
export type CurrentSeasonSogGameScope = {
  playerId: number; nhlPlayerId: number; teamId: number; teamAbbreviation: string;
  seasonId: number; targetGameId: number; opponentTeamId: number;
  startDate: string; endDate: string; maximumGames: number; maximumResponses: number; maximumSourceBytes: number;
  scopeVersion: typeof CURRENT_SEASON_SOG_GAME_SCOPE_VERSION;
  targetGameDate: string; targetStartTimeUTC: string; isHome: boolean;
  cutoffAt: string; expiresAt: string;
};

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
const dayMicros = BigInt(86400000000);

function scopeClock(value: string): bigint | null {
  const parts = typeof value === "string" && value.match(/T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(Z|[+-](\d{2}):(\d{2}))$/);
  if (!parts || Number(parts[1]) > 23 || Number(parts[2]) > 59 || Number(parts[3]) > 59
    || (parts[4] !== "Z" && (Number(parts[5]) > 23 || Number(parts[6]) > 59))) return null;
  return timestampMicros(value);
}

function validatedGameScope(scope: CurrentSeasonSogGameScope, generatedAt: string): CurrentSeasonSogGameScope {
  if (!exactKeys(scope, [...Object.keys(CURRENT_SEASON_SOG_SCOPE), "scopeVersion", "targetGameDate",
    "targetStartTimeUTC", "isHome", "cutoffAt", "expiresAt"])
    || scope.scopeVersion !== CURRENT_SEASON_SOG_GAME_SCOPE_VERSION
    || ![scope.playerId, scope.nhlPlayerId, scope.teamId, scope.opponentTeamId, scope.targetGameId].every(positiveId)
    || scope.teamId === scope.opponentTeamId || typeof scope.isHome !== "boolean"
    || typeof scope.teamAbbreviation !== "string" || !/^[A-Z]{2,3}$/.test(scope.teamAbbreviation)
    || !Number.isSafeInteger(scope.seasonId) || !/^\d{8}$/.test(String(scope.seasonId))
    || Math.floor(scope.seasonId / 10000) + 1 !== scope.seasonId % 10000
    || !new RegExp(`^${Math.floor(scope.seasonId / 10000)}02\\d{4}$`).test(String(scope.targetGameId))
    || !validDate(scope.startDate) || !validDate(scope.endDate) || !validDate(scope.targetGameDate)
    || scope.startDate > scope.endDate || scope.endDate >= scope.targetGameDate
    || scope.maximumGames !== CURRENT_SEASON_SOG_SCOPE.maximumGames
    || scope.maximumResponses !== CURRENT_SEASON_SOG_SCOPE.maximumResponses
    || scope.maximumSourceBytes !== CURRENT_SEASON_SOG_SCOPE.maximumSourceBytes) {
    throw new Error("Invalid explicit SOG player/game/season/history scope or budget.");
  }
  const seasonStart = `${Math.floor(scope.seasonId / 10000)}-07-01`, seasonEnd = `${scope.seasonId % 10000}-07-01`;
  const cutoff = scopeClock(scope.cutoffAt), start = scopeClock(scope.targetStartTimeUTC), expiry = scopeClock(scope.expiresAt);
  const generated = timestampMicros(generatedAt)!;
  const startDate = start === null ? null : new Date(Number(start / BigInt(1000))).toISOString().slice(0, 10);
  if (cutoff === null || start === null || expiry === null || cutoff > generated
    || start <= generated || expiry <= generated || expiry !== (start < cutoff + dayMicros ? start : cutoff + dayMicros)
    || scope.startDate < seasonStart || scope.targetGameDate >= seasonEnd
    || scope.endDate > new Date(Number(cutoff / BigInt(1000))).toISOString().slice(0, 10)
    || startDate === null || startDate < seasonStart || startDate >= seasonEnd
    // Official game dates may fall on the preceding local day relative to UTC.
    || (start !== null && Math.abs(Number(start / BigInt(1000)) - Date.parse(scope.targetGameDate)) > 2 * 86400000)
    || scope.cutoffAt.slice(0, 10) < seasonStart || generatedAt.slice(0, 10) >= seasonEnd) {
    throw new Error("Invalid SOG history window, cutoff, future start or bounded expiry.");
  }
  return structuredClone(scope);
}

function parseResponse(receipt: CurrentSeasonSogResponse, expectedUrl: string, cutoff: bigint, explicit = false) {
  if (!exactKeys(receipt, ["url", "capturedAt", "bodySha256", "rawBody"])
    || receipt.url !== expectedUrl || typeof receipt.rawBody !== "string" || !receipt.rawBody.length
    || typeof receipt.bodySha256 !== "string" || !/^[a-f0-9]{64}$/.test(receipt.bodySha256)
    || sha256(receipt.rawBody) !== receipt.bodySha256) throw new Error("Invalid original source receipt/hash/URL.");
  const captured = explicit ? scopeClock(receipt.capturedAt) : timestampMicros(receipt.capturedAt);
  if (captured === null || captured > cutoff) throw new Error("Invalid or future source capture clock.");
  const payload = JSON.parse(receipt.rawBody);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Incomplete source response.");
  return { payload, captured };
}

/** Offline assembly only: no fetch, database, projections, prior season or public admission. */
export function assembleCurrentSeasonSogBaseline(input: CurrentSeasonSogResponses, now = new Date(),
  gameScope?: CurrentSeasonSogGameScope) {
  const generatedAt = now.toISOString(), generated = timestampMicros(generatedAt)!;
  const explicit = gameScope === undefined ? undefined : validatedGameScope(gameScope, generatedAt);
  const cutoffAt = explicit?.cutoffAt ?? generatedAt, cutoff = timestampMicros(cutoffAt)!;
  const scope = explicit ?? CURRENT_SEASON_SOG_SCOPE;
  if (!exactKeys(input, ["schedule", "boxscores"]) || !Array.isArray(input.boxscores)
    || input.boxscores.length > scope.maximumGames) throw new Error("Expected one schedule and at most five boxscores.");
  const responses = [input.schedule, ...input.boxscores];
  if (responses.some(row => !row || typeof row.rawBody !== "string")
    || responses.reduce((sum, row) => sum + Buffer.byteLength(row.rawBody, "utf8"), 0) > scope.maximumSourceBytes) {
    throw new Error("Source byte budget exceeded or incomplete response.");
  }
  const scheduleUrl = `https://api-web.nhle.com/v1/club-schedule-season/${scope.teamAbbreviation}/${scope.seasonId}`;
  const schedule = parseResponse(input.schedule, scheduleUrl, cutoff, !!explicit);
  if (generated - schedule.captured > dayMicros) throw new Error("Current game schedule capture is older than 24 hours.");
  if (!Array.isArray(schedule.payload.games) || !schedule.payload.games.length
    || schedule.payload.games.length > 200) throw new Error("Incomplete or oversized club schedule.");
  const seen = new Set<number>();
  const games = schedule.payload.games.map((game: any) => {
    if (!game || !positiveId(game.id) || seen.has(game.id) || game.season !== scope.seasonId
      || !Number.isSafeInteger(game.gameType) || ![1, 2, 3].includes(game.gameType)
      || !validDate(game.gameDate) || (explicit ? scopeClock(game.startTimeUTC) : timestampMicros(game.startTimeUTC)) === null
      || !positiveId(game.homeTeam?.id) || !positiveId(game.awayTeam?.id)
      || game.homeTeam.id === game.awayTeam.id || ![game.homeTeam.id, game.awayTeam.id].includes(scope.teamId)
      || typeof game.gameState !== "string") throw new Error("Conflicting or invalid current-season schedule context.");
    seen.add(game.id);
    return game;
  });
  const target = games.find((game: any) => game.id === scope.targetGameId);
  const homeTeamId = explicit?.isHome ? scope.teamId : scope.opponentTeamId;
  const awayTeamId = explicit?.isHome ? scope.opponentTeamId : scope.teamId;
  if (!target || target.gameType !== 2 || target.gameDate !== (explicit?.targetGameDate ?? "2026-10-15")
    || target.awayTeam.id !== awayTeamId || target.homeTeam.id !== homeTeamId
    || (explicit && scopeClock(target.startTimeUTC) !== scopeClock(explicit.targetStartTimeUTC))
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
    const source = parseResponse(receipt, url, cutoff, !!explicit), start = timestampMicros(game.startTimeUTC)!;
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
  const expiresAt = explicit?.expiresAt ?? (timestampMicros(target.startTimeUTC)! <= cutoff + dayMicros
    ? target.startTimeUTC : new Date(now.getTime() + 86400000).toISOString());
  const packet = {
    version: CURRENT_SEASON_SOG_VERSION, status: "unreleased_local" as const, scope,
    capturedAt: cutoffAt, cutoffAt, generatedAt,
    expiresAt,
    target: { targetKey: "SHOTS_ON_GOAL", unit: "count", basis: "per_appearance",
      mean: totalShots / appearances.length, totalShots, sampleSize: appearances.length,
      sampleDates: appearances.map(row => row.gameDate), sampleGameIds: appearances.map(row => row.gameId) },
    selectedGameIds: history.map((game: any) => game.id), exclusions, appearances,
    sourceReceipts: structuredClone(input), sourceBytes: responses.reduce((sum, row) => sum + Buffer.byteLength(row.rawBody, "utf8"), 0),
    participation: null, uncertainty: null, calibration: "unavailable", publicUsesApproved: false,
    limitations: ["Uncalibrated small-sample current-season conditional SOG mean; no prior or uncertainty interval.",
      `Window is the latest up-to-five final ${scope.teamAbbreviation} regular-season games within the declared dates; it is not a complete player-season history.`,
      "Only valid positive-minute appearances enter the denominator; absent/zero-minute rows do not establish participation probability.",
      "Original source publication/correction clocks and receipt authenticity are not established by replaying supplied bytes.",
      "No unconditional totals, predictive qualification, persistence or public activation."],
  };
  return { ...packet, payloadHash: playerForecastSourcePayloadHash(packet) };
}
