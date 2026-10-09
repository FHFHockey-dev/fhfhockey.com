import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fantraxAccountRequest = vi.hoisted(() => vi.fn());
vi.mock("hooks/useFantraxConnections", () => ({ fantraxAccountRequest }));

import { useFantraxDraftSync } from "./useFantraxDraftSync";

const sessionKey = "fhfh:fantrax:draft-dashboard:live-session:v1";
const state = { session: { id: "session-1", status: "active" }, picks: [] };

describe("useFantraxDraftSync resume", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    fantraxAccountRequest.mockReset();
    fantraxAccountRequest.mockImplementation(async (path: string) =>
      path === "/api/v1/account/fantrax/draft-sessions"
        ? { enabled: true, eligible: true }
        : state,
    );
  });

  afterEach(() => {
    cleanup();
    window.sessionStorage.clear();
  });

  it("keeps the saved live session while sign-in resolves, then resumes it", async () => {
    window.sessionStorage.setItem(sessionKey, "session-1");
    const { result, rerender } = renderHook(
      ({ authenticated, authLoading }) => useFantraxDraftSync(authenticated, authLoading),
      { initialProps: { authenticated: false, authLoading: true } },
    );
    expect(window.sessionStorage.getItem(sessionKey)).toBe("session-1");
    expect(fantraxAccountRequest).not.toHaveBeenCalled();

    rerender({ authenticated: true, authLoading: false });
    await waitFor(() => expect(result.current.draftState?.session.id).toBe("session-1"));
    expect(result.current.eligible).toBe(true);
    expect(window.sessionStorage.getItem(sessionKey)).toBe("session-1");
    expect(fantraxAccountRequest).toHaveBeenCalledWith(
      "/api/v1/account/fantrax/draft-sessions/session-1",
    );

    rerender({ authenticated: false, authLoading: false });
    await waitFor(() => expect(window.sessionStorage.getItem(sessionKey)).toBeNull());
    expect(result.current.draftState).toBeNull();
  });

  it("retains the session ID after a temporary resume request failure", async () => {
    window.sessionStorage.setItem(sessionKey, "session-1");
    fantraxAccountRequest.mockImplementation(async (path: string) => {
      if (path.endsWith("/session-1")) throw new Error("Network unavailable");
      return { enabled: true, eligible: true };
    });
    const { result } = renderHook(() => useFantraxDraftSync(true));
    await waitFor(() => expect(result.current.error).toBe("Network unavailable"));
    expect(window.sessionStorage.getItem(sessionKey)).toBe("session-1");
    expect(result.current.draftState).toBeNull();
  });
});
