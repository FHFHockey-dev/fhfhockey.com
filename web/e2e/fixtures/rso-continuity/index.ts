import { expect, type Page } from "@playwright/test";
import type { GameForecast, LeagueRules, PlanningPlayer, PlanningSnapshot, PlanningWorkspace } from "../../../lib/rosterScheduleOptimizer/planningTypes";
import { workspaceStorageKey } from "../../../lib/rosterScheduleOptimizer/workspace";
import { RSO_FIXTURE_BRIDGE, RSO_FIXTURE_PRINCIPAL } from "../../roster-schedule-optimizer-fixtures";

// Fictional builders mirrored from roster-schedule-optimizer.spec.ts, which keeps them file-local.
export const OTHER_PRINCIPAL = "00000000-0000-4000-8000-000000000002";
const base = { id: "fhfh:1", nhlId: 1, name: "Alpha Center", teamAbbreviation: "CAR", eligiblePositions: ["C"], playerClass: "skater" as const, availability: "unknown" as const, ownership: null, canDrop: null, holdValue: null, reserveEligibility: [] };
export const fixturePlayer = (id: number, name: string, team: string): PlanningPlayer => ({ ...base, id: `fhfh:${id}`, nhlId: id, nhlTeamId: [...team].reduce((value, char) => value * 31 + char.charCodeAt(0), 1), rosterRevision: `roster-${id}-${team}`, name, teamAbbreviation: team, eligibilityVerified: true, availability: "manager_available", canDrop: true });
export const fixtureGame = (id: string, day: string, team: string): PlanningSnapshot["games"][number] => ({ id, scheduleRevision: `schedule-${id}`, date: day, startsAt: `${day}T23:00:00Z`, teamAbbreviation: team, opponent: "NYR", home: true, status: "scheduled" });
export const fixtureForecast = (member: PlanningPlayer, game: PlanningSnapshot["games"][number], goals: number): GameForecast => ({
  playerId: member.id, gameId: game.id, stats: { GOALS: goals }, sourceKind: "detailed", sourceWatermark: "fixture-inputs",
  allowedUses: { assignment: true, totals: true, comparison: true, conditionalTieBreak: false }, conditioning: "unconditional",
  startProbability: null, confirmedStart: false, revisionId: RSO_FIXTURE_BRIDGE, modelVersion: "fixture", limitations: [],
  cutoffAt: "2026-09-26T00:00:00Z", issuedAt: "2026-09-26T00:00:00Z", expiresAt: game.startsAt!,
  issuedContext: { version: "forge-issued-context-v1", playerId: member.id, gameId: game.id, nhlPlayerId: member.nhlId!,
    seasonId: 20262027, teamId: member.nhlTeamId!, scheduledAt: game.startsAt!, scheduleRevision: game.scheduleRevision!,
    rosterRevision: member.rosterRevision!, observedAt: "2026-09-26T00:00:00Z", scheduleSourceUpdatedAt: null,
    scheduleFetchedAt: null, identityUpdatedAt: null, membershipCreatedAt: [] } });
export const fixtureRules: LeagueRules = { lineupMode: "daily", rosterSlots: { C: 1, BN: 2 }, acquisitionTiming: "same_day", acquisitionCost: 1, periods: [{ id: "fixture-week", start: "2026-10-12T00:00:00Z", end: "2026-10-19T00:00:00Z", remaining: 2, source: "manager" }], lineupPeriods: [], scoring: { mode: "points", weights: { GOALS: 1 }, categories: [] }, goalieMinimum: { required: null, credited: null, counts: "unknown", penalty: "unknown" }, unsupported: [] };
export function fixtureWorkspace(players: PlanningPlayer[], rules: LeagueRules = fixtureRules): PlanningWorkspace {
  return { version: 1, context: { provider: "manual", seasonId: 20262027, leagueId: "manual", teamId: "manual", startDate: "2026-10-12", endDate: "2026-10-18", timeZone: "UTC", asOf: "2026-10-11T12:00:00Z" }, rules, managerRuleOverrides: {}, roster: [{ playerId: players[0].id, position: "active" }], lockedAssignments: [], intent: { revision: 1, steps: [], protectedPlayerIds: [], excludedPlayerIds: [], goalieCoverage: "accept_risk", goalieWindow: "any", goalieSplit: "mon_thu", alternativeCount: 10 }, manualPlayers: players, unresolvedNames: [], realized: {}, opponent: null };
}
/** Yahoo context with one nonzero selected add, a protection and a manager lock. */
export function connectedWorkspace(players: PlanningPlayer[], league = "fixture-league", team = "fixture-team") {
  const workspace = fixtureWorkspace(players);
  workspace.context = { ...workspace.context, provider: "yahoo", leagueId: league, teamId: team };
  workspace.intent.steps = [{ id: "fixture-add", type: "add", playerId: players[1].id, at: "2026-10-12T12:00:00Z", effectiveAt: "2026-10-12T12:00:00Z", conditional: false, dependsOn: [] }];
  workspace.intent.protectedPlayerIds = [players[0].id];
  workspace.intent.excludedPlayerIds = [players[2]?.id].filter(Boolean) as string[];
  workspace.lockedAssignments = [{ date: "2026-10-13", playerId: players[0].id, slotId: "C#1" }];
  return workspace;
}
export function providerSnapshot(workspace: PlanningWorkspace, players: PlanningPlayer[], id: string, asOf = "2026-10-11T12:00:00Z"): PlanningSnapshot {
  return { id, context: { ...workspace.context, asOf }, players, roster: workspace.roster, rules: workspace.rules, lockedAssignments: [], games: [], forecasts: [], realized: {}, opponent: null, evidence: {} };
}
/** Seeds the local slot of `principal` (null: the anonymous manual slot). */
export async function seedWorkspace(page: Page, workspace: PlanningWorkspace, principal: string | null = null) {
  await page.addInitScript(({ key, value }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(value)); }, { key: workspaceStorageKey(principal), value: workspace });
}
export const savedWorkspace = (page: Page, principal: string | null = null) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!) as PlanningWorkspace, workspaceStorageKey(principal));

/** Synthetic Supabase session for any fictional principal; JWTs are unsigned `.fixture` tokens. */
export function fixtureSession(principal: string) {
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60;
  const user = { id: principal, aud: "authenticated", role: "authenticated", email: `rso-${principal.slice(-1)}@example.test`, app_metadata: { provider: "email", providers: ["email"] }, user_metadata: { fixture: true }, created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z" };
  const jwt = (subject: string) => `eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.${Buffer.from(JSON.stringify({ sub: subject, aud: "authenticated", role: "authenticated", exp: expiresAt })).toString("base64url")}.fixture`;
  return { access_token: jwt(principal), refresh_token: jwt(`${principal}:refresh`), token_type: "bearer", expires_in: 3600, expires_at: expiresAt, user };
}
const storageKeys = () => ["sb-127-auth-token", `sb-${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "https://fyhftlxokyjtpndbkfse.supabase.co").hostname.split(".")[0]}-auth-token`];
/** Signs in once per page; `switchPrincipal` replaces the stored session before a reload. */
export async function signIn(page: Page, principal = RSO_FIXTURE_PRINCIPAL) {
  const state = { session: fixtureSession(principal) };
  await page.addInitScript(({ keys, session }) => { for (const key of keys) if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(session)); }, { keys: storageKeys(), session: state.session });
  await page.route("**/auth/v1/user", route => route.fulfill({ json: state.session.user }));
  await page.route("**/auth/v1/token**", route => route.fulfill({ json: state.session }));
  await page.route("**/auth/v1/logout**", route => route.fulfill({ status: 204, body: "" }));
  return {
    async switchPrincipal(next: string) {
      state.session = fixtureSession(next);
      await page.evaluate(({ keys, session }) => { for (const key of keys) localStorage.setItem(key, JSON.stringify(session)); }, { keys: storageKeys(), session: state.session });
    },
  };
}
export const bearerPrincipal = (authorization: string | undefined) => authorization?.startsWith("Bearer ")
  ? JSON.parse(Buffer.from(authorization.split(".")[1], "base64url").toString()).sub as string : null;

/** Loopback-only network; unmocked APIs fail closed. */
export async function isolateNetwork(page: Page) {
  await page.route("**/api/**", route => route.fulfill({ status: 503, json: { error: "fixture: unmocked API" } }));
  await page.route("**/*", route => ["127.0.0.1", "localhost"].includes(new URL(route.request().url()).hostname) ? route.fallback() : route.abort());
  await page.route("**/rest/v1/**", route => route.fulfill({ json: [] }));
}
export const grantedAccess = (capabilities = ["rso_sync", "rso_auto_upkeep", "rso_account_save"]) => ({ data: { eligible: true, capabilities, grantingSources: ["fixture"], expiresAt: null, reason: null } });
export const expiredAccess = { data: { eligible: false, capabilities: [], grantingSources: [], expiresAt: "2026-10-01T00:00:00Z", reason: "expired" } };

export async function openPlanningSetup(page: Page) {
  const toggle = page.getByRole("button", { name: /Planning setup ·/ });
  if (await toggle.getAttribute("aria-expanded") === "false") await toggle.click();
}
/** Desktop frame: no page scroll, no horizontal overflow, header above the workspace. */
export async function expectNoPageOverflow(page: Page) {
  const frame = await page.evaluate(() => ({ width: window.innerWidth, scrollWidth: document.documentElement.scrollWidth, bodyWidth: document.body.scrollWidth,
    overflowing: Array.from(document.querySelectorAll("main *")).filter(node => { const box = node.getBoundingClientRect(); return box.width > 0 && box.right > window.innerWidth + 1 && getComputedStyle(node).position !== "fixed"; }).slice(0, 5).map(node => `${node.tagName}.${(node as HTMLElement).className}`.slice(0, 80)) }));
  expect(frame.scrollWidth, JSON.stringify(frame)).toBeLessThanOrEqual(frame.width);
  expect(frame.bodyWidth, JSON.stringify(frame)).toBeLessThanOrEqual(frame.width);
  return frame;
}
export function compactWorkspace(count: number) {
  const positions = ["C", "C", "LW", "LW", "RW", "RW", "D", "D", "D", "D", "C", "LW", "G", "G"];
  const players = Array.from({ length: count === 19 ? 20 : count }, (_, index) => ({ ...fixturePlayer(index + 1, `Compact Surname${index + 1}`, "CAR"),
    eligiblePositions: index === 0 ? ["C", "LW"] : [positions[index] ?? "C"], playerClass: positions[index] === "G" ? "goalie" as const : "skater" as const,
    reserveEligibility: ["IR", "IR+"] as Array<"IR" | "IR+"> }));
  const workspace = fixtureWorkspace(players, { ...fixtureRules, periods: [{ id: "Week", start: "2026-10-05T00:00:00Z", end: "2026-10-12T00:00:00Z", remaining: 2, source: "manager" }],
    rosterSlots: { C: 2, LW: 2, RW: 2, D: count === 19 ? 3 : 4, UTIL: 2, G: 2, BN: count >= 25 ? count - 16 : 6, IR: 1, "IR+": 1 } });
  workspace.context = { ...workspace.context, startDate: "2026-10-05", endDate: "2026-10-11", asOf: "2026-10-07T12:00:00Z" };
  workspace.roster = players.filter((_, index) => count !== 19 || index !== 9).map(player => { const index = players.indexOf(player); return { playerId: player.id,
    position: count >= 25 && index >= count - 2 ? index === count - 2 ? "IR" : "IR+" : index < 14 ? "active" : "bench" }; });
  const games = Array.from({ length: 7 }, (_, index) => fixtureGame(`compact-${index}`, `2026-10-${String(index + 5).padStart(2, "0")}`, "CAR"));
  return { workspace, players, games };
}
