import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import DraftProPanel from "./DraftProPanel";

type AuthSession = { access_token?: string; user?: { id: string } };
type AuthListener = (event: string, session: AuthSession | null) => void;
type AuthSubscription = { data: { subscription: { unsubscribe: () => void } } };
const getSession = vi.hoisted(() => vi.fn());
const routerQuery = vi.hoisted(() => ({} as Record<string, string>));
const onAuthStateChange = vi.hoisted(() => vi.fn<(listener: AuthListener) => AuthSubscription>(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })));
const replace = vi.hoisted(() => vi.fn());
vi.mock("lib/supabase/client", () => ({ default: { auth: { getSession, onAuthStateChange } } }));
vi.mock("next/router", () => ({ useRouter: () => ({ query: routerQuery, pathname: "/account", replace }) }));

const account = {
  access: { eligible: true, grantingSources: ["purchase"], expiresAt: "2027-07-01T04:00:00.000Z", verifiedAt: null, reason: "eligible", providerReadiness: { patreon: false } },
  passInfo: { priceCents: 599, expiresAt: "2027-07-01T04:00:00.000Z", renewal: "none" as const },
  checkoutAvailability: { available: true, reason: "available" },
  purchases: [{ id: "purchase-1", season: "draft_pro_2026_27", status: "active", activatedAt: "2026-09-05T00:00:00.000Z", expiresAt: "2027-07-01T04:00:00.000Z", amountCents: 599, currency: "usd", receiptUrl: null, refundEligibility: { eligible: true, deadline: "2026-09-12T00:00:00.000Z", reason: "eligible" } }],
  refundRequests: [],
  savedDrafts: [{ id: "draft-1", name: "Opening night", status: "active", updatedAt: "2026-09-06T00:00:00.000Z" }],
  privateImports: [],
};

describe("DraftProPanel", () => {
  it.each([true, false])("lists God View only when the capability is available (%s)", async (enabled) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { ...account, access: { ...account.access, capabilities: enabled ? ["god_view"] : [] } } }) }));
    render(<DraftProPanel />);
    await screen.findByText("Active");
    expect(Boolean(screen.queryByText(/God View — upcoming picks/))).toBe(enabled);
  });

  beforeEach(() => { getSession.mockResolvedValue({ data: { session: { access_token: "token", user: { id: "A" } } } }); replace.mockClear(); onAuthStateChange.mockClear(); });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); vi.restoreAllMocks(); delete routerQuery.draft_pro_checkout; });

  it("shows loading and then the server-computed refund form", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: account }) }));
    render(<DraftProPanel />);
    expect(screen.getByText("Loading account access…")).toBeTruthy();
    expect(await screen.findByRole("button", { name: "Submit request" })).toBeTruthy();
    expect(screen.getByText(/June 30, 2027.*Eastern/)).toBeTruthy();
    expect(screen.getByText("Opening night")).toBeTruthy();
  });

  it("lists only server-enabled features before purchase", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { ...account, access: { ...account.access, eligible: false }, availableFeatures: ["recommendations"] } }) }));
    render(<DraftProPanel />);
    expect(await screen.findByText("Roster-aware recommendations and personalized replacement analysis")).toBeTruthy();
    expect(screen.queryByText("Aggregated projection CSV export")).toBeNull();
    expect(screen.getByRole("link", { name: "Refund requests" }).getAttribute("href")).toBe("/draft-pro/policies#refunds");
  });

  it("shows a server error without rendering a refund form", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: { message: "Account unavailable" } }) }));
    render(<DraftProPanel />);
    expect((await screen.findByRole("alert")).textContent).toContain("Account unavailable");
    await waitFor(() => expect(screen.queryByRole("button", { name: "Submit request" })).toBeNull());
  });

  it("lets an older eligible purchase be selected and submits its request", async () => {
    const mixedAccount = { ...account, purchases: [
      { ...account.purchases[0], id: "purchase-pending", status: "pending", refundEligibility: { eligible: false, deadline: null, reason: "purchase_ineligible" } },
      { ...account.purchases[0], id: "purchase-old", refundEligibility: { eligible: true, deadline: "2026-09-12T00:00:00.000Z", reason: "eligible" } },
    ] };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: mixedAccount }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { id: "refund-1", status: "open", emailStatus: "pending" } }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<DraftProPanel />);
    expect(await screen.findByText(/Refund eligibility: purchase_ineligible/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Purchase"), { target: { value: "purchase-old" } });
    expect(await screen.findByRole("button", { name: "Submit request" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Explanation/), { target: { value: "The draft board was unavailable." } });
    fireEvent.submit(screen.getByRole("button", { name: "Submit request" }).closest("form")!);
    expect(await screen.findByText(/submitted for case-by-case review/)).toBeTruthy();
    expect(fetchMock.mock.calls[1]?.[1]?.body).toContain("purchase-old");
  });

  it("reloads account state after Patreon refresh", async () => {
    const refreshed = { ...account, access: { ...account.access, grantingSources: ["patreon"], verifiedAt: "2026-09-07T00:00:00.000Z" } };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: account }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: refreshed }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<DraftProPanel />);
    fireEvent.click(await screen.findByRole("button", { name: "Refresh Patreon" }));
    expect(await screen.findByText("Granting access")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("confirms a returned checkout with bounded verification", async () => {
    routerQuery.draft_pro_checkout = "cs_test_123";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { ...account, access: { ...account.access, eligible: false } } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ state: "confirmed" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: account }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<DraftProPanel />);
    expect(await screen.findByText("Draft Pro access is confirmed.")).toBeTruthy();
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/v1/account/draft-pro/checkout/verify");
  });

  it("keeps a no-URL checkout in its confirming state", async () => {
    const inactiveAccount = { ...account, access: { ...account.access, eligible: false } };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: inactiveAccount }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ url: null, state: "confirming" }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<DraftProPanel />);
    fireEvent.click(await screen.findByRole("button", { name: /Get Draft Pro/ }));
    expect(await screen.findByText(/Checkout is still open or confirming/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Check purchase status again" })).toBeTruthy();
  });

  it("cancels a pending checkout retry when the panel unmounts", async () => {
    vi.useFakeTimers();
    routerQuery.draft_pro_checkout = "cs_test_456";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: account }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ state: "waiting" }) });
    vi.stubGlobal("fetch", fetchMock);
    const { unmount } = render(<DraftProPanel />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(screen.getByText("Checking payment status…")).toBeTruthy();
    unmount();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("cancels a pending checkout retry when its query is externally cleared", async () => {
    vi.useFakeTimers();
    routerQuery.draft_pro_checkout = "cs_test_external";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: account }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ state: "waiting" }) });
    vi.stubGlobal("fetch", fetchMock);
    const view = render(<DraftProPanel />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    delete routerQuery.draft_pro_checkout;
    view.rerender(<DraftProPanel />);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("keeps verification alive across initial and same-user auth events", async () => {
    routerQuery.draft_pro_checkout = "cs_test_identity";
    let resolveVerification: ((value: unknown) => void) | undefined;
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: account }) })
      .mockImplementationOnce(() => new Promise((resolve) => { resolveVerification = resolve; }))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: account }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<DraftProPanel />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const listener = onAuthStateChange.mock.calls[0]?.[0];
    expect(listener).toBeDefined();
    act(() => listener?.("INITIAL_SESSION", { access_token: "token", user: { id: "A" } }));
    act(() => listener?.("TOKEN_REFRESHED", { access_token: "token-2", user: { id: "A" } }));
    await act(async () => { resolveVerification?.({ ok: true, json: async () => ({ state: "confirmed" }) }); });
    expect(await screen.findByText("Draft Pro access is confirmed.")).toBeTruthy();
  });

  it("offers manual retry after a transient checkout verification failure", async () => {
    routerQuery.draft_pro_checkout = "cs_test_retry";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { ...account, access: { ...account.access, eligible: false } } }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: "Temporary Stripe delay" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ state: "confirmed" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: account }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<DraftProPanel />);
    expect(await screen.findByRole("button", { name: "Check purchase status again" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Check purchase status again" }));
    expect(await screen.findByText("Draft Pro access is confirmed.")).toBeTruthy();
  });

  it("invalidates stale account responses after an auth change", async () => {
    let resolveAccount: ((value: unknown) => void) | undefined;
    vi.stubGlobal("fetch", vi.fn(() => new Promise((resolve) => { resolveAccount = resolve; })));
    render(<DraftProPanel />);
    await waitFor(() => expect(onAuthStateChange).toHaveBeenCalled());
    const listener = onAuthStateChange.mock.calls[0]?.[0];
    expect(listener).toBeDefined();
    act(() => listener?.("SIGNED_OUT", null));
    await act(async () => { resolveAccount?.({ ok: true, json: async () => ({ data: account }) }); });
    expect(screen.getByRole("alert").textContent).toContain("Authentication required");
    expect(screen.queryByText("Opening night")).toBeNull();
  });

  it("keeps a new account visible when an older account load resolves late", async () => {
    let resolveOld: ((value: unknown) => void) | undefined;
    const accountB = { ...account, savedDrafts: [{ id: "draft-b", name: "B draft", status: "active", updatedAt: "2026-09-06T00:00:00.000Z" }] };
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: accountB }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<DraftProPanel />);
    await waitFor(() => expect(onAuthStateChange).toHaveBeenCalled());
    getSession.mockResolvedValue({ data: { session: { access_token: "token-b", user: { id: "B" } } } });
    const listener = onAuthStateChange.mock.calls[0]?.[0];
    expect(listener).toBeDefined();
    act(() => listener?.("SIGNED_IN", { access_token: "token-b", user: { id: "B" } }));
    expect(await screen.findByText("B draft")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Refresh Patreon" }).hasAttribute("disabled")).toBe(false);
    expect(screen.queryByText(/Temporary|Account unavailable|could not be submitted/i)).toBeNull();
    await act(async () => { resolveOld?.({ ok: true, json: async () => ({ data: account }) }); });
    expect(screen.getByText("B draft")).toBeTruthy();
    expect(screen.queryByText("Opening night")).toBeNull();
  });

  it("redeems an access code, refreshes access, and shows complimentary expiry", async () => {
    const inactive = { ...account, access: { ...account.access, eligible: false, grantingSources: [], expiresAt: null }, purchases: [] };
    const complimentary = { ...inactive, access: { ...inactive.access, eligible: true, grantingSources: ["complimentary"], expiresAt: "2027-01-01T05:00:00.000Z" } };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: inactive }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ redeemed: true }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: complimentary }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<DraftProPanel />);
    const input = await screen.findByLabelText("Draft Pro access code");
    fireEvent.change(input, { target: { value: "COMP-TEST-2026-VALID" } });
    fireEvent.submit(input.closest("form")!);
    expect(await screen.findByText(/Complimentary Draft Pro access is now active/)).toBeTruthy();
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/v1/account/draft-pro/access-codes/redeem");
    expect(fetchMock.mock.calls[1]?.[1]?.body).toBe(JSON.stringify({ code: "COMP-TEST-2026-VALID" }));
    expect(await screen.findByText(/Access from complimentary\./)).toBeTruthy();
    expect(screen.getByText(/December 31, 2026/)).toBeTruthy();
  });

  it("retries account refresh without repeating the redemption request", async () => {
    const inactive = { ...account, access: { ...account.access, eligible: false, grantingSources: [], expiresAt: null }, purchases: [] };
    const complimentary = { ...inactive, access: { ...inactive.access, eligible: true, grantingSources: ["complimentary"], expiresAt: "2027-01-01T05:00:00.000Z" } };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: inactive }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ redeemed: true }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: inactive }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: complimentary }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<DraftProPanel />);
    const input = await screen.findByLabelText("Draft Pro access code");
    fireEvent.change(input, { target: { value: "COMP-RETRY-2026-VALID" } });
    fireEvent.submit(input.closest("form")!);
    expect(await screen.findByText(/Access from complimentary\./)).toBeTruthy();
    expect(fetchMock.mock.calls.filter(([url]) => url === "/api/v1/account/draft-pro/access-codes/redeem")).toHaveLength(1);
  });

  it("keeps a persistent grant confirmation honest after bounded refresh retries", async () => {
    const inactive = { ...account, access: { ...account.access, eligible: false, grantingSources: [], expiresAt: null }, purchases: [] };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: inactive }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ redeemed: true }) })
      .mockResolvedValue({ ok: true, json: async () => ({ data: inactive }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<DraftProPanel />);
    const input = await screen.findByLabelText("Draft Pro access code");
    fireEvent.change(input, { target: { value: "COMP-PENDING-2026-VALID" } });
    fireEvent.submit(input.closest("form")!);
    expect(await screen.findByText(/Access is still being confirmed/, {}, { timeout: 3_000 })).toBeTruthy();
    expect(fetchMock.mock.calls.filter(([url]) => url === "/api/v1/account/draft-pro/access-codes/redeem")).toHaveLength(1);
  });

  it("suppresses a delayed refresh after the account changes", async () => {
    const inactive = { ...account, access: { ...account.access, eligible: false, grantingSources: [], expiresAt: null }, purchases: [] };
    const accountB = { ...inactive, savedDrafts: [{ id: "draft-b", name: "B draft", status: "active", updatedAt: "2026-09-06T00:00:00.000Z" }] };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: inactive }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ redeemed: true }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: inactive }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: accountB }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<DraftProPanel />);
    const input = await screen.findByLabelText("Draft Pro access code");
    fireEvent.change(input, { target: { value: "COMP-SWITCH-2026-VALID" } });
    fireEvent.submit(input.closest("form")!);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    getSession.mockResolvedValue({ data: { session: { access_token: "token-b", user: { id: "B" } } } });
    const listener = onAuthStateChange.mock.calls[0]?.[0];
    act(() => listener?.("SIGNED_IN", { access_token: "token-b", user: { id: "B" } }));
    expect(await screen.findByText("B draft")).toBeTruthy();
    await new Promise((resolve) => setTimeout(resolve, 350));
    expect(screen.queryByText(/Access code redeemed/)).toBeNull();
    expect(fetchMock.mock.calls.filter(([url]) => url === "/api/v1/account/draft-pro/access-codes/redeem")).toHaveLength(1);
  });

  it.each([400, 429])("shows an access-code error without persisting the code for HTTP %s", async (status) => {
    const inactive = { ...account, access: { ...account.access, eligible: false, grantingSources: [], expiresAt: null }, purchases: [] };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: inactive }) })
      .mockResolvedValueOnce({ ok: false, status, json: async () => ({ error: "Code could not be redeemed." }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<DraftProPanel />);
    const input = await screen.findByLabelText("Draft Pro access code");
    fireEvent.change(input, { target: { value: "BAD-CODE-2026-VALIDX" } });
    fireEvent.submit(input.closest("form")!);
    expect((await screen.findByRole("alert")).textContent).toContain("Code could not be redeemed.");
    expect((screen.getByLabelText("Draft Pro access code") as HTMLInputElement).value).toBe("BAD-CODE-2026-VALIDX");
  });

  it("recovers when the post-redemption account refresh fails", async () => {
    const inactive = { ...account, access: { ...account.access, eligible: false, grantingSources: [], expiresAt: null }, purchases: [] };
    const complimentary = { ...inactive, access: { ...inactive.access, eligible: true, grantingSources: ["complimentary"], expiresAt: "2027-01-01T05:00:00.000Z" } };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: inactive }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ redeemed: true }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: { message: "Account refresh failed." } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: complimentary }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<DraftProPanel />);
    const input = await screen.findByLabelText("Draft Pro access code");
    fireEvent.change(input, { target: { value: "COMP-RETRY-2026-VALID" } });
    fireEvent.submit(input.closest("form")!);
    expect(await screen.findByText(/Access from complimentary\./, {}, { timeout: 3_000 })).toBeTruthy();
    expect(fetchMock.mock.calls.filter(([url]) => url === "/api/v1/account/draft-pro/access-codes/redeem")).toHaveLength(1);
  });

  it("suppresses a late redemption after the account changes", async () => {
    const inactive = { ...account, access: { ...account.access, eligible: false, grantingSources: [], expiresAt: null }, purchases: [] };
    const accountB = { ...inactive, savedDrafts: [{ id: "draft-b", name: "B draft", status: "active", updatedAt: "2026-09-06T00:00:00.000Z" }] };
    let resolveRedeem: ((value: unknown) => void) | undefined;
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: inactive }) })
      .mockImplementationOnce(() => new Promise((resolve) => { resolveRedeem = resolve; }))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: accountB }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<DraftProPanel />);
    const input = await screen.findByLabelText("Draft Pro access code");
    fireEvent.change(input, { target: { value: "COMP-LATE-2026-VALID" } });
    fireEvent.submit(input.closest("form")!);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    getSession.mockResolvedValue({ data: { session: { access_token: "token-b", user: { id: "B" } } } });
    const listener = onAuthStateChange.mock.calls[0]?.[0];
    act(() => listener?.("SIGNED_IN", { access_token: "token-b", user: { id: "B" } }));
    expect(await screen.findByText("B draft")).toBeTruthy();
    await act(async () => { resolveRedeem?.({ ok: true, json: async () => ({ redeemed: true }) }); });
    expect(screen.queryByText(/Access code redeemed/)).toBeNull();
  });
});
