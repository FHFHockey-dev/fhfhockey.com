import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { formatGoaliePercent, goalieScheduleKey, resolveGoalieCell, type GoalieCandidate, type GoalieGridSnapshot, type GoalieProbability, type GoalieSource } from "./goalieGameView";
import useGoalieGameView, { decodeGoalieGridSnapshot, type GoalieGridReader } from "./useGoalieGameView";
import { readGoalieGrid } from "./readGoalieSources";

const game = { id: 103, season: 20262027, gameType: 2, gameDate: "2026-10-07", gameState: "FUT", gameScheduleState: "OK",
  startTimeUTC: "2026-10-07T23:00:00Z", homeTeam: { id: 1 }, awayTeam: { id: 2 } };
const source: GoalieSource = { source: "fixture", artifactId: "fixture-only", revision: "1", observedAt: "2026-10-07T13:00:00Z",
  availableAt: "2026-10-07T13:01:00Z", cutoffAt: "2026-10-07T14:00:00Z", issuedAt: "2026-10-07T15:00:00Z", expiresAt: "2026-10-08T01:00:00Z" };
const asOf = "2026-10-07T16:00:00Z";
const metric = (playerId: number, target: GoalieProbability["target"], value: number): GoalieProbability => ({ playerId,
  gameId: game.id, teamId: 1, selectionRevision: "s1", target, value, basis: "individual_goalie_game", source, publishedAt: source.issuedAt,
  qualification: { status: "qualified", reportId: "synthetic-receipt", artifactId: source.artifactId, population: "pregame_as_issued_goalie_game" } });
const candidate = (playerId: number, p: number): GoalieCandidate => ({ playerId, name: `Goalie ${playerId}`, surname: `Goalie${playerId}`,
  status: "projected", source, start: metric(playerId, "official_starter", p), winIfStarting: metric(playerId, "credited_win_if_starting", .57) });
const snapshot = (): GoalieGridSnapshot => ({ version: "goalie-grid-v1", contextKey: "context1", boards: [{ gameId: game.id,
  seasonId: game.season, teamId: 1, opponentId: 2, startsAt: game.startTimeUTC, selectionRevision: "s1", selectedPlayerId: 10,
  candidateCoverage: "partial", candidates: [candidate(10, .6), candidate(20, .2), candidate(30, .05)] }] });
const resolve = (data = snapshot(), override = game, now = asOf) => resolveGoalieCell(override, 1, data, "context1", now);
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("Goalie Grid individual pregame contract", () => {
  it("bounds a long range to one ten-date request and identifies unsupported cells", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(asOf));
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => snapshot() });
    vi.stubGlobal("fetch", fetcher);
    const later = { ...game, id: 104, gameDate: "2026-10-24", startTimeUTC: "2026-10-24T23:00:00Z" };
    const result = await readGoalieGrid({ games: [later, game], contextKey: "context1" }, new AbortController().signal);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toBe("/api/v1/forge/goalies?view=game-grid&from=2026-10-07&through=2026-10-16");
    expect(resolve(result).candidate?.playerId).toBe(10);
    expect(resolve(result, later).reason).toContain("outside the requested ten-date forecast coverage");
    expect(resolve(result, later).win.value).toBeNull();
  });
  it("keeps conditional credited win separate from start and unresolved mass", () => {
    const v = resolve();
    expect(v.win.value).toBe(.57); expect(v.start.value).toBe(.6);
    expect(v.candidates).toHaveLength(3); expect(v.unresolvedStartMass).toBeCloseTo(.15);
    expect(v.win.value).not.toBe(.57 * .6);
  });
  it.each(["available_after_cutoff", "observed_after_available", "cutoff_after_issued", "issued_after_view", "published_after_view", "published_before_issued"])("rejects sub-millisecond %s evidence", failure => {
    const data = snapshot(), metric = data.boards[0].candidates[0].winIfStarting!;
    metric.source = { ...source };
    if (failure === "available_after_cutoff") metric.source.availableAt = "2026-10-07T14:00:00.000001Z";
    if (failure === "observed_after_available") metric.source.observedAt = "2026-10-07T13:01:00.000001Z";
    if (failure === "cutoff_after_issued") metric.source.cutoffAt = "2026-10-07T15:00:00.000001Z";
    if (failure === "issued_after_view") { metric.source.issuedAt = "2026-10-07T16:00:00.000001Z"; metric.publishedAt = metric.source.issuedAt; }
    if (failure === "published_after_view") metric.publishedAt = "2026-10-07T16:00:00.000001Z";
    if (failure === "published_before_issued") metric.source.issuedAt = "2026-10-07T15:00:00.000001Z";
    expect(resolve(data).win.value).toBeNull();
  });
  it("preserves microsecond schedule identity, ordering and equivalent offset times", () => {
    const data = snapshot();
    const scheduled = { ...game, startTimeUTC: "2026-10-07T23:00:00.000002Z" };
    data.boards[0].startsAt = "2026-10-07T19:00:00.000002-04:00";
    expect(resolve(data, scheduled, "2026-10-07T23:00:00.000001Z").candidate?.playerId).toBe(10);
    expect(resolve(data, scheduled, "2026-10-07T23:00:00.000002Z").phase).toBe("in_progress");
    data.boards[0].startsAt = "2026-10-07T23:00:00.000001Z";
    expect(resolve(data, scheduled).candidate).toBeNull();
  });
  it("keeps a source available until its exact expiration and rejects unsupported timestamp precision", () => {
    const data = snapshot(), metric = data.boards[0].candidates[0].winIfStarting!;
    metric.source = { ...source, expiresAt: "2026-10-07T16:00:00.000001Z" };
    expect(resolve(data).win.value).toBe(.57);
    expect(resolve(data, game, metric.source.expiresAt).win.value).toBeNull();
    metric.source.availableAt = "2026-10-07T14:00:00.0000001Z";
    expect(resolve(data).win.value).toBeNull();
  });
  it("retains qualified zero while missing/unqualified probabilities remain unavailable", () => {
    const data = snapshot(); const c = data.boards[0].candidates[0];
    c.start!.value = 0; c.winIfStarting!.value = null;
    expect(resolve(data).start.value).toBe(0); expect(formatGoaliePercent(resolve(data).win.value)).toBe("—");
    c.start!.qualification.status = "unqualified";
    expect(resolve(data).start.value).toBeNull();
  });
  it.each(["team_slot", "wrong_player", "wrong_revision", "wrong_target", "no_receipt", "post_cutoff", "late_publication", "stale", "out_of_range"])("withholds %s", failure => {
    const data = snapshot(); const m = data.boards[0].candidates[0].winIfStarting!;
    if (failure === "team_slot") m.basis = "team_slot";
    if (failure === "wrong_player") m.playerId = 20;
    if (failure === "wrong_revision") m.selectionRevision = "old";
    if (failure === "wrong_target") m.target = "official_starter";
    if (failure === "no_receipt") m.qualification.reportId = null;
    if (failure === "post_cutoff") m.source = { ...source, availableAt: "2026-10-07T14:01:00Z" };
    if (failure === "late_publication") m.publishedAt = "2026-10-07T16:01:00Z";
    if (failure === "stale") m.source = { ...source, expiresAt: asOf };
    if (failure === "out_of_range") m.value = 1.1;
    expect(resolve(data).win.value).toBeNull();
  });
  it("does not carry the old goalie's values to a replacement name", () => {
    const data = snapshot(); data.boards[0].selectedPlayerId = 20; data.boards[0].selectionRevision = "s2";
    expect(resolve(data).candidate?.playerId).toBe(20);
    expect(resolve(data).start.value).toBeNull(); expect(resolve(data).win.value).toBeNull();
  });
  it.each(["stale", "conflicting", "unknown"] as const)("does not silently select a %s candidate", status => {
    const data = snapshot(); data.boards[0].candidates[0].status = status;
    expect(resolve(data).candidate).toBeNull();
  });
  it("does not turn confirmation into 100%, or excessive candidate mass into normalized values", () => {
    const data = snapshot(); data.boards[0].candidates[0].status = "confirmed";
    expect(resolve(data).start.value).toBe(.6);
    data.boards[0].candidates[1].start!.value = .7;
    expect(resolve(data).start.value).toBeNull(); expect(resolve(data).unresolvedStartMass).toBeNull();
  });
  it.each(["LIVE", "CRIT", "FINAL", "OFF"])("removes pregame names and forecasts for %s", gameState => {
    const v = resolve(snapshot(), { ...game, gameState });
    expect(v.candidate).toBeNull(); expect(v.win.value).toBeNull(); expect(v.candidates).toEqual([]);
  });
  it("expires at scheduled start even if the feed still says FUT, and rejects rescheduling", () => {
    expect(resolve(snapshot(), game, game.startTimeUTC).phase).toBe("in_progress");
    expect(resolve(snapshot(), { ...game, startTimeUTC: "2026-10-08T23:00:00Z" }).candidate).toBeNull();
    expect(resolve(snapshot(), { ...game, gameScheduleState: "PPD" }).phase).toBe("unavailable");
    expect(resolve(snapshot(), { ...game, gameScheduleState: "UNKNOWN" }).candidate).toBeNull();
  });
  it("uses instants across DST and canonical schedule identity independent of row order", () => {
    const data = snapshot(); data.boards[0].startsAt = "2026-10-07T19:00:00-04:00";
    expect(resolve(data).win.value).toBe(.57);
    const other = { ...game, id: 104 };
    expect(goalieScheduleKey([game, other, game], "r1")).toBe(goalieScheduleKey([other, game], "r1"));
    expect(goalieScheduleKey([game], "r2")).not.toBe(goalieScheduleKey([game], "r1"));
  });
});

describe("Goalie reader identity and lifecycle", () => {
  it("rejects legacy, malformed and unbounded envelopes", () => {
    expect(() => decodeGoalieGridSnapshot({ data: [{ start_probability: .8, Win: .6 }] })).toThrow();
    expect(() => decodeGoalieGridSnapshot({ ...snapshot(), boards: Array(321).fill(snapshot().boards[0]) })).toThrow();
    expect(() => decodeGoalieGridSnapshot({ ...snapshot(), boards: [{ ...snapshot().boards[0], candidates: [null] }] })).toThrow();
  });
  it("clears synchronously during replacement and ignores late old responses", async () => {
    let release!: (v: GoalieGridSnapshot) => void;
    const reader = vi.fn<GoalieGridReader>().mockImplementationOnce(() => new Promise(resolve => { release = resolve; }))
      .mockImplementationOnce(async request => ({ ...snapshot(), contextKey: request.contextKey }));
    const { result, rerender } = renderHook(({ key }) => useGoalieGameView([game], key, true, reader), { initialProps: { key: "old" } });
    await act(async () => {});
    rerender({ key: "context1" }); expect(result.current.snapshot).toBeNull();
    await waitFor(() => expect(result.current.snapshot?.contextKey).toBe("context1"));
    await act(async () => release({ ...snapshot(), contextKey: "old" }));
    expect(result.current.snapshot?.contextKey).toBe("context1"); expect(reader.mock.calls[0][1].aborted).toBe(true);
  });
  it("clears on deferred mode entry and re-reads rather than resurrecting a prior response", async () => {
    const reader = vi.fn<GoalieGridReader>().mockResolvedValue(snapshot());
    const { result, rerender } = renderHook(({ enabled }) => useGoalieGameView([game], "context1", enabled, reader), { initialProps: { enabled: true } });
    await waitFor(() => expect(result.current.snapshot).not.toBeNull());
    rerender({ enabled: false }); expect(result.current.snapshot).toBeNull();
    rerender({ enabled: true }); expect(result.current.snapshot).toBeNull();
    await waitFor(() => expect(reader).toHaveBeenCalledTimes(2));
  });
  it("removes a value at puck drop without a network refresh", async () => {
    vi.useFakeTimers(); vi.setSystemTime("2026-10-07T22:59:59Z");
    const reader = vi.fn<GoalieGridReader>().mockResolvedValue(snapshot());
    const { result } = renderHook(() => useGoalieGameView([game], "context1", true, reader));
    await act(async () => {});
    expect(resolveGoalieCell(game, 1, result.current.snapshot, "context1", result.current.asOf).win.value).toBe(.57);
    await act(async () => vi.advanceTimersByTime(1000));
    expect(resolveGoalieCell(game, 1, result.current.snapshot, "context1", result.current.asOf).candidate).toBeNull();
    expect(reader).toHaveBeenCalledTimes(1);
  });
  it("times out even when a reader ignores abort, then rejects its late result", async () => {
    vi.useFakeTimers(); vi.setSystemTime(asOf);
    let release!: (s: GoalieGridSnapshot) => void;
    const reader = vi.fn<GoalieGridReader>().mockImplementation(() => new Promise(resolve => { release = resolve; }));
    const { result } = renderHook(() => useGoalieGameView([game], "context1", true, reader));
    await act(async () => {});
    await act(async () => vi.advanceTimersByTime(15_000));
    expect(result.current.status).toBe("unavailable"); expect(reader.mock.calls[0][1].aborted).toBe(true);
    await act(async () => release(snapshot())); expect(result.current.snapshot).toBeNull();
  });
});
