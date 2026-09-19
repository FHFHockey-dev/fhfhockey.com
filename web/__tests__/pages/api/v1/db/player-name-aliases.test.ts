// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ roster: vi.fn(), send: vi.fn(), lookup: vi.fn(), importIdentity: vi.fn() }));
vi.mock("utils/adminOnlyMiddleware", () => ({ default: (handler: unknown) => handler }));
vi.mock("lib/sources/playerAliasReviewToken", () => ({ verifyPlayerAliasReviewToken: () => false, createPlayerAliasQueueReviewToken: () => "fixture", createPlayerAliasReviewToken: () => "fixture" }));
vi.mock("lib/sources/lineSourceProcessing", () => ({ fetchRosterEntriesByTeam: mocks.roster }));
vi.mock("lib/sources/nhlProspectIdentity", () => ({ fetchNhlPlayerIdentity: mocks.lookup, importNhlIdentity: mocks.importIdentity }));
vi.mock("resend", () => ({ Resend: class { emails = { send: mocks.send }; } }));
import handler from "pages/api/v1/db/player-name-aliases";
import sendDigest from "pages/api/v1/db/send-player-name-alias-review";

function fixture() {
  const writes: Array<{ table: string; value: any }> = [];
  const supabase = { from: (table: string) => {
    const query: any = {
      select: () => query, eq: () => query,
      upsert: (value: unknown) => { writes.push({ table, value }); return query; },
      update: (value: unknown) => { writes.push({ table, value }); return query; },
      single: async () => ({ error: null, data: table === "players" ? { id: 8476389, fullName: "Vincent Trocheck" }
        : table === "lineup_unresolved_player_names" ? { id: "pending", raw_name: "Trocheck", normalized_name: "trocheck", team_id: 68, metadata: {} } : { id: "alias" } }),
      then: (resolve: (result: unknown) => void) => Promise.resolve({ error: null }).then(resolve),
    };
    return query;
  } };
  const res: any = { statusCode: 200, body: null, status: (code: number) => { res.statusCode = code; return res; }, json: (body: unknown) => { res.body = body; return res; } };
  const req: any = { method: "POST", query: {}, supabase, body: { unresolvedId: "pending", playerId: 8476389, alias: "Trocheck" } };
  return { req, res, writes };
}

describe("player alias and membership review", () => {
  beforeEach(() => { vi.stubEnv("TWEET_PIPELINE_INTERPRETATION_ENABLED", "true"); mocks.roster.mockResolvedValue(new Map()); });
  afterEach(() => vi.unstubAllEnvs());
  it("saves identity without inventing a transfer and keeps missing membership pending", async () => {
    const { req, res, writes } = fixture();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(writes.find((write) => write.table === "lineup_unresolved_player_names")?.value).toMatchObject({ status: "pending", metadata: { reviewKind: "missing_membership", identityResolved: true } });
    expect(writes.some((write) => write.table === "players" || write.table === "rosters" || write.table === "tweet_player_memberships")).toBe(false);
    expect(writes.find((write) => write.table === "tweet_pipeline_jobs")?.value).toMatchObject({ status: "pending", payload: { teamId: 68, playerId: 8476389, afterId: null } });
  });
  it("resolves a supported identity and schedules bounded replay", async () => {
    mocks.roster.mockResolvedValue(new Map([[68, [{ playerId: 8476389 }]]]));
    const { req, res, writes } = fixture();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(writes.find((write) => write.table === "lineup_unresolved_player_names")?.value.status).toBe("resolved");
  });
  it("records explicitly reviewed camp evidence separately from historical rosters", async () => {
    const { req, res, writes } = fixture();
    req.body.membershipSourceUrl = "https://www.nhl.com/utah/news/camp-roster";
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(writes.find((write) => write.table === "tweet_player_memberships")?.value).toMatchObject({ team_id: 68, player_id: 8476389, membership_kind: "camp", source_url: req.body.membershipSourceUrl });
    expect(writes.some((write) => write.table === "rosters")).toBe(false);
  });
  it("rejects unsupported membership evidence before making changes", async () => {
    const { req, res, writes } = fixture();
    req.body.membershipSourceUrl = "https://nhl.com.untrusted.invalid/camp";
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(writes).toEqual([]);
  });
  it("does not email overlapping digests while another sender owns the recipient claim", async () => {
    vi.stubEnv("PLAYER_ALIAS_REVIEW_EMAIL", "review@example.invalid");
    vi.stubEnv("TWEET_PIPELINE_PUBLISHING_ENABLED", "true");
    mocks.send.mockClear();
    const { req, res, writes } = fixture();
    req.supabase.rpc = vi.fn(async () => ({ data: false, error: null }));
    await sendDigest(req, res);
    expect(res.body.skipped).toBe(true);
    expect(mocks.send).not.toHaveBeenCalled();
    expect(writes).toEqual([]);
  });
  it("sends a claimed digest with provider idempotency and marks its rows notified", async () => {
    vi.stubEnv("PLAYER_ALIAS_REVIEW_EMAIL", "review@example.invalid");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://example.invalid");
    vi.stubEnv("TWEET_PIPELINE_PUBLISHING_ENABLED", "true");
    mocks.send.mockResolvedValue({ data: { id: "email-fixture" }, error: null });
    const { req, res } = fixture();
    const updates: any[] = [];
    const query: any = { select: () => query, eq: () => query, is: () => query, order: () => query,
      limit: async () => ({ data: [{ id: "pending", raw_name: "Trocheck", team_abbreviation: "UTA", metadata: {} }], error: null }),
      update: (value: unknown) => { updates.push(value); return query; },
      then: (resolve: (value: unknown) => void) => Promise.resolve({ error: null }).then(resolve),
    };
    req.supabase = { from: () => query, rpc: async () => ({ data: true, error: null }) };
    await sendDigest(req, res);
    expect(res.body.success).toBe(true);
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({ to: "review@example.invalid" }), { idempotencyKey: expect.stringMatching(/^alias-digest:/) });
    expect(updates.some((update) => update.metadata?.aliasReviewNotifiedAt)).toBe(true);
  });
  it("looks up a missing NHL ID without writing until the reviewer saves", async () => {
    const { req, res, writes } = fixture();
    req.method = "GET"; req.query = { nhlId: "8485689" };
    mocks.lookup.mockResolvedValue({ nhlId: 8485689, fullName: "Jacob Cloutier", currentTeamId: 52 });
    await handler(req, res);
    expect(res.body.lookup.fullName).toBe("Jacob Cloutier");
    expect(writes).toEqual([]);
  });
  it("revalidates and imports an NHL identity on save, ignoring client identity details", async () => {
    const { req, res } = fixture();
    req.body.importNhlIdentity = true;
    req.body.fullName = "Client supplied name";
    mocks.lookup.mockResolvedValue({ nhlId: 8476389, fullName: "Vincent Trocheck" });
    mocks.importIdentity.mockResolvedValue({ availableToPipeline: true });
    await handler(req, res);
    expect(mocks.lookup).toHaveBeenCalledWith(8476389, true);
    expect(mocks.importIdentity).toHaveBeenCalledWith(req.supabase, { nhlId: 8476389, fullName: "Vincent Trocheck" });
    expect(res.body.success).toBe(true);
  });
  it("returns an actionable lookup error without writes", async () => {
    const { req, res, writes } = fixture();
    req.method = "GET"; req.query = { nhlId: "8485689" };
    mocks.lookup.mockRejectedValue(new Error("NHL profile unavailable"));
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("NHL profile unavailable");
    expect(writes).toEqual([]);
  });

});
