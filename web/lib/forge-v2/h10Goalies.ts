/**
 * FORGE Full-NHL H1–H10 goalie if-starts forecasts. This is a separate target and contract, because the v2 skater
 * target, its seven categories and `linear-seven-v1` scoring do not describe goaltending. No new model: the same
 * Gaussian-kernel conditional-means estimator as `official-appearance-kernel-means-v1`, applied to goalie starts with
 * one predeclared, unreviewed recipe. The forecast is conditional on the goalie starting; start probability is not
 * modelled and is reported unavailable.
 */
import { Component, Horizon, Instant, SourceReference, assertId, assertSource, available, instant, unavailable } from "./contracts";
import { canonicalJson } from "./identity";
import { contentHash } from "./hash.server";
import { H10GameLog } from "./h10Features";

export const GOALIE_TARGET_VERSION = "nhl-official-goalie-start-v1" as const;
export const GOALIE_CONDITIONING = "official_start_given_game_occurs" as const;
export const GOALIE_CATEGORIES = ["SAVES", "SHOTS_AGAINST", "GOALS_ALLOWED", "WIN", "SHUTOUT"] as const;
export type GoalieCategory = (typeof GOALIE_CATEGORIES)[number];
export type GoalieMeans = Record<GoalieCategory, Component<number>>;
export const GOALIE_ALGORITHM = "goalie-start-kernel-means-v1";
export const GOALIE_RECIPE = { id: "forge-h10-goalie-kernel-v1", featureNames: ["goalie_save_rate", "team_shots_against_rate", "opponent_shots_for_rate", "opponent_goals_for_rate", "home"], bandwidth: 0.6, minimumSupport: 25 } as const;
export const GOALIE_PRIORS = { savePct: 0.9, shotsWeight: 300, shotsPerGame: 29, goalsPerGame: 3.1, shrinkGames: 8 } as const;
export const GOALIE_FEATURE_VERSION = "forge-h10-goalie-features-v1";

/** One goalie game line: a start or a relief appearance, with the receipt of that row. */
export interface H10GoalieLog {
  playerId: number; gameId: number; seasonId: number; teamId: number; opponentId: number; home: boolean; gameStartAt: Instant;
  started: boolean; values: Record<GoalieCategory, number | null>; source: SourceReference;
}

export interface GoalieVintage {
  id: string; issuanceKey: string; sequence: number;
  playerId: number; gameId: number; seasonId: number; targetVersion: typeof GOALIE_TARGET_VERSION; conditioning: typeof GOALIE_CONDITIONING;
  teamId: number; opponentId: number; home: boolean; horizon: Horizon; scheduleRevision: string; affiliationRevision: string;
  sourceGameDate: string; scheduledStartAt: Instant; inputCutoffAt: Instant; generatedAt: Instant;
  means: GoalieMeans; startProbability: Component<number>;
  modelVersion: string; featureVersion: string; codeVersion: string; cohort: string;
  sourceManifest: SourceReference[]; trigger: "daily" | "material"; predecessorId: string | null;
  evidenceClass: "fixture" | "prospective_shadow"; limitations: string[];
}

export function assertGoalieVintage(v: GoalieVintage): void {
  assertId(v.playerId); assertId(v.gameId); assertId(v.seasonId); assertId(v.teamId); assertId(v.opponentId);
  if (v.targetVersion !== GOALIE_TARGET_VERSION || v.conditioning !== GOALIE_CONDITIONING) throw new Error("Incompatible goalie target");
  if (v.teamId === v.opponentId || typeof v.home !== "boolean" || !Number.isInteger(v.horizon) || v.horizon < 1 || v.horizon > 10) throw new Error("Invalid goalie game sides or horizon");
  if (!Number.isSafeInteger(v.sequence) || v.sequence < 1) throw new Error("Invalid issuance sequence");
  for (const key of ["id", "issuanceKey", "scheduleRevision", "affiliationRevision", "modelVersion", "featureVersion", "codeVersion", "cohort"] as const) if (typeof v[key] !== "string" || !v[key].trim()) throw new Error(`Missing goalie vintage ${key}`);
  if (instant(v.generatedAt) < instant(v.inputCutoffAt)) throw new Error("Generation precedes cutoff");
  instant(v.scheduledStartAt);
  if (!v.sourceManifest.length) throw new Error("Missing source manifest");
  v.sourceManifest.forEach(source => assertSource(source, v.inputCutoffAt));
  for (const c of GOALIE_CATEGORIES) {
    const m = v.means[c];
    if (!m || !["available", "unavailable"].includes(m.state) || m.state === "unavailable" && !m.reason?.trim()) throw new Error(`Invalid goalie component ${c}`);
    if (m.state === "available" && (!Number.isFinite(m.value) || m.value < 0 || (["WIN", "SHUTOUT"].includes(c) && m.value > 1))) throw new Error(`Invalid goalie value ${c}`);
  }
  const { SAVES: sv, SHOTS_AGAINST: sa, GOALS_ALLOWED: ga } = v.means;
  if (sv.state === "available" && sa.state === "available" && ga.state === "available" && Math.abs(sa.value - sv.value - ga.value) > 1e-9) throw new Error("Saves plus goals allowed must equal shots against");
  if (!["daily", "material"].includes(v.trigger) || !["fixture", "prospective_shadow"].includes(v.evidenceClass) || !Array.isArray(v.limitations)) throw new Error("Invalid goalie issuance class");
}

interface Rates { starts: number; saves: number; shots: number }
/** Season-to-date goalie and team rates from rows received by the cutoff. Team shot and goal rates come from the
 * skater game lines (every skater's shots and goals, summed per team game). */
export class GoalieRateState {
  readonly goalies = new Map<number, Rates>();
  readonly teams = new Map<number, { games: number; shotsFor: number; goalsFor: number; shotsAgainst: number }>();
  private readonly counted = new Set<string>();
  latestReceipt: SourceReference | null = null;
  private receipt(source: SourceReference) {
    if (!this.latestReceipt || instant(source.firstReceivedAt) > instant(this.latestReceipt.firstReceivedAt)
      || source.firstReceivedAt === this.latestReceipt.firstReceivedAt && source.id > this.latestReceipt.id) this.latestReceipt = source;
  }
  addSkaters(rows: readonly H10GameLog[]) {
    for (const row of rows) {
      for (const [teamId, side] of [[row.teamId, "for"], [row.opponentId, "against"]] as const) {
        const t = this.teams.get(teamId) ?? { games: 0, shotsFor: 0, goalsFor: 0, shotsAgainst: 0 }, key = `${row.gameId}:${teamId}`;
        if (!this.counted.has(key)) { this.counted.add(key); t.games += 1; }
        if (side === "for") { t.shotsFor += row.values.SOG ?? 0; t.goalsFor += row.values.G ?? 0; } else t.shotsAgainst += row.values.SOG ?? 0;
        this.teams.set(teamId, t);
      }
      this.receipt(row.source);
    }
  }
  addGoalies(rows: readonly H10GoalieLog[]) {
    for (const row of rows.filter(r => r.started && r.values.SAVES !== null && r.values.SHOTS_AGAINST !== null)) {
      const g = this.goalies.get(row.playerId) ?? { starts: 0, saves: 0, shots: 0 };
      g.starts += 1; g.saves += row.values.SAVES!; g.shots += row.values.SHOTS_AGAINST!; this.goalies.set(row.playerId, g);
      this.receipt(row.source);
    }
  }
  static from(skaters: readonly H10GameLog[], goalies: readonly H10GoalieLog[], seasonId: number, cutoff: Instant) {
    const state = new GoalieRateState(), at = instant(cutoff), admit = (r: { seasonId: number; gameStartAt: Instant; source: SourceReference }) => r.seasonId === seasonId && instant(r.gameStartAt) < at && instant(r.source.firstReceivedAt) <= at;
    state.addSkaters(skaters.filter(admit)); state.addGoalies(goalies.filter(admit));
    return state;
  }
  features(goalieId: number, teamId: number, opponentId: number, home: boolean): Record<string, Component<number>> {
    const g = this.goalies.get(goalieId) ?? { starts: 0, saves: 0, shots: 0 }, empty = { games: 0, shotsFor: 0, goalsFor: 0, shotsAgainst: 0 };
    const own = this.teams.get(teamId) ?? empty, opp = this.teams.get(opponentId) ?? empty, k = GOALIE_PRIORS.shrinkGames;
    const save = (g.saves + GOALIE_PRIORS.shotsWeight * GOALIE_PRIORS.savePct) / (g.shots + GOALIE_PRIORS.shotsWeight);
    return {
      goalie_save_rate: available((save - GOALIE_PRIORS.savePct) * 20),
      team_shots_against_rate: available((own.shotsAgainst + k * GOALIE_PRIORS.shotsPerGame) / (own.games + k) / 30),
      opponent_shots_for_rate: available((opp.shotsFor + k * GOALIE_PRIORS.shotsPerGame) / (opp.games + k) / 30),
      opponent_goals_for_rate: available((opp.goalsFor + k * GOALIE_PRIORS.goalsPerGame) / (opp.games + k) / 3),
      home: available(home ? 1 : 0),
    };
  }
}

export interface GoalieExample { id: string; playerId: number; gameId: number; inputCutoffAt: Instant; outcomeAvailableAt: Instant; features: Record<string, Component<number>>; values: Record<GoalieCategory, number>; source: SourceReference }

/** Chronological goalie-start examples. Each example's features use only rows received by its own cutoff. */
export function buildGoalieTraining(skaters: readonly H10GameLog[], goalies: readonly H10GoalieLog[], seasonId: number, asOf: Instant, maximumExamples: number) {
  const cutoff = instant(asOf), state = new GoalieRateState();
  type Row = { kind: "s"; row: H10GameLog } | { kind: "g"; row: H10GoalieLog };
  const received: Row[] = [...skaters.map(row => ({ kind: "s" as const, row })), ...goalies.map(row => ({ kind: "g" as const, row }))]
    .filter(({ row }) => row.seasonId === seasonId && instant(row.gameStartAt) < cutoff && instant(row.source.firstReceivedAt) <= cutoff)
    .sort((a, b) => instant(a.row.source.firstReceivedAt) - instant(b.row.source.firstReceivedAt) || a.row.gameId - b.row.gameId || a.row.playerId - b.row.playerId);
  const starts = goalies.filter(r => r.seasonId === seasonId && r.started && instant(r.gameStartAt) < cutoff && instant(r.source.firstReceivedAt) <= cutoff
    && GOALIE_CATEGORIES.every(c => r.values[c] !== null)).sort((a, b) => instant(a.gameStartAt) - instant(b.gameStartAt) || a.playerId - b.playerId);
  const examples: GoalieExample[] = [], skipped = { noPriorReceipt: 0, inconsistentValues: 0 };
  let next = 0;
  for (const row of starts) {
    const exampleCutoff = instant(row.gameStartAt) - 3600000;
    const batch: Row[] = [];
    while (next < received.length && instant(received[next].row.source.firstReceivedAt) <= exampleCutoff) batch.push(received[next++]);
    state.addSkaters(batch.filter(b => b.kind === "s").map(b => b.row as H10GameLog)); state.addGoalies(batch.filter(b => b.kind === "g").map(b => b.row as H10GoalieLog));
    const v = row.values as Record<GoalieCategory, number>;
    if (v.SAVES + v.GOALS_ALLOWED !== v.SHOTS_AGAINST || v.SHUTOUT === 1 && v.GOALS_ALLOWED !== 0 || ![0, 1].includes(v.WIN) || ![0, 1].includes(v.SHUTOUT)) { skipped.inconsistentValues += 1; continue; }
    if (!state.latestReceipt) { skipped.noPriorReceipt += 1; continue; }
    examples.push({ id: `h10-goalie-example:${row.playerId}:${row.gameId}`, playerId: row.playerId, gameId: row.gameId, inputCutoffAt: new Date(exampleCutoff).toISOString(),
      outcomeAvailableAt: row.source.firstReceivedAt, features: state.features(row.playerId, row.teamId, row.opponentId, row.home), values: v, source: row.source });
  }
  examples.sort((a, b) => instant(b.inputCutoffAt) - instant(a.inputCutoffAt) || a.id.localeCompare(b.id));
  return { training: examples.slice(0, maximumExamples).sort((a, b) => a.id.localeCompare(b.id)), available: examples.length, skipped };
}

/** The kernel conditional mean, as in `official-appearance-kernel-means-v1`, over goalie categories. Training rows whose
 * outcome arrived after the cutoff, or from the target game, never contribute. */
export function goalieKernelMeans(training: readonly GoalieExample[], features: Record<string, Component<number>>, gameId: number, cutoff: Instant): { means: GoalieMeans; support: number } {
  const names = GOALIE_RECIPE.featureNames, at = instant(cutoff);
  const empty = (reason: string) => ({ means: Object.fromEntries(GOALIE_CATEGORIES.map(c => [c, unavailable(reason)])) as GoalieMeans, support: 0 });
  if (names.some(n => features[n]?.state !== "available")) return empty("missing_context_feature");
  const value = (f: Record<string, Component<number>>, n: string) => (f[n] as { value: number }).value;
  const rows = training.filter(r => r.gameId !== gameId && instant(r.outcomeAvailableAt) < at).map(r => ({ r,
    w: Math.exp(-names.reduce((s, n) => s + ((value(r.features, n) - value(features, n)) / GOALIE_RECIPE.bandwidth) ** 2, 0) / 2) })).filter(x => x.w > 0);
  if (rows.length < GOALIE_RECIPE.minimumSupport) return empty("sparse_goalie_start_history");
  const mass = rows.reduce((s, x) => s + x.w, 0);
  const means = Object.fromEntries(GOALIE_CATEGORIES.map(c => [c, available(rows.reduce((s, x) => s + x.w * x.r.values[c], 0) / mass)])) as GoalieMeans;
  // Linear means of rows with SA = SV + GA keep the identity up to rounding; pin it exactly.
  means.GOALS_ALLOWED = available(Math.max(0, (means.SHOTS_AGAINST as { value: number }).value - (means.SAVES as { value: number }).value));
  return { means, support: rows.length };
}

export const goalieModelVersion = (training: readonly GoalieExample[]) => contentHash({ algorithm: GOALIE_ALGORITHM, recipe: GOALIE_RECIPE, priors: GOALIE_PRIORS, training: contentHash(canonicalJson(training)) });
