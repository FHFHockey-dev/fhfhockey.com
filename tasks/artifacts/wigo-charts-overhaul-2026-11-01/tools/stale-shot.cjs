// Bedard's stale shape on the fictional fixture: the career row still holds STD GP 69 (written Sep 17)
// while this season's totals say 8 played; CA is empty, as for a rookie. Usage: node stale-shot.cjs out.png
const { chromium } = require("/Users/tim/Code/fhfhockey.com/web/node_modules/playwright");
const { installWigoFixtures, SUBJECT_ID } = require("../../wigo-redesign-2026-10-25/fixtures/wigo-fixtures.cjs");
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 })).newPage();
  await installWigoFixtures(page);
  const json = body => ({ status: 200, headers: { "content-type": "application/json", "access-control-allow-origin": "*" }, body: JSON.stringify(body) });
  await page.route("**/rest/v1/wigo_career?*", route => route.fulfill(json({ player_id: SUBJECT_ID, last_updated: "2025-09-17T08:52:00Z",
    std_gp: 69, std_g: 39, std_a: 36, std_pts: 75, std_sog: 250, std_atoi: 19.5, ly_gp: 82, ly_g: 42, ly_pts: 90, ly_atoi: 20.1 })));
  await page.route("**/rest/v1/wigo_recent?*", route => route.fulfill(json({ player_id: SUBJECT_ID, last_updated: "2025-09-17T08:52:00Z", l5_gp: 5, l5_g: 2, l5_pts: 4 })));
  await page.route("**/rest/v1/wgo_skater_stats_totals?*player_id=eq.*", route => route.fulfill(json({ player_id: SUBJECT_ID, season: "20252026", games_played: 8,
    goals: 4, assists: 5, points: 9, shots: 30, hits: 3, blocked_shots: 2, penalty_minutes: 2, pp_points: 3, toi_per_game: 1180, pp_toi_pct_per_game: 0.5, shooting_percentage: 0.133, points_per_game: 1.12 })));
  await page.goto(`http://127.0.0.1:${process.env.WIGO_PORT || 3150}/wigoCharts?playerId=${SUBJECT_ID}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  await page.mouse.move(0, 0);
  const box = await page.locator('[data-coverage="C12"]').boundingBox();
  await page.screenshot({ path: process.argv[2], clip: box });
  await browser.close();
})();
