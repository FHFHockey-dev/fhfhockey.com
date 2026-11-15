import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import supabase from "lib/supabase/server";
import { captureProjectionInputs, projectionInputHash } from "../inputCapture";
import { CaptureRefused, createCaptureTransport, DEFAULT_TRANSPORT_BUDGET, type CaptureTarget } from "./transport";

const BASE = "https://capture.test/rest/v1";
const target: CaptureTarget = { gameId: 2026020400, slateDate: "2026-11-20", homeTeamId: 6, awayTeamId: 30, homeAbbrev: "BOS", awayAbbrev: "MIN" };

type Route = (url: URL, init?: RequestInit) => { body?: unknown; count?: number; status?: number };
// A route may also throw to simulate a network failure.
function backend(route: Route) {
  const calls: Array<{ method: string; url: string }> = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    calls.push({ method: String(init?.method ?? "GET"), url: url.toString() });
    const { body = [], count, status = 200 } = route(url, init);
    const headers = new Headers({ "content-type": "application/json" });
    if (count !== undefined) headers.set("content-range", `0-0/${count}`);
    return new Response(init?.method === "HEAD" ? null : JSON.stringify(body), { status, headers });
  }) as typeof fetch;
  return { calls, fetchImpl };
}

function transportFor(route: Route, budget: Partial<typeof DEFAULT_TRANSPORT_BUDGET & { deadlineMs: number }> = {}) {
  const { calls, fetchImpl } = backend(route);
  const transport = createCaptureTransport({
    target, restBaseUrl: BASE, fetchImpl,
    budget: { ...DEFAULT_TRANSPORT_BUDGET, deadlineMs: Date.now() + 60_000, ...budget },
    createClient: (guarded) => createClient("https://capture.test", "test-key", {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }, global: { fetch: guarded },
    }) as any,
  });
  return { transport, calls };
}

const db = supabase as any;

describe("strict capture transport", () => {
  it("captures an allowlisted filtered read over GET and records the same request chain", async () => {
    const { transport, calls } = transportFor(() => ({ body: [{ id: 1, date: "2026-11-20" }] }));
    const run = await captureProjectionInputs(async () => db.from("games").select("id,date").eq("date", "2026-11-20"), { transport });
    expect(run.result.data).toEqual([{ id: 1, date: "2026-11-20" }]);
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe("GET");
    expect(run.reads[0].request).toEqual([{ method: "from", args: ["games"] }, { method: "select", args: ["id,date"] }, { method: "eq", args: ["date", "2026-11-20"] }]);
    expect(projectionInputHash(run.reads[0].request)).toBe(projectionInputHash([
      { method: "from", args: ["games"] }, { method: "select", args: ["id,date"] }, { method: "eq", args: ["date", "2026-11-20"] }]));
    expect(transport.usage).toMatchObject({ calls: 1, httpCalls: 1, rows: 1, refusals: [] });
  });

  it("refuses writes before any network call instead of faking success", async () => {
    const { transport, calls } = transportFor(() => ({}));
    for (const write of [
      () => db.from("games").insert({ id: 1 }),
      () => db.from("games").update({ id: 2 }).eq("id", 1),
      () => db.from("games").upsert({ id: 1 }),
      () => db.from("games").delete().eq("id", 1),
    ]) {
      await expect(captureProjectionInputs(async () => write(), { transport })).rejects.toBeInstanceOf(CaptureRefused);
    }
    expect(calls).toHaveLength(0);
    expect(transport.usage.refusals.every((code) => code.startsWith("mutation_refused"))).toBe(true);
  });

  it("admits exactly the two approved RPCs and only by GET", async () => {
    const { transport, calls } = transportFor(() => ({ body: [] }));
    await captureProjectionInputs(async () => db.rpc("forge_league_skater_physical_totals", { p_season_id: 20262027, p_cutoff: "2026-11-20" }, { get: true }), { transport });
    expect(calls[0].method).toBe("GET");
    await expect(captureProjectionInputs(async () => db.rpc("forge_league_skater_physical_totals", { p_season_id: 1 }), { transport })).rejects.toThrow("rpc_not_get");
    await expect(captureProjectionInputs(async () => db.rpc("publish_forge_game_revisions", {}, { get: true }), { transport })).rejects.toThrow("rpc_not_allowed");
    expect(calls).toHaveLength(1);
  });

  it("refuses unapproved providers, unfiltered scans and unknown builder methods", async () => {
    const { transport } = transportFor(() => ({ body: [] }));
    await expect(captureProjectionInputs(async () => db.from("PROJECTIONS_20262027_CULLEN").select("*").eq("player_id", 1), { transport })).rejects.toThrow("relation_not_allowed");
    await expect(captureProjectionInputs(async () => db.from("forge_runs").select("id").eq("id", 1), { transport })).rejects.toThrow("relation_not_allowed");
    await expect(captureProjectionInputs(async () => db.from("rosters").select("*"), { transport })).rejects.toThrow("unfiltered_read");
    await expect(captureProjectionInputs(async () => db.from("rosters").select("*").eq("teamId", 6).csv(), { transport })).rejects.toThrow("method_not_allowed");
  });

  it("refuses non-GET methods and foreign paths at the HTTP layer", async () => {
    const { transport, calls } = transportFor(() => ({ body: [] }));
    await expect(transport.fetch(`${BASE}/games?id=eq.1`, { method: "POST", body: "{}" })).rejects.toThrow("http_method");
    await expect(transport.fetch(`${BASE}/rpc/publish_forge_game_revisions`, { method: "GET" })).rejects.toThrow("http_rpc");
    await expect(transport.fetch("https://elsewhere.test/rest/v1/games", { method: "GET" })).rejects.toThrow("http_path");
    await expect(transport.fetch(`${BASE}/forge_runs?id=eq.1`, { method: "GET" })).rejects.toThrow("http_relation");
    expect(calls).toHaveLength(0);
    expect(transport.usage.refusals.map((code) => code.split(":")[0])).toEqual(["http_method", "http_rpc", "http_path", "http_relation"]);
  });

  it("refuses target-game results but keeps an honest pregame empty read", async () => {
    const empty = transportFor((url) => url.pathname.endsWith("/pbp_games") ? { body: [{ id: target.gameId, hometeamscore: null, awayteamscore: null }] } : { body: [], count: 0 });
    await captureProjectionInputs(async () => {
      await db.from("pbp_games").select("id,hometeamscore,awayteamscore").eq("id", target.gameId);
      return db.from("pbp_plays").select("id", { count: "exact", head: true }).eq("gameid", target.gameId);
    }, { transport: empty.transport });
    expect(empty.transport.usage.refusals).toEqual([]);

    const played = transportFor(() => ({ body: [], count: 412 }));
    await expect(captureProjectionInputs(async () => db.from("pbp_plays").select("id", { count: "exact", head: true }).eq("gameid", target.gameId),
      { transport: played.transport })).rejects.toThrow("target_game_result");
    const scored = transportFor(() => ({ body: [{ id: target.gameId, hometeamscore: 2, awayteamscore: 1 }] }));
    await expect(captureProjectionInputs(async () => db.from("pbp_games").select("*").eq("id", target.gameId), { transport: scored.transport })).rejects.toThrow("pbp_games.score");
    const teamDay = transportFor(() => ({ body: [{ date: "2026-11-20", team_abbreviation: "MIN", xgf: 2.1 }] }));
    await expect(captureProjectionInputs(async () => db.from("nst_team_all").select("*").lte("date", "2026-11-20"), { transport: teamDay.transport })).rejects.toThrow("slate_date_team_row");
    const otherGame = transportFor(() => ({ body: [{ game_id: 2026020399, team_id: 6 }] }));
    await captureProjectionInputs(async () => db.from("wgo_team_stats").select("*").lt("date", "2026-11-20"), { transport: otherGame.transport });
    expect(otherGame.transport.usage.refusals).toEqual([]);
  });

  it("refuses rows stamped after their read", async () => {
    const { transport } = transportFor(() => ({ body: [{ id: 1, created_at: new Date(Date.now() + 3_600_000).toISOString() }] }));
    await expect(captureProjectionInputs(async () => db.from("goalie_start_projections").select("*").eq("game_id", target.gameId), { transport })).rejects.toThrow("future_stamped_row");
  });

  it("records refusals even when a reader swallows the error", async () => {
    const { transport } = transportFor(() => ({ body: [] }));
    await captureProjectionInputs(async () => {
      try { await db.from("games").insert({ id: 1 }); } catch { /* a careless reader */ }
      return null;
    }, { transport });
    expect(transport.usage.refusals).toEqual(["mutation_refused:games.insert"]);
  });

  it("enforces call, byte and time budgets", async () => {
    const calls = transportFor(() => ({ body: [] }), { maxCalls: 1 });
    await captureProjectionInputs(async () => db.from("games").select("id").eq("id", 1), { transport: calls.transport });
    await expect(captureProjectionInputs(async () => db.from("games").select("id").eq("id", 2), { transport: calls.transport })).rejects.toThrow("call_budget");
    // HTTP-layer refusals reach readers as { error } results (supabase-js wraps fetch errors); the refusal is recorded.
    const bytes = transportFor(() => ({ body: [{ blob: "x".repeat(4096) }] }), { maxResponseBytes: 1024 });
    const big = await captureProjectionInputs(async () => db.from("games").select("*").eq("id", 1), { transport: bytes.transport });
    expect(big.result.error).toBeTruthy();
    expect(bytes.transport.usage.refusals).toEqual(["response_bytes:4109"]); // declared content-length of the JSON body
    const late = transportFor(() => ({ body: [] }), { deadlineMs: Date.now() - 1 });
    await expect(captureProjectionInputs(async () => db.from("games").select("id").eq("id", 1), { transport: late.transport })).rejects.toThrow("deadline");
  });

  it("records network errors, aborts and error statuses as refusals even though readers only see { error }", async () => {
    const down = transportFor(() => { throw new Error("ECONNRESET"); });
    const r1 = await captureProjectionInputs(async () => db.from("games").select("id").eq("id", 1), { transport: down.transport });
    expect(r1.result.error).toBeTruthy();
    expect(down.transport.usage.refusals[0]).toMatch(/^http_error:/);
    const flaky = transportFor(() => ({ status: 503, body: { message: "upstream" } }));
    await captureProjectionInputs(async () => db.from("games").select("id").eq("id", 1), { transport: flaky.transport });
    expect(flaky.transport.usage.refusals).toEqual(["http_status:503"]);
    const missing = transportFor(() => ({ status: 404, body: { message: "relation does not exist" } }));
    await captureProjectionInputs(async () => db.from("games").select("id").eq("id", 1), { transport: missing.transport });
    expect(missing.transport.usage.refusals).toEqual(["http_status:404"]);
    // .single() with no row is PostgREST's honest 406, not a source failure.
    const none = transportFor(() => ({ status: 406, body: { code: "PGRST116", message: "0 rows" } }));
    await captureProjectionInputs(async () => db.from("games").select("id").eq("id", 1).single(), { transport: none.transport });
    expect(none.transport.usage.refusals).toEqual([]);
  });

  it("refuses PostgREST embedding, spreads, embedded filters and schema profile switches", async () => {
    const { transport, calls } = transportFor(() => ({ body: [] }));
    await expect(captureProjectionInputs(async () => db.from("games").select("id,forge_runs(*)").eq("id", 1), { transport })).rejects.toThrow("embedding_refused");
    await expect(captureProjectionInputs(async () => db.from("games").select("id,...teams(*)").eq("id", 1), { transport })).rejects.toThrow("embedding_refused");
    await expect(captureProjectionInputs(async () => db.from("games").select("id,teams!inner(id)").eq("id", 1), { transport })).rejects.toThrow("embedding_refused");
    await expect(captureProjectionInputs(async () => db.from("games").select("id").eq("teams.id", 1), { transport })).rejects.toThrow("embedding_refused");
    await expect(transport.fetch(`${BASE}/games?select=id,forge_runs(*)&id=eq.1`, { method: "GET" })).rejects.toThrow("http_embedding");
    await expect(transport.fetch(`${BASE}/games?select=id&teams.id=eq.1`, { method: "GET" })).rejects.toThrow("http_embedding");
    await expect(transport.fetch(`${BASE}/games?select=id&id=eq.1`, { method: "GET", headers: { "Accept-Profile": "forge_pregame_capture" } })).rejects.toThrow("http_profile");
    expect(calls).toHaveLength(0);
  });

  it("does not treat range, limit or neq alone as a filter", async () => {
    const { transport } = transportFor(() => ({ body: [] }));
    await expect(captureProjectionInputs(async () => db.from("rosters").select("*").range(0, 999), { transport })).rejects.toThrow("unfiltered_read");
    await expect(captureProjectionInputs(async () => db.from("rosters").select("*").neq("teamId", 0).limit(10), { transport })).rejects.toThrow("unfiltered_read");
  });

  it("refuses target-game results selected through in, match, filter or or, and nested in RPC rows", async () => {
    const hit = () => transportFor(() => ({ body: [{ value: 1 }], count: 3 }));
    for (const read of [
      () => db.from("shift_charts").select("value").in("game_id", [2026020399, target.gameId]),
      () => db.from("shift_charts").select("value").match({ game_id: target.gameId }),
      () => db.from("shift_charts").select("value").filter("game_id", "eq", String(target.gameId)),
      () => db.from("shift_charts").select("value").or(`game_id.eq.${target.gameId},game_id.eq.1`),
    ]) {
      const { transport } = hit();
      await expect(captureProjectionInputs(async () => read(), { transport })).rejects.toThrow("target_game_result");
    }
    const nested = transportFor(() => ({ body: [{ player_id: 1, row: { game_id: target.gameId, toi: 900 } }] }));
    await expect(captureProjectionInputs(async () => db.rpc("forge_latest_rolling_rows", { p_player_ids: [1] }, { get: true }),
      { transport: nested.transport })).rejects.toThrow("target_game_result");
  });

  it("reads naive availability stamps as UTC, counts them, and still refuses future ones", async () => {
    const past = transportFor(() => ({ body: [{ id: 1, created_at: new Date(Date.now() - 60_000).toISOString().replace("Z", "") }] }));
    await captureProjectionInputs(async () => db.from("forge_roster_events").select("*").eq("id", 1), { transport: past.transport });
    expect(past.transport.usage).toMatchObject({ naiveStamps: 1, refusals: [] });
    const future = transportFor(() => ({ body: [{ id: 1, source_published_at: new Date(Date.now() + 3_600_000).toISOString().replace("Z", "") }] }));
    await expect(captureProjectionInputs(async () => db.from("forge_roster_events").select("*").eq("id", 1), { transport: future.transport })).rejects.toThrow("future_stamped_row");
  });

  it("cannot be combined with write suppression or controlled news", async () => {
    const { transport } = transportFor(() => ({ body: [] }));
    await expect(captureProjectionInputs(async () => null, { transport, suppressWrites: true })).rejects.toThrow("Strict capture");
  });
});
