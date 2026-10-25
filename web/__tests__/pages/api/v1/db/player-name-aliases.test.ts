// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ roster: vi.fn(), send: vi.fn(), lookup: vi.fn(), importIdentity: vi.fn(), verifyReviewToken: vi.fn(), admin: vi.fn(), reviewClient: null as any, directory: vi.fn() }));
vi.mock("utils/adminOnlyMiddleware", () => ({ default: (handler: any) => (req: any, res: any) => { mocks.admin(); return handler(req, res); } }));
vi.mock("lib/supabase/server", () => ({ default: { from: (table: string) => mocks.reviewClient.from(table) } }));
vi.mock("lib/sources/playerAliasReviewToken", () => ({ verifyPlayerAliasReviewToken: mocks.verifyReviewToken, createPlayerAliasQueueReviewToken: () => "fixture", createPlayerAliasReviewToken: () => "fixture" }));
vi.mock("lib/sources/playerIdentity", async (importOriginal) => ({ ...await importOriginal<typeof import("lib/sources/playerIdentity")>(), fetchPlayerIdentityDirectory: mocks.directory, fetchRegisteredPlayerIdentities: async () => [] }));
vi.mock("lib/sources/lineSourceProcessing", () => ({ fetchRosterEntriesByTeam: mocks.roster }));
vi.mock("lib/sources/nhlProspectIdentity", () => ({ fetchNhlPlayerIdentity: mocks.lookup, importNhlIdentity: mocks.importIdentity }));
vi.mock("resend", () => ({ Resend: class { emails = { send: mocks.send }; } }));
import handler from "pages/api/v1/db/player-name-aliases";
import sendDigest from "pages/api/v1/db/send-player-name-alias-review";
import { resolvePlayerIdentity } from "lib/sources/playerIdentity";

function fixture() {
  const writes: Array<{ table: string; value: any; options?: unknown }> = [];
  const reads: Array<{ table: string; columns: string }> = [];
  const unresolved: any = { id: "pending", raw_name: "Trocheck", normalized_name: "trocheck", team_id: 68, metadata: {} };
  const selectedPlayer = { id: 8476389, fullName: "Vincent Trocheck", lastName: "Trocheck" };
  const contextTables: Record<string, any[]> = {};
  const supabase = { from: (table: string) => {
    const query: any = {
      select: (columns: string) => { reads.push({ table, columns }); return query; }, eq: () => query, in: () => query, order: () => query,
      limit: async () => ({ data: contextTables[table] ?? [unresolved], error: null }),
      upsert: (value: unknown, options: unknown) => { writes.push({ table, value, options }); return query; },
      update: (value: unknown) => { writes.push({ table, value }); return query; },
      single: async () => ({ error: null, data: table === "players" ? selectedPlayer
        : table === "lineup_unresolved_player_names" ? unresolved : { id: "alias" } }),
      then: (resolve: (result: unknown) => void) => Promise.resolve({ error: null, data: table === "players" ? contextTables.players ?? [{ id: 8476389, fullName: "Vincent Trocheck", lastName: "Trocheck" }, { id: 8478047, fullName: "Michael Bunting", lastName: "Bunting" }] : null }).then(resolve),
    };
    return query;
  } };
  const res: any = { statusCode: 200, body: null, status: (code: number) => { res.statusCode = code; return res; }, json: (body: unknown) => { res.body = body; return res; } };
  const req: any = { method: "POST", query: {}, supabase, body: { unresolvedId: "pending", playerId: 8476389, alias: "Trocheck" } };
  return { req, res, writes, reads, unresolved, selectedPlayer, contextTables };
}

describe("player alias and membership review", () => {
  const identities = [
    { playerId: 8481559, fullName: "Jack Hughes", lastName: "Hughes", position: "C", teamId: 1 },
    { playerId: 8482684, fullName: "Luke Hughes", lastName: "Hughes", position: "D", teamId: 1 },
  ];
  function datedHughesFixture(situation = "es_defense") {
    const fixtureData = fixture();
    const text = "Mantha - Hughes - Bratt\nHughes - Pesce";
    const start = situation === "es_forward" ? text.indexOf("Hughes") : text.lastIndexOf("Hughes");
    Object.assign(fixtureData.unresolved, { raw_name: "Hughes", normalized_name: "hughes", team_id: 1, context_text: text, metadata: {
      captureKey: "gamedaylines:2026-10-06:1:fixture", situation, candidates: identities.map((player) => player.playerId), evidence: { start, end: start + 6 },
    } });
    fixtureData.contextTables.line_source_snapshots = [{ capture_key: fixtureData.unresolved.metadata.captureKey, team_id: 1, snapshot_date: "2026-10-06", tweet_posted_at: "2026-10-06T22:46:00Z", roster_revision: identities.map((player) => [player.playerId, player.fullName, player.lastName, player.teamId, player.position].join(":")).join("|") }];
    fixtureData.contextTables.rosters = identities.map((player) => ({ playerId: player.playerId, teamId: 1, seasonId: 20262027, created_at: "2026-09-19T00:00:00Z", ended_at: null, is_current: true }));
    mocks.directory.mockResolvedValue(identities);
    return fixtureData;
  }
  beforeEach(() => {
    vi.stubEnv("TWEET_PIPELINE_INTERPRETATION_ENABLED", "true"); mocks.roster.mockResolvedValue(new Map());
    mocks.verifyReviewToken.mockReturnValue(false); mocks.admin.mockClear(); mocks.directory.mockResolvedValue([]);
  });
  afterEach(() => vi.unstubAllEnvs());
  it("saves identity without inventing a transfer and keeps missing membership pending", async () => {
    const { req, res, writes } = fixture();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(writes.find((write) => write.table === "lineup_unresolved_player_names")?.value).toMatchObject({ status: "pending", metadata: { reviewKind: "missing_membership", identityResolved: true } });
    expect(writes.some((write) => write.table === "players" || write.table === "rosters" || write.table === "tweet_player_memberships")).toBe(false);
    expect(writes.find((write) => write.table === "tweet_pipeline_jobs")?.value).toMatchObject({ status: "pending", payload: { teamId: 68, playerId: 8476389, afterId: null } });
    expect(res.body.message).toContain("remains pending");
  });
  it("resolves a supported identity and schedules bounded replay", async () => {
    mocks.roster.mockResolvedValue(new Map([[68, [{ playerId: 8476389 }]]]));
    const { req, res, writes } = fixture();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(writes.find((write) => write.table === "lineup_unresolved_player_names")?.value.status).toBe("resolved");
    expect(writes.find((write) => write.table === "tweet_pipeline_jobs")).toMatchObject({
      options: { onConflict: "job_key" },
      value: { job_key: "alias-replay:pending", status: "pending", attempts: 0, lease_expires_at: null, payload: { normalizedName: "trocheck", teamId: 68, playerId: 8476389, alias: "Trocheck", afterId: null } },
    });
  });
  it("returns saved identity receipts in queue reads", async () => {
    const { req, res, reads, unresolved, writes } = fixture();
    unresolved.resolved_player_id = 8476389; unresolved.resolved_alias_id = "saved-alias";
    unresolved.metadata = { identityResolved: true, reviewKind: "missing_membership", savedAlias: "Troch" };
    req.method = "GET";
    await handler(req, res);
    expect(reads.find((read) => read.table === "lineup_unresolved_player_names")?.columns).toContain("resolved_player_id, resolved_alias_id");
    expect(res.body.unresolvedNames[0]).toMatchObject({ resolved_player_id: 8476389, resolved_alias_id: "saved-alias", metadata: { identityResolved: true } });
    expect(writes).toEqual([]);
  });
  it.each([{ supported: [] }, { supported: [8476389] }, { supported: [8476389, 8478047] }])("checks membership for both split identities: $supported", async ({ supported }) => {
    mocks.roster.mockResolvedValue(new Map([[68, supported.map((playerId) => ({ playerId }))]]));
    const { req, res, writes, unresolved } = fixture();
    unresolved.raw_name = "Troch  Bunts";
    req.body = { unresolvedId: "pending", action: "split", parts: [{ alias: " Troch ", playerId: 8476389 }, { alias: "Bunts", playerId: 8478047 }] };
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(writes.find((write) => write.table === "lineup_player_name_aliases")).toMatchObject({
      options: { onConflict: "normalized_alias,player_id" },
      value: [{ alias: "Troch", player_id: 8476389, team_id: 68 }, { alias: "Bunts", player_id: 8478047, team_id: 68 }],
    });
    expect(writes.find((write) => write.table === "lineup_unresolved_player_names")?.value).toMatchObject({
      status: supported.length === 2 ? "resolved" : "pending", resolved_alias_id: null,
      metadata: { identityResolved: true, splitPlayerIds: [8476389, 8478047], splitAliases: ["Troch", "Bunts"], reviewKind: supported.length === 2 ? "invalid_extraction" : "missing_membership" },
    });
    expect(writes.some((write) => ["tweet_pipeline_jobs", "players", "rosters", "tweet_player_memberships"].includes(write.table))).toBe(false);
    expect(res.body.message).toContain("does not confirm a lineup or defense pairing");
    expect(res.body.message.includes("Membership still needs review")).toBe(supported.length !== 2);
  });
  it("rejects duplicate split player IDs before writing", async () => {
    const { req, res, writes } = fixture();
    req.body = { unresolvedId: "pending", action: "split", parts: [{ alias: "Troch", playerId: 8476389 }, { alias: "Bunts", playerId: 8476389 }] };
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Choose two different players.");
    expect(writes).toEqual([]);
  });
  it.each([0, -1, 1.5, "invalid"])("rejects invalid split IDs before writing: %s", async (playerId) => {
    const { req, res, writes } = fixture();
    req.body = { unresolvedId: "pending", action: "split", parts: [{ alias: "Troch", playerId }, { alias: "Bunts", playerId: 8478047 }] };
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(writes).toEqual([]);
  });
  it("accepts a token-only split review without requiring an admin session", async () => {
    const { req, res, writes } = fixture();
    mocks.reviewClient = req.supabase;
    delete req.supabase;
    mocks.verifyReviewToken.mockImplementation(({ token, unresolvedId }) => token === "review-fixture" && unresolvedId === "pending");
    req.body = { unresolvedId: "pending", action: "split", reviewToken: "review-fixture", parts: [{ alias: "Troch", playerId: 8476389 }, { alias: "Bunts", playerId: 8478047 }] };
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(mocks.admin).not.toHaveBeenCalled();
    expect(writes.filter((write) => write.table === "lineup_player_name_aliases")).toHaveLength(1);
  });
  it("clears old split metadata when explicitly reassigned to one identity", async () => {
    const { req, res, writes, unresolved } = fixture();
    unresolved.metadata = { splitPlayerIds: [8476389, 8478047], splitAliases: ["Troch", "Bunts"], reason: "invalid_extraction" };
    await handler(req, res);
    const metadata = writes.find((write) => write.table === "lineup_unresolved_player_names")?.value.metadata;
    expect(metadata).toMatchObject({ identityResolved: true, savedAlias: "Trocheck" });
    expect(metadata.splitPlayerIds).toBeUndefined();
    expect(metadata.splitAliases).toBeUndefined();
  });
  it.each(["es_forward", "es_defense"])("returns a review-only preference using captured position and dated team records for %s", async (situation) => {
    const { req, res, writes } = datedHughesFixture(situation);
    mocks.directory.mockResolvedValue(identities.map((player) => ({ ...player, position: "G", teamId: 30 })));
    req.method = "GET";
    await handler(req, res);
    expect(res.body.unresolvedNames[0].review).toMatchObject({ sourceDate: "2026-10-06", seasonId: 20262027, teamId: 1, preferredPlayerId: situation === "es_forward" ? 8481559 : 8482684, ambiguousSurname: true });
    expect(res.body.unresolvedNames[0].review.candidates.map((player: any) => player.id)).toEqual([8481559, 8482684]);
    expect(writes).toEqual([]);
  });
  it.each(["created_later", "ended_earlier", "conflicting_team", "missing_time", "missing_capture_position"])("does not substitute current-world membership or position for %s source evidence", async (kind) => {
    const { req, res, contextTables, unresolved } = datedHughesFixture("es_forward");
    if (kind === "created_later") contextTables.rosters[0].created_at = "2026-10-07T00:00:00Z";
    if (kind === "ended_earlier") contextTables.rosters[0].ended_at = "2026-10-05T00:00:00Z";
    if (kind === "conflicting_team") contextTables.rosters.push({ ...contextTables.rosters[0], teamId: 30 });
    if (kind === "missing_time") { contextTables.line_source_snapshots = []; delete unresolved.metadata.captureKey; }
    if (kind === "missing_capture_position") contextTables.line_source_snapshots[0].roster_revision = null;
    req.method = "GET";
    await handler(req, res);
    expect(res.body.unresolvedNames[0].review.preferredPlayerId).toBeNull();
  });
  it("assigns only the selected Hughes occurrence without learning a surname alias or scheduling replay", async () => {
    const { req, res, writes, selectedPlayer } = datedHughesFixture();
    Object.assign(selectedPlayer, { id: 8482684, fullName: "Luke Hughes", lastName: "Hughes" });
    req.body = { unresolvedId: "pending", action: "assign_occurrence", playerId: 8482684 };
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({ table: "lineup_unresolved_player_names", value: { status: "resolved", resolved_player_id: 8482684, resolved_alias_id: null, metadata: { resolutionScope: "occurrence", identityResolved: true } } });
    expect(res.body.message).toContain("No surname alias was learned");
  });
  it("keeps a source-team mismatch pending even when current player identity is known", async () => {
    const { req, res, writes, selectedPlayer, unresolved } = datedHughesFixture();
    unresolved.team_id = 12;
    Object.assign(selectedPlayer, { id: 8482684, fullName: "Luke Hughes", lastName: "Hughes" });
    req.body = { unresolvedId: "pending", action: "assign_occurrence", playerId: 8482684 };
    await handler(req, res);
    expect(writes[0]).toMatchObject({ table: "lineup_unresolved_player_names", value: { status: "pending", metadata: { reviewKind: "missing_membership" } } });
  });
  it("rejects a blanket Hughes alias before writes and rejects occurrence assignment when its target is ambiguous", async () => {
    const { req, res, writes, selectedPlayer, unresolved } = datedHughesFixture();
    Object.assign(selectedPlayer, { id: 8482684, fullName: "Luke Hughes", lastName: "Hughes" });
    req.body = { unresolvedId: "pending", playerId: 8482684, alias: "Hughes", membershipSourceUrl: "https://www.nhl.com/devils/camp" };
    await handler(req, res);
    expect(res.statusCode).toBe(409); expect(writes).toEqual([]);
    unresolved.metadata = {};
    req.body.action = "assign_occurrence";
    await handler(req, res);
    expect(res.statusCode).toBe(409); expect(writes).toEqual([]);
  });
  it("also rejects blanket shared-surname aliases in the split flow", async () => {
    const { req, res, writes, contextTables } = datedHughesFixture();
    contextTables.players = identities.map((player) => ({ id: player.playerId, fullName: player.fullName, lastName: player.lastName }));
    req.body = { unresolvedId: "pending", action: "split", parts: [{ alias: "Hughes", playerId: 8481559 }, { alias: "L. Hughes", playerId: 8482684 }] };
    await handler(req, res);
    expect(res.statusCode).toBe(409); expect(writes).toEqual([]);
    expect(res.body.message).toContain("Use initials or full names");
  });
  it.each(["Hughes.", ".HUGHES", "hUgHeS", "Húghes", "Hughes‐", "Hughes–", "Hughes−", " HUGHES.\u00a0"])("blocks the resolver-equivalent surname variant before normal or split writes: %s", async (alias) => {
    const { req, res, writes, selectedPlayer, contextTables } = datedHughesFixture();
    Object.assign(selectedPlayer, { id: 8482684, fullName: "Luke Hughes", lastName: "Hughes" });
    req.body = { unresolvedId: "pending", playerId: 8482684, alias };
    await handler(req, res);
    expect(res.statusCode).toBe(409); expect(writes).toEqual([]);
    contextTables.players = identities.map((player) => ({ id: player.playerId, fullName: player.fullName, lastName: player.lastName }));
    req.body = { unresolvedId: "pending", action: "split", parts: [{ alias, playerId: 8482684 }, { alias: "J. Hughes", playerId: 8481559 }] };
    await handler(req, res);
    expect(res.statusCode).toBe(409); expect(writes).toEqual([]);
  });
  it.each(["L. Hughes", "Luke Hughes"])("retains safe initial/full-name storage and normal replay without resolving bare Hughes: %s", async (alias) => {
    const { req, res, writes, selectedPlayer } = datedHughesFixture();
    Object.assign(selectedPlayer, { id: 8482684, fullName: "Luke Hughes", lastName: "Hughes" });
    mocks.roster.mockResolvedValue(new Map([[1, [{ playerId: 8482684 }]]]));
    req.body = { unresolvedId: "pending", playerId: 8482684, alias };
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(writes.find((write) => write.table === "lineup_player_name_aliases")?.value).toMatchObject({ alias, normalized_alias: alias.toLowerCase(), player_id: 8482684 });
    expect(writes.find((write) => write.table === "tweet_pipeline_jobs")?.value).toMatchObject({ job_key: "alias-replay:pending", payload: { playerId: 8482684, alias } });
    const players = identities.map((player) => ({ ...player, aliases: player.playerId === 8482684 ? [alias] : [] }));
    expect(resolvePlayerIdentity("Hughes", players)).toMatchObject({ status: "ambiguous" });
    expect(resolvePlayerIdentity(alias, players)).toMatchObject({ status: "matched", player: { playerId: 8482684 } });
  });
  it("uses the same resolver normalization for Unicode apostrophes and displayed punctuated ambiguity", async () => {
    const { req, res, writes, selectedPlayer, unresolved, contextTables } = datedHughesFixture();
    Object.assign(selectedPlayer, { id: 1, fullName: "Logan O'Connor", lastName: "O'Connor" });
    mocks.directory.mockResolvedValue([{ playerId: 1, fullName: "Logan O'Connor", lastName: "O'Connor" }, { playerId: 2, fullName: "Drew O'Connor", lastName: "O'Connor" }]);
    req.body = { unresolvedId: "pending", playerId: 1, alias: "O’Connor" };
    await handler(req, res);
    expect(res.statusCode).toBe(409); expect(writes).toEqual([]);
    mocks.directory.mockResolvedValue(identities);
    unresolved.raw_name = "Hughes."; unresolved.context_text = "Hughes."; unresolved.metadata.evidence = { start: 0, end: 7 };
    contextTables.line_source_snapshots = []; req.method = "GET";
    await handler(req, res);
    expect(res.body.unresolvedNames[0].review.ambiguousSurname).toBe(true);
    expect(writes).toEqual([]);
  });
  it.each(["B. Tkachuk", "Tkachuk"])("prefers Brady from the retained B. initial when both brothers have dated team support: %s", async (raw_name) => {
    const { req, res, unresolved, contextTables, writes } = datedHughesFixture("es_forward");
    const tkachuks = [{ playerId: 8480801, fullName: "Brady Tkachuk", lastName: "Tkachuk", position: "L", teamId: 13 }, { playerId: 8479314, fullName: "Matthew Tkachuk", lastName: "Tkachuk", position: "L", teamId: 13 }];
    mocks.directory.mockResolvedValue(tkachuks);
    Object.assign(unresolved, { raw_name, team_id: 13, context_text: "B. Tkachuk - Eller - Reinhart\nVerhaeghe - Bennett - M. Tkachuk", metadata: { captureKey: "gamedaylines:2026-10-10:13:fixture", situation: "es_forward", evidence: { start: raw_name === "Tkachuk" ? 3 : 0, end: 10 } } });
    contextTables.line_source_snapshots = [{ capture_key: unresolved.metadata.captureKey, team_id: 13, tweet_posted_at: "2026-10-10T20:00:00Z", roster_revision: tkachuks.map((player) => [player.playerId, player.fullName, player.lastName, player.teamId, player.position].join(":")).join("|") }];
    contextTables.rosters = tkachuks.map((player) => ({ playerId: player.playerId, teamId: 13, seasonId: 20262027, created_at: "2026-09-19T00:00:00Z", ended_at: null, is_current: true }));
    req.method = "GET";
    await handler(req, res);
    expect(res.body.unresolvedNames[0].review).toMatchObject({ preferredPlayerId: 8480801, ambiguousSurname: false });
    expect(writes).toEqual([]);
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
