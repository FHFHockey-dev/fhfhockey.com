import { chromium } from "@playwright/test";
import { randomUUID } from "node:crypto";

const target = new URL(process.argv[2]);
if (target.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(target.hostname)) throw new Error("Use an approved HTTPS board origin");
if (target.username || target.password || target.search || target.hash || target.pathname !== "/") throw new Error("Supply the board origin only");
const expected = process.argv[3];
if (expected && !/^[0-9a-f-]{36}$/i.test(expected)) throw new Error("Invalid expected revision");
const secret = process.env.CRON_SECRET;
if (!secret) throw new Error("Probe receipt authentication is required");
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  // No account session or authorization is installed in the public browser.
  await page.goto(new URL("/start-chart", target).href, { waitUntil: "domcontentloaded" });
  await page.waitForFunction((revision) => {
    const value = document.querySelector("[data-board-revisions]")?.getAttribute("data-board-revisions");
    const ids = JSON.parse(value || "[]");
    return ids.length > 0 && (!revision || ids.includes(revision));
  }, expected ?? null, { timeout: 300_000 });
  const revisionIds = JSON.parse(await page.locator("[data-board-revisions]").getAttribute("data-board-revisions"));
  const renderedAt = new Date().toISOString();
  const response = await fetch(new URL("/api/v1/db/starter-board-release", target), { method: "POST", redirect: "error",
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    body: JSON.stringify({ action: "visibility", probeId: randomUUID(), revisionIds, renderedAt }),
  });
  if (!response.ok) throw new Error(`Probe receipt failed: ${response.status}`);
  const receipt = await response.json();
  if (receipt.result !== new Set(revisionIds).size) throw new Error("Probe receipt did not record every rendered revision");
  console.log(JSON.stringify({ status: "rendered", revisionIds, renderedAt, receiptAcknowledgedAt: new Date().toISOString() }));
} finally { await browser.close(); }
