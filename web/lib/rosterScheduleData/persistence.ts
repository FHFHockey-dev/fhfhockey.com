import { ROSTER_SCHEDULE_UPSERT_CONFLICT } from "./constants";
import type { RosterOptimizerTeamGameUpsert } from "./types";

type WriteError = { code?: string; details?: string; message: string };
type WriteResult = { error: WriteError | null };
type WriteBuilder = PromiseLike<WriteResult>;
export type ScheduleWriteClient = {
  from(table: string): {
    upsert(
      rows: readonly RosterOptimizerTeamGameUpsert[],
      options: { onConflict: string },
    ): WriteBuilder;
  };
};

type DeleteBuilder = {
  in(column: string, values: readonly number[]): PromiseLike<WriteResult>;
};
export type ScheduleDeleteClient = {
  from(table: string): {
    delete(): DeleteBuilder;
  };
};

export type ExistingRosterScheduleRow = Pick<
  RosterOptimizerTeamGameUpsert,
  | "game_key"
  | "game_status"
  | "is_countable"
  | "mapping_status"
  | "schedule_status"
  | "source_game_id"
  | "team_id"
  | "game_date"
  | "week"
>;

export type PersistedRosterScheduleRow = ExistingRosterScheduleRow & {
  id: number;
};

export type RosterScheduleChangeSummary = {
  newRows: number;
  rescheduledRows: number;
  rescheduledSourceGameIds: readonly number[];
  statusChangedRows: number;
  unchangedRows: number;
};

function identity(row: ExistingRosterScheduleRow): string {
  return `${row.game_key}|${row.source_game_id}|${row.team_id}`;
}

export function summarizeRosterScheduleChanges(args: {
  existing: readonly ExistingRosterScheduleRow[];
  incoming: readonly RosterOptimizerTeamGameUpsert[];
}): RosterScheduleChangeSummary {
  const existingByIdentity = new Map(
    args.existing.map((row) => [identity(row), row]),
  );
  const rescheduledSourceGameIds = new Set<number>();
  let newRows = 0;
  let rescheduledRows = 0;
  let statusChangedRows = 0;
  let unchangedRows = 0;

  for (const incoming of args.incoming) {
    const existing = existingByIdentity.get(identity(incoming));
    if (!existing) {
      newRows += 1;
      continue;
    }
    if (existing.game_date !== incoming.game_date) {
      rescheduledRows += 1;
      rescheduledSourceGameIds.add(incoming.source_game_id);
      continue;
    }
    if (
      existing.game_status !== incoming.game_status ||
      existing.schedule_status !== incoming.schedule_status ||
      existing.mapping_status !== incoming.mapping_status ||
      existing.is_countable !== incoming.is_countable ||
      existing.week !== incoming.week
    ) {
      statusChangedRows += 1;
      continue;
    }
    unchangedRows += 1;
  }

  return {
    newRows,
    rescheduledRows,
    rescheduledSourceGameIds: [...rescheduledSourceGameIds].sort(
      (left, right) => left - right,
    ),
    statusChangedRows,
    unchangedRows,
  };
}

export function findStaleRosterScheduleRowIds(args: {
  existing: readonly PersistedRosterScheduleRow[];
  incoming: readonly RosterOptimizerTeamGameUpsert[];
}): number[] {
  const incomingIdentities = new Set(args.incoming.map(identity));
  return args.existing
    .filter((row) => !incomingIdentities.has(identity(row)))
    .map((row) => row.id)
    .sort((left, right) => left - right);
}

export async function upsertRosterScheduleRows(args: {
  client: ScheduleWriteClient;
  rows: readonly RosterOptimizerTeamGameUpsert[];
  chunkSize?: number;
}): Promise<number> {
  const chunkSize = args.chunkSize ?? 500;
  if (!Number.isSafeInteger(chunkSize) || chunkSize < 1 || chunkSize > 1_000) {
    throw new Error("chunkSize must be an integer between 1 and 1000.");
  }

  let rowsUpserted = 0;
  for (let index = 0; index < args.rows.length; index += chunkSize) {
    const chunk = args.rows.slice(index, index + chunkSize);
    const { error } = await args.client
      .from("roster_optimizer_team_games")
      .upsert(chunk, { onConflict: ROSTER_SCHEDULE_UPSERT_CONFLICT });
    if (error) throw error;
    rowsUpserted += chunk.length;
  }
  return rowsUpserted;
}

export async function deleteRosterScheduleRows(args: {
  client: ScheduleDeleteClient;
  rowIds: readonly number[];
  chunkSize?: number;
}): Promise<number> {
  const chunkSize = args.chunkSize ?? 500;
  if (!Number.isSafeInteger(chunkSize) || chunkSize < 1 || chunkSize > 1_000) {
    throw new Error("chunkSize must be an integer between 1 and 1000.");
  }

  let rowsDeleted = 0;
  for (let index = 0; index < args.rowIds.length; index += chunkSize) {
    const chunk = args.rowIds.slice(index, index + chunkSize);
    const { error } = await args.client
      .from("roster_optimizer_team_games")
      .delete()
      .in("id", chunk);
    if (error) throw error;
    rowsDeleted += chunk.length;
  }
  return rowsDeleted;
}
