export type FirstArrivalCandidate<T> = {
  value: T;
  captureKey: string;
  sourceKey: string;
  tweetId: string | null;
  snapshotDate: string;
  teamId: number | null;
  teamAbbreviation: string | null;
  gameId: number | null;
  signalType: string | null;
  signalSubtype?: string | null;
  tweetPostedAt: string | null;
  observedAt: string | null;
  status: string;
  nhlFilterStatus: string;
};

export type FirstArrivalBucket<T> = {
  bucketKey: string;
  winner: FirstArrivalCandidate<T>;
  nonWinners: FirstArrivalCandidate<T>[];
};

function normalizedBucketPart(
  value: string | null | undefined,
  fallback: string,
) {
  const normalized = value?.trim().toLowerCase().replace(/\s+/g, "_");
  return normalized || fallback;
}

function parseTimestamp(value: string | null): number | null {
  const timestamp = Date.parse(value ?? "");
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function getFirstArrivalTimestamp<T>(
  candidate: FirstArrivalCandidate<T>,
): number | null {
  return (
    parseTimestamp(candidate.tweetPostedAt) ??
    parseTimestamp(candidate.observedAt)
  );
}

export function buildFirstArrivalBucketKey<T>(
  candidate: FirstArrivalCandidate<T>,
): string {
  const teamKey =
    candidate.teamId != null
      ? `team:${candidate.teamId}`
      : `team:${normalizedBucketPart(candidate.teamAbbreviation, "unknown")}`;
  const gameKey =
    candidate.gameId != null ? `game:${candidate.gameId}` : "game:none";
  const signalKey = normalizedBucketPart(candidate.signalType, "other");
  const subtypeKey = normalizedBucketPart(candidate.signalSubtype, "none");

  return [candidate.snapshotDate, teamKey, gameKey, signalKey, subtypeKey].join(
    "|",
  );
}

export function compareFirstArrivalCandidates<T>(
  left: FirstArrivalCandidate<T>,
  right: FirstArrivalCandidate<T>,
): number {
  const leftTimestamp =
    getFirstArrivalTimestamp(left) ?? Number.POSITIVE_INFINITY;
  const rightTimestamp =
    getFirstArrivalTimestamp(right) ?? Number.POSITIVE_INFINITY;
  if (leftTimestamp !== rightTimestamp) return leftTimestamp - rightTimestamp;

  return (
    left.sourceKey.localeCompare(right.sourceKey) ||
    (left.tweetId ?? "").localeCompare(right.tweetId ?? "") ||
    left.captureKey.localeCompare(right.captureKey)
  );
}

export function selectFirstArrivalBuckets<T>(
  candidates: FirstArrivalCandidate<T>[],
): FirstArrivalBucket<T>[] {
  const grouped = new Map<string, FirstArrivalCandidate<T>[]>();

  for (const candidate of candidates) {
    if (
      candidate.status !== "observed" ||
      candidate.nhlFilterStatus !== "accepted"
    ) {
      continue;
    }
    const bucketKey = buildFirstArrivalBucketKey(candidate);
    const bucket = grouped.get(bucketKey) ?? [];
    bucket.push(candidate);
    grouped.set(bucketKey, bucket);
  }

  return Array.from(grouped.entries())
    .map(([bucketKey, bucket]) => {
      const ordered = [...bucket].sort(compareFirstArrivalCandidates);
      return {
        bucketKey,
        winner: ordered[0],
        nonWinners: ordered.slice(1),
      };
    })
    .sort((left, right) => {
      const leftTimestamp = getFirstArrivalTimestamp(left.winner) ?? 0;
      const rightTimestamp = getFirstArrivalTimestamp(right.winner) ?? 0;
      return (
        rightTimestamp - leftTimestamp ||
        left.bucketKey.localeCompare(right.bucketKey)
      );
    });
}
