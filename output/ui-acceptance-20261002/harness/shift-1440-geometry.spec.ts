import { expect, test, type Page } from "./ui-acceptance-fixture";
import { gameFixture, fullRosterFixture } from "../components/ShiftChart/testFixtures";

async function fixtures(
  page: Page,
  options: { fail?: boolean; live?: boolean; full?: boolean; overtime?: boolean; missing?: boolean; wait?: Promise<void> } = {},
) {
  let failed = false;
  const requests: string[] = [];
  await page.route("**/api/cors?**", async (route) => {
    const url = new URL(route.request().url()).searchParams.get("url") ?? "";
    requests.push(url);
    if (options.fail && !failed && url.includes("boxscore")) {
      failed = true;
      await route.fulfill({
        status: 502,
        json: { message: "Fixture upstream unavailable" },
      });
      return;
    }
    if (url.includes("/schedule/")) {
      const date = url.split("/").at(-1)!;
      const games =
        date === "2026-09-25"
          ? []
          : [2026010054, 2026010055].map((id) => ({
              id,
              gameState: "FINAL",
              homeTeam: { abbrev: "UTA" },
              awayTeam: { abbrev: "COL" },
            }));
      await route.fulfill({ json: { gameWeek: [{ date, games }] } });
      return;
    }
    await options.wait;
    const id = url.includes("2026010055") ? 2026010055 : 2026010054;
    const f = options.full ? fullRosterFixture(id, options.overtime) : gameFixture(id);
    if (options.missing) f.shifts.data = [];
    if (options.live) f.box.gameState = "LIVE";
    if (f.box.id === 2026010055) {
      f.box.homeTeam.abbrev = "BOS";
      f.box.homeTeam.placeName.default = "Boston";
      f.box.homeTeam.commonName.default = "Bruins";
    }
    await route.fulfill({
      json: url.includes("boxscore")
        ? f.box
        : url.includes("shiftcharts")
          ? f.shifts
          : f.pbp,
    });
  });
  return requests;
}

async function openGame(page: Page) {
  await page.goto("/shiftChart?gameId=2026010054");
  await expect(page.getByRole("slider", { name: "Replay time", exact: true })).toBeVisible();
  await expect(page.getByLabel("Select date")).toHaveValue("2026-09-26");
  await expect(page.getByLabel("Select game")).toBeEnabled();
}

test("records 1440px matrix clipping geometry", async ({page},testInfo)=>{
 await page.setViewportSize({width:1440,height:900});await fixtures(page,{full:true,overtime:true});await openGame(page);await expect(page.locator("[data-matrix-cell]")).toHaveCount(648);await page.waitForTimeout(500);
 const evidence=await page.evaluate(()=>{
 const rect=(el:Element)=>{const r=el.getBoundingClientRect();return {tag:el.tagName,class:el.className,text:el.textContent?.trim().slice(0,45),x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}};
 return {width:innerWidth,height:innerHeight,documentWidth:document.documentElement.scrollWidth,documentHeight:document.documentElement.scrollHeight,panels:[...document.querySelectorAll("main, [class*='pageGrid'], [class*='matrixSidebar'], [class*='matrixViewport'], [data-matrix-size]")].map(rect),outside:[...document.querySelectorAll("[data-matrix-cell], [class*='leftPlayerName'], [class*='topPlayerName'] > div, footer")].filter(el=>{const r=el.getBoundingClientRect();return r.left<0||r.right>innerWidth+1||r.bottom>innerHeight+1}).map(rect)};
 });const fs=await import("node:fs");fs.writeFileSync(testInfo.outputPath("1440-geometry.json"),JSON.stringify(evidence,null,2));console.log(JSON.stringify({documentWidth:evidence.documentWidth,documentHeight:evidence.documentHeight,outside:evidence.outside.length,panels:evidence.panels}));await page.screenshot({path:testInfo.outputPath("1440-clipping.png")});
});
