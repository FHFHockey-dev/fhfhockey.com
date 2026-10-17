import { lstatSync, openSync, closeSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { CURRENT_APPEARANCE_POLICY_VERSION, CURRENT_APPEARANCE_POLICY } from "../lib/player-forecasts/baselineRates";
import { dryRunNativeSkaterBaselineBundle, type NativeSkaterBaselineObservation } from "../lib/player-forecasts/baselineGeneration";
import { buildNativeGoalieWinRates, dryRunGoalieContributionBundle, NATIVE_GOALIE_WIN_POLICY_VERSION, nativeGoalieWinDefinitionHash, buildNativeGoalieVolumeRates, NATIVE_GOALIE_VOLUME_POLICY_VERSION, nativeGoalieVolumeDefinitionHash, buildNativeGoalieShutoutRates, NATIVE_GOALIE_SHUTOUT_POLICY_VERSION, nativeGoalieShutoutDefinitionHash } from "../lib/player-forecasts/goalieBaselineRates";
import type { NativeGoalieShutoutSummary } from "../lib/player-forecasts/nativeGoalieOutcomes";
import type { CapturedGoalieInput } from "../lib/player-forecasts/goalieBaselineInputCapture";
import { prepareSeasonGameContribution, type SeasonGameBinding } from "../lib/player-forecasts/seasonGameContributions";
import type { PortableSeasonArtifact } from "../lib/fantasy-projections/evaluator";
import { playerForecastSourcePayloadHash } from "../lib/player-forecasts/sourceSnapshot";

export type NativeBaselinePreviewScope = {
  seasonId: number; scheduleRevision: string;
  games: Array<{ gameId: number; scheduledAt: string }>;
  players: Array<{ playerId: number; nhlPlayerId: number; teamId: number; rosterRevision: string }>;
};
const usage = "preview-native-baseline.ts --inputs APPROVED_NATIVE_OBSERVATIONS_JSON --scope REVIEWED_GAME_SCOPE_JSON --expires-at ISO_TIMESTAMP --out NEW_PRIVATE_JSON [--season-artifact VERIFIED_SEASON_ARTIFACT_JSON | --goalie-wins true | --goalie-volume true | --goalie-shutouts true]";
const noDatabase = new Proxy({}, { get() { throw new Error("Native preview forbids database access"); } });

/** Compose the existing native method only. A preview is neither issued nor released. */
export async function previewNativeBaseline(observations: NativeSkaterBaselineObservation[],
  scope: NativeBaselinePreviewScope, expiresAt: string, now = new Date()) {
  const issuedAt = now.toISOString(), expiry = Date.parse(expiresAt);
  const currentAppearance = observations?.[0]?.payload?.policyVersion === CURRENT_APPEARANCE_POLICY_VERSION;
  const maximumPlayers = currentAppearance ? 50 : 2, maximumGames = 20;
  if (!Array.isArray(observations) || observations.length < 1 || observations.length > maximumPlayers
    || !Array.isArray(scope.players) || scope.players.length !== observations.length
    || !Array.isArray(scope.games) || !scope.games.length || scope.games.length > maximumGames
    || new Set(scope.games.map(game => game.gameId)).size !== scope.games.length
    || scope.games.some(game => !Number.isSafeInteger(game.gameId) || game.gameId <= 0
      || !Number.isFinite(Date.parse(game.scheduledAt)) || Date.parse(game.scheduledAt) <= now.getTime())
    || !Number.isFinite(expiry) || expiry <= now.getTime() || expiry > now.getTime() + 86400000
    || scope.games.some(game => expiry > Date.parse(game.scheduledAt))) {
    throw new Error(`Native preview requires 1–${maximumPlayers} exact skaters, 1–${maximumGames} future games and a pregame expiry within 24 hours.`);
  }
  const cutoffAt = observations[0].available_at;
  if (!Number.isFinite(Date.parse(cutoffAt)) || Date.parse(cutoffAt) > now.getTime()
    || now.getTime() - Date.parse(cutoffAt) > 86400000
    || observations.some(row => !scope.players.some(player => player.playerId === row.payload?.playerId
      && player.nhlPlayerId === row.payload.nhlPlayerId && player.teamId === row.payload.teamId
      && player.rosterRevision === row.payload.rosterRevision))) throw new Error("Native preview source scope/capture is stale or mismatched.");
  const bundle = await dryRunNativeSkaterBaselineBundle(noDatabase as never, {
    seasonId: scope.seasonId, cutoffAt, issuedAt, expiresAt, scheduleRevision: scope.scheduleRevision, observations,
  });
  const payload = { version: "native-baseline-preview-v1", status: "unreleased_preview",
    generatedAt: issuedAt, scope, scopeHash: playerForecastSourcePayloadHash(scope),
    originalInputHashes: observations.map(row => row.payload_hash), bundle,
    coverage: scope.players.map(player => ({ ...player, targets: bundle.sources.filter(source => source.playerId === player.playerId)
      .map(source => ({ targetKey: source.targetKey, unit: source.unit, basis: source.basis, sourceId: source.sourceId })) })),
    ...(currentAppearance ? { missingTargets: scope.players.map(player => ({ playerId: player.playerId,
      targetKeys: CURRENT_APPEARANCE_POLICY.targets.filter(key => !bundle.sources.some(source => source.playerId === player.playerId && source.targetKey === key)) })) } : {}),
    participation: "not_supplied", publicUsesApproved: false, databaseWrites: 0,
    limitations: ["Original native observations and their actual capture clocks are required; private experiment outputs are not inputs.",
      "Mean rates are conditional per appearance. No actual-appearance, unconditional total or predictive superiority claim.",
      "A separate owner-approved exact-input public-use policy, independent review and explicit publication authorization are required."] };
  return { ...payload, checksum: playerForecastSourcePayloadHash(payload) };
}

export type NativeGoalieObservation = Omit<NativeSkaterBaselineObservation, "payload"> & {
  payload: Omit<CapturedGoalieInput, "sourceWatermark" | "projectionSources"> & {
    basis: "captured_current"; capturedAt: string; policyVersion: typeof NATIVE_GOALIE_WIN_POLICY_VERSION | typeof NATIVE_GOALIE_VOLUME_POLICY_VERSION | typeof NATIVE_GOALIE_SHUTOUT_POLICY_VERSION;
    shutoutSummary?: NativeGoalieShutoutSummary;
  };
};

export type NativeGoalieWinObservation = NativeGoalieObservation;

/** Explicit native goalie preparation. Separate explicit policies retain denied uses; participation remains unsupported. */
async function previewNativeGoalieBaseline(observations: NativeGoalieObservation[],
  scope: NativeBaselinePreviewScope, expiresAt: string, now: Date, mode: "wins" | "volume" | "shutouts") {
  const policyVersion = mode === "shutouts" ? NATIVE_GOALIE_SHUTOUT_POLICY_VERSION : mode === "wins" ? NATIVE_GOALIE_WIN_POLICY_VERSION : NATIVE_GOALIE_VOLUME_POLICY_VERSION;
  const definitionHash = mode === "shutouts" ? nativeGoalieShutoutDefinitionHash : mode === "wins" ? nativeGoalieWinDefinitionHash : nativeGoalieVolumeDefinitionHash;
  const buildRates = mode === "shutouts" ? buildNativeGoalieShutoutRates : mode === "wins" ? buildNativeGoalieWinRates : buildNativeGoalieVolumeRates;
  const expiry = Date.parse(expiresAt), cutoffAt = observations?.[0]?.available_at;
  if (!Array.isArray(observations) || !observations.length || observations.length > 20
    || !Array.isArray(scope.players) || scope.players.length !== observations.length
    || !Array.isArray(scope.games) || !scope.games.length || scope.games.length > 20
    || new Set(scope.games.map(game => game.gameId)).size !== scope.games.length
    || scope.games.some(game => !Number.isSafeInteger(game.gameId) || game.gameId <= 0
      || !Number.isFinite(Date.parse(game.scheduledAt)) || Date.parse(game.scheduledAt) <= now.getTime() || expiry > Date.parse(game.scheduledAt))
    || !Number.isFinite(expiry) || expiry <= now.getTime() || expiry > now.getTime() + 86400000
    || !Number.isFinite(Date.parse(cutoffAt)) || Date.parse(cutoffAt) > now.getTime()
    || now.getTime() - Date.parse(cutoffAt) > 86400000) throw new Error("Native goalie preview requires bounded current identities, future games and pregame expiry.");
  const snapshots = observations.map(row => {
    const payload = row.payload;
    if (!payload || row.provider !== "fhfh" || row.dataset_key !== "goalie-baseline-inputs-v1" || row.entity_kind !== "player"
      || row.entity_key !== `${scope.seasonId}:${payload.playerId}` || row.available_at !== cutoffAt
      || payload.basis !== "captured_current" || payload.capturedAt !== cutoffAt || playerForecastSourcePayloadHash(payload) !== row.payload_hash
      || payload.policyVersion !== policyVersion || payload.definitionHash !== definitionHash(scope.seasonId)
      || !scope.players.some(player => player.playerId === payload.playerId && player.nhlPlayerId === payload.nhlPlayerId
        && player.teamId === payload.teamId && player.rosterRevision === payload.rosterRevision)) throw new Error("Native goalie preview source scope/hash/policy is inconsistent.");
    return { teamId: payload.teamId, rosterRevision: payload.rosterRevision, snapshot: buildRates({
      ...payload, seasonId: scope.seasonId, cutoffAt, sourceWatermark: row.payload_hash }) };
  });
  if (new Set(snapshots.map(row => row.snapshot.nhlPlayerId)).size !== snapshots.length) throw new Error("Native goalie preview has duplicate NHL identities.");
  const bundle = await dryRunGoalieContributionBundle(noDatabase as never, { seasonId: scope.seasonId, cutoffAt,
    issuedAt: now.toISOString(), expiresAt, scheduleRevision: scope.scheduleRevision, snapshots });
  const payload = { version: mode === "shutouts" ? "native-goalie-shutout-preview-v1" : mode === "wins" ? "native-goalie-win-preview-v1" : "native-goalie-volume-preview-v1", status: "unreleased_preview", scope,
    generatedAt: now.toISOString(), originalInputHashes: observations.map(row => row.payload_hash), bundle,
    coverage: snapshots.map(row => ({ playerId: row.snapshot.playerId, supportedTargets: row.snapshot.targets.map(target => target.targetKey),
      missingTargets: row.snapshot.missingTargetKeys })), participation: "not_supplied", publicUsesApproved: false, databaseWrites: 0,
    limitations: [mode === "shutouts" ? "Explicit official credited SO per positive-minute appearance; no GA=0 or participation inference." : mode === "wins" ? "Observed W per positive-minute appearance including relief; no pStart or appearance probability inferred."
      : "Coherent SV/GA/SA/minutes use one verified positive-minute appearance denominator including relief; no participation probability inferred.",
      "Other unsupported targets remain missing. Native policy/review/allowlist and publication remain separate."] };
  return { ...payload, checksum: playerForecastSourcePayloadHash(payload) };
}

export const previewNativeGoalieWins = (observations: NativeGoalieObservation[], scope: NativeBaselinePreviewScope, expiresAt: string, now = new Date()) =>
  previewNativeGoalieBaseline(observations, scope, expiresAt, now, "wins");
export const previewNativeGoalieVolume = (observations: NativeGoalieObservation[], scope: NativeBaselinePreviewScope, expiresAt: string, now = new Date()) =>
  previewNativeGoalieBaseline(observations, scope, expiresAt, now, "volume");

export const previewNativeGoalieShutouts = (observations: NativeGoalieObservation[], scope: NativeBaselinePreviewScope, expiresAt: string, now = new Date()) =>
  previewNativeGoalieBaseline(observations, scope, expiresAt, now, "shutouts");

/** Explicit recovered-season preparation; never substitutes for the native default or admission. */
export function previewSeasonBaseline(artifact: PortableSeasonArtifact, bindings: SeasonGameBinding[],
  scope: NativeBaselinePreviewScope, expiresAt: string, now = new Date()) {
  if (!Array.isArray(bindings) || !bindings.length || bindings.length > 1000
    || !Array.isArray(scope.players) || !scope.players.length || scope.players.length > 50
    || !Array.isArray(scope.games) || !scope.games.length || scope.games.length > 20
    || new Set(bindings.map(row => `${row.playerId}:${row.gameId}`)).size !== bindings.length
    || bindings.some(row => row.seasonId !== scope.seasonId || row.scheduleRevision !== scope.scheduleRevision
      || !scope.players.some(player => player.playerId === row.playerId && player.nhlPlayerId === row.nhlPlayerId
        && player.teamId === row.teamId && player.rosterRevision === row.rosterRevision)
      || !scope.games.some(game => game.gameId === row.gameId && game.scheduledAt === row.scheduledAt))) {
    throw new Error("Season preview requires bounded, distinct player-game bindings matching the reviewed scope.");
  }
  const candidates = bindings.map(binding => prepareSeasonGameContribution(artifact, binding, now.toISOString(), expiresAt, now));
  const payload = { version: "season-baseline-preview-v1", status: "unreleased_preview", generatedAt: now.toISOString(),
    scope, scopeHash: playerForecastSourcePayloadHash(scope), candidates, publicUsesApproved: false, databaseWrites: 0,
    coverage: { universe: "explicit_reviewed_bindings", teamScheduleCoverage: "unavailable_scope_has_no_game_team_membership",
      requestedBindings: bindings.length, generatedBindings: candidates.length,
      unrepresentedPlayers: scope.players.filter(player => !bindings.some(row => row.playerId === player.playerId)).map(player => ({ playerId: player.playerId, reason: "no_reviewed_game_binding" })),
      unrepresentedGames: scope.games.filter(game => !bindings.some(row => row.gameId === game.gameId)).map(game => ({ gameId: game.gameId, reason: "no_reviewed_player_binding" })),
      missingTargets: candidates.flatMap(row => row.missingTargets.map(target => ({ playerId: row.forecast.playerId, gameId: row.forecast.gameId, ...target }))) },
    limitations: ["Recovered seasonal artifact preview only; this is not a fresh native release or full declared-universe coverage.",
      "Original artifact cutoff and denied uses are retained. Native source provenance/admission must be satisfied separately."] };
  return { ...payload, checksum: playerForecastSourcePayloadHash(payload) };
}

function readBoundedJson(path: string, maximum: number) {
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.size <= 0 || stat.size > maximum) throw new Error("Preview inputs must be bounded regular JSON files.");
  return JSON.parse(readFileSync(path, "utf8"));
}

export async function runNativeBaselinePreview(argv: string[]) {
  const args = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index], value = argv[index + 1];
    if (!["--inputs", "--scope", "--expires-at", "--out", "--season-artifact", "--goalie-wins", "--goalie-volume", "--goalie-shutouts"].includes(key) || !value || value.startsWith("--") || args.has(key)) throw new Error(usage);
    args.set(key, value);
  }
  if (!["--inputs", "--scope", "--expires-at", "--out"].every(key => args.has(key))) throw new Error(usage);
  if (["--goalie-wins", "--goalie-volume", "--goalie-shutouts"].some(key => args.has(key) && args.get(key) !== "true")
    || ["--goalie-wins", "--goalie-volume", "--goalie-shutouts", "--season-artifact"].filter(key => args.has(key)).length > 1) throw new Error(usage);
  const out = resolve(args.get("--out")!);
  if (out === resolve(args.get("--inputs")!) || out === resolve(args.get("--scope")!) || args.has("--season-artifact") && out === resolve(args.get("--season-artifact")!)) throw new Error("Preview output must be a new file.");
  const inputs = readBoundedJson(args.get("--inputs")!, 32 * 1024 * 1024);
  const scope = readBoundedJson(args.get("--scope")!, 64 * 1024);
  const result = args.has("--season-artifact")
    ? previewSeasonBaseline(readBoundedJson(args.get("--season-artifact")!, 32 * 1024 * 1024), inputs, scope, args.get("--expires-at")!)
    : args.has("--goalie-wins") ? await previewNativeGoalieWins(inputs, scope, args.get("--expires-at")!)
    : args.has("--goalie-volume") ? await previewNativeGoalieVolume(inputs, scope, args.get("--expires-at")!)
    : args.has("--goalie-shutouts") ? await previewNativeGoalieShutouts(inputs, scope, args.get("--expires-at")!)
    : await previewNativeBaseline(inputs, scope, args.get("--expires-at")!);
  const fd = openSync(out, "wx", 0o600);
  try { writeFileSync(fd, JSON.stringify(result, null, 2)); } finally { closeSync(fd); }
  return { output: out, checksum: result.checksum, status: result.status, databaseWrites: 0, localFilesWritten: 1 };
}

if (require.main === module) runNativeBaselinePreview(process.argv.slice(2)).then(result => console.log(JSON.stringify(result)))
  .catch(error => { console.error(error instanceof Error ? error.message : "Native preview failed"); process.exitCode = 1; });
