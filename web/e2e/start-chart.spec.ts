import { expect, test, type Page } from "@playwright/test";
import { loadEnvConfig } from "@next/env";
import { boardGoalieForecast } from "../lib/projections/starterBoardScoring";
import { buildBoardValidationDisclosure } from "../lib/projections/starterBoardValidation";
import { installDraftProAuthenticatedFixtures } from "./draft-pro-fixtures";

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
  const allPlayers = [
    ...Array.from({ length: 30 }, (_, index) => player("C", index + 1)),
    player("LW", 1),
    player("RW", 1),
    player("D", 1),
    player("G", 1),
  ];
  return {
    dateUsed: "2026-02-07",
    date: "2026-02-07",
    resolvedDate: "2026-02-07",
    requestedDate,
    fallbackApplied: fallback,
    serving: {
      requestedDate,
      resolvedDate: "2026-02-07",
      fallbackApplied: fallback,
      isSameDay: !fallback,
      state: fallback ? "fallback" : "same_day",
      strategy: fallback ? "previous_date_with_games" : "requested_date",
      gapDays: fallback ? 1 : 0,
      severity: fallback ? "warn" : "none",
      status: fallback ? "fallback_recent" : "requested_date",
      message: fallback
        ? "Using the nearest earlier same-season slate with canonical projections."
        : null,
      requestedScheduledGames: fallback ? 0 : 1,
      resolvedScheduledGames: 1,
      requestedHadGames: !fallback,
      resolvedHadGames: true,
      mode: fallback ? "fallback" : "exact",
      reason: fallback ? "requested_date_has_no_games" : null,
      ageDays: fallback ? 1 : 0,
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
        date: "2026-02-07",
        startTime: "2026-02-08T00:00:00Z",
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
            is_stale: false,
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
            is_stale: false,
          },
        ],
      },
    ],
    sourceStatus,
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
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
      await page.goto("/start-chart?date=2026-02-07&position=LW");
      await expect(page.locator("#start-chart-panel-LW ol > li")).toHaveCount(5);
      await expect(page.locator("#start-chart-panel-LW img").first()).toHaveAttribute("src", "/pictures/player-placeholder.jpg");
      await page.screenshot({ path: testInfo.outputPath(`preview-${width}.png`) });
      const chart = page.getByRole("img", { name: /Goals per game:/ });
      await expect(chart).toHaveAttribute("aria-label", /MTL, 10 games, GF 3.00/);
      await page.getByLabel("Team form window").selectOption("5");
      await expect(chart).toHaveAttribute("aria-label", /MTL, 5 games, GF 4.00/);
      if (width === 1440) {
        expect((await page.getByRole("region", { name: "Recent goals for and against" }).boundingBox())!.y).toBeLessThan(900);
      } else {
        await page.getByRole("navigation", { name: "Board panels" }).getByRole("button", { name: "Settings" }).click();
        await expect(page.getByRole("button", { name: "Apply scoring" })).toBeVisible();
        const rail = page.locator("#slate-games > div").last();
        expect(await rail.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
        await page.locator("#start-chart-panel-LW ol > li").last().scrollIntoViewIfNeeded();
        const bottom = (await page.locator("#start-chart-panel-LW ol > li").last().boundingBox())!;
        expect(bottom.y + bottom.height).toBeLessThan(774);
      }
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
      await expect(page.getByRole("status").filter({ hasText: "Showing 2026-02-07, not 2026-02-08." })).toContainText(
        "Showing 2026-02-07, not 2026-02-08.",
      );
      await expect(page).toHaveURL(/(?:\?|&)date=2026-02-08(?:&|$)/);
      const commandCenterHref = await page
        .getByRole("link", { name: /FORGE Command Center/ })
        .getAttribute("href");
      expect(commandCenterHref).toContain("date=2026-02-08");
      expect(commandCenterHref).toContain("resolvedDate=2026-02-07");
      expect(commandCenterHref).toContain("mode=tonight");

      const hasHorizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(hasHorizontalOverflow).toBe(false);
      expect(browserErrors).toEqual([]);
    });
  }
});
