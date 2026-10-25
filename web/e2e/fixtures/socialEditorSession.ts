import { expect, type Page } from "@playwright/test";

/** Synthetic QA only: never point this helper at a real Supabase project or browser profile. */
export const SOCIAL_EDITOR_FIXTURE_URL = "https://social-editor-fixture.supabase.invalid";
export const SOCIAL_EDITOR_FIXTURE_PUBLIC_KEY = "synthetic-social-editor-public-key";
export const SOCIAL_EDITOR_FIXTURE_ORIGIN = "http://127.0.0.1:3140";
export type SocialEditorFixtureRole = "social_editor" | "basic" | "signed-out";

export async function installSocialEditorSession(page: Page, role: SocialEditorFixtureRole = "social_editor") {
  expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toBe(SOCIAL_EDITOR_FIXTURE_URL);
  expect(process.env.NEXT_PUBLIC_SUPABASE_PUBLIC_KEY).toBe(SOCIAL_EDITOR_FIXTURE_PUBLIC_KEY);
  expect(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe(SOCIAL_EDITOR_FIXTURE_PUBLIC_KEY);
  expect(process.env.PLAYWRIGHT_BASE_URL).toBe(SOCIAL_EDITOR_FIXTURE_ORIGIN);
  const id = role === "basic" ? "00000000-0000-4000-8000-000000000002" : "00000000-0000-4000-8000-000000000001";
  const encoded = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = `${encoded({ alg: "HS256", typ: "JWT" })}.${encoded({ sub: id, aud: "authenticated", role: "authenticated", exp: 4102444800, iss: `${SOCIAL_EDITOR_FIXTURE_URL}/auth/v1` })}.synthetic-signature-not-valid`;
  const user = { id, aud: "authenticated", role: "authenticated", email: "editor@fixture.invalid", email_confirmed_at: "2026-01-01T00:00:00.000Z", created_at: "2026-01-01T00:00:00.000Z", user_metadata: { full_name: "Synthetic social editor" }, app_metadata: { provider: "email", providers: ["email"] } };
  const session = role === "signed-out" ? null : { access_token: token, token_type: "bearer", refresh_token: "synthetic-refresh-never-send", expires_in: 3600, expires_at: 4102444800, user };
  const state = { role, authorization: `Bearer ${token}`, roleReads: 0, profileReads: 0, settingsReads: 0, editionRequests: [] as string[], blockedLocalApis: [] as string[], abortedExternal: [] as string[], rejectedBootstrap: [] as string[], syntheticWriteAttempts: [] as string[] };

  await page.addInitScript(({ origin, storageKey, session }) => {
    if (window.location.origin !== origin) return;
    localStorage.removeItem(storageKey);
    if (session) localStorage.setItem(storageKey, JSON.stringify(session));
  }, { origin: SOCIAL_EDITOR_FIXTURE_ORIGIN, storageKey: "sb-social-editor-fixture-auth-token", session });

  await page.context().route("**/*", async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin === SOCIAL_EDITOR_FIXTURE_URL) {
      if (request.method() !== "GET") { state.syntheticWriteAttempts.push(`${request.method()} ${url.pathname}`); return route.abort("blockedbyclient"); }
      if (!session || request.headers().authorization !== state.authorization) { state.rejectedBootstrap.push(url.pathname); return route.abort("blockedbyclient"); }
      if (url.pathname === "/auth/v1/user") return route.fulfill({ json: user });
      let row: object | undefined;
      if (url.pathname === "/rest/v1/users") { state.roleReads++; row = { role: role === "social_editor" ? "social_editor" : null }; }
      if (url.pathname === "/rest/v1/user_profiles") { state.profileReads++; row = { user_id: id, display_name: "Synthetic social editor", avatar_url: null, timezone: "UTC" }; }
      if (url.pathname === "/rest/v1/user_settings") { state.settingsReads++; row = { user_id: id }; }
      if (row && url.searchParams.get("user_id") === `eq.${id}`) {
        const object = request.headers().accept?.includes("vnd.pgrst.object+json");
        return route.fulfill({ json: object ? row : [row], headers: { "Cache-Control": "private, no-store" } });
      }
      state.rejectedBootstrap.push(url.pathname); return route.abort("blockedbyclient");
    }
    if (url.origin !== SOCIAL_EDITOR_FIXTURE_ORIGIN) { state.abortedExternal.push(url.origin + url.pathname); return route.abort("blockedbyclient"); }
    if (url.pathname.startsWith("/api/")) {
      if (url.pathname.startsWith("/api/v1/social-share/")) state.editionRequests.push(url.pathname);
      state.blockedLocalApis.push(`${request.method()} ${url.pathname}`);
      return route.abort("blockedbyclient");
    }
    if (!["GET", "HEAD"].includes(request.method())) { state.blockedLocalApis.push(`${request.method()} ${url.pathname}`); return route.abort("blockedbyclient"); }
    return route.continue();
  });
  await page.context().routeWebSocket("**", socket => {
    const url = new URL(socket.url());
    if (url.origin === SOCIAL_EDITOR_FIXTURE_ORIGIN.replace("http:", "ws:") && url.pathname === "/_next/webpack-hmr") socket.connectToServer();
    else { state.abortedExternal.push(url.origin + url.pathname); socket.close(); }
  });
  page.once("close", () => console.info("social_editor_fixture_summary", JSON.stringify({ role: state.role, roleReads: state.roleReads, profileReads: state.profileReads, settingsReads: state.settingsReads, blockedLocalApis: state.blockedLocalApis, abortedExternal: state.abortedExternal, rejectedBootstrap: state.rejectedBootstrap, syntheticWriteAttempts: state.syntheticWriteAttempts })));
  return state;
}
