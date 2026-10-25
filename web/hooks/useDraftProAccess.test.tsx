import { act, cleanup, render, renderHook, screen, waitFor } from "@testing-library/react";
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
import ProviderSyncNotice from "components/account/ProviderSyncNotice";

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


describe("provider sync free rollout UI", () => {
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
  it("shows no upgrade gate for an authenticated free account", async () => {
    authState.getSession.mockResolvedValue({ data: { session: { access_token: "fixture" } } });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { access: { eligible: true, reason: "rollout_free", expiresAt: null } } }) });
    vi.stubGlobal("fetch", fetchMock);
    function Surface() { const state = useProviderSyncAccess(); return <><ProviderSyncNotice {...state} /><button disabled={state.status !== "ready" || !state.access?.eligible}>Sync fixture</button></>; }
    render(<Surface />);
    await waitFor(() => expect((screen.getByRole("button", { name: "Sync fixture" }) as HTMLButtonElement).disabled).toBe(false));
    expect(screen.queryByRole("link", { name: "View premium access" })).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/account/provider-sync", expect.anything());
  });
  it("requests real entitlements explicitly for billing readback", async () => {
    authState.getSession.mockResolvedValue({ data: { session: { access_token: "fixture" } } });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { access: { eligible: false, reason: "no_active_grant", expiresAt: null } } }) });
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useProviderSyncAccess({ entitlementOnly: true }));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.access?.eligible).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/account/provider-sync?entitlementOnly=true", expect.anything());
  });
});
