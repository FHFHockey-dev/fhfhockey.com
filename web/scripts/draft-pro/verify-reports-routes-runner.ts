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

async function call(path: string, token: string, method = "GET", body?: unknown) {
  const response = await fetch(base + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, json: await response.json() as any };
}

async function serviceRequest(path: string, method: "GET" | "POST" | "PATCH" = "GET", body?: unknown) {
  const response = await fetch(`${gateway}/rest/v1/${path}`, {
    method,
    headers: { Authorization: `Bearer ${service}`, apikey: service, ...(body === undefined ? {} : { "Content-Type": "application/json", Prefer: "return=minimal,resolution=merge-duplicates" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  assert(response.ok, `${method} ${path}: ${response.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

async function setActive(active: boolean) {
  const response = await fetch(`${gateway}/rest/v1/user_entitlements?user_id=eq.${ownerId}&entitlement_key=eq.draft_pro`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${service}`, apikey: service, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ entitlement_status: active ? "active" : "inactive" }),
  });
  assert.equal(response.status, 204);
}

const browser = {
  v: 2 as const,
  draftSettings: { teamCount: 2, rosterConfig: { C: 1, bench: 0, utility: 0 }, leagueType: "points" as const, scoringCategories: { G: 1 }, draftOrder: ["A", "B"], isKeeper: false },
  draftedPlayers: [
    { playerId: "roster", teamId: "A", round: 1, pickInRound: 1, pickNumber: 1 },
    { playerId: "other-roster", teamId: "B", round: 1, pickInRound: 2, pickNumber: 2 },
  ],
  keepers: [], pickOwnerOverrides: {}, pickTrades: [], positionOverrides: {}, customTeamNames: {}, currentPick: 3, isSnakeDraft: true, myTeamId: "A",
  baselineMode: "remaining" as const, needWeightEnabled: false, needAlpha: 0.5, forwardGrouping: "split" as const, personalizeReplacement: false,
  goaliePointValues: {}, sourceControls: { ag_skaters: { isSelected: true, weight: 1 } }, goalieSourceControls: { cullen_goalies: { isSelected: true, weight: 1 } }, customCsvList: [], favorites: [], notes: [], tiers: {}, configured: true,
};
const completeSnapshot = serializeSavedDraft(browser);
const incompleteSnapshot = { ...completeSnapshot, picks: completeSnapshot.picks.slice(0, 1) };
const rosterPlayer = { id: "roster", name: "Roster Player", role: "skater" as const, eligiblePositions: ["C"], teamAbbreviation: "AAA", projectionSeason: "20262027", globalVorp: 12, rankValue: 12, projectedPoints: 100, categoryValues: { G: 20 } };
const schedule = { season: "20262027", gameKey: "477", startWeek: 1, endWeek: 1, lineupMode: "daily" as const, rosterSlots: { C: 1 } };
const reportInput = {
  roster: [rosterPlayer], leagueType: "points" as const, season: "20262027", scoring: { G: 1 }, categoryWeights: { G: 1 }, sourceWeights: completeSnapshot.sourceWeights,
  source: { projection: { id: "public-fixture", version: "v1", origin: "server" as const }, schedule },
};

async function seedReadySchedule() {
  const fetchedAt = new Date().toISOString();
  await serviceRequest("teams", "POST", [
    { id: 1, name: "Alpha", abbreviation: "AAA" },
    { id: 2, name: "Beta", abbreviation: "BBB" },
  ]);
  await serviceRequest("yahoo_matchup_weeks", "POST", { id: 1, game_key: "477", season: "2026", week: 1, start_date: "2026-10-05", end_date: "2026-10-11" });
  const common = { yahoo_matchup_week_id: 1, game_key: "477", season: "2026", week: 1, source_game_id: 9001, source_season_id: 20262027, game_date: "2026-10-05", start_time: "2026-10-05T23:00:00Z", game_type: 2, game_status: "FUT", schedule_status: "OK", mapping_status: "mapped", is_countable: true, source_url: "https://example.invalid/schedule", source_updated_at: fetchedAt, source_metadata: { fixture: true }, fetched_at: fetchedAt };
  await serviceRequest("roster_optimizer_team_games", "POST", [
    { ...common, team_id: 1, team_abbreviation: "AAA", opponent_team_id: 2, opponent_abbreviation: "BBB", home_away: "home" },
    { ...common, team_id: 2, team_abbreviation: "BBB", opponent_team_id: 1, opponent_abbreviation: "AAA", home_away: "away" },
  ]);
}

async function createPrivateDraft() {
  const privateBrowser = {
    ...browser,
    draftedPlayers: browser.draftedPlayers.slice(0, 1), currentPick: 2,
    sourceControls: { custom_csv_1: { isSelected: true, weight: 1 } },
    customCsvList: [{ id: "custom_csv_1", label: "Report private rows", headers: [{ original: "Player", standardized: "name", selected: true }], rows: [{ Player: "Private Fixture", Rank: 1 }] }],
  };
  const normalized = toNormalizedPrivateImports(privateBrowser.customCsvList);
  const snapshot = serializeSavedDraft(privateBrowser);
  const attemptKey = randomUUID();
  const rows = Buffer.from(JSON.stringify(normalized[0].rows));
  const begun = await call("/api/v1/account/draft-pro/private-imports", owner, "POST", { draftId: null, expectedVersion: null, attemptKey, name: normalized[0].name, mapping: { sourceId: normalized[0].sourceId, headers: normalized[0].mapping }, declaredMaxBytes: rows.byteLength });
  assert.equal(begun.status, 201, JSON.stringify(begun.json));
  const upload = begun.json.data.upload;
  const chunkResponse = await fetch(`${base}/api/v1/account/draft-pro/private-imports/${upload.upload_id}/chunks/0`, { method: "PUT", headers: { Authorization: `Bearer ${owner}`, "X-Draft-Pro-Upload-Prefix": upload.storage_prefix, "Content-Type": "application/json" }, body: rows });
  const chunk = await chunkResponse.json();
  assert.equal(chunkResponse.status, 201, JSON.stringify(chunk));
  const staged = await call(`/api/v1/account/draft-pro/private-imports/${upload.upload_id}/stage`, owner, "POST", { chunkPaths: [chunk.data.path] });
  assert.equal(staged.status, 201, JSON.stringify(staged.json));
  const saved = await call("/api/v1/account/draft-pro/drafts", owner, "POST", { name: "Report private draft", snapshot, attemptKey });
  assert.equal(saved.status, 201, JSON.stringify(saved.json));
  const draftId = saved.json.data.id as string;
  const detail = await call(`/api/v1/account/draft-pro/drafts/${draftId}`, owner);
  assert.equal(detail.status, 200, JSON.stringify(detail.json));
  return { draftId, importId: detail.json.data.privateImports[0].id as string, rows: normalized[0].rows, snapshot };
}

async function main() {
  assert.equal((await fetch(`${base}/api/v1/account/draft-pro/reports`)).status, 401);
  assert.equal((await call("/api/v1/account/draft-pro/reports/not-a-uuid", owner)).status, 400);
  assert.equal((await call("/api/v1/account/draft-pro/reports", owner, "POST", { draftId: "not-a-uuid", reportType: "draft_summary", input: reportInput })).status, 400);
  assert.equal((await call("/api/v1/account/draft-pro/reports", owner, "POST", { scenarioId: "not-a-uuid", reportType: "scenario_comparison", input: reportInput })).status, 400);
  await seedReadySchedule();

  const incomplete = await call("/api/v1/account/draft-pro/reports", owner, "POST", { reportType: "draft_summary", input: reportInput, snapshot: incompleteSnapshot });
  assert.equal(incomplete.status, 400, JSON.stringify(incomplete.json));
  assert.equal(incomplete.json.error.code, "saved_input_mismatch");
  const current = await call("/api/v1/account/draft-pro/reports", owner, "POST", { reportType: "draft_summary", input: reportInput, snapshot: completeSnapshot });
  assert.equal(current.status, 201, JSON.stringify(current.json));
  const currentId = current.json.data.id as string;
  const currentPayload = current.json.data.payload;
  assert.equal(currentPayload.reportType, "draft_summary");
  assert.deepEqual(currentPayload.roster.players, [{ id: "roster", name: "Roster Player", positions: ["C"], role: "skater", team: "AAA" }]);
  assert.deepEqual(currentPayload.totals, { rawVorp: 12, projectedPoints: 100, categories: { G: 20 } });
  assert.equal(currentPayload.schedule.state, "ready");
  assert.deepEqual(currentPayload.schedule.window, { startWeek: 1, endWeek: 1, startDate: "2026-10-05", endDate: "2026-10-05" });
  assert.deepEqual(currentPayload.analyticalInput, reportInput);
  assert.deepEqual(currentPayload.provenance.scoring, reportInput.scoring);
  assert.deepEqual(currentPayload.provenance.sourceWeights, reportInput.sourceWeights);
  assert.equal(current.json.data.source_fingerprint, currentPayload.sourceFingerprint);

  const privateDraft = await createPrivateDraft();
  const privateSource = { projection: { id: "private-fixture", version: "v1", origin: "saved_private_import" as const, privateImports: [{ id: privateDraft.importId, contentFingerprint: scenarioFingerprint(privateDraft.rows) }] }, schedule };
  const privateInput = { ...reportInput, sourceWeights: privateDraft.snapshot.sourceWeights, source: privateSource };
  const privateReport = await call("/api/v1/account/draft-pro/reports", owner, "POST", { draftId: privateDraft.draftId, privateImportDraftId: privateDraft.draftId, reportType: "draft_summary", input: privateInput });
  assert.equal(privateReport.status, 201, JSON.stringify(privateReport.json));
  assert.equal(privateReport.json.data.payload.provenance.projectionOrigin, "saved_private_import");
  assert.deepEqual(privateReport.json.data.payload.analyticalInput.source, privateSource);
  assert.deepEqual(privateReport.json.data.payload.totals, currentPayload.totals);

  const summaries = await call("/api/v1/account/draft-pro/reports", owner);
  assert.equal(summaries.status, 200);
  assert.equal(summaries.json.data.length, 2);
  assert(summaries.json.data.some((item: any) => item.id === currentId && item.report_type === "draft_summary"));
  assert.equal(summaries.json.data.some((item: any) => "payload" in item), false);
  const opened = await call(`/api/v1/account/draft-pro/reports/${currentId}`, owner);
  assert.equal(opened.status, 200);
  assert.deepEqual(opened.json.data.payload, currentPayload);
  const stored = await serviceRequest(`draft_pro_reports?id=eq.${privateReport.json.data.id}&select=user_id,draft_id,report_type,source_fingerprint,payload`);
  assert.equal(stored[0].user_id, ownerId);
  assert.equal(stored[0].draft_id, privateDraft.draftId);
  assert.equal(stored[0].report_type, "draft_summary");
  assert.equal(stored[0].source_fingerprint, privateReport.json.data.payload.sourceFingerprint);
  assert.deepEqual(stored[0].payload, privateReport.json.data.payload);

  assert.equal((await call(`/api/v1/account/draft-pro/reports/${currentId}`, other)).status, 404);
  assert.deepEqual((await call("/api/v1/account/draft-pro/reports", other)).json.data, []);
  await setActive(false);
  const retained = await call("/api/v1/account/draft-pro/reports", owner);
  assert.equal(retained.status, 200);
  assert.equal(retained.json.data.length, 2);
  assert.equal(retained.json.data.some((item: any) => "payload" in item), false);
  assert.equal((await call(`/api/v1/account/draft-pro/reports/${currentId}`, owner)).status, 403);
  assert.equal((await call("/api/v1/account/draft-pro/reports", owner, "POST", { reportType: "draft_summary", input: reportInput, snapshot: completeSnapshot })).status, 403);
  await setActive(true);
  const reactivated = await call(`/api/v1/account/draft-pro/reports/${currentId}`, owner);
  assert.equal(reactivated.status, 200);
  assert.deepEqual(reactivated.json.data.payload, currentPayload);
  assert.equal((await call("/api/v1/account/draft-pro/reports", owner)).json.data.length, 2);

  console.log(`reports_routes=passed; current=completed; incomplete=blocked; saved-private=owned; schedule=ready; totals-source-config=retained; foreign=404; inactive=list-only; reactivated=payload; reports=2; report=${currentId}`);
}

main().catch((error) => { console.error(error); process.exit(1); });
