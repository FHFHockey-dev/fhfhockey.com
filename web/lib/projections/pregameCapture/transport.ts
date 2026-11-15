import { parseInstantMicros } from "./time";

/**
 * Strict input transport for the private pregame capture. Independent of the readers: it bounds
 * what may be read (relations, RPCs, methods, filters), how much (calls, rows, bytes, time) and
 * refuses — never fakes — writes, unknown RPCs, target-game results and rows stamped after their read.
 * Two layers: the query-builder chain is validated before execution, and the HTTP fetch the capture
 * client uses admits only GET/HEAD to allowlisted PostgREST paths (PostgREST runs GET read-only).
 */

export class CaptureRefused extends Error {
  constructor(readonly code: string, detail?: string) {
    super(detail ? `capture_refused:${code}:${detail}` : `capture_refused:${code}`);
    this.name = "CaptureRefused";
  }
}

/** The writer's audited input sources (FORGE_AUDITED_INPUT_SOURCES) minus its write targets and RPC names. */
export const CAPTURE_RELATIONS: ReadonlySet<string> = new Set([
  "games", "teams", "players", "rosters", "seasons", "fhfh_player_identities", "roster_optimizer_team_games",
  "skatersGameStats", "goaliesGameStats", "wgo_skater_stats", "wgo_goalie_stats", "wgo_team_stats",
  "pbp_games", "pbp_plays", "shift_charts", "nhl_api_shift_rows", "lineCombinations", "expected_goals",
  "forge_goalie_game", "forge_team_game_strength", "rolling_player_game_metrics", "rolling_player_metric_support_payloads",
  "player_stats_unified", "sustainability_trend_bands", "nst_team_all", "nst_team_stats", "nhl_team_data",
  "nhl_xg_team_rolling_aggregates", "goalie_start_projections", "forge_roster_events", "forge_board_news_events",
  "player_forecast_lineup_snapshots", "player_forecast_goalie_start_observations", "player_forecast_observation_conflicts",
  "player_forecast_lineup_assignments", "player_forecast_conflict_resolutions", "market_prices_daily",
  "prop_market_prices_daily", "nhl_xg_model_registry",
]);

/** TJ-approved 2026-11-15: exactly these two STABLE, SECURITY INVOKER RPCs, by GET only. */
export const CAPTURE_RPCS: ReadonlySet<string> = new Set(["forge_latest_rolling_rows", "forge_league_skater_physical_totals"]);

/** Relations whose rows are game results. A row for the target game means it is no longer pregame. */
export const RESULT_RELATIONS: ReadonlySet<string> = new Set([
  "pbp_plays", "shift_charts", "nhl_api_shift_rows", "skatersGameStats", "goaliesGameStats", "wgo_skater_stats",
  "wgo_goalie_stats", "wgo_team_stats", "forge_goalie_game", "forge_team_game_strength", "expected_goals",
  "rolling_player_game_metrics", "player_stats_unified", "lineCombinations", "nst_team_all", "nst_team_stats",
]);
const GAME_COLUMNS = ["game_id", "gameid", "gameId"];
const DATE_COLUMNS = ["date", "game_date", "gameDate"];
const TEAM_COLUMNS = ["team_id", "teamId", "team_abbreviation", "team_abbrev", "teamAbbrev", "team"];
const AVAILABILITY_COLUMNS = ["created_at", "available_at", "observed_at", "inserted_at", "fetched_at", "updated_at", "captured_at", "detected_at", "resolved_at"];

const FILTER_METHODS = new Set(["eq", "neq", "in", "is", "lt", "lte", "gt", "gte", "like", "ilike", "not", "or", "filter", "match", "contains", "containedBy"]);
const SHAPE_METHODS = new Set(["select", "order", "range", "limit", "single", "maybeSingle", "abortSignal", "returns", "overrideTypes"]);
const MUTATIONS = new Set(["insert", "upsert", "update", "delete"]);
const UNFILTERED_OK: ReadonlySet<string> = new Set(["seasons", "teams", "nhl_xg_model_registry"]);

export interface CaptureTarget {
  gameId: number; slateDate: string;
  homeTeamId: number; awayTeamId: number; homeAbbrev: string; awayAbbrev: string;
}
export interface TransportBudget {
  maxCalls: number; maxRows: number; maxBytes: number; maxResponseBytes: number;
  /** Absolute epoch ms. */
  deadlineMs: number;
  /** Tolerance for row availability stamps versus the local receive clock. */
  stampToleranceMs: number;
}
export const DEFAULT_TRANSPORT_BUDGET: Omit<TransportBudget, "deadlineMs"> = {
  maxCalls: 2_000, maxRows: 1_500_000, maxBytes: 192 * 1024 * 1024, maxResponseBytes: 32 * 1024 * 1024, stampToleranceMs: 5_000,
};
export interface TransportUsage { calls: number; httpCalls: number; rows: number; bytes: number; refusals: string[] }

type Operation = { method: string; args: unknown[] };

export interface CaptureTransport {
  readonly usage: TransportUsage;
  readonly target: CaptureTarget;
  /** Throws CaptureRefused before any network work. */
  validate(method: "from" | "rpc", operations: Operation[]): void;
  /** Starts the query on the bounded capture client. */
  start(method: "from" | "rpc", args: unknown[]): any;
  /** Throws CaptureRefused for result rows that may not be captured. */
  inspect(method: "from" | "rpc", operations: Operation[], result: unknown, receivedAt: string): void;
  readonly fetch: typeof fetch;
}

export interface CaptureClientFactory {
  (fetchImpl: typeof fetch): { from(relation: string): any; rpc(name: string, params?: unknown, options?: unknown): any };
}

export function createCaptureTransport(options: {
  target: CaptureTarget; budget: TransportBudget; restBaseUrl: string; createClient: CaptureClientFactory;
  fetchImpl?: typeof fetch; now?: () => number;
}): CaptureTransport {
  const { target, budget } = options;
  const now = options.now ?? Date.now;
  const fetchImpl = options.fetchImpl ?? fetch;
  const base = new URL(options.restBaseUrl.endsWith("/") ? options.restBaseUrl : `${options.restBaseUrl}/`);
  const usage: TransportUsage = { calls: 0, httpCalls: 0, rows: 0, bytes: 0, refusals: [] };
  const refuse = (code: string, detail?: string): never => {
    usage.refusals.push(detail ? `${code}:${detail}` : code);
    throw new CaptureRefused(code, detail);
  };

  const guardedFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : undefined;
    const method = String(init?.method ?? request?.method ?? "GET").toUpperCase();
    if (method !== "GET" && method !== "HEAD") refuse("http_method", method);
    const url = new URL(typeof input === "string" || input instanceof URL ? input.toString() : input.url);
    if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) refuse("http_path", url.pathname);
    const rest = decodeURIComponent(url.pathname.slice(base.pathname.length)).replace(/\/+$/, "");
    const [head, name, ...extra] = rest.split("/");
    if (extra.length) refuse("http_path", rest);
    if (head === "rpc") { if (!name || !CAPTURE_RPCS.has(name)) refuse("http_rpc", name); }
    else if (name !== undefined || !CAPTURE_RELATIONS.has(head)) refuse("http_relation", head);
    if (++usage.httpCalls > budget.maxCalls) refuse("call_budget");
    const remaining = budget.deadlineMs - now();
    if (remaining <= 0) refuse("deadline");
    // supabase-js converts a thrown fetch error into an { error } result, so every refusal here is also
    // recorded in usage.refusals; the runner fails any capture with a recorded refusal.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new CaptureRefused("deadline")), remaining);
    const forward = () => controller.abort(init?.signal?.reason);
    if (init?.signal?.aborted) forward(); else init?.signal?.addEventListener("abort", forward, { once: true });
    let response: Response, body: Uint8Array;
    try {
      response = await fetchImpl(url, { ...init, method, signal: controller.signal });
      body = await readCapped(response, budget.maxResponseBytes, refuse);
    } finally {
      clearTimeout(timer);
      init?.signal?.removeEventListener("abort", forward);
    }
    usage.bytes += body.byteLength;
    if (usage.bytes > budget.maxBytes) refuse("byte_budget");
    return new Response(method === "HEAD" ? null : body, { status: response.status, statusText: response.statusText, headers: response.headers });
  }) as typeof fetch;

  const client = options.createClient(guardedFetch);

  return {
    usage, target, fetch: guardedFetch,
    validate(method, operations) {
      if (++usage.calls > budget.maxCalls) refuse("call_budget");
      if (now() >= budget.deadlineMs) refuse("deadline");
      const [first, ...chain] = operations;
      const name = String(first?.args?.[0] ?? "");
      if (method === "rpc") {
        const opts = first.args[2] as { get?: boolean; head?: boolean } | undefined;
        if (!CAPTURE_RPCS.has(name)) refuse("rpc_not_allowed", name);
        if (opts?.get !== true && opts?.head !== true) refuse("rpc_not_get", name);
      } else if (!CAPTURE_RELATIONS.has(name)) refuse("relation_not_allowed", name);
      let filtered = method === "rpc";
      for (const op of chain) {
        if (MUTATIONS.has(op.method)) refuse("mutation_refused", `${name}.${op.method}`);
        if (FILTER_METHODS.has(op.method) || op.method === "range" || op.method === "limit") filtered = true;
        else if (!SHAPE_METHODS.has(op.method)) refuse("method_not_allowed", `${name}.${op.method}`);
      }
      if (!filtered && !UNFILTERED_OK.has(name)) refuse("unfiltered_read", name);
    },
    start(method, args) {
      return method === "from" ? client.from(String(args[0])) : client.rpc(String(args[0]), args[1], args[2]);
    },
    inspect(method, operations, result, receivedAt) {
      const relation = String(operations[0]?.args?.[0] ?? "");
      const data = (result as { data?: unknown; count?: number | null } | null)?.data;
      const rows = Array.isArray(data) ? data : data && typeof data === "object" ? [data] : [];
      usage.rows += rows.length;
      if (usage.rows > budget.maxRows) refuse("row_budget");
      const receivedMicros = parseInstantMicros(receivedAt) + BigInt(budget.stampToleranceMs) * 1000n;
      for (const row of rows as Array<Record<string, unknown>>) {
        if (!row || typeof row !== "object") continue;
        for (const column of AVAILABILITY_COLUMNS) {
          const value = row[column];
          if (typeof value !== "string") continue;
          let stamped: bigint;
          try { stamped = parseInstantMicros(value); } catch { continue; } // date-only or non-instant text
          if (stamped > receivedMicros) refuse("future_stamped_row", `${relation}.${column}`);
        }
      }
      if (method !== "from") return;
      if (relation === "pbp_games") {
        for (const row of rows as Array<Record<string, unknown>>) {
          if (Number(row.id) === target.gameId && [row.hometeamscore, row.awayteamscore].some((score) => score !== null && score !== undefined && Number(score) > 0)) {
            refuse("target_game_result", "pbp_games.score");
          }
        }
        return;
      }
      if (!RESULT_RELATIONS.has(relation)) return;
      const count = (result as { count?: number | null } | null)?.count;
      const filtersTarget = operations.some((op) => op.method === "eq" && GAME_COLUMNS.includes(String(op.args[0])) && Number(op.args[1]) === target.gameId);
      if (filtersTarget && ((typeof count === "number" && count > 0) || rows.length > 0)) refuse("target_game_result", relation);
      for (const row of rows as Array<Record<string, unknown>>) {
        if (GAME_COLUMNS.some((column) => row[column] !== undefined && Number(row[column]) === target.gameId)) refuse("target_game_result", relation);
        const date = DATE_COLUMNS.map((column) => row[column]).find((value) => typeof value === "string") as string | undefined;
        if (date?.slice(0, 10) === target.slateDate && TEAM_COLUMNS.some((column) => sameTeam(row[column], target))) {
          refuse("target_game_result", `${relation}.slate_date_team_row`);
        }
      }
    },
  };
}

function sameTeam(value: unknown, target: CaptureTarget) {
  if (value === null || value === undefined) return false;
  if (typeof value === "number") return value === target.homeTeamId || value === target.awayTeamId;
  const text = String(value).trim().toUpperCase();
  return text === target.homeAbbrev.toUpperCase() || text === target.awayAbbrev.toUpperCase()
    || text === String(target.homeTeamId) || text === String(target.awayTeamId);
}

async function readCapped(response: Response, cap: number, refuse: (code: string, detail?: string) => never): Promise<Uint8Array> {
  const declared = Number(response.headers.get("content-length") ?? "NaN");
  if (Number.isFinite(declared) && declared > cap) refuse("response_bytes", String(declared));
  if (!response.body) return new Uint8Array(0);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > cap) { await reader.cancel(); refuse("response_bytes", String(total)); }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { out.set(chunk, offset); offset += chunk.byteLength; }
  return out;
}
