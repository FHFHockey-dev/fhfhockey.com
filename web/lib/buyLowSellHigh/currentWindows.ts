/** Current-season BLSH research profiles: assembles current windows (W), personal
 * references (H), process rates and explanation context, then calls the unchanged
 * `productionReference` and `supportGap` functions. Pure: callers supply every input;
 * no I/O, clock or network. Assembly yields to the event loop between players so a long
 * run never blocks its host. Research only; nothing here is trusted or adopted.
 *
 * History process gate (dry-run simplification, disclosed in every output): a history
 * game's process value counts only when exactly one NST row matches the player and
 * date with GP 1 and TOI equal to WGO TOI, mirroring `currentInput`'s process check.
 * It is not the archived sealed-transport gate, so results built on it are exploratory.
 */
import type { qualifyCurrentResearchInputs } from "./currentInput";
import { fitProductionPrior, gameWeight, INSUFFICIENT_HISTORY_GAMES, outcomes, priorSeasons, scoreProduction, selectReference, summarizeHistory, weightedBaseline, weightedHistorySummary,
  type HistoryStatus, type HistorySummary, type ProductionAxisRecord, type WeightedBaseline } from "./productionReference";
import { explainSupportGap, fitPrior, scoreAndAttribute, type ProductionAxis, type Provenance, type ScoringModel, type SupportGapExplanation, type SupportGapResult, type TrainingBlock, type WindowEvidence } from "./supportGap";

export const CURRENT_WINDOWS_VERSION = "blsh-current-windows-dry-run-v5";
/** A and B: the final up-to-50 games before the window (A: history only; B: plus current-season games).
 * C: TJ decision 1's recency-weighted personal baseline (`weightedBaseline`), provisional weights. */
export type Arm = "A_development_reference" | "B_development_plus_2026_prefix" | "C_weighted_personal_baseline";
type CurrentRecord = ReturnType<typeof qualifyCurrentResearchInputs>["records"][number];

/** One row of exported history (2022-24 development export or a later season's database export). */
export type DevRow = {
  id: number; player_id: number; season_id: number; date: string; position_code: string | null; team_abbrev: string | null;
  games_played: number | null; toi_per_game: number | null; es_toi_per_game: number | null; pp_toi_per_game: number | null;
  nst_individual: { nst_gp: number | null; nst_toi: number | null; nst_ixg: number | null }[];
  nst_onice: { gp: number | null; toi: number | null; xgf: number | null; xga: number | null }[];
  [stat: string]: unknown;
};
/** One game slot in either source, reduced to what the assembler needs. Nulls are unavailable, never zero. */
export type Slot = {
  id: number; playerId: number; season: number; date: string; source: "development" | "current"; position: "F" | "D" | null; team: string | null;
  gamesPlayed: number | null; seconds: number | null; esSeconds: number | null; ppSeconds: number | null;
  tracks: (number | null)[]; goals: number | null; assists: number | null; shots: number | null;
  ixG: number | null; onIceXGF: number | null; onIceXGA: number | null; onIceGF: number | null; reasons: string[];
  /** Known revision of this game's six on-ice goal fields: raw WGO, official-evidence correction
   * (development research view), official-receipt research overlay (current season) or unresolved. */
  onIceGoalsRevision: string;
};
/** Window production versus the reference in one unit; tracks in `PRODUCTION_TRACKS` order. Null is unavailable. */
export type UnitComparison = { unit: "per_game" | "per_60"; window: (number | null)[]; reference: (number | null)[]; delta: (number | null)[] };
export type Profile = {
  playerId: number; name: string | null; team: string | null; position: "F" | "D" | null; arm: Arm;
  window: { sourceIds: number[]; dates: string[]; seconds: number | null; appearances: number; spanDays: number; lastDateAgeDays: number | null; fresh: boolean };
  /** `personalN`: usable personal games behind the scored reference (0 when it is the cohort's).
   * `historyStatus` tells confirmed zero history from unknown history: "confirmed_none" only when the
   * player has no lookback games at all and the source covers all three prior seasons; "unknown" when a
   * prior season is missing from the source (`missingSeasons`) or every lookback game was unusable.
   * `insufficientHistory`: personalN below decision 1's provisional ~20-game cutoff (lists withhold direction).
   * `baseline`: arm C's weighted baseline with its season shares; null in arms A and B. */
  reference: { sourceIds: number[]; dates: string[]; personalN: number; reason: string | null; seasons: number[]; ageDays: number | null; staleDevelopmentReference: boolean;
    historyStatus: HistoryStatus; missingSeasons: number[]; insufficientHistory: boolean; baseline: WeightedBaseline | null };
  /** Per-game and per-60 window production, each against the reference in the same unit. */
  comparisons: UnitComparison[];
  production: ProductionAxisRecord; result: SupportGapResult; explanation: SupportGapExplanation; coverage: { component: string; reason: string; count: number }[];
  exploratory: true;
};

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const position = (code: unknown): "F" | "D" | null => (code === "D" ? "D" : ["F", "C", "L", "R", "LW", "RW"].includes(code as string) ? "F" : null);
const days = (from: string, to: string) => (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000;
const sumOrNull = (values: (number | null)[]) => (values.length && values.every(finite) ? (values as number[]).reduce((s, v) => s + v, 0) : null);
/** A per-game count or exposure: finite and non-negative, else unavailable. A present but invalid
 * value adds `invalid_<name>` to the slot's reasons, so it is never summed with other games. */
const measured = (v: unknown, name: string, reasons: string[]) => {
  if (v === null || v === undefined) return null;
  if (finite(v) && v >= 0) return v;
  reasons.push(`invalid_${name}`);
  return null;
};
const onIceGoalsFor = (s: Record<string, unknown>, reasons: string[]) => {
  const v = [s.es_goals_for, s.pp_goals_for, s.sh_goals_for];
  if (v.some(x => x !== null && x !== undefined && !(finite(x) && x >= 0))) reasons.push("invalid_on_ice_goals_for");
  return v.every(x => finite(x) && x >= 0) ? (v as number[]).reduce((a, b) => a + b, 0) : null;
};

export function devSlot(r: DevRow): Slot {
  const reasons: string[] = [];
  const gp1 = r.games_played === 1, seconds = measured(r.toi_per_game, "toi", reasons);
  const ind = r.nst_individual.length === 1 ? r.nst_individual[0] : null, oi = r.nst_onice.length === 1 ? r.nst_onice[0] : null;
  const ixGOk = gp1 && ind !== null && ind.nst_gp === 1 && seconds !== null && ind.nst_toi === seconds && finite(ind.nst_ixg) && ind.nst_ixg >= 0;
  const onIceOk = gp1 && oi !== null && oi.gp === 1 && seconds !== null && oi.toi === seconds && finite(oi.xgf) && finite(oi.xga) && oi.xgf >= 0 && oi.xga >= 0;
  if (!ixGOk) reasons.push(r.nst_individual.length === 0 ? "history_nst_individual_absent" : "history_nst_individual_gate_failed");
  if (!onIceOk) reasons.push(r.nst_onice.length === 0 ? "history_nst_onice_absent" : "history_nst_onice_gate_failed");
  const tracks = gp1 ? outcomes(r as Record<string, number | null>).map(m => m.value) : [null, null, null];
  return {
    id: r.id, playerId: r.player_id, season: r.season_id, date: r.date, source: "development", position: position(r.position_code), team: r.team_abbrev,
    gamesPlayed: r.games_played, seconds, esSeconds: measured(r.es_toi_per_game, "es_toi", reasons), ppSeconds: measured(r.pp_toi_per_game, "pp_toi", reasons),
    tracks, goals: measured(r.goals, "goals", reasons), assists: measured(r.assists, "assists", reasons), shots: measured(r.shots, "shots", reasons),
    ixG: ixGOk ? ind!.nst_ixg : null, onIceXGF: onIceOk ? oi!.xgf : null, onIceXGA: onIceOk ? oi!.xga : null, onIceGF: onIceGoalsFor(r, reasons), reasons,
    onIceGoalsRevision: r._research_correction_status === "not_target_raw_complete" || r._research_correction_status === "wgo_db_raw" ? "wgo_raw" : r._research_correction_status === "evidence_corrected" ? "official_evidence_corrected" : `unresolved:${String(r._research_correction_status)}`,
  };
}

export function currentSlot(c: CurrentRecord): Slot {
  const rec = c.research.record, q = c.research;
  const reasons = [...q.identityAndExposure.reasons];
  const trackQualified = [q.tracks.fantasyPoints.qualified, q.tracks.rawPoints.qualified, q.tracks.wigoGameScore.qualified];
  ([["fantasyPoints", 0], ["rawPoints", 1], ["wigoGameScore", 2]] as const).forEach(([k]) => reasons.push(...q.tracks[k].reasons.map(x => `${k}:${x}`)));
  if (!q.individual.qualified) reasons.push(...q.individual.reasons.map(x => `individual:${x}`));
  if (!q.onIce.qualified) reasons.push(...q.onIce.reasons.map(x => `onIce:${x}`));
  const values = outcomes(rec.counts as Record<string, number | null>).map(m => m.value);
  const ind = q.individual.qualified ? q.individual.observed[0] : null, oi = q.onIce.qualified ? q.onIce.observed[0] : null;
  return {
    id: rec.id, playerId: rec.player_id, season: rec.season_id, date: rec.date, source: "current", position: position(rec.position_code), team: rec.team_abbrev ?? null,
    gamesPlayed: rec.games_played, seconds: measured(rec.toi_per_game, "toi", reasons),
    esSeconds: measured(rec.es_toi_per_game, "es_toi", reasons), ppSeconds: measured(rec.pp_toi_per_game, "pp_toi", reasons),
    tracks: values.map((v, i) => (trackQualified[i] ? v : null)),
    goals: measured(rec.counts.goals, "goals", reasons), assists: measured(rec.counts.assists, "assists", reasons), shots: measured(rec.counts.shots, "shots", reasons),
    ixG: ind ? measured(ind.ixg, "ixg", reasons) : null, onIceXGF: oi ? measured(oi.xgf, "on_ice_xgf", reasons) : null, onIceXGA: oi ? measured(oi.xga, "on_ice_xga", reasons) : null,
    onIceGF: onIceGoalsFor(rec.counts as Record<string, unknown>, reasons), reasons: [...new Set(reasons)],
    onIceGoalsRevision: c.overlay.state === "applied_to_research_copy" ? "official_receipt_overlay" : "wgo_raw",
  };
}

/** Window totals; each is null unless every slot has it. Slots are validated per game first, so
 * invalid values cannot cancel out in a sum. NST and other WGO revisions are unknown (null).
 * On-ice goals carry the games' known revision, or `mixed:` with every label when games differ,
 * plus each game's revision in window order. */
export function windowEvidence(playerId: number, slots: Slot[]): WindowEvidence {
  const revisions = [...new Set(slots.map(s => s.onIceGoalsRevision))].sort();
  const all = "all_situations" as const;
  const source = (provider: string, field: string, revision: string | null = null): Provenance => ({ provider, field, revision });
  return {
    identity: { playerId, sourceIds: slots.map(s => s.id) },
    appearances: slots.length, seconds: sumOrNull(slots.map(s => s.seconds)), esSeconds: sumOrNull(slots.map(s => s.esSeconds)), ppSeconds: sumOrNull(slots.map(s => s.ppSeconds)),
    goals: sumOrNull(slots.map(s => s.goals)), assists: sumOrNull(slots.map(s => s.assists)), shots: sumOrNull(slots.map(s => s.shots)),
    ixG: sumOrNull(slots.map(s => s.ixG)), onIceGF: sumOrNull(slots.map(s => s.onIceGF)), onIceXGF: sumOrNull(slots.map(s => s.onIceXGF)),
    scopes: { goals: all, assists: all, shots: all, ixG: all, onIceGoals: all, onIceXG: all },
    provenance: {
      goals: source("nhl_wgo", "goals"), assists: source("nhl_wgo", "assists"), shots: source("nhl_wgo", "shots"),
      ixG: source("nst", "individual_ixg_all_situations"), onIceXG: source("nst", "on_ice_xgf_all_situations"),
      onIceGoals: { ...source("nhl_wgo", "on_ice_goals_for_es_pp_sh", revisions.length === 1 ? revisions[0] : `mixed:${revisions.join("+")}`), gameRevisions: slots.map(s => s.onIceGoalsRevision) },
    },
  };
}
const per60 = (total: number | null, seconds: number | null) => (total === null || seconds === null || seconds <= 0 ? null : (3600 * total) / seconds);

function historySummary(h: Slot[], playerId: number, pos: "F" | "D" | null, before: string, full = false): [HistorySummary | null, string | null] {
  if (h.some(r => r.gamesPlayed !== 1)) return [null, "GP_unknown_or_nonappearance"];
  return summarizeHistory(playerId, pos ?? "", h.map(r => r.tracks.map(v => (v === null ? NaN : v))), h.map(r => r.seconds ?? NaN), h.map(r => r.id), h.map(r => r.date), before, full);
}

export type AssembleInput = {
  current: CurrentRecord[]; history: DevRow[]; blocks: TrainingBlock[]; arm: Arm; eventThroughDate: string;
  names?: Map<number, string>;
  /** Seasons the history input covers in full; default: every season present in it. A prior season
   * outside this list makes a player's history unknown rather than zero. */
  coveredSeasons?: number[];
};
/** Unweighted rates over the usable reference games (arms A and B). */
function unweightedRates(h: Slot[]): { perGame: (number | null)[]; per60: (number | null)[] } {
  const used = h.filter(s => s.gamesPlayed === 1 && s.seconds !== null && s.seconds > 0);
  const rows = (j: number) => used.filter(s => s.tracks[j] !== null);
  const total = (j: number) => rows(j).reduce((a, s) => a + (s.tracks[j] as number), 0);
  return { perGame: [0, 1, 2].map(j => (rows(j).length ? total(j) / rows(j).length : null)),
    per60: [0, 1, 2].map(j => per60(total(j), rows(j).length ? rows(j).reduce((a, s) => a + (s.seconds as number), 0) : null)) };
}
/** Arm C process reference: weighted per-60 over the reference games whose process value qualified,
 * personal only when they carry at least half the weighted reference TOI (provisional rule). */
function weightedProcess(h: Slot[], season: number): { rates: (number | null)[]; shares: number[] } {
  const w = (s: Slot) => gameWeight(season, s.season) ?? 0, totalT = h.reduce((a, s) => a + w(s) * (s.seconds ?? 0), 0);
  const values = [(s: Slot) => s.ixG, (s: Slot) => s.onIceXGF, (s: Slot) => s.onIceXGA];
  const out = values.map(v => {
    const rows = h.filter(s => v(s) !== null && s.seconds !== null && s.seconds > 0), t = rows.reduce((a, s) => a + w(s) * (s.seconds as number), 0);
    const share = totalT > 0 ? t / totalT : 0;
    return { rate: share >= 0.5 ? (3600 * rows.reduce((a, s) => a + w(s) * (v(s) as number), 0)) / t : null, share };
  });
  return { rates: out.map(o => o.rate), shares: out.map(o => o.share) };
}
const yieldNow = () => new Promise(resolve => setTimeout(resolve, 0));
/** Build one research profile per captured current-season player. */
export async function assembleProfiles(input: AssembleInput): Promise<Profile[]> {
  const dev = new Map<number, Slot[]>(), current = new Map<number, Slot[]>();
  const covered = input.coveredSeasons ?? [...new Set(input.history.map(r => r.season_id))];
  for (const r of input.history) { const s = devSlot(r); if (!dev.has(s.playerId)) dev.set(s.playerId, []); dev.get(s.playerId)!.push(s); }
  for (const c of input.current) { const s = currentSlot(c); if (!current.has(s.playerId)) current.set(s.playerId, []); current.get(s.playerId)!.push(s); }
  const order = (a: Slot, b: Slot) => a.date.localeCompare(b.date) || a.id - b.id;
  dev.forEach(rows => rows.sort(order)); current.forEach(rows => rows.sort(order));

  // Donors: development players with a complete, single-position final 50 games (prior-only by construction).
  const donors: HistorySummary[] = [];
  for (const [pid, rows] of dev) {
    await yieldNow();
    const h = rows.slice(-50), positions = new Set(h.map(r => r.position));
    if (h.length !== 50 || positions.size !== 1 || positions.has(null)) continue;
    const [s] = historySummary(h, pid, [...positions][0], "2026-07-01", true);
    if (s) donors.push(s);
  }

  // Fit only on qualified, position-matched blocks that end before the window (v1 `prior_blocks`).
  const qualifiedBlocks = input.blocks.filter(b => b.qualified_process_exposure);

  const profiles: Profile[] = [];
  for (const [pid, rows] of current) {
    await yieldNow();
    const w = rows.slice(-5), before = w[0].date, pos = w[w.length - 1].position, season = w[w.length - 1].season;
    const pool = input.arm === "A_development_reference" ? dev.get(pid) ?? [] : [...(dev.get(pid) ?? []), ...rows.slice(0, -5)];
    const baseline = input.arm === "C_weighted_personal_baseline" ? weightedBaseline(pool, season, before, covered) : null;
    let h: Slot[], personal: HistorySummary | null, personalReason: string | null;
    if (baseline) {
      const ids = new Set(baseline.sourceIds);
      h = pool.filter(s => ids.has(s.id)).sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
      [personal, personalReason] = weightedHistorySummary(baseline, pid, pos ?? "");
    } else {
      h = selectReference(pool.map(s => ({ ...s, player_id: s.playerId })), pid, before) as (Slot & { player_id: number })[];
      [personal, personalReason] = historySummary(h, pid, pos, before);
    }
    if (h.some(r => r.position !== pos)) { personal = null; personalReason = "mixed_personal_position_cohort_reference"; }
    if (!h.length) personalReason = baseline?.status === "unknown" ? "personal_history_unknown_cohort" : "no_personal_history_cohort";
    const [prior, priorReason] = pos ? fitProductionPrior(donors, pos, pid, before) : [null, "unknown_dated_position"];
    const complete = w.every(s => s.gamesPlayed === 1), seconds = complete ? sumOrNull(w.map(s => s.seconds)) : null;
    const y = [0, 1, 2].map(j => sumOrNull(w.map(s => s.tracks[j])));
    // Identity and outcome split travel on the axis the score consumes, so explanations are checked against the scored record.
    const production = { ...scoreProduction(prior, personal, y, seconds), player_id: pid, current_source_ids: w.map(s => s.id), reference_source_ids: h.map(s => s.id),
      current_recorded_slots: w.length, current_goals: sumOrNull(w.map(s => s.goals)), current_assists: sumOrNull(w.map(s => s.assists)),
      prior_reason: priorReason, personal_reason: personalReason } as ProductionAxisRecord;

    const wEvidence = windowEvidence(pid, w), hEvidence = h.length ? windowEvidence(pid, h) : null;
    const process = (e: WindowEvidence | null, slots: Slot[]) => !e || !slots.length ? [null, null, null] : [per60(e.ixG, e.seconds), per60(e.onIceXGF, e.seconds), per60(sumOrNull(slots.map(s => s.onIceXGA)), e.seconds)];
    const currentProcess = process(wEvidence, w), weighted = baseline ? weightedProcess(h, season) : null;
    const referenceProcess = weighted ? weighted.rates : process(hEvidence, h);
    const personalModes = referenceProcess.map(v => v !== null && h.length > 0);
    let model: ScoringModel | null = null, modelReason: string | null = null;
    if (pos) [model, modelReason] = fitPrior(qualifiedBlocks.filter(b => b.position === pos && b.dates[b.dates.length - 1] < before), pid, pos, before);
    const lastAge = days(w[w.length - 1].date, input.eventThroughDate), fresh = production.value !== null && lastAge >= 0 && lastAge <= 7;
    const result = scoreAndAttribute(model, production as unknown as ProductionAxis, currentProcess, referenceProcess, personalModes, fresh);
    const coverageCounts = new Map<string, number>();
    const note = (component: string, reason: string) => coverageCounts.set(`${component}|${reason}`, (coverageCounts.get(`${component}|${reason}`) ?? 0) + 1);
    w.forEach(s => s.reasons.forEach(r => note("current_window_slot", r)));
    h.forEach(s => s.reasons.forEach(r => note("reference_slot", r)));
    if (personalReason) note("personal_reference", personalReason);
    if (priorReason) note("production_prior", priorReason);
    if (modelReason) note("support_model", modelReason);
    if (w.length < 5) note("current_window", "fewer_than_five_recorded_slots");
    if (weighted) weighted.shares.forEach((share, j) => { if (h.length && share < 0.5) note("reference_process", `${["ixG", "onIceXGF", "onIceXGA"][j]}_qualified_share_below_half_cohort_used`); });
    if (baseline) note("reference_context", "explanation_reference_totals_unweighted_over_baseline_games");
    const seasons = [...new Set(h.map(s => s.season))];
    const missingSeasons = baseline ? baseline.missingSeasons : priorSeasons(season).filter(s => !covered.includes(s));
    const personalN = personal?.n ?? 0;
    const historyStatus: HistoryStatus = baseline ? (personalN > 0 ? "personal" : baseline.status === "personal" ? "unknown" : baseline.status)
      : personalN > 0 ? "personal" : !h.length && !missingSeasons.length ? "confirmed_none" : "unknown";
    const rates = baseline ?? unweightedRates(h), games = complete ? w.length : null;
    const comparisons: UnitComparison[] = [
      { unit: "per_game", window: y.map(v => (v === null || !games ? null : v / games)), reference: personal ? rates.perGame : [null, null, null], delta: [] },
      { unit: "per_60", window: y.map(v => per60(v, seconds)), reference: personal ? rates.per60 : [null, null, null], delta: [] },
    ].map(c => ({ ...c, unit: c.unit as UnitComparison["unit"], delta: c.window.map((v, j) => (v === null || c.reference[j] === null ? null : v - (c.reference[j] as number))) }));
    profiles.push({
      playerId: pid, name: input.names?.get(pid) ?? null, team: w[w.length - 1].team, position: pos, arm: input.arm,
      window: { sourceIds: w.map(s => s.id), dates: w.map(s => s.date), seconds, appearances: w.length, spanDays: days(w[0].date, w[w.length - 1].date), lastDateAgeDays: lastAge, fresh },
      reference: { sourceIds: h.map(s => s.id), dates: h.map(s => s.date), personalN, reason: personalReason, seasons,
        ageDays: h.length ? days(h[h.length - 1].date, before) : null, staleDevelopmentReference: h.some(s => s.source === "development"),
        historyStatus, missingSeasons, insufficientHistory: personalN < INSUFFICIENT_HISTORY_GAMES, baseline },
      comparisons, production, result,
      explanation: explainSupportGap(result, { current: wEvidence, reference: hEvidence,
        coverage: [{ component: "history_process_gate", state: "estimated", reason: "dry_run_simplified_gate_not_sealed_transport" }] }),
      coverage: [...coverageCounts].map(([k, count]) => { const [component, reason] = k.split("|"); return { component, reason, count }; }),
      exploratory: true,
    });
  }
  return profiles.sort((a, b) => a.playerId - b.playerId);
}
