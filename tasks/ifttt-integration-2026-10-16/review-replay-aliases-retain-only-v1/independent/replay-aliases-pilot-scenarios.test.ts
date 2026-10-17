// @vitest-environment node
// Independent R22 review scenarios for the alias-replay cron under IFTTT pilot configuration.
// Run through ../harness/vitest.review.config.mjs: the route import is the live file unless MUTANT redirects it.
// Supabase, fetch, admin middleware, attribution and roster helpers are mocked; iftttIntakePolicy, tweetInterpretation,
// projectedLineups and linesCccIngestion run with their real bytes. No network.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ supabase: null as any }));
vi.mock("utils/adminOnlyMiddleware", () => ({ default: (handler: any) => (req: any, res: any) => { req.supabase = state.supabase; return handler(req, res); } }));
vi.mock("lib/sources/tweetAttribution", () => ({ retryTweetAttribution: async () => ({ resolved: 0, skipped: true }) }));
vi.mock("lib/sources/lineSourceProcessing", () => ({ fetchRosterEntriesByTeam: async () => new Map([[30, []]]), fetchPlayerNameAliases: async () => [],
  applyPlayerNameAliasesToRosterMap: ({ rosterByTeam }: any) => rosterByTeam, sendPlayerAliasReviewEmailForQueuedNames: async () => null }));
vi.mock("lib/sources/playerIdentity", () => ({ rosterSeasonForDate: () => 20262027, resolvePlayerIdentity: () => ({ status: "matched", player: { playerId: 8400001 } }) }));
import handler from "pages/api/v1/db/replay-player-aliases";

const snowflake = (iso: string) => ((BigInt(Date.parse(iso)) - BigInt("1288834974657")) << BigInt(22)).toString();
type Row = { id: number; at: string; source?: string };
type Write = { table: string; value: any; filters: unknown[][] };

function harness(rows: Row[], afterId: number | null) {
  const job = { job_key: "alias-replay:review", payload: { normalizedName: "review skater", teamId: 30, playerId: 8400001, alias: "Review", afterId } };
  const data = rows.map(({ id, at, source = "gamedaylines" }) => ({ id, raw_name: "Review Skater", tweet_id: snowflake(at), source, status: "pending",
    created_at: at, metadata: source === "lines_ccc" ? {} : { sourceKey: source } }));
  const writes: Write[] = [], selects: Array<{ table: string; filters: unknown[][] }> = [];
  state.supabase = {
    rpc: async () => ({ data: true, error: null }),
    from: (table: string) => {
      const filters: unknown[][] = []; let write: Write | null = null; const q: any = {};
      for (const m of ["select", "like", "in", "lt", "lte", "gt", "eq", "is", "order", "limit"]) q[m] = (...a: unknown[]) => { filters.push([m, ...a]); return q; };
      q.update = (value: unknown) => { write = { table, value, filters }; writes.push(write); return q; };
      q.then = (resolve: any, reject: any) => {
        if (!write) selects.push({ table, filters });
        return Promise.resolve(write ? { error: null } : { data: table === "tweet_pipeline_jobs" ? [job] : data, error: null }).then(resolve, reject);
      };
      return q;
    },
  };
  const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  const run = async () => {
    const res: any = { statusCode: 200, body: null, status(c: number) { this.statusCode = c; return this; }, json(b: unknown) { this.body = b; return this; }, end() { return this; } };
    await handler({ method: "GET", query: {} } as any, res);
    return res;
  };
  const resolved = () => writes.filter((w) => w.table === "lineup_unresolved_player_names" && w.value.status === "resolved")
    .map((w) => w.filters.find(([m, c]) => m === "eq" && c === "id")?.[2]);
  const jobWrites = () => writes.filter((w) => w.table === "tweet_pipeline_jobs").map((w) => w.value);
  const requests = () => fetchMock.mock.calls.map((call) => { const u = new URL(String((call as unknown[])[0])); return { path: u.pathname, params: Object.fromEntries(u.searchParams) }; });
  return { run, resolved, jobWrites, requests, selects, data };
}

const PILOT_VARS = ["IFTTT_RECEIPT_VARIANTS_ENABLED", "IFTTT_INTAKE_POLICY", "IFTTT_INTAKE_STOP"] as const;
const activePilot = () => { vi.stubEnv("IFTTT_RECEIPT_VARIANTS_ENABLED", "true"); vi.stubEnv("IFTTT_INTAKE_POLICY", "{}"); vi.stubEnv("TWEET_CLAIMS_MODE", "shadow"); };
const HIST = "2026-10-14T23:00:00.000Z", CURRENT = "2026-10-17T15:30:00.000Z";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-17T16:00:00.000Z"));
  vi.stubEnv("TWEET_PIPELINE_INTERPRETATION_ENABLED", "true"); vi.stubEnv("TWEET_PIPELINE_PUBLISHING_ENABLED", "false");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://trusted.example"); vi.stubEnv("CRON_SECRET", "review");
  for (const name of PILOT_VARS) vi.stubEnv(name, undefined);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("R22 review: alias-replay cron under pilot configuration", () => {
  it.each([
    ["no pilot variables", {}, 1],
    ["all three explicitly 'false'/absent-policy", { IFTTT_RECEIPT_VARIANTS_ENABLED: "false", IFTTT_INTAKE_STOP: "false" }, 1],
    ["flag 'true' only", { IFTTT_RECEIPT_VARIANTS_ENABLED: "true" }, 0],
    ["flag present but empty", { IFTTT_RECEIPT_VARIANTS_ENABLED: "" }, 0],
    ["policy only", { IFTTT_INTAKE_POLICY: "{}" }, 0],
    ["policy present but empty", { IFTTT_INTAKE_POLICY: "" }, 0],
    ["stop only", { IFTTT_INTAKE_STOP: "true" }, 0],
    ["stop 'false' with flag 'false' and a policy", { IFTTT_RECEIPT_VARIANTS_ENABLED: "false", IFTTT_INTAKE_STOP: "false", IFTTT_INTAKE_POLICY: "{}" }, 0],
  ])("env shape %s %j -> %i processor request(s)", async (_label, env, expected) => {
    for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
    const h = harness([{ id: 101, at: HIST }, { id: 102, at: CURRENT }], null);
    const res = await h.run();
    expect(res.statusCode).toBe(200);
    expect(h.requests()).toHaveLength(expected);
  });

  it("holds the cursor on the first current-day row; later historical rows in the same job also wait", async () => {
    activePilot();
    const h = harness([{ id: 101, at: HIST }, { id: 102, at: CURRENT }, { id: 103, at: HIST }], null);
    await h.run();
    expect(h.requests()).toEqual([]);
    expect(h.resolved()).toEqual([101]);
    expect(h.jobWrites()).toEqual([expect.objectContaining({ status: "pending", attempts: 0, payload: expect.objectContaining({ afterId: 101 }) })]);
  });

  it("keeps a page of only current-day rows held with the cursor unchanged", async () => {
    activePilot();
    const h = harness(Array.from({ length: 10 }, (_, i) => ({ id: 201 + i, at: CURRENT })), 200);
    await h.run();
    expect(h.requests()).toEqual([]);
    expect(h.resolved()).toEqual([]);
    expect(h.jobWrites()).toEqual([expect.objectContaining({ status: "pending", payload: expect.objectContaining({ afterId: 200 }) })]);
  });

  it("re-claims a held job every run without progress, re-eligible immediately (head-of-line on order(job_key).limit(1))", async () => {
    activePilot();
    const h = harness([{ id: 102, at: CURRENT }], 101);
    for (let i = 0; i < 3; i++) await h.run();
    expect(h.requests()).toEqual([]);
    expect(h.resolved()).toEqual([]);
    expect(h.jobWrites()).toHaveLength(3);
    for (const value of h.jobWrites()) {
      expect(value).toMatchObject({ status: "pending", attempts: 0, lease_expires_at: null, payload: { afterId: 101 } });
      expect(value).not.toHaveProperty("next_attempt_at");
    }
    const jobQuery = h.selects.find((s) => s.table === "tweet_pipeline_jobs")!.filters;
    expect(jobQuery).toEqual(expect.arrayContaining([["order", "job_key"], ["limit", 1], ["in", "status", ["pending", "failed", "running"]]]));
  });

  it.each([
    ["23:59 EDT on the report day", "2026-10-18T03:59:00.000Z", { requests: 0, resolved: [], status: "pending", afterId: 101 }],
    ["00:00:30 EDT the next day", "2026-10-18T04:00:30.000Z", { requests: 0, resolved: [102], status: "complete", afterId: 102 }],
  ])("Eastern midnight: at %s the held row is resolved only once it is historical, never sent", async (_label, clock, expected) => {
    activePilot();
    vi.setSystemTime(new Date(clock));
    const h = harness([{ id: 102, at: CURRENT }], 101);
    await h.run();
    expect(h.requests()).toHaveLength(expected.requests);
    expect(h.resolved()).toEqual(expected.resolved);
    expect(h.jobWrites()).toEqual([expect.objectContaining({ status: expected.status, payload: expect.objectContaining({ afterId: expected.afterId }) })]);
  });

  it("covers the update-lines-ccc branch too: one ccc POST without pilot, none with a stopped pilot", async () => {
    const legacy = harness([{ id: 102, at: CURRENT, source: "lines_ccc" }], 101);
    await legacy.run();
    expect(legacy.requests()).toEqual([{ path: "/api/v1/db/update-lines-ccc", params: { date: "2026-10-17", tweetId: legacy.data[0].tweet_id, reprocess: "true", limit: "1" } }]);
    vi.unstubAllGlobals();
    vi.stubEnv("IFTTT_INTAKE_STOP", "true");
    const piloted = harness([{ id: 102, at: CURRENT, source: "lines_ccc" }], 101);
    await piloted.run();
    expect(piloted.requests()).toEqual([]);
    expect(piloted.jobWrites()).toEqual([expect.objectContaining({ status: "pending", payload: expect.objectContaining({ afterId: 101 }) })]);
  });
});
