import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

// jsdom has no ResizeObserver; recharts' ResponsiveContainer needs one.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

vi.mock("next/head", () => ({ default: () => null }));
vi.mock("contexts/AuthProviderContext", () => ({
  useAuth: () => ({ isLoading: false, user: { id: "a1", role: "admin" } }),
  useUser: () => ({ id: "a1", role: "admin" })
}));
vi.mock("lib/supabase", () => ({
  default: { auth: { getSession: async () => ({ data: { session: { access_token: "admin-token" } } }) } }
}));

import { makeJob } from "lib/routeRunner/memoryStore.testHelper";
import RouteRunnerPage from "pages/db/runner";

const job = makeJob({
  status: "queued",
  steps: 1,
  rows_total: 38,
  progress: { unit: "urls", done: 40, total: 400, cursor: "cursor 40", rowsUnit: "sources", stalls: 0, rowsTotal: 38 }
});
const events = [
  { id: 1, job_id: job.id, at: "2026-10-22T10:00:00Z", level: "info", message: "Queued", step: null, status_code: null, rows: null, progress: null, duration_ms: null },
  { id: 2, job_id: job.id, at: "2026-10-22T10:04:00Z", level: "info", message: "NST continuation: cursor 40 of 400.", step: 1, status_code: 207, rows: 38, progress: { done: 40, total: 400, unit: "urls", rowsTotal: 38, rowsUnit: "sources", operationStatus: "continuation_required" }, duration_ms: 200_000 }
];
const fetchMock = vi.fn();

function reply(body: unknown, status = 200) {
  return Promise.resolve({ ok: status < 400, status, json: async () => body });
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer admin-token");
    if (url === "/api/v1/db/route-runner/jobs") {
      return reply({ success: true, jobs: [job], serverTime: new Date().toISOString() });
    }
    if (url.startsWith(`/api/v1/db/route-runner/jobs/${job.id}`)) {
      return reply({ success: true, job, events: url.endsWith("after=0") ? events : [], hasMore: false });
    }
    return reply({ success: false, error: "unexpected" }, 404);
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("/db/runner", () => {
  it("lists allowlisted routes and checks a pasted route before queueing", async () => {
    render(<RouteRunnerPage />);
    expect(screen.getByRole("list", { name: "Allowlisted routes" }).textContent).toContain("/api/v1/db/update-rolling-player-averages");
    fireEvent.change(screen.getByLabelText("Route URL or path"), { target: { value: "/api/v1/db/update-teams" } });
    fireEvent.click(screen.getByRole("button", { name: "Queue run" }));
    expect((await screen.findByRole("alert")).textContent).toContain("not on the route runner allowlist");
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  });

  it("shows a job's progress and terminal", async () => {
    render(<RouteRunnerPage />);
    fireEvent.click(await screen.findByRole("button", { name: /NST skater gamelogs/ }));
    await waitFor(() => expect(screen.getByRole("log").textContent).toContain("step 1  HTTP 207  continuation_required"));
    expect(screen.getByText(/40 \/ 400 urls \(10\.0%\)/)).toBeTruthy();
    expect(screen.getByText("Next step on the next tick (within about a minute).")).toBeTruthy();
  });
});
