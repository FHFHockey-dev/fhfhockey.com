import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { NextApiRequest, NextApiResponse } from "next";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ user: vi.fn(), season: vi.fn(), draft: vi.fn(), session: vi.fn(), management: false, listeners: new Set<(event: string, session: unknown) => void>() }));
vi.mock("lib/api/requireApiUser", () => ({ requireApiUser: mocks.user }));
vi.mock("lib/in-season/server", () => ({ loadInSeasonAccess: mocks.season }));
vi.mock("lib/draft-pro/server", () => ({ loadDraftProAccess: mocks.draft }));
vi.mock("lib/supabase/client", () => ({ default: { auth: {
  getSession: mocks.session,
  onAuthStateChange: (listener: (event: string, session: unknown) => void) => {
    mocks.listeners.add(listener); return { data: { subscription: { unsubscribe: () => mocks.listeners.delete(listener) } } };
  },
} } }));
vi.mock("next/link", () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));
import syncRoute from "pages/api/v1/account/provider-sync";
import InSeasonPanel from "./InSeasonPanel";

const jsonResponse = (body: unknown, status = 200) => ({ ok: status === 200, status, json: async () => body });
async function readSync(url: URL, init?: RequestInit) {
  let code = 200;
  let body: unknown;
  const reply = { setHeader: vi.fn(), status(value: number) { code = value; return this; }, json(value: unknown) { body = value; return this; }, end() { return this; } };
  await syncRoute({ method: "GET", query: Object.fromEntries(url.searchParams), headers: { authorization: (init?.headers as Record<string, string>)?.Authorization } } as unknown as NextApiRequest, reply as unknown as NextApiResponse);
  return jsonResponse(body, code);
}
const noPurchasePitch = () => {
  expect(screen.queryByRole("button", { name: /Buy season pass|Start monthly|Monthly checkout/ })).toBeNull();
  expect(screen.queryByText(/Choose \$4.99 monthly/)).toBeNull();
};
beforeEach(() => {
  vi.resetAllMocks(); mocks.listeners.clear(); mocks.management = false;
  vi.stubEnv("PROVIDER_SYNC_PREMIUM_ENFORCEMENT_ENABLED", undefined);
  mocks.user.mockResolvedValue({ id: "owner" });
  mocks.session.mockResolvedValue({ data: { session: { access_token: "synthetic-token", user: { id: "owner" } } } });
  mocks.season.mockResolvedValue({ eligible: false, capabilities: [], reason: "no_active_grant" });
  mocks.draft.mockResolvedValue({ eligible: false, reason: "no_active_grant" });
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "https://fixture.invalid");
    if (url.pathname === "/api/v1/account/provider-sync") return readSync(url, init);
    if (url.pathname === "/api/v1/account/in-season/checkout") return jsonResponse({ data: { seasonPassAvailable: false, monthlyAvailable: false, monthlyReason: "disabled", managementAvailable: mocks.management } });
    if (url.pathname === "/api/v1/account/in-season/subscriptions") return jsonResponse({ data: { subscriptions: [{ subscriptionId: "sub-fixture", cancelledAt: null, billingStoppedAt: null, stopComplete: false }] } });
    if (url.pathname === "/api/v1/account/in-season/cancel") return jsonResponse({ data: { accepted: true } });
    throw new Error(`Unexpected fixture request: ${url.pathname}`);
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it("explains free rollout through the actual route and hook without a disabled purchase pitch", async () => {
  render(<InSeasonPanel />);
  await screen.findByText(/sync are currently available without a paid membership/);
  await waitFor(() => expect(mocks.season).toHaveBeenCalledWith("owner"));
  noPurchasePitch();
  expect(screen.queryByText(/Premium sync is active/)).toBeNull();
  expect(fetch).toHaveBeenCalledWith("/api/v1/account/provider-sync", expect.anything());
  expect(fetch).toHaveBeenCalledWith("/api/v1/account/provider-sync?entitlementOnly=true", expect.anything());
});
it.each(["paid", "grandfathered"])("preserves %s membership and cancellation controls while rollout is free", async kind => {
  mocks.management = true;
  const grant = { eligible: true, reason: "eligible", expiresAt: "2027-07-01T04:00:00Z", capabilities: ["rso_sync"] };
  if (kind === "paid") mocks.season.mockResolvedValue(grant); else mocks.draft.mockResolvedValue(grant);
  render(<InSeasonPanel />);
  await screen.findByText(/sync are currently available without a paid membership/);
  await screen.findByText(/Premium sync is active/);
  fireEvent.click(await screen.findByRole("button", { name: "Cancel monthly access" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm cancellation" }));
  await screen.findByText(/Cancellation saved/);
  expect(fetch).toHaveBeenCalledWith("/api/v1/account/in-season/cancel", expect.objectContaining({ method: "POST", headers: expect.objectContaining({ Authorization: "Bearer synthetic-token" }) }));
  noPurchasePitch();
});
it("separates a failed membership check from working free sync", async () => {
  mocks.season.mockRejectedValue(new Error("fixture billing unavailable")); mocks.draft.mockRejectedValue(new Error("fixture billing unavailable"));
  render(<InSeasonPanel />);
  await screen.findByText(/sync are currently available without a paid membership/);
  await screen.findByText(/Your membership could not be verified/);
  noPurchasePitch();
});
it("retains the purchase presentation when the server explicitly enforces premium", async () => {
  vi.stubEnv("PROVIDER_SYNC_PREMIUM_ENFORCEMENT_ENABLED", "true");
  render(<InSeasonPanel />);
  expect(await screen.findByRole("button", { name: /Buy season pass/ })).toBeTruthy();
  expect(screen.queryByText(/sync are currently available without a paid membership/)).toBeNull();
});
it("withholds the purchase pitch when rollout readback fails", async () => {
  const delegate = vi.mocked(fetch).getMockImplementation()!;
  vi.mocked(fetch).mockImplementation((input, init) => String(input) === "/api/v1/account/provider-sync" ? Promise.reject(new Error("fixture outage")) : delegate(input, init));
  render(<InSeasonPanel />);
  await screen.findByText(/Current sync availability could not be checked/);
  noPurchasePitch();
  expect(screen.queryByText(/sync are currently available without a paid membership/)).toBeNull();
});
it("removes the free-rollout and membership state on sign-out", async () => {
  render(<InSeasonPanel />);
  await screen.findByText(/sync are currently available without a paid membership/);
  mocks.session.mockResolvedValue({ data: { session: null } });
  await act(async () => { for (const listener of mocks.listeners) listener("SIGNED_OUT", null); });
  await screen.findByRole("link", { name: "Sign in to view your access" });
  expect(screen.queryByText(/sync are currently available without a paid membership/)).toBeNull();
  noPurchasePitch();
});
