/* Run against the loopback-only Next development server. */
const assert = require("node:assert/strict");
const { createRequire } = require("node:module");
const path = require("node:path");
const fs = require("node:fs");
const { chromium } = createRequire(path.resolve(__dirname, "../../../../web/package.json"))("playwright");

async function main() {
  const base = "http://127.0.0.1:3167";
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, serviceWorkers: "block" });
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.route("**/*", route => {
      const url = new URL(route.request().url());
      return url.origin === base && !url.pathname.startsWith("/api/") ? route.continue() : route.abort();
    });
    await page.goto(base + "/sko-element/preview");
    await page.getByRole("link", { name: /Explore retained player/ }).click();
    await page.getByRole("heading", { name: "Alex DeBrincat · Game log" }).waitFor();
    const select = page.getByLabel("Inspect appearance");
    const player = page.getByLabel("Player and season");
    const count = await player.locator("option").count();
    const defaultPlayer = await player.inputValue();
    const alternate = await player.locator("option").evaluateAll(opts => opts.find(o => !o.selected).value);
    await player.selectOption(alternate);
    await page.waitForURL(u => u.searchParams.get("player") === alternate);
    await player.selectOption(defaultPlayer);
    await page.waitForURL(u => u.searchParams.get("player") === defaultPlayer);
    // A direct request also exercises the server's data lookup with the URL identity.
    await page.reload();
    const games = await page.evaluate(() => JSON.parse(document.getElementById("__NEXT_DATA__").textContent).props.pageProps.games);
    const first = games.findIndex(g => g.reference === null);
    const breach = games.findIndex(g => g.breach);
    const confirmation = games.findIndex((g, i) => g.confirmation && games[i + 1]?.exit === g.state);
    assert(first >= 0 && breach >= 0 && confirmation >= 0, "Expected insufficient history, breach and a one-GP confirmed episode");
    await select.selectOption(String(first));
    await page.getByText("The retained history cannot establish a state at this close.", { exact: false }).waitFor();
    await select.selectOption(String(breach));
    await page.getByText(games[breach].breach + " breach", { exact: false }).last().waitFor();
    await select.selectOption(String(confirmation));
    await page.getByRole("heading", { name: "Lead-in to confirmation" }).waitFor();
    await page.getByRole("heading", { name: "Two games either side of exit" }).waitFor();
    assert.equal(await page.getByRole("button", { name: /^S-/ }).count(), 5);
    assert.equal(await page.getByRole("button", { name: /^E/ }).count(), 5);
    const chart = page.getByRole("group", { name: /^Scoring chart/ });
    await chart.focus();
    await page.keyboard.press("ArrowRight");
    assert.equal(await select.inputValue(), String(confirmation + 1));
    await chart.locator("svg rect[fill='transparent'] title").nth(confirmation).locator("..").hover();
    assert.equal(await select.inputValue(), String(confirmation));
    await page.mouse.move(0, 0);
    await page.locator("main").last().screenshot({ path: path.join(__dirname, "chart-debrincat.png"), style: "header:has(nav) { visibility: hidden !important }" });
    await page.getByLabel("Time view").selectOption("asof");
    assert.equal(await select.locator("option").count(), confirmation + 1);
    await page.getByText(/Exit unobserved in this view/).waitFor();
    assert.equal(await page.getByRole("heading", {name: "Two games either side of exit"}).count(), 0);
    assert.equal(await chart.locator("title").count(), confirmation + 1);
    await page.getByLabel("Through appearance").fill(String(confirmation + 2));
    await page.getByRole("heading", { name: "Two games either side of exit" }).waitFor();
    assert.equal(await page.getByRole("button", { name: /^E\+/ }).count(), 0);
    await select.selectOption(String(first));
    assert.equal(await select.locator("option").count(), first + 1);
    assert.equal(await chart.locator("title").count(), first + 1);
    await page.getByText("No confirmed episode in this visible segment.").waitFor();
    await player.selectOption("8477493/20242025");
    await page.getByRole("heading", {name: "Aleksander Barkov · Game log"}).waitFor();
    await select.selectOption("2");
    await page.getByText(/possible missing appearance on short team sheet/).waitFor();
    await page.getByText(/Game 2024020140 · .*Insufficient history/).waitFor();
    await select.selectOption("27");
    await page.getByText("The first breach could predate reliable history. The start of this run is unknown.").waitFor();
    assert.equal(await page.getByRole("heading", {name: "Lead-in to confirmation"}).count(), 0);
    await player.selectOption("8470621/20242025");
    await page.getByRole("heading", {name: "Corey Perry · Game log"}).waitFor();
    await page.getByText(/Game 2024021306/).waitFor();
    await page.getByText(/Exit unobserved in this view/).waitFor();
    await page.setViewportSize({width: 390, height: 844});
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= 390), "Mobile page must fit viewport");
    const cutoffs = [];
    for (const [id, name, game, gp, date] of [
      ["8471685", "Anze Kopitar", "2024020957", 58, "2025-03-01"],
      ["8479337", "Alex DeBrincat", "2024021036", 65, "2025-03-12"],
    ]) {
      const url = base + "/sko-element/streaks?player=" + id + "/20242025&through=" + game;
      assert.equal((await page.goto(url)).status(), 200);
      await page.getByRole("heading", {name: name + " · Game log"}).waitFor();
      assert.equal(await page.getByLabel("Time view").inputValue(), "asof");
      assert.equal(await select.locator("option").count(), gp);
      assert.equal(await chart.locator("title").count(), gp);
      assert.equal(await select.inputValue(), String(gp - 1));
      assert((await select.locator("option").last().innerText()).includes(date));
      await page.getByText(new RegExp("Game " + game)).waitFor();
      const { games: serialized, buildId } = await page.evaluate(() => {
        const data = JSON.parse(document.getElementById("__NEXT_DATA__").textContent);
        return { games: data.props.pageProps.games, buildId: data.buildId };
      });
      assert.equal(serialized.length, gp);
      assert.equal(serialized.at(-1).id, game);
      const jsonURL = new URL(url);
      jsonURL.pathname = "/_next/data/" + buildId + "/sko-element/streaks.json";
      const navigation = await page.evaluate(async src => {
        const response = await fetch(src);
        if (!response.ok) throw new Error("Navigation JSON " + response.status);
        return (await response.json()).pageProps.games;
      }, jsonURL.toString());
      assert.equal(navigation.length, gp);
      assert.equal(navigation.at(-1).id, game);
      await page.getByRole("link", {name: "Open " + name + "’s full historical season"}).click();
      await page.waitForURL(u => u.searchParams.get("player") === id + "/20242025" && !u.searchParams.has("through"));
      await page.getByRole("link", {name: "Open " + name + "’s full historical season"}).waitFor({state: "detached"});
      assert.equal(await page.getByLabel("Time view").inputValue(), "history");
      assert(await select.locator("option").count() > gp);
      cutoffs.push({ url, gp, htmlGames: serialized.length, htmlFinalGame: serialized.at(-1).id,
        nextDataGames: navigation.length, nextDataFinalGame: navigation.at(-1).id });
    }
    for (const query of ["player=8471685/20242025&through=2024021036", "through=2024021036", "player=8479337/20242025&through=abc"]) {
      assert.equal((await page.goto(base + "/sko-element/streaks?" + query)).status(), 404);
      await page.getByRole("alert").filter({ hasText: "does not match" }).waitFor();
      assert.equal(await page.getByLabel("Inspect appearance").count(), 0);
    }
    assert.deepEqual(errors, []);
    const receipt = { player: defaultPlayer, selectablePlayerSeasons: count, playedGames: games.length,
      missingHistory: games[first].id, breach: games[breach].id, oneGameEpisode: games[confirmation].id,
      firstOutside: games[confirmation + 1].id, uncertainSheetBoundary: "2024020140",
      leftCensoredCold: "2024020586", unfinishedHot: "2024021306", browser: browser.version(), cutoffs,
      passed: ["preview entry and player switch", "keyboard + pointer selection", "prior five and exit ±2 GP",
        "one-game episode and right-censored as-of view", "absent post-cutoff games and markers", "short-sheet history gap", "unknown episode start", "unobserved season-end exit", "390px viewport", "two official-game deep links open at frozen closes", "HTML and Next navigation JSON end at the named game", "explicit full-season link restores later games", "mismatched, unscoped and malformed links return 404", "no page exceptions"] };
    fs.writeFileSync(path.join(__dirname, "chart-browser-receipt.json"), JSON.stringify(receipt, null, 2) + "\n");
    console.log(receipt);
  } finally { await browser.close(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
