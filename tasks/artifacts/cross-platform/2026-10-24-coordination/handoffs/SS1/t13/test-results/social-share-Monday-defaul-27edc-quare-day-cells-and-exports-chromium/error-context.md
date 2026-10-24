# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: social-share.spec.ts >> Monday default grid ranks every team by Game Grid weekScore in square day cells and exports
- Location: e2e/social-share.spec.ts:313:5

# Error details

```
Error: expect(locator).toBeEnabled() failed

Locator: getByRole('button', { name: 'Refresh schedule', exact: true })
Expected: enabled
Timeout: 15000ms
Error: element(s) not found

Call log:
  - Expect "toBeEnabled" with timeout 15000ms
  - waiting for getByRole('button', { name: 'Refresh schedule', exact: true })

```

```yaml
- banner:
  - link "FHFH home":
    - /url: /
    - img "FHFH"
    - text: Hockey Analytics
  - navigation "Primary navigation":
    - list:
      - listitem:
        - link "Home":
          - /url: /
      - listitem:
        - link "Game Grid":
          - /url: /game-grid
      - listitem:
        - link "Underlying Stats":
          - /url: /underlying-stats
      - listitem:
        - button "Analytics"
      - listitem:
        - button "Tools"
      - listitem:
        - link "Blog":
          - /url: /blog
      - listitem:
        - button "Community"
  - button "Search players"
  - link "Buy me a coffee":
    - /url: https://www.buymeacoffee.com/tjsusername
    - img "Buy me a coffee"
  - button "Sign In / Sign Up"
- main:
  - region "Share studio":
    - heading "Share studio" [level=1]
    - alert: Sign in with your FHFH social editor account to continue.
    - link "Sign in":
      - /url: /auth
- contentinfo:
  - link "FHFH home":
    - /url: /
  - text: Five Hole Fantasy Hockey © 2026 FHFHockey
  - navigation "Footer navigation":
    - link "Underlying Stats":
      - /url: /underlying-stats
    - link "Game Grid":
      - /url: /game-grid
    - link "Stats":
      - /url: /stats
    - link "Blog":
      - /url: /blog
    - link "Podcast":
      - /url: /podfeed
    - link "Privacy":
      - /url: /privacy
  - link "Support FHFH":
    - /url: https://www.buymeacoffee.com/tjsusername
  - link "Twitter":
    - /url: https://www.twitter.com/fhfhockey
    - img "Twitter"
  - link "Discord":
    - /url: https://discord.gg/kfnyrn7
    - img "Discord"
  - link "Patreon":
    - /url: https://www.patreon.com/FHFHRadio
    - img "Patreon"
  - link "Youtube":
    - /url: https://www.youtube.com/fiveholefantasyhockey
    - img "Youtube"
  - link "Spotify":
    - /url: https://open.spotify.com/show/0tcyfS62ZHdLYA3Xf3QgSQ?si=HtfgMe8_QD6KfwiOw2fC1g
    - img "Spotify"
- alert
```

# Test source

```ts
  1   | import { expect, test, type Page } from "@playwright/test";
  2   | import { mkdir, readFile, writeFile } from "node:fs/promises";
  3   | import { createHash } from "node:crypto";
  4   | import { TUESDAY_NOT_CONNECTED, buildBlockedSnapshot, buildScheduleSnapshot, calendarWeekStart, selectScheduleDates, weekDates } from "../lib/socialShare/schedule";
  5   | import type { SocialScheduleGame as GameData } from "../lib/socialShare/types";
  6   | import type { SocialShareFormat, SocialShareSnapshot } from "../lib/socialShare/types";
  7   | import { fictionalLeagueWeek, fictionalTeamStats } from "../lib/socialShare/fixtures";
  8   | import { buildOpponentLayer, easiestSchedules, streamingNights } from "../lib/socialShare/matchups";
  9   | import { attachRecent, buildPlayerLayer, pickupTiers, specialists, type ShareGoalieGameRow, type ShareRecentRollingRow } from "../lib/socialShare/players";
  10  | import { fictionalPlayerRecent, fictionalPlayerSources } from "../lib/socialShare/pickupsFixture";
  11  | import { localDate } from "../lib/rosterScheduleOptimizer/planningDates";
  12  | import { buildTrendLayer, deploymentChanges, hotCold, ownershipMovers, rateStandouts } from "../lib/socialShare/trends";
  13  | import { fictionalTrendSources } from "../lib/socialShare/trendsFixture";
  14  | import { editionLabel } from "../lib/socialShare/edition";
  15  | import { countTiers } from "../lib/socialShare/mondayGrid";
  16  | 
  17  | const evidence = process.env.SOCIAL_SHARE_EVIDENCE_DIR || "/tmp/fhf-social-card-readiness-evidence-20261008";
  18  | const upcomingWeek = calendarWeekStart(new Date(Date.now() + 7 * 86400000).toISOString());
  19  | type Mode = "ready" | "partial" | "stale" | "zero" | "league";
  20  | test.beforeEach(({ page }) => page.setDefaultTimeout(10000));
  21  | 
  22  | // Fictional public schedule mechanics, deliberately separate from live NHL evidence.
  23  | type Rates = "ready" | "stale" | "missing";
  24  | type PlayerMode = Rates | "thin";
  25  | /** Last-five-games read outcome: rows, an answered-but-empty read, or a failed read. */
  26  | type RecentRead = "ready" | "empty" | "failed";
  27  | function fixture(format: SocialShareFormat, weekStart: string, mode: Mode, pinnedAt?: string, rates: Rates = "ready", players: PlayerMode = "ready", trends: Rates = "ready", recentRead: RecentRead = "ready"): SocialShareSnapshot {
  28  |   const dates = weekDates(weekStart), generatedAt = pinnedAt ?? new Date().toISOString();
  29  |   const year = Number(weekStart.slice(0, 4)) - (Number(weekStart.slice(5, 7)) < 8 ? 1 : 0);
  30  |   const pairs = [[0, 1, 2], [0, 10, 8], [1, 3, 1], [2, 2, 4], [3, 1, 2], [4, 1, 3], [6, 2, 3]];
  31  |   const abbreviations: Record<number, string> = { 1: "NJD", 2: "NYI", 3: "NYR", 4: "PHI", 8: "MTL", 10: "TOR" };
  32  |   if (mode === "league") {
  33  |     // Fictional schedule plus fictional NST-shaped team rates for the matchup cards.
  34  |     const snapshot = buildScheduleSnapshot({ format, weekStart, generatedAt, schedule: fictionalLeagueWeek(weekStart, generatedAt) }), season = snapshot.games[0].season;
  35  |     const updatedAt = new Date(Date.parse(generatedAt) - (rates === "stale" ? 80 : 4) * 3600000).toISOString();
  36  |     snapshot.opponents = buildOpponentLayer(rates === "missing" ? null : fictionalTeamStats(season, updatedAt), { season, teams: snapshot.teams, fetchedAt: generatedAt, generatedAt });
  37  |     // Fictional Yahoo ownership (today, or three days old when stale) and WGO totals 4 h old.
  38  |     const observedOn = new Date(Date.parse(generatedAt) - (players === "stale" ? 72 : 0) * 3600000).toISOString();
  39  |     const sources = players === "missing" ? null : fictionalPlayerSources(season, localDate(observedOn, "America/New_York"), new Date(Date.parse(generatedAt) - 4 * 3600000).toISOString());
  40  |     snapshot.players = buildPlayerLayer(sources, { season, teams: snapshot.teams.map(team => team.abbreviation), fetchedAt: generatedAt, generatedAt });
  41  |     // Fictional last-five-games evidence for every joined player, as the live server attaches for shown ones.
  42  |     const recent = fictionalPlayerRecent(snapshot.players.players, season, localDate(generatedAt, "America/New_York"));
  43  |     snapshot.players = attachRecent(snapshot.players, recentRead === "failed" ? null : recentRead === "empty" ? { rolling: [], goalieGames: [] } : { rolling: recent.rolling as ShareRecentRollingRow[], goalieGames: recent.goalieGames as ShareGoalieGameRow[] }, generatedAt);
  44  |     // Fictional rolling metrics (4 h old, or 80 h when stale) and seven-day ownership timelines.
  45  |     const trendSources = trends === "missing" ? null : fictionalTrendSources(season, localDate(generatedAt, "America/New_York"), new Date(Date.parse(generatedAt) - (trends === "stale" ? 80 : 4) * 3600000).toISOString());
  46  |     snapshot.trends = buildTrendLayer(trendSources, { season, teams: snapshot.teams, fetchedAt: generatedAt, generatedAt });
  47  |     // "thin": one goalie under 20% rostered on a top-10 team, so the column renders "Only 1 qualifies".
  48  |     if (players === "thin") {
  49  |       const top = new Set(snapshot.rows.filter(row => row.rank <= 10).map(row => row.team.abbreviation));
  50  |       const kept = snapshot.players.players.find(player => player.group === "G" && player.ownership < 20 && top.has(player.team));
  51  |       snapshot.players.players = snapshot.players.players.filter(player => !(player.group === "G" && player.ownership < 20) || player === kept);
  52  |     }
  53  |     return structuredClone(snapshot);
  54  |   }
  55  |   const games: GameData[] = mode === "zero" ? [] : pairs.map(([day, home, away], i) => ({
  56  |     id: year * 1000000 + 20000 + i, season: year * 10000 + year + 1, gameType: 2,
  57  |     gameDate: dates[day], startTimeUTC: `${dates[day]}T23:00:00Z`, gameState: "FUT", gameScheduleState: "OK",
  58  |     homeTeam: { id: home, abbrev: abbreviations[home] }, awayTeam: { id: away, abbrev: abbreviations[away] },
  59  |   }));
  60  |   return structuredClone(buildScheduleSnapshot({ format, weekStart, generatedAt, schedule: {
  61  |     data: {}, games, fetchedAt: mode === "stale" ? new Date(Date.parse(generatedAt) - 7 * 3600000).toISOString() : generatedAt,
  62  |     coveredDates: mode === "partial" ? dates.slice(1) : dates,
  63  |     numGamesPerDay: dates.map(date => games.filter(game => game.gameDate === date).length),
  64  |   } }));
  65  | }
  66  | 
  67  | async function install(page: Page) {
  68  |   const controller = { requests: 0, fail: false, mode: "ready" as Mode, longName: false, pinnedAt: undefined as string | undefined, rates: "ready" as Rates, players: "ready" as PlayerMode, trends: "ready" as Rates, recentRead: "ready" as RecentRead, liveTuesday: false, latest: null as SocialShareSnapshot | null };
  69  |   await page.context().route("**/*", route => ["127.0.0.1", "localhost"].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
  70  |   await page.route("**/api/v1/social-share/**", async route => {
  71  |     controller.requests++;
  72  |     if (controller.fail) return route.fulfill({ status: 503, json: { error: "NHL schedule is unavailable. Refresh to retry." } });
  73  |     const url = new URL(route.request().url());
  74  |     // liveTuesday replays exactly what the real API returns for Tuesday today: blocked, no read.
  75  |     if (controller.liveTuesday && url.pathname.endsWith("/tuesday-trends")) {
  76  |       const selected = url.searchParams.get("selectedDates");
  77  |       controller.latest = buildBlockedSnapshot({ format: "tuesday-trends", weekStart: url.searchParams.get("weekStart")!, generatedAt: new Date().toISOString(), selectedDates: selected === null ? undefined : selected.split(",").filter(Boolean), ...TUESDAY_NOT_CONNECTED });
  78  |       return route.fulfill({ json: controller.latest, headers: { "Cache-Control": "no-store" } });
  79  |     }
  80  |     let next = fixture(url.pathname.split("/").pop() as SocialShareFormat, url.searchParams.get("weekStart")!, controller.mode, controller.pinnedAt, controller.rates, controller.players, controller.trends, controller.recentRead);
  81  |     if (url.searchParams.has("selectedDates")) next = selectScheduleDates(next, url.searchParams.get("selectedDates")?.split(",").filter(Boolean) || []);
  82  |     if (controller.longName) {
  83  |       for (const row of next.rows) if (row.team.id === 1) row.team.name = "New Jersey Extremely Long Fantasy Hockey Team Name";
  84  |       for (const team of next.teams) if (team.id === 1) team.name = "New Jersey Extremely Long Fantasy Hockey Team Name";
  85  |     }
  86  |     controller.latest = next;
  87  |     return route.fulfill({ json: next, headers: { "Cache-Control": "no-store" } });
  88  |   });
  89  |   return controller;
  90  | }
  91  | 
  92  | async function open(page: Page, format = "game-grid") {
  93  |   const response = await page.goto(`/social-share/${format}`);
  94  |   expect(response?.headers()["x-robots-tag"]).toContain("noindex");
> 95  |   await expect(page.getByRole("button", { name: "Refresh schedule", exact: true })).toBeEnabled();
      |                                                                                     ^ Error: expect(locator).toBeEnabled() failed
  96  |   await page.getByLabel("Week of (Monday)").fill(upcomingWeek);
  97  |   await expect(page.getByRole("button", { name: "Refresh schedule", exact: true })).toBeEnabled();
  98  | }
  99  | 
  100 | async function downloadedPng(page: Page, name: string) {
  101 |   await mkdir(evidence, { recursive: true });
  102 |   const pending = page.waitForEvent("download");
  103 |   await page.getByRole("button", { name: "Download PNG", exact: true }).click();
  104 |   const download = await pending;
  105 |   await download.saveAs(`${evidence}/${name}.png`);
  106 |   expect(await download.failure()).toBeNull();
  107 |   const bytes = await readFile(`${evidence}/${name}.png`);
  108 |   expect(bytes.subarray(1, 4).toString()).toBe("PNG");
  109 |   expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([1080, 1080]);
  110 |   return bytes;
  111 | }
  112 | 
  113 | test("default summary, recalculated dates and actual PNG match one frozen edition", async ({ page }) => {
  114 |   const source = await install(page), errors: string[] = [];
  115 |   page.on("pageerror", error => errors.push(error.message));
  116 |   await open(page);
  117 |   const square = page.getByTestId("share-square"), download = page.getByRole("button", { name: "Download PNG", exact: true });
  118 |   await expect(download).toBeEnabled();
  119 |   await expect(page.getByRole("region", { name: "Complete ranked schedule" }).locator("ol > li")).toHaveCount(32);
  120 |   await expect(square).toContainText("SCHEDULE ONLY");
  121 |   await expect(square).not.toContainText("Refresh schedule");
  122 |   await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  123 |   const requests = source.requests, before = await square.innerText();
  124 |   await page.getByRole("button", { name: /^Mon /i }).click();
  125 |   await expect(square).not.toHaveText(before, { useInnerText: true });
  126 |   const selected = await square.innerText();
  127 |   expect(source.requests).toBe(requests);
  128 |   expect(selected).not.toBe(before);
  129 |   await page.getByRole("button", { name: "All days", exact: true }).click();
  130 |   await expect(square).toHaveText(before, { useInnerText: true });
  131 |   const png = await downloadedPng(page, "default-fixture");
  132 |   expect(source.requests).toBe(requests);
  133 |   expect(await square.innerText()).toBe(before);
  134 |   await page.screenshot({ path: `${evidence}/fixture-desktop.png`, fullPage: true });
  135 |   const viewport = page.viewportSize()!;
  136 |   await page.setViewportSize({ width: 1440, height: 1400 });
  137 |   const isolation = await page.addStyleTag({ content: 'body * { visibility: hidden !important; } [data-testid="share-square"], [data-testid="share-square"] * { visibility: visible !important; }' });
  138 |   const saved = await square.evaluate(node => {
  139 |     const parent = node.parentElement!;
  140 |     const previous = { node: node.getAttribute("style"), parent: parent.getAttribute("style") };
  141 |     node.style.transform = "none"; node.style.position = "fixed"; node.style.left = "0"; node.style.top = "0"; node.style.zIndex = "2147483647";
  142 |     parent.style.overflow = "visible"; parent.style.maxWidth = "1080px"; parent.style.width = "1080px"; parent.style.height = "1080px";
  143 |     return previous;
  144 |   });
  145 |   const preview = await square.screenshot({ path: `${evidence}/default-fixture-preview.png` });
  146 |   await square.evaluate((node, saved) => {
  147 |     for (const [target, value] of [[node, saved.node], [node.parentElement!, saved.parent]] as const) {
  148 |       if (value === null) target.removeAttribute("style"); else target.setAttribute("style", value);
  149 |     }
  150 |   }, saved);
  151 |   await isolation.evaluate(node => node.parentNode?.removeChild(node));
  152 |   await page.setViewportSize(viewport);
  153 |   const differentPixels = await page.evaluate(async ({ exported, preview }) => {
  154 |     async function pixels(base64: string) {
  155 |       const image = new Image(); image.src = `data:image/png;base64,${base64}`; await image.decode();
  156 |       const canvas = document.createElement("canvas"); canvas.width = canvas.height = 1080;
  157 |       const context = canvas.getContext("2d")!; context.drawImage(image, 0, 0);
  158 |       return context.getImageData(0, 0, 1080, 1080).data;
  159 |     }
  160 |     const a = await pixels(exported), b = await pixels(preview);
  161 |     // Chromium's DOM and foreignObject rasterizers differ at glyph edges.
  162 |     // Tolerate at most one pixel locally, in both directions; content/layout gaps still fail.
  163 |     function mismatches(first: Uint8ClampedArray, second: Uint8ClampedArray) {
  164 |       let different = 0;
  165 |       for (let y = 0; y < 1080; y++) for (let x = 0; x < 1080; x++) {
  166 |         const i = (y * 1080 + x) * 4;
  167 |         const delta = (j: number) => Math.max(Math.abs(first[i] - second[j]), Math.abs(first[i + 1] - second[j + 1]), Math.abs(first[i + 2] - second[j + 2]));
  168 |         if (delta(i) <= 12) continue;
  169 |         let matched = false;
  170 |         for (let dy = -1; dy <= 1 && !matched; dy++) for (let dx = -1; dx <= 1; dx++) {
  171 |           if (x + dx >= 0 && x + dx < 1080 && y + dy >= 0 && y + dy < 1080 && delta(((y + dy) * 1080 + x + dx) * 4) <= 12) { matched = true; break; }
  172 |         }
  173 |         if (!matched) different++;
  174 |       }
  175 |       return different / (1080 * 1080);
  176 |     }
  177 |     return Math.max(mismatches(a, b), mismatches(b, a));
  178 |   }, { exported: png.toString("base64"), preview: preview.toString("base64") });
  179 |   await writeFile(`${evidence}/fixture-fidelity.json`, JSON.stringify({ differentPixels, localRasterTolerancePx: 1, channelTolerance: 12, snapshotId: source.latest!.id, source: "fictional fixture" }, null, 2));
  180 |   expect(differentPixels).toBeLessThan(0.02);
  181 |   expect(errors).toEqual([]);
  182 | });
  183 | 
  184 | test("Wednesday excludes Wednesday; mobile controls and detail PNG preserve selected games", async ({ page }) => {
  185 |   const source = await install(page);
  186 |   await page.setViewportSize({ width: 320, height: 800 });
  187 |   await open(page, "remaining-week");
  188 |   for (const day of ["Mon", "Tue", "Wed"]) await expect(page.getByRole("button", { name: new RegExp(`^${day} `, "i") })).toHaveAttribute("aria-pressed", "false");
  189 |   for (const day of ["Thu", "Fri", "Sat", "Sun"]) await expect(page.getByRole("button", { name: new RegExp(`^${day} `, "i") })).toHaveAttribute("aria-pressed", "true");
  190 |   await expect(page.getByText(/Default: Monday, Tuesday and Wednesday OFF/)).toBeVisible();
  191 |   await expect(page.getByRole("button", { name: "Download PNG", exact: true })).toBeEnabled();
  192 |   expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  193 |   await page.getByRole("combobox", { name: /^Graphic/ }).selectOption("1");
  194 |   await expect(page.getByTestId("share-square")).toContainText("New Jersey Devils");
  195 |   await downloadedPng(page, "team-fixture");
```