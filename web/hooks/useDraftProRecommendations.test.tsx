import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.hoisted(() => vi.fn());
vi.mock("lib/supabase/client", () => ({ default: { auth: { getSession } } }));

import { useDraftProRecommendations } from "./useDraftProRecommendations";

const input = {
  candidates: [{ id: "1", name: "One", role: "skater" as const, eligiblePositions: ["C"], globalVorp: 1, rankValue: 1 }],
  dataOrigin: "server" as const,
  leagueType: "points" as const,
  currentPick: 1,
  teamCount: 1,
};

describe("useDraftProRecommendations", () => {
  beforeEach(() => getSession.mockResolvedValue({ data: { session: { access_token: "token" } } }));
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); vi.restoreAllMocks(); });

  it("aborts stale responses before they can replace current recommendation results", async () => {
    vi.useFakeTimers();
    const pending: Array<{ signal: AbortSignal; resolve: (value: Response) => void }> = [];
    vi.stubGlobal("fetch", vi.fn((_url: string, init: RequestInit) => new Promise<Response>((resolve) => pending.push({ signal: init.signal!, resolve }))));
    const { result, rerender } = renderHook(({ value }) => useDraftProRecommendations(value, true), { initialProps: { value: input } });
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    rerender({ value: { ...input, candidates: [{ ...input.candidates[0], id: "2", name: "Two" }] } });
    expect(pending[0]?.signal.aborted).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    pending[0]?.resolve({ ok: true, json: async () => ({ data: [{ candidate: { id: "1" } }] }) } as Response);
    pending[1]?.resolve({ ok: true, json: async () => ({ data: [{ candidate: { id: "2" } }] }) } as Response);
    await act(async () => {});
    expect(result.current.results?.[0]?.candidate.id).toBe("2");
  });

  it("clears ready premium results synchronously when capability access is revoked", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [{ candidate: { id: "1" } }] }) }));
    const { result, rerender } = renderHook(({ enabled }) => useDraftProRecommendations(input, enabled), { initialProps: { enabled: true } });
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    expect(result.current.results?.[0]?.candidate.id).toBe("1");
    rerender({ enabled: false });
    expect(result.current).toMatchObject({ status: "idle", results: null });
  });
});

it("computes private roster-aware ranks only after authorization and clears them on loss of access", async () => {
  vi.useFakeTimers();
  getSession.mockResolvedValue({ data: { session: { access_token: "token" } } });
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { authorized: true } }) });
  vi.stubGlobal("fetch", fetchMock);
  const privateInput = { ...input, dataOrigin: "local_csv" as const, needAlpha: 1, positionNeeds: { C: 0, D: 1 }, candidates: [input.candidates[0], { ...input.candidates[0], id: "2", name: "Private Defender", eligiblePositions: ["D"], rankValue: .95 }] };
  const { result, rerender, unmount } = renderHook(({ enabled }) => useDraftProRecommendations(privateInput, enabled), { initialProps: { enabled: true } });
  expect(result.current.results).toBeNull();
  await act(async () => { await vi.advanceTimersByTimeAsync(200); });
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ dataOrigin: "local_csv", authorizeOnly: true });
  expect(result.current.results?.[0].candidate.id).toBe("2");
  rerender({ enabled: false });
  expect(result.current.results).toBeNull();
  unmount(); vi.unstubAllGlobals(); vi.useRealTimers();
});

it("does not calculate imported premium results after server denial", async () => {
  vi.useFakeTimers();
  getSession.mockResolvedValue({ data: { session: { access_token: "token" } } });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: { message: "Draft Pro access is required." } }) }));
  const { result, unmount } = renderHook(() => useDraftProRecommendations({ ...input, dataOrigin: "private_import" }, true));
  await act(async () => { await vi.advanceTimersByTimeAsync(200); });
  expect(result.current).toMatchObject({ status: "error", results: null });
  unmount(); vi.unstubAllGlobals(); vi.useRealTimers();
});
