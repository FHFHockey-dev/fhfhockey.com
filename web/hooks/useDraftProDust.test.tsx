import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.hoisted(() => vi.fn(async () => ({ data: { session: { access_token: "test-token" } } })));
vi.mock("lib/supabase/client", () => ({ default: { auth: { getSession } } }));

import {
  DRAFT_PRO_DUST_PRIVATE_IMPORT_SAVE_REQUIRED,
  useDraftProDust,
} from "./useDraftProDust";

const input = {
  season: "20262027", lineupMode: "daily" as const, inputOrigin: "draft" as const,
  startWeek: 1, endWeek: 1, rosterSlots: { RW: 1 },
  roster: [{ id: "r", teamAbbreviation: "AAA", eligiblePositions: "RW", value: 1, projectionSeason: "20262027" }],
  candidates: [{ id: "c", teamAbbreviation: "BBB", eligiblePositions: "RW", value: 1, projectionSeason: "20262027" }],
};

describe("useDraftProDust", () => {
  beforeEach(() => getSession.mockClear());
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });

  it("aborts an obsolete request and never lets its later response replace fresh input", async () => {
    vi.useFakeTimers();
    const pending: Array<{ signal: AbortSignal; resolve: (response: Response) => void }> = [];
    vi.stubGlobal("fetch", vi.fn((_url: string, init: RequestInit) => new Promise<Response>((resolve) => pending.push({ signal: init.signal!, resolve }))));
    const { result, rerender } = renderHook(({ value }) => useDraftProDust(value, true), { initialProps: { value: input } });
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    rerender({ value: { ...input, candidates: [{ ...input.candidates[0], id: "new" }] } });
    expect(pending[0]?.signal.aborted).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    pending[0]?.resolve({ ok: true, json: async () => ({ success: true, data: { state: "ready", insights: [{ playerId: "old" }] } }) } as Response);
    pending[1]?.resolve({ ok: true, json: async () => ({ success: true, data: { state: "ready", insights: [{ playerId: "new" }] } }) } as Response);
    await act(async () => {});
    expect(result.current.result?.insights[0]?.playerId).toBe("new");
  });

  it("does not serialize or upload an unsaved private import", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useDraftProDust({ ...input, inputOrigin: "private_import" }, true));
    await act(async () => {});
    expect(result.current).toMatchObject({ status: "error", error: DRAFT_PRO_DUST_PRIVATE_IMPORT_SAVE_REQUIRED });
    expect(getSession).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("clears ready DUST results synchronously when capability access is revoked", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, data: { state: "ready", insights: [{ playerId: "current" }] } }) }));
    const { result, rerender } = renderHook(({ enabled }) => useDraftProDust(input, enabled), { initialProps: { enabled: true } });
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    expect(result.current.result?.insights[0]?.playerId).toBe("current");
    rerender({ enabled: false });
    expect(result.current).toMatchObject({ status: "idle", result: null });
  });

  it("returns the server's weekly-lock unsupported state without inventing weekly analysis", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, data: { state: "weekly_lock_unsupported", insights: [], diagnostics: ["DUST uses exact daily lineup assignment; weekly-lock leagues are not supported."] } }) }));
    const { result } = renderHook(() => useDraftProDust({ ...input, lineupMode: "weekly" }, true));
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    expect(result.current.result?.state).toBe("weekly_lock_unsupported");
    expect(result.current.result?.insights).toEqual([]);
  });

  it("serializes canonical NHL seasons without the legacy game key", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, data: { state: "ready", insights: [] } }) });
    vi.stubGlobal("fetch", fetchMock);
    renderHook(() => useDraftProDust(input, true));
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    const request = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body);
    expect(request).toMatchObject({ season: "20262027", roster: [{ projectionSeason: "20262027" }], candidates: [{ projectionSeason: "20262027" }] });
    expect(request.gameKey).toBeUndefined();
  });
});
