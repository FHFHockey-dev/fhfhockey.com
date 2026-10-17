import React from "react";
import { createRoot } from "react-dom/client";
import Layout from "/Users/tim/Code/fhfhockey.com/web/components/Layout/Layout";
import Page from "/Users/tim/Code/fhfhockey.com/web/pages/roster-schedule-optimizer";
import { defaultWorkspace } from "/Users/tim/Code/fhfhockey.com/web/lib/rosterScheduleOptimizer/workspace";

// Synthetic records only. The production Layout/Header/NavbarItems and page remain unchanged.
const now = "2026-10-13T22:15:00Z";
const player = (id: string, name: string, team: string, teamId: number, position = "C", availability = "rostered") => ({
  id, name, nhlId: Number(id), nhlTeamId: teamId, rosterRevision: `fixture-roster-${id}`,
  teamAbbreviation: team, eligiblePositions: [position], eligibilityVerified: true, playerClass: "skater",
  availability, canDrop: true, ownership: null, holdValue: null, reserveEligibility: [],
});
const members = [player("1", "Fixture Alpha", "AAA", 1), player("2", "Fixture Bravo", "BBB", 2),
  ...Array.from({ length: 17 }, (_, index) => player(String(index + 10), `Fixture Defender ${index + 1}`, "CCC", 3, "D"))];
const candidates = [player("30", "Fixture AGP Candidate", "CCC", 3, "C", "unknown"),
  player("31", "Fixture Points Candidate", "DDD", 5, "C", "unknown")];
const catalog = [...members, ...candidates, player("40", "Fixture Opponent X", "XXX", 4, "D", "unknown"),
  player("41", "Fixture Opponent Y", "YYY", 6, "D", "unknown")];
const pair = (id: string, date: string, home: string, away: string) => [true, false].map(isHome => ({
  id, date, startsAt: `${date}T20:00:00Z`, scheduleRevision: `fixture-schedule-${id}`,
  teamAbbreviation: isHome ? home : away, opponent: isHome ? away : home, home: isHome, status: "scheduled",
}));
const games = [...pair("2001", "2026-10-15", "CCC", "XXX"), ...pair("2002", "2026-10-16", "AAA", "BBB"),
  ...pair("2003", "2026-10-16", "DDD", "YYY")];
const workspace = defaultWorkspace(new Date(now));
workspace.context = { ...workspace.context, provider: "yahoo", leagueId: "fixture-league", teamId: "fixture-team",
  startDate: "2026-10-12", endDate: "2026-10-18", timeZone: "America/New_York", asOf: now };
workspace.rules = { ...workspace.rules, rosterSlots: { C: 1, D: 17, BN: 1 }, acquisitionTiming: "unknown", acquisitionCost: null,
  periods: [{ id: "Fixture week", start: "2026-10-12T04:00:00Z", end: "2026-10-19T04:00:00Z", remaining: null, source: "unknown" }],
  scoring: { mode: "points", weights: { GOALS: 1 }, categories: [] }, unsupported: [] };
workspace.roster = members.map(item => ({ playerId: item.id, position: "bench" as const }));
workspace.manualPlayers = catalog.map(item => ({ ...item, eligibilityVerified: false })) as any;
workspace.intent.protectedPlayerIds = [];
const data = { players: workspace.manualPlayers, games, forecasts: [], evidence: {
  schedule: { source: "roster_optimizer_team_games", asOf: "2026-10-09T15:44:31.111Z", seasonId: 20262027,
    completeness: "partial", limitations: ["Fixture range coverage is incomplete. Reloading this reader does not update the upstream cache."] },
  forecasts: { source: "SYNTHETIC QA — no forecasts", asOf: null, seasonId: 20262027, completeness: "missing",
    limitations: ["Fixture forecast serving is unavailable; schedule planning remains available."] },
} };
localStorage.setItem("fhfh:rso:workspace:v1", JSON.stringify(workspace));
const state = window as any;
state.__fixtureReads = [];
state.__fixtureDbReads = [];
state.__fixtureScenario = state.__fixtureScenario ?? "pending-provider";
window.fetch = async (input: any, options: any) => {
  const url = String(input), method = options?.method ?? "GET";
  state.__fixtureReads.push({ url, method });
  const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  if (url.endsWith("/roster-schedule-optimizer/provider") && method === "POST") return new Promise(resolve => {
    state.__releaseFixtureProvider = () => resolve(response({ success: false, error: "Fixture provider unavailable. No live account request was made." }, 503));
  });
  if (method !== "GET") throw Error(`Fixture forbids writes: ${method} ${url}`);
  if (url.startsWith("/api/v1/roster-schedule-optimizer/eligibility?")) return new Promise(resolve => {
    state.__releaseFixtureCache = () => resolve(response({ success: true, receipt: {
      seasonId: 20262027, source: "yahoo_players", scope: "Yahoo default positions", status: "ready",
      expiresAt: "2026-10-14T08:40:00.000Z", players: members.map(item => ({ playerId: item.id, nhlId: item.nhlId,
        providerId: `477.p.${item.id}`, positions: item.eligiblePositions, playerClass: item.playerClass, asOf: "2026-10-13T08:45:00.000Z" })),
      limitations: ["Synthetic fixtures only; current league roster, rules, locks and availability remain unverified."],
    } }));
  });
  if (url.includes("/account?")) return response({ data: null });
  if (url.startsWith("/api/v1/roster-schedule-optimizer/data?")) return response({ success: true, data });
  if (url.endsWith("/roster-schedule-optimizer/access")) return response({ data: {
    eligible: true, capabilities: ["rso_sync", "rso_account_save"], grantingSources: ["owner_testing"], reason: "synthetic_fixture_only",
  } });
  if (url.startsWith("/api/v1/schedule/")) {
    const start = url.split("/").at(-1)!.split("?")[0];
    const coveredDates = Array.from({ length: 7 }, (_, index) => new Date(Date.parse(`${start}T12:00:00Z`) + index * 86400000).toISOString().slice(0, 10));
    const numGamesPerDay = Array(7).fill(0), rows: any = {}, labels = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"], seen = new Set();
    for (const game of games) {
      if (!coveredDates.includes(game.date) || seen.has(game.id)) continue;
      seen.add(game.id);
      const day = (new Date(`${game.date}T12:00:00Z`).getUTCDay() + 6) % 7;
      const home = catalog.find(item => item.teamAbbreviation === (game.home ? game.teamAbbreviation : game.opponent))!.nhlTeamId;
      const away = catalog.find(item => item.teamAbbreviation === (game.home ? game.opponent : game.teamAbbreviation))!.nhlTeamId;
      const item = { id: Number(game.id), season: 20262027, gameType: 2, gameDate: game.date, startTimeUTC: game.startsAt,
        gameState: "FUT", homeTeam: { id: home }, awayTeam: { id: away } };
      numGamesPerDay[day]++; (rows[home] ??= {})[labels[day]] = item; (rows[away] ??= {})[labels[day]] = item;
    }
    return response({ data: rows, numGamesPerDay, coveredDates, retrievedAt: now });
  }
  if (url === "/api/v1/team/20262027") return response([...new Map(catalog.map(item => [item.nhlTeamId,
    { id: item.nhlTeamId, name: item.teamAbbreviation, abbreviation: item.teamAbbreviation, logo: "" }])).values()]);
  throw Error(`Unexpected fixture fetch ${url}`);
};
createRoot(document.getElementById("root")!).render(<>
  <Layout><Page /></Layout>
  <div id="fixture-caption" role="note" style={{ position: "fixed", right: 4, bottom: matchMedia("(max-width: 1100px)").matches ? 80 : 4, zIndex: 9999,
    pointerEvents: "none", padding: "3px 6px", background: "#101820", border: "1px solid #07aae2", color: "#ffffff",
    font: '11px/1.25 "Roboto Condensed", sans-serif', maxWidth: 230 }}>
    FIXTURE DATA · actual page-shell styling<br />Synthetic account/provider state
  </div>
</>);
