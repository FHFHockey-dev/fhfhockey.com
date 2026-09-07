import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import DraftProPanel from "./DraftProPanel";

const getSession = vi.hoisted(() => vi.fn());
const routerQuery = vi.hoisted(() => ({} as Record<string, string>));
vi.mock("lib/supabase/client", () => ({ default: { auth: { getSession } } }));
vi.mock("next/router", () => ({ useRouter: () => ({ query: routerQuery }) }));

const account = {
  access: { eligible: true, grantingSources: ["purchase"], expiresAt: "2027-07-01T04:00:00.000Z", verifiedAt: null, reason: "eligible", providerReadiness: { patreon: false } },
  purchases: [{ id: "purchase-1", season: "draft_pro_2026_27", status: "active", activatedAt: "2026-09-05T00:00:00.000Z", expiresAt: "2027-07-01T04:00:00.000Z", amountCents: 599, currency: "usd", receiptUrl: null, refundEligibility: { eligible: true, deadline: "2026-09-12T00:00:00.000Z", reason: "eligible" } }],
  refundRequests: [],
  savedDrafts: [{ id: "draft-1", name: "Opening night", status: "active", updatedAt: "2026-09-06T00:00:00.000Z" }],
  privateImports: [],
};

describe("DraftProPanel", () => {
  beforeEach(() => getSession.mockResolvedValue({ data: { session: { access_token: "token" } } }));
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); vi.restoreAllMocks(); delete routerQuery.draft_pro_checkout; });

  it("shows loading and then the server-computed refund form", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: account }) }));
    render(<DraftProPanel />);
    expect(screen.getByText("Loading account access…")).toBeTruthy();
    expect(await screen.findByRole("button", { name: "Submit request" })).toBeTruthy();
    expect(screen.getByText(/June 30, 2027.*Eastern/)).toBeTruthy();
    expect(screen.getByText("Opening night")).toBeTruthy();
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
});
