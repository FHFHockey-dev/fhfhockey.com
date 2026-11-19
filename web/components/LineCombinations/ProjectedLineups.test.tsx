// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NextApiRequest, NextApiResponse } from "next";
import { lineTestDatabase } from "lib/lines/testDatabase";
import { fixtureUnit } from "lib/lines/testFixtures";
import projected from "pages/api/v1/lines/projected";
const db = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("lib/supabase/server", () => ({ default: db }));
vi.mock("next/script", () => ({ default: () => null }));
import ProjectedLineups, { ProjectedLineupsContent } from "./ProjectedLineups";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });
describe("retained report date disclosure", () => {
  it("labels older reports rather than presenting them as today's lineup", () => {
    render(<ProjectedLineupsContent data={{ enabled: true, reports: [], sets: [],
      reportScope: { requestedDate: "2026-11-12", reportDate: "2026-11-11", fallback: true } }} />);
    expect(screen.getByRole("heading", { name: "Latest reported line combinations" })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("older reports, not a confirmed lineup for today");
    expect(screen.getByRole("status").querySelectorAll("time")).toHaveLength(2);
  });
  it("preserves current and older-server response presentation", () => {
    render(<ProjectedLineupsContent data={{ enabled: true, reports: [], sets: [] }} />);
    expect(screen.getByRole("heading", { name: "Projected line combinations" })).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
  });
  it("does not show retained reports when publishing is disabled", () => {
    const view = render(<ProjectedLineupsContent data={{ enabled: false, reports: [], sets: [],
      reportScope: { requestedDate: "2026-11-12", reportDate: "2026-11-11", fallback: true } }} />);
    expect(view.container.textContent).toBe("");
  });
  it("keeps the original visible when conflicting readings withhold the starter", () => {
    const reports = JSON.parse(readFileSync(resolve(process.cwd(), "../tasks/artifacts/same-day-news-lines-2026-11-18/BUF-VGK-REPORT-ROWS.json"), "utf8"));
    const report = reports[0].payload;
    render(<ProjectedLineupsContent data={{ enabled: true, sets: [], navigation: { selectedGameId: report.gameId,
      games: [{ id: report.gameId, date: report.date, awayAbbreviation: "VGK", homeAbbreviation: "BUF" }] },
      reports: [{ ...report, reviewReason: "conflicting_claims", reportedStarter: { status: "confirmed",
        teamAbbreviation: "VGK", playerId: 8478499, playerName: "Adin Hill", author: "ByMHarrington" } }] }} />);
    expect(screen.getByText("Conflicting readings of this report. Player status is unverified.")).toBeTruthy();
    expect(screen.queryByText(/VGK confirmed starter/)).toBeNull();
    expect(screen.getByRole("link", { name: "View original post" }).getAttribute("href")).toBe(report.originalUrl);
  });
  it("shows a retained injury note with unverified team and game while keeping its source wording", () => {
    const text = "Bo Horvat: Injury: Horvat (undisclosed) left Saturday's game vs. Anaheim and did not return.";
    render(<ProjectedLineupsContent data={{ enabled: true, sets: [],
      navigation: { selectedGameId: 2026020328, games: [{ id: 2026020328, date: "2026-11-15", awayAbbreviation: "CGY", homeAbbreviation: "ANA" }] },
      reports: [{ key: "retained", date: "2026-11-15", teamId: null, teamAbbreviation: null, gameId: null, session: null, text, originalUrl: null,
        publishedAt: "2026-11-15T06:12:52Z", originalPublishedAt: null, receivedAt: "2026-11-15T06:14:04.443Z",
        interpretation: { version: "2026-11-06.1", context: "unknown", certainty: "reported", units: [], events: [], unresolved: [], rosterRevision: "" } }] }} />);
    const note = within(screen.getByText(text).closest("article")!);
    expect(note.getByText("Subject team unverified")).toBeTruthy();
    expect(note.getByText("No verified game for this report")).toBeTruthy();
    expect(note.queryByText(/CGY at ANA|ANA · game/)).toBeNull();
  });
  it("opens the next scheduled matchup on a quiet date and recovers game-bound sources and tiles on historical selection", async () => {
    vi.stubEnv("LINES_ENTRY_SERVING_ENABLED", "false");
    vi.stubEnv("TWEET_PIPELINE_INTERPRETATION_ENABLED", "true");
    vi.stubEnv("TWEET_PIPELINE_PUBLISHING_ENABLED", "true");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-09T17:00:00Z"));
    const retained = JSON.parse(readFileSync(resolve(process.cwd(), "../tasks/artifacts/same-day-news-lines-2026-11-18/BUF-VGK-REPORT-ROWS.json"), "utf8"));
    // The bounded Nov 18 read projected events. The Nov 12 archive projected provenance for those exact rows.
    const archive = JSON.parse(readFileSync(resolve(process.cwd(), "../tasks/artifacts/drm-ddatv-2026-11-12/archive-public-sample.json"), "utf8"));
    for (const row of retained) row.payload.provenance = archive.find((copy: { report_key: string }) => copy.report_key === row.report_key).payload.provenance;
    const prior = retained[0].payload;
    const nextId = 2026029999;
    // Both the following game and this complete PP report are fixture controls.
    const pp = { ...prior, key: "fixture-pp", originalUrl: "https://x.com/fixtureauthor/status/234",
      provenance: { relayTweetId: null, originalTweetId: "234", attributionStatus: "resolved" },
      text: "PP1: A-B-C-D-E. PP2: F-G-H-I-J.", interpretation: { ...prior.interpretation, units: [
        fixtureUnit(["A", "B", "C", "D", "E"], "pp", 1), fixtureUnit(["F", "G", "H", "I", "J"], "pp", 2),
      ] } };
    const store = lineTestDatabase({ games: [
      { id: prior.gameId, date: prior.date, startTime: prior.date + "T22:00:00Z", awayTeamId: 54, homeTeamId: 7, away: { abbreviation: "VGK" }, home: { abbreviation: "BUF" } },
      { id: nextId, date: "2026-11-10", startTime: "2026-11-10T23:00:00Z", awayTeamId: 54, homeTeamId: 3, away: { abbreviation: "VGK" }, home: { abbreviation: "NYR" } },
    ], tweet_projection_reports: [...retained, { ...retained[0], report_key: pp.key, payload: pp }] });
    db.from.mockImplementation(store.from);
    const requests: URLSearchParams[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      const request = new URL(url, "http://localhost");
      expect(request.pathname).toBe("/api/v1/lines/projected");
      requests.push(request.searchParams);
      let payload: unknown;
      await projected({ method: "GET", query: Object.fromEntries(request.searchParams) } as NextApiRequest,
        { setHeader() {}, json(value: unknown) { payload = value; } } as unknown as NextApiResponse);
      return { ok: true, json: () => payload };
    });
    const onGameChange = vi.fn();
    const page = render(<ProjectedLineups teamId={54} onGameChange={onGameChange} />);
    await screen.findByRole("heading", { name: /Projected line combinations · Nov 10 · VGK at NYR/ });
    expect(screen.getByRole<HTMLSelectElement>("combobox", { name: "Game" }).value).toBe(String(nextId));
    const rail = screen.getByRole("complementary", { name: "Latest team reports" });
    const matchup = within(rail).getByText(/Colten Ellis vs Adin Hill in goal/).closest("article")!;
    expect(within(matchup).getByText("Report for Nov 8 · VGK at BUF")).toBeTruthy();
    expect(within(matchup).getByRole("link").getAttribute("href")).toBe(prior.originalUrl);
    expect(matchup.querySelector("time")?.dateTime).toBe(retained[1].payload.originalPublishedAt);
    expect(screen.queryByText("A — B — C — D — E")).toBeNull();
    expect(screen.queryByText(/confirmed starter/i)).toBeNull();
    expect(requests[0]?.get("gameId")).toBeNull();
    fireEvent.change(screen.getByRole("combobox", { name: "Game" }), { target: { value: String(prior.gameId) } });
    await screen.findByRole("heading", { name: /Projected line combinations · Nov 8 · VGK at BUF/ });
    expect(screen.getByText("A — B — C — D — E")).toBeTruthy();
    expect(screen.getAllByText(/Colten Ellis vs Adin Hill in goal/)).toHaveLength(1);
    expect(screen.getByText("VGK confirmed starter · Adin Hill").parentElement?.textContent).toContain("Reported by @ByMHarrington");
    expect(screen.queryByText(/BUF confirmed starter|confirmed starter · Colten Ellis/)).toBeNull();
    expect(onGameChange).toHaveBeenCalledWith(prior.gameId);
    expect(requests.at(-1)?.get("gameId")).toBe(String(prior.gameId));
    page.rerender(<ProjectedLineups teamId={7} gameId={prior.gameId} />);
    await screen.findByText("No reports yet.");
    expect(requests.at(-1)?.get("teamId")).toBe("7");
    expect(screen.queryByText(/confirmed starter|Colten Ellis vs Adin Hill in goal/i)).toBeNull();
    const stored = store.tables.tweet_projection_reports!;
    stored[0]!.payload.provenance.attributionStatus = "pending";
    stored[1]!.payload.provenance.originalTweetId = "another-post";
    page.rerender(<ProjectedLineups teamId={54} gameId={prior.gameId} />);
    await screen.findByText(/Colten Ellis vs Adin Hill in goal/);
    expect(screen.queryByText(/confirmed starter/i)).toBeNull();
    expect(store.writes).toEqual([]);
  });
});
