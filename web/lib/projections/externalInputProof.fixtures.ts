// Synthetic FORGE run input snapshots for external-input proof tests. Engineering fixtures only.
import { FORGE_EXTERNAL_FANTASY_INPUT_CONTRACT, FORGE_ROLLING_HISTORY_INPUT_CONTRACT } from "./calibrationEligibility";

/** A snapshot row, selected as loadExternalInputProof selects it, that proves `runId` excluded external inputs. */
export function provenSnapshotRow(runId: string) {
  return { provider: "forge", dataset_key: "forge-run-inputs-v1", entity_key: runId, available_at: "2026-10-26T14:00:01.000+00:00", snapshot_version: "forge-inputs-v1",
    snapshot_run_id: runId, rolling_player_history_contract: FORGE_ROLLING_HISTORY_INPUT_CONTRACT,
    external_fantasy_input_contract: FORGE_EXTERNAL_FANTASY_INPUT_CONTRACT as string | null,
    captured_reads: { version: "forge-captured-reads-v1", hash: "a".repeat(64), readCount: 12,
      firstReceivedAt: "2026-10-26T13:59:00.000Z", lastReceivedAt: "2026-10-26T14:00:00.000Z" } as Record<string, unknown> | null };
}

/** The same row as an older, unlabelled run stores it: no exclusion claim. */
export function unprovenSnapshotRow(runId: string) {
  return { ...provenSnapshotRow(runId), external_fantasy_input_contract: null };
}

/** A snapshot-less run's attribution row, selected as loadExternalInputProof selects it: by default a single-invocation
 * succeeded run of the verified production release 538100d41. */
export function verifiedReleaseRunRow(runId: string, overrides: Record<string, unknown> = {}) {
  return { run_id: runId, git_sha: "538100d41ee87e721d2764b694f7bac8c2f2bb34", status: "succeeded", invocations: "1",
    rolling_player_history_contract: FORGE_ROLLING_HISTORY_INPUT_CONTRACT, producer_identity: null as unknown, ...overrides };
}

/** A stamped single-invocation run of a later, unlisted release SHA: admitted only by its stamped closure(s). */
export function stampedRunRow(runId: string, closures: Array<string | null>, overrides: Record<string, unknown> = {}) {
  return verifiedReleaseRunRow(runId, { git_sha: "82490cd4591758f145cbcfeab6137719c84c57e9",
    producer_identity: { version: "forge-producer-closure-v1", invocations: closures, code_versions: closures.map(() => null) },
    ...overrides });
}

/** A client whose snapshot reads return `rows`, and whose `forge_runs` attribution reads return `runRows`, matching the
 * requested run ids. */
export function proofDb(rows: Array<Record<string, unknown>>, runRows: Array<Record<string, unknown>> = []) {
  const reads: Array<{ table: string; columns: string; eq: unknown[][]; ids: string[] }> = [];
  const db = { from(table: string) {
    const read = { table, columns: "", eq: [] as unknown[][], ids: [] as string[] };
    const chain: any = {
      select(columns: string) { read.columns = columns; return chain; },
      eq(...args: unknown[]) { read.eq.push(args); return chain; },
      in(column: string, ids: string[]) {
        read.ids = ids; reads.push(read);
        const source = table === "forge_runs" ? runRows : rows;
        return Promise.resolve({ data: source.filter(row => ids.includes(row[column] as string)), error: null });
      },
    };
    return chain;
  } };
  return { db, reads };
}
