import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ access: vi.fn(), session: vi.fn(), auth: vi.fn(), refresh: vi.fn() }));
vi.mock("hooks/useProviderSyncAccess", () => ({ useProviderSyncAccess: mocks.access }));
vi.mock("lib/supabase/client", () => ({ default: { auth: { getSession: mocks.session, onAuthStateChange: mocks.auth } } }));
vi.mock("next/link", () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));
import InSeasonPanel from "./InSeasonPanel";
import ProviderSyncNotice from "./ProviderSyncNotice";

beforeEach(() => {
  vi.resetAllMocks(); sessionStorage.clear();
  mocks.auth.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
  mocks.session.mockResolvedValue({ data: { session: { access_token: "fixture", user: { id: "owner-a" } } } });
  mocks.access.mockReturnValue({ status: "ready", access: { eligible: false }, refresh: mocks.refresh });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { seasonPassAvailable: false } }) }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("shows the agreed price, Eastern cutoff and monthly unavailability without legacy checkout", () => {
  render(<InSeasonPanel />);
  expect(mocks.access).toHaveBeenCalledWith({ entitlementOnly: true });
  expect(mocks.access).toHaveBeenCalledWith();
  expect(screen.getByRole("heading", { name: "Season pass · $24.99" })).toBeTruthy();
  expect(screen.getByText(/midnight New York time/)).toBeTruthy();
  expect(screen.getByRole("button", { name: /Buy season pass/ }).hasAttribute("disabled")).toBe(true);
  expect(screen.getByRole("button", { name: /Monthly checkout/ }).hasAttribute("disabled")).toBe(true);
  expect(document.querySelector('[href*="section=draft-pro"]')).toBeNull();
});
it.each(["idle", "loading", "error"])("offers no purchase while access is %s", (status) => { mocks.access.mockReturnValue({ status, access: null, refresh: mocks.refresh }); render(<InSeasonPanel />); expect(screen.queryByRole("button", { name: /Buy season pass/ })).toBeNull(); });
it("retains existing access without selling another purchase", () => { mocks.access.mockReturnValue({ status: "ready", access: { eligible: true }, refresh: mocks.refresh }); render(<InSeasonPanel />); expect(screen.getByText(/Premium sync is active/)).toBeTruthy(); expect(screen.queryByRole("button", { name: /Buy season pass/ })).toBeNull(); });
it("sends only the plan to the new authenticated checkout and displays transient failure", async () => {
  const fetcher = vi.mocked(fetch);
  fetcher.mockResolvedValueOnce({ ok: true, json: async () => ({ data: { seasonPassAvailable: true } }) } as Response);
  fetcher.mockResolvedValueOnce({ ok: false, json: async () => ({ error: "Please try again." }) } as Response);
  render(<InSeasonPanel />);
  await waitFor(() => expect(screen.getByRole("button", { name: /Buy season pass/ }).hasAttribute("disabled")).toBe(false));
  fireEvent.click(screen.getByRole("button", { name: /Buy season pass/ }));
  await screen.findByText("Please try again.");
  expect(fetcher).toHaveBeenCalledWith("/api/v1/account/in-season/checkout", expect.objectContaining({ method: "POST", body: '{"plan":"season_pass"}', headers: { Authorization: "Bearer fixture", "Content-Type": "application/json" } }));
});
it("routes shared premium upsells to in-season and anonymous sign-in separately", () => {
  const { rerender } = render(<ProviderSyncNotice status="ready" access={{ eligible: false, expiresAt: null, nextVerificationAt: null, reason: "no_active_grant" }} refresh={vi.fn()} />);
  expect(screen.getByRole("link").getAttribute("href")).toBe("/account?section=in-season");
  rerender(<ProviderSyncNotice status="idle" access={null} refresh={vi.fn()} />);
  expect(screen.getByRole("link").getAttribute("href")).toBe("/auth?mode=sign-in");
});
it("ignores an old account's checkout response after authentication changes", async () => {
  let finish!: (value: Response) => void;
  vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ data: { seasonPassAvailable: true } }) } as Response);
  vi.mocked(fetch).mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
  render(<InSeasonPanel />);
  await waitFor(() => expect(screen.getByRole("button", { name: /Buy season pass/ }).hasAttribute("disabled")).toBe(false));
  fireEvent.click(screen.getByRole("button", { name: /Buy season pass/ }));
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  act(() => mocks.auth.mock.calls[0][0]("SIGNED_OUT", null));
  finish({ ok: false, json: async () => ({ error: "Old account response" }) } as Response);
  await waitFor(() => expect(screen.getByRole("button", { name: /Buy season pass/ }).hasAttribute("disabled")).toBe(true));
  expect(screen.queryByText("Old account response")).toBeNull();
});

const subscription = { subscriptionId: "sub_fixture", cancelledAt: null, billingStoppedAt: null, stopComplete: false };
function fixtureApi(options: { monthly?: boolean; management?: boolean; subscriptions?: unknown[]; reason?: string } = {}) {
  vi.mocked(fetch).mockImplementation(async (url, init) => {
    if (url === "/api/v1/account/in-season/subscriptions") return { ok: true, json: async () => ({ data: { subscriptions: options.subscriptions ?? [subscription] } }) } as Response;
    if (init?.method === "POST") return { ok: true, json: async () => ({ data: url === "/api/v1/account/in-season/cancel" ? { accepted: true } : { state: "confirming", url: null } }) } as Response;
    return { ok: true, json: async () => ({ data: { seasonPassAvailable: false, monthlyAvailable: options.monthly === true, managementAvailable: options.management === true,
      initialMonthlyAmountCents: 177, monthlyReason: options.reason ?? "disabled" } }) } as Response;
  });
}
it("starts monthly only after availability and shows pending verification, never grants access locally", async () => {
  fixtureApi({ monthly: true }); render(<InSeasonPanel />);
  fireEvent.click(await screen.findByRole("button", { name: "Start monthly · $4.99" }));
  await screen.findByText(/Access begins after payment is verified/);
  expect(fetch).toHaveBeenCalledWith("/api/v1/account/in-season/checkout", expect.objectContaining({ body: '{"plan":"monthly"}' }));
  expect(screen.getByText(/Estimated first charge: \$1.77/)).toBeTruthy(); expect(screen.queryByText(/Premium sync is active/)).toBeNull();
});
it.each(["https://checkout.stripe.com/legacy", "https://invoice.stripe.com.evil.example/path", "https://user:pass@invoice.stripe.com/path", "http://invoice.stripe.com/path", "https://invoice.stripe.com:444/path"])("rejects incorrect monthly payment destination %s", async url => {
  fixtureApi({ monthly: true }); const implementation = vi.mocked(fetch).getMockImplementation()!;
  vi.mocked(fetch).mockImplementation(async (input, init) => init?.method === "POST" ? { ok: true, json: async () => ({ data: { url } }) } as Response : implementation(input, init));
  render(<InSeasonPanel />); fireEvent.click(await screen.findByRole("button", { name: "Start monthly · $4.99" }));
  await screen.findByText("Checkout returned an invalid destination.");
});
it("explains below-minimum unavailability without enabling monthly", async () => {
  fixtureApi({ reason: "below_verified_minimum" }); render(<InSeasonPanel />);
  await screen.findByText(/We will not round it up or carry a balance/);
  expect(screen.getByRole("button", { name: /Monthly checkout/ }).hasAttribute("disabled")).toBe(true);
});
it.each(["ready", "error"])("allows owner cancellation independently of entitlement state %s and preserves manual plans", async status => {
  mocks.access.mockReturnValue({ status, access: status === "ready" ? { eligible: true } : null, refresh: mocks.refresh });
  fixtureApi({ management: true }); localStorage.setItem("manual-plan-fixture", "preserved");
  render(<InSeasonPanel />); fireEvent.click(await screen.findByRole("button", { name: "Cancel monthly access" }));
  expect(screen.getByRole("alertdialog", { name: "Confirm monthly cancellation" })).toBeTruthy();
  expect(vi.mocked(fetch).mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Confirm cancellation" }));
  await screen.findByText(/Cancellation saved/);
  const call = vi.mocked(fetch).mock.calls.find(([url, init]) => url === "/api/v1/account/in-season/cancel" && init?.method === "POST")!;
  expect(JSON.parse(call[1]!.body as string)).toEqual({ subscriptionId: "sub_fixture", requestId: expect.stringMatching(/^[a-f0-9-]{36}$/) });
  expect(call[1]!.headers).toEqual({ Authorization: "Bearer fixture", "Content-Type": "application/json" });
  expect(localStorage.getItem("manual-plan-fixture")).toBe("preserved"); localStorage.removeItem("manual-plan-fixture");
});
it("reuses the cancellation request ID after an uncertain response and never claims success", async () => {
  fixtureApi({ management: true }); const implementation = vi.mocked(fetch).getMockImplementation()!;
  vi.mocked(fetch).mockImplementation(async (input, init) => input === "/api/v1/account/in-season/cancel" ? { ok: false, json: async () => ({ error: "Cancellation could not be saved. Please try again." }) } as Response : implementation(input, init));
  render(<InSeasonPanel />); fireEvent.click(await screen.findByRole("button", { name: "Cancel monthly access" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm cancellation" })); await screen.findByText(/Cancellation could not be saved/);
  await waitFor(() => expect(screen.getByRole("button", { name: "Confirm cancellation" }).hasAttribute("disabled")).toBe(false));
  fireEvent.click(screen.getByRole("button", { name: "Confirm cancellation" }));
  await waitFor(() => expect(vi.mocked(fetch).mock.calls.filter(([url]) => url === "/api/v1/account/in-season/cancel")).toHaveLength(2));
  const calls = vi.mocked(fetch).mock.calls.filter(([url]) => url === "/api/v1/account/in-season/cancel");
  expect(calls[0][1]!.body).toBe(calls[1][1]!.body); expect(screen.queryByText(/Cancellation saved/)).toBeNull();
});
it("clears old billing details on account change and ignores delayed owner readback", async () => {
  fixtureApi({ management: true }); const implementation = vi.mocked(fetch).getMockImplementation()!;
  let finish!: (value: Response) => void;
  vi.mocked(fetch).mockImplementation((input, init) => input === "/api/v1/account/in-season/subscriptions" ? new Promise(resolve => { finish = resolve; }) : implementation(input, init));
  render(<InSeasonPanel />); await waitFor(() => expect(finish).toBeTypeOf("function"));
  mocks.session.mockResolvedValue({ data: { session: null } });
  act(() => mocks.auth.mock.calls[0][0]("SIGNED_OUT", null));
  await act(async () => finish({ ok: true, json: async () => ({ data: { subscriptions: [subscription] } }) } as Response));
  expect(screen.queryByRole("button", { name: "Cancel monthly access" })).toBeNull();
});
it("does not call owner lookup until management is enabled", async () => {
  fixtureApi(); render(<InSeasonPanel />); await waitFor(() => expect(fetch).toHaveBeenCalled());
  expect(vi.mocked(fetch).mock.calls.some(([url]) => url === "/api/v1/account/in-season/subscriptions")).toBe(false);
});
it("does not equate a billing stop request with completed provider cleanup or revoke unrelated access", async () => {
  mocks.access.mockReturnValue({ status: "ready", access: { eligible: true }, refresh: mocks.refresh });
  fixtureApi({ management: true, subscriptions: [{ ...subscription, billingStoppedAt: "2027-05-01T04:00:00Z" }] });
  render(<InSeasonPanel />); await screen.findByText(/Billing stop requested.*Billing stop is pending/);
  expect(screen.getByText(/Premium sync is active/)).toBeTruthy(); expect(screen.queryByText(/Billing stop completed/)).toBeNull();
});
it("opens the verified monthly invoice destination without redirecting to the legacy checkout", async () => {
  const assign = vi.fn(); const browserWindow = Object.create(window);
  Object.defineProperty(browserWindow, "location", { value: { assign } }); vi.stubGlobal("window", browserWindow);
  fixtureApi({ monthly: true }); const implementation = vi.mocked(fetch).getMockImplementation()!;
  vi.mocked(fetch).mockImplementation(async (input, init) => init?.method === "POST" ? { ok: true, json: async () => ({ data: { url: "https://invoice.stripe.com/fixture" } }) } as Response : implementation(input, init));
  render(<InSeasonPanel />); fireEvent.click(await screen.findByRole("button", { name: "Start monthly · $4.99" }));
  await waitFor(() => expect(assign).toHaveBeenCalledWith("https://invoice.stripe.com/fixture"));
});
it("ignores an old account's accepted cancellation after sign-out", async () => {
  fixtureApi({ management: true }); const implementation = vi.mocked(fetch).getMockImplementation()!;
  let finish!: (value: Response) => void;
  vi.mocked(fetch).mockImplementation((input, init) => input === "/api/v1/account/in-season/cancel" ? new Promise(resolve => { finish = resolve; }) : implementation(input, init));
  render(<InSeasonPanel />); fireEvent.click(await screen.findByRole("button", { name: "Cancel monthly access" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm cancellation" })); await waitFor(() => expect(finish).toBeTypeOf("function"));
  mocks.session.mockResolvedValue({ data: { session: null } }); act(() => mocks.auth.mock.calls[0][0]("SIGNED_OUT", null));
  await act(async () => finish({ ok: true, json: async () => ({ data: { accepted: true } }) } as Response));
  expect(screen.queryByText(/Cancellation saved/)).toBeNull(); expect(screen.queryByRole("alertdialog")).toBeNull();
  expect(mocks.refresh).not.toHaveBeenCalled();
});
it("shows completed stop readback without claiming that an accepted cancellation is still pending", async () => {
  const options: Parameters<typeof fixtureApi>[0] = { management: true };
  fixtureApi(options); const implementation = vi.mocked(fetch).getMockImplementation()!;
  vi.mocked(fetch).mockImplementation(async (input, init) => {
    if (input === "/api/v1/account/in-season/cancel") options.subscriptions = [{ ...subscription, cancelledAt: "2027-05-01T04:00:00Z", stopComplete: true }];
    return implementation(input, init);
  });
  render(<InSeasonPanel />); fireEvent.click(await screen.findByRole("button", { name: "Cancel monthly access" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm cancellation" })); await screen.findByText(/Billing stop completed/);
  expect(screen.queryByText(/Billing stop is pending/)).toBeNull(); expect(screen.queryByRole("button", { name: "Cancel monthly access" })).toBeNull();
});
it.each(["TOKEN_REFRESHED", "SIGNED_IN"])("preserves an unresolved cancellation ID through same-owner %s", async event => {
  fixtureApi({ management: true }); const implementation = vi.mocked(fetch).getMockImplementation()!;
  vi.mocked(fetch).mockImplementation((input, init) => input === "/api/v1/account/in-season/cancel" ? Promise.reject(new Error("Cancellation response lost")) : implementation(input, init));
  render(<InSeasonPanel />); fireEvent.click(await screen.findByRole("button", { name: "Cancel monthly access" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm cancellation" })); await screen.findByText("Cancellation response lost");
  const refreshed = { access_token: "refreshed-fixture", user: { id: "owner-a" } };
  mocks.session.mockResolvedValue({ data: { session: refreshed } });
  act(() => mocks.auth.mock.calls[0][0](event, refreshed));
  fireEvent.click(await screen.findByRole("button", { name: "Cancel monthly access" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm cancellation" })); await screen.findByText("Cancellation response lost");
  const calls = vi.mocked(fetch).mock.calls.filter(([url]) => url === "/api/v1/account/in-season/cancel");
  expect(calls).toHaveLength(2); expect(calls[1][1]!.body).toBe(calls[0][1]!.body);
  expect(calls[1][1]!.headers).toEqual({ Authorization: "Bearer refreshed-fixture", "Content-Type": "application/json" });
  expect(screen.queryByText(/Cancellation saved/)).toBeNull();
});
it.each(["owner_change", "owner_change_without_event", "sign_out_then_same_owner"])("clears unresolved cancellation IDs on %s", async transition => {
  fixtureApi({ management: true }); const implementation = vi.mocked(fetch).getMockImplementation()!;
  vi.mocked(fetch).mockImplementation((input, init) => input === "/api/v1/account/in-season/cancel" ? Promise.reject(new Error("Cancellation response lost")) : implementation(input, init));
  render(<InSeasonPanel />); fireEvent.click(await screen.findByRole("button", { name: "Cancel monthly access" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm cancellation" })); await screen.findByText("Cancellation response lost");
  if (transition === "sign_out_then_same_owner") {
    mocks.session.mockResolvedValue({ data: { session: null } });
    act(() => mocks.auth.mock.calls[0][0]("SIGNED_OUT", null));
    expect(screen.queryByRole("alertdialog")).toBeNull(); expect(screen.queryByText("Cancellation response lost")).toBeNull();
  }
  const nextSession = { access_token: "next-fixture", user: { id: transition === "sign_out_then_same_owner" ? "owner-a" : "owner-b" } };
  mocks.session.mockResolvedValue({ data: { session: nextSession } });
  if (transition !== "owner_change_without_event") act(() => mocks.auth.mock.calls[0][0]("SIGNED_IN", nextSession));
  fireEvent.click(await screen.findByRole("button", { name: "Cancel monthly access" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm cancellation" })); await screen.findByText("Cancellation response lost");
  const calls = vi.mocked(fetch).mock.calls.filter(([url]) => url === "/api/v1/account/in-season/cancel");
  expect(calls).toHaveLength(2);
  // Deliberately repeat the same synthetic subscription ID: identity alone must
  // never carry an earlier owner's unresolved request into a new session owner.
  expect(JSON.parse(calls[1][1]!.body as string).requestId).not.toBe(JSON.parse(calls[0][1]!.body as string).requestId);
  expect(calls[1][1]!.headers).toEqual({ Authorization: "Bearer next-fixture", "Content-Type": "application/json" });
});
const storedCancellation = "fhfh:in-season-cancellation:v1";
const sentCancellationIds = () => vi.mocked(fetch).mock.calls.filter(([url]) => url === "/api/v1/account/in-season/cancel").map(([, init]) => JSON.parse(init!.body as string).requestId as string);
async function attemptCancellation(error = "Cancellation response lost") {
  fireEvent.click(await screen.findByRole("button", { name: "Cancel monthly access" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm cancellation" })); await screen.findByText(error);
}
function loseCancellationResponses() {
  fixtureApi({ management: true }); const implementation = vi.mocked(fetch).getMockImplementation()!;
  vi.mocked(fetch).mockImplementation((input, init) => input === "/api/v1/account/in-season/cancel" ? Promise.reject(new Error("Cancellation response lost")) : implementation(input, init));
}
const signIn = (id: string, token = `${id}-fixture`) => { const session = { access_token: token, user: { id } }; mocks.session.mockResolvedValue({ data: { session } }); return session; };
it.each(["without_callback", "INITIAL_SESSION", "TOKEN_REFRESHED"])("reuses the same owner's unresolved cancellation ID after a browser reload %s", async event => {
  loseCancellationResponses(); render(<InSeasonPanel />); await attemptCancellation();
  cleanup(); render(<InSeasonPanel />);
  if (event !== "without_callback") act(() => mocks.auth.mock.lastCall![0](event, signIn("owner-a", "reloaded-fixture")));
  await attemptCancellation();
  const ids = sentCancellationIds(); expect(ids).toHaveLength(2); expect(ids[1]).toBe(ids[0]);
  expect(screen.queryByText(/Cancellation saved/)).toBeNull();
  // Only the owner, subscription, request ID and save time persist; never a token.
  expect(JSON.parse(sessionStorage.getItem(storedCancellation)!)).toEqual({ ownerId: "owner-a", requests: { sub_fixture: { requestId: ids[0], savedAt: expect.any(Number) } } });
});
it.each(["foreign_owner_without_callback", "foreign_owner_callback", "signed_out_then_same_owner", "anonymous_reload_then_same_owner"])("never recovers an unresolved cancellation ID after reload on %s", async transition => {
  loseCancellationResponses(); render(<InSeasonPanel />); await attemptCancellation();
  cleanup(); render(<InSeasonPanel />); const listener = mocks.auth.mock.lastCall![0];
  if (transition === "foreign_owner_without_callback") signIn("owner-b");
  if (transition === "foreign_owner_callback") act(() => listener("INITIAL_SESSION", signIn("owner-b")));
  if (transition === "signed_out_then_same_owner") { mocks.session.mockResolvedValue({ data: { session: null } }); act(() => listener("SIGNED_OUT", null)); }
  if (transition === "anonymous_reload_then_same_owner") { mocks.session.mockResolvedValue({ data: { session: null } }); act(() => listener("INITIAL_SESSION", null)); }
  if (transition !== "foreign_owner_without_callback" && transition !== "foreign_owner_callback") {
    expect(sessionStorage.getItem(storedCancellation)).toBeNull(); act(() => listener("SIGNED_IN", signIn("owner-a")));
  }
  await attemptCancellation();
  const ids = sentCancellationIds(); expect(ids).toHaveLength(2); expect(ids[1]).not.toBe(ids[0]); expect(ids[1]).toMatch(/^[a-f0-9-]{36}$/);
  const owner = transition.startsWith("foreign") ? "owner-b" : "owner-a";
  expect(JSON.parse(sessionStorage.getItem(storedCancellation)!)).toEqual({ ownerId: owner, requests: { sub_fixture: { requestId: ids[1], savedAt: expect.any(Number) } } });
});
const seededId = "11111111-2222-4333-8444-555555555555";
it.each([
  ["corrupt JSON", () => "{not json"],
  ["another owner", () => JSON.stringify({ ownerId: "owner-b", requests: { sub_fixture: { requestId: seededId, savedAt: Date.now() } } })],
  ["expired entry", () => JSON.stringify({ ownerId: "owner-a", requests: { sub_fixture: { requestId: seededId, savedAt: Date.now() - 25 * 60 * 60 * 1000 } } })],
  ["future entry", () => JSON.stringify({ ownerId: "owner-a", requests: { sub_fixture: { requestId: seededId, savedAt: Date.now() + 60 * 60 * 1000 } } })],
  ["malformed request ID", () => JSON.stringify({ ownerId: "owner-a", requests: { sub_fixture: { requestId: "../../not-a-request", savedAt: Date.now() } } })],
  ["36-character non-UUID request ID", () => JSON.stringify({ ownerId: "owner-a", requests: { sub_fixture: { requestId: "-".repeat(36), savedAt: Date.now() } } })],
  ["non-v4 UUID request ID", () => JSON.stringify({ ownerId: "owner-a", requests: { sub_fixture: { requestId: "11111111-2222-1333-8444-555555555555", savedAt: Date.now() } } })],
  ["uppercase request ID the route would reject", () => JSON.stringify({ ownerId: "owner-a", requests: { sub_fixture: { requestId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee".toUpperCase(), savedAt: Date.now() } } })],
  ["wrong shape", () => JSON.stringify({ ownerId: "owner-a", requests: ["sub_fixture", seededId] })],
])("fails safe on %s stored cancellation state", async (_, stored) => {
  const seeded = stored(); sessionStorage.setItem(storedCancellation, seeded);
  loseCancellationResponses(); render(<InSeasonPanel />); await attemptCancellation();
  const [id] = sentCancellationIds(); expect(seeded.toLowerCase()).not.toContain(id); expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  expect(JSON.parse(sessionStorage.getItem(storedCancellation)!)).toEqual({ ownerId: "owner-a", requests: { sub_fixture: { requestId: id, savedAt: expect.any(Number) } } });
});
it("restores a real generated request ID after reload", async () => {
  const generated = crypto.randomUUID();
  sessionStorage.setItem(storedCancellation, JSON.stringify({ ownerId: "owner-a", requests: { sub_fixture: { requestId: generated, savedAt: Date.now() - 1000 } } }));
  loseCancellationResponses(); render(<InSeasonPanel />); await attemptCancellation();
  expect(sentCancellationIds()).toEqual([generated]);
});
it("recovers a valid same-owner stored ID without disturbing other subscriptions' entries", async () => {
  const other = { requestId: "99999999-8888-4777-8666-555555555555", savedAt: Date.now() - 1000 };
  sessionStorage.setItem(storedCancellation, JSON.stringify({ ownerId: "owner-a", requests: { sub_fixture: { requestId: seededId, savedAt: Date.now() - 1000 }, sub_other: other } }));
  loseCancellationResponses(); render(<InSeasonPanel />); await attemptCancellation();
  expect(sentCancellationIds()).toEqual([seededId]);
  expect(JSON.parse(sessionStorage.getItem(storedCancellation)!).requests.sub_other).toEqual(other);
});
it("drops the stored ID once cancellation is accepted", async () => {
  loseCancellationResponses(); render(<InSeasonPanel />); await attemptCancellation();
  fixtureApi({ management: true }); fireEvent.click(screen.getByRole("button", { name: "Confirm cancellation" }));
  await screen.findByText(/Cancellation saved/);
  const ids = sentCancellationIds(); expect(ids[1]).toBe(ids[0]); expect(sessionStorage.getItem(storedCancellation)).toBeNull();
});
it("keeps mounted retry continuity when browser storage is unavailable", async () => {
  const blocked = () => { throw new Error("storage blocked"); };
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(blocked); vi.spyOn(Storage.prototype, "setItem").mockImplementation(blocked); vi.spyOn(Storage.prototype, "removeItem").mockImplementation(blocked);
  try {
    loseCancellationResponses(); render(<InSeasonPanel />); await attemptCancellation();
    fireEvent.click(screen.getByRole("button", { name: "Confirm cancellation" }));
    await waitFor(() => expect(sentCancellationIds()).toHaveLength(2));
    const ids = sentCancellationIds(); expect(ids[1]).toBe(ids[0]);
  } finally { vi.restoreAllMocks(); }
});
