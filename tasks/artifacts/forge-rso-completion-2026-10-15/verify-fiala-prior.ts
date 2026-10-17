import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { baselineDefinitionHash } from "../../../web/lib/player-forecasts/baselinePolicy";
import { baselineAppearanceFromBoxscore, baselineHistoricalSources, baselineHistoricalSourceLimitations,
  verifyBaselineHistoricalSources } from "../../../web/lib/player-forecasts/baselineSourceLineage";
import { buildNativeSkaterBaselineSnapshot, type NativeSkaterBaselineObservation } from "../../../web/lib/player-forecasts/baselineGeneration";
import { playerForecastSourcePayloadHash as hash } from "../../../web/lib/player-forecasts/sourceSnapshot";
import { timestampMicros } from "../../../web/lib/projections/evidenceTime";
import { previewNativeBaseline } from "../../../web/scripts/preview-native-baseline";

const root = "/Users/tim/Documents/FHFH-private/forge-rso-completion-20261016-v1";
const output = join(root, "fiala-prior-preview-v1");
const sha = (data: string | Buffer) => createHash("sha256").update(data).digest("hex");
const inputHashes: Record<string, string> = {};
function read(name: string) {
  const bytes = readFileSync(join(root, name)); inputHashes[name] = sha(bytes); return JSON.parse(bytes.toString("utf8"));
}
function requireValue(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
const sqlClock = (value: string) => value.replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00");

async function main() {
  const retained = read("fiala-retained-boxscore-reuse-v1.json");
  const allocation = read("fiala-prior-development-allocation-v1.json");
  const assembled = read("native-assembled-inputs-v2.json");
  const current = read("loaded-planning-evidence.json").snapshot;
  const teamScope = read("native-mean-previews-v2/skaters-team-26-scope.json");
  const collected = read("fiala-prior-landings-v1/receipts.json");
  const now = new Date(), cutoffAt = now.toISOString(), seasonId = 20262027;
  const player = current.players.find((row: any) => row.id === "9572");
  const coverage = assembled.coverage.find((row: any) => row.playerId === 9572);
  requireValue(player?.nhlId === 8477942 && player.nhlTeamId === 26 && player.playerClass === "skater"
    && typeof player.rosterRevision === "string" && player.rosterRevision.length > 0
    && coverage?.nhlPlayerId === player.nhlId && coverage.verifiedAppearances === 0, "Current Fiala binding/absence metadata mismatch");
  requireValue(retained.records.length === 20 && allocation.games.length === 20 && collected.receipts.length === 20
    && collected.failures.length === 0 && collected.unattemptedRequests === 0, "Exact approved twenty-record scope is incomplete");
  const records = new Map<number, any>(retained.records.map((row: any) => [row.gameId, row]));
  requireValue(records.size === 20 && new Set(allocation.games.map((row: any) => row.gameId)).size === 20, "Duplicate prior source identity");
  const metadata = retained.metadata;
  const games = new Map<number, any>(metadata.fiala_prior_games.map((game: any) => [game.id, { ...game, startTime: sqlClock(game.startTime) }]));
  const rosters = new Map<number, any>(metadata.fiala_prior_roster.map((row: any) => [row.game_id, row]));
  const rawMetadata = new Map<number, any>(metadata.fiala_prior_raw_metadata.map((row: any) => [row.game_id, row]));
  requireValue(games.size === 20 && rosters.size === 20 && rawMetadata.size === 20, "Canonical prior metadata is incomplete/ambiguous");
  const landings = new Map<string, any>();
  for (const receipt of collected.receipts) {
    requireValue(!landings.has(receipt.url) && /^[a-f0-9]{64}$/.test(receipt.bodySha256)
      && sha(receipt.rawBody) === receipt.bodySha256 && timestampMicros(receipt.capturedAt) !== null
      && timestampMicros(receipt.capturedAt)! <= timestampMicros(cutoffAt)!, "Invalid original landing receipt/hash/clock");
    landings.set(receipt.url, receipt);
  }
  const histories: any[] = [], historicalRosters: any[] = [], appearances: any[] = [], derivedLandings: any[] = [];
  for (const allowed of allocation.games) {
    const record = records.get(allowed.gameId), game = games.get(allowed.gameId), roster = rosters.get(allowed.gameId), raw = rawMetadata.get(allowed.gameId);
    requireValue(record && game && roster && raw && record.gameId === game.id && record.date === game.date
      && allowed.date === game.date && allowed.seasonId === 20252026 && record.seasonId === 20252026
      && game.seasonId === 20252026 && game.type === 2 && game.date >= "2025-10-01" && game.date <= "2026-01-02"
      && allowed.nhlPlayerId === player.nhlId && record.nhlPlayerId === player.nhlId && roster.player_id === player.nhlId
      && record.historicalTeamId === roster.team_id && [game.homeTeamId, game.awayTeamId].includes(roster.team_id)
      && roster.season_id === game.seasonId && roster.game_date === game.date
      && raw.season_id === game.seasonId && Number.isSafeInteger(raw.id) && raw.id > 0
      && /^[a-f0-9]{64}$/.test(raw.payload_hash), "Prior allocation/canonical/raw metadata identity mismatch");
    requireValue(sha(record.rawBody) === record.sha256 && Buffer.byteLength(record.rawBody) === record.bytes
      && hash(JSON.parse(record.rawBody)) === hash(record.payload)
      && timestampMicros(sqlClock(raw.fetched_at)) === timestampMicros(record.originalFetchedAt)
      && timestampMicros(record.originalFetchedAt) !== null, "Original retained body or April fetched clock changed");
    const body = JSON.parse(record.rawBody);
    requireValue(body.id === game.id && body.season === game.seasonId && body.gameType === 2 && body.gameDate === game.date
      && body.homeTeam.id === game.homeTeamId && body.awayTeam.id === game.awayTeamId
      && Date.parse(body.startTimeUTC) === Date.parse(game.startTime), "Original body conflicts with canonical metadata");
    const rawRow = { id: raw.id, game_id: game.id, season_id: game.seasonId, endpoint: "boxscore", payload_hash: raw.payload_hash,
      fetched_at: record.originalFetchedAt, payload: body,
      retainedOriginal: { rawBody: record.rawBody, bodySha256: record.sha256, originalSource: record.originalSource, originalSpan: record.originalSpan } };
    const appearance = baselineAppearanceFromBoxscore({ rawRow, game, nhlPlayerId: player.nhlId, teamId: roster.team_id,
      cutoffAt, population: "skater" });
    requireValue(appearance, "Approved prior record has no verified positive-minute appearance");
    const url = `https://api-web.nhle.com/v1/gamecenter/${game.id}/landing`, receipt = landings.get(url);
    requireValue(record.landingURL === url && allowed.landingURL === url && receipt, "Missing exact approved landing URL");
    const landingBody = JSON.parse(receipt.rawBody);
    const landing = { rawRow: { id: `http:${receipt.bodySha256}`, endpoint: "landing", game_id: game.id, season_id: game.seasonId,
      payload_hash: receipt.bodySha256, fetched_at: receipt.capturedAt, payload: landingBody, httpReceipt: receipt }, contentHash: hash(landingBody) };
    appearances.push(appearance); derivedLandings.push(landing);
    histories.push({ gameId: game.id, playerId: player.nhlId, games: game }); historicalRosters.push(roster);
  }
  const historicalSources = baselineHistoricalSources(histories, historicalRosters, [],
    { nhlIds: [player.nhlId], seasonId, upperDate: cutoffAt.slice(0, 10) }, player.nhlId);
  const limitations = [...baselineHistoricalSourceLimitations(historicalSources),
    "Conditional ability uses only the explicitly approved twenty prior-season development appearances; no full-season completeness claim.",
    "Original April boxscore fetch clocks remain unchanged. New landing acquisition and input materialization have their own current clocks.",
    "Injury context does not establish participation; no appearance/start probability or unconditional totals are supplied."];
  verifyBaselineHistoricalSources(historicalSources, appearances, player.nhlId, seasonId, cutoffAt, limitations);
  const payload: NativeSkaterBaselineObservation["payload"] = { basis: "captured_current", capturedAt: cutoffAt,
    playerId: 9572, nhlPlayerId: player.nhlId, teamId: player.nhlTeamId, rosterRevision: player.rosterRevision,
    definitionHash: baselineDefinitionHash("skater", seasonId), projections: [], appearances, historicalSources, limitations,
    derivedPowerPlayPoints: { version: "native-power-play-points-inputs-v1", landings: derivedLandings } };
  const observation: NativeSkaterBaselineObservation = { provider: "fhfh", dataset_key: "baseline-inputs-v1", entity_kind: "player",
    entity_key: `${seasonId}:9572`, available_at: cutoffAt, payload_hash: hash(payload), payload };
  const snapshot = buildNativeSkaterBaselineSnapshot({ ...payload, seasonId, cutoffAt, sourceWatermark: observation.payload_hash });
  requireValue(snapshot.targets.every(row => row.recentAppearanceCount === 0 && row.previousGameIds.length > 0
    && row.previousGameIds.every(gameId => records.has(gameId))), "Prior means consumed undeclared or current history");
  requireValue(snapshot.targets.some(row => row.targetKey === "PP_POINTS"), "Prior PPP remains unsupported");
  requireValue(teamScope.seasonId === seasonId && teamScope.games.length === 20 && new Set(teamScope.games.map((game: any) => game.gameId)).size === 20,
    "Actual twenty-game team scope is incomplete");
  const scope = { ...teamScope, players: [{ playerId: 9572, nhlPlayerId: player.nhlId, teamId: player.nhlTeamId, rosterRevision: player.rosterRevision }] };
  const expiry = new Date(Math.min(now.getTime() + 86400000, ...scope.games.map((game: any) => Date.parse(game.scheduledAt)))).toISOString();
  const preview = await previewNativeBaseline([observation], scope, expiry, now);
  const required = ["GOALS", "ASSISTS", "PP_POINTS", "SHOTS_ON_GOAL", "HITS", "BLOCKED_SHOTS", "PENALTY_MINUTES"];
  const supported = preview.bundle.sources.map(row => row.targetKey);
  requireValue(required.every(key => supported.includes(key)) && preview.bundle.sources.every(row => !row.released && !row.participationIntegrated
    && row.basis === "per_appearance" && !row.allowedUses), "Required conditional heads or denied-use invariants failed");
  const report = { status: "unreleased_prior_ability_preview", approvalRef: "call_34ffe2aa66344598a456110a0e8426f2", materializedAt: cutoffAt,
    playerId: 9572, nhlPlayerId: player.nhlId, currentTeamId: player.nhlTeamId, rosterRevision: player.rosterRevision,
    method: snapshot.policyVersion, inputHashes, observationHash: observation.payload_hash,
    priorAppearances: appearances.length, landingReceipts: derivedLandings.length, scheduledGames: scope.games.length,
    supportedTargets: supported, missingRequiredTargets: required.filter(key => !supported.includes(key)), unsupportedSupportingTargets: ["TIME_ON_ICE_PER_GAME"],
    originalFetchClocksPreserved: true, normalizationManifestsCaptured: 0, historicalPopulationCoverage: "unverified",
    allowedPriorDateRange: ["2025-10-01", "2026-01-02"], actualPriorDateRange: [appearances.map(row => row.gameDate).sort()[0], appearances.map(row => row.gameDate).sort().at(-1)],
    participation: "not_supplied", unconditionalTotals: "withheld_unknown_participation", publicUsesApproved: false, forecastIssued: false,
    adapterSourceRequests: 0, databaseWrites: 0, previewChecksum: preview.checksum,
    invariants: { canonicalIdentitiesAndTeamsMatched: true, originalRawBodyHashesVerified: true, originalProviderHashesRetainedSeparately: true,
      originalFetchedClocksMatchedMetadata: true, exactTwentyApprovedLandings: true, originalPPPReconciled: true, noNormalizationInvented: true } };
  mkdirSync(output, { mode: 0o700 });
  for (const [name, value] of Object.entries({ "observations.json": [observation], "scope.json": scope, "preview.json": preview, "report.json": report })) {
    writeFileSync(join(output, name), JSON.stringify(value, null, 2), { flag: "wx", mode: 0o600 });
  }
  console.log(JSON.stringify({ status: report.status, priorAppearances: report.priorAppearances, landingReceipts: report.landingReceipts,
    scheduledGames: report.scheduledGames, missingRequiredTargets: report.missingRequiredTargets, participation: report.participation,
    publicUsesApproved: false, adapterSourceRequests: 0, databaseWrites: 0, output }));
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Offline prior adapter failed"); process.exitCode = 1; });
