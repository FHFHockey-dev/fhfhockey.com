import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Gate from "../../../../web/lib/forge-testing-grounds/TestingGroundsOwnerGate";
const auth = vi.hoisted(() => ({ getSession: vi.fn(), onAuthStateChange: vi.fn(), unsubscribe: vi.fn() }));
vi.mock("../../../../web/lib/supabase/client", () => ({ default: { auth } }));
let change: (event: string, session: { access_token: string } | null) => void;
const session = (token: string) => ({ data: { session: { access_token: token } }, error: null });
const grant = () => ({ ok: true, status: 200, json: async () => ({ access: "owner", workspace: "synthetic_preview", execution: "disabled" }) });
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
let visibility: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  vi.clearAllMocks();
  visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  auth.onAuthStateChange.mockImplementation(callback => { change = callback; return { data: { subscription: { unsubscribe: auth.unsubscribe } } }; });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(grant()));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("[independent S05-R1] adjacent lifecycle controls", () => {
  it("discards a session read completed during pagehide and verifies a freshly read session on restoration", async () => {
    const old = deferred<ReturnType<typeof session>>();
    auth.getSession.mockReturnValueOnce(old.promise).mockResolvedValueOnce(session("fresh-after-pageshow"));
    render(<Gate />);
    await waitFor(() => expect(auth.getSession).toHaveBeenCalledTimes(1));
    await act(async () => window.dispatchEvent(new Event("pagehide")));
    await act(async () => {
      old.resolve(session("stale-session-completion"));
      change("TOKEN_REFRESHED", { access_token: "hidden-auth-event" });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(document.visibilityState).toBe("visible");
    expect(fetch).not.toHaveBeenCalled();
    expect(auth.getSession).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Synthetic preview")).toBeNull();
    await act(async () => window.dispatchEvent(new Event("pageshow")));
    await screen.findByText("Synthetic preview");
    expect(auth.getSession).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ headers: { Authorization: "Bearer fresh-after-pageshow" } }));
  });

  it("ignores an old rejected fetch after a newly verified visible return", async () => {
    const old = deferred<ReturnType<typeof grant>>();
    auth.getSession.mockResolvedValueOnce(session("before-hide")).mockResolvedValueOnce(session("after-return"));
    vi.mocked(fetch).mockReturnValueOnce(old.promise as Promise<Response>).mockResolvedValueOnce(grant() as Response);
    render(<Gate />);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const signal = vi.mocked(fetch).mock.calls[0][1]!.signal!;
    await act(async () => { visibility.mockReturnValue("hidden"); document.dispatchEvent(new Event("visibilitychange")); });
    expect(signal.aborted).toBe(true);
    await act(async () => { visibility.mockReturnValue("visible"); document.dispatchEvent(new Event("visibilitychange")); });
    await screen.findByText("Synthetic preview");
    expect(fetch).toHaveBeenCalledTimes(2);
    await act(async () => old.reject(new Error("SYNTHETIC_PRIVATE_LATE_ERROR")));
    expect(screen.getByText("Synthetic preview")).toBeTruthy();
    expect(document.body.textContent).not.toContain("SYNTHETIC_PRIVATE_LATE_ERROR");
  });
});
