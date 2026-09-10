import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { serializeSavedDraft, toNormalizedPrivateImports } from "../../lib/draft-pro/savedDrafts";
import { scenarioFingerprint } from "../../lib/draft-pro/scenarios";

const base = process.env.NEXT_URL!;
const gateway = process.env.SUPABASE_GATEWAY!;
const owner = process.env.USER_A!;
const other = process.env.USER_B!;
const service = process.env.SERVICE_KEY!;
const ownerId = "00000000-0000-4000-8000-000000000041";
const otherId = "00000000-0000-4000-8000-000000000042";

async function call(path: string, token: string, method = "GET", body?: unknown) {
  const response = await fetch(base + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, json: await response.json() };
}

async function setActive(userId: string, active: boolean) {
  const response = await fetch(`${gateway}/rest/v1/user_entitlements?user_id=eq.${userId}&entitlement_key=eq.draft_pro`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${service}`, apikey: service, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ entitlement_status: active ? "active" : "inactive" }),
  });
  assert.equal(response.status, 204);
}

const browser = {
  v: 2 as const,
  draftSettings: { teamCount: 2, rosterConfig: { C: 1, bench: 0, utility: 0 }, scoringCategories: { G: 1 }, draftOrder: ["A", "B"], isKeeper: false },
  draftedPlayers: [{ playerId: "11", teamId: "A", round: 1, pickInRound: 1, pickNumber: 1 }], keepers: [], pickOwnerOverrides: {}, pickTrades: [], positionOverrides: {}, customTeamNames: {}, currentPick: 2, isSnakeDraft: true, myTeamId: "A",
  baselineMode: "remaining" as const, needWeightEnabled: false, needAlpha: 0.5, forwardGrouping: "split" as const, personalizeReplacement: false,
  goaliePointValues: {}, sourceControls: { custom_csv_1: { isSelected: true, weight: 1 } }, goalieSourceControls: { custom_csv_1: { isSelected: true, weight: 1 } },
  customCsvList: [{ id: "custom_csv_1", label: "Scenario private rows", headers: [{ original: "Player", standardized: "name", selected: true }], rows: [{ Player: "Private Fixture", Rank: 1 }] }],
  favorites: ["player-1"], notes: [], tiers: {},
};

const player = (id: string, name: string, globalVorp: number, points: number, goals: number) => ({
  id, name, role: "skater" as const, eligiblePositions: ["C"], teamAbbreviation: "AAA", projectionSeason: "20262027",
  globalVorp, rankValue: globalVorp, projectedPoints: points, categoryValues: { G: goals },
});
const scenario = (origin: "server" | "saved_private_import", imports?: Array<{ id: string; contentFingerprint: string }>) => ({
  roster: [player("roster", "Roster Player", 12, 100, 20)], candidateA: player("candidate-a", "Candidate A", 5, 40, 5), candidateB: player("candidate-b", "Candidate B", 3, 30, 3),
  leagueType: "points" as const, categoryWeights: { G: 1 }, positionNeeds: { C: 1 },
  source: { projection: { id: origin === "server" ? "public-fixture" : "private-fixture", version: "v1", origin, ...(imports ? { privateImports: imports } : {}) }, schedule: { season: "20262027", startWeek: 1, endWeek: 1, lineupMode: "daily" as const, rosterSlots: { C: 1 } } },
});

async function saveDraft(token: string, name: string, snapshot: unknown, attemptKey = randomUUID()) {
  const response = await call("/api/v1/account/draft-pro/drafts", token, "POST", { name, snapshot, attemptKey });
  assert.equal(response.status, 201, JSON.stringify(response.json));
  return response.json.data.id as string;
}

async function main() {
  const anonymous = await fetch(`${base}/api/v1/account/draft-pro/scenarios`);
  assert.equal(anonymous.status, 401);

  const normalized = toNormalizedPrivateImports(browser.customCsvList);
  const snapshot = serializeSavedDraft(browser);
  const attemptKey = randomUUID();
  const begun = await call("/api/v1/account/draft-pro/private-imports", owner, "POST", { draftId: null, expectedVersion: null, attemptKey, name: normalized[0].name, mapping: { sourceId: normalized[0].sourceId, headers: normalized[0].mapping }, declaredMaxBytes: Buffer.byteLength(JSON.stringify(normalized[0].rows)) });
  assert.equal(begun.status, 201, JSON.stringify(begun.json));
  const upload = begun.json.data.upload;
  const bytes = Buffer.from(JSON.stringify(normalized[0].rows));
  const chunk = await fetch(`${base}/api/v1/account/draft-pro/private-imports/${upload.upload_id}/chunks/0`, { method: "PUT", headers: { Authorization: `Bearer ${owner}`, "X-Draft-Pro-Upload-Prefix": upload.storage_prefix, "Content-Type": "application/json" }, body: bytes });
  const chunkJson = await chunk.json();
  assert.equal(chunk.status, 201, JSON.stringify(chunkJson));
  const staged = await call(`/api/v1/account/draft-pro/private-imports/${upload.upload_id}/stage`, owner, "POST", { chunkPaths: [chunkJson.data.path] });
  assert.equal(staged.status, 201, JSON.stringify(staged.json));
  const draftId = await saveDraft(owner, "Scenario fixture", snapshot, attemptKey);
  const detail = await call(`/api/v1/account/draft-pro/drafts/${draftId}`, owner);
  assert.equal(detail.status, 200);
  const importId = detail.json.data.privateImports[0].id as string;
  const baselineSnapshot = detail.json.data.snapshot;
  const otherDraftId = await saveDraft(other, "Other scenario fixture", snapshot);
  const imports = [{ id: importId, contentFingerprint: scenarioFingerprint(normalized[0].rows) }];

  const publicAnalysis = await call("/api/v1/account/draft-pro/scenarios", owner, "POST", { action: "analyze", draftId, scenario: scenario("server") });
  assert.equal(publicAnalysis.status, 200, JSON.stringify(publicAnalysis.json));
  assert.equal(publicAnalysis.json.data.baseline.rawVorp, 12);
  assert.equal(publicAnalysis.json.data.baseline.projectedPoints, 100);
  assert.equal(publicAnalysis.json.data.candidates[0].rawVorpAfter, 17);
  assert.equal(publicAnalysis.json.data.candidates[0].projectedPointsAfter, 140);
  assert.deepEqual(publicAnalysis.json.data.candidates[0].categories.G, { baseline: 20, after: 25, delta: 5, direction: "higher", state: "available" });
  assert.equal(publicAnalysis.json.data.schedule.state, "schedule_unavailable");
  const duplicateRoster = scenario("server");
  duplicateRoster.roster.push({ ...duplicateRoster.roster[0], name: "Duplicate roster player" });
  assert.equal((await call("/api/v1/account/draft-pro/scenarios", owner, "POST", { action: "analyze", scenario: duplicateRoster })).status, 400);

  const categoryAnalysis = await call("/api/v1/account/draft-pro/scenarios", owner, "POST", { action: "analyze", scenario: { ...scenario("server"), leagueType: "categories" } });
  assert.equal(categoryAnalysis.status, 200);
  assert.equal(categoryAnalysis.json.data.baseline.categories.G, 20);
  assert.equal(categoryAnalysis.json.data.candidates[1].categories.G.after, 23);

  const publicSaved = await call("/api/v1/account/draft-pro/scenarios", owner, "POST", { action: "save", name: "Public baseline", draftId, scenario: scenario("server") });
  assert.equal(publicSaved.status, 201, JSON.stringify(publicSaved.json));
  const scenarioId = publicSaved.json.data.id as string;
  assert.equal((await call("/api/v1/account/draft-pro/scenarios", owner, "POST", { action: "analyze", draftId, scenario: scenario("saved_private_import", [...imports, ...imports]) })).status, 400);
  const privateAnalysis = await call("/api/v1/account/draft-pro/scenarios", owner, "POST", { action: "analyze", draftId, scenario: scenario("saved_private_import", imports) });
  assert.equal(privateAnalysis.status, 200, JSON.stringify(privateAnalysis.json));
  const privateSaved = await call("/api/v1/account/draft-pro/scenarios", owner, "POST", { action: "save", name: "Private baseline", draftId, scenario: scenario("saved_private_import", imports) });
  assert.equal(privateSaved.status, 201, JSON.stringify(privateSaved.json));

  assert.equal((await call(`/api/v1/account/draft-pro/scenarios/${scenarioId}`, other)).status, 404);
  const foreignDraft = await call("/api/v1/account/draft-pro/scenarios", owner, "POST", { action: "analyze", draftId: otherDraftId, scenario: scenario("server") });
  assert.equal(foreignDraft.status, 404);
  const changed = await call("/api/v1/account/draft-pro/scenarios", owner, "POST", { action: "analyze", draftId, scenario: scenario("saved_private_import", [{ id: importId, contentFingerprint: scenarioFingerprint([{ changed: true }]) }]) });
  assert.equal(changed.status, 403);
  const unattached = await call("/api/v1/account/draft-pro/scenarios", owner, "POST", { action: "analyze", draftId: await saveDraft(owner, "No attached import", snapshot), scenario: scenario("saved_private_import", imports) });
  assert.equal(unattached.status, 403);
  const deleted = await fetch(`${gateway}/rest/v1/draft_pro_private_imports?id=eq.${importId}`, { method: "PATCH", headers: { Authorization: `Bearer ${service}`, apikey: service, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ deleted_at: new Date().toISOString() }) });
  assert.equal(deleted.status, 204);
  assert.equal((await call("/api/v1/account/draft-pro/scenarios", owner, "POST", { action: "analyze", draftId, scenario: scenario("saved_private_import", imports) })).status, 403);

  const unchanged = await call(`/api/v1/account/draft-pro/drafts/${draftId}`, owner);
  assert.equal(unchanged.status, 200);
  assert.deepEqual(unchanged.json.data.snapshot, baselineSnapshot);
  assert.deepEqual(unchanged.json.data.snapshot.draftedPlayers, baselineSnapshot.draftedPlayers);

  await setActive(ownerId, false);
  assert.equal((await call("/api/v1/account/draft-pro/scenarios", owner, "POST", { action: "analyze", scenario: scenario("server") })).status, 403);
  assert.equal((await call("/api/v1/account/draft-pro/scenarios", owner, "POST", { action: "save", name: "blocked", scenario: scenario("server") })).status, 403);
  assert.equal((await call(`/api/v1/account/draft-pro/scenarios/${scenarioId}`, owner)).status, 403);
  const listWhileInactive = await call("/api/v1/account/draft-pro/scenarios", owner);
  assert.equal(listWhileInactive.status, 200);
  assert(listWhileInactive.json.data.some((item: { id: string; name: string }) => item.id === scenarioId && item.name === "Public baseline"));
  assert.equal("input" in listWhileInactive.json.data[0], false);
  assert.equal("result" in listWhileInactive.json.data[0], false);
  await setActive(ownerId, true);
  const reactivated = await call(`/api/v1/account/draft-pro/scenarios/${scenarioId}`, owner);
  assert.equal(reactivated.status, 200);
  assert.equal(reactivated.json.data.name, "Public baseline");

  console.log(`scenarios_routes=passed; public=points-and-categories; private=owned-changed-deleted-unattached; lifecycle=inactive-list-reactivated; snapshot=unchanged; draft=${draftId}`);
}

main().catch((error) => { console.error(error); process.exit(1); });
