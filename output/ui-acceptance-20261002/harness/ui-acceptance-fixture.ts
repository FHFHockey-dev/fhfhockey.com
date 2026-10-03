import { test as base, expect } from "@playwright/test";
import { writeFileSync } from "node:fs";
export { expect };
export type { Page, Locator } from "@playwright/test";
export const test = base.extend({
 context: async ({ context }, use) => {
  const traffic: unknown[] = [];
  await context.route("**/*", async route => {
   const req = route.request(), u = new URL(req.url());
   if(u.origin === "http://127.0.0.1:3198" && ["GET","HEAD"].includes(req.method()) && !u.pathname.startsWith("/api/") && !u.pathname.startsWith("/rest/") && !u.pathname.startsWith("/auth/")) return route.continue();
   traffic.push({url:req.url(),method:req.method()});
   if(req.resourceType() === "image") return route.fulfill({status:200,contentType:"image/svg+xml",body:'<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>'});
   if(req.resourceType() === "stylesheet") return route.fulfill({status:200,contentType:"text/css",body:"/* External fonts intentionally omitted for safe local fixtures. */"});
   if(req.resourceType() === "script") return route.fulfill({status:200,contentType:"application/javascript",body:""});
   return route.fulfill({status:200,json:[]});
  });
  await use(context);
 },
 page: async ({ page }, use, testInfo) => {
  const errors: string[] = []; page.on("pageerror", error=>errors.push(error.message));
  await use(page);
  if(!page.isClosed()) {
   await page.screenshot({path:testInfo.outputPath("final-page.png"),fullPage:true});
   writeFileSync(testInfo.outputPath("page-evidence.json"),JSON.stringify({title:await page.title(),url:page.url(),errors,dimensions:await page.evaluate(()=>({width:innerWidth,height:innerHeight,documentWidth:document.documentElement.scrollWidth,documentHeight:document.documentElement.scrollHeight})),overlays:await page.locator("[data-nextjs-dialog]").count()},null,2));
  }
 }
});
