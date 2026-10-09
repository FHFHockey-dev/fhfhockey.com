import { expect, test, type Page } from "@playwright/test";
import { fixtureGame, fixtureNext, fixtureResponse, fixturePP, fixtureNow } from "../lib/lines/testFixtures";
import { reconcilePP } from "../lib/lines/reconcile";

async function fixtureRoutes(page: Page, options: { empty?: boolean; both?: boolean; mixed?: boolean } = {}) {
  await page.route("**/api/cors?**", (route) => route.fulfill({ status: 503, json: { message: "Historical statistics are outside this fixture" } }));
  await page.route("**/api/v1/lines/projected?**", (route) => {
    const url = new URL(route.request().url());
    const selected = Number(url.searchParams.get("gameId"));
    const data = fixtureResponse(options.empty ? 0 : 10);
    if (options.mixed) {
      const iga = data.teams[0]!.observations[0]!;
      const pp = fixturePP(2, { captureId: iga.captureId, text: iga.text, phase: "unknown", accepted: false,
        reviewReasons: ["claim_phase_unresolved", "binding_decision_unverified"], gameId: null,
        binding: { status: "unresolved", evidence: ["Independent PP applicability needs review"], resolverVersion: "fixture:1", scheduleIdentity: null } });
      data.teams[0]!.observations = [iga, pp];
      data.teams[0]!.history = [iga, pp];
    }
    if (selected === fixtureNext.id) {
      data.game = fixtureNext; data.teams[0]!.entry = null; data.teams[0]!.entryRevisions = [];
      data.teams[0]!.observations = []; data.teams[0]!.history = [];
      data.teams[0]!.ppDefaults = reconcilePP({ game: fixtureNext, games: data.games, teamId: 14, claims: [fixturePP(1), fixturePP(2)], now: fixtureNow, carryForward: true });
    }
    if (options.both) data.teams.push({ ...data.teams[0]!, teamId: 3, abbreviation: "NYR", entry: null, entryRevisions: [], fallback: null, observations: [], history: [], ppDefaults: [] });
    return route.fulfill({ json: data });
  });
}

test("game entry stays distinct from updates; both teams and older evidence are accessible", async ({ page }) => {
  await fixtureRoutes(page, { both: true });
  await page.goto(`/lines/line-combo/${fixtureGame.id}`);
  const entry = page.getByLabel("TBL game-entry lineup", { exact: true });
  await expect(entry.getByText("Mikheyev — Point — Kucherov", { exact: true })).toBeVisible();
  await expect(entry.getByText(/Holmberg\/Point\/Guentzel together/)).toHaveCount(0);
  const rail = page.getByLabel("TBL in-game updates", { exact: true });
  await expect(rail.getByText(/Holmberg\/Point\/Guentzel together/)).toHaveCount(8);
  await rail.getByRole("button", { name: "Show earlier updates" }).click();
  await expect(rail.getByText(/Holmberg\/Point\/Guentzel together/)).toHaveCount(10);
  await expect(page.getByLabel("NYR game-entry lineup", { exact: true }).getByText("Mikheyev — Point — Kucherov")).toHaveCount(0);
  await expect(entry.getByRole("link", { name: "@fixtureauthor" }).first()).toHaveAttribute("href", "https://x.com/fixtureauthor/status/123");
  await expect(page.locator("[data-nextjs-dialog]")).toHaveCount(0);
  await page.screenshot({ path: "/tmp/game-lines-fixes-20261002/desktop.png", fullPage: true });
});

test("mobile entry precedes the accessible rail, supports game history and PP origins", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fixtureRoutes(page);
  await page.goto(`/lines/line-combo/${fixtureGame.id}`);
  const entry = page.getByLabel("TBL game-entry lineup", { exact: true });
  const rail = page.getByLabel("TBL in-game updates", { exact: true });
  await expect(entry).toBeVisible();
  const mainBox = await entry.boundingBox(), railBox = await rail.boundingBox();
  expect(mainBox!.y).toBeLessThan(railBox!.y);
  const toggle = rail.getByRole("button", { name: "In-game updates (10)" });
  await toggle.click(); await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click(); await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await page.screenshot({ path: "/tmp/game-lines-fixes-20261002/mobile.png", fullPage: true });
  await page.getByLabel("Game", { exact: true }).selectOption(String(fixtureNext.id));
  await expect(page.getByText("Carried forward from 2026-10-01 · TBL at NYR")).toHaveCount(2);
  await expect(page.getByText("No in-game updates yet.")).toBeVisible();
  await expect(page.locator("[data-nextjs-dialog]")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("one source capture exposes independent IGA and PP status", async ({ page }) => {
  await fixtureRoutes(page, { mixed: true });
  await page.goto(`/lines/line-combo/${fixtureGame.id}`);
  const rail = page.getByLabel("TBL in-game updates", { exact: true });
  const iga = rail.getByLabel("In-game adjustment · Relationship · continuity", { exact: true });
  const pp = rail.getByLabel("Power-play report · PP 2", { exact: true });
  await expect(iga.getByText("Observed in game", { exact: true })).toBeVisible();
  await expect(iga.getByText(/Review needed/)).toHaveCount(0);
  await expect(pp.getByText("Phase unresolved", { exact: false })).toBeVisible();
  await expect(pp.getByText(/Game applicability unresolved/)).toBeVisible();
  await expect(pp.getByText(/claim_phase_unresolved/)).toBeVisible();
  await expect(pp.getByText("Observed in game", { exact: true })).toHaveCount(0);
  await expect(rail.getByText(/Holmberg\/Point\/Guentzel together/)).toHaveCount(1);
  await page.screenshot({ path: "/tmp/game-lines-fixes-20261002/mixed-claims.png", fullPage: true });
});
