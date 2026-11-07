import { expect, test, type Page } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
// Replays the retained real editions (real30) with the real calendar body, read through the route's loader, behind the route's Bearer check.
const S = process.env.RR_INPUTS ?? "/private/tmp/claude-501/-Users-tim-Code-fhfhockey-com/799e2b6c-f303-4317-8af1-8a92ac6bcb75/scratchpad/real30", O = "/Users/tim/Code/fhfhockey.com/tasks/artifacts/social-share-expansion-2026-10-31/pager-review-20261101/recapture-e152ce5bc";
const origin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
const summary = JSON.parse(readFileSync(S + "/summary.json", "utf8"));
const calendar = JSON.parse(readFileSync(O + "/calendar-response.json", "utf8"));
const provenance = JSON.parse(readFileSync(O + "/calendar-provenance.json", "utf8"));
const report: unknown[] = [];
// Same rule as editionCutoff: the day before the edition's New York date.
const snapEditionCutoff = (at: string) => { const ny = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date(at)); return new Date(Date.parse(ny + "T00:00:00Z") - 86400000).toISOString().slice(0, 10); };
const readPager = async (page: Page) => {
  const prior = page.getByRole("button", { name: /^Prior week/ }), next = page.getByRole("button", { name: /^Next week/ });
  return { label: await page.getByTestId("period-pager-label").textContent(), prior: await prior.getAttribute("aria-label"), priorEnabled: await prior.isEnabled(), next: await next.getAttribute("aria-label"), nextEnabled: await next.isEnabled(), urlWeek: new URL(page.url()).searchParams.get("week"), skipped: await page.getByTestId("period-skipped").allTextContents(), refreshFailed: await page.getByTestId("period-refresh-failed").count(), unreadable: await page.getByText("Matchup weeks could not be read.").count() };
};
for (const entry of summary) test(entry.name, async ({ page }) => {
  test.setTimeout(60000);
  expect(origin.hostname.endsWith(".invalid")).toBe(true);
  const snap = JSON.parse(readFileSync(S + "/" + entry.name + ".json", "utf8"));
  const edition = provenance.editions.find((e: { name: string }) => e.name === entry.name && !process.env.RR_INPUTS) ?? { cutoff: snapEditionCutoff(snap.generatedAt) };
  const user = { id: "00000000-0000-4000-8000-00000000e2e1", aud: "authenticated", role: "authenticated", email: "editor@example.invalid", app_metadata: {}, user_metadata: {} };
  const session = { access_token: "e2e", refresh_token: "e2e", token_type: "bearer", expires_in: 86400, expires_at: Math.floor(Date.now() / 1000) + 86400, user };
  await page.addInitScript(([k, v]) => window.localStorage.setItem(k, v), ["sb-" + origin.hostname.split(".")[0] + "-auth-token", JSON.stringify(session)]);
  await page.route(origin.origin + "/**", route => { const r = route.request(), u = new URL(r.url()); const one = (row: object) => route.fulfill({ json: /vnd\.pgrst\.object/.test(r.headers().accept ?? "") ? row : [row] });
    if (u.pathname === "/rest/v1/users") return one({ role: "social_editor" }); if (u.pathname === "/rest/v1/user_profiles") return one({ user_id: user.id, display_name: "E", avatar_url: null, timezone: "America/New_York" }); if (u.pathname === "/rest/v1/user_settings") return one({ user_id: user.id }); if (u.pathname === "/auth/v1/user") return route.fulfill({ json: user }); return route.abort(); });
  const weekCalls: { status: number }[] = [];
  await page.route("**/api/v1/social-share/matchup-weeks", route => { const signed = /^Bearer \S+$/.test(route.request().headers().authorization ?? ""); weekCalls.push({ status: signed ? 200 : 401 }); return signed ? route.fulfill({ json: { rows: calendar.rows, cutoff: edition.cutoff } }) : route.fulfill({ status: 401, json: { error: "Sign in." } }); });
  await page.route("**/api/v1/social-share/posts/**", route => route.fulfill({ json: { ...snap, expiresAt: new Date(Date.now() + 600000).toISOString() } }));
  const q = new URLSearchParams({ post: entry.post }); for (const [k, v] of Object.entries(snap.settings)) if (v !== null) q.set(k, String(v));
  await page.goto("/social-share/posts?" + q);
  const square = page.getByTestId("share-square"); await expect(square).toBeVisible({ timeout: 20000 });
  const hasPager = await page.getByTestId("period-pager-label").count() > 0;
  if (hasPager) await expect(page.getByTestId("period-pager-label")).not.toHaveText(/Loading weeks/, { timeout: 10000 });
  await page.waitForTimeout(400);
  const pager: Record<string, unknown> | null = hasPager ? { initial: await readPager(page) } : null;
  const button = page.getByRole("button", { name: "Download PNG", exact: true }); const enabled = await button.isEnabled();
  let png = false;
  if (enabled) { const [d] = await Promise.all([page.waitForEvent("download", { timeout: 15000 }).catch(() => null), button.click()]); if (d) { await d.saveAs(O + "/" + entry.name + (process.env.RR_SUFFIX ?? "") + ".png"); png = true; } }
  else await square.screenshot({ path: O + "/" + entry.name + (process.env.RR_SUFFIX ?? "") + "-preview.png" });
  await page.getByTestId(hasPager ? "period-control" : "share-square").screenshot({ path: O + "/" + entry.name + (process.env.RR_SUFFIX ?? "") + (hasPager ? "-pager.png" : "-card.png") });
  if (pager) {
    const initial = pager.initial as Awaited<ReturnType<typeof readPager>>;
    const first = initial.priorEnabled ? "Prior" : initial.nextEnabled ? "Next" : null, back = first === "Prior" ? "Next" : "Prior";
    if (first) {
      await page.getByRole("button", { name: new RegExp("^" + first + " week") }).click(); await page.waitForTimeout(800); pager["after" + first] = await readPager(page);
      if (await page.getByRole("button", { name: new RegExp("^" + back + " week") }).isEnabled()) { await page.getByRole("button", { name: new RegExp("^" + back + " week") }).click(); await page.waitForTimeout(800); pager["thenBack" + back] = await readPager(page); }
    }
  }
  report.push({ name: entry.name, post: entry.post, editionCutoff: edition.cutoff, weekCalls, pager, enabled, png });
  writeFileSync(O + "/" + (process.env.RR_REPORT ?? "render-report.json"), JSON.stringify(report, null, 1));
});
