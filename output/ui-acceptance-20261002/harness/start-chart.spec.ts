import { expect, test, type Locator, type Page } from "./ui-acceptance-fixture";
import { writeFile } from "node:fs/promises";
import { loadEnvConfig } from "@next/env";
import { boardGoalieForecast } from "../lib/projections/starterBoardScoring";
import { buildBoardValidationDisclosure } from "../lib/projections/starterBoardValidation";
import { installDraftProAuthenticatedFixtures } from "./draft-pro-fixtures";
import { defaultWorkspace } from "../lib/rosterScheduleOptimizer/workspace";
import type { PlanningPlayer } from "../lib/rosterScheduleOptimizer/planningTypes";

loadEnvConfig(process.cwd(), true);

const positions = ["LW", "RW", "C", "D", "G"] as const;

const player = (
  position: (typeof positions)[number],
  rank: number,
) => ({
  row_key: `run-e2e:1001:${position}-${rank}:1`,
  game_id: 1001,
  player_id: 8_470_000 + positions.indexOf(position) * 100 + rank,
  name: `${position} Player ${rank}`,
  positions: [position],
  ownership: rank === 30 ? null : 35,
  percent_ownership: rank === 30 ? null : 35,
  ownership_as_of_date: rank === 30 ? null : "2026-02-07",
  opponent_team_id: 10,
  opponent_abbrev: "TOR",
  team_id: 8,
  team_abbrev: "MTL",
  proj_fantasy_points: position === "G" ? null : 6 - rank / 100,
  proj_goals: position === "G" ? null : 0.4,
  proj_assists: position === "G" ? null : 0.6,
  proj_shots: position === "G" ? null : 3.2,
  proj_pp_points: position === "G" ? null : 0.3,
  proj_hits: position === "G" ? null : 0.8,
  proj_blocks: position === "G" ? null : 0.5,
  proj_pim: position === "G" ? null : 0.2,
  proj_toi_minutes: position === "G" ? null : 18.4,
  matchup_grade: position === "G" ? null : 72,
  start_probability: position === "G" ? 0.64 : null,
  projected_gsaa: position === "G" ? 0.18 : null,
  confirmed_status: position === "G" ? false : null,
  games_remaining_week: 2,
  position_ranks: { [position]: rank },
  context: {
    es_role: position === "G" ? null : "L1",
    unit_tier: position === "G" ? null : "PP1",
    pp_share: position === "G" ? null : 0.63,
    role_probability: position === "G" ? null : 0.81,
    role_continuity: position === "G" ? null : 0.75,
    opponent_defense_edge: position === "G" ? null : 0.11,
    goalie_goal_rate_multiplier: position === "G" ? null : 1.04,
    goalie_starter_certainty: position === "G" ? null : 0.72,
    rest_delta: position === "G" ? null : 1,
    trend_effect: position === "G" ? null : "positive",
    projection_low: position === "G" ? null : 3.1,
    projection_high: position === "G" ? null : 7.4,
    flags: rank === 30 ? ["ownership_unavailable"] : [],
  },
});

const sourceStatus = {
  overall: "ready",
  projection: {
    state: "ready",
    affectsRanking: true,
    date: "2026-02-07",
    updatedAt: "2026-02-07T16:00:00Z",
    runId: "run-e2e",
    modelVersion: "skater-e2e-v1",
    inputVersion: "e2e-input-v1",
  },
  teamRatings: {
    state: "ready",
    affectsRanking: false,
    date: "2026-02-07",
    requestedDate: "2026-02-07",
    resolvedDate: "2026-02-07",
  },
  ctpi: {
    state: "ready",
    affectsRanking: false,
    date: "2026-02-07",
    throughDate: "2026-02-07",
  },
  goalies: {
    state: "ready",
    affectsRanking: true,
    date: "2026-02-07",
    expectedTeams: 2,
    coveredTeams: 2,
    freshTeams: 2,
    staleTeams: 0,
  },
  ownership: {
    state: "partial",
    affectsRanking: false,
    date: "2026-02-07",
    mappedPlayers: 33,
    unmappedPlayers: 1,
    playersWithAsOf: 33,
    playersMissingAsOf: 1,
    oldestAsOfDate: "2026-02-07",
    latestAsOfDate: "2026-02-07",
  },
  gamesRemaining: {
    state: "ready",
    affectsRanking: false,
    date: "2026-02-07",
  },
  degradedReasons: [],
};

const apiFixture = (requestedDate: string) => {
  const fallback = requestedDate === "2026-02-08";
  const resolvedDate = fallback ? "2026-02-09" : requestedDate;
  const allPlayers = [
    ...Array.from({ length: 30 }, (_, index) => player("C", index + 1)),
    player("LW", 1),
    player("RW", 1),
    player("D", 1),
    player("G", 1),
  ];
  return {
    dateUsed: resolvedDate,
    date: resolvedDate,
    resolvedDate,
    requestedDate,
    fallbackApplied: fallback,
    serving: {
      requestedDate,
      resolvedDate,
      fallbackApplied: fallback,
      isSameDay: !fallback,
      state: fallback ? "fallback" : "same_day",
      strategy: fallback ? "next_scheduled_date" : "requested_date",
      gapDays: 0,
      severity: "none",
      status: fallback ? "upcoming" : "requested_date",
      message: fallback
        ? "No games are scheduled for 2026-02-08. Showing the upcoming slate on 2026-02-09."
        : null,
      requestedScheduledGames: fallback ? 0 : 1,
      resolvedScheduledGames: 1,
      requestedHadGames: !fallback,
      resolvedHadGames: true,
      mode: fallback ? "fallback" : "exact",
      reason: fallback ? "requested_date_has_no_games" : null,
      ageDays: 0,
    },
    projectionRunId: "run-e2e",
    projections: allPlayers.length,
    players: allPlayers,
    ctpi: [
      { date: "2026-02-06", MTL: 54, TOR: 61 },
      { date: "2026-02-07", MTL: 56, TOR: 60 },
    ],
    games: [
      {
        id: 1001,
        date: resolvedDate,
        startTime: fallback ? "2026-02-10T00:00:00Z" : "2026-02-08T00:00:00Z",
        homeTeamId: 10,
        awayTeamId: 8,
        homeAbbrev: "TOR",
        awayAbbrev: "MTL",
        homeRating: { offRating: 104, defRating: 102, paceRating: 101 },
        awayRating: { offRating: 98, defRating: 96, paceRating: 99 },
        homeGoalies: [
          {
            player_id: 8_490_001,
            name: "Home Goalie",
            start_probability: 0.7,
            projected_gsaa_per_60: 0.2,
            confirmed_status: false,
            source_updated_at: "2026-02-07T15:00:00Z",
            source_confidence: "high",
            is_stale: fallback,
          },
        ],
        awayGoalies: [
          {
            player_id: 8_490_002,
            name: "Away Goalie",
            start_probability: 1,
            projected_gsaa_per_60: 0.1,
            confirmed_status: true,
            source_updated_at: "2026-02-07T15:00:00Z",
            source_confidence: "high",
            is_stale: fallback,
          },
        ],
      },
    ],
    sourceStatus: fallback ? { ...sourceStatus, overall: "degraded",
      projection: { ...sourceStatus.projection, state: "stale", date: resolvedDate },
      goalies: { ...sourceStatus.goalies, state: "stale", date: resolvedDate, freshTeams: 0, staleTeams: 2 },
      degradedReasons: ["Upcoming slate uses older fixture source observations."] } : sourceStatus,
    coverage: {
      slateGames: 1,
      slateTeams: 2,
      projectionRows: allPlayers.length,
      renderedRows: allPlayers.length,
      goalieTeamsExpected: 2,
      goalieTeamsCovered: 2,
      yahooMappedPlayers: 33,
      yahooUnmappedPlayers: 1,
    },
  };
};

const installFixture = async (page: Page) => {
  await page.route("**/api/v1/start-chart?**", async (route) => {
    const url = new URL(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(apiFixture(url.searchParams.get("date") ?? "2026-02-07")),
    });
  });
};

const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 1024, height: 768 },
  { name: "mobile", width: 390, height: 844 },
  { name: "narrow mobile", width: 320, height: 568 },
] as const;

const yahooFixture = (teamId = "team-one", category?: string) => {
  const categories = teamId === "team-two";
  const incomplete = categories && !category;
  return { date: "2026-02-07", status: incomplete ? "incomplete" : "complete", teamId,
    teams: [{ id: "team-one", name: "Private Team One" }, { id: "team-two", name: "Private Team Two" }],
    teamName: categories ? "Private Team Two" : "Private Team One", leagueName: "Fixture League",
    mode: categories ? "categories" : "points", category: categories ? category ?? null : null,
    categoryOptions: ["GOALS", "SHOTS_ON_GOAL"], rosterFetchedAt: "2026-02-07T16:00:00Z",
    settingsFetchedAt: "2026-02-07T16:00:00Z", availabilityFetchedAt: "2026-02-07T16:00:00Z",
    roster: [{ id: "private-center", name: "Private Center", valueBasis: "unconditional" }],
    lineup: { status: incomplete ? "incomplete" : "complete", expectedValue: incomplete ? null : 5,
      assignments: [{ id: "C:0", position: "C", playerId: "private-center", value: incomplete ? null : 5, preserved: true }],
      limitations: incomplete ? ["Select a supported individual league category."] : [] },
    streamingCoverage: { playersChecked: 25, matchedToday: 1 },
    streaming: [{ playerId: "private-stream", name: "Tomorrow Goalie", availability: "free_agent", usableToday: false,
      incrementalValue: null, dropPlayerId: null,
      limitations: ["This league applies new acquisitions on the following day; they cannot improve today's lineup."] }],
    limitations: incomplete ? ["Select a supported individual league category."] : [],
  };
};

test.describe("/start-chart", () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.install({ time: new Date("2026-02-07T17:00:00Z") });
    await page.clock.setFixedTime(new Date("2026-02-07T17:00:00Z"));
    // Invented IDs exercise the placeholder without external network errors.
    await page.route("https://assets.nhle.com/mugs/**", (route) => route.fulfill({ status: 200, contentType: "image/png", body: Buffer.from("unavailable") }));
    await page.route("https://cms.nhl.bamgrid.com/**", (route) => route.fulfill({ status: 200, contentType: "image/png", body: Buffer.from("unavailable") }));
    await page.route("**/rest/v1/player_lineup_deployment_tallies?**", async (route) => {
      const playerId = new URL(route.request().url()).searchParams.get("player_id");
      const defense = playerId === "eq.8470301";
      await route.fulfill({ json: [
        { season_id: 20252026, deployment_group: defense ? "defense" : "forward",
          deployment_code: defense ? "D1_LD" : "F1_C", deployment_label: defense ? "Pair 1 left" : "Line 1 center",
          games: 8, total_games: 10, share: 0.8, last_game_date: "2026-02-06" },
        { season_id: 20252026, deployment_group: "power_play", deployment_code: "PP1", deployment_label: "PP1",
          games: 7, total_games: 10, share: 0.7, last_game_date: "2026-02-06" },
      ] });
    });
  });
  for (const [width, height] of [[1180, 757], [1024, 768], [768, 1024], [390, 844], [320, 844]]) {
    test(`preserves context and saved intent through news, research, slate and schedule at ${width}px`, async ({ page }) => {
      test.setTimeout(90_000);
      await page.setViewportSize({ width, height });
      const errors: string[] = [];
      page.on("pageerror", error => errors.push(error.message));
      const members: PlanningPlayer[] = [1, 2].map(id => ({
        id: `fhfh:${id}`, nhlId: id, name: id === 1 ? "Alpha Center" : "Bravo Center",
        teamAbbreviation: "MTL", eligiblePositions: ["C"], playerClass: "skater",
        availability: "unknown", ownership: null, canDrop: null, holdValue: null, reserveEligibility: [],
      }));
      const saved = defaultWorkspace(new Date("2026-02-07T17:00:00Z"));
      saved.context = { ...saved.context, seasonId: 20252026, startDate: "2026-02-09", endDate: "2026-02-11" };
      saved.manualPlayers = members;
      saved.roster = [{ playerId: members[0].id, position: "active" }];
      saved.intent = { ...saved.intent, revision: 4, protectedPlayerIds: [members[0].id], steps: [{
        id: "saved-add", type: "add", playerId: members[1].id, dropPlayerId: members[0].id,
        at: "2026-02-10T00:00:00Z", effectiveAt: "2026-02-10T00:00:00Z", conditional: true, dependsOn: [],
      }] };
      await page.addInitScript(workspace => {
        if (!localStorage.getItem("fhfh:rso:workspace:v1")) localStorage.setItem("fhfh:rso:workspace:v1", JSON.stringify(workspace));
      }, saved);
      const passage = "Alpha Center is out with a fixture injury.";
      const report = { id: "fixture-bound-report", headline: "Alpha Center fixture report", blurb: passage,
        category: "INJURY", subcategory: null, team_abbreviation: "MTL", source_label: "Fixture reporter",
        source_account: null, source_url: "https://example.com/fixture-report", published_at: "2026-02-07T16:00:00Z",
        created_at: "2026-02-07T16:01:00Z", observed_at: "2026-02-07T16:01:00Z", card_status: "published", players: [],
        metadata: { interpretation: { version: "fixture-v1", unresolved: [], events: [{ playerId: 1, playerName: "Alpha Center",
          kind: "injury", state: "ongoing", modality: "affirmative", availability: "out", evidence: { start: 0, end: passage.length, text: passage } }] } } };
      await page.route("**/_next/data/**/index.json*", route => route.fulfill({ json: { __N_SSP: true, pageProps: {
        initialGames: [], initialInjuries: [], initialStandings: [], nextGameDate: "2026-02-07", isOffseason: false,
        playoffsActive: false, playoffBracket: null, playoffSeasonYear: null, playoffWeekGames: [],
        homepageSnapshotGeneratedAt: "2026-02-07T16:01:00Z", standingsLoadError: null, injuriesLoadError: null,
        latestNews: [report], recentTransactions: [], recentInjuryNews: [report], homepagePlayerCount: 2,
        homepagePulsePoints: [], openingNightDate: null, openingNightStartTime: null, draftRankerHomepageEnabled: false,
      } } }));
      await page.route("**/_next/data/**/stats/player/1.json*", route => route.fulfill({ json: { __N_SSP: true, pageProps: {
        player: { id: 1, fullName: "Alpha Center", position: "C", team_id: 8, image_url: null }, gameLog: [], playoffGameLog: [],
        seasonTotals: [], isGoalie: false, availableSeasons: [], availableSeasonsFormatted: [], mostRecentSeason: 20252026,
        missedGames: [], lineupDeploymentTallies: [],
      } } }));
      await page.route("**/rest/v1/**", route => ["GET", "HEAD"].includes(route.request().method())
        ? route.fulfill({ json: [] }) : route.abort());
      await page.route("**/api/v1/games?**", route => route.fulfill({ json: [] }));
      await page.route("**/api/v1/season", route => route.fulfill({ json: {
        seasonId: 20252026, regularSeasonStartDate: "2025-10-01T00:00:00Z", regularSeasonEndDate: "2026-04-30T23:59:59Z",
        seasonEndDate: "2026-06-30T23:59:59Z", numberOfGames: 82, lastSeasonId: 20242025,
        lastRegularSeasonStartDate: "2024-10-01T00:00:00Z", lastRegularSeasonEndDate: "2025-04-30T23:59:59Z",
        lastSeasonEndDate: "2025-06-30T23:59:59Z", lastNumberOfGames: 82,
      } }));
      await page.route("**/api/v1/team/**", route => route.fulfill({ json: [] }));
      await page.route("**/api/v1/schedule/**", route => route.fulfill({ json: { data: {}, numGamesPerDay: [0, 0, 0, 0, 0, 0, 0] } }));
      await page.route("**/api/v1/roster-schedule-optimizer/data?**", route => route.fulfill({ json: { success: true, data: { players: members, games: [], forecasts: [], evidence: {} } } }));
      await page.route("**/api/v1/roster-schedule-optimizer/access", route => route.fulfill({ json: { data: { eligible: false, capabilities: [], grantingSources: [], expiresAt: null, reason: "manual" } } }));
      await page.route("**/api/v1/roster-schedule-optimizer/workspace?**", route => route.fulfill({ status: 401, json: { error: "unauthorized" } }));
      await installFixture(page);
      await page.goto("/404");
      await page.getByRole("button", { name: "Find a player", exact: true }).click();
      await expect(page.getByRole("dialog", { name: "Player search" })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog", { name: "Player search" })).not.toBeVisible();
      await page.getByRole("link", { name: "FHFH home", exact: true }).filter({ visible: true }).first().click();
      const injuryTable = page.getByRole("table", { name: "Recent NHL transactions and injury updates", exact: true });
      await expect(injuryTable).toContainText("Ongoing report");
      const research = injuryTable.getByRole("link", { name: "Alpha Center", exact: true });
      await expect(research).toHaveAttribute("href", "/stats/player/1");
      await research.click({ timeout: 20_000 });
      await expect(page).toHaveURL(/\/stats\/player\/1$/);
      await expect(page.getByRole("heading", { name: "Alpha Center", exact: true })).toBeVisible();
      const openTool = async (name: string) => {
        if (width < 1100) {
          await page.getByRole("button", { name: "Open menu", exact: true }).click();
          const dialog = page.getByRole("dialog", { name: "Site menu" });
          const tools = dialog.getByRole("button", { name: /^Tools(?: |$)/ });
          await expect(tools).toBeVisible();
          if (await tools.getAttribute("aria-expanded") !== "true") await tools.click({ timeout: 20_000 });
          await dialog.getByRole("link", { name: new RegExp(`^${name}(?: |$)`) }).click({ timeout: 20_000 });
        } else {
          const navigation = page.getByRole("navigation", { name: "Primary navigation", exact: true });
          await navigation.getByRole("button", { name: "Tools", exact: true }).click();
          await navigation.getByRole("link", { name: new RegExp(`^${name}(?: |$)`) }).click({ timeout: 20_000 });
        }
      };
      await openTool("Start Chart");
      await expect(page.getByRole("heading", { name: "Starter Board", exact: true })).toBeVisible();
      await page.getByLabel("Date", { exact: true }).fill("2026-02-08");
      await expect(page.getByRole("status").filter({ hasText: "Showing 2026-02-09, not 2026-02-08." })).toBeVisible();
      const schedule = page.getByRole("link", { name: /^Game Grid Compare/ });
      await expect(schedule).toHaveAttribute("href", "/game-grid/7-Day-Forecast?startDate=2026-02-09&endDate=2026-02-15");
      await schedule.click();
      await expect(page).toHaveURL(/startDate=2026-02-09&endDate=2026-02-15/);
      await expect(page.getByRole("heading", { name: /Game Grid/ }).first()).toBeVisible();
      await page.goBack();
      await expect(page.getByLabel("Date", { exact: true })).toHaveValue("2026-02-08");
      await page.goForward();
      await expect(page).toHaveURL(/startDate=2026-02-09&endDate=2026-02-15/);
      await expect(page.getByRole("heading", { name: /Game Grid/ }).first()).toBeVisible();
      await openTool("Roster Schedule Optimizer");
      await expect(page).toHaveURL(/\/roster-schedule-optimizer$/);
      await expect(page.getByRole("heading", { name: "Roster Schedule Optimizer", exact: true })).toBeVisible();
      await expect.poll(async () => page.evaluate(() => {
        const workspace = JSON.parse(localStorage.getItem("fhfh:rso:workspace:v1")!);
        return { intent: workspace.intent, roster: workspace.roster, rules: workspace.rules,
          startDate: workspace.context.startDate, endDate: workspace.context.endDate };
      })).toEqual({ intent: saved.intent, roster: saved.roster, rules: saved.rules, startDate: "2026-02-09", endDate: "2026-02-11" });
      expect(errors).toEqual([]);
    });
  }
  for (const width of [1180, 390]) {
    test(`recovers from a failed request into partial upcoming coverage at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 844 });
      const pageErrors: string[] = [];
      const contrastSamples: unknown[] = [];
      const captureTextColors = async (state: string, target: Locator) => {
        const samples = await target.evaluateAll((nodes, state) => nodes.filter(node => node.getClientRects().length).map(node => {
          const style = getComputedStyle(node);
          const backgrounds = [];
          for (let ancestor: Element | null = node; ancestor; ancestor = ancestor.parentElement) {
            const background = getComputedStyle(ancestor);
            backgrounds.push({ tag: ancestor.tagName, color: background.backgroundColor,
              image: background.backgroundImage, opacity: background.opacity, filter: background.filter,
              backdropFilter: background.backdropFilter, blendMode: background.mixBlendMode,
              before: { content: getComputedStyle(ancestor, "::before").content, background: getComputedStyle(ancestor, "::before").background },
              after: { content: getComputedStyle(ancestor, "::after").content, background: getComputedStyle(ancestor, "::after").background } });
          }
          return { state, text: node.textContent?.trim(), foreground: style.color,
            fontSize: style.fontSize, fontWeight: style.fontWeight, backgrounds };
        }), state);
        expect(samples.length).toBeGreaterThan(0);
        contrastSamples.push(...samples);
      };
      page.on("pageerror", error => pageErrors.push(error.message));
      let mode: "loading" | "error" | "partial" | "empty" = "loading";
      let release!: () => void;
      const loading = new Promise<void>(resolve => { release = resolve; });
      await page.route("**/api/v1/start-chart?**", async route => {
        if (mode === "loading") await loading;
        if (mode === "error") return route.fulfill({ status: 503, json: { error: { message: "Fixture source retrieval failed" } } });
        const requestedDate = new URL(route.request().url()).searchParams.get("date")!;
        const fixture = apiFixture(requestedDate);
        await route.fulfill({ json: { ...fixture, projections: 0, players: [], projectionRunId: null,
          games: mode === "empty" ? [] : fixture.games.map(game => ({ ...game, homeGoalies: [], awayGoalies: [] })),
          serving: { ...fixture.serving, mode: mode === "empty" ? "no_games" : "partial",
            message: mode === "empty" ? "No current or upcoming scheduled games are available." : fixture.serving.message },
          sourceStatus: { ...fixture.sourceStatus, projection: { ...fixture.sourceStatus.projection,
            state: "missing", date: fixture.resolvedDate, runId: null, modelVersion: null, inputVersion: null, updatedAt: null },
            goalies: { ...fixture.sourceStatus.goalies, state: "missing", date: fixture.resolvedDate, expectedTeams: mode === "empty" ? 0 : 2, coveredTeams: 0, freshTeams: 0, staleTeams: 0 } },
          coverage: { ...fixture.coverage, slateGames: mode === "empty" ? 0 : 1, slateTeams: mode === "empty" ? 0 : 2,
            projectionRows: 0, renderedRows: 0, goalieTeamsExpected: mode === "empty" ? 0 : 2, goalieTeamsCovered: 0 } } });
      });
      await page.goto("/start-chart?date=2026-02-08", { waitUntil: "domcontentloaded" });
      await expect(page.getByText("Loading games…")).toBeVisible();
      await page.screenshot({path:testInfo.outputPath("board-loading.png")});
      const status = page.getByRole("status", { name: "Starter Board status" });
      await expect(status).toContainText("Loading");
      const statusNode = await status.elementHandle();
      const loadingAccessibility = await status.ariaSnapshot();
      await captureTextColors("loading", status.locator("strong, :scope > span"));
      mode = "error";
      release();
      await expect(page.getByRole("alert").filter({ hasText: "Starter Board is unavailable." })).toBeVisible();
      await expect(status).toContainText("Unavailable");
      await expect(page.getByText("Slate unavailable", { exact: true })).toBeVisible();
      await expect(page.getByText("Games unavailable", { exact: true })).toBeVisible();
      await expect(page.getByText("Slate loading", { exact: true })).toHaveCount(0);
      await page.screenshot({path:testInfo.outputPath("board-error.png")});
      const errorAccessibility = await page.getByRole("alert").filter({ hasText: "Starter Board is unavailable." }).ariaSnapshot();
      await captureTextColors("error", page.getByRole("alert").filter({ hasText: "Starter Board is unavailable." }).locator("strong, span, p, button"));
      await captureTextColors("error-status", status.locator("strong, :scope > span"));
      const retry = page.getByRole("button", { name: "Retry", exact: true });
      const unfocusedShadow = await retry.evaluate(node => getComputedStyle(node).boxShadow);
      let tabSteps = 0;
      for (; tabSteps < 60 && !await retry.evaluate(node => document.activeElement === node); tabSteps++) {
        await page.keyboard.press("Tab");
      }
      await expect(retry).toBeFocused();
      const focusIndicator = await retry.evaluate(node => {
        const style = getComputedStyle(node);
        return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth,
          outlineColor: style.outlineColor, boxShadow: style.boxShadow };
      });
      expect((focusIndicator.outlineStyle !== "none" && parseFloat(focusIndicator.outlineWidth) > 0)
        || (focusIndicator.boxShadow !== "none" && focusIndicator.boxShadow !== unfocusedShadow)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath("board-retry-keyboard-focus.png") });
      mode = "partial";
      await page.keyboard.press("Enter");
      await expect(page.getByText("No player projections found.")).toBeVisible();
      await expect(status).toContainText("Upcoming slate");
      const upcomingAccessibility = await status.ariaSnapshot();
      await captureTextColors("partial-upcoming", status.locator("strong, :scope > span"));
      await captureTextColors("missing-projections", page.getByRole("status").filter({ hasText: "No player projections found." }).locator("strong, span, p"));
      await captureTextColors("applied-date", page.getByRole("status").filter({ hasText: "Showing 2026-02-09, not 2026-02-08." }).locator("strong, span, p"));
      expect(await status.evaluate((node, original) => node === original, statusNode)).toBe(true);
      await expect(page.getByText("Historical fallback", { exact: true })).toHaveCount(0);
      await expect(page.getByRole("status").filter({ hasText: "Showing 2026-02-09, not 2026-02-08." })).toBeVisible();
      await expect(page.getByText(/nearest earlier slate/)).toHaveCount(0);
      await expect(page.getByRole("link", { name: "7-day schedule from 2026-02-09" })).toHaveAttribute("href", "/game-grid/7-Day-Forecast?startDate=2026-02-09&endDate=2026-02-15");
      await page.screenshot({ path: testInfo.outputPath("board-partial-upcoming.png") });
      mode = "empty";
      await page.getByLabel("Date", { exact: true }).fill("2026-02-10");
      await expect(page.getByText("No games found.")).toBeVisible();
      await expect(status).toContainText("No scheduled games");
      await captureTextColors("empty", status.locator("strong, :scope > span"));
      await captureTextColors("empty-message", page.getByRole("status").filter({ hasText: "No games found." }).locator("strong, span"));
      await page.screenshot({ path: testInfo.outputPath("board-no-scheduled-games.png") });
      await expect(page.getByLabel("Date", { exact: true })).toHaveValue("2026-02-10");
      expect(pageErrors).toEqual([]);
      await expect(page.locator("[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay")).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await writeFile(testInfo.outputPath("board-keyboard-status.json"), JSON.stringify({ width, tabSteps,
        focusIndicator, contrastSamples, statusNodeRetained: true, recoveryStatus: "Upcoming slate", pageErrors,
        loadingAccessibility, errorAccessibility, upcomingAccessibility, emptyAccessibility: await status.ariaSnapshot(),
        noHorizontalOverflow: true, screenReaderSpeech: "not verified", inputs: "fictional API responses" }, null, 2));
    });
  }

  test("renders five-row previews and an interactive goals chart at reference sizes", async ({ page }, testInfo) => {
    const fixture = { ...apiFixture("2026-02-07"),
      players: positions.flatMap((position) => Array.from({ length: 5 }, (_, i) => player(position, i + 1))),
      recentGoals: { seasonId: 20252026, beforeDate: "2026-02-07", source: "nhl_final_scores", teams: [
        { team: "MTL", games: Array.from({ length: 10 }, (_, i) => ({ date: `2026-01-${20 - i}`, goalsFor: i < 5 ? 4 : 2, goalsAgainst: 2 })) },
        { team: "TOR", games: Array.from({ length: 10 }, (_, i) => ({ date: `2026-01-${20 - i}`, goalsFor: 2, goalsAgainst: 3 })) },
      ] },
    };
    fixture.games.push({ ...fixture.games[0], id: 1002, homeTeamId: 6, awayTeamId: 3, homeAbbrev: "BOS", awayAbbrev: "NYR" });
    await page.route("**/api/v1/start-chart?**", route => route.fulfill({ json: fixture }));
    for (const [width, height] of [[1440, 900], [1180, 757], [1024, 768], [768, 1024], [390, 844], [320, 844]]) {
      await page.setViewportSize({ width, height });
      await page.goto("/start-chart?date=2026-02-07&position=LW");
      expect(await page.evaluate(() => new Date().toISOString())).toBe("2026-02-07T17:00:00.000Z");
      await expect(page.getByRole("link", { name: "7-day schedule from 2026-02-07" })).toHaveAttribute("href", "/game-grid/7-Day-Forecast?startDate=2026-02-07&endDate=2026-02-13");
      await expect(page.getByRole("link", { name: /^Game Grid Compare/ })).toHaveAttribute("href", "/game-grid/7-Day-Forecast?startDate=2026-02-07&endDate=2026-02-13");
      await expect(page.locator("#start-chart-panel-LW ol > li")).toHaveCount(5);
      await expect(page.locator("#start-chart-panel-LW img").first()).toHaveAttribute("src", "/pictures/player-placeholder.jpg");
      await page.screenshot({ path: testInfo.outputPath(`preview-${width}.png`) });
      const chart = page.getByRole("img", { name: /Goals per game:/ });
      await expect(chart).toHaveAttribute("aria-label", /MTL, 10 games, GF 3.00/);
      await page.getByLabel("Team form window").selectOption("5");
      await expect(chart).toHaveAttribute("aria-label", /MTL, 5 games, GF 4.00/);
      if (width > 768) {
        const form = page.getByRole("region", { name: "Recent goals for and against" });
        if (width === 1440) expect((await form.boundingBox())!.y).toBeLessThan(height);
        if (width === 1180 || width === 1024) {
          const bounds = (await form.boundingBox())!;
          expect(bounds.y + bounds.height).toBeLessThanOrEqual(height);
          const preview = page.locator("#start-chart-panel-LW ol");
          expect(await preview.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
          await preview.locator(":scope > li").last().scrollIntoViewIfNeeded();
          await expect(preview.locator(":scope > li").last()).toBeVisible();
        }
        await form.scrollIntoViewIfNeeded();
        await expect(form).toBeVisible();
      } else {
        await page.getByRole("navigation", { name: "Board panels" }).getByRole("button", { name: "Settings" }).click();
        await expect(page.getByRole("button", { name: "Apply scoring" })).toBeVisible();
        const scoringSummary = page.locator("#board-settings > summary");
        await scoringSummary.focus();
        await page.keyboard.press("Tab");
        const goalsInput = page.getByRole("spinbutton", { name: "GOALS", exact: true });
        await expect(goalsInput).toBeFocused();
        await expect(goalsInput).toHaveCSS("outline-style", "solid");
        await expect(goalsInput).toHaveCSS("outline-width", "2px");
        const rail = page.locator("#slate-games > div").last();
        if (width <= 390) expect(await rail.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
        await page.locator("#start-chart-panel-LW ol > li").last().scrollIntoViewIfNeeded();
        const bottom = (await page.locator("#start-chart-panel-LW ol > li").last().boundingBox())!;
        expect(bottom.y + bottom.height).toBeLessThan(width <= 390 ? height - 70 : height + 1);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    }
  });

  for (const width of [1440, 390]) {
    test(`protects the private Yahoo comparison through selection, errors and sign-out at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.route("**/api/**", route => route.fulfill({ json: [] }));
      await page.route("**/auth/v1/**", route => route.fulfill({ status: 204 }));
      await installDraftProAuthenticatedFixtures(page, () => ({ access: {
        eligible: true, grantingSources: ["purchase"], expiresAt: null, verifiedAt: null, nextVerificationAt: null,
        reason: "eligible", capabilities: ["recommendations"], providerReadiness: { stripe: false, patreon: false, yahoo: true },
      } }));
      const storageKey = `sb-${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "https://fyhftlxokyjtpndbkfse.supabase.co").hostname.split(".")[0]}-auth-token`;
      await page.addInitScript(key => {
        const fictionalSession = localStorage.getItem("sb-127-auth-token");
        if (fictionalSession) localStorage.setItem(key, fictionalSession);
      }, storageKey);
      await installFixture(page);
      let responseMode: "ready" | "denied" | "expired" | "pending" = "ready";
      const requests: Array<{ teamId?: string; category?: string }> = [];
      let releasePending!: () => void;
      const pending = new Promise<void>(resolve => { releasePending = resolve; });
      await page.route("**/api/v1/account/yahoo/starter-board", async route => {
        expect(route.request().method()).toBe("POST");
        const args = route.request().postDataJSON();
        requests.push(args);
        const mode = responseMode;
        if (mode === "pending") await pending;
        if (mode === "denied" || mode === "expired") {
          await route.fulfill({ status: mode === "denied" ? 403 : 401,
            json: { error: mode === "denied" ? "Draft Pro access is required." : "Yahoo connection expired. Reconnect Yahoo." } });
        } else {
          const response = { headers: { "Cache-Control": "private, no-store" }, json: { data: yahooFixture(args.teamId, args.category) } };
          // Sign-out deliberately aborts the pending request; a late response
          // must not restore private data even if its server work completes.
          if (mode === "pending") await route.fulfill(response).catch(() => undefined);
          else await route.fulfill(response);
        }
      });
      await page.goto("/start-chart?date=2026-02-07&position=C");
      const summary = page.getByText("My Yahoo team · Today · Draft Pro", { exact: true });
      await expect(summary).toBeVisible();
      await summary.click();
      const panel = page.locator("details").filter({ has: summary });
      const refresh = panel.getByRole("button", { name: "Refresh today’s comparison" });
      await refresh.click();
      await expect(panel.getByText(/C: Private Center.*Current position preserved/)).toBeVisible();
      await expect(panel.getByText(/Tomorrow Goalie.*Today’s gain unavailable/)).toBeVisible();
      await expect(panel.getByText(/This league applies new acquisitions on the following day/)).toBeVisible();
      expect(requests[0]).toEqual({});
      await panel.getByRole("combobox", { name: "Team", exact: true }).selectOption("team-two");
      await refresh.click();
      await expect(panel.getByRole("heading", { name: "Incomplete lineup comparison" })).toBeVisible();
      await panel.getByRole("combobox", { name: "Individual category", exact: true }).selectOption("GOALS");
      await refresh.click();
      await expect(panel.getByRole("heading", { name: "Highest projected value for today’s eligible slots" })).toBeVisible();
      expect(requests.at(-1)).toEqual({ teamId: "team-two", category: "GOALS" });
      expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
      for (const mode of ["denied", "expired"] as const) {
        responseMode = mode;
        await refresh.click();
        await expect(panel.getByRole("alert")).toContainText(mode === "denied" ? "Draft Pro access is required." : "Yahoo connection expired.");
        await expect(panel.getByText(/C: Private Center/)).toHaveCount(0);
      }
      responseMode = "ready";
      await refresh.click();
      await expect(panel.getByText(/C: Private Center/)).toBeVisible();
      responseMode = "pending";
      const before = requests.length;
      await refresh.click();
      await expect.poll(() => requests.length).toBe(before + 1);
      await page.evaluate(() => window.scrollTo(0, 0));
      if (width === 1440) {
        await page.getByRole("button", { name: "Open account menu" }).click();
        await page.getByRole("menuitem", { name: "Sign Out" }).click();
      } else {
        await page.getByRole("button", { name: "Open menu", exact: true }).click();
        await page.getByRole("button", { name: "Sign Out", exact: true }).click();
      }
      releasePending();
      await expect(page.getByRole("link", { name: "Sign in and connect Yahoo" })).toBeVisible();
      await expect(summary).toHaveCount(0);
      await expect(page.getByText(/C: Private Center/)).toHaveCount(0);
      await expect(page.getByText(/Tomorrow Goalie/)).toHaveCount(0);
    });
  }
  for (const width of [1440, 390]) {
    test(`refreshes revisions after stale responses and background return at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.clock.install({ time: new Date("2026-02-07T16:00:00Z") });
      let revision = 1, requests = 0, staleResponses = 0;
      const id = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
      await page.route("**/api/v1/start-chart?**", async (route) => {
        requests++;
        const delivered = staleResponses > 0 ? (staleResponses--, 1) : revision;
        const fixture = apiFixture("2026-02-07");
        await route.fulfill({ json: { ...fixture, contractVersion: 2,
          gameRevisions: [{ gameId: 1001, revisionId: id(delivered), runId: `run-${delivered}`,
            decisionAsOf: "2026-02-07T15:00:00Z", publishedAt: "2026-02-07T16:00:00Z" }],
          players: fixture.players.map((row, index) => index === 0 ? { ...row, name: `Revision ${delivered} Skater` } : row),
        } });
      });
      await page.goto("/start-chart?date=2026-02-07&position=C");
      const marker = page.locator("[data-board-revisions]");
      await expect(marker).toHaveAttribute("data-board-revisions", JSON.stringify([id(1)]));
      revision = 2;
      staleResponses = 1;
      const before = requests;
      await page.clock.runFor(31_000);
      await expect.poll(() => requests).toBeGreaterThan(before);
      await expect(marker).toHaveAttribute("data-board-revisions", JSON.stringify([id(1)]));
      await page.clock.runFor(31_000);
      await expect(marker).toHaveAttribute("data-board-revisions", JSON.stringify([id(2)]));
      await expect(page.getByRole("link", { name: /Revision 2 Skater/ }).first()).toBeVisible();

      // Controlled lifecycle signals exercise SWR's visibility/focus handling;
      // this is not a deployed browser/cache latency measurement.
      await page.evaluate(() => {
        Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
        document.dispatchEvent(new Event("visibilitychange"));
      });
      revision = 3;
      const beforeHidden = requests;
      await page.clock.runFor(60_000);
      expect(requests).toBe(beforeHidden);
      await expect(marker).toHaveAttribute("data-board-revisions", JSON.stringify([id(2)]));
      await page.evaluate(() => {
        Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
        document.dispatchEvent(new Event("visibilitychange"));
        window.dispatchEvent(new Event("focus"));
      });
      await page.clock.runFor(1000);
      await expect(marker).toHaveAttribute("data-board-revisions", JSON.stringify([id(3)]));
      await expect(page.getByRole("link", { name: /Revision 3 Skater/ }).first()).toBeVisible();
    });
  }
  for (const width of [1440, 390]) {
    test(`re-scores published forecasts and shows participation limits at ${width}px`, async ({ page }, testInfo) => {
      let forecastRequests = 0;
      const skater = (id: number, goals: number, shots: number) => ({ ...player("C", id),
        forecast: { conditioning: "conditional_playing", participationProbability: null, probabilityStatus: "missing",
          conditional: { GOALS: goals, ASSISTS: 0, PP_POINTS: 0, SHOTS_ON_GOAL: shots, HITS: 0, BLOCKED_SHOTS: 0 },
          expected: null, distributionStatus: "means_only_unvalidated", evidence: [], conflicts: [],
          seasonBootstrap: { version: "season-bootstrap-v1", currentSeasonGames: 0, historyGames: 20,
            transitionGames: 20, sourceIds: ["ag_skaters"], fantasyWeight: 0.6, historyWeight: 0.4,
            validation: "unvalidated", limitations: [] } },
      });
      const goalie = (id: number, probability: number, saves: number) => ({ ...player("G", id),
        start_probability: probability, forecast: boardGoalieForecast({ startingProbability: probability,
          conditional: { SHOTS_AGAINST_GOALIE: saves + 2, SAVES_GOALIE: saves, GOALS_AGAINST_GOALIE: 2, WINS_GOALIE: 0.5, SHUTOUTS_GOALIE: 0.1 } }),
      });
      await page.setViewportSize({ width, height: 900 });
      await page.route("**/api/v1/start-chart?**", async (route) => {
        forecastRequests += 1;
        await route.fulfill({ json: { ...apiFixture("2026-02-07"), contractVersion: 2,
          validation: width === 390 ? buildBoardValidationDisclosure({ startedOn: "2026-10-01", liveRegularSlates: 24 }, "2026-10-31")
            : { status: "awaiting_prospective_evidence" },
          gameRevisions: [{ gameId: 1001, revisionId: "00000000-0000-4000-8000-000000000001", runId: "run-e2e",
            decisionAsOf: "2026-02-07T15:00:00Z", publishedAt: "2026-02-07T16:00:00Z" }],
          players: [skater(1, 2, 1), skater(2, 0, 8), goalie(1, 0.8, 15), goalie(2, 0.6, 35)],
          newsStatus: { available: true, pendingGames: 0, freshnessBreachedGames: 0, unresolvedConflicts: 0, oldestAcceptedAt: null },
        } });
      });
      await page.goto("/start-chart?date=2026-02-07&position=C");
      await expect(page.locator("[data-board-revisions]")).toHaveAttribute("data-board-revisions", '["00000000-0000-4000-8000-000000000001"]');
      await page.getByText("Early validation · FORGE retained pending review", { exact: true }).click();
      if (width === 390) {
        await expect(page.getByText(/day 31 · 24 live slates observed/)).toBeVisible();
        await expect(page.getByText(/Day 30 review · 2026-10-30 · due/)).toBeVisible();
        await expect(page.getByText("Settled evaluation counts are not yet available.")).toBeVisible();
      } else {
        await expect(page.getByText(/Regular-season validation start and settled sample counts are not yet available/)).toBeVisible();
      }
      const cPanel = page.locator("#start-chart-panel-C");
      await expect(cPanel.locator("ol > li").first()).toContainText("C Player 1");
      await expect(cPanel.locator("ol > li").first()).toContainText("FP if playing");
      await page.getByLabel("Compare", { exact: true }).selectOption("categories");
      await expect(cPanel.locator("ol > li").first()).toContainText("C Player 2");
      await page.getByLabel("Compare", { exact: true }).selectOption("points");
      await page.getByText("More Filters", { exact: true }).click();
      await page.getByText("Scoring profile · customize points", { exact: true }).click();
      await page.locator('input[name="skater.GOALS"]').fill("0");
      await page.locator('input[name="skater.SHOTS_ON_GOAL"]').fill("1");
      await page.getByRole("button", { name: "Apply scoring" }).click();
      await expect(cPanel.locator("ol > li").first()).toContainText("C Player 2");
      await cPanel.getByText("Projection details and evidence", { exact: true }).first().click();
      await expect(cPanel.getByText("Participation probability unavailable. This is not an unconditional expectation.").first()).toBeVisible();
      await expect(cPanel.getByText(/Season-opening prior: 20 previous-season games/).first()).toBeVisible();
      await expect(cPanel.getByText(/Starting weights are uncalibrated/).first()).toBeVisible();
      await page.getByLabel("Goalie order").selectOption("fantasy");
      if (width < 1200) await page.getByRole("tab", { name: /^G 2$/ }).click();
      const gPanel = page.locator("#start-chart-panel-G");
      await expect(gPanel.locator("ol > li").first()).toContainText("G Player 2");
      await page.getByLabel("Goalie order").selectOption("start_probability");
      await expect(gPanel.locator("ol > li").first()).toContainText("G Player 1");
      expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
      await page.screenshot({ path: testInfo.outputPath("starter-board.png"), fullPage: true });
      if (width === 1440) {
        const requestsBeforeRefresh = forecastRequests;
        await expect.poll(() => forecastRequests, { timeout: 40_000 }).toBeGreaterThan(requestsBeforeRefresh);
      }
    });
  }
  for (const viewport of viewports) {
    test(`completes the board workflow at ${viewport.width}x${viewport.height}`, async ({
      page,
    }, testInfo) => {
      const browserErrors: string[] = [];
      page.on("pageerror", (error) => browserErrors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") browserErrors.push(message.text());
      });
      await page.setViewportSize(viewport);
      await installFixture(page);
      await page.goto("/start-chart?date=2026-02-07&position=C&mode=tonight");

      await expect(page.getByRole("heading", { name: "Starter Board" })).toBeVisible();
      const cPanel = page.locator("#start-chart-panel-C");
      await expect(cPanel.locator("ol").first().locator(":scope > li")).toHaveCount(5);

      const firstCard = cPanel.locator("ol > li").first();
      const headshot = firstCard.getByRole("img", { name: /headshot/ });
      await expect(headshot).toHaveAttribute("src", "/pictures/player-placeholder.jpg");
      expect(await headshot.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
      const rail = await cPanel.evaluate((panel) => ({ column: getComputedStyle(panel, "::before").width, row: getComputedStyle(panel.querySelector("ol > li")!, "::before").display }));
      expect(rail).toEqual({ column: "4px", row: "none" });
      if (viewport.width === 1440 || viewport.width === 390) {
        await page.screenshot({ path: testInfo.outputPath("starter-board-initial.png") });
      }

      const disclosure = firstCard.locator("summary");
      await disclosure.focus();
      await page.keyboard.press("Enter");
      const deployment = firstCard.getByRole("region", { name: "Lineup deployment" });
      await expect(deployment).toBeVisible();
      await expect(deployment.getByText("Forwards", { exact: true })).toBeVisible();
      await expect(deployment.getByText("Defense", { exact: true })).toHaveCount(0);
      await expect(deployment.getByText("80%", { exact: true })).toBeVisible();
      const cardBox = (await firstCard.boundingBox())!;
      const gridBox = (await deployment.boundingBox())!;
      expect(gridBox.x).toBeGreaterThanOrEqual(cardBox.x);
      expect(gridBox.x + gridBox.width).toBeLessThanOrEqual(cardBox.x + cardBox.width);
      await page.keyboard.press("Enter");
      await expect(firstCard.locator("details")).not.toHaveAttribute("open", "");

      if (viewport.width < 1200) await page.getByRole("tab", { name: /^D 1$/ }).click();
      const defenseCard = page.locator("#start-chart-panel-D ol > li").first();
      await defenseCard.locator("summary").click();
      await expect(defenseCard.getByText("Defense", { exact: true })).toBeVisible();
      await expect(defenseCard.getByText("Forwards", { exact: true })).toHaveCount(0);
      if (viewport.width < 1200) await page.getByRole("tab", { name: /^C 30$/ }).click();

      if (viewport.width >= 1200) {
        for (const position of positions) {
          await expect(page.locator(`#start-chart-panel-${position}`)).toBeVisible();
        }
      } else {
        const cTab = page.getByRole("tab", { name: /^C 30$/ });
        await expect(cTab).toBeVisible();
        await cTab.press("ArrowRight");
        await expect(page.getByRole("tab", { name: /^D 1$/ })).toHaveAttribute(
          "aria-selected",
          "true",
        );
        await expect(page.locator("#start-chart-panel-D")).toBeVisible();
        await expect(page).toHaveURL(/(?:\?|&)position=D(?:&|$)/);
        await cTab.click();
      }

      await cPanel.getByRole("button", { name: "View all C (30)" }).click();
      await expect(cPanel.locator("ol").first().locator(":scope > li")).toHaveCount(30);
      await page.getByLabel("Player", { exact: true }).fill("C Player 30");
      await expect(cPanel.locator("ol").first().locator(":scope > li")).toHaveCount(1);
      await page.getByLabel("Player", { exact: true }).fill("");
      await expect(cPanel.locator("ol").first().locator(":scope > li")).toHaveCount(5);

      await page.getByLabel("Date").fill("2026-02-08");
      await expect(page.getByRole("status").filter({ hasText: "Showing 2026-02-09, not 2026-02-08." })).toContainText(
        "Showing 2026-02-09, not 2026-02-08.",
      );
      await expect(page).toHaveURL(/(?:\?|&)date=2026-02-08(?:&|$)/);
      const commandCenterHref = await page
        .getByRole("link", { name: /FORGE Command Center/ })
        .getAttribute("href");
      expect(commandCenterHref).toContain("date=2026-02-08");
      expect(commandCenterHref).toContain("resolvedDate=2026-02-09");
      expect(commandCenterHref).toContain("mode=tonight");
      const playerResearchHref = await cPanel.locator('a[href^="/forge/player/"]').first().getAttribute("href");
      const playerResearchUrl = new URL(playerResearchHref!, "https://fhfh.local");
      expect(playerResearchUrl.searchParams.get("date")).toBe("2026-02-08");
      expect(playerResearchUrl.searchParams.get("resolvedDate")).toBe("2026-02-09");
      expect(playerResearchUrl.searchParams.get("mode")).toBe("tonight");
      expect([...playerResearchUrl.searchParams.keys()]).toEqual(["date", "resolvedDate", "mode"]);
      const teamResearchHref = await cPanel.locator('a[href^="/forge/team/"]').first().getAttribute("href");
      const teamResearchUrl = new URL(teamResearchHref!, "https://fhfh.local");
      expect(teamResearchUrl.searchParams.get("date")).toBe("2026-02-08");
      expect(teamResearchUrl.searchParams.get("resolvedDate")).toBe("2026-02-09");
      expect([...teamResearchUrl.searchParams.keys()]).toEqual(["date", "resolvedDate"]);
      await expect(page.getByText(/Player research links retain slate date and mode; team research links retain slate date/)).toBeVisible();

      const hasHorizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(hasHorizontalOverflow).toBe(false);
      expect(browserErrors).toEqual([]);
    });
  }
});
