/** Private developer source capture only. Imports and default CLI mode perform no I/O to services. */
import { createHash } from "node:crypto";
import { appendFileSync, closeSync, fsyncSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { isDraftProOwner } from "../../../web/lib/draft-pro/ownerAccess";
import { yahooFantasyResourceUrl, YAHOO_FANTASY_API_BASE_URL } from "../../../web/lib/integrations/yahoo/liveDraft";

export const LIMITS = Object.freeze({ databaseRequests: 6, yahooRequests: 4, requestMs: 8000,
  totalMs: 90000, bodyBytes: 1024 * 1024, totalBytes: 10 * 1024 * 1024 });
export type Allocation = {
  version: "yahoo-rso-original-source-allocation-v1"; projectRef: string;
  teamId: string; leagueId: string; yahooLeagueKey: string; yahooTeamKey: string;
  gameKey: string; season: "2026"; targetSeasonId: 20262027;
  startDate: "2026-10-12"; endDate: "2026-10-18"; rosterDate: string;
  fallbackTimeZone: "America/New_York"; verifiedMetadataRef: string;
};
type Client = { from(table: string): any; rpc(name: string, args: any): any;
  auth: { admin: { getUserById(id: string): PromiseLike<any> } } };
export type ClientFactory = (fetchImpl: typeof fetch) => Client;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KEYS = ["version", "projectRef", "teamId", "leagueId", "yahooLeagueKey", "yahooTeamKey", "gameKey", "season",
  "targetSeasonId", "startDate", "endDate", "rosterDate", "fallbackTimeZone", "verifiedMetadataRef"];
export const sha = (bytes: string | Uint8Array) => createHash("sha256").update(bytes).digest("hex");
class CaptureError extends Error { constructor(readonly code: string) { super(code); } }
const fail = (code: string): never => { throw new CaptureError(code); };
const privateWrite = (path: string, bytes: string | Uint8Array) => {
  const fd = openSync(path, "wx", 0o600);
  try { writeFileSync(fd, bytes); fsyncSync(fd); } finally { closeSync(fd); }
};
export function validateAllocation(value: unknown): Allocation {
  const a = value as Allocation;
  if (!a || typeof a !== "object" || Array.isArray(a) || Object.keys(a).length !== KEYS.length
    || Object.keys(a).some(key => !KEYS.includes(key)) || a.version !== "yahoo-rso-original-source-allocation-v1"
    || a.projectRef !== "fyhftlxokyjtpndbkfse" || !UUID.test(a.teamId) || !UUID.test(a.leagueId)
    || !/^\d+$/.test(a.gameKey) || a.season !== "2026" || a.targetSeasonId !== 20262027
    || !new RegExp(`^${a.gameKey}\\.l\\.\\d+$`).test(a.yahooLeagueKey)
    || !a.yahooTeamKey.startsWith(`${a.yahooLeagueKey}.t.`) || !/^\d+\.l\.\d+\.t\.\d+$/.test(a.yahooTeamKey)
    || a.startDate !== "2026-10-12" || a.endDate !== "2026-10-18"
    || !/^2026-10-(?:1[2-8])$/.test(a.rosterDate) || a.fallbackTimeZone !== "America/New_York"
    || typeof a.verifiedMetadataRef !== "string" || !a.verifiedMetadataRef.trim() || a.verifiedMetadataRef.length > 300) fail("invalid_allocation");
  return a;
}
function valueFor(node: any, key: string): any {
  if (!node || typeof node !== "object") return undefined;
  if (!Array.isArray(node) && Object.hasOwn(node, key)) return node[key];
  for (const child of Object.values(node)) { const found = valueFor(child, key); if (found !== undefined) return found; }
}
function fields(node: any): any { return Array.isArray(node) ? Object.assign({}, ...node.map(fields)) : node; }

/** One request-local allowlist shared by SDK reads and Yahoo source GETs. No headers or DB bodies are retained. */
export class CaptureTransport {
  readonly started: number;
  readonly wallStarted: number;
  databaseRequests = 0; yahooRequests = 0; bodyBytes = 0;
  private active = false; private stopped = false;
  private userId = ""; private accountId = "";
  private seen = new Set<string>(); private yahooUrls: Set<string>;
  constructor(readonly allocation: Allocation, readonly out: string, readonly approvalRef: string,
    readonly allocationHash: string, private network: typeof fetch,
    readonly now: () => number = Date.now, readonly monotonic: () => number = () => performance.now()) {
    this.started = monotonic(); this.wallStarted = now();
    const a = allocation;
    this.yahooUrls = new Set([
      yahooFantasyResourceUrl(a.yahooLeagueKey, "settings", { gameCode: "nhl", gameKey: a.gameKey, season: a.season, targetSeasonId: a.targetSeasonId }),
      `${YAHOO_FANTASY_API_BASE_URL}/team/${encodeURIComponent(a.yahooTeamKey)}/roster;date=${a.rosterDate}?format=json`,
      ...[0, 25].map(start => `${YAHOO_FANTASY_API_BASE_URL}/league/${encodeURIComponent(a.yahooLeagueKey)}/players;status=A;sort=OR;start=${start};count=25/ownership?format=json`),
    ]);
  }
  bindOwner(userId: string, accountId: string) {
    if (!UUID.test(userId) || !UUID.test(accountId) || this.userId || this.accountId) fail("invalid_owner_binding");
    this.userId = userId; this.accountId = accountId;
  }
  ledger(action: string, detail: Record<string, unknown> = {}) {
    const fd = openSync(resolve(this.out, "exposure-ledger.jsonl"), "a", 0o600);
    try { appendFileSync(fd, JSON.stringify({ at: new Date(this.now()).toISOString(), action,
      approvalRef: this.approvalRef, allocationSHA256: this.allocationHash, ...detail }) + "\n"); fsyncSync(fd); }
    finally { closeSync(fd); }
  }
  private operation(url: URL, method: string, body: BodyInit | null | undefined): { key: string; yahoo: boolean } {
    const a = this.allocation;
    if (url.username || url.password || url.hash || url.port || url.protocol !== "https:") fail("transport_scope_denied");
    if (this.yahooUrls.has(url.href) && method === "GET") return { key: url.href, yahoo: true };
    if (url.origin !== `https://${a.projectRef}.supabase.co`) fail("transport_scope_denied");
    const exactQuery = (expected: Record<string, string>) => [...url.searchParams].length === Object.keys(expected).length
      && Object.entries(expected).every(([key, value]) => url.searchParams.get(key) === value);
    const selectors: Record<string, Record<string, string>> = {
      external_teams: { select: "id,user_id,provider,external_team_key,external_league_id,connected_account_id,team_metadata", id: `eq.${a.teamId}`, provider: "eq.yahoo" },
      external_leagues: { select: "id,user_id,provider,external_league_key,connected_account_id", id: `eq.${a.leagueId}`, user_id: `eq.${this.userId}`, provider: "eq.yahoo" },
      connected_accounts: { select: "id,user_id,provider,status", id: `eq.${this.accountId}`, user_id: `eq.${this.userId}`, provider: "eq.yahoo" },
      yahoo_game_keys: { select: "game_id,game_key,code,season", code: "eq.nhl", season: `eq.${a.season}`, limit: "2" },
    };
    const table = url.pathname.replace("/rest/v1/", "");
    if (method === "GET" && selectors[table] && (table === "external_teams" || this.userId)
      && url.pathname === `/rest/v1/${table}` && exactQuery(selectors[table])) return { key: table, yahoo: false };
    if (method === "GET" && this.userId && url.pathname === `/auth/v1/admin/users/${this.userId}` && !url.search) return { key: "auth_owner", yahoo: false };
    if (method === "POST" && url.pathname === "/rest/v1/rpc/get_connected_account_tokens_secure"
      && exactQuery({ select: "access_token,expires_at" }) && typeof body === "string") {
      const args = JSON.parse(body);
      if (this.userId && Object.keys(args).length === 2 && args.p_user_id === this.userId
        && args.p_connected_account_id === this.accountId) return { key: "secure_token_read", yahoo: false };
    }
    return fail("transport_scope_denied");
  }
  fetch: typeof fetch = async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    let operation: { key: string; yahoo: boolean };
    try { operation = this.operation(url, method, init?.body); }
    catch { this.stopped = true; return fail("transport_scope_denied"); }
    const stop = (code: string): never => { this.stopped = true; return fail(code); };
    if (this.stopped || this.active || this.seen.has(operation.key)) stop("transport_replay_or_concurrency_denied");
    const used = this.monotonic() - this.started;
    if (used >= LIMITS.totalMs) stop("total_deadline_exceeded");
    if (operation.yahoo ? this.yahooRequests >= LIMITS.yahooRequests : this.databaseRequests >= LIMITS.databaseRequests) stop("request_cap_exceeded");
    this.seen.add(operation.key); this.active = true;
    if (operation.yahoo) this.yahooRequests++; else this.databaseRequests++;
    const controller = new AbortController();
    let reader: ReadableStreamBYOBReader | undefined;
    const chunks: Uint8Array[] = [];
    let sourceRetained = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    this.ledger("request_intent", { operation: operation.key, bodyScope: operation.yahoo ? "whole_original_yahoo_response" : "metadata_or_secure_read_not_retained" });
    try {
      const remaining = Math.min(LIMITS.requestMs, LIMITS.totalMs - (this.monotonic() - this.started));
      if (remaining <= 0) fail("total_deadline_exceeded");
      const work = async () => {
        const response = await this.network(input, { ...init, redirect: "error", signal: controller.signal, cache: "no-store" });
        if (controller.signal.aborted) fail("request_deadline_exceeded");
        if (response.status !== 200) fail(`http_status_${response.status}`);
        // BYOB bounds application exposure as well as retained bytes. Unsupported
        // runtimes stop before reading instead of accepting oversized chunks.
        reader = response.body?.getReader({ mode: "byob" });
        let bytes = 0;
        while (reader) {
          const allowed = Math.min(65536, LIMITS.bodyBytes - bytes, LIMITS.totalBytes - this.bodyBytes);
          if (allowed <= 0) fail("body_byte_cap_exceeded");
          const next = await reader.read(new Uint8Array(allowed));
          if (controller.signal.aborted) fail("request_deadline_exceeded");
          if (next.done) break;
          const chunk = next.value.subarray(0, allowed);
          bytes += chunk.byteLength; this.bodyBytes += chunk.byteLength;
          chunks.push(chunk);
          if (chunk.byteLength !== next.value.byteLength || bytes >= LIMITS.bodyBytes || this.bodyBytes >= LIMITS.totalBytes) fail("body_byte_cap_exceeded");
        }
        const original = Buffer.concat(chunks);
        const safeHeaders: Record<string, string> = {};
        for (const key of ["content-type", "date", "age", "retry-after", "content-range"]) {
          const value = response.headers.get(key); if (value !== null) safeHeaders[key] = value;
        }
        if (operation.yahoo) {
          const path = `${this.yahooRequests}-yahoo.json`;
          privateWrite(resolve(this.out, path), original);
          sourceRetained = true;
          this.ledger("source_retained", { operation: operation.key, path, bytes: original.length, sha256: sha(original), responseDate: safeHeaders.date ?? null });
          this.ledger("whole_body_decode_intent", { operation: operation.key, scope: "all_present_fields_all_players", analystVisibility: "none" });
        } else this.ledger("metadata_read_completed", { operation: operation.key, bytes: original.length });
        return new Response(original, { status: 200, headers: safeHeaders });
      };
      return await Promise.race([work(), new Promise<never>((_, reject) => {
        timer = setTimeout(() => { controller.abort(); void reader?.cancel(); reject(new CaptureError("request_deadline_exceeded")); }, remaining);
      })]);
    } catch (error) {
      this.stopped = true;
      if (operation.yahoo && !sourceRetained) {
        const original = Buffer.concat(chunks), path = `${this.yahooRequests}-yahoo-failed.bin`;
        privateWrite(resolve(this.out, path), original);
        this.ledger("partial_source_retained", { operation: operation.key, path, bytes: original.length, sha256: sha(original) });
      }
      this.ledger("failed_stopped", { operation: operation.key, reason: error instanceof CaptureError ? error.code : "transport_failed" });
      throw error instanceof CaptureError ? error : new CaptureError("transport_failed");
    } finally {
      if (timer) clearTimeout(timer);
      controller.abort(); void reader?.cancel(); this.active = false;
    }
  };
}

export async function captureYahooSources(input: { allocationBytes: Uint8Array; approvedSHA256: string;
  approvalRef: string; output: string; clientFactory: ClientFactory; network?: typeof fetch;
  now?: () => number; monotonic?: () => number }) {
  if (input.allocationBytes.length > 128 * 1024 || sha(input.allocationBytes) !== input.approvedSHA256
    || !input.approvalRef.trim() || input.approvalRef.length > 300) fail("exact_approval_required");
  const allocation = validateAllocation(JSON.parse(Buffer.from(input.allocationBytes).toString("utf8")));
  mkdirSync(input.output, { mode: 0o700 });
  privateWrite(resolve(input.output, "allocation.json"), input.allocationBytes);
  privateWrite(resolve(input.output, "exposure-ledger.jsonl"), "");
  const transport = new CaptureTransport(allocation, input.output, input.approvalRef, input.approvedSHA256,
    input.network ?? fetch, input.now, input.monotonic);
  let owner: { userId: string; accountId: string } | undefined;
  const checked = async (query: PromiseLike<any>) => {
    const result = await query; if (result.error) fail("metadata_read_failed"); return result.data;
  };
  try {
    const db = input.clientFactory(transport.fetch);
    const team = await checked(db.from("external_teams").select("id,user_id,provider,external_team_key,external_league_id,connected_account_id,team_metadata")
      .eq("id", allocation.teamId).eq("provider", "yahoo").maybeSingle());
    if (!team || team.id !== allocation.teamId || team.external_league_id !== allocation.leagueId || team.provider !== "yahoo"
      || team.external_team_key !== allocation.yahooTeamKey || fields(team.team_metadata)?.is_owned !== true) fail("owned_team_mismatch");
    transport.bindOwner(team.user_id, team.connected_account_id);
    owner = { userId: team.user_id, accountId: team.connected_account_id };
    const league = await checked(db.from("external_leagues").select("id,user_id,provider,external_league_key,connected_account_id")
      .eq("id", allocation.leagueId).eq("user_id", owner.userId).eq("provider", "yahoo").maybeSingle());
    if (!league || league.id !== allocation.leagueId || league.user_id !== owner.userId || league.provider !== "yahoo"
      || league.connected_account_id !== owner.accountId || league.external_league_key !== allocation.yahooLeagueKey) fail("league_account_mismatch");
    const account = await checked(db.from("connected_accounts").select("id,user_id,provider,status")
      .eq("id", owner.accountId).eq("user_id", owner.userId).eq("provider", "yahoo").maybeSingle());
    if (!account || account.id !== owner.accountId || account.user_id !== owner.userId || account.provider !== "yahoo" || account.status !== "connected") fail("account_unavailable");
    const auth = await checked(db.auth.admin.getUserById(owner.userId));
    if (auth?.user?.id !== owner.userId || !isDraftProOwner(auth.user)) fail("verified_owner_required");
    const contexts = await checked(db.from("yahoo_game_keys").select("game_id,game_key,code,season").eq("code", "nhl").eq("season", allocation.season).limit(2));
    if (!Array.isArray(contexts) || contexts.length !== 1 || contexts[0].code !== "nhl" || String(contexts[0].season) !== allocation.season
      || String(contexts[0].game_key ?? contexts[0].game_id) !== allocation.gameKey) fail("game_context_mismatch");
    const tokenRows = await checked(db.rpc("get_connected_account_tokens_secure", { p_connected_account_id: owner.accountId, p_user_id: owner.userId })
      .select("access_token,expires_at"));
    const token = Array.isArray(tokenRows) && tokenRows.length === 1 ? tokenRows[0] : null;
    if (!token || typeof token.access_token !== "string" || !token.access_token.trim()
      || !Number.isFinite(Date.parse(token.expires_at)) || Date.parse(token.expires_at) <= transport.wallStarted + LIMITS.totalMs) fail("needs_normal_yahoo_reconnect");
    const read = async (url: string) => {
      const response = await transport.fetch(url, { method: "GET", headers: { Accept: "application/json", Authorization: `Bearer ${token.access_token}`, "Cache-Control": "no-cache" } });
      const sourceDate = Date.parse(response.headers.get("date") ?? "");
      const age = response.headers.get("age");
      if (!Number.isFinite(sourceDate) || Math.abs(transport.now() - sourceDate) > 120000
        || age !== null && (!Number.isFinite(Number(age)) || Number(age) < 0 || Number(age) > 60)) fail("provider_freshness_unverified");
      const payload = await response.json();
      transport.ledger("whole_body_decode_completed", { sourceURL: url, analystVisibility: "none" });
      return payload;
    };
    const context = { gameCode: "nhl" as const, gameKey: allocation.gameKey, season: allocation.season, targetSeasonId: allocation.targetSeasonId };
    const settings = await read(yahooFantasyResourceUrl(allocation.yahooLeagueKey, "settings", context, "standard_json"));
    if (String(valueFor(settings, "league_key")) !== allocation.yahooLeagueKey) fail("settings_league_mismatch");
    const zone = valueFor(settings, "time_zone") ?? allocation.fallbackTimeZone;
    if (typeof zone !== "string") fail("invalid_league_time_zone");
    const date = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(transport.now()));
    if (date !== allocation.rosterDate) fail("approved_roster_date_changed");
    const roster = await read(`${YAHOO_FANTASY_API_BASE_URL}/team/${encodeURIComponent(allocation.yahooTeamKey)}/roster;date=${date}?format=json`);
    const reported = fields(valueFor(roster, "roster"));
    if (String(valueFor(roster, "team_key")) !== allocation.yahooTeamKey || ![true, 1, "1"].includes(valueFor(roster, "is_owned_by_current_login"))
      || reported?.date !== date || reported?.coverage_type !== "date") fail("provider_owned_roster_mismatch");
    for (const start of [0, 25]) {
      const page = await read(`${YAHOO_FANTASY_API_BASE_URL}/league/${encodeURIComponent(allocation.yahooLeagueKey)}/players;status=A;sort=OR;start=${start};count=25/ownership?format=json`);
      const players = valueFor(page, "players");
      const count = Array.isArray(players) && !players.length ? 0 : Number(fields(players)?.count);
      if (String(valueFor(page, "league_key")) !== allocation.yahooLeagueKey || !Number.isInteger(count) || count < 0 || count > 25) fail("availability_scope_mismatch");
      if (count < 25) break;
    }
    const result = { status: "captured_private_sources", allocationSHA256: input.approvedSHA256, owner,
      databaseRequests: transport.databaseRequests, yahooRequests: transport.yahooRequests, bodyBytes: transport.bodyBytes,
      candidateLimit: 50, availabilityComplete: false, productAdmission: false, writes: 0, tokenRefreshes: 0 };
    privateWrite(resolve(input.output, "receipt.json"), JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    const reason = error instanceof CaptureError ? error.code : "capture_failed";
    transport.ledger("capture_stopped", { reason });
    privateWrite(resolve(input.output, "receipt.json"), JSON.stringify({ status: "stopped", reason, owner,
      databaseRequests: transport.databaseRequests, yahooRequests: transport.yahooRequests, bodyBytes: transport.bodyBytes, tokenRefreshes: 0, writes: 0 }));
    return { status: "stopped", reason, databaseRequests: transport.databaseRequests, yahooRequests: transport.yahooRequests };
  }
}

export async function cli(argv: string[]) {
  const args = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) {
    if (!["--allocation", "--execute-approved-sha256", "--approval-ref", "--out"].includes(argv[i]) || !argv[i + 1] || args.has(argv[i])) fail("invalid_arguments");
    args.set(argv[i], argv[i + 1]);
  }
  if (!args.has("--allocation")) fail("allocation_required");
  const bytes = readFileSync(args.get("--allocation")!);
  if (bytes.length > 128 * 1024) fail("allocation_too_large");
  const allocation = validateAllocation(JSON.parse(bytes.toString("utf8")));
  const digest = sha(bytes);
  if (!args.has("--execute-approved-sha256")) return { mode: "plan_only", allocationSHA256: digest, limits: LIMITS, networkRequests: 0 };
  if (args.get("--execute-approved-sha256") !== digest || !args.get("--approval-ref")?.trim() || !args.get("--out")) fail("exact_approval_required");
  // Only exact approved execution may load the web server's normal configuration in memory.
  const requireWeb = createRequire(resolve(__dirname, "../../../web/package.json"));
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    requireWeb("@next/env").loadEnvConfig(resolve(__dirname, "../../../web"), true, { info() {}, error() {} });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (url !== `https://${allocation.projectRef}.supabase.co` || !key) fail("server_configuration_unavailable");
  const { createClient } = requireWeb("@supabase/supabase-js");
  return captureYahooSources({ allocationBytes: bytes, approvedSHA256: digest, approvalRef: args.get("--approval-ref")!, output: resolve(args.get("--out")!),
    clientFactory: boundedFetch => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: boundedFetch } }) });
}
if (require.main === module) cli(process.argv.slice(2)).then(result => {
  console.log(JSON.stringify(result));
  if ("status" in result && result.status === "stopped") process.exitCode = 1;
})
  .catch(() => { console.error("Private Yahoo source capture stopped; no automatic retry."); process.exitCode = 1; });
