import { expect, test, type Page } from "@playwright/test";

/*
 * Player vs Player (SS 5.0), run serially by the lead at 13.0. The post route is served a fictional snapshot, so this
 * proves the shell and card only: no real player, post or URL appears here, and nothing reaches Supabase.
 * Run the dev server and this spec with NEXT_PUBLIC_SUPABASE_URL set to a fictional .invalid host, as for social-share.spec.ts.
 */
const editorToken = "e2e-fictional-editor-token";
const supabaseOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "http://supabase.e2e.invalid");

async function signIn(page: Page) {
  // Never against a real project: the fixture host must be a reserved .invalid name, as in social-share.spec.ts.
  expect(supabaseOrigin.hostname.endsWith(".invalid")).toBe(true);
  const user = { id: "00000000-0000-4000-8000-00000000e2e1", aud: "authenticated", role: "authenticated", email: "editor@example.invalid", app_metadata: {}, user_metadata: {} };
  const expiresAt = Math.floor(Date.now() / 1000) + 365 * 86400;
  const session = { access_token: editorToken, refresh_token: "e2e-fictional-refresh", token_type: "bearer", expires_in: 365 * 86400, expires_at: expiresAt, user };
  await page.addInitScript(([key, value]) => window.localStorage.setItem(key, value), [`sb-${supabaseOrigin.hostname.split(".")[0]}-auth-token`, JSON.stringify(session)]);
  await page.route(`${supabaseOrigin.origin}/**`, route => {
    const request = route.request(), url = new URL(request.url());
    if (request.method() !== "GET") return route.abort();
    const one = (row: object) => route.fulfill({ json: /vnd\.pgrst\.object/.test(request.headers().accept ?? "") ? row : [row] });
    if (url.pathname === "/rest/v1/users") return one({ role: "social_editor" });
    if (url.pathname === "/rest/v1/user_profiles") return one({ user_id: user.id, display_name: "Fictional editor", avatar_url: null, timezone: "America/New_York" });
    if (url.pathname === "/rest/v1/user_settings") return one({ user_id: user.id });
    if (url.pathname === "/auth/v1/user") return route.fulfill({ json: user });
    return route.abort();
  });
}

const metric = (id: string, label: string, a: string, b: string, higher: "a" | "b" | "tie" | null) => ({ id, label, source: "wgo", higher,
  a: { value: Number(a), shown: a, observed: 10, expected: 10, missing: 0, admitted: true }, b: { value: Number(b), shown: b, observed: 6, expected: 6, missing: 0, admitted: true } });
const longest = (text: string, limit: number) => text.padEnd(limit, " and more").slice(0, limit);
const claim = (id: string, over: Record<string, unknown>) => ({ id, players: [{ id: 9000001, name: "Alpha Fake" }, { id: 9000002, name: "Beta Fake" }], url: `https://www.reddit.com/r/fake/comments/${id}/`.padEnd(200, "a"), date: "2026-10-20", platform: "reddit", claimKind: "paraphrased", claim: longest("A fictional poster prefers one fictional player over another for a long and carefully worded reason", 240), favorsPlayerId: 9000001, selectionRationale: "A fictional thread asked this exact question, and it is the longest allowed rationale so the layout is tested at its limit, near the maximum.", limitations: "One fictional thread with a small audience, self-selected posters and no sampling frame of any kind, so it stands for nobody but the people in it here.", ...over });
const sides = { a: { playerId: 9000001, name: "Alpha Fake", group: "F", team: "NJD", appearances: 10, requested: 10, short: false, firstDate: "2026-10-01", lastDate: "2026-10-30" }, b: { playerId: 9000002, name: "Beta Fake", group: "F", team: "NYI", appearances: 6, requested: 10, short: true, firstDate: "2026-10-05", lastDate: "2026-10-29" } };
const metrics = ["Goals", "Assists", "Points", "SOG", "Hits", "Blocks", "BSH", "TOI", "ixG (NST)", "iSCF (NST)"].map((label, index) => metric(label, label, "1.25", "0.75", index % 2 ? "b" : "a"));
const settingsKey = "9000001-9000002|l10|per-game|all|90";

function snapshot(claims: ReturnType<typeof claim>[], kind: string, over: Record<string, unknown> = {}) {
  const generatedAt = new Date().toISOString();
  return { schemaVersion: 1, id: `player-vs-player-${Date.now().toString(36)}`, post: "player-vs-player", state: "ready", reasons: [], generatedAt, expiresAt: new Date(Date.now() + 600000).toISOString(), timeZone: "America/New_York", teams: [], fixture: true,
    settings: { pair: "manual", playerA: 9000001, playerB: 9000002, window: "l10", basis: "per-game", strength: "all", minCoverage: 90 },
    evidence: { sources: [{ name: "Fictional fixture", tables: [], state: "ready", asOf: "2026-10-30", updatedAt: null }], sample: "Last 10 appearances: Alpha Fake 10 appearances; Beta Fake 6 of 10 appearances", strength: "All situations", cohort: "Two selected players, not a league ranking", coverage: { observed: 20, expected: 20, missing: 0, unit: "team games" } },
    data: { settingsKey, through: "2026-10-30", season: 20262027, windowLabel: "Last 10 appearances", basisLabel: "Per appearance", strengthLabel: "All situations", ...sides, metrics, notes: ["Samples differ: Alpha Fake 10, Beta Fake 6 appearances."],
      discussion: { headline: "No consensus established", kind, note: "The reviewed posts here disagree.", caveat: claims.length ? "Hand-picked posts. Not a market price, a poll or a consensus." : null, claims, shown: claims.slice(0, 2), rationales: [...new Set(claims.map(entry => entry.selectionRationale))] },
      selection: { sourced: claims.length > 0, rationales: [...new Set(claims.map(entry => entry.selectionRationale))] } }, ...over };
}
/** TJ's bar: the body fills, nothing clips, and no empty band over about 40px at 1080. */
async function expectFills(page: Page) {
  const fit = await page.locator("[class*=postBody]").evaluate(body => {
    const scale = body.getBoundingClientRect().height / body.clientHeight;
    const parts = [...(body.firstElementChild as Element).children].map(part => part.getBoundingClientRect());
    const bottom = body.getBoundingClientRect().bottom;
    const gaps = parts.slice(1).map((part, index) => part.top - parts[index].bottom);
    return { clipped: body.scrollHeight > body.clientHeight + 1, band: Math.max(bottom - parts[parts.length - 1].bottom, ...gaps) / scale };
  });
  expect(fit.clipped, "the longest allowed content must fit the square").toBe(false);
  expect(fit.band, "no empty band over about 40px").toBeLessThanOrEqual(40);
}
async function open(page: Page, body: unknown) {
  await signIn(page);
  await page.route("**/api/v1/social-share/posts/player-vs-player**", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) }));
  await page.goto("/social-share/posts?post=player-vs-player&playerA=9000001&playerB=9000002");
  await expect(page.getByTestId("share-square")).toBeVisible();
}

test.describe("Player vs Player post", () => {
  test("conflicting posts print no consensus, both sides and their URLs, and fit the square at the limit", async ({ page }) => {
    const claims = [claim("fake1", {}), claim("fake2", { favorsPlayerId: 9000002, claimKind: "quoted", platform: "x", url: "https://x.com/fake/status/2" }), claim("fake3", {})];
    await open(page, snapshot(claims, "conflicting"));
    const discussion = page.getByTestId("pvp-discussion");
    await expect(discussion.getByRole("heading", { name: "No consensus established" })).toBeVisible();
    await expect(discussion).toContainText("https://www.reddit.com/r/fake/comments/fake1");
    await expect(discussion).toContainText("https://x.com/fake/status/2");
    await expect(discussion).toContainText("Paraphrased");
    await expect(discussion).toContainText("Quoted");
    await expect(discussion).not.toContainText(/\d+%/);
    await expect(page.getByTestId("pvp-legend")).toContainText("not a market price");
    await expect(page.getByTestId("share-square")).toHaveAttribute("aria-label", /comments\/fake3/);
    await expect(page.getByTestId("post-evidence")).toContainText("Beta Fake 6 of 10");
    await expect(discussion.getByRole("heading")).toHaveCSS("font-size", "34px");
    const [left, right] = await page.getByTestId("pvp-bar").all();
    const widths = [(await left.boundingBox())!.width, (await right.boundingBox())!.width];
    expect(widths[0] / widths[1], "bars are sized by each side's share").toBeCloseTo(1.25 / 0.75, 1);
    await expectFills(page);
  });
  test("no discussion on file still prints no consensus, and the stats fill the body", async ({ page }) => {
    await open(page, snapshot([], "empty"));
    const discussion = page.getByTestId("pvp-discussion");
    await expect(discussion).toHaveAttribute("data-kind", "empty");
    await expect(discussion).toContainText("No consensus established");
    await expect(discussion.getByRole("heading")).toHaveCSS("font-size", "17px");
    await expect(page.getByTestId("pvp-legend")).toContainText("No posts on file");
    await expectFills(page);
  });
  test("a power-play view with one stat row still fills the body", async ({ page }) => {
    const base = snapshot([], "empty");
    await open(page, { ...base, data: { ...base.data, metrics: metrics.slice(0, 1) } });
    await expect(page.getByTestId("pvp-stats")).toBeVisible();
    await expectFills(page);
  });
  test("a blocked post shows why, with no card and no export", async ({ page }) => {
    await open(page, snapshot([], "empty", { state: "blocked", reasons: ["Enter two NHL player ids, or choose a sourced pair."], data: null }));
    await expect(page.getByTestId("post-unavailable")).toContainText("Enter two NHL player ids");
    await expect(page.getByRole("button", { name: "Download PNG" })).toBeDisabled();
  });
});
