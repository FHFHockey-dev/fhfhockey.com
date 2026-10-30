// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { NextApiRequest, NextApiResponse } from "next";
import { available, unavailable } from "./contracts";
import { fixtureOpportunity, fixtureOutcome, fixturePublished, FIXTURE_TARGET } from "./fixtures";
import { DEFAULT_SCORING, scoringProfile } from "./identity";
import { executeRead, ForgeReadRepository, parseReadRequest } from "./api";
import { ContextReader, createForgeReadHandler, PreparedForgeReadRepository, PreparedPlayerContext } from "./api.server";
import { PostgresHistoryStore } from "./history.server";
import { FileArtifactStore } from "./artifacts.server";

function environment() {
  const publication = fixturePublished();
  const context: PreparedPlayerContext = {
    id: "prepared-player-1", player: { id: FIXTURE_TARGET.playerId, name: "Synthetic Skater" }, publicApproved: true, asOf: "2026-01-12T04:00:00.000Z",
    games: [{ opportunity: fixtureOpportunity(), epochs: [{ id: "lock-1", gameId: FIXTURE_TARGET.gameId, adoptedAt: "2026-01-01T12:00:00.000Z", lockAt: "2026-01-11T23:00:00.000Z", scheduleRevision: "schedule-1", predecessorId: null, reopened: false, actualStartAt: null, playBegun: false, timingStatus: "provisional" }], latestVintageId: publication.vintage.id, finalVintageId: publication.vintage.id, outcome: fixtureOutcome(), events: [], freshness: { state: "stale", asOf: "2026-01-12T04:00:00.000Z", reason: "fixture_only" } }],
    excluded: [], qualifications: [], accountability: { requested: 1, forecastCount: 1, outcomeCount: 1, abstentions: 0, mae: available(1), rmse: available(1), bias: available(-1), evidenceClass: "fixture", limitations: ["synthetic_only"] },
  };
  const contexts: ContextReader = { players: vi.fn(async () => [context.player]), read: vi.fn(async () => context), readGame: vi.fn(async () => context) };
  const store = { history: vi.fn(async () => ({ revisions: [publication], nextCursor: null as string | null })), get: vi.fn(async () => publication) };
  const artifacts = { read: vi.fn(async () => { throw new Error("Unqualified API must not read artifacts"); }) };
  const repository = new PreparedForgeReadRepository(contexts, store as unknown as PostgresHistoryStore, artifacts as unknown as FileArtifactStore);
  return { context, contexts, store, artifacts, repository };
}
function response() {
  const state = { status: 0, headers: {} as Record<string, string>, body: undefined as unknown };
  const res = { setHeader(name: string, value: string) { state.headers[name] = value; }, status(code: number) { state.status = code; return res; }, json(body: unknown) { state.body = body; return res; } };
  return { state, res: res as unknown as NextApiResponse };
}

describe("bounded prepared read API", () => {
  it("parses canonical signed scoring and rejects ambiguous or unbounded queries", () => {
    const weights = { ...DEFAULT_SCORING.weights, PIM: -1 };
    expect(parseReadRequest({ operation: "score", playerId: "9900001", weights: JSON.stringify(weights) }).profile).toEqual(scoringProfile(weights));
    for (const query of [{ operation: ["history"] }, { operation: "history", playerId: "1", gameId: "-2" }, { operation: "players", q: "x".repeat(81) }, { operation: "players", secret: "x" }, { operation: "players", weights: "{}" }, { operation: "next-ten", playerId: "1", cursor: "abc" }]) expect(() => parseReadRequest(query)).toThrow();
  });
  it("passes the selected scoring identity into accountability reads", async () => {
    const repo = { accountability: vi.fn(async () => null) } as unknown as ForgeReadRepository;
    const request = parseReadRequest({ operation: "accountability", playerId: "1", weights: JSON.stringify({ ...DEFAULT_SCORING.weights, PIM: -1 }) });
    await executeRead(repo, request);
    expect(repo.accountability).toHaveBeenCalledWith(1, request.profile);
  });
  it("keeps private fields out and abstains on unqualified forecasts while scoring official outcomes", async () => {
    const env = environment();
    Object.assign(env.context.games[0].opportunity, { privateToken: "must-not-leak" });
    Object.assign(env.context.games[0].freshness, { privateToken: "must-not-leak" });
    Object.assign(env.context.accountability.mae, { privateToken: "must-not-leak" });
    const custom = scoringProfile({ ...DEFAULT_SCORING.weights, PIM: -1 });
    const view = await env.repository.player(FIXTURE_TARGET.playerId, custom);
    expect(view?.games[0].latestRevision?.value.state).toBe("unavailable");
    expect(view?.games[0].actual.value).toEqual(available(-2));
    expect(view?.accountability.mae).toEqual(unavailable("profile_metrics_unavailable"));
    expect(JSON.stringify(view)).not.toContain("must-not-leak");
    expect(JSON.stringify(view)).not.toContain("sourceManifest");
    expect(env.artifacts.read).not.toHaveBeenCalled();
    expect((await env.repository.accountability(FIXTURE_TARGET.playerId, DEFAULT_SCORING))?.mae).toEqual(available(1));
    env.context.games[0].outcome = fixtureOutcome({ appearance: "nonappearance" });
    expect((await env.repository.player(FIXTURE_TARGET.playerId, custom))?.games[0].actual.value.state).toBe("unavailable");
  });
  it("pins pagination to context and scoring and starts old-game reads independently of active queue", async () => {
    const env = environment();
    env.store.history.mockResolvedValueOnce({ revisions: [], nextCursor: "storeCursor" });
    const first = await env.repository.history(FIXTURE_TARGET.playerId, FIXTURE_TARGET.gameId, DEFAULT_SCORING);
    expect(first?.revisions).toEqual([]);
    expect(first?.latestRevision?.id).toBe("vintage-1");
    expect(first?.nextCursor).toBeTruthy();
    await env.repository.history(FIXTURE_TARGET.playerId, FIXTURE_TARGET.gameId, DEFAULT_SCORING, first!.nextCursor!);
    expect(env.contexts.readGame).toHaveBeenLastCalledWith(FIXTURE_TARGET.playerId, FIXTURE_TARGET.gameId, env.context.id);
    expect(env.contexts.read).not.toHaveBeenCalled();
    await expect(env.repository.history(FIXTURE_TARGET.playerId, FIXTURE_TARGET.gameId, scoringProfile({ ...DEFAULT_SCORING.weights, G: 4 }), first!.nextCursor!)).rejects.toThrow(/scope mismatch/);
  });
  it("gates before reads, validates input, and never leaks server failures", async () => {
    const env = environment(), disabled = response();
    await createForgeReadHandler({ enabled: false, repository: env.repository })({ method: "GET", query: { operation: "players" } } as unknown as NextApiRequest, disabled.res);
    expect(disabled.state.status).toBe(404); expect(env.contexts.players).not.toHaveBeenCalled();
    const handler = createForgeReadHandler({ enabled: true, repository: env.repository });
    const invalid = response();
    await handler({ method: "GET", query: { operation: "history" } } as unknown as NextApiRequest, invalid.res);
    expect(invalid.state.status).toBe(400);
    const write = response();
    await handler({ method: "POST", query: {} } as unknown as NextApiRequest, write.res);
    expect(write.state.status).toBe(405);
    const success = response();
    await handler({ method: "GET", query: { operation: "players" } } as unknown as NextApiRequest, success.res);
    expect(success.state.status).toBe(200); expect(success.state.headers["Cache-Control"]).toBe("private, no-store"); expect(success.state.headers.ETag).toMatch(/^"[a-f0-9]{64}"$/);
    vi.mocked(env.contexts.players).mockRejectedValue(new Error("secret database path"));
    const failure = response();
    await handler({ method: "GET", query: { operation: "players" } } as unknown as NextApiRequest, failure.res);
    expect(failure.state).toMatchObject({ status: 503, body: { error: "prepared_data_unavailable" } });
  });
  it("returns explicit absence and rejects oversized prepared responses", async () => {
    const env = environment(), handler = createForgeReadHandler({ enabled: true, repository: env.repository });
    vi.mocked(env.contexts.read).mockResolvedValue(null);
    const absent = response();
    await handler({ method: "GET", query: { operation: "next-ten", playerId: "9900001" } } as unknown as NextApiRequest, absent.res);
    expect(absent.state.status).toBe(404);
    vi.mocked(env.contexts.players).mockResolvedValue([{ id: 1, name: "x".repeat(1024 * 1024) }]);
    const huge = response();
    await handler({ method: "GET", query: { operation: "players" } } as unknown as NextApiRequest, huge.res);
    expect(huge.state).toMatchObject({ status: 503, body: { error: "response_capacity_exceeded" } });
  });
  it("refuses future or foreign outcome evidence in a prepared read context", async () => {
    const env = environment();
    env.context.games[0].outcome = fixtureOutcome({ recordedAt: "2026-01-13T00:00:00.000Z" });
    await expect(env.repository.player(FIXTURE_TARGET.playerId, DEFAULT_SCORING)).rejects.toThrow(/outcome scope or clock/);
    env.context.games[0].outcome = fixtureOutcome({ gameId: FIXTURE_TARGET.gameId + 1 });
    await expect(env.repository.player(FIXTURE_TARGET.playerId, DEFAULT_SCORING)).rejects.toThrow(/outcome scope or clock/);
    env.context.games[0].outcome = null;
    env.store.history.mockResolvedValue({ revisions: [fixturePublished({}, "2026-01-13T00:00:00.000Z")], nextCursor: null });
    expect((await env.repository.history(FIXTURE_TARGET.playerId, FIXTURE_TARGET.gameId, DEFAULT_SCORING))?.revisions).toEqual([]);
  });
});
