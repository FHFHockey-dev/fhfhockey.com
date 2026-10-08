import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { makeSyntheticDiagnosticReport } from "../lib/forecast-diagnostics/fixtures";
import { forecastDiagnosticsJson, forecastDiagnosticsMarkdown, type ForecastDiagnosticsReport } from "../lib/forecast-diagnostics/contract";
import { buildNativeTeamGoalAccounting, buildNativeRosterContributorCoverage } from "../lib/projections/nativeGoalAccounting";

const endpoint = "**/api/internal/forecast-diagnostics?*";

async function open(page: Page, report = makeSyntheticDiagnosticReport()) {
  // Keep this suite independent of hosted auth/database reads, including layout requests.
  await page.route(/https:\/\/[^/]+\.supabase\.(co|in)\//, route => route.abort());
  await page.route(endpoint, route => route.fulfill({ json: report }));
  await page.goto("/db/forecast-diagnostics");
  await expect(page.getByRole("heading", { name: "Forecast diagnostics", exact: true })).toBeVisible();
  return report;
}

async function fill(page: Page, report: ForecastDiagnosticsReport) {
  await page.getByRole("spinbutton", { name: "Game ID" }).fill(String(report.scope.gameId));
  await page.getByRole("textbox", { name: "Cutoff (ISO with timezone)" }).fill(report.scope.cutoffAt);
}

async function load(page: Page, report: ForecastDiagnosticsReport) {
  await fill(page, report);
  await page.getByRole("button", { name: "Load diagnostics", exact: true }).click();
  await expect(page.getByLabel("Loaded diagnostic report", { exact: true })).toBeVisible();
}

test("desktop keyboard submission and exact JSON / Markdown downloads", async ({ page }) => {
  const report = await open(page);
  await fill(page, report);
  const requested = page.waitForRequest(endpoint);
  await page.getByRole("textbox", { name: "Cutoff (ISO with timezone)" }).press("Enter");
  const request = await requested;
  expect(request.method()).toBe("GET");
  expect(new URL(request.url()).searchParams.get("gameId")).toBe(String(report.scope.gameId));
  expect(new URL(request.url()).searchParams.get("cutoffAt")).toBe(report.scope.cutoffAt);
  await expect(page.getByText("Synthetic fixture", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Loaded scope" })).toBeVisible();
  await expect(page.getByText(report.forecastSetId, { exact: true })).toBeVisible();
  const comparisons = page.getByRole("table", { name: "Goals for this game" });
  await expect(comparisons).toContainText(report.comparisons[0].abbreviation);
  await expect(page.getByRole("table", { name: "Legacy versus verified exposure" })).toContainText(String(report.exposure[0].actualLastFiveCount));
  for (const [label, extension, expected] of [
    ["Export JSON", "json", forecastDiagnosticsJson(report)],
    ["Export Markdown", "md", forecastDiagnosticsMarkdown(report)],
  ]) {
    const downloading = page.waitForEvent("download");
    await page.getByRole("button", { name: label, exact: true }).click();
    const download = await downloading;
    expect(download.suggestedFilename()).toBe(`forecast-diagnostics-${report.scope.gameId}.${extension}`);
    const path = await download.path();
    expect(path).not.toBeNull();
    expect(await readFile(path!, "utf8")).toBe(expected);
  }
});

test("mobile tables stay contained and definitions / lineage / exclusions open by keyboard", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const report = await open(page);
  await load(page, report);
  const summary = page.locator("summary").filter({ hasText: `${report.comparisons[0].abbreviation} FORGE definitions` });
  await summary.focus();
  await summary.press("Enter");
  await expect(page.getByText("Mean semantics / appearance probability", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("table", { name: "Player participation accounting" }).first()).toBeVisible();
  await expect(page.getByRole("table", { name: "Source lineage and cutoff availability" }).first()).toBeVisible();
  const excluded = page.locator("summary").filter({ hasText: `${report.exposure[0].abbreviation} accepted games` });
  await excluded.click();
  await expect(excluded.locator("..")).toContainText("Accepted game IDs:");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("loading a new scope disables stale exports and a superseded response cannot replace it", async ({ page }) => {
  const report = await open(page);
  await load(page, report);
  let release: () => void = () => {};
  const delayed = new Promise<void>(resolve => { release = resolve; });
  let markStarted: () => void = () => {};
  const started = new Promise<void>(resolve => { markStarted = resolve; });
  let count = 0;
  const latest = { ...report, forecastSetId: "latest-set" };
  await page.route(endpoint, async route => {
    count += 1;
    if (count === 1) {
      markStarted();
      await delayed;
      await route.fulfill({ json: { ...report, forecastSetId: "superseded-set" } }).catch(() => {});
    } else await route.fulfill({ json: latest });
  });
  await page.getByRole("button", { name: "Load diagnostics", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Loading diagnostics" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Export JSON", exact: true })).toBeDisabled();
  await expect(page.getByLabel("Loaded diagnostic report", { exact: true })).toHaveCount(0);
  await started;
  await page.getByRole("button", { name: "Load another scope", exact: true }).click();
  await expect(page.getByText("latest-set", { exact: true })).toBeVisible();
  release();
  await expect(page.getByText("superseded-set", { exact: true })).toHaveCount(0);
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON", exact: true }).click();
  const path = await (await downloading).path();
  expect(await readFile(path!, "utf8")).toBe(forecastDiagnosticsJson(latest));
});

test("empty retained evidence is explicit and remains exportable", async ({ page }) => {
  const report: ForecastDiagnosticsReport = { ...makeSyntheticDiagnosticReport(), evidenceKind: "retained_records", comparisons: [], exposure: [], sources: [], replay: { status: "not_verified", blockers: ["missing_retained_forecast"] } };
  await open(page, report);
  await load(page, report);
  await expect(page.getByText("No retained forecast bases for this scope. Comparable estimates are Unavailable.")).toBeVisible();
  await expect(page.getByText("No team-game exposure retained.")).toBeVisible();
  await expect(page.getByText("Synthetic fixture", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Replay: not_verified" })).toBeVisible();
  await expect(page.getByText("missing_retained_forecast", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Export JSON", exact: true })).toBeEnabled();
});

test("partial incompatible bases show raw values, Unavailable comparisons and exposure", async ({ page }) => {
  const report = makeSyntheticDiagnosticReport();
  report.comparisons = [{ ...report.comparisons[0], status: "incompatible", forgeMean: 9, teamMean: 8, difference: 1, reasons: ["incomplete_goal_coverage"] }];
  report.comparisons[0].forge!.coverage = "partial";
  report.comparisons[0].forge!.nativeGoalAccounting = buildNativeTeamGoalAccounting({
    gameId: report.scope.gameId, teamId: report.comparisons[0].teamId, asOfDate: report.scope.gameDate,
    horizonGames: 1, currentRosterPlayerIds: [100, 101, 102], playerRows: [{ player_id: 100,
      game_id: report.scope.gameId, team_id: report.comparisons[0].teamId, as_of_date: report.scope.gameDate,
      horizon_games: 1, proj_goals_es: 0.4, proj_goals_pp: 0.2, proj_goals_pk: null }],
  });
  report.comparisons[0].forge!.nativeRosterContributorCoverage = buildNativeRosterContributorCoverage({
    gameId: report.scope.gameId, teamId: report.comparisons[0].teamId,
    currentRosterPlayerIds: [100, 101, 102], projectedPlayerIds: [100], selection: {
      candidatePlayerIds: [100], eligiblePlayerIds: [100], unavailablePlayerIds: [], knownGoaliePlayerIds: [101],
      playerMetaById: new Map([[100, { team_id: report.comparisons[0].teamId, position: "C" }]]),
      excludedPlayerIds: { teamOrPosition: [], missingRecentMetrics: [], hardStale: [], invalidSeasonEvidence: [] },
      compute: true, evidence: { assertions: [], conflicts: [] },
    },
  });
  report.exposure[0].coverage = "partial";
  report.exposure[0].correctedTotals = { gp: null, gf: null, ga: null };
  await open(page, report);
  await load(page, report);
  const cells = page.getByRole("table", { name: "Goals for this game" }).locator("tbody tr").first().locator("td");
  await expect(cells.nth(0)).toHaveText(String(report.comparisons[0].forge!.rawMean));
  for (const index of [2, 3, 4]) await expect(cells.nth(index)).toHaveText("Unavailable");
  await expect(page.getByRole("table", { name: "Legacy versus verified exposure" })).toContainText("Unavailable / Unavailable / Unavailable");
  await expect(page.getByText("Alignment reasons: incomplete_goal_coverage")).toBeVisible();
  await page.locator("summary").filter({ hasText: `${report.comparisons[0].abbreviation} FORGE definitions` }).click();
  await expect(page.getByRole("heading", { name: "Partial native goal accounting" })).toBeVisible();
  await expect(page.getByText(/Reported player ES\/PP bucket sum: 0\.6/)).toBeVisible();
  await expect(page.getByText(/Full official-play mean: Unavailable/)).toBeVisible();
  const selection = page.getByRole("table", { name: "Native roster selection and unknown goal contributions" });
  await expect(selection).toContainText("outside_candidate_pool");
  await expect(selection).toContainText("goalie_appearance_and_offensive_credit_unproved");
  await expect(selection.locator("tbody tr")).toHaveCount(3);
  await page.setViewportSize({ width: 390, height: 844 });
  const scroller = page.getByLabel(`${report.comparisons[0].abbreviation} FORGE native roster selection table`);
  await scroller.focus();
  await expect(scroller).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  for (const [label, expected] of [["Export JSON", forecastDiagnosticsJson(report)], ["Export Markdown", forecastDiagnosticsMarkdown(report)]]) {
    const downloading = page.waitForEvent("download");
    await page.getByRole("button", { name: label, exact: true }).click();
    const path = await (await downloading).path();
    expect(await readFile(path!, "utf8")).toBe(expected);
  }
});

for (const [status, message] of [[401, "Sign in with an admin account"], [403, "does not have admin access"], [503, "Diagnostics could not be loaded (503)"]] as const) {
  test(`${status} error clears report and blocks exports`, async ({ page }) => {
    const report = await open(page);
    await load(page, report);
    await page.route(endpoint, route => route.fulfill({ status, json: { success: false, message: "Request failed" } }));
    await page.getByRole("button", { name: "Load diagnostics", exact: true }).click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText(message);
    await expect(page.getByLabel("Loaded diagnostic report", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Export Markdown", exact: true })).toBeDisabled();
  });
}

test("timezone omission and network failure have recoverable error states", async ({ page }) => {
  const report = await open(page);
  await fill(page, report);
  await page.getByRole("textbox", { name: "Cutoff (ISO with timezone)" }).fill("2026-10-05T18:00:00");
  await page.getByRole("button", { name: "Load diagnostics", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("timezone-qualified ISO cutoff");
  await fill(page, report);
  await page.route(endpoint, route => route.abort("failed"));
  await page.getByRole("button", { name: "Load diagnostics", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  await expect(page.getByRole("button", { name: "Export JSON", exact: true })).toBeDisabled();
});

test("URL parameters prefill without fetching until submitted", async ({ page }) => {
  const report = makeSyntheticDiagnosticReport();
  let reads = 0;
  await page.route(/https:\/\/[^/]+\.supabase\.(co|in)\//, route => route.abort());
  await page.route(endpoint, route => { reads += 1; return route.fulfill({ json: report }); });
  await page.goto(`/db/forecast-diagnostics?${new URLSearchParams({ gameId: String(report.scope.gameId), cutoffAt: report.scope.cutoffAt })}`);
  await expect(page.getByRole("spinbutton", { name: "Game ID" })).toHaveValue(String(report.scope.gameId));
  await expect(page.getByRole("textbox", { name: "Cutoff (ISO with timezone)" })).toHaveValue(report.scope.cutoffAt);
  expect(reads).toBe(0);
  await page.getByRole("button", { name: "Load diagnostics", exact: true }).click();
  await expect(page.getByLabel("Loaded diagnostic report", { exact: true })).toBeVisible();
  expect(reads).toBe(1);
});
