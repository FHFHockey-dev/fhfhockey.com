import { expect, test } from "@playwright/test";

/** Off-Night Edge in the post library, against a fictional edition. The lead runs this serially at 13.0. */
const supabaseOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "http://supabase.e2e.invalid");
const editorToken = "e2e-fictional-editor-token";
const pick = (nhlId: number, name: string, pct: number | null) => ({ nhlId, name, positions: "C", ownership: pct === null ? { state: "unknown", pct: null, asOf: null } : { state: "known", pct, asOf: "2026-10-31" }, games: 5, fantasyPerGame: 3.2, score: 3.4 });

function edition(dates: "rest-of-week" | "weekly", over: Record<string, unknown> = {}) {
  const generatedAt = new Date().toISOString(), weekly = dates === "weekly";
  return {
    schemaVersion: 1, id: `off-night-edge-${dates}`, post: "off-night-edge", state: "ready", reasons: [] as string[], generatedAt, expiresAt: new Date(Date.parse(generatedAt) + 600000).toISOString(), timeZone: "America/New_York",
    settings: { ownershipCeiling: 50, includeUnknown: "off", dates }, teams: ["NJD", "NYR"], fixture: false,
    evidence: { sources: [{ name: "NHL schedule (Game Grid edition)", tables: ["NHL schedule API"], state: "ready", asOf: "2026-11-01", updatedAt: null }, { name: "Yahoo ownership", tables: ["yahoo_players"], state: "ready", asOf: "2026-10-31", updatedAt: null }],
      sample: "Fictional sample", strength: "All situations", cohort: "Top 2 of 2 teams with games", coverage: { observed: 4, expected: 4, missing: 0, unit: "team games" } },
    data: { dates, weekStart: "2026-10-26", weekEnd: "2026-11-01", countedGames: 2, teamsWithGames: 2, tiedOut: [], ownership: { known: 2, unknown: 1, stale: 0, asOf: "2026-10-31" },
      days: [{ date: "2026-10-31", label: "Sat", leagueGames: 12, offNight: false }, { date: "2026-11-01", label: "Sun", leagueGames: 3, offNight: true }],
      rows: [
        { team: weekly ? "NYR" : "NJD", teamName: "First", rank: 1, score: 7.5, games: 2, offNightGames: 1, gamesByDay: [1, 1], picks: { F: pick(1, "Fictional Forward", 0), D: null }, gaps: { F: null, D: "No D: 2 over 50%, 1 unknown %" } },
        { team: weekly ? "NJD" : "NYR", teamName: "Second", rank: 2, score: 1.5, games: 1, offNightGames: 0, gamesByDay: [1, 0], picks: { F: null, D: pick(2, "Fictional Defenseman", 12) }, gaps: { F: "No F: 3 over 50%", D: null } },
      ] }, ...over,
  };
}

test.beforeEach(async ({ page }) => {
  const user = { id: "00000000-0000-4000-8000-00000000e2e1", aud: "authenticated", role: "authenticated", email: "editor@example.invalid", app_metadata: {}, user_metadata: {} };
  const session = { access_token: editorToken, refresh_token: "e2e-fictional-refresh", token_type: "bearer", expires_in: 365 * 86400, expires_at: Math.floor(Date.now() / 1000) + 365 * 86400, user };
  await page.addInitScript(([key, value]) => window.localStorage.setItem(key, value), [`sb-${supabaseOrigin.hostname.split(".")[0]}-auth-token`, JSON.stringify(session)]);
  await page.context().route("**/*", route => ["127.0.0.1", "localhost"].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
  await page.route(`${supabaseOrigin.origin}/**`, route => {
    const request = route.request(), url = new URL(request.url());
    if (request.method() !== "GET") return route.abort();
    if (url.pathname === "/rest/v1/users") return route.fulfill({ json: /vnd\.pgrst\.object/.test(request.headers().accept ?? "") ? { role: "social_editor" } : [{ role: "social_editor" }] });
    return route.fulfill({ json: [] });
  });
});

test("off-night edge: dates refetch a recomputed order, gaps and 0% print, and export follows the settings", async ({ page }) => {
  const requested: string[] = [];
  await page.route("**/api/v1/social-share/posts/**", route => {
    const url = new URL(route.request().url());
    requested.push(url.search);
    expect(route.request().headers().authorization).toBe(`Bearer ${editorToken}`);
    return route.fulfill({ json: edition(url.searchParams.get("dates") === "weekly" ? "weekly" : "rest-of-week") });
  });
  await page.goto("/social-share/posts?post=off-night-edge");
  const square = page.getByTestId("share-square");
  await expect(square).toBeVisible();
  await expect(square).toContainText("Fictional Forward");
  await expect(square).toContainText("0%");
  await expect(square.getByTestId("off-night-gap").first()).toContainText("No D: 2 over 50%, 1 unknown %");
  await expect(page.getByTestId("post-evidence")).toContainText("Ownership ceiling %: 50");
  await expect(page.getByTestId("post-evidence")).toContainText("Dates: Rest of week");
  await expect(square.getByTestId("off-night-legend")).toContainText("Rest of week");
  await expect(page.getByTestId("post-evidence")).toContainText("Top 2 of 2 teams with games");
  await expect(square).toHaveAttribute("data-export-token", /off-night-edge-rest-of-week\|off-night-edge\|/);
  await expect(page.getByRole("button", { name: "Download PNG", exact: true })).toBeEnabled();

  // A changed setting applies on refresh; until then the old edition's data cannot export under the new label.
  await page.getByLabel("Dates").selectOption("weekly");
  await expect(page.getByRole("button", { name: "Download PNG", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Refresh post", exact: true }).click();
  await expect(square.getByTestId("off-night-legend")).toContainText("Full week");
  await expect(square).toHaveAttribute("data-export-token", /off-night-edge-weekly\|off-night-edge\|/);
  expect(requested.some(search => search.includes("dates=weekly"))).toBe(true);
});

test("off-night edge: partial previews without export, stale shows its reason and no card", async ({ page }) => {
  let body = edition("rest-of-week", { state: "partial", reasons: ["1 qualified skaters have Yahoo ownership older than a day, so they are excluded."] });
  await page.route("**/api/v1/social-share/posts/**", route => route.fulfill({ json: body }));
  await page.goto("/social-share/posts?post=off-night-edge");
  await expect(page.getByTestId("post-watermark")).toHaveText("PARTIAL · NOT FOR EXPORT");
  await expect(page.getByRole("button", { name: "Download PNG", exact: true })).toBeDisabled();
  body = edition("rest-of-week", { state: "stale", data: null, teams: [], reasons: ["Most Yahoo ownership is older than a day (9 of 10 qualified skaters)."] });
  await page.getByRole("button", { name: "Refresh post", exact: true }).click();
  await expect(page.getByTestId("post-unavailable")).toContainText("older than a day");
  await expect(page.getByRole("button", { name: "Download PNG", exact: true })).toBeDisabled();
});
