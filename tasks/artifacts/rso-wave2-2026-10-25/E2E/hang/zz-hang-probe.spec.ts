import { expect, test } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { installDraftProAuthenticatedFixtures } from "./draft-pro-fixtures";
import { defaultWorkspace } from "../lib/rosterScheduleOptimizer/workspace";
import { RSO_FIXTURE_PRINCIPAL } from "./roster-schedule-optimizer-fixtures";

const ctx = (provider: "yahoo" | "manual") => ({ provider, seasonId: 20262027, leagueId: "manual", teamId: "manual", startDate: "2026-10-26", endDate: "2026-11-01", timeZone: "America/New_York", asOf: "2026-10-26T12:00:00.000Z" });
const key = (c: ReturnType<typeof ctx>, base: string) => `${base}:context:${encodeURIComponent(JSON.stringify([c.provider, c.seasonId, c.leagueId, c.teamId, c.startDate, c.endDate, c.timeZone]))}`;

for (const variant of ["tj-keys", "tj-keys-saved-record", "offline-flag", "stale-journal"] as const) test(`hang probe ${variant}`, async ({ page }, testInfo) => {
  const requests: string[] = [], consoleLines: string[] = [];
  page.on("request", r => { const u = new URL(r.url()); if (u.pathname.startsWith("/api/") || u.hostname !== "127.0.0.1") requests.push(`${r.method()} ${u.hostname === "127.0.0.1" ? "" : u.hostname}${u.pathname}${u.search.slice(0, 80)}`); });
  page.on("console", m => consoleLines.push(`${m.type()} ${m.text().slice(0, 200)}`));
  page.on("pageerror", e => consoleLines.push(`pageerror ${e.message}`));
  await page.route("**/*", route => ["127.0.0.1", "localhost"].includes(new URL(route.request().url()).hostname) ? route.fallback() : route.abort());
  await page.route("**/api/**", route => route.fulfill({ status: 503, json: { error: "probe: unmocked" } }));
  await page.route("**/rest/v1/**", route => route.fulfill({ json: [] }));
  await installDraftProAuthenticatedFixtures(page, () => ({ access: { eligible: false, grantingSources: [], expiresAt: null, verifiedAt: null, nextVerificationAt: null, reason: "no_active_grant", capabilities: [], providerReadiness: { stripe: false, patreon: false, yahoo: true } } }));
  const storageKey = `sb-${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "https://fyhftlxokyjtpndbkfse.supabase.co").hostname.split(".")[0]}-auth-token`;
  await page.addInitScript(k => { const s = localStorage.getItem("sb-127-auth-token"); if (s) localStorage.setItem(k, s); }, storageKey);
  await page.route("**/api/v1/roster-schedule-optimizer/access", route => route.fulfill({ json: { data: { eligible: true, capabilities: ["rso_sync", "rso_auto_upkeep", "rso_account_save"], grantingSources: ["fixture"], expiresAt: null, reason: null } } }));
  await page.route("**/api/v1/account/provider-sync**", route => route.fulfill({ json: { data: { access: { eligible: true, expiresAt: null, nextVerificationAt: null, reason: "eligible" } } } }));
  const yahoo = { ...defaultWorkspace(new Date("2026-10-26T12:00:00Z")), context: ctx("yahoo") };
  const manual = { ...defaultWorkspace(new Date("2026-10-26T12:00:00Z")), context: ctx("manual") };
  await page.route("**/api/v1/roster-schedule-optimizer/workspace?**", route => route.fulfill({ json: { data: variant === "tj-keys-saved-record" ? { workspace: yahoo, snapshot: null, version: 3, updatedAt: "2026-10-25T20:00:00Z" } : null } }));
  const base = "fhfh:rso:workspace:v1", principal = `${base}:principal:${encodeURIComponent(RSO_FIXTURE_PRINCIPAL)}`;
  await page.addInitScript(({ entries }) => { if (!localStorage.getItem("probe-seeded")) { for (const [k, v] of entries) localStorage.setItem(k, v); localStorage.setItem("probe-seeded", "1"); } }, { entries: [
    [principal, JSON.stringify(yahoo)], [key(yahoo.context, principal), JSON.stringify(yahoo)], [`${key(yahoo.context, principal)}:undo`, JSON.stringify({ version: 1, current: yahoo, entries: [] })],
    [key(manual.context, principal), JSON.stringify(manual)], [`${key(manual.context, principal)}:undo`, JSON.stringify({ version: 1, current: manual, entries: [] })],
    [`${base}:anonymous`, JSON.stringify(manual)],
  ] });
  if (variant === "offline-flag") await page.addInitScript(() => Object.defineProperty(Navigator.prototype, "onLine", { configurable: true, get: () => false }));
  if (variant === "stale-journal") await page.addInitScript(() => sessionStorage.setItem("fhfh:rso:preservation:v1", JSON.stringify({ backup: { version: 2, principalId: "x", contextKey: "[]", local: [{ key: "fhfh:rso:workspace:v1", value: null }] }, expected: [], exported: true, restored: false })));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/roster-schedule-optimizer");
  await page.waitForTimeout(20_000);
  const state = await page.evaluate(() => ({
    refreshReason: document.getElementById("rso-provider-refresh-status")?.textContent ?? null,
    checking: document.body.innerText.includes("Checking access for provider synchronization"),
    source: (Array.from(document.querySelectorAll("select")).find(s => s.closest("label")?.textContent?.startsWith("Source")) as HTMLSelectElement | undefined)?.selectedOptions[0]?.textContent ?? null,
    nav: document.querySelector('[class*="navStatus"]')?.textContent?.slice(0, 200) ?? null,
    onLine: navigator.onLine, journal: sessionStorage.getItem("fhfh:rso:preservation:v1") !== null,
    keys: Object.keys(localStorage).filter(k => k.startsWith("fhfh:rso")),
  }));
  await page.screenshot({ path: testInfo.outputPath(`hang-${variant}.png`) });
  const report = { variant, state, requests, console: consoleLines.filter(l => !l.includes("preload")).slice(0, 30) };
  await writeFile(testInfo.outputPath(`hang-${variant}.json`), JSON.stringify(report, null, 2));
  console.log("PROBE " + JSON.stringify(report));
  expect(true).toBe(true);
});
