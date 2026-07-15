import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PatreonConnectionPanel from "./PatreonConnectionPanel";

const router = vi.hoisted(() => ({ query: {} as Record<string, string> }));
const getSession = vi.hoisted(() => vi.fn());

vi.mock("next/router", () => ({ useRouter: () => router }));
vi.mock("lib/supabase/client", () => ({
  default: { auth: { getSession } },
}));

const connectedState = {
  configured: true,
  account: {
    id: "account-1",
    status: "connected",
    last_synced_at: "2026-07-14T15:00:00Z",
    metadata: { patron_status: "active_patron" },
  },
  entitlement: {
    entitlement_status: "active",
    metadata: { tiers: [{ id: "tier-5", title: "Power Play" }] },
  },
  latestRun: { status: "completed", cooldown_until: null },
};

describe("PatreonConnectionPanel", () => {
  beforeEach(() => {
    router.query = {};
    getSession.mockResolvedValue({
      data: { session: { access_token: "access-token" } },
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("shows the safe unconfigured state without exposing a live action", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          configured: false,
          account: null,
          entitlement: null,
          latestRun: null,
        }),
      }),
    );

    render(<PatreonConnectionPanel />);
    expect(
      await screen.findByText(/Patreon OAuth is not configured/),
    ).toBeTruthy();
    expect(
      (
        screen.getByRole("button", {
          name: "Connect Patreon",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("renders generic eligibility and refreshes membership in place", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => connectedState })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ entitlementStatus: "active" }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => connectedState });
    vi.stubGlobal("fetch", fetchMock);

    render(<PatreonConnectionPanel />);
    expect(
      await screen.findByText(/Generic supporter eligibility: active/),
    ).toBeTruthy();
    expect(screen.getByText(/Entitled tier: Power Play/)).toBeTruthy();
    expect(
      screen.getByText(/no concrete paid feature is granted/i),
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "Refresh Patreon Membership" }),
    );
    expect(
      await screen.findByText(/generic supporter eligibility is active/i),
    ).toBeTruthy();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(fetchMock.mock.calls[1]).toEqual([
      "/api/v1/account/patreon/refresh",
      {
        method: "POST",
        headers: { Authorization: "Bearer access-token" },
      },
    ]);
  });

  it("confirms disconnect before removing local provider state", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => connectedState })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: "Patreon disconnected." }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          configured: true,
          account: null,
          entitlement: null,
          latestRun: null,
        }),
      });
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<PatreonConnectionPanel />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Disconnect Patreon" }),
    );
    expect(await screen.findByText("Patreon disconnected.")).toBeTruthy();
    expect(fetchMock.mock.calls[1][0]).toBe(
      "/api/v1/account/patreon/disconnect",
    );
    expect(fetchMock.mock.calls[1][1]).toEqual({
      method: "POST",
      headers: { Authorization: "Bearer access-token" },
    });
  });

  it("shows a session-expired error without calling the API", async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<PatreonConnectionPanel />);

    expect(await screen.findByText(/session expired/i)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
