import Fetch from "lib/cors-fetch";

export class WgoIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WgoIntegrityError";
  }
}

export type WgoGameIdentity = {
  gameId: number;
  gameDate: string;
  gameType: number;
  seasonId: number;
};

type WgoGameRow = {
  gameDate?: unknown;
  gameId?: unknown;
  playerId?: unknown;
};

function validIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function parseWgoSeasonId(value: unknown): number | null {
  const text = String(value ?? "");
  if (!/^\d{8}$/.test(text)) return null;
  const startYear = Number(text.slice(0, 4));
  const endYear = Number(text.slice(4));
  return endYear === startYear + 1 ? Number(text) : null;
}

export function resolveWgoGameIdentity(options: {
  row: WgoGameRow;
  expectedDate: string;
  expectedSeasonId: number;
  allowedGameTypes: readonly number[];
  source: string;
}): WgoGameIdentity {
  const { row, expectedDate, expectedSeasonId, allowedGameTypes, source } =
    options;
  const gameId = Number(row.gameId);
  if (!Number.isSafeInteger(gameId) || gameId < 1900000000 || gameId > 2999999999) {
    throw new WgoIntegrityError(`${source} returned an invalid or missing gameId.`);
  }
  if (!validIsoDate(expectedDate)) {
    throw new WgoIntegrityError(`Invalid requested WGO date: ${expectedDate}.`);
  }
  if (row.gameDate !== undefined && row.gameDate !== expectedDate) {
    throw new WgoIntegrityError(
      `${source} gameDate ${String(row.gameDate)} does not match requested date ${expectedDate}.`,
    );
  }

  const startYear = Math.trunc(gameId / 1_000_000);
  const gameType = Math.trunc(gameId / 10_000) % 100;
  const seasonId = startYear * 10_000 + startYear + 1;
  if (seasonId !== expectedSeasonId) {
    throw new WgoIntegrityError(
      `${source} gameId ${gameId} resolves to season ${seasonId}, not ${expectedSeasonId}.`,
    );
  }
  if (!allowedGameTypes.includes(gameType)) {
    throw new WgoIntegrityError(
      `${source} gameId ${gameId} has game type ${gameType}, expected ${allowedGameTypes.join(" or ")}.`,
    );
  }
  return { gameId, gameDate: expectedDate, gameType, seasonId };
}

export function wgoPlayerGameKey(row: WgoGameRow, source: string): string {
  const playerId = Number(row.playerId);
  const gameId = Number(row.gameId);
  if (!Number.isSafeInteger(playerId) || playerId <= 0) {
    throw new WgoIntegrityError(`${source} returned an invalid playerId.`);
  }
  if (!Number.isSafeInteger(gameId) || gameId <= 0) {
    throw new WgoIntegrityError(`${source} returned an invalid or missing gameId.`);
  }
  return `${playerId}:${gameId}`;
}

export function mapWgoRowsByPlayerGame<T extends WgoGameRow>(
  rows: T[],
  source: string,
): Map<string, T> {
  const mapped = new Map<string, T>();
  for (const row of rows) {
    const key = wgoPlayerGameKey(row, source);
    if (mapped.has(key)) {
      throw new WgoIntegrityError(`${source} returned duplicate player/game row ${key}.`);
    }
    mapped.set(key, row);
  }
  return mapped;
}

export function mapWgoRowsByPlayerId<T extends { playerId?: unknown }>(
  rows: T[],
  source: string,
): Map<number, T> {
  const mapped = new Map<number, T>();
  for (const row of rows) {
    const playerId = Number(row.playerId);
    if (!Number.isSafeInteger(playerId) || playerId <= 0) {
      throw new WgoIntegrityError(`${source} returned an invalid playerId.`);
    }
    if (mapped.has(playerId)) {
      throw new WgoIntegrityError(
        `${source} returned duplicate player row ${playerId}.`,
      );
    }
    mapped.set(playerId, row);
  }
  return mapped;
}

type WgoStatsPage<T> = {
  data: T[];
  total: number;
};

async function fetchWgoStatsPage<T>(
  label: string,
  url: string,
): Promise<WgoStatsPage<T>> {
  const response = await Fetch(url);
  const contentType = response.headers?.get("content-type") ?? "";
  if (!response.ok || (contentType && !contentType.includes("application/json"))) {
    throw new Error(
      `NHL stats request failed for ${label}: ${response.status} ${response.statusText}.`,
    );
  }
  const payload = (await response.json()) as Partial<WgoStatsPage<T>>;
  if (!Array.isArray(payload.data) || !Number.isSafeInteger(payload.total) || payload.total! < 0) {
    throw new Error(`NHL stats response for ${label} has an invalid page contract.`);
  }
  return payload as WgoStatsPage<T>;
}

export async function fetchAllWgoStatsPages<T>(options: {
  buildUrl: (start: number) => string;
  concurrency?: number;
  label: string;
  maxPages?: number;
  pageSize?: number;
}): Promise<T[]> {
  const {
    buildUrl,
    label,
    concurrency = 4,
    maxPages = 500,
    pageSize = 100,
  } = options;
  if (!Number.isSafeInteger(pageSize) || pageSize < 1) {
    throw new Error("WGO pageSize must be a positive integer.");
  }
  if (!Number.isSafeInteger(concurrency) || concurrency < 1 || concurrency > 8) {
    throw new Error("WGO concurrency must be between 1 and 8.");
  }

  const first = await fetchWgoStatsPage<T>(label, buildUrl(0));
  const expectedFirstRows = Math.min(pageSize, first.total);
  if (first.data.length !== expectedFirstRows) {
    throw new Error(
      `NHL stats pagination for ${label} returned ${first.data.length}/${expectedFirstRows} rows on its first page.`,
    );
  }
  if (first.total === 0) return [];
  const pageCount = Math.ceil(first.total / pageSize);
  if (pageCount > maxPages) {
    throw new Error(
      `NHL stats response for ${label} requires ${pageCount} pages, exceeding ${maxPages}.`,
    );
  }
  const rows = [...first.data];
  for (let page = 1; page < pageCount; page += concurrency) {
    const pageIndexes = Array.from(
      { length: Math.min(concurrency, pageCount - page) },
      (_, index) => page + index,
    );
    const pages = await Promise.all(
      pageIndexes.map((pageIndex) =>
        fetchWgoStatsPage<T>(label, buildUrl(pageIndex * pageSize)),
      ),
    );
    for (let index = 0; index < pages.length; index++) {
      const pageIndex = pageIndexes[index];
      const expectedRows = Math.min(pageSize, first.total - pageIndex * pageSize);
      if (pages[index].total !== first.total || pages[index].data.length !== expectedRows) {
        throw new Error(
          `NHL stats pagination changed while fetching ${label}; refusing a partial snapshot.`,
        );
      }
      rows.push(...pages[index].data);
    }
  }
  if (rows.length !== first.total) {
    throw new Error(
      `NHL stats pagination for ${label} returned ${rows.length}/${first.total} rows.`,
    );
  }
  return rows;
}

type WgoScheduleGame = {
  gameDate: string;
  gameStateId: number;
  gameType: number;
  id: number;
  season: number;
};

export async function fetchCompletedWgoSeasonGameDates(options: {
  endDate: string;
  seasonId: number;
  startDate: string;
}): Promise<string[]> {
  const { endDate, seasonId, startDate } = options;
  const games = await fetchAllWgoStatsPages<WgoScheduleGame>({
    buildUrl: (start) => {
      const params = new URLSearchParams({
        cayenneExp: `season=${seasonId}`,
        isAggregate: "false",
        isGame: "false",
        limit: "100",
        sort: '[{"property":"gameDate","direction":"ASC"},{"property":"id","direction":"ASC"}]',
        start: String(start),
      });
      return `https://api.nhle.com/stats/rest/en/game?${params}`;
    },
    concurrency: 4,
    label: `NHL games for ${seasonId}`,
    maxPages: 25,
    pageSize: 100,
  });

  const dates = new Set<string>();
  for (const game of games) {
    if (game.season !== seasonId) {
      throw new WgoIntegrityError(
        `NHL game schedule returned season ${game.season} while fetching ${seasonId}.`,
      );
    }
    if (
      game.gameStateId !== 7 ||
      ![2, 3].includes(game.gameType) ||
      game.gameDate < startDate ||
      game.gameDate > endDate
    ) {
      continue;
    }
    resolveWgoGameIdentity({
      row: { gameDate: game.gameDate, gameId: game.id },
      expectedDate: game.gameDate,
      expectedSeasonId: seasonId,
      allowedGameTypes: [game.gameType],
      source: "NHL game schedule",
    });
    dates.add(game.gameDate);
  }
  return [...dates].sort();
}
