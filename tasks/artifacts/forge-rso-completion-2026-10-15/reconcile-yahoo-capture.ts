/** Offline only. Read retained original Yahoo bytes and selected identity metadata; never construct a service client. */
import { createHash } from "node:crypto";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { parseYahooBoardSettings, YahooLiveDraftError } from "../../../web/lib/integrations/yahoo/liveDraft";
import { classifyCurrentRosterInjuryEvidence, type CurrentRosterInjuryEvidence } from "../../../web/lib/player-forecasts/currentRosterInjuryEvidence";
import { playerForecastSourcePayloadHash } from "../../../web/lib/player-forecasts/sourceSnapshot";
const root = process.argv[2], output = process.argv[3];
if (!root || !output) throw new Error("Require private retained input root and new private output root");
const hash = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
const read = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const requireWeb = createRequire(resolve(__dirname, "../../../web/package.json"));
const ts = requireWeb("typescript");
const parserPins: Record<string, string> = {};
// Extract existing pure declarations to avoid importing their unrelated network/server module initialization.
function declarations(path: string, names: string[]) {
  const bytes = readFileSync(path, "utf8"); parserPins[path] = hash(bytes);
  const source = ts.createSourceFile(path, bytes, ts.ScriptTarget.Latest, true);
  const selected = source.statements.filter((node: any) => names.includes(node.name?.text)
    || node.declarationList?.declarations?.some((d: any) => names.includes(d.name?.text)));
  if (selected.length !== names.length) throw new Error("Pure parser declaration scope changed");
  return selected.map((node: any) => node.getText(source)).join("\n");
}
const source = declarations(resolve(__dirname, "../../../web/lib/integrations/yahoo/starterBoard.ts"),
  ["object", "yahooFields", "yahooValue", "yahooBoardPlayers"])
  + "\n" + declarations(resolve(__dirname, "../../../web/lib/integrations/yahoo/rosterPlanning.ts"), ["numeric", "yahooPlanningPlayers"]);
const sandbox: any = { exports: {}, YahooLiveDraftError };
runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, sandbox);
const { yahooFields: fields, yahooValue: value, yahooPlanningPlayers: players } = sandbox.exports;
const captured = join(root, "yahoo-original-sources-v1");
const allocation = read(join(captured, "allocation.json")), receipt = read(join(captured, "receipt.json"));
if (receipt.status !== "captured_private_sources" || receipt.allocationSHA256 !== hash(readFileSync(join(captured, "allocation.json")))) throw new Error("Capture receipt mismatch");
const ledger = readFileSync(join(captured, "exposure-ledger.jsonl"), "utf8").trim().split("\n").map(line => JSON.parse(line));
const sources = ledger.filter(row => row.action === "source_retained");
if (sources.length !== 4) throw new Error("Expected exact four retained originals");
const payloads = sources.map((row, index) => {
  const bytes = readFileSync(join(captured, `${index + 1}-yahoo.json`));
  if (hash(bytes) !== row.sha256 || bytes.length !== row.bytes) throw new Error("Original source integrity mismatch");
  const ageMs = Date.parse(row.at) - Date.parse(row.responseDate);
  if (!Number.isFinite(ageMs) || Math.abs(ageMs) > 120000) throw new Error("Original HTTP clock mismatch");
  return JSON.parse(bytes.toString("utf8"));
});
const [settingsPayload, rosterPayload, ...candidatePayloads] = payloads;
const league = fields(value(settingsPayload, "league")), team = fields(value(rosterPayload, "team"));
if (league.league_key !== allocation.yahooLeagueKey || team.team_key !== allocation.yahooTeamKey
  || ![true, 1, "1"].includes(team.is_owned_by_current_login)) throw new Error("Owned league/team mismatch");
const rosterRows = players(rosterPayload), candidateRows = candidatePayloads.flatMap((payload: any) => {
  if (value(payload, "league_key") !== allocation.yahooLeagueKey) throw new Error("Candidate scope mismatch");
  return players(payload);
});
if (candidateRows.length > 50 || new Set(candidateRows.map((p: any) => p.player_key)).size !== candidateRows.length) throw new Error("Candidate bound or identity mismatch");
const retained = read(join(root, "loaded-planning-evidence.json"));
const canonical = retained.snapshot.players.map((p: any) => ({ id: /^\d+$/.test(String(p.id)) ? Number(p.id) : p.id,
  snapshotId: p.id, nhlId: p.nhlId, name: p.name, nhlTeamId: p.nhlTeamId }));
if (retained.snapshot.context.teamId !== allocation.teamId || retained.snapshot.context.leagueId !== allocation.leagueId) throw new Error("Canonical context mismatch");
const result = read(join(root, "remaining-input-reads-v1.json")).results.find((row: any) => row.name === "yahoo_fiala_cached_injury");
const wrapped = JSON.parse(result.result.content.find((block: any) => block.type === "text").text).result;
const rowsMatch = wrapped.match(/(\[\{[\s\S]*?\}\])/);
if (!rowsMatch) throw new Error("Retained mapping format changed");
const cachedRows = JSON.parse(rowsMatch[1]);
const verified = cachedRows.filter((row: any) => row.scope_count === 1 && row.reverse_owner_count === 1 && row.game_context_count === 1
  && row.game_key === allocation.gameKey && row.season_id === allocation.targetSeasonId);
const normalize = (name: string) => name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z]/g, "");
const displayName = (row: any) => fields(row.name).full ?? null;
const reconcile = (row: any) => {
  const explicit = verified.filter((m: any) => m.external_player_id === row.player_key);
  const verifiedPlayer = explicit.length === 1 ? canonical.find((p: any) => p.id === explicit[0].canonical_id && p.nhlId === explicit[0].nhl_player_id) : null;
  const nameMatches = canonical.filter((p: any) => normalize(p.name) === normalize(displayName(row) ?? ""));
  return { providerId: row.player_key, name: displayName(row), canonicalId: verifiedPlayer?.id ?? null,
    nhlId: verifiedPlayer?.nhlId ?? null, identityStatus: verifiedPlayer ? "verified_retained_provider_mapping" : "mapping_missing",
    potentialNameMatches: nameMatches, originalStatusFields: Object.fromEntries(["status", "status_full", "injury_note"].map(key => [key, { present: Object.hasOwn(row, key), value: row[key] ?? null }])),
    eligiblePositions: row.eligible_positions ?? null, selectedPosition: row.selected_position ?? null };
};
const roster = rosterRows.map(reconcile), candidates = candidateRows.map(reconcile);
const sourceClock = sources[1];
const cutoff = sourceClock.at;
const injuryEvidence: CurrentRosterInjuryEvidence[] = rosterRows.flatMap((row: any) => {
  const mapped = roster.find((r: any) => r.providerId === row.player_key);
  if (!mapped?.canonicalId || !mapped.nhlId) return [];
  return [{ provider: "yahoo", sourceKind: "original_provider_payload", playerId: mapped.canonicalId,
    nhlPlayerId: mapped.nhlId, seasonId: allocation.targetSeasonId, sourceId: `yahoo-original:${sources[1].sha256}:${row.player_key}`,
    observedAt: new Date(sourceClock.responseDate).toISOString(), capturedAt: sourceClock.at, expiresAt: new Date(Date.parse(sourceClock.responseDate) + 24 * 60 * 60 * 1000).toISOString(),
    contentHash: playerForecastSourcePayloadHash(row), payload: row }];
});
const injuries = injuryEvidence.map(evidence => {
  const p = canonical.find((p: any) => p.id === evidence.playerId);
  return classifyCurrentRosterInjuryEvidence(evidence, { playerId: p.id, nhlPlayerId: p.nhlId, teamId: p.nhlTeamId, yahooPlayerKey: String(evidence.payload.player_key) }, allocation.targetSeasonId, cutoff);
});
const summary = { mode: "offline_original_source_reconciliation", productAdmission: false, captureReceiptSHA256: hash(readFileSync(join(captured, "receipt.json"))),
  allocationSHA256: receipt.allocationSHA256, parserPins, sourceClocks: sources.map(row => ({ sha256: row.sha256, bytes: row.bytes, responseDate: row.responseDate, capturedAt: row.at })),
  owner: receipt.owner, league: { key: league.league_key, name: league.name }, team: { key: team.team_key, name: team.name, owned: true },
  rosterDate: value(rosterPayload, "date"), timeZone: value(settingsPayload, "time_zone") ?? allocation.fallbackTimeZone,
  timeZoneSource: value(settingsPayload, "time_zone") ? "original_settings" : "explicit_allocation_fallback",
  settings: parseYahooBoardSettings(settingsPayload), roster, candidates, availabilityComplete: false,
  candidateLimit: 50, rosterCount: roster.length, retainedRosterCount: retained.snapshot.roster.length,
  verifiedRosterMappings: roster.filter((p: any) => p.canonicalId !== null).length,
  verifiedCandidateMappings: candidates.filter((p: any) => p.canonicalId !== null).length,
  injuryClassifications: injuries, limitations: ["Only retained exact provider mappings bind canonical identities; name matches are diagnostic only.",
    "Two available-player pages are a partial candidate pool; remaining pages are unknown.", "Absent original status fields do not prove healthy or eligible; merged cached injury fields retain unknown field freshness.",
    "Fresh capture does not establish historical Oct12 cutoff knowledge, manager intent, acquisition allowance, forecast readiness, or product admission."] };
mkdirSync(output, { mode: 0o700 });
for (const [name, body] of [["reconciliation.json", summary], ["current-roster-injury-evidence.json", injuryEvidence]]) {
  writeFileSync(join(output, name as string), JSON.stringify(body, null, 2) + "\n", { flag: "wx", mode: 0o600 });
}
console.log(JSON.stringify({ status: "offline_reconciled", rosterCount: roster.length, candidateCount: candidates.length,
  verifiedRosterMappings: summary.verifiedRosterMappings, verifiedCandidateMappings: summary.verifiedCandidateMappings,
  injuryClassifications: injuries.map(row => ({ status: row.status, reason: row.reason })), outputSHA256: hash(readFileSync(join(output, "reconciliation.json"))) }));
