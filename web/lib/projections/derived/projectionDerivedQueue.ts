import { SHIFT_RELATIONSHIP_ALGORITHM_VERSION } from "../relationshipMaterialization";
import { PROJECTION_DERIVED_ALGORITHM_VERSION } from "./projectionDerivedPersistence";

export type ProjectionDerivedQueueRow = {
  game_id: number;
  input_status: string;
  input_fingerprint: string | null;
  relationship_status: string;
  relationship_input_fingerprint: string | null;
  relationship_algorithm_version: string | null;
  derived_status: string;
  derived_input_fingerprint: string | null;
  derived_algorithm_version: string | null;
  games: {
    id: number;
    date: string;
  };
};

function requirePositiveInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || Number(value) <= 0) {
    throw new Error(`Invalid ${field}`);
  }
  return Number(value);
}

function isHash(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function isAlgorithmVersion(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[A-Za-z0-9][A-Za-z0-9._:@/+~-]{0,127}$/.test(value)
  );
}

export function selectPendingProjectionDerivedDates(args: {
  rows: readonly ProjectionDerivedQueueRow[];
  maxDates: number;
}): string[] {
  if (!Number.isSafeInteger(args.maxDates) || args.maxDates <= 0) {
    throw new Error("Invalid projection derived queue bound");
  }

  const seenGameIds = new Set<number>();
  const pending = args.rows.flatMap((row) => {
    const gameId = requirePositiveInteger(row.game_id, "derived queue game ID");
    if (
      seenGameIds.has(gameId) ||
      row.games == null ||
      requirePositiveInteger(row.games.id, "derived queue schedule game ID") !==
        gameId ||
      typeof row.games.date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(row.games.date) ||
      row.input_status !== "complete" ||
      !isHash(row.input_fingerprint) ||
      !["pending", "complete"].includes(row.relationship_status) ||
      !["pending", "complete"].includes(row.derived_status) ||
      (row.relationship_input_fingerprint != null &&
        !isHash(row.relationship_input_fingerprint)) ||
      (row.derived_input_fingerprint != null &&
        !isHash(row.derived_input_fingerprint)) ||
      (row.relationship_algorithm_version != null &&
        !isAlgorithmVersion(row.relationship_algorithm_version)) ||
      (row.derived_algorithm_version != null &&
        !isAlgorithmVersion(row.derived_algorithm_version))
    ) {
      throw new Error(
        `Invalid projection derived queue row for game ${gameId}`,
      );
    }
    seenGameIds.add(gameId);

    const relationshipCurrent =
      row.relationship_status === "complete" &&
      row.relationship_input_fingerprint === row.input_fingerprint &&
      row.relationship_algorithm_version ===
        SHIFT_RELATIONSHIP_ALGORITHM_VERSION;
    const derivedCurrent =
      row.derived_status === "complete" &&
      row.derived_input_fingerprint === row.input_fingerprint &&
      row.derived_algorithm_version === PROJECTION_DERIVED_ALGORITHM_VERSION;

    return relationshipCurrent && !derivedCurrent
      ? [{ gameId, date: row.games.date }]
      : [];
  });

  const dates: string[] = [];
  for (const row of pending.sort((left, right) =>
    left.date === right.date
      ? left.gameId - right.gameId
      : left.date.localeCompare(right.date),
  )) {
    if (dates[dates.length - 1] !== row.date) dates.push(row.date);
    if (dates.length === args.maxDates) break;
  }
  return dates;
}
