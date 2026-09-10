import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
const hook = vi.hoisted(() => ({ value: {} as any }));
vi.mock("hooks/useDraftProReports", () => ({ useDraftProReports: () => hook.value }));
import { AnalyticalReportsPanel, reportPrintMarkup } from "./AnalyticalReportsPanel";

const input: any = { roster: [], leagueType: "points", season: "20262027", source: { projection: { id: "server", version: "v1", origin: "server" }, schedule: { season: "20262027", startWeek: 1, endWeek: 1, lineupMode: "daily", rosterSlots: {} } }, scoring: {} };
const report: any = { schemaVersion: 1, reportType: "draft_summary", sourceFingerprint: "x", createdAt: "2026-09-07T00:00:00Z", season: "20262027", roster: { count: 1, players: [{ id: "p", name: "A < B", positions: ["C"], role: "skater", team: "AAA" }] }, totals: { rawVorp: 1, projectedPoints: 2, categories: { GOALS: 1 } }, strengths: ["goals stronger"], weaknesses: ["blocks weaker"], schedule: { state: "ready", conflicts: [], diagnostics: [] }, analyticalInput: input, provenance: { projectionId: "server", projectionVersion: "v1", projectionOrigin: "server", season: "20262027", scoring: { GOALS: 1 }, sourceWeights: {}, freshness: { oldestFetchedAt: null, latestFetchedAt: null } } };
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe("AnalyticalReportsPanel", () => {
  it("renders the complete server report payload", () => { hook.value = { saved: [], report, status: "idle", error: null, listError: null, generate: vi.fn(), open: vi.fn(), retry: vi.fn(), list: vi.fn() }; render(<AnalyticalReportsPanel eligible input={input} snapshot={{}} />); expect(screen.getByText("A < B · skater · C · AAA")).toBeTruthy(); expect(screen.getAllByText("GOALS")).toHaveLength(2); expect(screen.getByText(/Projection server \/ v1/)).toBeTruthy(); expect(screen.getByText("Zero lineup conflicts.")).toBeTruthy(); expect(screen.getByRole("button", { name: "Print report" })).toBeTruthy(); });
  it("builds an isolated, escaped report document", () => { const markup = reportPrintMarkup(report); expect(markup).toContain("<!doctype html>"); expect(markup).toContain("A &lt; B"); expect(markup).not.toContain("DraftDashboard"); });
  it("surfaces popup blocking instead of opening a blank report", () => { vi.spyOn(window, "open").mockReturnValue(null); hook.value = { saved: [], report, status: "idle", error: null, listError: null, generate: vi.fn(), open: vi.fn(), retry: vi.fn(), list: vi.fn() }; render(<AnalyticalReportsPanel eligible input={input} />); fireEvent.click(screen.getByRole("button", { name: "Print report" })); expect(screen.getByRole("alert").textContent).toContain("Allow pop-ups"); });
});
