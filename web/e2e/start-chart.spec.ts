import { expect, test, type Page } from "@playwright/test";

const positions = ["C", "LW", "RW", "D", "G"] as const;

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

test.describe("/start-chart", () => {
  for (const viewport of viewports) {
    test(`completes the board workflow at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
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
      await expect(cPanel.locator("ol").first().locator(":scope > li")).toHaveCount(25);

      if (viewport.width >= 1200) {
        for (const position of positions) {
          await expect(page.locator(`#start-chart-panel-${position}`)).toBeVisible();
        }
      } else {
        const cTab = page.getByRole("tab", { name: /^C 30$/ });
        await expect(cTab).toBeVisible();
        await cTab.press("ArrowRight");
        await expect(page.getByRole("tab", { name: /^LW 1$/ })).toHaveAttribute(
          "aria-selected",
          "true",
        );
        await expect(page.locator("#start-chart-panel-LW")).toBeVisible();
        await expect(page).toHaveURL(/(?:\?|&)position=LW(?:&|$)/);
        await cTab.click();
      }

      await cPanel.getByRole("button", { name: "Load 25 more C" }).click();
      await expect(cPanel.locator("ol").first().locator(":scope > li")).toHaveCount(30);
      await page.getByLabel("Player").fill("C Player 30");
      await expect(cPanel.locator("ol").first().locator(":scope > li")).toHaveCount(1);
      await page.getByLabel("Player").fill("");
      await expect(cPanel.locator("ol").first().locator(":scope > li")).toHaveCount(25);

      await page.getByLabel("Date").fill("2026-02-08");
      await expect(page.getByRole("status")).toContainText(
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
