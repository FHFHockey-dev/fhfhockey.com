import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Gate from "../../../../web/lib/forge-testing-grounds/TestingGroundsOwnerGate";
const auth = vi.hoisted(() => ({ getSession: vi.fn(), onAuthStateChange: vi.fn(), unsubscribe: vi.fn() }));
vi.mock("../../../../web/lib/supabase/client", () => ({ default: { auth } }));
let change: (event: string, session: { access_token: string } | null) => void;
const session = (token = "synthetic-owner-token") => ({ data: { session: { access_token: token } }, error: null });
const capability = () => ({ access: "owner", workspace: "synthetic_preview", execution: "disabled" });
const grant = () => ({ ok: true, status: 200, json: async () => capability() });
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
let visibility: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  vi.clearAllMocks(); visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  auth.getSession.mockResolvedValue(session()); auth.onAuthStateChange.mockImplementation(callback => { change = callback; return { data: { subscription: { unsubscribe: auth.unsubscribe } } }; });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(grant()));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("Independent owner-gate race controls", () => {
  it("does not remount the workspace from an auth refresh while the document remains hidden [S05-R1]", async () => {
    const refreshed = deferred<ReturnType<typeof grant>>(); vi.mocked(fetch).mockResolvedValueOnce(grant() as Response).mockReturnValueOnce(refreshed.promise as Promise<Response>);
    render(<Gate />); await screen.findByText("Synthetic preview");
    await act(async () => { visibility.mockReturnValue("hidden"); document.dispatchEvent(new Event("visibilitychange")); });
    expect(screen.queryByText("Synthetic preview")).toBeNull();
    await act(async () => change("TOKEN_REFRESHED", { access_token: "synthetic-refreshed-token" }));
    await act(async () => refreshed.resolve(grant()));
    expect(document.visibilityState).toBe("hidden"); expect(screen.queryByText("Synthetic preview")).toBeNull();
  });
  it("rejects late JSON capability completion after sign-out even if HTTP headers were previously successful", async () => {
    const body = deferred<ReturnType<typeof capability>>(); vi.mocked(fetch).mockResolvedValue({ ok: true, status: 200, json: () => body.promise } as Response);
    render(<Gate />); await screen.findByText("Checking owner access…"); await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    await act(async () => change("SIGNED_OUT", null));
    await act(async () => body.resolve(capability()));
    expect(screen.queryByText("Synthetic preview")).toBeNull(); expect(screen.getByText(/workspace is locked/)).toBeTruthy();
  });
  it("keeps session-read errors and enabled/incorrect capability bodies unavailable without reflecting private messages", async () => {
    auth.getSession.mockResolvedValueOnce({ data: { session: { access_token: "SYNTHETIC_PRIVATE_TOKEN" } }, error: new Error("SYNTHETIC_PRIVATE_MESSAGE") });
    render(<Gate />); await screen.findByText(/Owner access is unavailable/); expect(fetch).not.toHaveBeenCalled();
    vi.mocked(fetch).mockResolvedValue({ ok: true, status: 200, json: async () => ({ ...capability(), execution: "enabled", message: "SYNTHETIC_PRIVATE_MESSAGE" }) } as Response);
    await act(async () => change("SIGNED_IN", { access_token: "synthetic-new-token" })); await screen.findByText(/Owner access is unavailable/);
    expect(screen.queryByText("Synthetic preview")).toBeNull(); expect(document.body.textContent).not.toContain("SYNTHETIC_PRIVATE");
  });
});
