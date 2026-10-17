import { assembleCurrentSeasonSogBaseline, CURRENT_SEASON_SOG_VERSION } from "./currentSeasonSogBaseline";
import { playerForecastSourcePayloadHash as hash } from "./sourceSnapshot";
import { timestampMicros } from "../projections/evidenceTime";
import type { ContributionGame, ContributionSource } from "./contributions";
import { contributionBundleChecksum } from "./contributionStore";

export const CURRENT_SEASON_SOG_INPUT_VERSION = "current-season-sog-contribution-inputs-v1";
export type CurrentSeasonSogContributionInput = {
  version: typeof CURRENT_SEASON_SOG_INPUT_VERSION;
  packet: ReturnType<typeof assembleCurrentSeasonSogBaseline>;
  binding: ContributionGame & { observedAt: string };
};
const keys = (value: unknown, allowed: string[]) => !!value && typeof value === "object" && !Array.isArray(value)
  && Object.keys(value).length === allowed.length && Object.keys(value).every(key => allowed.includes(key));
const clock = (value: string) => { const time = timestampMicros(value); if (time === null) throw new Error("Invalid SOG binding clock."); return time; };

/** Replay supplied receipts for validation, retaining original forecast time.
 * Contribution issuance is distinct from the earlier private forecast generation. */
export function buildCurrentSeasonSogContribution(input: CurrentSeasonSogContributionInput,
  issuedAt: string, now = new Date()): ContributionSource {
  if (!keys(input, ["version", "packet", "binding"]) || input.version !== CURRENT_SEASON_SOG_INPUT_VERSION
    || !input.packet || !keys(input.binding, ["playerId", "nhlPlayerId", "seasonId", "teamId", "gameId",
      "scheduledAt", "scheduleRevision", "rosterRevision", "observedAt"])) throw new Error("Invalid versioned SOG contribution input.");
  const { packet, binding } = input;
  if (packet.version !== CURRENT_SEASON_SOG_VERSION || packet.status !== "unreleased_local"
    || typeof packet.generatedAt !== "string" || new Date(packet.generatedAt).toISOString() !== packet.generatedAt) {
    throw new Error("Original SOG generation clock/version is incompatible.");
  }
  const replay = assembleCurrentSeasonSogBaseline(packet.sourceReceipts, new Date(packet.generatedAt));
  if (hash(replay) !== hash(packet)) throw new Error("SOG packet does not reproduce from original receipt bytes.");
  const scope = replay.scope;
  const target = JSON.parse(packet.sourceReceipts.schedule.rawBody).games.find((game: { id: number }) => game.id === scope.targetGameId);
  if (binding.playerId !== scope.playerId || binding.nhlPlayerId !== scope.nhlPlayerId
    || binding.teamId !== scope.teamId || binding.seasonId !== scope.seasonId || binding.gameId !== scope.targetGameId
    || clock(binding.scheduledAt) !== clock(target.startTimeUTC)
    || !/^[a-f0-9]{64}$/.test(binding.scheduleRevision) || !/^[a-f0-9]{64}$/.test(binding.rosterRevision)
    || clock(binding.observedAt) < clock(packet.generatedAt) || clock(binding.observedAt) > clock(issuedAt)
    || clock(issuedAt) > BigInt(now.getTime()) * BigInt(1000)
    || clock(issuedAt) >= clock(packet.expiresAt) || clock(packet.expiresAt) <= BigInt(now.getTime()) * BigInt(1000)) {
    throw new Error("SOG game/start/revision binding is inconsistent, future or expired.");
  }
  const unsigned = { kind: "baseline" as const, policyVersion: CURRENT_SEASON_SOG_VERSION, released: false,
    playerId: binding.playerId, nhlPlayerId: binding.nhlPlayerId, seasonId: binding.seasonId,
    teamId: binding.teamId, gameId: binding.gameId, scheduledAt: binding.scheduledAt,
    targetKey: "SHOTS_ON_GOAL", unit: "count" as const, basis: "per_appearance" as const,
    mean: packet.target.mean, participationIntegrated: false, cutoffAt: packet.cutoffAt, issuedAt,
    expiresAt: packet.expiresAt, sourceWatermark: hash(input), scheduleRevision: binding.scheduleRevision,
    rosterRevision: binding.rosterRevision, limitations: [...packet.limitations,
      `Original conditional forecast generated: ${packet.generatedAt}; original input cutoff: ${packet.cutoffAt}.`,
      `Game/roster context bound: ${binding.observedAt}; contribution issued: ${issuedAt}.`,
      `SOG support: ${packet.target.sampleSize} positive-minute appearances; dates ${packet.target.sampleDates.join(", ")}.`,
      "This source covers only the bound game. Receipt replay does not authenticate the supplied context binding."] };
  return { ...unsigned, sourceId: `baseline:${hash({ policyVersion: CURRENT_SEASON_SOG_VERSION,
    inputHash: unsigned.sourceWatermark, targetKey: unsigned.targetKey })}` };
}

/** Unreleased, default-deny bundle; persisting or approving it is a separate action. */
export function buildCurrentSeasonSogContributionBundle(input: CurrentSeasonSogContributionInput, issuedAt: string, now = new Date()) {
  const source = buildCurrentSeasonSogContribution(input, issuedAt, now);
  const manifest = { seasonId: source.seasonId, policyVersion: source.policyVersion, inputCutoff: source.cutoffAt,
    issuedAt, expiresAt: source.expiresAt, sourceCount: 1, sourceWatermarks: [source.sourceWatermark],
    rosterRevisions: [source.rosterRevision], evaluationPolicyId: null, reviewId: null, released: false };
  return { sources: [source], manifest: { ...manifest, checksum: contributionBundleChecksum({ manifest, sources: [source] }) } };
}

/** Called only after existing exact policy/review/allowlist admission. No files or DB reads. */
export function admitsCurrentSeasonSogContribution(source: ContributionSource, row: any, now: Date): boolean {
  try {
    if (row?.provider !== "fhfh" || row.dataset_key !== "baseline-inputs-v1" || row.entity_kind !== "player"
      || row.entity_key !== `${source.seasonId}:${source.playerId}` || row.payload_hash !== source.sourceWatermark
      || hash(row.payload) !== row.payload_hash || clock(row.available_at) !== clock(row.payload?.binding?.observedAt)) return false;
    const derived = buildCurrentSeasonSogContribution(row.payload, source.issuedAt, now);
    const candidate = { ...source, released: false };
    delete candidate.allowedUses;
    return hash(candidate) === hash(derived);
  } catch { return false; }
}
