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
const lineup = { date: "2026-10-21", teamName: "Private team", teams: [], limitations: ["Saved evidence"],
  roster: [{ id: "p1", name: "Private Center", valueBasis: "game" }],
  lineup: { status: "complete", assignments: [{ id: "C#1", position: "C", playerId: "p1", value: 4.5, preserved: true }] } };
const loaded = () => ({ ok: true, status: 200, json: async () => ({ data: lineup }) });
async function loadThenRefresh(failure: () => Promise<unknown>) {
  const fetchMock = vi.fn().mockResolvedValueOnce(loaded()).mockImplementation(failure);
  vi.stubGlobal("fetch", fetchMock);
  const view = render(<StarterBoardYahoo />);
  const refresh = () => fireEvent.click(screen.getByRole("button", { name: "Refresh today’s comparison", hidden: true }));
  refresh();
  expect(await screen.findByText(/C: Private Center/)).toBeTruthy();
  refresh();
  return { fetchMock, view, alert: await screen.findByRole("alert", { hidden: true }) };
}
it.each([
  { status: 403, error: "Access could not be verified" },
  { status: 403, error: "Draft Pro access is required." },
  { status: 401, error: "Yahoo connection expired. Reconnect Yahoo." },
])("hides the private lineup when a refresh is denied with $status ($error)", async ({ status, error }) => {
  const { alert } = await loadThenRefresh(async () => ({ ok: false, status, json: async () => ({ error }) }));
  expect(alert.textContent).toContain(error);
  expect(screen.queryByText(/Private Center/)).toBeNull();
  expect(screen.queryByText(/Private team/)).toBeNull();
  expect(screen.queryByText("Saved evidence")).toBeNull();
});
it.each([
  { name: "a 500 provider error", failure: async () => ({ ok: false, status: 500, json: async () => ({ error: "Yahoo is temporarily unavailable." }) }), error: "Yahoo is temporarily unavailable." },
  { name: "a network failure", failure: async () => { throw new TypeError("Failed to fetch"); }, error: "Failed to fetch" },
])("keeps the last comparison with the error after $name", async ({ failure, error }) => {
  const { alert } = await loadThenRefresh(failure);
  expect(alert.textContent).toContain(error);
  expect(screen.getByText(/C: Private Center/)).toBeTruthy();
  expect(screen.getByText("Saved evidence")).toBeTruthy();
});
it("keeps the comparison read-only when entitlement lapses without a refresh", async () => {
  const fetchMock = vi.fn().mockResolvedValue(loaded());
  vi.stubGlobal("fetch", fetchMock);
  const { rerender } = render(<StarterBoardYahoo />);
  fireEvent.click(screen.getByRole("button", { name: "Refresh today’s comparison", hidden: true }));
  await screen.findByText("Saved evidence");
  state.eligible = false; rerender(<StarterBoardYahoo />);
  expect(screen.getByText("Saved evidence")).toBeTruthy();
  expect(screen.getByText(/C: Private Center/)).toBeTruthy();
  const button = screen.getByRole("button", { name: "Refresh today’s comparison", hidden: true }) as HTMLButtonElement;
  expect(button.disabled).toBe(true); fireEvent.click(button);
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
});
