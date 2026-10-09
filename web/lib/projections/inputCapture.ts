import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
import { installProjectionQueryInterceptor } from "./queryCaptureHook";

type Operation = { method: string; args: unknown[] };
installProjectionQueryInterceptor(interceptProjectionQuery);
type ControlledNewsReads = Partial<Record<"player_forecast_lineup_snapshots" | "player_forecast_goalie_start_observations" | "player_forecast_observation_conflicts"
  | "player_forecast_lineup_assignments" | "player_forecast_conflict_resolutions", unknown>>;
export type ProjectionInputRead = {
  request: Operation[];
  result: unknown;
  receivedAt: string;
  failure?: string;
};
type Capture = {
  mode: "capture" | "replay";
  reads: ProjectionInputRead[];
  writes: Operation[][];
  consumed: Set<number>;
  deadlineMs?: number;
  suppressWrites?: boolean;
  controlledNewsReads?: ControlledNewsReads;
};

const storage = new AsyncLocalStorage<Capture>();
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, nested]) => [key, canonical(nested)]));
  }
  return value;
}
export function projectionInputHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}

export type ForgeCapturedReadReceipt = {
  version: "forge-captured-reads-v1";
  hash: string;
  readCount: number;
  firstReceivedAt: string;
  lastReceivedAt: string;
};

/** Binds issued provenance to the actual retained query/results, without exposing them publicly. */
export function capturedReadReceipt(reads: ProjectionInputRead[]): ForgeCapturedReadReceipt {
  if (!reads.length || reads.some(read => !Number.isFinite(Date.parse(read.receivedAt)))) {
    throw new Error("Captured input receipt requires timestamped reads.");
  }
  const times = reads.map(read => Date.parse(read.receivedAt)).sort((a, b) => a - b);
  return { version: "forge-captured-reads-v1", hash: projectionInputHash(reads), readCount: reads.length,
    firstReceivedAt: new Date(times[0]).toISOString(), lastReceivedAt: new Date(times[times.length - 1]).toISOString() };
}

export async function captureProjectionInputs<T>(work: () => Promise<T>, options?: { deadlineMs?: number; suppressWrites?: boolean; controlledNewsReads?: ControlledNewsReads }) {
  if (options?.controlledNewsReads && !options.suppressWrites) throw new Error("Controlled news requires read-only reconstruction");
  const context: Capture = { mode: "capture", reads: [], writes: [], consumed: new Set(), ...options };
  const result = await storage.run(context, work);
  return { result, reads: context.reads, writes: context.writes };
}

export async function replayProjectionInputs<T>(reads: ProjectionInputRead[], work: () => Promise<T>) {
  const context: Capture = { mode: "replay", reads: clone(reads), writes: [], consumed: new Set() };
  const result = await storage.run(context, work);
  if (context.consumed.size !== reads.length) {
    throw new Error("Projection replay did not consume every captured input; model/query version mismatch.");
  }
  return { result, writes: context.writes };
}

/** Only active inside a projection run. Replay never constructs a live DB client. */
export function interceptProjectionQuery(
  method: "from" | "rpc",
  args: unknown[],
  live: () => any,
): any | undefined {
  const context = storage.getStore();
  if (!context) return undefined;
  const operations: Operation[] = [{ method, args: clone(args) }];
  let pending: Promise<any> | undefined;
  const execute = () => pending ??= (async () => {
    const request = clone(operations);
    const mutation = operations.some((op) => ["insert", "upsert", "update", "delete"].includes(op.method));
    if (mutation) context.writes.push(request);
    if (context.suppressWrites) {
      // RPC names cannot establish whether a function mutates data. Reconstruction
      // permits table/view reads only and never creates the live mutation builder.
      if (method === "rpc") throw new Error("RPC is not allowed during read-only FORGE reconstruction");
      if (mutation) return { data: null, error: null };
      const table = String(args[0]) as keyof ControlledNewsReads;
      if (Object.prototype.hasOwnProperty.call(context.controlledNewsReads ?? {}, table)) {
        let data = clone(context.controlledNewsReads![table]) as Array<Record<string, any>>;
        if (!Array.isArray(data)) throw new Error("Controlled news must contain rows");
        let range: unknown[] | undefined, counted = false;
        for (const operation of operations.slice(1)) {
          const [column, value] = operation.args as [string, any];
          if (operation.method === "select") counted = value?.count === "exact";
          else if (operation.method === "in") data = data.filter(row => value.includes(row[column]));
          else if (operation.method === "eq") data = data.filter(row => row[column] === value);
          else if (operation.method === "lte") data = data.filter(row => column.endsWith("_at")
            ? Date.parse(row[column]) <= Date.parse(value) : row[column] <= value);
          else if (operation.method === "order" && column === "id") data.sort((a, b) => String(a.id).localeCompare(String(b.id)));
          else if (operation.method === "range") range = operation.args;
          else throw new Error(`Unsupported controlled news query: ${operation.method}`);
        }
        const count = data.length;
        if (range) data = data.slice(Number(range[0]), Number(range[1]) + 1);
        const result = { data, error: null, ...(counted ? { count } : {}) };
        context.reads.push({ request, result: clone(result), receivedAt: new Date().toISOString() });
        return result;
      }
    }
    if (context.mode === "replay") {
      if (mutation) return { data: null, error: null };
      const hash = projectionInputHash(request);
      const index = context.reads.findIndex((read, i) =>
        !context.consumed.has(i) && projectionInputHash(read.request) === hash);
      if (index < 0) throw new Error(`Unrecorded projection input: ${method} ${String(args[0])}`);
      context.consumed.add(index);
      if (context.reads[index].failure) throw new Error(context.reads[index].failure);
      return clone(context.reads[index].result);
    }
    let query = live();
    for (const op of operations.slice(1)) query = query[op.method](...op.args);
    let timeout: ReturnType<typeof setTimeout> | undefined;
    if (!mutation && Number.isFinite(context.deadlineMs) && typeof query.abortSignal === "function") {
      const controller = new AbortController();
      const remaining = Math.max(0, context.deadlineMs! - Date.now());
      if (remaining === 0) controller.abort();
      else timeout = setTimeout(() => controller.abort(), remaining);
      query = query.abortSignal(controller.signal);
    }
    let result: any;
    try {
      result = await query;
    } catch (error) {
      if (!mutation) context.reads.push({ request, result: null, receivedAt: new Date().toISOString(),
        failure: error instanceof Error ? error.message : String(error) });
      throw error;
    } finally {
      if (timeout) clearTimeout(timeout);
    }
    if (!mutation) context.reads.push({ request, result: clone(result), receivedAt: new Date().toISOString() });
    return result;
  })();
  const proxy: any = new Proxy({}, {
    get(_target, property) {
      if (property === "then") return (resolve: any, reject: any) => execute().then(resolve, reject);
      if (property === "catch") return (reject: any) => execute().catch(reject);
      if (property === "finally") return (callback: any) => execute().finally(callback);
      return (...values: unknown[]) => {
        if (pending) throw new Error("Cannot change an executed projection query.");
        operations.push({ method: String(property), args: clone(values) });
        return proxy;
      };
    },
  });
  return proxy;
}
