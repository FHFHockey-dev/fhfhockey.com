import React from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GetServerSidePropsContext } from "next";
import TestingGroundsOwnerGate from "./TestingGroundsOwnerGate";
import TestingGroundsPage, { getServerSideProps } from "../../pages/forge/testing-grounds";

const auth = vi.hoisted(() => ({ getSession: vi.fn(), onAuthStateChange: vi.fn(), unsubscribe: vi.fn() }));
vi.mock("../supabase/client", () => ({ default: { auth } }));
let change: (event: string, session: { access_token: string } | null) => void;
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
const grant = () => ({ ok: true, status: 200, json: async () => ({ access: "owner", workspace: "synthetic_preview", execution: "disabled" }) });
const session = (token?: string) => ({ data: { session: token ? { access_token: token } : null }, error: null });
beforeEach(() => {
  vi.clearAllMocks();
  auth.getSession.mockResolvedValue(session());
  auth.onAuthStateChange.mockImplementation(callback => { change = callback; return { data: { subscription: { unsubscribe: auth.unsubscribe } } }; });
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("owner workspace lifecycle", () => {
  it("renders only a generic locked SSR frame with no private props or data hooks", async () => {
    const html = renderToString(<TestingGroundsPage />);
    expect(html).toContain("The workspace is locked");
    expect(html).not.toMatch(/Synthetic preview|432|720|run-1|api\/v1|ownerUserId/);
    expect(auth.getSession).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
    const res = { setHeader: vi.fn() };
    expect(await getServerSideProps({ res } as unknown as GetServerSidePropsContext)).toEqual({ props: {} });
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "private, no-store, max-age=0");
    expect(res.setHeader).toHaveBeenCalledWith("X-Robots-Tag", "noindex, nofollow");
  });
  it("signed-out sessions never request workspace access", async () => {
    render(<TestingGroundsOwnerGate />);
    await waitFor(() => expect(auth.getSession).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("Synthetic preview")).toBeNull(); expect(fetch).not.toHaveBeenCalled();
  });
  it("mounts the real synthetic preview only after the verified endpoint response", async () => {
    const pending = deferred<ReturnType<typeof grant>>();
    auth.getSession.mockResolvedValue(session("token-a")); vi.mocked(fetch).mockReturnValue(pending.promise as Promise<Response>);
    render(<TestingGroundsOwnerGate />);
    await screen.findByText("Checking owner access…");
    expect(screen.queryByText("Synthetic preview")).toBeNull();
    expect(fetch).toHaveBeenCalledWith("/api/v1/forge/testing-grounds/access", expect.objectContaining({
      headers: { Authorization: "Bearer token-a" }, credentials: "omit", cache: "no-store",
    }));
    await act(async () => pending.resolve(grant()));
    await screen.findByText("Synthetic preview");
    expect((screen.getByRole("button", { name: "Launch unavailable" }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => change("SIGNED_OUT", null));
    expect(screen.queryByText("Synthetic preview")).toBeNull();
    expect(screen.getByText(/workspace is locked/)).toBeTruthy();
  });
  it.each([401, 403, 503])("server status %s cannot mount the workspace", async status => {
    auth.getSession.mockResolvedValue(session("client-admin-claim"));
    vi.mocked(fetch).mockResolvedValue({ ok: false, status } as Response);
    render(<TestingGroundsOwnerGate />);
    await screen.findByText(status === 503 ? /Owner access is unavailable/ : /restricted to its configured owner/);
    expect(screen.queryByText("Synthetic preview")).toBeNull();
  });
  it("invalid success bodies and rejected requests fail closed", async () => {
    auth.getSession.mockResolvedValue(session("token"));
    vi.mocked(fetch).mockResolvedValue({ ok: true, status: 200, json: async () => ({ role: "admin", access: true }) } as Response);
    render(<TestingGroundsOwnerGate />);
    await screen.findByText(/Owner access is unavailable/);
    vi.mocked(fetch).mockRejectedValueOnce(new Error("private-token-marker"));
    await act(async () => change("TOKEN_REFRESHED", { access_token: "new-token" }));
    await screen.findByText(/Owner access is unavailable/);
    expect(document.body.textContent).not.toContain("private-token-marker");
  });
  it("ignores a late successful response after sign-out", async () => {
    const pending = deferred<ReturnType<typeof grant>>();
    auth.getSession.mockResolvedValue(session("old-token")); vi.mocked(fetch).mockReturnValue(pending.promise as Promise<Response>);
    render(<TestingGroundsOwnerGate />); await screen.findByText("Checking owner access…");
    const signal = vi.mocked(fetch).mock.calls[0][1]!.signal!;
    await act(async () => change("SIGNED_OUT", null));
    expect(signal.aborted).toBe(true);
    await act(async () => pending.resolve(grant()));
    expect(screen.queryByText("Synthetic preview")).toBeNull();
    expect(screen.getByText(/workspace is locked/)).toBeTruthy();
  });
  it("withdraws access on account switch and rejects old-account success after new denial", async () => {
    const pending = deferred<ReturnType<typeof grant>>();
    auth.getSession.mockResolvedValue(session("old-token"));
    vi.mocked(fetch).mockResolvedValueOnce(grant() as Response).mockReturnValueOnce(pending.promise as Promise<Response>)
      .mockResolvedValueOnce({ ok: false, status: 403 } as Response);
    render(<TestingGroundsOwnerGate />); await screen.findByText("Synthetic preview");
    await act(async () => change("TOKEN_REFRESHED", { access_token: "old-refreshed-token" }));
    expect(screen.queryByText("Synthetic preview")).toBeNull();
    await act(async () => change("SIGNED_IN", { access_token: "new-account-token" }));
    await screen.findByText(/restricted to its configured owner/);
    await act(async () => pending.resolve(grant()));
    expect(screen.queryByText("Synthetic preview")).toBeNull();
  });
  it("ignores late initial getSession data after an auth event and cleans up on unmount", async () => {
    const pending = deferred<ReturnType<typeof session>>();
    auth.getSession.mockReturnValue(pending.promise);
    const view = render(<TestingGroundsOwnerGate />);
    await waitFor(() => expect(auth.getSession).toHaveBeenCalledTimes(1));
    await act(async () => change("SIGNED_OUT", null));
    await act(async () => pending.resolve(session("stale-token")));
    expect(fetch).not.toHaveBeenCalled();
    view.unmount(); expect(auth.unsubscribe).toHaveBeenCalledTimes(1);
  });
});
