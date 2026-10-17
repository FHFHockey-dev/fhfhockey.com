import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildSkaterBaselineRates, type BaselineAppearanceInput } from "../lib/player-forecasts/baselineRates";
import { BASELINE_CANDIDATE_POLICY, baselineDefinitionHash } from "../lib/player-forecasts/baselinePolicy";
import { baselineAppearanceFromBoxscore, verifyBaselineBoxscoreReceipt } from "../lib/player-forecasts/baselineSourceLineage";
import { playerForecastSourcePayloadHash } from "../lib/player-forecasts/sourceSnapshot";
import { timestampMicros } from "../lib/projections/evidenceTime";

const VERSION = "forge-walk-forward-native-v1";
const MAX_APPEARANCES = 1500;
const MAX_INPUT_BYTES = 128 * 1024 * 1024;
const POLICY = BASELINE_CANDIDATE_POLICY;
type ObjectRow = Record<string, any>;
type Mode = "prospective" | "hindcast" | "normalize";

function object(value: unknown, label: string): ObjectRow {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value as ObjectRow;
}

function keys(row: ObjectRow, allowed: string[], label: string) {
  if (Object.keys(row).some(key => !allowed.includes(key))) throw new Error(`${label} has unsupported fields.`);
}

function id(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || Number(value) <= 0) throw new Error(`${label} must be a positive integer.`);
  return value as number;
}

function time(value: unknown, label: string): bigint {
  const parsed = typeof value === "string" ? timestampMicros(value) : null;
  if (parsed === null) throw new Error(`${label} requires a timestamp with an explicit timezone.`);
  return parsed;
}

function permittedDate(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)
    || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) {
    throw new Error("History requires a canonical game date.");
  }
  if (value >= "2026-01-03" && value <= "2026-04-16" || value === "2026-10-13") {
    throw new Error("Protected and exposed October 13 outcomes are excluded.");
  }
  return value;
}

function easternDate(value: string): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York",
    year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
  const part = (name: string) => parts.find(row => row.type === name)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/** Materialize at the actual computation clock; raw receipt clocks remain unchanged. */
export function normalizeNativeBoxscore(rawRow: ObjectRow, game: ObjectRow, nhlPlayerId: number,
  teamId: number, computedAt: string): BaselineAppearanceInput | null {
  time(computedAt, "computedAt");
  permittedDate(game.date);
  id(game.id, "game.id");
  id(game.homeTeamId, "game.homeTeamId");
  id(game.awayTeamId, "game.awayTeamId");
  id(nhlPlayerId, "nhlPlayerId");
  id(teamId, "teamId");
  time(game.startTime, "game.startTime");
  if (time(rawRow.fetched_at, "rawRow.fetched_at") > time(computedAt, "computedAt")) {
    throw new Error("Raw boxscore receipt exceeds actual computation time.");
  }
  return baselineAppearanceFromBoxscore({ rawRow, game, nhlPlayerId, teamId,
    cutoffAt: computedAt, population: "skater" });
}

/** Pure batch calculation. The CLI supplies its real clock, separately from the simulated cutoff. */
export function buildWalkForwardNative(value: unknown, computedAt: string) {
  const input = object(value, "Input");
  keys(input, ["version", "mode", "cutoffAt", "seasonId", "players", "projections"], "Input");
  if (input.version !== VERSION || !["prospective", "hindcast", "normalize"].includes(input.mode)) {
    throw new Error("Unsupported native adapter version or mode.");
  }
  const mode = input.mode as Mode;
  const computed = time(computedAt, "computedAt");
  const cutoffAt = mode === "normalize" && input.cutoffAt === undefined ? computedAt : input.cutoffAt;
  const cutoff = time(cutoffAt, "cutoffAt");
  if (cutoff > computed) throw new Error("Cutoff exceeds actual computation time.");
  if (mode === "normalize" && cutoff !== computed) throw new Error("Normalization cutoff must be the actual computation time.");
  if (![20252026, 20262027].includes(input.seasonId)) throw new Error("Season is outside the approved pilot.");
  if (input.projections !== undefined && (!Array.isArray(input.projections) || input.projections.length)) {
    throw new Error("External projection inputs are forbidden.");
  }
  if (!Array.isArray(input.players) || !input.players.length || input.players.length > 17) {
    throw new Error("Native adapter requires 1–17 players.");
  }
  const playerIds = new Set<number>(), nhlIds = new Set<number>();
  const gameContexts = new Map<number, string>();
  let appearanceCount = 0;
  const rows = input.players.map((value: unknown) => {
    const player = object(value, "Player");
    keys(player, ["playerId", "nhlPlayerId", "sourceWatermark", mode === "normalize" ? "rawGames" : "appearances"], "Player");
    const playerId = id(player.playerId, "playerId"), nhlPlayerId = id(player.nhlPlayerId, "nhlPlayerId");
    if (playerIds.has(playerId) || nhlIds.has(nhlPlayerId)) throw new Error("Duplicate player identity.");
    playerIds.add(playerId); nhlIds.add(nhlPlayerId);
    if (typeof player.sourceWatermark !== "string" || !player.sourceWatermark.trim() || player.sourceWatermark.length > 256) {
      throw new Error("Player source watermark is required.");
    }
    const sources = mode === "normalize" ? player.rawGames : player.appearances;
    if (!Array.isArray(sources) || sources.length > 200 || (appearanceCount += sources.length) > MAX_APPEARANCES) {
      throw new Error("Appearance batch exceeds its approved bounds.");
    }
    const gameIds = new Set<number>();
    const appearances: BaselineAppearanceInput[] = [];
    const exclusions: Array<{ gameId: number; reason: string }> = [];
    const sourceClocks: Array<{ gameId: number; fetchedAt: string; availableAt: string; materializedAt: string }> = [];
    for (const value of sources) {
      const row = object(value, "Appearance");
      if (mode === "normalize") keys(row, ["rawRow", "game", "teamId"], "Raw game");
      const receipt = mode === "normalize" ? row : object(row.finalBoxscore, "Final boxscore receipt");
      const rawRow = object(receipt.rawRow, "Raw boxscore"), game = object(receipt.game, "Canonical game");
      const gameId = id(game.id, "game.id"), gameDate = permittedDate(game.date);
      id(game.homeTeamId, "game.homeTeamId"); id(game.awayTeamId, "game.awayTeamId");
      time(game.startTime, "game.startTime");
      if (gameIds.has(gameId)) throw new Error("Duplicate player/game history, including identical receipts.");
      gameIds.add(gameId);
      if (![input.seasonId - 10001, input.seasonId].includes(game.seasonId)) {
        throw new Error("History season is outside the native prior/current windows.");
      }
      if (mode !== "normalize" && (row.gameId !== gameId || row.gameDate !== gameDate
        || row.seasonId !== game.seasonId || row.regularSeason !== true)) {
        throw new Error("Appearance identity conflicts with its retained game.");
      }
      const signature = playerForecastSourcePayloadHash({ id: gameId, date: gameDate,
        seasonId: game.seasonId, type: game.type, startTime: time(game.startTime, "game.startTime").toString(),
        homeTeamId: game.homeTeamId, awayTeamId: game.awayTeamId });
      if (gameContexts.has(gameId) && gameContexts.get(gameId) !== signature) throw new Error("Conflicting retained game identity.");
      gameContexts.set(gameId, signature);
      const fetched = time(rawRow.fetched_at, "rawRow.fetched_at");
      if (fetched > computed) throw new Error("Source receipt is in the future of actual computation.");
      if (mode !== "normalize" && gameDate >= easternDate(cutoffAt)) {
        if (mode === "prospective") throw new Error("Prospective history includes its forecast date or a future event.");
        exclusions.push({ gameId, reason: "event_at_or_after_simulated_cutoff_date" });
        continue;
      }
      let appearance: BaselineAppearanceInput | null;
      if (mode === "prospective") {
        const available = time(row.availableAt, "appearance.availableAt");
        if (available >= cutoff || fetched >= cutoff || fetched > available) {
          throw new Error("Prospective history source or transformation is after its cutoff.");
        }
        verifyBaselineBoxscoreReceipt(row, nhlPlayerId, row.availableAt, "skater");
        appearance = row as BaselineAppearanceInput;
      } else {
        if (mode === "hindcast") {
          const available = time(row.availableAt, "appearance.availableAt");
          if (available > computed || fetched > available) throw new Error("Hindcast source clocks are inconsistent.");
          verifyBaselineBoxscoreReceipt(row, nhlPlayerId, row.availableAt, "skater");
        }
        appearance = normalizeNativeBoxscore(rawRow, game, nhlPlayerId, id(row.teamId, "teamId"), computedAt);
      }
      if (!appearance) { exclusions.push({ gameId, reason: "zero_toi" }); continue; }
      appearances.push(appearance);
      sourceClocks.push({ gameId, fetchedAt: rawRow.fetched_at,
        availableAt: mode === "normalize" ? computedAt : row.availableAt,
        materializedAt: mode === "prospective" ? row.availableAt : computedAt });
    }
    if (mode === "normalize") return { playerId, nhlPlayerId, appearances, exclusions };
    const snapshot = buildSkaterBaselineRates({ playerId, nhlPlayerId, seasonId: input.seasonId,
      cutoffAt: mode === "hindcast" ? computedAt : cutoffAt, sourceWatermark: player.sourceWatermark,
      projections: [], appearances });
    const target = snapshot.targets.find(row => row.targetKey === "BLOCKED_SHOTS");
    const sorted = [...appearances].sort((a, b) => b.gameDate.localeCompare(a.gameDate) || b.gameId - a.gameId);
    const validBlocks = (row: BaselineAppearanceInput) => Number.isSafeInteger(row.targets.BLOCKED_SHOTS)
      && Number(row.targets.BLOCKED_SHOTS) >= 0;
    const previous = sorted.filter(row => row.seasonId === input.seasonId - 10001)
      .slice(0, POLICY.previousAppearanceWindow).filter(validBlocks);
    const recent = sorted.filter(row => row.seasonId === input.seasonId)
      .slice(0, POLICY.recentAppearanceWindow).filter(validBlocks);
    return { playerId, nhlPlayerId, mean: target?.ratePerAppearance ?? null,
      previousN: previous.length, recentN: recent.length,
      historyGameIds: [...previous, ...recent].map(row => row.gameId),
      sourceClocks, exclusions };
  });
  return { version: VERSION, mode, evidenceBasis: mode === "hindcast" ? "retrospective_hindcast" : "actual_receipt",
    computedAt, cutoffAt, seasonId: input.seasonId, rows,
    policy: { target: "BLOCKED_SHOTS", conditioning: "positive_toi_appearance", externalProjections: "excluded",
      previousAppearanceWindow: POLICY.previousAppearanceWindow, recentAppearanceWindow: POLICY.recentAppearanceWindow,
      recentDecay: POLICY.recentDecay, priorAppearanceWeight: POLICY.priorAppearanceWeight,
      definitionHash: baselineDefinitionHash("skater", input.seasonId),
      missingPrior: "null; shared training-only pooled fallback belongs to the protocol runner",
      eventCutoff: "game_date_before_cutoff_date_in_America/New_York",
      protectedDates: ["2026-01-03/2026-04-16", "2026-10-13"],
      historicalAsOfQualified: mode === "hindcast" ? false : null,
      grantsIssuanceOrRelease: false } };
}

function runtimeDependencies() {
  const sha256 = (path: string) => createHash("sha256").update(Uint8Array.from(readFileSync(path))).digest("hex");
  const packageLockPath = resolve(__dirname, "../package-lock.json");
  return { version: "forge-walk-forward-runtime-v1",
    node: { executablePath: process.execPath, version: process.version, sha256: sha256(process.execPath) },
    packageLock: { path: packageLockPath, sha256: sha256(packageLockPath) },
    modules: Object.fromEntries(Object.keys(require.cache).sort().map(path => [path, sha256(path)])) };
}

if (require.main === module) {
  (async () => {
    const chunks: string[] = [];
    let bytes = 0;
    process.stdin.setEncoding("utf8");
    for await (const chunk of process.stdin) {
      const text = String(chunk);
      if ((bytes += Buffer.byteLength(text, "utf8")) > MAX_INPUT_BYTES) throw new Error("Native adapter input exceeds 128 MiB.");
      chunks.push(text);
    }
    const input = JSON.parse(chunks.join(""));
    const result = buildWalkForwardNative(input, new Date().toISOString());
    process.stdout.write(`${JSON.stringify({ ...result, runtimeDependencies: runtimeDependencies() })}\n`);
  })().catch(error => {
    process.stderr.write(`${error instanceof Error ? error.message : "Native adapter failed."}\n`);
    process.exitCode = 1;
  });
}
