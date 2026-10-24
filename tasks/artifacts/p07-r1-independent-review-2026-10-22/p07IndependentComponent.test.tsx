import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import * as executionModule from "./executionAdapter";
import { fixture, now } from "./p07ReviewFixture";
import { defaultWorkspace, writeWorkspace } from "./workspace";
import RosterScheduleOptimizer from "../../components/RosterScheduleOptimizer/RosterScheduleOptimizer";
vi.mock("contexts/AuthProviderContext", () => ({ useAuth: () => ({ user: null, teams: [] }) }));
vi.mock("lib/supabase/client", () => ({ default: { auth: { getSession: async () => ({ data: { session: null } }) } } }));
vi.mock("components/RosterScheduleOptimizer/canonicalSchedule", async original => ({
  ...await original<typeof import("../../components/RosterScheduleOptimizer/canonicalSchedule")>(),
  useCanonicalSchedule: () => ({ games: [], teams: [], complete: false, error: "Offline calendar stub" })
}));
afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); vi.useRealTimers(); vi.restoreAllMocks(); });
it("mounts the real UI/hook/adapter with one current read shared by plan and candidate consumers", async () => {
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(now)); vi.stubGlobal("Worker", undefined);
  const { snapshot, body, intent } = fixture();
  const workspace = { ...defaultWorkspace(), context: snapshot.context, roster: snapshot.roster,
    manualPlayers: snapshot.players, rules: snapshot.rules, lockedAssignments: snapshot.lockedAssignments,
    realized: snapshot.realized, opponent: snapshot.opponent, intent };
  writeWorkspace(localStorage, workspace);
  const fetcher = vi.fn(async (url: string) => {
    if (url.endsWith("/access")) return { ok: true, json: async () => ({ data: { eligible: false, capabilities: [] } }) } as Response;
    if (url.includes("/workspace?")) return { ok: true, json: async () => ({ data: null }) } as Response;
    if (!url.startsWith("/api/v1/roster-schedule-optimizer/data?")) throw new Error("Unexpected path " + url);
    return { ok: true, json: async () => structuredClone(body) } as Response;
  });
  vi.stubGlobal("fetch", fetcher);
  const originalExecution = executionModule.executeRosterPlanning;
  const executions: unknown[] = [];
  vi.spyOn(executionModule, "executeRosterPlanning").mockImplementation((...args) => {
    executions.push({ id: args[0].id, context: args[0].context, intent: args[1], options: args[2], candidates: args[3] });
    return originalExecution(...args);
  });
  render(<RosterScheduleOptimizer />);
  await waitFor(() => expect(screen.getAllByText(/7 projected/).length).toBeGreaterThan(0));
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 25)); });
  console.info("REVIEW_EXECUTIONS", JSON.stringify({ executions, urls: fetcher.mock.calls.map(args => args[0]) }));
  expect(executions).toHaveLength(1);
  expect(fetcher.mock.calls.filter(args => args[0].includes("/data?"))).toHaveLength(1);
});
