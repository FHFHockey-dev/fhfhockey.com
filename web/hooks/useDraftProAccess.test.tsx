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

describe("useDraftProAccess", () => {
  beforeEach(() => {
    authState.getSession.mockResolvedValue({ data: { session: { access_token: "token" } } });
    authState.listener = null;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { access } }) }));
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it("fails closed immediately when auth signs out", async () => {
    const { result } = renderHook(() => useDraftProAccess());
    await waitFor(() => expect(result.current.access?.eligible).toBe(true));
    await act(async () => authState.listener?.("SIGNED_OUT", null));
    expect(result.current).toMatchObject({ status: "idle", access: null });
  });

  it("does not let an old request restore access after logout", async () => {
    let resolveResponse: ((response: Response) => void) | null = null;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => { resolveResponse = resolve; })));
    const { result } = renderHook(() => useDraftProAccess());
    await waitFor(() => expect(resolveResponse).not.toBeNull());
    await act(async () => authState.listener?.("SIGNED_OUT", null));
    resolveResponse?.({ ok: true, json: async () => ({ data: { access } }) } as Response);
    await act(async () => {});
    expect(result.current.access).toBeNull();
  });
});
