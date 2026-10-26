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
    expect(screen.queryByRole("button", { name: "Re-queue with bypass" })).toBeNull();
  });

  it("copies every terminal line as plain text and confirms it", async () => {
    const failed = {
      id: 3, job_id: job.id, at: "2026-10-22T10:05:00Z", level: "error", message: "Blocked by freshness checks.",
      step: 2, status_code: 422, rows: null, progress: null, duration_ms: 1_500
    };
    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/v1/db/route-runner/jobs") {
        return reply({ success: true, jobs: [job], serverTime: new Date().toISOString() });
      }
      if (url.startsWith(`/api/v1/db/route-runner/jobs/${job.id}`)) {
        return reply({ success: true, job, events: url.endsWith("after=0") ? [...events, failed] : [], hasMore: false });
      }
      return reply({ success: false, error: "unexpected" }, 404);
    });
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    try {
      render(<RouteRunnerPage />);
      fireEvent.click(within(await screen.findByRole("list")).getByRole("button", { name: /NST skater gamelogs/ }));
      await waitFor(() => expect(screen.getByRole("log").textContent).toContain("HTTP 422"));
      fireEvent.click(screen.getByRole("button", { name: "Copy all" }));
      expect(await screen.findByRole("button", { name: "Copied" })).toBeTruthy();
      expect(writeText).toHaveBeenCalledWith(
        [
          "INFO 10:00:00  Queued",
          "INFO 10:04:00  step 1  HTTP 207  continuation_required  +38 sources  40/400 urls  200.0s  NST continuation: cursor 40 of 400.",
          "ERR  10:05:00  step 2  HTTP 422  1.5s  Blocked by freshness checks."
        ].join("\n")
      );
    } finally {
      Reflect.deleteProperty(navigator, "clipboard");
    }
  });

  it("falls back to a plain-text copy when the clipboard API is unavailable", async () => {
    let copied = "";
    const execCommand = vi.fn(() => {
      copied = document.querySelector("textarea")?.value ?? "";
      return true;
    });
    Object.defineProperty(document, "execCommand", { value: execCommand, configurable: true });
    try {
      render(<RouteRunnerPage />);
      fireEvent.click(within(await screen.findByRole("list")).getByRole("button", { name: /NST skater gamelogs/ }));
      await waitFor(() => expect(screen.getByRole("log").textContent).toContain("continuation_required"));
      fireEvent.click(screen.getByRole("button", { name: "Copy all" }));
      expect(await screen.findByRole("button", { name: "Copied" })).toBeTruthy();
      expect(execCommand).toHaveBeenCalledWith("copy");
      expect(copied.split("\n")).toHaveLength(2);
      expect(copied).toContain("INFO 10:00:00  Queued");
      expect(document.querySelector("textarea")).toBeNull();
    } finally {
      Reflect.deleteProperty(document, "execCommand");
    }
  });

  it("re-queues a freshness-blocked rolling job with the bypass and its resumeFrom", async () => {
    const blocked = makeJob({
      route_path: "/api/v1/db/update-rolling-player-averages",
      contract: "rolling_resume_from",
      status: "failed",
      next_query: { startDate: "2026-01-01", endDate: "2026-01-31", resumeFrom: "8478402" },
      last_status_code: 422,
      last_operation_status: "blocked",
      last_error: "Blocked by freshness checks (HTTP 422, 1 blocker(s)).",
      progress: { blockedBy: "freshness", stalls: 0 }
    });
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/v1/db/route-runner/jobs" && init?.method === "POST") return reply({ success: true, job });
      if (url === "/api/v1/db/route-runner/jobs") {
        return reply({ success: true, jobs: [blocked], serverTime: new Date().toISOString() });
      }
      if (url.startsWith(`/api/v1/db/route-runner/jobs/${blocked.id}`)) {
        return reply({ success: true, job: blocked, events: [], hasMore: false });
      }
      return reply({ success: false, error: "unexpected" }, 404);
    });
    render(<RouteRunnerPage />);
    fireEvent.click(within(await screen.findByRole("list")).getByRole("button", { name: /Rolling player averages/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Re-queue with bypass" }));
    // The click only opens the confirmation: it shows the blocker count and reason and sends nothing.
    const dialog = await screen.findByRole("alertdialog", { name: "Bypass 1 freshness blocker(s)?" });
    expect(dialog.textContent).toContain("Blocked by freshness checks (HTTP 422, 1 blocker(s)).");
    const confirm = within(dialog).getByRole("button", { name: "Confirm bypass re-queue" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
    fireEvent.click(within(dialog).getByRole("checkbox", { name: "I approve running past these blockers" }));
    fireEvent.click(confirm);
    await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(true));
    const [, init] = fetchMock.mock.calls.find(([, call]) => call?.method === "POST")!;
    expect(JSON.parse(init.body as string)).toEqual({
      path: "/api/v1/db/update-rolling-player-averages?startDate=2026-01-01&endDate=2026-01-31&resumeFrom=8478402&bypassFreshnessBlockers=true",
      bypassApproval: { sourceJobId: blocked.id, blockerCount: 1, confirmed: true }
    });
  });

  it("keeps the bypass warning on a bypassed job and in the job list", async () => {
    const bypassed = makeJob({
      route_path: "/api/v1/db/update-rolling-player-averages",
      contract: "rolling_resume_from",
      status: "completed",
      next_query: { startDate: "2026-01-01", bypassFreshnessBlockers: "true" },
      progress: { stalls: 0, freshnessBypass: { approvedBy: "admin-1", approvedAt: "2026-10-22T12:00:00.000Z",
        sourceJobId: "00000000-0000-4000-8000-000000000009", blockerCount: 1, reason: "Blocked." } }
    });
    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/v1/db/route-runner/jobs") {
        return reply({ success: true, jobs: [bypassed], serverTime: new Date().toISOString() });
      }
      if (url.startsWith(`/api/v1/db/route-runner/jobs/${bypassed.id}`)) {
        return reply({ success: true, job: bypassed, events: [], hasMore: false });
      }
      return reply({ success: false, error: "unexpected" }, 404);
    });
    render(<RouteRunnerPage />);
    const list = await screen.findByRole("list");
    expect(within(list).getByText("freshness bypassed")).toBeTruthy();
    fireEvent.click(within(list).getByRole("button", { name: /Rolling player averages/ }));
    const note = await screen.findByRole("note", { name: "Freshness bypass" });
    expect(note.textContent).toContain("Freshness bypass approved by admin-1 at 2026-10-22T12:00:00.000Z");
    expect(screen.queryByRole("button", { name: "Re-queue with bypass" })).toBeNull();
  });
});
