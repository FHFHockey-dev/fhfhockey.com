import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authState = vi.hoisted(() => ({
  getSession: vi.fn(),
  listener: null as ((event: string, session: { access_token?: string } | null) => void) | null,
  unsubscribe: vi.fn(),
}));

vi.mock("lib/supabase/client", () => ({
  default: {
    auth: {
      getSession: authState.getSession,
      onAuthStateChange: (listener: typeof authState.listener) => {
        authState.listener = listener;
        return { data: { subscription: { unsubscribe: authState.unsubscribe } } };
      },
    },
  },
}));

import { useDraftProAccess } from "./useDraftProAccess";
import { useProviderSyncAccess } from "./useProviderSyncAccess";

const access = {
  eligible: true,
  grantingSources: ["purchase"],
  expiresAt: null,
  verifiedAt: null,
  nextVerificationAt: null,
  reason: "eligible",
  capabilities: ["recommendations"],
  providerReadiness: { stripe: true, patreon: false, yahoo: false },
};

describe.each([["Draft Pro", useDraftProAccess], ["provider sync", useProviderSyncAccess]] as const)("%s access hook", (_name, useAccess) => {
  beforeEach(() => {
    authState.getSession.mockResolvedValue({ data: { session: { access_token: "token" } } });
    authState.listener = null;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { access } }) }));
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); vi.restoreAllMocks(); });

  it("fails closed immediately when auth signs out", async () => {
    const { result } = renderHook(() => useAccess());
    await waitFor(() => expect(result.current.access?.eligible).toBe(true));
    await act(async () => authState.listener?.("SIGNED_OUT", null));
    expect(result.current).toMatchObject({ status: "idle", access: null });
  });

  it("does not let an old request restore access after logout", async () => {
    const pending = { resolve: null as ((response: Response) => void) | null };
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => { pending.resolve = resolve; })));
    const { result } = renderHook(() => useAccess());
    await waitFor(() => expect(pending.resolve).not.toBeNull());
    await act(async () => authState.listener?.("SIGNED_OUT", null));
    const resolve = pending.resolve;
    expect(resolve).not.toBeNull();
    resolve?.({ ok: true, json: async () => ({ data: { access } }) } as Response);
    await act(async () => {});
    expect(result.current.access).toBeNull();
  });

  it("does not resurrect access when session lookup resolves after logout", async () => {
    let resolveSession: ((value: unknown) => void) | null = null;
    authState.getSession.mockImplementationOnce(() => new Promise((resolve) => { resolveSession = resolve; }));
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useAccess());
    await act(async () => authState.listener?.("SIGNED_OUT", null));
    await act(async () => resolveSession?.({ data: { session: { access_token: "old-token" } } }));
    expect(result.current).toMatchObject({ status: "idle", access: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("clamps a far-future expiry instead of scheduling an overflow refresh", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { access: { ...access, expiresAt: new Date(Date.now() + 250 * 24 * 60 * 60 * 1000).toISOString() } } }),
    });
    vi.stubGlobal("fetch", fetchMock);
    renderHook(() => useAccess());
    await act(async () => {});
    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("treats a rejected session as sign-in, not an upgrade", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 401, ok: false, json: async () => ({ error: "Unauthorized" }) }));
    const { result } = renderHook(() => useAccess());
    await waitFor(() => expect(result.current.status).toBe("idle"));
    expect(result.current.access).toBeNull();
  });
  it.each(["true", undefined])("rejects malformed eligibility %s", async (eligible) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { access: { ...access, eligible } } }) }));
    const { result } = renderHook(() => useAccess());
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.access).toBeNull();
  });
  it("closes access at expiry while rechecking, without retaining stale authority", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ data: { access: { ...access, expiresAt: new Date(Date.now() + 250).toISOString() } } }) })
      .mockImplementation(() => new Promise(() => {}));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useAccess());
    await act(async () => {});
    expect(result.current.access?.eligible).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    expect(result.current).toMatchObject({ status: "loading", access: null });
  });

});
