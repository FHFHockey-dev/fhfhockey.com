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

  it("shows a copyable account-bound purchase recovery code", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: account }) }));
    render(<DraftProPanel />);
    const code = await screen.findByLabelText("Recovery code for purchase purchase-1");
    expect((code as HTMLInputElement).value).toBe("DPRO-purchase-1");
    fireEvent.click(screen.getByRole("button", { name: "Copy recovery code" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("DPRO-purchase-1"));
  });

  it("recovers a purchased pass without requiring a complimentary grant", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { ...account, access: { ...account.access, eligible: false } } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ state: "confirmed" }) })
      .mockResolvedValue({ ok: true, json: async () => ({ data: account }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<DraftProPanel />);
    fireEvent.change(await screen.findByLabelText("Draft Pro access code"), { target: { value: "DPRO-11111111-1111-4111-8111-111111111111" } });
    fireEvent.submit(screen.getByRole("button", { name: "Redeem code" }).closest("form")!);
    expect(await screen.findByText("Purchase recovered. Draft Pro access is now active.")).toBeTruthy();
    expect(fetchMock.mock.calls[1][0]).toBe("/api/v1/account/draft-pro/checkout/verify");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ recoveryCode: "DPRO-11111111-1111-4111-8111-111111111111" });
  });

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
    expect((await screen.findByRole("alert")).textContent).toBe("Draft ProDraft Pro account details are unavailable. Refresh the page to try again, or contact support if it keeps happening.");
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

  it("never offers new checkout even from a stale available response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { ...account, access: { ...account.access, eligible: false } } }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<DraftProPanel />);
    expect(await screen.findByText(/New Draft Pro purchases are closed/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Get Draft Pro|Buy/ })).toBeNull();
    expect(screen.getByLabelText("Draft Pro access code")).toBeTruthy();
    expect(screen.getByText("Opening night")).toBeTruthy();
    expect(fetchMock.mock.calls.some(([url]) => url === "/api/v1/account/draft-pro/checkout")).toBe(false);
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

  it.each([[400, "That code couldn't be redeemed. Check it and try again, or contact support if you completed payment."], [429, "Too many attempts. Wait a minute, then try your code again."]])("shows an access-code error without persisting the code for HTTP %s", async (status, expected) => {
    const inactive = { ...account, access: { ...account.access, eligible: false, grantingSources: [], expiresAt: null }, purchases: [] };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: inactive }) })
      .mockResolvedValueOnce({ ok: false, status, json: async () => ({ error: "Code could not be redeemed." }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<DraftProPanel />);
    const input = await screen.findByLabelText("Draft Pro access code");
    fireEvent.change(input, { target: { value: "BAD-CODE-2026-VALIDX" } });
    fireEvent.submit(input.closest("form")!);
    expect((await screen.findByRole("alert")).textContent).toBe(expected);
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

describe("DraftProPanel refund request failures", () => {
  beforeEach(() => { getSession.mockResolvedValue({ data: { session: { access_token: "token", user: { id: "A" } } } }); });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
  const reply = (status: number, body: unknown) => ({ ok: false, status, json: async () => body });
  const copy = {
    connection: "We couldn't reach FHFH, so your refund request wasn't confirmed. Check your connection and try again, or contact support.",
    unavailable: "Your refund request couldn't be confirmed right now. Try again in a few minutes, or contact support if it keeps happening.",
    signIn: "Your sign-in has expired. Sign in again, then submit your refund request.",
    invalid: "Check your refund request: choose a purchase and reason, and write an explanation of 10 to 2,000 characters.",
    notEligible: "This purchase isn't eligible for an account refund request. Contact support if you think this is wrong.",
    windowClosed: "The 7-day refund request window for this purchase has closed. Contact support if you need help.",
    exists: "This purchase already has an open refund request. We'll review it case by case.",
  };
  it.each([
    ["network failure", () => Promise.reject(new TypeError("Failed to fetch")), copy.connection, /Failed to fetch/],
    ["timeout", () => Promise.reject(new DOMException("The operation was aborted due to timeout", "TimeoutError")), copy.connection, /aborted|timeout/i],
    ["outage with an HTML body", () => Promise.resolve({ ok: false, status: 503, json: () => Promise.reject(new SyntaxError("Unexpected token '<', \"<html><h1>502 Bad Gateway</h1>\" is not valid JSON")) }), copy.unavailable, /Unexpected token|Bad Gateway|JSON/],
    ["configuration error on a 422 with its own code", () => Promise.resolve(reply(422, { error: { code: "configuration_error", message: "RESEND_API_KEY is not configured." } })), copy.unavailable, /RESEND_API_KEY|configured|window for this purchase has closed/],
    ["422 without any code", () => Promise.resolve(reply(422, { error: "Unprocessable" })), copy.unavailable, /Unprocessable|window for this purchase has closed/],
    ["closed refund window", () => Promise.resolve(reply(422, { error: { code: "refund_window_closed", message: "Window closed at 2026-09-12T00:00:00Z for row r_77" } })), copy.windowClosed, /r_77|2026-09-12T/],
    ["unrelated 404 from a proxy", () => Promise.resolve({ ok: false, status: 404, json: () => Promise.reject(new SyntaxError("Unexpected token '<', \"<html>404 Not Found\" is not valid JSON")) }), copy.unavailable, /Not Found|isn't eligible|Unexpected token/],
    ["404 with a different code", () => Promise.resolve(reply(404, { error: { code: "route_not_found", message: "No route /api/v1/account/draft-pro/refund-requests" } })), copy.unavailable, /route_not_found|No route|isn't eligible/],
    ["409 with a different code", () => Promise.resolve(reply(409, { error: { code: "write_conflict", message: "could not serialize access due to concurrent update" } })), copy.unavailable, /serialize|open refund request/],
    ["400 without the validation code", () => Promise.resolve(reply(400, { error: { code: "bad_request", message: "Body exceeded 1mb limit" } })), copy.unavailable, /1mb|Check your refund request/],
    ["server error with private details", () => Promise.resolve(reply(500, { error: { code: "refund_request_failed", message: "duplicate key value violates unique constraint \"draft_pro_refund_requests_pkey\" for tim@example.com" } })), copy.unavailable, /duplicate key|tim@example\.com|constraint/],
    ["missing purchase with internal identifiers", () => Promise.resolve(reply(404, { error: { code: "purchase_not_found", message: "Purchase 9f1c for user 7d2a not found in draft_pro_purchases" } })), copy.notEligible, /9f1c|7d2a|draft_pro_purchases/],
    ["expired authentication", () => Promise.resolve(reply(401, { error: { code: "authentication_required", message: "invalid JWT: unable to parse or verify signature, token is expired" } })), copy.signIn, /JWT|signature/],
    ["validation failure", () => Promise.resolve(reply(400, { error: { code: "validation_error", message: "Expected string, received number at path explanation" } })), copy.invalid, /Expected string|path/],
    ["existing open request", () => Promise.resolve(reply(409, { error: { code: "refund_request_exists", message: "Conflict on refund row r_8812" } })), copy.exists, /r_8812|Conflict/],
    ["unreadable success body", () => Promise.resolve({ ok: true, status: 201, json: () => Promise.reject(new SyntaxError("Unexpected end of JSON input")) }), copy.unavailable, /Unexpected end|JSON/],
  ])("shows plain language for a %s and keeps retry and support available", async (_, refundReply, expected, privateText) => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ data: account }) }).mockImplementationOnce(refundReply);
    vi.stubGlobal("fetch", fetchMock);
    render(<DraftProPanel />);
    fireEvent.change(await screen.findByLabelText(/Explanation/), { target: { value: "The draft board was unavailable." } });
    fireEvent.submit(screen.getByRole("button", { name: "Submit request" }).closest("form")!);
    expect(await screen.findByText(expected)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(privateText);
    expect(screen.queryByText(/submitted for case-by-case review/)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("button", { name: "Submit request" }).hasAttribute("disabled")).toBe(false);
    expect((screen.getByLabelText(/Explanation/) as HTMLTextAreaElement).value).toBe("The draft board was unavailable.");
    expect(screen.getByRole("link", { name: "Support" }).getAttribute("href")).toBe("mailto:tim@fhfhockey.com");
  });
  it("asks the user to sign in again when the session is gone at submit time", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ data: account }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<DraftProPanel />);
    fireEvent.change(await screen.findByLabelText(/Explanation/), { target: { value: "The draft board was unavailable." } });
    getSession.mockResolvedValue({ data: { session: null } });
    fireEvent.submit(screen.getByRole("button", { name: "Submit request" }).closest("form")!);
    expect(await screen.findByText(copy.signIn)).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("lets the user retry manually after a failure and then confirms the request", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ data: account }) })
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({ data: { id: "refund-1", status: "open", emailStatus: "pending" } }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<DraftProPanel />);
    fireEvent.change(await screen.findByLabelText(/Explanation/), { target: { value: "The draft board was unavailable." } });
    fireEvent.submit(screen.getByRole("button", { name: "Submit request" }).closest("form")!);
    await screen.findByText(copy.connection);
    fireEvent.submit(screen.getByRole("button", { name: "Submit request" }).closest("form")!);
    expect(await screen.findByText(/submitted for case-by-case review/)).toBeTruthy();
    expect(screen.queryByText(copy.connection)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

describe("DraftProPanel refund window tense", () => {
  beforeEach(() => { getSession.mockResolvedValue({ data: { session: { access_token: "token", user: { id: "A" } } } }); });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
  it.each([
    ["an open request before the deadline", 36, true, "ends"],
    ["an expired window", -36, false, "ended"],
  ])("uses the right tense for %s", async (_, hoursFromNow, eligible, tense) => {
    const deadline = new Date(Date.now() + hoursFromNow * 3_600_000).toISOString();
    const purchase = { ...account.purchases[0], refundEligibility: { eligible, deadline, reason: eligible ? "eligible" : "window_closed" } };
    const requests = eligible ? [{ id: "refund-1", purchaseId: purchase.id, reason: "other", status: "open", submittedAt: new Date().toISOString(), emailStatus: "sent" }] : [];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { ...account, purchases: [purchase], refundRequests: requests } }) }));
    render(<DraftProPanel />);
    const notice = await screen.findByText(/The request window (ends|ended)/);
    expect(notice.textContent).toContain(`The request window ${tense} `);
    expect(notice.textContent).not.toContain(tense === "ends" ? "window ended" : "window ends");
  });
});

describe("DraftProPanel private-safe account messages", () => {
  beforeEach(() => { getSession.mockResolvedValue({ data: { session: { access_token: "token", user: { id: "A" } } } }); });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); delete routerQuery.draft_pro_checkout; });
  const inactive = { ...account, access: { ...account.access, eligible: false, grantingSources: [], expiresAt: null }, purchases: [] };
  const accountUnavailable = "Draft Pro account details are unavailable. Refresh the page to try again, or contact support if it keeps happening.";
  const failures = {
    network: () => Promise.reject(new TypeError("Failed to fetch")),
    html: () => Promise.resolve({ ok: false, status: 502, json: () => Promise.reject(new SyntaxError("Unexpected token '<', \"<html>502 Bad Gateway\" is not valid JSON")) }),
    privateServer: () => Promise.resolve({ ok: false, status: 500, json: async () => ({ error: { code: "account_unavailable", message: "relation \"draft_pro_purchases\" does not exist; user tim@example.com" }, hint: "SUPABASE_SERVICE_ROLE_KEY missing" }) }),
  };
  const privateText = /Failed to fetch|Unexpected token|Bad Gateway|draft_pro_purchases|tim@example\.com|SUPABASE|does not exist/;

  it.each(Object.entries(failures))("shows fixed copy when the account load fails with %s", async (_, failure) => {
    vi.stubGlobal("fetch", vi.fn().mockImplementationOnce(failure));
    render(<DraftProPanel />);
    expect((await screen.findByRole("alert")).textContent).toContain(accountUnavailable);
    expect(document.body.textContent).not.toMatch(privateText);
  });
  it("asks for sign-in when the account load is unauthorized", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ error: { code: "authentication_required", message: "invalid JWT: token is expired" } }) }));
    render(<DraftProPanel />);
    expect((await screen.findByRole("alert")).textContent).toContain("Your sign-in has expired. Sign in again to view Draft Pro.");
    expect(document.body.textContent).not.toMatch(/JWT/);
  });

  it.each([
    ["network failure", "COMP-RETRY-2026-VALID", failures.network, "We couldn't reach FHFH, so your code wasn't confirmed. Check your connection and try again."],
    ["private server error", "COMP-RETRY-2026-VALID", failures.privateServer, "That code couldn't be redeemed. Check it and try again, or contact support if you completed payment."],
    ["recovery code owned elsewhere", "DPRO-11111111-1111-4111-8111-111111111111", () => Promise.resolve({ ok: false, status: 403, json: async () => ({ error: "This Checkout session cs_live_a1b2 belongs to user 7d2a" }) }), "That code couldn't be redeemed. Check it and try again, or contact support if you completed payment."],
    ["expired sign-in", "COMP-RETRY-2026-VALID", () => Promise.resolve({ ok: false, status: 401, json: async () => ({ error: "Invalid or expired session." }) }), "Your sign-in has expired. Sign in again, then redeem your code."],
  ])("shows fixed copy when code redemption fails with a %s and keeps the code for retry", async (_, code, failure, expected) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ data: inactive }) }).mockImplementationOnce(failure));
    render(<DraftProPanel />);
    const input = await screen.findByLabelText("Draft Pro access code");
    fireEvent.change(input, { target: { value: code } });
    fireEvent.submit(input.closest("form")!);
    expect((await screen.findByRole("alert")).textContent).toBe(expected);
    expect(document.body.textContent).not.toMatch(/cs_live|7d2a|Invalid or expired session/);
    expect(document.body.textContent).not.toMatch(privateText);
    expect((screen.getByLabelText("Draft Pro access code") as HTMLInputElement).value).toBe(code);
    expect(screen.getByRole("button", { name: "Redeem code" }).hasAttribute("disabled")).toBe(false);
  });
  it("says the code was accepted when every post-redemption refresh fails", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ data: inactive }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ redeemed: true }) })
      .mockImplementation(failures.privateServer);
    vi.stubGlobal("fetch", fetchMock);
    render(<DraftProPanel />);
    const input = await screen.findByLabelText("Draft Pro access code");
    fireEvent.change(input, { target: { value: "COMP-RETRY-2026-VALID" } });
    fireEvent.submit(input.closest("form")!);
    expect((await screen.findByRole("alert", {}, { timeout: 4_000 })).textContent).toBe("Your code was accepted, but your access couldn't be refreshed. Refresh this page to check again.");
    expect(document.body.textContent).not.toMatch(privateText);
    expect(fetchMock.mock.calls.filter(([url]) => url === "/api/v1/account/draft-pro/access-codes/redeem")).toHaveLength(1);
  });

  it.each([
    ["configuration error", () => Promise.resolve({ ok: false, status: 503, json: async () => ({ error: "Stripe checkout is not configured. STRIPE_SECRET_KEY unset" }) }), "Your purchase status couldn't be checked. Check purchase status again, or contact support if you completed payment."],
    ["network failure", failures.network, "Your purchase status couldn't be checked. Check purchase status again, or contact support if you completed payment."],
    ["rate limit", () => Promise.resolve({ ok: false, status: 429, json: async () => ({ error: "Please wait a minute before checking again." }) }), "Please wait a minute before checking again."],
  ])("shows fixed copy when checkout verification fails with a %s and keeps the manual retry", async (_, failure, expected) => {
    routerQuery.draft_pro_checkout = "cs_test_private";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ data: inactive }) }).mockImplementationOnce(failure));
    render(<DraftProPanel />);
    expect(await screen.findByRole("button", { name: "Check purchase status again" })).toBeTruthy();
    expect(await screen.findByText(expected)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/STRIPE_SECRET_KEY|not configured|Failed to fetch/);
  });

  it.each([
    ["server error", failures.privateServer, "Patreon connection couldn't be started. Try again later, or contact support if it keeps happening."],
    ["network failure", failures.network, "Patreon connection couldn't be started. Try again later, or contact support if it keeps happening."],
    ["expired sign-in", () => Promise.resolve({ ok: false, status: 401, json: async () => ({ error: "Invalid or expired session." }) }), "Your sign-in has expired. Sign in again, then connect Patreon."],
  ])("shows fixed copy when Patreon connect fails with a %s", async (_, failure, expected) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ data: account }) }).mockImplementationOnce(failure));
    render(<DraftProPanel />);
    fireEvent.click(await screen.findByRole("button", { name: "Connect Patreon" }));
    expect(await screen.findByText(expected)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(privateText);
    expect(document.body.textContent).not.toMatch(/Invalid or expired session/);
    expect(screen.getByRole("button", { name: "Connect Patreon" }).hasAttribute("disabled")).toBe(false);
  });
});
