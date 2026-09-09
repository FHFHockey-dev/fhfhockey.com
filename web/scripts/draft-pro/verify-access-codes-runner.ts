import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { chromium } from "playwright";
import { serializeSavedDraft } from "../../lib/draft-pro/savedDrafts";

const base = process.env.NEXT_URL!;
const gateway = process.env.SUPABASE_GATEWAY!;
const owner = process.env.USER_STRIPE!;
const foreign = process.env.USER_ACCESS_CODE_FOREIGN!;
const service = process.env.SERVICE_KEY!;
const ownerId = "00000000-0000-4000-8000-000000000043";
const adminId = process.env.ACCESS_CODE_ADMIN_ID!;
const snapshot = serializeSavedDraft({
  v: 2 as const, configured: true, currentPick: 1, isSnakeDraft: true, myTeamId: "Team 1",
  draftSettings: { teamCount: 2, draftOrder: ["Team 1", "Team 2"], draftOrderMode: "standard", leagueType: "points" as const, rosterConfig: { C: 1, LW: 0, RW: 0, D: 0, G: 0, utility: 0, bench: 0 }, scoringCategories: { GOALS: 3 } },
  draftedPlayers: [], keepers: [], pickOwnerOverrides: {}, pickTrades: [], positionOverrides: {}, customTeamNames: {},
  baselineMode: "remaining" as const, needWeightEnabled: false, needAlpha: 0.5, forwardGrouping: "split" as const, personalizeReplacement: false,
  goaliePointValues: {}, sourceControls: {}, goalieSourceControls: {}, customCsvList: [], favorites: [], notes: [], tiers: {},
});
async function call(path: string, token: string | null, method = "GET", body?: unknown) {
  const response = await fetch(base + path, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { "Content-Type": "application/json" }) }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, json: await response.json().catch(() => ({})) as any };
}
async function rpc(name: string, body: unknown) {
  const response = await fetch(`${gateway}/rest/v1/rpc/${name}`, { method: "POST", headers: { Authorization: `Bearer ${service}`, apikey: service, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  assert.equal(response.status, 200, `${name}: ${response.status} ${await response.text()}`);
  return await response.json();
}
async function serviceRows(path: string) {
  const response = await fetch(`${gateway}/rest/v1/${path}`, { headers: { Authorization: `Bearer ${service}`, apikey: service } });
  assert.equal(response.status, 200, `${path}: ${response.status}`);
  return await response.json() as Array<Record<string, unknown>>;
}
async function main() {
  const code = `local-${randomUUID()}-${randomUUID()}`;
  const hash = createHash("sha256").update(code).digest("hex");
  const codeId = await rpc("issue_draft_pro_access_code", { p_issued_by_user_id: adminId, p_target_user_id: ownerId, p_code_hash: hash, p_reason: "isolated acceptance fixture", p_expires_at: "2027-06-30T00:00:00.000Z" });
  assert.match(String(codeId), /^[0-9a-f-]{36}$/i);
  assert.equal((await call("/api/v1/account/draft-pro/drafts", owner, "POST", { name: "Complimentary retained draft", snapshot, attemptKey: randomUUID() })).status, 403, "A free account saved a Draft Pro draft before redemption.");
  assert.equal((await call("/api/v1/account/draft-pro/access-codes/redeem", null, "POST", { code })).status, 401);
  const foreignResult = await call("/api/v1/account/draft-pro/access-codes/redeem", foreign, "POST", { code });
  assert.equal(foreignResult.status, 400); assert.equal(typeof foreignResult.json.error, "string");
  let limited = false;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const result = await call("/api/v1/account/draft-pro/access-codes/redeem", foreign, "POST", { code: `invalid-${randomUUID()}-${randomUUID()}` });
    if (result.status === 429) { assert.equal(typeof result.json.error, "string"); limited = true; break; }
    assert.equal(result.status, 400);
  }
  assert.equal(limited, true, "The generic access-code attempt limit did not return 429.");
  const attempts = await serviceRows(`draft_pro_access_code_attempts?select=user_id,attempt_count&user_id=eq.00000000-0000-4000-8000-000000000044`);
  assert.equal(attempts.length, 1); assert(Number(attempts[0].attempt_count) <= 8, "The persisted attempt window exceeded its bound.");
  for (const table of ["draft_pro_access_codes", "draft_pro_access_code_attempts"]) for (const token of [null, owner, foreign]) {
    const response = await fetch(`${gateway}/rest/v1/${table}?select=*`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
    assert([401, 403].includes(response.status), `Direct ${table} read returned ${response.status}, expected 401 or 403.`);
  }

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext(); const page = await context.newPage(); page.setDefaultTimeout(30_000);
    await page.addInitScript((token) => localStorage.setItem("sb-127-auth-token", JSON.stringify({ access_token: token, refresh_token: token, token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: "00000000-0000-4000-8000-000000000043", aud: "authenticated", role: "authenticated", email: "stripe-sandbox@example.invalid" } })), owner);
    await page.goto(`${base}/account?section=draft-pro`);
    await page.getByLabel("Draft Pro access code", { exact: true }).fill(code);
    await page.getByRole("button", { name: "Redeem code", exact: true }).click();
    await page.getByRole("status").filter({ hasText: "Access code redeemed. Complimentary Draft Pro access is now active." }).waitFor();
    await context.close();
  } finally { await browser.close(); }
  const created = await call("/api/v1/account/draft-pro/drafts", owner, "POST", { name: "Complimentary retained draft", snapshot, attemptKey: randomUUID() });
  assert.equal(created.status, 201, JSON.stringify(created.json)); const draftId = created.json.data.id;
  const codeRows = await serviceRows(`draft_pro_access_codes?select=redeemed_at,revoked_at,redeemed_by_user_id&id=eq.${codeId}`);
  assert.equal(codeRows.length, 1); assert.equal(codeRows[0].redeemed_by_user_id, ownerId); assert(codeRows[0].redeemed_at);
  assert.equal(await rpc("revoke_draft_pro_access_code", { p_issued_by_user_id: adminId, p_code_id: codeId }), true);
  const revokedRows = await serviceRows(`draft_pro_access_codes?select=redeemed_at,revoked_at&id=eq.${codeId}`);
  assert(revokedRows[0].redeemed_at && revokedRows[0].revoked_at, "Revocation removed the retained access-code audit record.");
  const entitlements = await serviceRows(`user_entitlements?select=entitlement_status,source_reference&user_id=eq.${ownerId}&source_provider=eq.complimentary`);
  assert(entitlements.some((row) => row.entitlement_status === "inactive" && row.source_reference === `draft_pro_access_code:${codeId}`), "Revocation did not lock the complimentary entitlement.");
  const names = await call("/api/v1/account/draft-pro/drafts", owner); assert.equal(names.status, 200); assert(names.json.data.some((draft: { id: string }) => draft.id === draftId), "Revocation did not retain the saved draft name.");
  assert.equal((await call(`/api/v1/account/draft-pro/drafts/${draftId}`, owner)).status, 403, "Revocation did not lock retained Draft Pro data.");
  console.log("access_codes=passed; ui=real-redemption; free=blocked; foreign=generic-denied; limit=429; direct-tables=denied; complimentary=unlocks-api; revoke=locks-retains");
}
main().catch((error) => { console.error(error); process.exit(1); });
