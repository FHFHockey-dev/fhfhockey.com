import { expect, type Page, type Route } from "@playwright/test";
import { currentRsoUsePolicy } from "../lib/player-forecasts/rsoUsePolicy";

/** Explicitly synthetic server-selected bridge; never a native target review. */
export const RSO_FIXTURE_BRIDGE = "forge-daily-bridge-v1:e2e-current-read";
export const RSO_FIXTURE_PRINCIPAL = "00000000-0000-4000-8000-000000000001";
const fixtureTimes = new WeakMap<Page, string>();
const fixtureClockRevisions = new WeakMap<Page, number>();
export async function setPlanningTime(page: Page, value: Date | string | number) {
  fixtureTimes.set(page, new Date(value).toISOString());
  // Keep the window and real Worker on the same monotonic clock for publication expiry.
  const fixed = new Date(value).getTime();
  const revision = (fixtureClockRevisions.get(page) ?? 0) + 1;
  fixtureClockRevisions.set(page, revision);
  await page.addInitScript(({ at, revision }) => {
    const state = window as Window & { __rsoFixtureClockRevision?: number };
    // Multiple init scripts have no promised execution order after a reload.
    if ((state.__rsoFixtureClockRevision ?? 0) >= revision) return;
    state.__rsoFixtureClockRevision = revision;
    const NativeDate = Date;
    window.Date = class extends NativeDate {
      constructor(...args: any[]) { super(...(args.length ? args : [at]) as [any]); }
      static now() { return at; }
    } as DateConstructor;
  }, { at: fixed, revision });
}
export async function installPlanningClock(page: Page, options: { time: Date | string | number }) {
  fixtureTimes.set(page, new Date(options.time).toISOString());
  await page.clock.install(options);
}

/** Preserve each scenario's payload/failures while supplying the actual current-read
 * transport contract. Only rows deliberately built with RSO_FIXTURE_BRIDGE receive
 * bridge permission. Native/legacy rows and saved provider labels remain unapproved. */
export async function routeCurrentPlanning(page: Page, handler: (route: Route) => unknown) {
  const install = async (pattern: string, privateRead: boolean) => page.route(pattern, route => {
    const wrapped = new Proxy(route, { get(target, key) {
      if (key === "fulfill") return async (options: Parameters<Route["fulfill"]>[0] = {}) => {
        const body = options.json;
        if (!body?.success || !body.data || (options.status ?? 200) >= 400) return target.fulfill(options);
        const request = target.request(), query = new URL(request.url()).searchParams;
        const scope = privateRead ? request.postDataJSON() : Object.fromEntries(query);
        if (privateRead) {
          expect(request.method()).toBe("POST");
          expect(new URL(request.url()).pathname).toBe("/api/v1/roster-schedule-optimizer/yahoo-current-data");
          const bearer = request.headers().authorization;
          expect(bearer).toMatch(/^Bearer .+\.fixture$/);
          const principal = JSON.parse(Buffer.from(bearer!.split(".")[1], "base64url").toString()).sub;
          if (principal !== RSO_FIXTURE_PRINCIPAL) return target.fulfill({ status: 403, json: { success: false, error: "synthetic scope belongs to another principal" } });
        }
        const evaluatedAt = body.read?.evaluatedAt ?? fixtureTimes.get(page);
        if (!evaluatedAt) throw new Error("Set the synthetic server clock before installing current-read fixtures.");
        const nonce = privateRead ? scope.nonce : request.headers()["x-rso-read-nonce"];
        const data = body.data, existing = data.forecastManifest;
        const forecasts = data.forecasts ?? [];
        const manifest = { version: "planning-forecasts-v1", id: "synthetic-current-read", seasonId: Number(scope.seasonId),
          scheduleRevision: "synthetic-schedule", rosterRevision: "synthetic-roster",
          issuedRevisionIds: [...new Set(forecasts.map((row: { revisionId: string }) => row.revisionId))], baselineChecksum: null,
          requiredOpportunities: forecasts.length, forecastedOpportunities: forecasts.length, exclusionCounts: {}, ...existing,
          asOf: evaluatedAt, rsoUsePolicy: existing?.rsoUsePolicy ?? { version: "rso-target-use-v1", revision: currentRsoUsePolicy().revision,
            bridgeRevisionIds: forecasts.some((row: { revisionId: string }) => row.revisionId === RSO_FIXTURE_BRIDGE) ? [RSO_FIXTURE_BRIDGE] : [] } };
        return target.fulfill({ ...options, json: { ...body, data: { ...data,
          evidence: { schedule: { source: "Complete synthetic schedule fixture", asOf: evaluatedAt,
            seasonId: Number(scope.seasonId), completeness: "complete", limitations: [] }, ...data.evidence }, forecastManifest: manifest },
          read: { nonce, evaluatedAt, ...(body.read ?? {}), ...(privateRead ? { nonce,
            principalId: RSO_FIXTURE_PRINCIPAL, teamId: scope.teamId, leagueId: scope.leagueId,
            seasonId: scope.seasonId, startDate: scope.startDate, endDate: scope.endDate, timeZone: scope.timeZone,
            // Generic fixtures carry public priors, not provider confirmations.
            expiresAt: null } : {}) } } });
      };
      const value = Reflect.get(target, key); return typeof value === "function" ? value.bind(target) : value;
    } });
    return handler(wrapped);
  });
  await install("**/api/v1/roster-schedule-optimizer/data?**", false);
  await install("**/api/v1/roster-schedule-optimizer/yahoo-current-data", true);
}

export async function showScheduleView(page: Page, view: "player" | "position" | "itinerary" | "details") {
  const workspace = page.getByRole("navigation", { name: "Workspace views" });
  if (await workspace.isVisible()) await workspace.getByRole("button", { name: "Itinerary", exact: true }).click();
  const group = page.getByRole("group", { name: "Schedule view", exact: true });
  const button = group.getByRole("button", { name: view === "player" ? /^Show (lineup by player|category lineup comparison)$/
    : view === "position" ? "By position" : view === "itinerary" ? "Streaming itinerary" : "Plan details", exact: true });
  await button.click(); await expect(button).toHaveAttribute("aria-pressed", "true");
  if (view === "player") await expect(page.getByRole("table", { name: "Individual player weekly schedule" })).toBeVisible();
  if (view === "position") await expect(page.getByRole("table", { name: "Lineup by position" })).toBeVisible();
  if (view === "details") await expect(page.getByRole("region", { name: "Plan details", exact: true })).toBeVisible();
}

export async function openDisclosure(page: Page, name: string | RegExp) {
  const summary = page.locator("summary").filter({ hasText: name });
  const details = summary.locator("..");
  if (!await details.evaluate(node => (node as HTMLDetailsElement).open)) await summary.click();
  await expect(details).toHaveAttribute("open", "");
}

export async function expectQualityReadiness(page: Page, available: boolean) {
  await openDisclosure(page, /^More tools$/);
  await openDisclosure(page, /^Planning readiness/);
  const readiness = page.locator("details").filter({ has: page.locator(":scope > summary").getByText("Planning readiness", { exact: true }) });
  await expect(readiness).toContainText(available ? "Player-quality assignment evidence available" : "Schedule-only capacity; player-quality decisions remain unresolved.");
  await page.locator("summary").filter({ hasText: /^More tools$/ }).click();
}
