import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.hoisted(() => vi.fn(async () => ({ data: { session: { access_token: "test-token" } } })));
vi.mock("lib/supabase/client", () => ({ default: { auth: { getSession } } }));

import {
  DRAFT_PRO_DUST_PRIVATE_IMPORT_SAVE_REQUIRED,
  useDraftProDust,
} from "./useDraftProDust";

const input = {
  season: "2026", lineupMode: "daily" as const, inputOrigin: "draft" as const,
  gameKey: "477", startWeek: 1, endWeek: 1, rosterSlots: { RW: 1 },
  roster: [{ id: "r", teamAbbreviation: "AAA", eligiblePositions: "RW", value: 1, projectionSeason: "2026" }],
  candidates: [{ id: "c", teamAbbreviation: "BBB", eligiblePositions: "RW", value: 1, projectionSeason: "2026" }],
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
});
