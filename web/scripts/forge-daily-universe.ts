/** v2 FORGE `universe` stage (tasks/artifacts/forge-daily-automation-2026-10-17/DESIGN.md). Sub-stages:
 *   capture  - three read-only Yahoo GETs (owned roster, available pages start=0 and 25); plan-only unless --execute true
 *   query    - offline: capture receipts -> the one bounded read-only identity SQL, to run in a READ ONLY transaction
 *   resolve  - offline: capture receipts + identity rows (+ an optional previous universe) -> universe.json
 * Nothing here writes to a database; the provider client's own token refresh is the only account-side effect. */
import { appendFileSync, closeSync, fsyncSync, mkdirSync, openSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { boundedFile, privateWrite } from "./native-baseline-cadence";
import { buildYahooUniverse, yahooUniverseIdentityQuery, parseYahooUniverseCapture, yahooUniverseRequestUrls } from "../lib/player-forecasts/yahooUniverse";

const ORIGIN = "https://fyhftlxokyjtpndbkfse.supabase.co";
const MAX_INPUT = 8 * 1024 * 1024;
const fail = (reason: string): never => { throw new Error(reason); };
const nyDate = (instant: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(instant);

function parse(argv: string[], allowed: string[]) {
  const args = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) {
    if (!allowed.includes(argv[i]) || argv[i + 1] === undefined || args.has(argv[i])) fail("invalid_arguments");
    args.set(argv[i], argv[i + 1]);
  }
  return args;
}
const output = (path: string) => { const out = resolve(path); mkdirSync(out, { mode: 0o700 }); return out; };
const input = (args: Map<string, string>, name: string) => boundedFile(args.get(`--${name}`) ?? fail(`missing_${name}`),
  args.get(`--${name}-sha256`) ?? fail(`missing_${name}_sha256`), MAX_INPUT);
const scopeOf = (capture: any) => capture.scope ?? fail("missing_capture_scope");

export async function runForgeDailyUniverse(argv: string[], now = () => new Date()) {
  const [stage, ...rest] = argv;
  if (stage === "capture") {
    const args = parse(rest, ["--allocation", "--allocation-sha256", "--date", "--out", "--execute"]);
    const { validateYahooUniverseAllocation, captureYahooUniverseOriginals, YAHOO_UNIVERSE_CAPTURE_LIMITS } = await import("../lib/player-forecasts/yahooUniverseCapture");
    const allocation = validateYahooUniverseAllocation(input(args, "allocation")), date = args.get("--date") ?? fail("missing_date");
    const urls = yahooUniverseRequestUrls(allocation, date), execute = args.get("--execute") === "true";
    if (execute && nyDate(now()) !== date) fail("capture_not_on_run_date");
    const out = output(args.get("--out") ?? fail("missing_out"));
    const scope = { leagueKey: allocation.leagueKey, teamKey: allocation.teamKey, seasonId: allocation.seasonId };
    privateWrite(resolve(out, "plan.json"), { urls, scope, limits: YAHOO_UNIVERSE_CAPTURE_LIMITS, execute, recordedAt: now().toISOString() });
    if (!execute) return { stage: "universe capture", status: "plan_only", requests: urls.length, networkRequests: 0, out };
    const requireWeb = createRequire(resolve(__dirname, "../package.json"));
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) requireWeb("@next/env").loadEnvConfig(resolve(__dirname, ".."), true, { info() {}, error() {} });
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim(), key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (url !== ORIGIN || !key) fail("normal_server_configuration_unavailable");
    const db = requireWeb("@supabase/supabase-js").createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const event = (action: string, fields: Record<string, unknown>) => { const fd = openSync(resolve(out, "ledger.jsonl"), "a", 0o600);
      try { appendFileSync(fd, JSON.stringify({ at: new Date().toISOString(), action, ...fields }) + "\n"); fsyncSync(fd); } finally { closeSync(fd); } };
    const result = await captureYahooUniverseOriginals({ db, allocation, date, event });
    privateWrite(resolve(out, "receipts.json"), { scope, date, ...result });
    return { stage: "universe capture", status: result.failures.length ? "stopped" : "captured", requests: result.attempted,
      receipts: result.receipts.length, failures: result.failures, out };
  }
  if (stage === "query") {
    const args = parse(rest, ["--capture", "--capture-sha256", "--date", "--out"]);
    const capture = input(args, "capture"), date = args.get("--date") ?? fail("missing_date");
    if (capture.failures?.length || capture.date !== date) fail("capture_incomplete");
    const parsed = parseYahooUniverseCapture(capture.receipts, scopeOf(capture), date);
    const query = yahooUniverseIdentityQuery(parsed.keys, scopeOf(capture));
    const out = output(args.get("--out") ?? fail("missing_out"));
    privateWrite(resolve(out, "identity-query.json"), { ...query, expectedRows: { min: query.keys.length, max: 2 * query.keys.length } });
    return { stage: "universe query", status: "query_ready", keys: query.keys.length, sqlSha256: query.sqlSha256, networkRequests: 0, out };
  }
  if (stage === "resolve") {
    const args = parse(rest, ["--capture", "--capture-sha256", "--identity-rows", "--identity-rows-sha256", "--date", "--previous", "--previous-sha256", "--out"]);
    const capture = input(args, "capture"), rows = input(args, "identity-rows"), date = args.get("--date") ?? fail("missing_date");
    if (capture.failures?.length || capture.date !== date) fail("capture_incomplete");
    const previous = args.has("--previous") ? input(args, "previous") : null;
    const universe = buildYahooUniverse({ receipts: capture.receipts, identityRows: rows, scope: scopeOf(capture), date,
      previous: previous ? previous.universe?.players ?? previous.players ?? fail("previous_universe_shape") : undefined });
    const out = output(args.get("--out") ?? fail("missing_out"));
    privateWrite(resolve(out, "universe.json"), { ...universe, captureSha256: args.get("--capture-sha256"), identityRowsSha256: args.get("--identity-rows-sha256"),
      previousSha256: args.get("--previous-sha256") ?? null });
    return { stage: "universe resolve", status: universe.status, ownedComplete: universe.ownedComplete, counts: universe.counts,
      proposedConflicts: Object.values(universe.injury.proposedKnownConflicts).filter(value => value === true).length,
      unchanged: universe.change?.unchanged ?? null, networkRequests: 0, databaseWrites: 0, out };
  }
  return fail("universe_stage_required");
}
if (require.main === module) runForgeDailyUniverse(process.argv.slice(2)).then(result => console.log(JSON.stringify(result)))
  .catch(error => { console.error(error instanceof Error ? error.message : "forge-daily-universe stopped"); process.exitCode = 1; });
