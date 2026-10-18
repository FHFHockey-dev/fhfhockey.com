/**
 * Manager-entered trade comparison over shared interpretation records (FR-10..13).
 * Advisory only: raw projected production from unmodified FORGE horizon totals.
 * No roster, replacement or acceptance logic; incomplete inputs never yield a winner.
 */
import { LOWER_IS_BETTER, TARGET_LABELS, type InterpretationRecord } from "lib/skoElement/contract";

export type TradeScoring =
  | { mode: "points"; scoringBasis: string; weights: Record<string, number> }
  | { mode: "categories"; categories: string[] };

export type TradeInput = { give: string[]; receive: string[]; scoring: TradeScoring };

export type TradeIssue = { code: string; message: string; blocking: boolean };

type SideValue = { value: number | null; missingPlayerIds: string[]; reason: string | null };

export type TradeComparison = {
  issues: TradeIssue[];
  complete: boolean;
  horizonGames: number | null;
  players: Array<{ playerId: string; side: "give" | "receive"; name: string; modelClass: string; startDate: string | null; endDate: string | null; scheduledGames: number }>;
  rows: Array<{ key: string; label: string; lowerIsBetter: boolean; give: SideValue; receive: SideValue;
    /** receive − give in raw units. */
    net: number | null; favorableForReceiver: boolean | null }>;
  summary: string;
};

const GOALIE_RATIOS: Record<string, { numerator: string; denominator: string; multiplier: number; label: string }> = {
  SAVE_PERCENTAGE: { numerator: "SAVES_GOALIE", denominator: "SHOTS_AGAINST_GOALIE", multiplier: 1, label: "SV%" },
  GOALS_AGAINST_AVERAGE: { numerator: "GOALS_AGAINST_GOALIE", denominator: "GOALIE_MINUTES", multiplier: 60, label: "GAA" },
};
const GOALIE_KEYS = new Set(["SAVES_GOALIE", "GOALS_AGAINST_GOALIE", "SHOTS_AGAINST_GOALIE", "GOALIE_MINUTES", "WINS_GOALIE", "SHUTOUTS_GOALIE", ...Object.keys(GOALIE_RATIOS)]);
const applies = (record: InterpretationRecord, key: string) => (record.identity.modelClass === "G") === GOALIE_KEYS.has(key);

function sumTarget(records: InterpretationRecord[], key: string): SideValue {
  const relevant = records.filter(record => applies(record, key));
  const missing = relevant.filter(record => record.forecastTotals[key]?.expected == null || record.forecastTotals[key]?.unit === null);
  if (missing.length) return { value: null, missingPlayerIds: missing.map(record => record.identity.playerId), reason: "missing_projection" };
  return { value: relevant.reduce((sum, record) => sum + record.forecastTotals[key].expected!, 0), missingPlayerIds: [], reason: null };
}

function sideValue(records: InterpretationRecord[], key: string, scoring: TradeScoring): SideValue {
  if (scoring.mode === "points") {
    const missing: string[] = [];
    let total = 0;
    for (const record of records) for (const [target, weight] of Object.entries(scoring.weights)) {
      if (!weight || !applies(record, target)) continue;
      const value = record.forecastTotals[target]?.expected;
      if (value == null) missing.push(record.identity.playerId); else total += weight * value;
    }
    return missing.length ? { value: null, missingPlayerIds: [...new Set(missing)], reason: "missing_projection" } : { value: total, missingPlayerIds: [], reason: null };
  }
  const ratio = GOALIE_RATIOS[key];
  if (!ratio) return sumTarget(records, key);
  const goalies = records.filter(record => record.identity.modelClass === "G");
  if (!goalies.length) return { value: null, missingPlayerIds: [], reason: "no_goalies" };
  const numerator = sumTarget(goalies, ratio.numerator), denominator = sumTarget(goalies, ratio.denominator);
  if (numerator.value === null || denominator.value === null) return { value: null, missingPlayerIds: [...new Set([...numerator.missingPlayerIds, ...denominator.missingPlayerIds])], reason: "incomplete_primitives" };
  if (denominator.value <= 0) return { value: null, missingPlayerIds: [], reason: "zero_denominator" };
  return { value: ratio.multiplier * numerator.value / denominator.value, missingPlayerIds: [], reason: null };
}

/** One player's raw expected league points over the horizon, for a market-reference comparison. */
export function playerPointsTotal(record: InterpretationRecord, scoring: Extract<TradeScoring, { mode: "points" }>) {
  if (!record.horizon.complete) return { value: null, missingPlayerIds: [record.identity.playerId], reason: record.horizon.reason ?? "incomplete_horizon" };
  if (record.freshness.forecastStatus === "expired") return { value: null, missingPlayerIds: [record.identity.playerId], reason: "expired_forecast" };
  return sideValue([record], "FANTASY_POINTS", scoring);
}

export function compareTrade(input: TradeInput, records: readonly InterpretationRecord[]): TradeComparison {
  const issues: TradeIssue[] = [];
  const byId = new Map(records.map(record => [record.identity.playerId, record]));
  if (!input.give.length) issues.push({ code: "empty_give", message: "Add at least one player you give.", blocking: true });
  if (!input.receive.length) issues.push({ code: "empty_receive", message: "Add at least one player you receive.", blocking: true });
  for (const [side, ids] of [["give", input.give], ["receive", input.receive]] as const) {
    if (new Set(ids).size !== ids.length) issues.push({ code: `duplicate_${side}`, message: `A player appears twice on the ${side} side.`, blocking: true });
  }
  const both = input.give.filter(id => input.receive.includes(id));
  if (both.length) issues.push({ code: "both_sides", message: `${both.join(", ")} appears on both sides.`, blocking: true });
  const unknown = [...input.give, ...input.receive].filter(id => !byId.has(id));
  if (unknown.length) issues.push({ code: "unknown_player", message: `No shared record for ${[...new Set(unknown)].join(", ")}; the comparison is incomplete.`, blocking: true });
  const give = [...new Set(input.give)].flatMap(id => byId.get(id) ?? []);
  const receive = [...new Set(input.receive)].flatMap(id => byId.get(id) ?? []);
  const all = [...give, ...receive];
  const horizons = new Set(all.map(record => record.horizon.requestedGames));
  if (horizons.size > 1) issues.push({ code: "mixed_horizons", message: "Players use different horizons; totals are not comparable.", blocking: true });
  const bases = new Set(all.map(record => `${record.identity.forecastVersion}|${record.identity.forecastManifestId}|${record.identity.forecastReadAsOf}`));
  if (bases.size > 1) issues.push({ code: "mixed_forecast_basis", message: "Players come from different forecast issuances.", blocking: true });
  const expired = all.filter(record => record.freshness.forecastStatus === "expired");
  if (expired.length) issues.push({ code: "expired_forecast", message: `Forecast expired for ${expired.map(record => record.identity.name).join(", ")}.`, blocking: true });
  const incomplete = all.filter(record => !record.horizon.complete);
  if (incomplete.length) issues.push({ code: "incomplete_horizon", message: `${incomplete.map(record => `${record.identity.name} has ${record.horizon.scheduledGames} of ${record.horizon.requestedGames} scheduled games`).join("; ")}.`, blocking: true });
  if (give.length && receive.length && give.length !== receive.length) {
    issues.push({ code: "uneven_roster", message: `Uneven sides (${give.length} for ${receive.length}); roster-slot and replacement effects are not included.`, blocking: false });
  }

  const keys = input.scoring.mode === "points" ? ["FANTASY_POINTS"] : input.scoring.categories;
  const rows = keys.map(key => {
    const g = sideValue(give, key, input.scoring), r = sideValue(receive, key, input.scoring);
    const lowerIsBetter = LOWER_IS_BETTER.has(key);
    const net = g.value !== null && r.value !== null ? r.value - g.value : null;
    return { key, label: key === "FANTASY_POINTS" ? "Fantasy points" : GOALIE_RATIOS[key]?.label ?? TARGET_LABELS[key as keyof typeof TARGET_LABELS] ?? key,
      lowerIsBetter, give: g, receive: r, net, favorableForReceiver: net === null || net === 0 ? null : lowerIsBetter ? net < 0 : net > 0 };
  });
  const missing = rows.some(row => [row.give, row.receive].some(side => side.value === null && side.reason !== "no_goalies"));
  if (missing) issues.push({ code: "missing_projection", message: "Some players lack a projection for a scored category; affected totals are withheld.", blocking: true });
  const complete = !issues.some(issue => issue.blocking);
  const horizonGames = horizons.size === 1 ? [...horizons][0] : null;
  const summary = !complete ? "Comparison incomplete: no result is shown until the issues above are resolved."
    : input.scoring.mode === "categories" ? `Category vectors over each player's next ${horizonGames} scheduled team games. No overall winner without a defined league utility.`
      : `Raw projected production over each player's next ${horizonGames} scheduled team games: the receive side is ${rows[0].net! >= 0 ? "ahead" : "behind"} by ${Math.abs(rows[0].net!).toFixed(2)} fantasy points. Offer scenario only; not roster-aware and not proof the other manager accepts.`;
  return {
    issues, complete, horizonGames,
    players: [...give.map(record => ["give", record] as const), ...receive.map(record => ["receive", record] as const)].map(([side, record]) => ({
      playerId: record.identity.playerId, side, name: record.identity.name, modelClass: record.identity.modelClass,
      startDate: record.horizon.startDate, endDate: record.horizon.endDate, scheduledGames: record.horizon.scheduledGames })),
    rows, summary,
  };
}
