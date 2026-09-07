import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { restoreBrowserSnapshot, serializeSavedDraft, toNormalizedPrivateImports } from "../../lib/draft-pro/savedDrafts";

const base = process.env.NEXT_URL!;
const gateway = process.env.SUPABASE_GATEWAY!;
const owner = process.env.USER_A!;
const ownerSecond = process.env.USER_A_SECOND!;
const other = process.env.USER_B!;
const service = process.env.SERVICE_KEY!;
const ownerId = "00000000-0000-4000-8000-000000000041";
const call = async (path: string, token: string, method = "GET", body?: unknown) => {
  const response = await fetch(base + path, { method, headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }) }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, json: await response.json() };
};
const browser = {
  v: 2 as const, draftSettings: { teamCount: 2, rosterConfig: { C: 1, bench: 0, utility: 0 }, scoringCategories: { G: 1 }, draftOrder: ["A", "B"], isKeeper: true },
  draftedPlayers: [{ playerId: "11", teamId: "A", round: 1, pickInRound: 1, pickNumber: 1 }], keepers: [{ version: 1, status: "valid", cost: "pick", playerId: "22", teamId: "B", round: 1, pickInRound: 2, pickNumber: 2 }], pickOwnerOverrides: {}, pickTrades: [{ round: 1, pickInRound: 2, currentTeamId: "A" }], positionOverrides: {}, customTeamNames: {}, currentPick: 2, isSnakeDraft: true, myTeamId: "A",
  baselineMode: "remaining" as const, needWeightEnabled: false, needAlpha: 0.5, forwardGrouping: "split" as const, personalizeReplacement: false,
  goaliePointValues: {}, sourceControls: { custom_csv_1: { isSelected: true, weight: 1 } }, goalieSourceControls: { custom_csv_1: { isSelected: true, weight: 1 } },
  customCsvList: [{ id: "custom_csv_1", label: "My CSV", headers: [{ original: "Player", standardized: "name", selected: true }], rows: [{ Player: "A", Rank: 1 }] }],
  favorites: ["player-1"], notes: [{ id: "n1", text: "watch deployment" }], tiers: { elite: ["player-1"] },
};

async function setActive(active: boolean) {
  const response = await fetch(`${gateway}/rest/v1/user_entitlements?user_id=eq.${ownerId}&entitlement_key=eq.draft_pro`, { method: "PATCH", headers: { Authorization: `Bearer ${service}`, apikey: service, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ entitlement_status: active ? "active" : "inactive" }) });
  assert.equal(response.status, 204);
}

async function main() {
  const normalized = toNormalizedPrivateImports(browser.customCsvList);
  const snapshot = serializeSavedDraft(browser);
  const attempt = "55555555-5555-4555-8555-555555555555";
  const begun = await call("/api/v1/account/draft-pro/private-imports", owner, "POST", { draftId: null, expectedVersion: null, attemptKey: attempt, name: normalized[0].name, mapping: { sourceId: normalized[0].sourceId, headers: normalized[0].mapping }, declaredMaxBytes: Buffer.byteLength(JSON.stringify(normalized[0].rows)) });
  assert.equal(begun.status, 201); const upload = begun.json.data.upload;
  const rows = Buffer.from(JSON.stringify(normalized[0].rows));
  const chunkResponse = await fetch(`${base}/api/v1/account/draft-pro/private-imports/${upload.upload_id}/chunks/0`, { method: "PUT", headers: { Authorization: `Bearer ${owner}`, "X-Draft-Pro-Upload-Prefix": upload.storage_prefix, "Content-Type": "application/json" }, body: rows });
  const put = await chunkResponse.json(); assert.equal(chunkResponse.status, 201, JSON.stringify(put));
  const staged = await call(`/api/v1/account/draft-pro/private-imports/${upload.upload_id}/stage`, owner, "POST", { chunkPaths: [put.data.path] }); assert.equal(staged.status, 201);
  const saved = await call("/api/v1/account/draft-pro/drafts", owner, "POST", { name: "Route fixture", snapshot, attemptKey: attempt }); assert.equal(saved.status, 201);
  const id = saved.json.data.id; const detail = await call(`/api/v1/account/draft-pro/drafts/${id}`, ownerSecond); assert.equal(detail.status, 200); assert.deepEqual(detail.json.data.snapshot, snapshot);
  const importId = detail.json.data.privateImports[0].id;
  const read = await fetch(`${base}/api/v1/account/draft-pro/drafts/${id}/imports/${importId}?ordinal=0`, { headers: { Authorization: `Bearer ${ownerSecond}` } });
  if (read.status !== 200) throw new Error(`private chunk ${read.status}: ${await read.text()}`); const bytes = new Uint8Array(await read.arrayBuffer()); assert.equal(createHash("sha256").update(bytes).digest("hex"), read.headers.get("x-draft-pro-sha256")); const downloadedRows = JSON.parse(Buffer.from(bytes).toString()); assert.deepEqual(downloadedRows, normalized[0].rows);
  const restored = restoreBrowserSnapshot(detail.json.data.snapshot, [{ id: importId, name: detail.json.data.privateImports[0].name, sourceId: "custom_csv_1", mapping: detail.json.data.privateImports[0].mapping.headers, rows: downloadedRows }]);
  assert.deepEqual(restored.customCsvList[0].rows, downloadedRows);
  assert.deepEqual(restored.draftSettings, browser.draftSettings);
  assert.deepEqual(restored.draftedPlayers, browser.draftedPlayers);
  assert.deepEqual(restored.keepers, browser.keepers);
  assert.deepEqual(restored.pickTrades, browser.pickTrades);
  assert.deepEqual(restored.sourceControls, browser.sourceControls);
  assert.deepEqual(restored.favorites, browser.favorites);
  assert.deepEqual(restored.notes, browser.notes);
  assert.deepEqual(restored.tiers, browser.tiers);
  assert.notEqual((await call(`/api/v1/account/draft-pro/drafts/${id}`, other)).status, 200); assert.notEqual((await fetch(`${base}/api/v1/account/draft-pro/drafts/${id}/imports/${importId}?ordinal=0`, { headers: { Authorization: `Bearer ${other}` } })).status, 200);
  await setActive(false); const names = await call("/api/v1/account/draft-pro/drafts", ownerSecond); assert.equal(names.status, 200); assert.equal(names.json.data[0].name, "Route fixture"); assert.equal("snapshot" in names.json.data[0], false); assert.equal("privateImports" in names.json.data[0], false); assert.equal((await call(`/api/v1/account/draft-pro/drafts/${id}`, ownerSecond)).status, 403); assert.equal((await call(`/api/v1/account/draft-pro/drafts/${id}`, ownerSecond, "PUT", { name: "blocked", snapshot, expectedVersion: 0, attemptKey: "33333333-3333-4333-8333-333333333333" })).status, 403); assert.equal((await fetch(`${base}/api/v1/account/draft-pro/drafts/${id}/imports/${importId}?ordinal=0`, { headers: { Authorization: `Bearer ${ownerSecond}` } })).status, 403);
  await setActive(true); assert.equal((await call(`/api/v1/account/draft-pro/drafts/${id}`, ownerSecond)).status, 200); const reread = await fetch(`${base}/api/v1/account/draft-pro/drafts/${id}/imports/${importId}?ordinal=0`, { headers: { Authorization: `Bearer ${ownerSecond}` } }); assert.equal(reread.status, 200); assert.deepEqual(Buffer.from(await reread.arrayBuffer()), bytes); const conflict = await call(`/api/v1/account/draft-pro/drafts/${id}`, ownerSecond, "PUT", { name: "conflict", snapshot, expectedVersion: 99, attemptKey: "44444444-4444-4444-8444-444444444444" }); assert.equal(conflict.status, 409);
  console.log(`routes=passed; draft=${id}; imports=1; conflict=${conflict.status}; restored=browser`);
}
main().catch((error) => { console.error(error); process.exit(1); });
