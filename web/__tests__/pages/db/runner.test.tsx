import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

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
    if (url === "/api/v1/db/route-runner/jobs" && init?.method === "POST") {
      return reply({ success: true, job });
    }
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
  it("offers every allowlisted route and checks a pasted route before queueing", async () => {
    render(<RouteRunnerPage />);
    expect(screen.getByRole("group", { name: "Route" }).textContent).toContain("Rolling player averages");
    fireEvent.change(screen.getByLabelText("Route URL or path"), { target: { value: "/api/v1/db/update-teams" } });
    expect((await screen.findByRole("alert")).textContent).toContain("not on the route runner allowlist");
    expect((screen.getByRole("button", { name: "Queue run" }) as HTMLButtonElement).disabled).toBe(true);
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  });

  it("builds a URL from the route options and queues it", async () => {
    render(<RouteRunnerPage />);
    const url = screen.getByLabelText("Route URL or path") as HTMLInputElement;
    fireEvent.click(within(screen.getByRole("group", { name: "Route" })).getByRole("button", { name: /NST skater gamelogs/ }));
    expect(url.value).toBe("/api/v1/db/update-nst-gamelog");
    fireEvent.click(within(screen.getByRole("group", { name: "Run mode" })).getByRole("button", { name: "incremental" }));
    fireEvent.change(screen.getByLabelText(/Start date/), { target: { value: "2026-10-07" } });
    fireEvent.change(screen.getByLabelText(/End date/), { target: { value: "2026-10-18" } });
    fireEvent.click(within(screen.getByRole("group", { name: "Overwrite" })).getByRole("button", { name: "yes" }));
    expect(url.value).toBe(
      "/api/v1/db/update-nst-gamelog?runMode=incremental&startDate=2026-10-07&endDate=2026-10-18&overwrite=yes"
    );
    fireEvent.click(within(screen.getByRole("group", { name: "Overwrite" })).getByRole("button", { name: "default" }));
    expect(url.value).not.toContain("overwrite");

    fireEvent.click(screen.getByRole("button", { name: "Queue run" }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(true));
    const [, init] = fetchMock.mock.calls.find(([, call]) => call?.method === "POST")!;
    expect(JSON.parse(init.body as string)).toEqual({
      path: "/api/v1/db/update-nst-gamelog?runMode=incremental&startDate=2026-10-07&endDate=2026-10-18"
    });
  });

  it("reads a pasted URL back into the controls", () => {
    render(<RouteRunnerPage />);
    fireEvent.change(screen.getByLabelText("Route URL or path"), {
      target: { value: "https://fhfhockey.com/api/v1/db/update-rolling-player-averages?strength=ev,pp&fastMode=true" }
    });
    const strengths = screen.getByRole("group", { name: "Strengths" });
    expect(within(strengths).getByRole("button", { name: "ev" }).getAttribute("aria-pressed")).toBe("true");
    expect(within(strengths).getByRole("button", { name: "5v5" }).getAttribute("aria-pressed")).toBe("false");
    expect((screen.getByRole("checkbox", { name: "Fast mode" }) as HTMLInputElement).checked).toBe(true);
  });

  it("shows a job's progress and terminal", async () => {
    render(<RouteRunnerPage />);
    fireEvent.click(within(await screen.findByRole("list")).getByRole("button", { name: /NST skater gamelogs/ }));
    await waitFor(() => expect(screen.getByRole("log").textContent).toContain("step 1  HTTP 207  continuation_required"));
    expect(screen.getByText(/40 \/ 400 \(10\.0%\)/)).toBeTruthy();
    expect(screen.getByText("Next step on the next tick (within about a minute).")).toBeTruthy();
  });
});
