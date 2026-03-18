import { fetchCachedJson } from "./clientFetchCache";

type OwnershipSnapshotApiRow = {
  playerId: number;
  ownership: number | null;
};

type OwnershipTrendApiPoint = {
  date: string;
  value: number;
};

type OwnershipTrendApiRow = {
  playerId: number | null;
  latest: number;
  delta: number;
  sparkline: OwnershipTrendApiPoint[];
};

type OwnershipSnapshotApiResponse = {
  success?: boolean;
  players?: OwnershipSnapshotApiRow[];
};

type OwnershipTrendApiResponse = {
  success?: boolean;
  selectedPlayers?: OwnershipTrendApiRow[];
};

export type PlayerOwnershipTrend = {
  ownership: number | null;
  delta: number | null;
  sparkline: OwnershipTrendApiPoint[];
};

export type PlayerOwnershipContext = {
  ownership: number | null;
  delta: number | null;
  sparkline: OwnershipTrendApiPoint[];
};

export const deriveYahooSeason = (date: string): number => {
  const [yearString, monthString] = date.split("-");
  const year = Number(yearString);
  const month = Number(monthString);

  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return new Date().getUTCFullYear();
  }

  return month >= 8 ? year + 1 : year;
};

export const fetchOwnershipSnapshotMap = async (
  playerIds: number[],
  date: string
): Promise<Record<number, number | null>> => {
  const uniqueIds = Array.from(
    new Set(playerIds.filter((playerId) => Number.isFinite(playerId)))
  );

  if (uniqueIds.length === 0) return {};

  const params = new URLSearchParams({
    playerIds: uniqueIds.join(","),
    season: String(deriveYahooSeason(date))
  });

  const response = await fetchCachedJson<OwnershipSnapshotApiResponse>(
    `/api/v1/transactions/ownership-snapshots?${params.toString()}`,
    { ttlMs: 5 * 60_000 }
  );

  const players = Array.isArray(response?.players) ? response.players : [];

  return players.reduce<Record<number, number | null>>((acc, row) => {
    if (typeof row?.playerId !== "number" || Number.isNaN(row.playerId)) {
      return acc;
    }
    acc[row.playerId] =
      typeof row.ownership === "number" && Number.isFinite(row.ownership)
        ? row.ownership
        : null;
    return acc;
  }, {});
};

export const fetchOwnershipTrendMap = async (
  playerIds: number[],
  date: string,
  windowDays = 5
): Promise<Record<number, PlayerOwnershipTrend>> => {
  const uniqueIds = Array.from(
    new Set(playerIds.filter((playerId) => Number.isFinite(playerId)))
  );

  if (uniqueIds.length === 0) return {};

  const params = new URLSearchParams({
    playerIds: uniqueIds.join(","),
    season: String(deriveYahooSeason(date)),
    window: String(windowDays),
    includeFlat: "1"
  });

  const response = await fetchCachedJson<OwnershipTrendApiResponse>(
    `/api/v1/transactions/ownership-trends?${params.toString()}`,
    { ttlMs: 5 * 60_000 }
  );

  const selectedPlayers = Array.isArray(response?.selectedPlayers)
    ? response.selectedPlayers
    : [];

  return selectedPlayers.reduce<Record<number, PlayerOwnershipTrend>>(
    (acc, row) => {
      if (typeof row?.playerId !== "number" || Number.isNaN(row.playerId)) {
        return acc;
      }

      acc[row.playerId] = {
        ownership:
          typeof row.latest === "number" && Number.isFinite(row.latest)
            ? row.latest
            : null,
        delta:
          typeof row.delta === "number" && Number.isFinite(row.delta)
            ? row.delta
            : null,
        sparkline: Array.isArray(row.sparkline) ? row.sparkline : []
      };
      return acc;
    },
    {}
  );
};

export const fetchOwnershipContextMap = async (
  playerIds: number[],
  date: string,
  windowDays = 5
): Promise<Record<number, PlayerOwnershipContext>> => {
  const [snapshotMap, trendMap] = await Promise.all([
    fetchOwnershipSnapshotMap(playerIds, date),
    fetchOwnershipTrendMap(playerIds, date, windowDays)
  ]);

  const uniqueIds = Array.from(
    new Set(playerIds.filter((playerId) => Number.isFinite(playerId)))
  );

  return uniqueIds.reduce<Record<number, PlayerOwnershipContext>>((acc, playerId) => {
    const snapshot = snapshotMap[playerId];
    const trend = trendMap[playerId];
    acc[playerId] = {
      ownership: trend?.ownership ?? snapshot ?? null,
      delta: trend?.delta ?? null,
      sparkline: trend?.sparkline ?? []
    };
    return acc;
  }, {});
};
