import { createHash } from "node:crypto";
import type { RosterOptimizerTeamGameUpsert } from "./types";

type Query = Record<string, string | string[] | undefined>;
type RequestScope = { mode: "bounded" | "full"; gameKey: string; startDate: string; endDate: string };
export type RefreshGuard = {
  seasonId: number;
  gameIds: number[];
  maxSides: number;
  expectedScopeHash?: string;
};

export class RefreshGuardError extends Error {
  readonly details?: string;
  constructor(readonly code: string, message: string, readonly status = 409) {
    super(message);
  }
}

function scalar(query: Query, key: string): string | undefined {
  const value = query[key];
  if (Array.isArray(value)) throw new RefreshGuardError("INVALID_REFRESH_GUARD", `${key} must occur once.`, 400);
  return value;
}

/** Opt-in guard; legacy requests keep their existing writer behavior. */
export function parseRefreshGuard(query: Query, request: RequestScope): { dryRun: boolean; guard?: RefreshGuard } {
  const dryRunValue = scalar(query, "dryRun");
  if (dryRunValue != null && !["true", "false"].includes(dryRunValue)) {
    throw new RefreshGuardError("INVALID_REFRESH_GUARD", "dryRun must be true or false.", 400);
  }
  const dryRun = dryRunValue === "true";
  const guarded = dryRun || ["seasonId", "gameIds", "maxSides", "expectedScopeHash"].some(key => query[key] != null);
  if (!guarded) return { dryRun };
  if (request.mode !== "bounded" || ["mode", "gameKey", "startDate", "endDate"].some(key => !scalar(query, key))) {
    throw new RefreshGuardError("INVALID_REFRESH_GUARD", "Guarded refresh requires explicit bounded mode, gameKey and dates.", 400);
  }
  const season = scalar(query, "seasonId") ?? "";
  const ids = scalar(query, "gameIds") ?? "";
  const maximum = scalar(query, "maxSides") ?? "";
  if (!/^\d{8}$/.test(season) || Number(season.slice(4)) !== Number(season.slice(0, 4)) + 1
    || !/^\d+(,\d+)*$/.test(ids) || !/^\d+$/.test(maximum)) {
    throw new RefreshGuardError("INVALID_REFRESH_GUARD", "Supply a consecutive seasonId, comma-separated gameIds and integer maxSides.", 400);
  }
  const gameIds = ids.split(",").map(Number).sort((a, b) => a - b);
  const maxSides = Number(maximum);
  if (gameIds.some(id => !Number.isSafeInteger(id) || id <= 0) || new Set(gameIds).size !== gameIds.length
    || !Number.isSafeInteger(maxSides) || maxSides < 1 || maxSides > 1000) {
    throw new RefreshGuardError("INVALID_REFRESH_GUARD", "gameIds must be unique positive IDs; maxSides must be 1–1000.", 400);
  }
  if (gameIds.length * 2 > maxSides) {
    throw new RefreshGuardError("REFRESH_SCOPE_OVERFLOW", "The approved game set exceeds maxSides.");
  }
  const expectedScopeHash = scalar(query, "expectedScopeHash");
  if ((expectedScopeHash != null && !/^[a-f0-9]{64}$/.test(expectedScopeHash)) || (!dryRun && !expectedScopeHash)) {
    throw new RefreshGuardError("INVALID_REFRESH_GUARD", "A guarded write requires the SHA-256 scope hash from inspection.", 400);
  }
  return { dryRun, guard: { seasonId: Number(season), gameIds, maxSides, expectedScopeHash } };
}

/** Validate the whole fetched scope; never truncate to the operator allowlist. */
export function inspectRefreshScope(args: {
  request: RequestScope;
  guard: RefreshGuard;
  seasonId: number;
  yahooSeason: string;
  complete: boolean;
  ignoredGames: number;
  unmappedGames: number;
  rows: readonly RosterOptimizerTeamGameUpsert[];
}) {
  const { guard, request, rows } = args;
  if (args.seasonId !== guard.seasonId || !args.complete || args.ignoredGames || args.unmappedGames) {
    throw new RefreshGuardError("REFRESH_SCOPE_MISMATCH", "Source season, completeness, team or week mapping differs from the approved scope.");
  }
  if (rows.length > guard.maxSides) {
    throw new RefreshGuardError("REFRESH_SCOPE_OVERFLOW", "Fetched team sides exceed maxSides.");
  }
  const games = new Map<number, RosterOptimizerTeamGameUpsert[]>();
  const identities = new Set<string>();
  for (const row of rows) {
    if (row.game_key !== request.gameKey || row.source_season_id !== guard.seasonId || row.season !== args.yahooSeason
      || row.game_date < request.startDate || row.game_date > request.endDate
      || !guard.gameIds.includes(row.source_game_id)) {
      throw new RefreshGuardError("REFRESH_SCOPE_MISMATCH", "A fetched side is outside the approved dates, season, key or game set.");
    }
    const identity = `${row.source_game_id}:${row.team_id}`;
    if (identities.has(identity)) throw new RefreshGuardError("REFRESH_SCOPE_MISMATCH", "Duplicate fetched team-side identity.");
    identities.add(identity);
    games.set(row.source_game_id, [...(games.get(row.source_game_id) ?? []), row]);
  }
  if (games.size !== guard.gameIds.length || guard.gameIds.some(id => !games.has(id))) {
    throw new RefreshGuardError("REFRESH_SCOPE_MISMATCH", "The source omitted an approved game; zero games is not a refresh.");
  }
  for (const sides of games.values()) {
    const home = sides.find(row => row.home_away === "home");
    const away = sides.find(row => row.home_away === "away");
    if (sides.length !== 2 || !home || !away || home.team_id !== away.opponent_team_id
      || away.team_id !== home.opponent_team_id) {
      throw new RefreshGuardError("REFRESH_SCOPE_MISMATCH", "Every approved game requires two reciprocal team sides.");
    }
  }
  // Keep normalized source content/provenance; exclude only our observation time
  // so same-content retries retain a stable hash and a truthful new fetched_at.
  const content = [...rows].sort((a, b) => a.source_game_id - b.source_game_id || a.team_id - b.team_id)
    .map(({ fetched_at: _fetchedAt, ...row }) => row);
  const scopeHash = createHash("sha256").update(JSON.stringify({
    version: "rso-refresh-scope-v1", ...request, seasonId: guard.seasonId,
    gameIds: guard.gameIds, maxSides: guard.maxSides, rows: content,
  })).digest("hex");
  if (guard.expectedScopeHash && scopeHash !== guard.expectedScopeHash) {
    throw new RefreshGuardError("REFRESH_SOURCE_CHANGED", "The refetched source differs from the inspected scope; inspect and approve again.");
  }
  return { version: "rso-refresh-scope-v1", seasonId: guard.seasonId, gameIds: guard.gameIds,
    maxSides: guard.maxSides, sides: rows.length, scopeHash,
    nonCountableGameIds: [...games].filter(([, sides]) => sides.some(row => !row.is_countable)).map(([id]) => id).sort((a, b) => a - b) };
}
