import { assertId, instant } from "./contracts";
import { contentHash } from "./hash.server";
import { assertPinnedInput, type Admission, type PinnedInput } from "./researchCapture";

/** Transparent point baselines only. Exposure is supplied independently and held fixed across B0/B1/B2. */
export const BASELINE_VERSION = "forge-prior-only-baselines-v1";
const SKATER = ["G", "A", "PPP", "SOG", "HIT", "BLK", "PIM"];
const GOALIE = ["SV", "GA", "SA", "W", "SO"];
type Strength = "ES" | "PP" | "SH" | "ALL";
type Counts = Record<string, number | null>;
export interface PriorObservation {
  playerId: number; gameId: number; seasonId: number; kind: "skater" | "goalie"; gameType: "regular";
  gameStartAt: string; finalAt: string; appeared: boolean | null;
  counts: Counts; strengths: Partial<Record<Strength, { minutes: number | null; counts: Counts }>>;
}
export interface PriorBaselineProtocol {
  id: string; registeredAt: string; previousSeasonId: number; admissibleSeasonIds: number[];
  halfLifeDays: number; priorAppearances: number; priorMinutes: number;
  evidenceClass: "fixture" | "prior_only_reconstruction" | "prospective_shadow";
}
export interface BaselineExposure {
  expectedGames: number | null;
  /** Unconditional predicted minutes, already integrating participation; never multiply these by GP again. */
  expectedMinutes: Partial<Record<Strength, number | null>>;
}
export interface PriorBaselineInput {
  playerId: number; kind: "skater" | "goalie"; cutoffAt: string; targetGameIds: number[];
  protocol: PriorBaselineProtocol; history: PinnedInput<PriorObservation>[];
  exposure: PinnedInput<BaselineExposure>; admission: Admission;
}
const heads = (kind: PriorBaselineInput["kind"]) => kind === "skater" ? SKATER : GOALIE;
const family = (head: string) => ["G", "A", "PPP"].includes(head) ? ["G", "A", "PPP"] : ["SV", "GA", "SA"].includes(head) ? ["SV", "GA", "SA"] : [head];
const known = (counts: Counts, head: string) => family(head).every(h => typeof counts[h] === "number" && Number.isFinite(counts[h]));
function validateCounts(counts: Counts, kind: PriorBaselineInput["kind"]) {
  if (heads(kind).some(h => !Object.hasOwn(counts, h) || counts[h] !== null && (!Number.isSafeInteger(counts[h]) || counts[h]! < 0))) throw new Error("invalid_or_missing_prior_counts");
  if (known(counts, "PPP") && counts.PPP! > counts.G! + counts.A!) throw new Error("incoherent_prior_points");
  if (known(counts, "SA") && counts.SA !== counts.SV! + counts.GA!) throw new Error("incoherent_prior_shots");
  if (kind === "goalie" && ["W", "SO"].some(h => counts[h] !== null && counts[h]! > 1)) throw new Error("invalid_goalie_event");
}

export function buildPriorBaselines(input: PriorBaselineInput) {
  const { protocol: p, cutoffAt, history, exposure, admission, kind } = input;
  assertId(input.playerId); assertId(p.previousSeasonId);
  if (!p.id || instant(p.registeredAt) > instant(cutoffAt) || !["fixture", "prior_only_reconstruction", "prospective_shadow"].includes(p.evidenceClass)
    || !p.admissibleSeasonIds.includes(p.previousSeasonId) || ![p.halfLifeDays, p.priorAppearances, p.priorMinutes].every(n => Number.isFinite(n) && n > 0)
    || !input.targetGameIds.length || new Set(input.targetGameIds).size !== input.targetGameIds.length || history.length > 100000) throw new Error("invalid_predeclared_baseline_protocol");
  input.targetGameIds.forEach(assertId);
  assertPinnedInput(exposure, cutoffAt, admission);
  if ([exposure.value.expectedGames, ...Object.values(exposure.value.expectedMinutes)].some(n => n !== null && (!Number.isFinite(n) || n < 0))) throw new Error("invalid_predicted_exposure");
  const seen = new Set<string>();
  for (const pin of history) {
    assertPinnedInput(pin, cutoffAt, admission);
    const r = pin.value; [r.playerId, r.gameId, r.seasonId].forEach(assertId);
    const key = `${r.playerId}:${r.gameId}`;
    if (seen.has(key) || !p.admissibleSeasonIds.includes(r.seasonId) || r.gameType !== "regular"
      || input.targetGameIds.includes(r.gameId) || !(instant(r.gameStartAt) < instant(r.finalAt)
        && instant(r.finalAt) <= instant(pin.source.firstReceivedAt) && instant(r.finalAt) < instant(cutoffAt))) throw new Error("duplicate_unadmitted_or_immature_prior");
    seen.add(key); validateCounts(r.counts, r.kind);
    if (r.appeared !== null && typeof r.appeared !== "boolean") throw new Error("unknown_prior_participation");
    if (r.appeared === false && Object.values(r.counts).some(n => n !== null && n !== 0)) throw new Error("nonappearance_has_counts");
    for (const [name, strength] of Object.entries(r.strengths)) {
      if (!strength) continue;
      validateCounts(strength.counts, r.kind);
      if (!(r.kind === "skater" ? ["ES", "PP", "SH"] : ["ALL"]).includes(name)) throw new Error("invalid_strength_definition");
      if (r.kind === "skater" && (name !== "PP" && strength.counts.PPP !== null && strength.counts.PPP !== 0
        || name === "PP" && known(strength.counts, "PPP") && strength.counts.PPP !== strength.counts.G! + strength.counts.A!)) throw new Error("incoherent_strength_points");
      if (strength.minutes !== null && (!Number.isFinite(strength.minutes) || strength.minutes < 0)) throw new Error("invalid_prior_minutes");
      if (strength.minutes === 0 && Object.values(strength.counts).some(n => n !== null && n !== 0)) throw new Error("zero_minutes_have_production");
    }
    const strengths: Strength[] = r.kind === "skater" ? ["ES", "PP", "SH"] : ["ALL"];
    for (const h of heads(r.kind)) if (r.counts[h] !== null && strengths.every(s => r.strengths[s]?.counts[h] != null)
      && strengths.reduce((sum, s) => sum + r.strengths[s]!.counts[h]!, 0) !== r.counts[h]) throw new Error("strength_totals_disagree");
  }
  const eligible = history.filter(pin => pin.value.kind === kind && pin.value.appeared === true);
  const weight = (r: PriorObservation, b: string) => b === "B0" ? 1 : 2 ** (-(instant(cutoffAt) - instant(r.gameStartAt)) / (p.halfLifeDays * 86400000));
  const rate = (b: string, head: string, strength?: Strength) => {
    const rows = eligible.filter(pin => (b !== "B0" || pin.value.seasonId === p.previousSeasonId)
      && known(strength ? pin.value.strengths[strength]?.counts ?? {} : pin.value.counts, head)
      && (!strength || (pin.value.strengths[strength]?.minutes ?? 0) > 0));
    const sum = (own: boolean) => rows.filter(pin => (pin.value.playerId === input.playerId) === own).reduce((a, pin) => {
      const r = pin.value, w = weight(r, b), counts = strength ? r.strengths[strength]!.counts : r.counts;
      return { numerator: a.numerator + w * counts[head]!, denominator: a.denominator + w * (strength ? r.strengths[strength]!.minutes! : 1) };
    }, { numerator: 0, denominator: 0 });
    const own = sum(true), pool = sum(false), prior = strength ? p.priorMinutes : p.priorAppearances;
    // Missing population support is unknown. A rookie with no personal rows can use a real pooled prior.
    const value = pool.denominator > 0 ? (own.numerator + prior * pool.numerator / pool.denominator) / (own.denominator + prior) : null;
    return { value, ownExposure: own.denominator, pooledExposure: pool.denominator };
  };
  return { version: BASELINE_VERSION, protocolHash: contentHash(p), evidenceClass: p.evidenceClass,
    inputHash: contentHash(input), sourceIds: history.map(pin => pin.source.id), exposureHash: exposure.source.sha256,
    targetGameIds: [...input.targetGameIds], cutoffAt, promotion: "none", supplied: history.length,
    unknownParticipation: history.filter(pin => pin.value.appeared === null).length,
    knownNonappearances: history.filter(pin => pin.value.appeared === false).length,
    baselines: ["B0", "B1", "B2"].map(b => {
      const conditional: Record<string, number | null> = {}, expected: Counts = {}, support: Record<string, ReturnType<typeof rate>> = {};
      for (const head of heads(kind)) {
        // W/SO are appearance events; B2 does not turn them into goals-per-minute models.
        if (b !== "B2" || ["W", "SO"].includes(head)) {
          const r = rate(b, head); support[head] = r; conditional[head] = r.value;
          expected[head] = r.value === null || exposure.value.expectedGames === null ? null : r.value * exposure.value.expectedGames;
        } else {
          const strengths: Strength[] = kind === "skater" ? ["ES", "PP", "SH"] : ["ALL"];
          let total: number | null = 0;
          for (const strength of strengths) {
            const r = rate(b, head, strength), minutes = exposure.value.expectedMinutes[strength]; support[`${head}:${strength}`] = r;
            if (minutes === 0) continue;
            if (r.value === null || minutes == null) total = null;
            else if (total !== null) total += r.value * minutes;
          }
          conditional[head] = null; expected[head] = total;
        }
      }
      return { id: b, conditionalPerAppearance: conditional, expected, support };
    }), limitations: ["Point means only; no joint samples, expected realized ratios or accuracy claim.",
      "Common count-family support preserves accounting; missing heads remain null.",
      "All rates and pooled priors use supplied admitted, mature pre-origin observations. Historical enriched inputs are not synthesized.",
      "Exposure is an independently pinned prediction held fixed for all baselines; this module does not fit participation or goalie selection."] };
}
