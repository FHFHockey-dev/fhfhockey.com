// CR-REL-04 / R6 browser acceptance: P07 review-before-use, task 10 expected / if-starts points,
// current-read nonce, and Yahoo goalie marks. Fictional players and intercepted routes only.
// run-acceptance.sh copies this file to <export>/web/e2e/acceptance/, so imports resolve against
// the candidate's own code.
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { installDraftProAuthenticatedFixtures } from "../draft-pro-fixtures";
import type { GameForecast, LeagueRules, PlanningPlayer, PlanningSnapshot, PlanningWorkspace } from "../../lib/rosterScheduleOptimizer/planningTypes";
import { currentRsoUsePolicy } from "../../lib/player-forecasts/rsoUsePolicy";
import { compactBridgeForecasts } from "../../lib/rosterScheduleData/bridgeForecastWire";

const SEASON = 20262027;
const DAY = "2026-10-05";
const EVALUATED_AT = "2026-10-05T18:00:00.000Z";
const REVISION = "forge-daily-bridge-v1:acceptance-run";
const policy = process.env.RSO_GOALIE_POLICY ?? "server-confirmed";
const PRINCIPAL = "00000000-0000-4000-8000-000000000001";

type Member = PlanningPlayer;
const member = (id: number, name: string, team: string, positions: string[], playerClass: "skater" | "goalie" = "skater"): Member => ({
  id: `fhfh:${id}`, nhlId: id, name, teamAbbreviation: team, eligiblePositions: positions, playerClass,
  nhlTeamId: [...team].reduce((value, char) => value * 31 + char.charCodeAt(0), 1), rosterRevision: `roster-${id}-${team}`,
  eligibilityVerified: true, availability: "manager_available", ownership: null, canDrop: true, holdValue: null, reserveEligibility: [],
});
const gameOf = (player: Member): PlanningSnapshot["games"][number] => ({
  id: `${player.id}:5`, scheduleRevision: `schedule-${player.id}`, date: DAY, startsAt: `${DAY}T23:00:00Z`,
  teamAbbreviation: player.teamAbbreviation!, opponent: "NYR", home: true, status: "scheduled",
});
function forecastRow(player: Member, stats: Record<string, number>, extra: Partial<GameForecast> = {}): GameForecast {
  const game = gameOf(player);
  return {
    playerId: player.id, gameId: game.id, stats, sourceKind: "detailed", sourceWatermark: REVISION,
    allowedUses: { assignment: true, totals: true, comparison: true, conditionalTieBreak: false }, conditioning: "unconditional",
    startProbability: null, confirmedStart: false, revisionId: REVISION, modelVersion: "forge-daily-bridge-v1:acceptance",
    limitations: ["Interim FORGE projection."], cutoffAt: "2026-10-05T12:00:00Z", issuedAt: "2026-10-05T12:00:00Z", expiresAt: game.startsAt!,
    issuedContext: { version: "forge-issued-context-v1", playerId: player.id, gameId: game.id, nhlPlayerId: player.nhlId!,
      seasonId: SEASON, teamId: player.nhlTeamId!, scheduledAt: game.startsAt!, scheduleRevision: game.scheduleRevision!,
      rosterRevision: player.rosterRevision!, observedAt: "2026-10-05T12:00:00Z", scheduleSourceUpdatedAt: null,
      scheduleFetchedAt: null, identityUpdatedAt: null, membershipCreatedAt: [] },
    ...extra,
  };
}

type Scenario = {
  players: Member[];
  slots: Record<string, number>;
  weights: Record<string, number>;
  bridge: GameForecast[];
  serialized?: GameForecast[];
  privateBridge?: GameForecast[];
  privateFailure?: boolean;
  expiresAt?: string;
  nonce?: "echo" | "mismatch";
};

async function openScenario(page: Page, scenario: Scenario) {
  await page.route(url => !["127.0.0.1", "localhost"].includes(url.hostname), route => route.abort());
  await page.route("**/api/**", route => route.fulfill({ status: 503, json: { error: "fixture: not mocked" } }));
  // Set the planning day without replacing performance.timeOrigin or timers. Both
  // Playwright clock APIs virtualize the window's origin but leave actual Workers
  // on the real origin, which would manufacture a cross-realm expiry mismatch.
  await page.addInitScript(at => {
    const NativeDate = Date, fixed = NativeDate.parse(at);
    window.Date = class extends NativeDate {
      constructor(...args: any[]) { super(...(args.length ? args : [fixed]) as [any]); }
      static now() { return fixed; }
    } as DateConstructor;
  }, EVALUATED_AT);
  const games = scenario.players.map(gameOf);
  const rules: LeagueRules = { lineupMode: "daily", rosterSlots: scenario.slots, acquisitionTiming: "same_day", acquisitionCost: 1, periods: [],
    lineupPeriods: [], scoring: { mode: "points", weights: scenario.weights, categories: [] },
    goalieMinimum: { required: null, credited: null, counts: "unknown", penalty: "unknown" }, unsupported: [] };
  const context = { provider: "yahoo" as const, seasonId: SEASON, leagueId: "league", teamId: "team", startDate: DAY, endDate: "2026-10-06", timeZone: "UTC", asOf: EVALUATED_AT };
  const roster = scenario.players.map(player => ({ playerId: player.id, position: "active" as const }));
  const workspace: PlanningWorkspace = { version: 1, context, rules, managerRuleOverrides: {}, roster, lockedAssignments: [],
    intent: { revision: 1, steps: [], protectedPlayerIds: [], excludedPlayerIds: [], goalieCoverage: "accept_risk", goalieWindow: "any", goalieSplit: "mon_thu", alternativeCount: 10 },
    manualPlayers: scenario.players, unresolvedNames: [], realized: {}, opponent: null };
  await page.addInitScript(value => { if (!localStorage.getItem("fhfh:rso:workspace:v1")) localStorage.setItem("fhfh:rso:workspace:v1", JSON.stringify(value)); }, workspace);
  await installDraftProAuthenticatedFixtures(page, () => ({ access: { eligible: false, grantingSources: [], expiresAt: null, verifiedAt: null, nextVerificationAt: null, reason: "no_active_grant", capabilities: [], providerReadiness: { stripe: false, patreon: false, yahoo: false } } }));
  const storageKey = `sb-${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:9").hostname.split(".")[0]}-auth-token`;
  await page.addInitScript(key => { const session = localStorage.getItem("sb-127-auth-token"); if (session) localStorage.setItem(key, session); }, storageKey);
  await page.route("**/api/v1/roster-schedule-optimizer/access", route => route.fulfill({ json: { data: { eligible: true, capabilities: ["rso_sync"], grantingSources: ["test"], expiresAt: null, reason: null } } }));
  await page.route("**/api/v1/roster-schedule-optimizer/workspace**", route => route.fulfill({ json: { data: null } }));
  const { wire } = compactBridgeForecasts(scenario.bridge, { players: scenario.players, games }, SEASON);
  expect(wire?.rows).toHaveLength(scenario.bridge.length);
  // The current read is the public GET `data` route (nonce header) or, where the candidate has it,
  // the authenticated POST `yahoo-current-data` route (nonce and scope in the body). Both get the
  // same rows; the private route also echoes its read scope.
  const reads: { route: string; nonce: string | undefined; echoed: string | undefined }[] = [];
  const currentRead = (route: import("@playwright/test").Route, kind: "data" | "yahoo-current-data") => {
    const request = route.request();
    if (kind === "yahoo-current-data" && scenario.privateFailure) return route.fulfill({ status: 503, json: { success: false, error: "synthetic current evidence unavailable" } });
    const body = kind === "yahoo-current-data" ? request.postDataJSON() ?? {} : {};
    const nonce: string | undefined = kind === "data" ? request.headers()["x-rso-read-nonce"] : body.nonce;
    const echoed = nonce && scenario.nonce === "mismatch" ? randomUUID() : nonce;
    reads.push({ route: kind, nonce, echoed });
    const bearer = (request.headers().authorization ?? "").split(" ")[1] ?? "";
    const principalId = kind === "yahoo-current-data" ? JSON.parse(Buffer.from(bearer.split(".")[1] ?? "", "base64url").toString() || "{}").sub : undefined;
    if (kind === "yahoo-current-data") {
      expect(request.method()).toBe("POST"); expect(principalId).toBe(PRINCIPAL);
      expect(request.headers().authorization).toMatch(/^Bearer .+\.fixture$/);
      expect(body).toMatchObject({ teamId: "team", leagueId: "league", seasonId: SEASON, startDate: DAY, endDate: "2026-10-06", timeZone: "UTC" });
    }
    const privateRows = kind === "yahoo-current-data" ? scenario.privateBridge : undefined;
    const scope = kind === "yahoo-current-data" ? { expiresAt: scenario.expiresAt ?? null, principalId, teamId: body.teamId, leagueId: body.leagueId,
      seasonId: body.seasonId, startDate: body.startDate, endDate: body.endDate, timeZone: body.timeZone } : {};
    return route.fulfill({ json: { success: true,
      data: { players: scenario.players, games, forecasts: [...(scenario.serialized ?? []), ...(privateRows ?? [])], baselineSources: [], participationSources: [],
        evidence: { schedule: { source: "fixture", asOf: EVALUATED_AT, seasonId: SEASON, completeness: "complete", limitations: [] } },
        forecastManifest: { version: "planning-forecasts-v1", id: "current-read", seasonId: SEASON, asOf: EVALUATED_AT,
          scheduleRevision: "schedule", rosterRevision: "roster", issuedRevisionIds: [REVISION], baselineChecksum: null,
          requiredOpportunities: games.length, forecastedOpportunities: scenario.bridge.length, exclusionCounts: {},
          rsoUsePolicy: { version: "rso-target-use-v1", revision: currentRsoUsePolicy().revision, bridgeRevisionIds: [REVISION] } } },
      bridgeForecasts: privateRows ? null : wire, ...(nonce ? { read: { nonce: echoed, evaluatedAt: EVALUATED_AT, ...scope } } : {}) } });
  };
  await page.route("**/api/v1/roster-schedule-optimizer/data?**", route => currentRead(route, "data"));
  await page.route("**/api/v1/roster-schedule-optimizer/yahoo-current-data", route => currentRead(route, "yahoo-current-data"));
  await page.route("**/api/v1/roster-schedule-optimizer/provider", route => route.fulfill({ json: { success: true,
    snapshot: { id: "provider-acceptance", context, players: scenario.players, roster, games, forecasts: [], rules,
      lockedAssignments: [], realized: {}, opponent: null,
      evidence: { roster: { source: "Yahoo authorized current roster", asOf: EVALUATED_AT, seasonId: SEASON, completeness: "complete", limitations: [] } } },
    capabilities: { roster: true, availability: true, rules: true, matchup: false, acquisitions: false, limitations: [] } } }));
  await page.goto("/roster-schedule-optimizer");
  await page.getByRole("button", { name: "By position" }).click();
  const grid = page.getByRole("table", { name: "Lineup by position" });
  await expect(grid).toBeVisible();
  await expect.poll(() => reads.filter(read => read.nonce).length, { message: "current read carries X-RSO-Read-Nonce" }).toBeGreaterThan(0);
  return { grid, reads };
}

const cell = (grid: ReturnType<Page["getByRole"]>, name: string, slot: string) => grid.getByRole("button", { name: `${name}, ${slot}, ${DAY}` });
async function expectPoints(target: ReturnType<Page["getByRole"]>, expected: string, ifStarts?: string) {
  const exp = target.getByLabel(/^Expected fantasy points:/);
  await expect(exp).toHaveAttribute("aria-label", `Expected fantasy points: ${expected === "—" ? "unavailable" : expected}`);
  await expect(exp).toContainText(expected);
  if (ifStarts !== undefined) {
    const cond = target.getByLabel(/^Fantasy points if starts:/);
    await expect(cond).toHaveAttribute("aria-label", `Fantasy points if starts: ${ifStarts === "—" ? "unavailable" : ifStarts}`);
    await expect(cond).toContainText(ifStarts);
  }
}
async function shoot(page: Page, testInfo: TestInfo, grid: ReturnType<Page["getByRole"]>, name: string) {
  await grid.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath(`${name}-${testInfo.project.name}.png`), fullPage: false });
  await grid.screenshot({ path: testInfo.outputPath(`${name}-grid-${testInfo.project.name}.png`) });
}

const center = member(1, "Complete Center", "CAR", ["C"]);
const wing = member(2, "Partial Wing", "NJD", ["LW"]);
const defender = member(3, "Unreviewed Defender", "BOS", ["D"]);
const goalieA = member(11, "Complete Goalie", "DAL", ["G"], "goalie");
const goalieB = member(12, "Partial Goalie", "VGK", ["G"], "goalie");
const WEIGHTS = { GOALS: 3, ASSISTS: 2, SAVES_GOALIE: 0.2, GOALS_AGAINST_GOALIE: -1 };
// Complete rows: center 0.5*3 + 0.5*2 = 2.5; goalie expected 16.2*0.2 - 1.44 = 1.8, if starts 27*0.2 - 2.4 = 3.0.
const completeBridge = () => [
  forecastRow(center, { GOALS: 0.5, ASSISTS: 0.5 }),
  forecastRow(goalieA, { SAVES_GOALIE: 16.2, GOALS_AGAINST_GOALIE: 1.44 }, { startProbability: 0.6, conditionalStats: { SAVES_GOALIE: 27, GOALS_AGAINST_GOALIE: 2.4 } }),
];

test("P07 + task 10: complete authorized rows show expected and if-starts points; partial rows show — not a partial sum", async ({ page }, testInfo) => {
  const { grid } = await openScenario(page, {
    players: [center, wing, goalieA, goalieB], slots: { C: 1, LW: 1, G: 2 }, weights: WEIGHTS, nonce: "echo",
    bridge: [...completeBridge(),
      // Missing ASSISTS: a silent sum would show 1.2.
      forecastRow(wing, { GOALS: 0.4 }),
      // Expected is complete (17.5*0.2 - 2.1 = 1.4); per-start GA missing, so a silent if-starts sum would show 5.0.
      forecastRow(goalieB, { SAVES_GOALIE: 17.5, GOALS_AGAINST_GOALIE: 2.1 }, { startProbability: 0.7, conditionalStats: { SAVES_GOALIE: 25 } })],
  });
  await expectPoints(cell(grid, "Complete Center", "C"), "2.5");
  await expectPoints(cell(grid, "Complete Goalie", "G"), "1.8", "3.0");
  await expectPoints(cell(grid, "Partial Wing", "LW"), "—");
  await expect(cell(grid, "Partial Wing", "LW")).not.toContainText("1.2");
  await expectPoints(cell(grid, "Partial Goalie", "G"), "1.4", "—");
  await expect(cell(grid, "Partial Goalie", "G")).not.toContainText("5.0");
  await expect.soft(page.getByRole("button", { name: "Best projected points" })).toBeDisabled();
  await shoot(page, testInfo, grid, "p07-task10-complete-and-partial");
});

test("P07: a serialized forecast that claims its own allowed uses is not summed", async ({ page }, testInfo) => {
  const { grid } = await openScenario(page, {
    players: [center, defender, goalieA], slots: { C: 1, D: 1, G: 1 }, weights: WEIGHTS, nonce: "echo",
    bridge: completeBridge(),
    // Not a bridge revision and no reviewed binding: would show 2.1 if its own allowedUses were trusted.
    serialized: [forecastRow(defender, { GOALS: 0.3, ASSISTS: 0.6 }, { revisionId: "legacy-serialized", sourceWatermark: "legacy-serialized" })],
  });
  await expectPoints(cell(grid, "Complete Center", "C"), "2.5");
  await expectPoints(cell(grid, "Complete Goalie", "G"), "1.8", "3.0");
  await expectPoints(cell(grid, "Unreviewed Defender", "D"), "—");
  await expect(cell(grid, "Unreviewed Defender", "D")).not.toContainText("2.1");
  await shoot(page, testInfo, grid, "p07-unreviewed-serialized");
});

test("current-read nonce mismatch withholds projected points; the echoed nonce restores them", async ({ page }, testInfo) => {
  const scenario: Scenario = { players: [center, goalieA], slots: { C: 1, G: 1 }, weights: WEIGHTS, nonce: "mismatch", bridge: completeBridge() };
  const { grid, reads } = await openScenario(page, scenario);
  await expect.poll(() => reads.some(read => read.nonce && read.echoed !== read.nonce)).toBe(true);
  await expectPoints(cell(grid, "Complete Center", "C"), "—");
  await expectPoints(cell(grid, "Complete Goalie", "G"), "—", "—");
  await expect(grid).not.toContainText("2.5");
  await expect.soft(page.getByText(/Current read does not match this planning generation/).first()).toBeVisible();
  await shoot(page, testInfo, grid, "nonce-mismatch-withheld");
  // Same fixture with only the nonce echoed correctly: the points return.
  scenario.nonce = "echo";
  await page.reload();
  await page.getByRole("button", { name: "By position" }).click();
  await expectPoints(cell(grid, "Complete Center", "C"), "2.5");
  await expectPoints(cell(grid, "Complete Goalie", "G"), "1.8", "3.0");
  await shoot(page, testInfo, grid, "nonce-echo-control");
});

test("Yahoo goalie marks from a provider snapshot are badges only: start chance and points unchanged", async ({ page }, testInfo) => {
  const starting = member(21, "Starting Goalie", "DAL", ["G"], "goalie");
  const sitting = member(22, "Sitting Goalie", "VGK", ["G"], "goalie");
  const mark = (isStarting: boolean) => ({ source: "yahoo" as const, date: DAY, isStarting, observedAt: "2026-10-05T17:30:00.000Z" });
  const marked = [{ ...starting, startingStatus: mark(true) }, { ...sitting, startingStatus: mark(false) }];
  const row = (player: Member, probability: number) => forecastRow(player, { SAVES_GOALIE: 25 * probability }, { startProbability: probability, conditionalStats: { SAVES_GOALIE: 25 } });
  // FORGE priors 0.6 / 0.7. Applied marks would give 5.0 / 0.0; badge-only keeps 3.0 / 3.5.
  const { grid } = await openScenario(page, { players: marked, slots: { G: 2 }, weights: { SAVES_GOALIE: 0.2 }, nonce: "echo", bridge: [row(starting, 0.6), row(sitting, 0.7)] });
  const start = cell(grid, "Starting Goalie", "G"), sit = cell(grid, "Sitting Goalie", "G");
  await expect(start.getByLabel(/^Starting \(Yahoo, read .+\); FORGE's start chance unchanged$/)).toHaveText("✓");
  await expect(sit.getByLabel(/^Not starting \(Yahoo, read .+\); FORGE's start chance unchanged$/)).toHaveText("✗");
  await expectPoints(start, "3.0", "5.0");
  await expectPoints(sit, "3.5", "5.0");
  await expect(grid.getByLabel(/start chance (100|0)% for this game/)).toHaveCount(0);
  await shoot(page, testInfo, grid, `goalie-marks-${policy}`);
});

test("trusted Yahoo server confirmations set 100/0, unknown keeps its prior, and expiry withdraws points despite saved spoofed marks", async ({ page }, testInfo) => {
  expect(policy).toBe("server-confirmed");
  await page.addInitScript(() => {
    const NativeWorker = Worker; (window as any).__expiryClocks = [];
    window.Worker = class extends NativeWorker { constructor(url: string | URL, options?: WorkerOptions) {
      super(url, options); this.addEventListener("message", event => { if (event.data.result) (window as any).__expiryClocks.push({ expiresAt: event.data.expiresAt,
        expiresAtMonotonic: event.data.expiresAtMonotonic, windowWall: Date.now(), windowMono: performance.timeOrigin + performance.now() }); });
    } };
  });
  const starters = [member(31, "Verified Starter", "DAL", ["G"], "goalie"), member(32, "Verified Nonstarter", "VGK", ["G"], "goalie"), member(33, "Unknown Goalie", "MIN", ["G"], "goalie")];
  const marked = starters.map((player, i) => ({ ...player, startingStatus: { source: "yahoo" as const, date: DAY, isStarting: i !== 0, observedAt: "2010-01-01T00:00:00Z" } }));
  const row = (player: Member, probability: number) => forecastRow(player, { SAVES_GOALIE: 25 * probability }, { startProbability: probability, confirmedStart: probability === 1, conditionalStats: { SAVES_GOALIE: 25 } });
  const scenario: Scenario = { players: marked, slots: { G: 3 }, weights: { SAVES_GOALIE: .2 }, nonce: "echo",
    bridge: starters.map((player, i) => row(player, [.6, .7, .4][i])),
    privateBridge: starters.map((player, i) => row(player, [1, 0, .4][i])), expiresAt: "2026-10-05T18:00:10.000Z" };
  const { grid, reads } = await openScenario(page, scenario);
  await expectPoints(cell(grid, "Verified Starter", "G"), "5.0", "5.0");
  await expectPoints(cell(grid, "Verified Nonstarter", "G"), "0.0", "5.0");
  await expectPoints(cell(grid, "Unknown Goalie", "G"), "2.0", "5.0");
  expect(reads.some(read => read.route === "yahoo-current-data" && read.nonce === read.echoed)).toBe(true);
  await shoot(page, testInfo, grid, "trusted-yahoo-positive");
  scenario.privateFailure = true;
  // Let the real 10-second publication deadline expire; no fabricated worker/window clock jump.
  await writeFile(testInfo.outputPath("expiry-clocks.json"), JSON.stringify(await page.evaluate(() => ({ receipts: (window as any).__expiryClocks,
    wall: Date.now(), mono: performance.timeOrigin + performance.now() })), null, 2));
  await expectPoints(cell(grid, "Verified Starter", "G"), "—", "—");
  await expectPoints(cell(grid, "Verified Nonstarter", "G"), "—", "—");
  await expectPoints(cell(grid, "Unknown Goalie", "G"), "—", "—");
  await shoot(page, testInfo, grid, "trusted-yahoo-expired");
});
