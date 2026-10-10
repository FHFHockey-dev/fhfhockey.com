import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { resolve, relative, sep, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { acceptedNewsSupersedes, timestampMicros } from "../lib/projections/evidenceTime";
import { capturedReadReceipt, projectionInputHash, interceptProjectionQuery as capturedQuery } from "../lib/projections/inputCapture";
import { installProjectionQueryInterceptor } from "../lib/projections/queryCaptureHook";
import type { PlanningPlayer, PlanningGame, ForecastDiscoveryExclusion } from "../lib/rosterScheduleOptimizer/planningTypes";

type Row = Record<string, any>;
type Operation = { method: string; args: any[] };
export type OfflinePlayerInputs = {
  version: "native-player-offline-inputs-v1";
  classification: "synthetic_fixture" | "retained_exports";
  slateDate: string;
  gameId: number;
  targets: Array<{ canonicalId: number; nhlId: number; teamId: number; playerClass: "skater" | "goalie" }>;
  tables: Record<string, { rows: Row[]; receipt: {
    source: string; revision: string; publishedAt: string; receivedAt: string; verifiedAt: string;
    scope: string; complete: boolean; rowCount: number; rowsHash: string;
  } }>;
};
const TARGETS = { G: "GOALS", A: "ASSISTS", PPP: "PP_POINTS", SOG: "SHOTS_ON_GOAL", HIT: "HITS", BLK: "BLOCKED_SHOTS",
  W: "WINS_GOALIE", GA: "GOALS_AGAINST_GOALIE", SV: "SAVES_GOALIE", SO: "SHUTOUTS_GOALIE" };
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const digest = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");
const validTime = (value: unknown): value is string => typeof value === "string"
  && /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) && timestampMicros(value) !== null;

/** No default empty tables, guessed predicates, joins, writes or RPC implementations. */
export function offlineTableAdapter(inputs: OfflinePlayerInputs) {
  const reads: Operation[][] = [], violations: string[] = [];
  const fail = (reason: string): never => { violations.push(reason); throw new Error(reason); };
  function builder(table: string) {
    const operations: Operation[] = [{ method: "from", args: [table] }];
    let pending: Promise<any> | undefined;
    const execute = () => pending ??= Promise.resolve().then(() => {
      if (!Object.hasOwn(inputs.tables, table)) return fail(`missing_table:${table}`);
      reads.push(clone(operations));
      let rows = clone(inputs.tables[table].rows);
      let selected = "*", counted = false, head = false, offset = 0, limit = Infinity, single = false, strictSingle = false;
      const order: Array<[string, boolean]> = [];
      const field = (row: Row, key: string): any => key.split(".").reduce((value, part) => {
        if (!value || !Object.hasOwn(value, part)) return fail(`missing_export_column:${table}.${key}`);
        return value[part];
      }, row);
      const predicate = (row: Row, key: string, operator: string, value: any): boolean => {
        let actual = field(row, key);
        if (actual != null && operator !== "is") {
          const values = operator === "in" ? value : [value];
          if (values.some((item: unknown) => typeof item !== typeof actual)) return fail(`unsupported_predicate_type:${table}.${key}`);
          if (operator !== "in" && validTime(actual) && validTime(value)) {
            actual = timestampMicros(actual); value = timestampMicros(value);
          }
        }
        switch (operator) {
          case "eq": return actual === value;
          case "neq": return actual != null && actual !== value;
          case "is": return value === null ? actual == null : actual === value;
          case "in": return Array.isArray(value) && value.includes(actual);
          case "lt": return actual != null && actual < value;
          case "lte": return actual != null && actual <= value;
          case "gt": return actual != null && actual > value;
          case "gte": return actual != null && actual >= value;
          default: return fail(`unsupported_predicate:${operator}`);
        }
      };
      const column = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z_][A-Za-z_0-9]*(?:\.[A-Za-z_][A-Za-z_0-9]*)*$/.test(value);
      const scalar = (value: unknown) => ["string", "number", "boolean"].includes(typeof value)
        && (typeof value !== "number" || Number.isFinite(value));
      const options = (value: unknown, allowed: Record<string, (value: unknown) => boolean>) => value === undefined
        || Boolean(value && typeof value === "object" && !Array.isArray(value)
          && [Object.prototype, null].includes(Object.getPrototypeOf(value)) && Object.entries(value).every(([key, item]) => Object.hasOwn(allowed, key) && allowed[key](item)));
      const shape = (valid: boolean, method: string) => { if (!valid) fail(`unsupported_query_shape:${method}`); };
      for (const { method, args } of operations.slice(1)) {
        if (method === "select") {
          shape(args.length >= 1 && args.length <= 2 && typeof args[0] === "string"
            && (args[0] === "*" || args[0].split(",").map((value: string) => value.trim()).every(column))
            && options(args[1], { count: value => value === "exact", head: value => typeof value === "boolean" })
            && (!args[1]?.head || args[1]?.count === "exact"), method);
          selected = args[0].split(",").map((value: string) => value.trim()).join(","); counted = args[1]?.count === "exact"; head = args[1]?.head === true;
        } else if (["eq", "neq", "is", "in", "lt", "lte", "gt", "gte"].includes(method)) {
          shape(args.length === 2 && column(args[0]) && (method === "in" ? Array.isArray(args[1]) && args[1].every(scalar)
            : method === "is" ? args[1] === null || typeof args[1] === "boolean" : scalar(args[1])), method);
          rows = rows.filter(row => predicate(row, args[0], method, args[1]));
        } else if (method === "or") {
          shape(args.length === 1 && typeof args[0] === "string", method);
          const predicates = args[0].split(",").map((part: string) => {
            const match = /^([A-Za-z_][A-Za-z_0-9]*)\.(eq|is)\.(.+)$/.exec(part);
            if (!match || match[2] === "is" && !["null", "true", "false"].includes(match[3])
              || match[2] === "eq" && match[3] === "null") return fail(`unsupported_or:${table}`);
            const value = match[3] === "null" ? null : match[3] === "true" ? true : match[3] === "false" ? false
              : /^-?\d+$/.test(match[3]) && Number.isSafeInteger(Number(match[3])) ? Number(match[3]) : match[3];
            return { key: match[1], op: match[2], value };
          });
          rows = rows.filter(row => predicates.some(({ key, op, value }: { key: string; op: string; value: any }) => predicate(row, key, op, value)));
        } else if (method === "order") {
          shape(args.length >= 1 && args.length <= 2 && column(args[0]) && options(args[1], { ascending: value => typeof value === "boolean" }), method);
          order.push([args[0], args[1]?.ascending !== false]);
        } else if (method === "limit") {
          shape(args.length === 1 && Number.isSafeInteger(args[0]) && args[0] >= 0, method); limit = args[0];
        } else if (method === "range") {
          shape(args.length === 2 && args.every(value => Number.isSafeInteger(value) && value >= 0) && args[1] >= args[0], method);
          offset = args[0]; limit = args[1] - args[0] + 1;
        } else if (method === "single" || method === "maybeSingle") {
          shape(args.length === 0, method); single = true; strictSingle = method === "single";
        } else if (method === "abortSignal") {
          shape(args.length === 1 && args[0] instanceof AbortSignal, method);
          if (args[0].aborted) return fail("offline_read_aborted");
        } else return fail(`unsupported_query:${method}`);
      }
      const count = rows.length;
      rows.sort((left, right) => {
        for (const [key, ascending] of order) {
          const a = field(left, key), b = field(right, key);
          const compared = a == null ? b == null ? 0 : 1 : b == null ? -1 : a < b ? -1 : a > b ? 1 : 0;
          if (compared) return ascending ? compared : -compared;
        }
        return 0;
      });
      rows = rows.slice(offset, offset + limit);
      if (selected !== "*") rows = rows.map(row => Object.fromEntries(selected.split(",").map(key => [key, field(row, key) ?? null])));
      if (single && (rows.length > 1 || strictSingle && rows.length !== 1)) return fail(`invalid_single:${table}`);
      return { data: head ? null : single ? rows[0] ?? null : rows, error: null, ...(counted ? { count } : {}) };
    });
    const proxy: any = new Proxy({}, { get(_target, property) {
      if (property === "then") return (accept: any, reject: any) => execute().then(accept, reject);
      if (property === "catch") return (reject: any) => execute().catch(reject);
      if (property === "finally") return (callback: any) => execute().finally(callback);
      return (...args: any[]) => {
        if (["insert", "upsert", "update", "delete"].includes(String(property))) return fail(`database_write_forbidden:${String(property)}`);
        if (pending) return fail("executed_query_mutation");
        operations.push({ method: String(property), args }); return proxy;
      };
    } });
    return proxy;
  }
  return { from: (...args: any[]) => {
    if (args.length !== 1 || typeof args[0] !== "string" || !/^[A-Za-z_][A-Za-z_0-9]*$/.test(args[0])) return fail("unsupported_query_shape:from");
    return builder(args[0]);
  }, rpc: () => fail("rpc_forbidden"), reads, violations };
}

/** Independent fence installed before the native runner is imported. Restore every patched entry point. */
export function installOfflineFence(queryClient?: { from: (table: string) => any; rpc: () => never }) {
  const attempts: string[] = [], restore: Array<() => void> = [];
  const patch = (object: any, key: string, label: string) => {
    if (typeof object[key] !== "function") return;
    const original = object[key];
    object[key] = () => { attempts.push(label); throw new Error(`offline_side_effect_forbidden:${label}`); };
    restore.push(() => { object[key] = original; });
  };
  patch(globalThis, "fetch", "fetch"); patch(globalThis, "WebSocket", "WebSocket");
  for (const [name, keys] of Object.entries({ "node:http": ["request", "get"], "node:https": ["request", "get"],
    "node:net": ["connect", "createConnection"], "node:tls": ["connect"], "node:http2": ["connect"],
    "node:dgram": ["createSocket"], "node:child_process": ["spawn", "spawnSync", "exec", "execSync", "execFile", "execFileSync", "fork"] })) {
    const transportModule = require(name);
    for (const key of keys) patch(transportModule, key, `${name}.${key}`);
  }
  patch(require("node:net").Socket.prototype, "connect", "Socket.connect");
  patch(require("node:net").Server.prototype, "listen", "Server.listen");
  for (const key of ["send", "bind", "connect"]) patch(require("node:dgram").Socket.prototype, key, `DatagramSocket.${key}`);
  patch(require("node:child_process").ChildProcess.prototype, "spawn", "ChildProcess.spawn");
  // Resolve before loading: aliases, relative/absolute paths and symlinks share one boundary.
  const moduleLoader = require("node:module"), originalLoad = moduleLoader._load;
  const webRoot = resolve(__dirname, "..");
  const identity = (path: string) => realpathSync(path);
  const serverIdentity = identity(resolve(webRoot, "lib/supabase/server.ts"));
  const publicIdentities = new Set(["index.ts", "client.ts", "public-client.ts", "serverReadonly.ts"]
    .map(file => identity(resolve(webRoot, "lib/supabase", file))));
  const supabaseRoot = identity(resolve(webRoot, "lib/supabase"));
  const sdkRoots = new Set<string>();
  // Resolve SDK roots without loading their code or examining client configuration.
  for (const name of ["@supabase/supabase-js", "@supabase/postgrest-js", "@supabase/gotrue-js", "@supabase/auth-js", "@supabase/functions-js", "@supabase/realtime-js", "@supabase/storage-js"]) {
    try {
      let directory = dirname(identity(require.resolve(name)));
      while (!existsSync(resolve(directory, "package.json")) && directory !== dirname(directory)) directory = dirname(directory);
      sdkRoots.add(directory);
    } catch { /* Optional packages absent from this installation need no adapter. */ }
  }
  const deny = (label: string): never => { attempts.push(label); throw new Error(`offline_side_effect_forbidden:${label}`); };
  const client = new Proxy(queryClient ?? {}, { get(target, key) {
    if (["from", "rpc"].includes(String(key)) && queryClient) return Reflect.get(target, key);
    return deny(`client.${String(key)}`);
  } });
  const blockedExports = (label: string) => new Proxy({ __esModule: true, default: new Proxy({}, { get(_target, key) {
    return deny(`${label}.${String(key)}`);
  } }) }, { get(target, key) {
    if (Object.hasOwn(target, key)) return Reflect.get(target, key);
    return deny(`${label}.${String(key)}`);
  } });
  const serverExports = { __esModule: true, default: client, getServiceRoleClient: () => deny("getServiceRoleClient") };
  const publicExports = blockedExports("public_client"), sdkExports = blockedExports("SDK");
  moduleLoader._load = function(request: string, parent: unknown, isMain: boolean) {
    const resolved = moduleLoader._resolveFilename(request, parent, isMain);
    const filename = typeof resolved === "string" && existsSync(resolved) ? identity(resolved) : resolved;
    if (filename === serverIdentity) return serverExports;
    if (publicIdentities.has(filename)) return publicExports;
    if ([...sdkRoots].some(root => filename === root || filename.startsWith(`${root}${sep}`))) return sdkExports;
    // Other repository Supabase utilities may read configuration at module scope.
    if (filename.startsWith(`${supabaseRoot}${sep}`) && /\.[cm]?[jt]s$/.test(filename)) return blockedExports("supabase_module");
    return originalLoad.call(this, request, parent, isMain);
  };
  restore.push(() => { moduleLoader._load = originalLoad; });
  // Keep builtin ESM bindings behind the same socket/process fence as CommonJS.
  moduleLoader.syncBuiltinESMExports();
  restore.unshift(() => moduleLoader.syncBuiltinESMExports());

  return { attempts, restore: () => restore.reverse().forEach(action => action()) };
}

function inputProvenance(inputs: OfflinePlayerInputs) {
  const fixturePath = resolve(__dirname, "fixtures/native-player-offline-synthetic.json");
  const fixtureBytes = readFileSync(fixturePath);
  if (digest(new Uint8Array(fixtureBytes)) !== "244bd60b4f9aca636273826f6cf585c175c3c53452a0f8ff5898b5d7c9f70f54") {
    throw new Error("Known immutable synthetic fixture checksum changed");
  }
  const fixture = JSON.parse(fixtureBytes.toString("utf8")) as OfflinePlayerInputs;
  const signals: string[] = [];
  if (inputs.classification === "synthetic_fixture") signals.push("declared_synthetic_fixture");
  for (const [table, entry] of Object.entries(inputs.tables ?? {})) {
    const receipt = entry?.receipt;
    if ([receipt?.source, receipt?.revision, receipt?.scope].some(value => typeof value === "string"
      && /\b(?:fictional|synthetic|fixture)\b|fixture\.invalid/i.test(value))) signals.push(`fictional_source_provenance:${table}`);
    if (entry?.rows?.length && fixture.tables[table]?.rows.length
      && projectionInputHash(entry.rows) === fixture.tables[table].receipt.rowsHash) signals.push(`known_synthetic_rows:${table}`);
  }
  return { fictional: signals.length > 0, signals, fixturePath,
    contradiction: inputs.classification === "retained_exports" && signals.length > 0 };
}

function validateEvidence(inputs: OfflinePlayerInputs, asOf: string) {
  const reasons: string[] = [];
  if (inputs.version !== "native-player-offline-inputs-v1" || !["synthetic_fixture", "retained_exports"].includes(inputs.classification)
    || !/^\d{4}-\d{2}-\d{2}$/.test(inputs.slateDate) || !Number.isSafeInteger(inputs.gameId) || inputs.gameId <= 0
    || !Array.isArray(inputs.targets) || !inputs.targets.length || !inputs.tables || typeof inputs.tables !== "object") {
    throw new Error("Invalid native-player offline input manifest");
  }
  if (inputs.targets.some(target => ![target.canonicalId, target.nhlId, target.teamId].every(id => Number.isSafeInteger(id) && id > 0)
    || !["skater", "goalie"].includes(target.playerClass))) throw new Error("Invalid offline target identity");
  if (new Set(inputs.targets.map(target => target.nhlId)).size !== inputs.targets.length) throw new Error("Duplicate offline target identity");
  const historyFamilies = new Set(["rolling_player_game_metrics", "forge_team_game_strength", "forge_goalie_game", "lineCombinations",
    "skatersGameStats", "goaliesGameStats", "pbp_plays", "pbp_games", "wgo_skater_stats", "wgo_goalie_stats", "wgo_team_stats",
    "player_stats_unified", "sustainability_trend_bands", "nhl_xg_team_rolling_aggregates", "nhl_team_data", "nst_team_all", "nst_team_stats"]);
  const rawGames = Array.isArray(inputs.tables.games?.rows) ? inputs.tables.games.rows : [];
  const historyIds = new Set<number>();
  for (const table of historyFamilies) for (const row of Array.isArray(inputs.tables[table]?.rows) ? inputs.tables[table].rows : []) {
    for (const key of ["game_id", "gameId", "gameid"]) if (Number.isSafeInteger(row?.[key])) historyIds.add(row[key]);
    if (table === "pbp_games" && Number.isSafeInteger(row?.id)) historyIds.add(row.id);
  }
  const normalized = (key: string) => key.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
  const dateOnly = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  const historyDate = (value: unknown, path: string, completedAt?: unknown, cutoff = asOf) => {
    // A date alone cannot locate a completed outcome within the cutoff's day.
    const end = dateOnly(value) ? `${value}T23:59:59.999999Z` : value;
    const bounded = validTime(completedAt) && !acceptedNewsSupersedes(completedAt, cutoff)
      && dateOnly(value) && completedAt.slice(0, 10) === value ? completedAt : end;
    if (!validTime(bounded) || acceptedNewsSupersedes(bounded, cutoff)) reasons.push(`late_or_ambiguous_history:${path}`);
  };
  const inspectTimes = (value: any, path: string, historical: boolean, completedAt?: unknown, cutoff = asOf) => {
    if (!value || typeof value !== "object") return;
    for (const [key, nested] of Object.entries(value)) {
      const name = normalized(key);
      if (/(?:^|_)(?:created|updated|observed|published|received|verified|available|accepted|detected|resolved|completed|ended|captured|computed|calculated)_at$/.test(name)
        || ["timestamp", "event_time", "event_at", "source_timestamp", "as_of", "input_cutoff"].includes(name)) {
        if (nested != null && (!validTime(nested) || acceptedNewsSupersedes(nested, asOf))) reasons.push(`late_or_invalid_row_evidence:${path}.${key}`);
      } else if (historical && ["date", "game_date", "snapshot_date", "as_of_date", "as_of_game_date"].includes(name)) {
        historyDate(nested, `${path}.${key}`, value.completed_at ?? value.completedAt ?? completedAt, cutoff);
      }
      if (nested && typeof nested === "object") inspectTimes(nested, `${path}.${key}`, historical, completedAt, cutoff);
    }
  };
  for (const [table, entry] of Object.entries(inputs.tables)) {
    const receipt = entry?.receipt;
    if (!Array.isArray(entry?.rows) || entry.rows.some(row => !row || typeof row !== "object" || Array.isArray(row)) || !receipt
      || ![receipt.source, receipt.revision, receipt.scope].every(value => typeof value === "string" && value.trim()) || receipt.complete !== true
      || receipt.rowCount !== entry.rows.length || receipt.rowsHash !== projectionInputHash(entry.rows)) {
      reasons.push(`missing_or_incomplete_source_receipt:${table}`); continue;
    }
    if (![receipt.publishedAt, receipt.receivedAt, receipt.verifiedAt].every(validTime)) reasons.push(`missing_source_time:${table}`);
    else if (acceptedNewsSupersedes(receipt.publishedAt, receipt.receivedAt)
      || acceptedNewsSupersedes(receipt.receivedAt, receipt.verifiedAt)
      || acceptedNewsSupersedes(receipt.verifiedAt, asOf)) reasons.push(`late_or_unordered_source_evidence:${table}`);
    const historical = historyFamilies.has(table);
    inspectTimes(entry.rows, table, false);
    // Evaluate historical dates per row with the retained game's explicit completion time when available.
    if (historical) for (const [index, row] of entry.rows.entries()) {
      const keys = Object.keys(row).map(normalized);
      const gameId = row.game_id ?? row.gameId ?? row.gameid ?? (table === "pbp_games" ? row.id : undefined);
      const game = rawGames.find(item => item.id === gameId);
      const completedAt = row.completed_at ?? row.completedAt ?? game?.completed_at ?? game?.completedAt;
      inspectTimes(row, `${table}.${index}`, true, completedAt);
      if (validTime(receipt.publishedAt)) inspectTimes(row, `${table}.${index}.source_publication`, true, completedAt, receipt.publishedAt);
      if (validTime(completedAt) && validTime(receipt.publishedAt) && acceptedNewsSupersedes(completedAt, receipt.publishedAt)) {
        reasons.push(`history_after_source_publication:${table}.${index}`);
      }
      const hasDate = keys.some(key => ["date", "game_date", "snapshot_date", "as_of_date", "as_of_game_date"].includes(key));
      if (!hasDate && !game && !validTime(row.completed_at ?? row.completedAt ?? row.as_of)) reasons.push(`missing_historical_event_time:${table}.${index}`);
      if (game) {
        historyDate(game.date, `${table}.${index}.referenced_game_date`, completedAt, validTime(receipt.publishedAt) ? receipt.publishedAt : asOf);
        if (game.startTime != null && (!validTime(game.startTime) || acceptedNewsSupersedes(game.startTime, asOf))) reasons.push(`historical_game_not_started_by_cutoff:${table}.${index}`);
      }
      if (game && row.game_date != null && game.date !== row.game_date) reasons.push(`history_game_date_conflict:${table}.${index}`);
    }
  }
  for (const [index, game] of rawGames.entries()) {
    if (historyIds.has(game.id) || ["FINAL", "OFF"].includes(String(game.status ?? game.gameState).toUpperCase())) {
      historyDate(game.date, `games.${index}.date`, game.completed_at ?? game.completedAt);
    }
  }
  return reasons;
}

/** Diagnostic calculation only. No source timestamps, native parameters or public gates are replaced. */
export async function qualifyNativePlayersOffline(inputs: OfflinePlayerInputs, asOf: string) {
  if (!validTime(asOf) || Date.parse(asOf) > Date.now()) throw new Error("Supply an explicit --as-of timestamp no later than now");
  const inputHash = projectionInputHash(inputs);
  const blockers = validateEvidence(inputs, asOf);
  const provenance = inputProvenance(inputs);
  if (provenance.contradiction) blockers.push("contradictory_fictional_provenance");
  const adapter = offlineTableAdapter(inputs);
  const fence = installOfflineFence({
    from: table => capturedQuery("from", [table], () => adapter.from(table)) ?? adapter.from(table),
    rpc: adapter.rpc,
  });
  const environment = { STARTER_BOARD_CAPTURE_ENABLED: "true", STARTER_BOARD_COMPUTE_ENABLED: "true",
    STARTER_BOARD_SERVING_ENABLED: "false", STARTER_BOARD_SCHEDULER_ENABLED: "false", STARTER_BOARD_CHALLENGER_ENABLED: "false" };
  const saved = Object.fromEntries(Object.keys(environment).map(key => [key, process.env[key]]));
  let writes: Operation[][] = [], calculation: any = null, evidence: any = null, contexts: any[] = [], admission: any = null;
  let createdAt = new Date().toISOString();
  let modelEnvironment: Record<string, string | null> | undefined, modelMode: string | undefined;
  const exclusions: ForecastDiscoveryExclusion[] = [], exclusionCounts: Record<string, number> = {};
  let codeFiles: Array<{ path: string; sha256: string }> = [];
  try {
    try {
      for (const [key, value] of Object.entries(environment)) process.env[key] = value;
      const { captureForgeReconstruction, projectionModelEnvironment } = await import("../lib/projections/run-forge-projections");
      modelEnvironment = projectionModelEnvironment();
      const { captureForgeIssuedContexts } = await import("../lib/projections/issuedContext");
      const { admitConsumerGameRevisions } = await import("../lib/projections/consumerRevisionAdmission");
      const root = resolve(__dirname, "../..");
      const required = [__filename, provenance.fixturePath, resolve(root, "web/lib/projections/run-forge-projections.ts"),
        resolve(root, "web/lib/projections/consumerRevisionAdmission.ts"), resolve(root, "web/lib/projections/inputCapture.ts")];
      codeFiles = [...new Set([...required, ...Object.keys(require.cache).filter(path => path.startsWith(`${root}${sep}`)
        && !path.includes(`${sep}node_modules${sep}`))])].sort().map(path => ({ path: relative(root, path), sha256: digest(new Uint8Array(readFileSync(path))) }));
      installProjectionQueryInterceptor((method, args) => {
        if (method === "rpc") return adapter.rpc();
        return capturedQuery(method, args, () => adapter.from(String(args[0]))) ?? adapter.from(String(args[0]));
      });
      if (!blockers.length) {
        const targetGames = inputs.tables.games?.rows.filter(row => row.id === inputs.gameId) ?? [];
        if (targetGames.length !== 1 || targetGames[0].type !== 2) blockers.push("missing_or_invalid_regular_season_game_phase");
        contexts = await captureForgeIssuedContexts(inputs.slateDate, [inputs.gameId], adapter);
        if (Date.parse(asOf) >= Date.parse(contexts[0].game.startTime)) blockers.push("cutoff_not_before_puck_drop");
        if (inputs.targets.some(target => !contexts[0].roster.some((row: any) => row.nhlId === target.nhlId
          && row.canonicalId === target.canonicalId && row.teamId === target.teamId))) blockers.push("target_identity_not_in_retained_roster");
      }
      if (!blockers.length) {
        const captured = await captureForgeReconstruction({ slateDate: inputs.slateDate, gameId: inputs.gameId,
          inputCutoff: asOf, codeVersion: `offline:${projectionInputHash(codeFiles)}`, deadlineMs: Date.now() + 150000 });
        writes = captured.writes;
        modelMode = captured.snapshot.modelMode;
        calculation = captured.result;
        evidence = captured.snapshot.dailyBoardEvidence ?? writes.filter(ops => ops[0]?.args[0] === "forge_runs")
          .map(ops => ops.find(op => op.method === "update")?.args[0]?.metrics?.daily_board_evidence).find(Boolean);
        if (calculation.timedOut || calculation.gamesProcessed !== 1 || !calculation.playerRowsUpserted) blockers.push("native_calculation_incomplete");
        if (adapter.violations.length || fence.attempts.length) blockers.push("offline_boundary_violation");
        createdAt = new Date().toISOString();
        // Local diagnostic envelope only; actual creation time is never backdated to the input cutoff.
        const rows = (table: string) => writes.filter(ops => ops[0]?.args[0] === table).flatMap(ops => {
          const value = ops.find(op => op.method === "upsert")?.args[0]; return Array.isArray(value) ? value : value ? [value] : [];
        });
        const context = contexts[0];
        const players: PlanningPlayer[] = inputs.targets.map(target => {
          const roster = context.roster.find((row: any) => row.nhlId === target.nhlId);
          const schedule = context.schedule.find((row: any) => row.teamId === target.teamId);
          return { id: String(target.canonicalId), nhlId: target.nhlId, nhlTeamId: target.teamId, name: `Offline target ${target.nhlId}`,
            teamAbbreviation: schedule.teamAbbreviation, rosterRevision: roster.revision, playerClass: target.playerClass,
            eligiblePositions: [], eligibilityVerified: false, availability: "unknown", ownership: null, canDrop: null, holdValue: null, reserveEligibility: [] };
        });
        const games: PlanningGame[] = context.schedule.map((row: any) => ({ id: String(inputs.gameId), date: inputs.slateDate,
          startsAt: new Date(row.startTime).toISOString(), teamAbbreviation: row.teamAbbreviation, opponent: row.opponentAbbreviation,
          home: row.teamId === context.game.homeTeamId, status: "scheduled", scheduleRevision: row.revision }));
        if (!blockers.length) admission = await admitConsumerGameRevisions(adapter as any, [{ id: `offline-diagnostic:${inputHash}`,
          game_id: inputs.gameId, run_id: captured.snapshot.runId, decision_as_of: asOf, published_at: createdAt,
          payload: { players: rows("forge_player_projections"), teams: rows("forge_team_projections"), goalies: rows("forge_goalie_projections"),
            inputCutoff: asOf, calculatedAt: createdAt, evidence, codeVersion: captured.snapshot.codeVersion,
            inputProvenance: { rolling_player_history_contract: captured.snapshot.inputProvenance!.rolling_player_history_contract,
              issuedContexts: contexts, capturedReads: capturedReadReceipt(captured.snapshot.reads) } } }],
          players, games, new Date(createdAt), context.game.seasonId, exclusionCounts, exclusions);
      }
    } catch (error) {
      blockers.push(error instanceof Error ? error.message : String(error));
    }
    const { projectionWritesHash } = await import("../lib/projections/gameRevisions");
    const { boardSkaterForecast, completeBoardSkaterStatsFromProjection, boardGoalieForecast } = await import("../lib/projections/starterBoardScoring");
    const rows = (table: string) => writes.filter(ops => ops[0]?.args[0] === table).flatMap(ops => {
      const value = ops.find(op => op.method === "upsert")?.args[0]; return Array.isArray(value) ? value : value ? [value] : [];
    });
    const tableRows = (table: string): Row[] => Array.isArray(inputs.tables[table]?.rows) ? inputs.tables[table].rows : [];
    const categoryCoverage = inputs.targets.map(target => {
      const row = target.playerClass === "skater" ? rows("forge_player_projections").find(row => row.player_id === target.nhlId && row.team_id === target.teamId)
        : rows("forge_goalie_projections").filter(row => row.team_id === target.teamId)
          .flatMap(row => row.uncertainty?.daily_board_candidates ?? []).find(candidate => candidate.playerId === target.nhlId);
      const forecast = row ? target.playerClass === "skater" ? boardSkaterForecast(completeBoardSkaterStatsFromProjection(row), row.uncertainty,
        { gameId: inputs.gameId, teamId: target.teamId, playerId: target.nhlId, horizonGames: 1, cutoffAt: asOf, evidence })
        : boardGoalieForecast(row, { gameId: inputs.gameId, teamId: target.teamId, playerId: target.nhlId, horizonGames: 1, cutoffAt: asOf, evidence }) : null;
      const admitted = admission?.forecasts.find((item: any) => item.playerId === String(target.canonicalId));
      const applicable = target.playerClass === "skater" ? ["G", "A", "PPP", "SOG", "HIT", "BLK"] : ["W", "GA", "SV", "SO"];
      const history = tableRows("rolling_player_game_metrics").filter(item => item?.player_id === target.nhlId && item.game_date < inputs.slateDate);
      const goalieHistory = tableRows("forge_goalie_game").filter(item => item?.goalie_id === target.nhlId && item.game_date < inputs.slateDate);
      return { ...target, inputCoverage: {
        retainedRollingRowsByStrength: Object.fromEntries(["ev", "pp", "pk"].map(strength => [strength, history.filter(item => item.strength_state === strength).length])),
        retainedGoalieHistoryRows: goalieHistory.length,
        retainedRosterMatches: contexts.flatMap(context => context.roster).filter(row => row.nhlId === target.nhlId).length,
        nativeOutputPresent: Boolean(row),
        note: "Retained row counts do not establish full event/exposure or goalie-spell coverage; empty history is not verified zero.",
      }, participation: { probability: forecast?.participationProbability ?? null,
        status: forecast?.probabilityStatus ?? "missing", evidence: forecast?.evidence ?? [], conflicts: forecast?.conflicts ?? [] },
        admission: { acceptedByUnchangedConsumer: Boolean(admitted), reasons: exclusions.filter(item => !item.playerId || item.playerId === String(target.canonicalId)) },
        categories: Object.entries(TARGETS).map(([category, key]) => {
          if (!applicable.includes(category)) return { category, key, status: "not_applicable" };
          const modeled = forecast?.conditional?.[key] ?? forecast?.legacy?.[key] ?? null;
          const value = admitted?.stats[key] ?? null;
          const reasons = [...blockers, ...adapter.violations, ...fence.attempts];
          if (!row) reasons.push("missing_native_output");
          if (modeled === null) reasons.push("missing_native_target");
          if (["G", "A", "SOG"].includes(category)) reasons.push("missing_pk_heads_and_fullgame_bridge");
          if (category === "PPP") {
            const ppRows = history.filter(item => item.strength_state === "pp");
            if (!ppRows.length) reasons.push("missing_retained_pp_history");
            else if (ppRows.some(item => ![item.toi_seconds_avg_last5, item.toi_seconds_avg_all].every(value => typeof value === "number" && Number.isFinite(value) && value > 0)
              || ![item.goals_total_all, item.assists_total_all, item.shots_total_all].every(value => typeof value === "number" && Number.isFinite(value) && value >= 0))) reasons.push("missing_pp_counts_or_exposure_denominators");
            // Rolling aggregates and a producer mean cannot certify complete PP events/exposure.
            reasons.push("pp_event_exposure_coverage_unproven");
          }
          if (["HIT", "BLK"].includes(category)) reasons.push("full_strength_exposure_unproven");
          if (["W", "GA", "SV", "SO"].includes(category)) reasons.push("opponent_fullgame_shots_and_goalie_spell_coverage_unproven");
          if (category === "W") reasons.push("fullgame_team_goals_driver_unproven");
          if (category === "SO") reasons.push("official_individual_shutout_credit_unproven");
          if (!forecast || forecast.probabilityStatus !== "confirmed_evidence") reasons.push("missing_confirmed_participation");
          if (!admitted) reasons.push("consumer_admission_failed");
          if (value === null) reasons.push("missing_admitted_target");
          if (provenance.fictional) reasons.push("synthetic_fixture_is_not_forecast_evidence");
          return { category, key, modeledStatus: modeled === null ? "missing" : "present_native_diagnostic",
            modeledValue: modeled, admittedDiagnosticValue: value, status: reasons.length ? "blocked" : "supported",
            reasons: [...new Set(reasons)] };
        }) };
    });
    const result = { version: "native-player-offline-qualification-v1", classification: provenance.fictional ? "synthetic_fixture" : inputs.classification, declaredClassification: inputs.classification,
      provenance: { fictional: provenance.fictional, signals: provenance.signals }, purpose: "diagnostic_only_not_issued_or_selected", asOf, inputHash, modelEnvironment, modelMode,
      calculationQueryHash: projectionInputHash(adapter.reads.filter(request => request[0]?.args[0] !== "forge_board_news_events")),
      outputHash: projectionWritesHash(writes), qualificationEligible: false,
      blockers: [...new Set([...blockers, ...adapter.violations, ...fence.attempts])],
      calculation: calculation ? { gamesProcessed: calculation.gamesProcessed, playerRows: calculation.playerRowsUpserted,
        goalieRows: calculation.goalieRowsUpserted, teamRows: calculation.teamRowsUpserted, timedOut: calculation.timedOut } : null,
      sourceCoverage: Object.entries(inputs.tables).map(([table, entry]) => ({ table, rowCount: entry?.rows?.length ?? null, receipt: entry?.receipt })),
      boundary: { networkCalls: 0, databaseCalls: 0, rpcCalls: 0, committedWrites: 0,
        suppressedNativeMutations: writes.length, inMemoryReads: adapter.reads.length, forbiddenAttempts: [...adapter.violations, ...fence.attempts] },
      admission: { exclusionCounts, exclusions, limitations: admission?.limitations ?? [], acceptedNewsRevision: admission?.acceptedNewsRevision ?? null,
        freshnessScope: "retained_inputs_only_no_current_hosted_state" }, categoryCoverage,
      limitations: ["Native PK/full-game/goalie-spell bridges remain unavailable; full league qualification is blocked.",
        "Synthetic fixtures and historical retained exports are diagnostic inputs, never prospective forecasts.",
        "Roster identity is not Yahoo eligibility or evidence of playing/starting. PIM and GAA are not target gates."] };
    return { createdAt, runtimeRequests: adapter.reads, runtimeRequestsHash: projectionInputHash(adapter.reads), codeFiles, codeHash: projectionInputHash(codeFiles), resultHash: projectionInputHash(result), result };
  } finally {
    installProjectionQueryInterceptor(capturedQuery);
    for (const key of Object.keys(environment)) { if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key]; }
    fence.restore();
  }
}

export async function runOfflinePlayerQualification(args: string[]) {
  const options = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    if (!["--input", "--input-sha256", "--as-of", "--output"].includes(args[index]) || !args[index + 1] || options.has(args[index]))
      throw new Error("Use --input FILE --input-sha256 SHA256 --as-of TIMESTAMP --output NEW_FILE");
    options.set(args[index], args[index + 1]);
  }
  if (options.size !== 4) throw new Error("Use --input FILE --input-sha256 SHA256 --as-of TIMESTAMP --output NEW_FILE");
  const output = resolve(options.get("--output")!);
  if (existsSync(output)) throw new Error("EEXIST: refusing to overwrite retained input or prior receipt");
  const path = resolve(options.get("--input")!);
  if (statSync(path).size > 32 * 1024 * 1024) throw new Error("Offline input exceeds 32 MiB");
  const bytes = readFileSync(path), sha256 = digest(new Uint8Array(bytes));
  if (sha256 !== options.get("--input-sha256")) throw new Error("Retained input byte checksum mismatch");
  const root = resolve(__dirname, "../..");
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  const codeCommit = git("rev-parse", "HEAD"), branch = git("branch", "--show-current");
  const receipt = { version: "native-player-offline-local-receipt-v1", codeCommit, branch, nodeVersion: process.version,
    inputFile: { path, sha256 }, lockfileHash: digest(new Uint8Array(readFileSync(resolve(root, "web/package-lock.json")))),
    ...await qualifyNativePlayersOffline(JSON.parse(bytes.toString("utf8")), options.get("--as-of")!) };
  if (digest(new Uint8Array(readFileSync(path))) !== sha256) throw new Error("Retained input changed during qualification");
  writeFileSync(output, JSON.stringify(receipt, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  return receipt;
}
if (require.main === module) {
  runOfflinePlayerQualification(process.argv.slice(2)).then(receipt => {
    console.log(JSON.stringify({ output: resolve(process.argv[process.argv.indexOf("--output") + 1]), resultHash: receipt.resultHash,
      nativeOutputHash: receipt.result.outputHash, qualificationEligible: receipt.result.qualificationEligible, blockers: receipt.result.blockers }));
    if (receipt.result.blockers.length) process.exitCode = 1;
  }).catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
}
