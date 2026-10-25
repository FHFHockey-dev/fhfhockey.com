import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import StarterBoardYahoo from "./StarterBoardYahoo";
const state = vi.hoisted(() => ({ user: { id: "owner" } as { id: string } | null, status: "ready", eligible: true }));
vi.mock("contexts/AuthProviderContext", () => ({ useAuth: () => ({ user: state.user }) }));
vi.mock("hooks/useProviderSyncAccess", () => ({ useProviderSyncAccess: () => ({ status: state.status, access: { eligible: state.eligible }, refresh: vi.fn() }) }));
vi.mock("lib/supabase/client", () => ({ default: { auth: { getSession: async () => ({ data: { session: { access_token: "fixture" } } }) } } }));
beforeEach(() => { state.user = { id: "owner" }; state.status = "ready"; state.eligible = true; });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it.each(["ready", "loading", "error"])("keeps optional sync closed for %s unpaid or unknown access", async (status) => {
  state.eligible = false; state.status = status;
  const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
  render(<StarterBoardYahoo />);
  const button = screen.getByRole("button", { name: "Refresh today’s comparison", hidden: true }) as HTMLButtonElement;
  expect(button.disabled).toBe(true); fireEvent.click(button); expect(fetchMock).not.toHaveBeenCalled();
});
it("shows sign-in without a provider request for anonymous visitors", () => {
  state.user = null; const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
  render(<StarterBoardYahoo />); expect(screen.getByText(/Sign in to check premium sync access/)).toBeTruthy(); expect(fetchMock).not.toHaveBeenCalled();
});
it("retains the comparison on a failed refresh and when entitlement is lost", async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ data: { date: "2026-10-21", teamName: "Saved team", teams: [], roster: [], limitations: ["Saved evidence"] } }) })
    .mockResolvedValue({ ok: false, json: async () => ({ error: "Access could not be verified" }) });
  vi.stubGlobal("fetch", fetchMock);
  const { rerender } = render(<StarterBoardYahoo />);
  fireEvent.click(screen.getByRole("button", { name: "Refresh today’s comparison", hidden: true }));
  await screen.findByText("Saved evidence");
  fireEvent.click(screen.getByRole("button", { name: "Refresh today’s comparison", hidden: true }));
  await screen.findByText(/Access could not be verified/);
  expect(screen.getByText("Saved evidence")).toBeTruthy();
  state.eligible = false; rerender(<StarterBoardYahoo />);
  expect(screen.getByText("Saved evidence")).toBeTruthy();
  expect((screen.getByRole("button", { name: "Refresh today’s comparison", hidden: true }) as HTMLButtonElement).disabled).toBe(true);
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
});
