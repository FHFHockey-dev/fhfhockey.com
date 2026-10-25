import { fetchCachedJson } from "./clientFetchCache";

type OwnershipSnapshotApiRow = {
  playerId: number;
  ownership: number | null;
  observedOn?: string | null;
  unavailableReason?: "ambiguous_identity";
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

type PlayerOwnershipSnapshot = {
  ownership: number | null;
  unavailableReason?: "ambiguous_identity";
  ownershipEvidence: {
    value: number;
    observedOn: string | null;
    provider: "yahoo";
    status: "fresh" | "stale" | "unknown";
  } | null;
};

export type PlayerOwnershipTrend = PlayerOwnershipSnapshot & {
  delta: number | null;
  sparkline: OwnershipTrendApiPoint[];
};

export type PlayerOwnershipContext = PlayerOwnershipTrend;

const observationDate = (value: unknown): string | null => typeof value === "string"
  && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value))
  && new Date(value).toISOString().slice(0, 10) === value ? value : null;

function ownershipSnapshot(value: unknown, date: unknown): PlayerOwnershipSnapshot {
  const numeric = typeof value === "string" && /^\d+(\.\d+)?$/.test(value) ? Number(value)
    : typeof value === "number" ? value : NaN;
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > 100) return { ownership: null, ownershipEvidence: null };
  const observedOn = observationDate(date);
  const age = observedOn === null ? NaN : Date.now() - Date.parse(`${observedOn}T00:00:00Z`);
  const status = !Number.isFinite(age) || age < 0 ? "unknown" : age <= 3 * 86400000 ? "fresh" : "stale";
  return { ownership: status === "fresh" ? numeric : null, ownershipEvidence: { value: numeric, observedOn, provider: "yahoo", status } };
}

const requestedPlayerIds = (playerIds: number[]): number[] => {
  const ids = Array.from(new Set(playerIds.filter(id => Number.isSafeInteger(id) && id > 0)));
  if (ids.length > 500) throw new Error("Request ownership for at most 500 players.");
  return ids;
};

export const deriveYahooSeason = (date: string): number => {
  const [yearString, monthString] = date.split("-");
  const year = Number(yearString);
  const month = Number(monthString);

  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return new Date().getUTCFullYear();
  }

  // Yahoo rows store the season by its starting calendar year (for example,
  // March 2026 belongs to the 2025 NHL/Yahoo season).
  return month >= 8 ? year : year - 1;
};

const fetchOwnershipSnapshots = async (
  playerIds: number[],
  date: string
): Promise<Record<number, PlayerOwnershipSnapshot>> => {
  const uniqueIds = requestedPlayerIds(playerIds);

  if (uniqueIds.length === 0) return {};

  const params = new URLSearchParams({
    playerIds: uniqueIds.join(","),
    season: String(deriveYahooSeason(date))
  });

  const response = await fetchCachedJson<OwnershipSnapshotApiResponse>(
    `/api/v1/transactions/ownership-snapshots?${params.toString()}`,
    { ttlMs: 5 * 60_000, init: { cache: "no-store" } }
  );

  if (response?.success !== true || !Array.isArray(response.players)) throw new Error("Ownership is unavailable.");
  const result: Record<number, PlayerOwnershipSnapshot> = Object.fromEntries(uniqueIds.map(id => [id, ownershipSnapshot(null, null)]));
  const seen = new Set<number>();
  for (const row of response.players) {
    if (!uniqueIds.includes(row?.playerId)) continue;
    result[row.playerId] = seen.has(row.playerId) || row.unavailableReason === "ambiguous_identity"
      ? { ...ownershipSnapshot(null, null), unavailableReason: "ambiguous_identity" }
      : ownershipSnapshot(row.ownership, row.observedOn);
    seen.add(row.playerId);
  }
  return result;
};

/** Numeric callers receive only current observations; dated last-known evidence is retained by the context helper. */
export const fetchOwnershipSnapshotMap = async (
  playerIds: number[],
  date: string
): Promise<Record<number, number | null>> => {
  const snapshots = await fetchOwnershipSnapshots(playerIds, date);
  return Object.fromEntries(Object.entries(snapshots).map(([id, snapshot]) => [id, snapshot.ownership]));
};

export const fetchOwnershipTrendMap = async (
  playerIds: number[],
  date: string,
  windowDays = 5
): Promise<Record<number, PlayerOwnershipTrend>> => {
  const uniqueIds = requestedPlayerIds(playerIds);

  if (uniqueIds.length === 0) return {};

  const params = new URLSearchParams({
    playerIds: uniqueIds.join(","),
    season: String(deriveYahooSeason(date)),
    window: String(windowDays),
    includeFlat: "1"
  });

  const response = await fetchCachedJson<OwnershipTrendApiResponse>(
    `/api/v1/transactions/ownership-trends?${params.toString()}`,
    { ttlMs: 5 * 60_000, init: { cache: "no-store" } }
  );

  if (response?.success !== true || !Array.isArray(response.selectedPlayers)) throw new Error("Ownership is unavailable.");
  const selectedPlayers = response.selectedPlayers;
  const seen = new Set<number>();

  return selectedPlayers.reduce<Record<number, PlayerOwnershipTrend>>(
    (acc, row) => {
      if (row?.playerId === null || !uniqueIds.includes(row?.playerId)) {
        return acc;
      }
      const sparkline = (Array.isArray(row.sparkline) ? row.sparkline : []).filter(point => observationDate(point?.date)
        && typeof point?.value === "number" && Number.isFinite(point.value) && point.value >= 0 && point.value <= 100)
        .sort((a, b) => a.date.localeCompare(b.date));
      const latest = sparkline[sparkline.length - 1];
      const snapshot = seen.has(row.playerId) ? ownershipSnapshot(null, null)
        : ownershipSnapshot(row.latest, latest && latest.value === row.latest ? latest.date : null);
      seen.add(row.playerId);
      acc[row.playerId] = {
        ...snapshot,
        delta:
          snapshot.ownership !== null && typeof row.delta === "number" && Number.isFinite(row.delta)
            ? row.delta
            : null,
        sparkline
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
    fetchOwnershipSnapshots(playerIds, date),
    fetchOwnershipTrendMap(playerIds, date, windowDays)
  ]);

  const uniqueIds = requestedPlayerIds(playerIds);

  return uniqueIds.reduce<Record<number, PlayerOwnershipContext>>((acc, playerId) => {
    const snapshot = snapshotMap[playerId];
    const trend = trendMap[playerId];
    if (snapshot?.unavailableReason === "ambiguous_identity") {
      acc[playerId] = { ...snapshot, delta: null, sparkline: [] };
      return acc;
    }
    const snapshotEvidence = snapshot?.ownershipEvidence, trendEvidence = trend?.ownershipEvidence;
    const useTrend = trendEvidence && (!snapshotEvidence || (trendEvidence.status !== "unknown"
      && (snapshotEvidence.status === "unknown" || trendEvidence.observedOn! > snapshotEvidence.observedOn!
        || (trendEvidence.observedOn === snapshotEvidence.observedOn && trendEvidence.value === snapshotEvidence.value))));
    const selected = useTrend ? trend : snapshot;
    acc[playerId] = {
      ownership: selected?.ownership ?? null,
      ownershipEvidence: selected?.ownershipEvidence ?? null,
      delta: useTrend ? trend.delta : null,
      sparkline: trend?.sparkline ?? []
    };
    return acc;
  }, {});
};
