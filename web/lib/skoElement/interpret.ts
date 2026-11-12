import {
  SKATER_TARGETS, SKO_CONTRACT_VERSION, TARGET_LABELS,
  type ForecastAdmission, type ForgeForecastInput, type GapDirection, type GapSign, type GoalieInterpretation, type GoalieResults,
  type HorizonGames, type InterpretationConfig, type InterpretationRecord, type Measured, type MetricInterpretation,
  type ObservedEvidence, type ObservedTeamGame, type OpportunityBlock, type OpportunityInterpretation, type SignedComparison,
  type SkaterTarget, type TargetAdmission,
} from "./contract";

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const ok = (value: number): Measured => ({ value, reason: null });
const na = (reason: string): Measured => ({ value: null, reason });
const validTime = (value: unknown): value is string => typeof value === "string" && Number.isFinite(Date.parse(value));
const DATE = /^\d{4}-\d{2}-\d{2}$/;
/** A real calendar date, not only the YYYY-MM-DD shape ("2026-99-99" is rejected). */
const realDate = (value: unknown): value is string => typeof value === "string" && DATE.test(value)
  && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const STATUSES = new Set(["appeared", "confirmed_absent", "unknown"]);
const EPSILON = 1e-9;
const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

function hasNegative(row: ObservedTeamGame) {
  const numbers = [row.toiMinutes, row.ppToiMinutes, row.onIceGoalsFor, ...Object.values(row.stats ?? {}),
    ...Object.values(row.goalie ?? {})];
  return numbers.some(value => finite(value) && value < 0) || numbers.some(value => typeof value === "number" && !Number.isFinite(value));
}

const unknownRow = (row: ObservedTeamGame): ObservedTeamGame =>
  ({ ...row, status: "unknown", stats: {}, toiMinutes: null, ppToiMinutes: null, onIceGoalsFor: null, goalie: undefined });

/**
 * Point-in-time, identity-complete team-game skeleton. A row with a valid game id and a real date is a placed team game:
 * if its data fails validation, has a malformed clock or was not yet available at as-of, the game stays as unknown so an
 * older game never backfills the window. A row that cannot be placed (no id, impossible date) makes membership incomplete.
 * Contradictory rows become unknown, never summed.
 */
export function normalizeTeamGames(evidence: ObservedEvidence, asOfMs: number) {
  let excludedFutureRows = 0, invalidRows = 0, duplicateRows = 0, unplacedRows = 0;
  const byId = new Map<string, ObservedTeamGame>();
  const pending = new Map<string, ObservedTeamGame>();
  const conflicts = new Set<string>();
  for (const inputRow of evidence.teamGames) {
    if (!inputRow || typeof inputRow.gameId !== "string" || !inputRow.gameId || !realDate(inputRow.date)) {
      invalidRows++; unplacedRows++; continue;
    }
    // Not yet played at as-of: outside the window by date, whatever its row says.
    if (Date.parse(`${inputRow.date}T00:00:00Z`) > asOfMs) { excludedFutureRows++; continue; }
    let row = inputRow;
    if (!validTime(row.availableAt) || !STATUSES.has(row.status)) { invalidRows++; row = unknownRow(row); }
    else if (Date.parse(row.availableAt) > asOfMs) {
      // Played, but this row was not available at as-of: keep the identity, never the data.
      excludedFutureRows++;
      if (!pending.has(row.gameId)) pending.set(row.gameId, unknownRow(row));
      continue;
    } else if (hasNegative(row)) {
      invalidRows++;
      row = unknownRow(row);
    }
    const previous = byId.get(row.gameId);
    if (!previous) { byId.set(row.gameId, row); continue; }
    const { availableAt: _a, ...left } = previous;
    const { availableAt: _b, ...right } = row;
    if (stable(left) === stable(right)) duplicateRows++;
    else conflicts.add(row.gameId);
  }
  for (const [gameId, row] of pending) if (!byId.has(gameId)) byId.set(gameId, row);
  const games = [...byId.values()].map((game): ObservedTeamGame => conflicts.has(game.gameId) ? unknownRow(game) : game)
    .sort((a, b) => a.date.localeCompare(b.date) || a.gameId.localeCompare(b.gameId));
  return { games, excludedFutureRows, invalidRows, duplicateRows, unplacedRows, conflictingGameIds: [...conflicts].sort() };
}

/** Why a whole window cannot be read: incomplete membership or an unknown participation status. */
const windowReason = (games: ObservedTeamGame[], membershipComplete: boolean) => !membershipComplete ? "window_membership_incomplete"
  : games.some(game => game.status === "unknown") ? "unknown_team_game_status" : null;

function opportunityBlock(games: ObservedTeamGame[], membershipComplete: boolean): OpportunityBlock {
  const appeared = games.filter(game => game.status === "appeared");
  const blocked = windowReason(games, membershipComplete);
  const perAppearance = (key: "toiMinutes" | "ppToiMinutes") => blocked ? na(blocked) : !appeared.length ? na("no_appearances")
    : appeared.every(game => finite(game[key])) ? ok(mean(appeared.map(game => game[key] as number))) : na("minutes_unknown");
  return {
    startDate: games[0]?.date ?? null, endDate: games.at(-1)?.date ?? null, teamGames: games.length,
    appearances: appeared.length, gameIds: games.map(game => game.gameId),
    toiPerAppearance: perAppearance("toiMinutes"), ppToiPerAppearance: perAppearance("ppToiMinutes"),
    toiPerTeamGame: blocked ? na(blocked) : !games.length ? na("no_completed_team_games")
      : appeared.every(game => finite(game.toiMinutes)) ? ok(appeared.reduce((sum, game) => sum + (game.toiMinutes as number), 0) / games.length)
        : na("minutes_unknown"),
    appearanceShare: blocked ? na(blocked) : !games.length ? na("no_completed_team_games") : ok(appeared.length / games.length),
  };
}

function perTeamGameValues(games: ObservedTeamGame[], target: SkaterTarget, membershipComplete: boolean): { values: number[] | null; reason: string | null } {
  if (!games.length) return { values: null, reason: "no_completed_team_games" };
  const blocked = windowReason(games, membershipComplete);
  if (blocked) return { values: null, reason: blocked };
  const values: number[] = [];
  for (const game of games) {
    if (game.status === "confirmed_absent") { values.push(0); continue; }
    const value = game.stats[target];
    if (!finite(value)) return { values: null, reason: "missing_stat" };
    values.push(value);
  }
  return { values, reason: null };
}

function sampleSd(values: number[]) {
  const average = mean(values);
  return Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1));
}

const parse = (value: string | null | undefined) => (validTime(value) ? Date.parse(value) : NaN);
const NO_FORECAST_ADMISSION: ForecastAdmission = { status: "no_forecast", reasons: ["no_forecast"], readAsOf: null,
  policy: "read_and_issued_at_or_before_as_of", targets: {} };

/**
 * Source admission (A1), mirroring the stricter checks in `tradeValue/valuationComponents.ts`: the issuance is read at or
 * before as-of; each target is admitted only with a finite reconciled total, full coverage of unique future games, an
 * unconditional basis, a source, totals and comparison permission on every game, and cutoff <= issued <= as-of < expiry.
 * Caller-supplied objects are not proof of upstream admission; this only refuses what is visibly inadmissible.
 */
export function admitForecast(forecast: ForgeForecastInput | undefined, horizon: number, asOfMs: number): ForecastAdmission {
  if (!forecast) return NO_FORECAST_ADMISSION;
  const readMs = parse(forecast.readAsOf);
  const forecastReasons = !Number.isFinite(readMs) ? ["read_as_of_invalid"] : readMs > asOfMs ? ["read_after_as_of"] : [];
  const { games, totals } = forecast.player;
  const horizonReasons: string[] = [];
  if (forecast.scope.mode !== "next_n" || forecast.scope.games !== horizon) horizonReasons.push("horizon_mismatch");
  if (!forecast.player.horizonComplete || games.length !== horizon) horizonReasons.push("incomplete_horizon");
  if (new Set(games.map(game => game.gameId)).size !== games.length) horizonReasons.push("duplicate_game_ids");
  if (games.some(game => !(parse(game.scheduledAt) > asOfMs))) horizonReasons.push("horizon_game_not_after_as_of");
  const targets = Object.fromEntries(Object.entries(totals).map(([target, total]): [string, TargetAdmission] => {
    const reasons = [...forecastReasons, ...horizonReasons];
    const views = games.map(game => game.targets[target]);
    if (total.expected === null) reasons.push(total.reason ?? "unavailable");
    else if (!finite(total.expected) || total.expected < 0) reasons.push("invalid_total");
    if (total.unit === null) reasons.push("incompatible_units");
    if (total.coveredGames !== total.requiredGames || total.requiredGames !== games.length) reasons.push("incomplete_target_coverage");
    if (views.some(view => !view)) reasons.push("target_missing_for_game");
    const present = views.filter(Boolean);
    if (present.some(view => !finite(view.expected) || view.expected < 0)) reasons.push("invalid_game_value");
    if (present.some(view => view.basis !== "unconditional_game")) reasons.push("basis_not_unconditional");
    if (present.some(view => view.unit !== total.unit)) reasons.push("incompatible_units");
    if (present.some(view => !view.allowedUses.totals)) reasons.push("totals_not_permitted");
    if (present.some(view => !view.allowedUses.comparison)) reasons.push("comparison_not_permitted");
    if (present.some(view => !view.sourceIds.length)) reasons.push("source_missing");
    const clocks = present.map(view => ({ cutoff: parse(view.cutoffAt), issued: parse(view.issuedAt), expires: parse(view.expiresAt) }));
    if (clocks.some(c => !Number.isFinite(c.cutoff) || !Number.isFinite(c.issued) || !Number.isFinite(c.expires))) reasons.push("target_clock_missing");
    const timed = clocks.filter(c => Number.isFinite(c.cutoff) && Number.isFinite(c.issued) && Number.isFinite(c.expires));
    if (timed.some(c => c.cutoff > c.issued)) reasons.push("cutoff_after_issue");
    if (timed.some(c => c.issued > asOfMs)) reasons.push("issued_after_as_of");
    if (timed.some(c => c.expires <= asOfMs)) reasons.push("expired");
    if (finite(total.expected) && present.length === games.length && present.every(view => finite(view.expected))) {
      const sum = present.reduce((acc, view) => acc + (view.expected as number), 0);
      if (Math.abs(total.expected - sum) > 1e-9 * Math.max(1, Math.abs(sum))) reasons.push("total_does_not_reconcile");
    }
    const iso = (values: number[], pick: "min" | "max") => values.length ? new Date(pick === "min" ? Math.min(...values) : Math.max(...values)).toISOString() : null;
    const unique = [...new Set(reasons)];
    return [target, {
      status: unique.length ? "withheld" : "admitted", reasons: unique, unit: total.unit,
      allowedUses: { totals: present.length === games.length && present.every(view => view.allowedUses.totals),
        comparison: present.length === games.length && present.every(view => view.allowedUses.comparison) },
      coveredGames: total.coveredGames, requiredGames: total.requiredGames, gameIds: games.map(game => game.gameId),
      cutoffAt: iso(timed.map(c => c.cutoff), "max"), issuedAt: iso(timed.map(c => c.issued), "max"), expiresAt: iso(timed.map(c => c.expires), "min"),
      sourceIds: [...new Set(present.flatMap(view => view.sourceIds))].sort(),
    }];
  }));
  return { status: forecastReasons.length ? "not_admitted" : "admitted", reasons: forecastReasons, readAsOf: forecast.readAsOf,
    policy: "read_and_issued_at_or_before_as_of", targets };
}

function expectedPerTeamGame(forecast: ForgeForecastInput | undefined, admission: ForecastAdmission, horizon: number, target: string, expired: boolean): Measured {
  if (!forecast) return na("no_forecast");
  if (admission.status === "not_admitted") return na(`forecast_${admission.reasons[0]}`);
  if (forecast.scope.mode !== "next_n" || forecast.scope.games !== horizon) return na("horizon_mismatch");
  const total = forecast.player.totals[target];
  if (!total) return na("target_not_supplied");
  if (total.unit !== "count") return na("incompatible_units");
  if (total.expected === null) return na(total.reason ?? "unavailable");
  if (total.requiredGames <= 0) return na("no_scheduled_opportunity");
  if (expired) return na("forecast_expired");
  const targetAdmission = admission.targets[target];
  if (targetAdmission?.status !== "admitted") return na(`target_${targetAdmission?.reasons[0] ?? "unavailable"}`);
  return ok(total.expected / total.requiredGames);
}

/** Earliest expiry over supplied targets; "unknown" when any supplied target lacks one, so a valid clock never masks a missing one. */
function forecastExpiry(forecast: ForgeForecastInput, asOfMs: number) {
  const supplied = forecast.player.games.flatMap(game => Object.values(game.targets).filter(target => target.expected !== null));
  const times = supplied.flatMap(target => validTime(target.expiresAt) ? [Date.parse(target.expiresAt)] : []);
  if (!times.length) return { expiresAt: null, status: "unknown" as const };
  const earliest = Math.min(...times);
  const status = earliest <= asOfMs ? "expired" as const : times.length < supplied.length ? "unknown" as const : "current" as const;
  return { expiresAt: new Date(earliest).toISOString(), status };
}

const gapSign = (gap: Measured): GapSign => gap.value === null ? "unavailable"
  : gap.value > EPSILON ? "positive" : gap.value < -EPSILON ? "negative" : "zero";
/** Deprecated alias for Codex consumers (see contract); never displayed as words by the Sko Element. */
const direction = (gap: Measured): GapDirection =>
  ({ positive: "rebound", negative: "cooling", zero: "level", unavailable: "unavailable" } as const)[gapSign(gap)];
const comparison = (measured: Measured, minuend: SignedComparison["minuend"], subtrahend: SignedComparison["subtrahend"]): SignedComparison =>
  ({ value: measured.value, reason: measured.reason, unit: "count_per_team_game", minuend, subtrahend });

function interpretOpportunity(recentGames: ObservedTeamGame[], priorGames: ObservedTeamGame[], evidence: ObservedEvidence,
  config: InterpretationConfig, asOfMs: number, membershipComplete: boolean): OpportunityInterpretation {
  const recent = opportunityBlock(recentGames, membershipComplete), prior = opportunityBlock(priorGames, membershipComplete);
  const change = (key: "toiPerAppearance" | "ppToiPerAppearance" | "toiPerTeamGame" | "appearanceShare") =>
    recent[key].value !== null && prior[key].value !== null ? ok(recent[key].value! - prior[key].value!)
      : na(recent[key].reason ? `recent_${recent[key].reason}` : `prior_${prior[key].reason ?? "unavailable"}`);
  const toi = change("toiPerAppearance"), pp = change("ppToiPerAppearance");
  const toiPerTeamGameChange = change("toiPerTeamGame"), share = change("appearanceShare");
  // Role evidence counts only once known by as-of (A3); a report effective earlier but known later is excluded.
  const known = (evidence.roleEvidence ?? []).filter(item => validTime(item.effectiveAt) && validTime(item.knownAt)
    && Date.parse(item.knownAt) <= asOfMs && Date.parse(item.effectiveAt) <= asOfMs);
  const roleEvidenceExcluded = (evidence.roleEvidence ?? []).length - known.length;
  const recentStartMs = recent.startDate ? Date.parse(`${recent.startDate}T00:00:00Z`) : NaN;
  const roleChanges = known.filter(item => Date.parse(item.effectiveAt) >= recentStartMs)
    .sort((a, b) => Date.parse(a.effectiveAt) - Date.parse(b.effectiveAt) || a.label.localeCompare(b.label));
  const rule = config.opportunityRule;
  const fmtMinutes = (value: number | null) => (value === null ? "unknown" : value.toFixed(1));
  let dir: OpportunityInterpretation["direction"];
  let label: string;
  if (toi.value === null || pp.value === null || share.value === null) {
    // Unknown PP or participation is unknown opportunity, never "steady" (D4).
    const reason = toi.reason ?? pp.reason ?? share.reason;
    dir = "unknown"; label = `Opportunity unknown: ${toi.value === null ? "" : pp.value === null ? "PP minutes " : "appearances "}${reason?.replace(/_/g, " ")}`;
  } else if (!rule) {
    dir = "unclassified"; label = "Opportunity change shown; no alert rule accepted";
  } else if (recent.appearances < rule.minAppearancesEachBlock || prior.appearances < rule.minAppearancesEachBlock) {
    dir = "unknown"; label = "Opportunity unknown: too few appearances to compare blocks";
  } else {
    const up = toi.value >= rule.minToiChangeMinutes || pp.value >= rule.minPpToiChangeMinutes;
    const down = toi.value <= -rule.minToiChangeMinutes || pp.value <= -rule.minPpToiChangeMinutes;
    const shareMoved = Math.abs(share.value) > EPSILON;
    const appearancesText = `appearances changed from ${prior.appearances} of ${prior.teamGames} to ${recent.appearances} of ${recent.teamGames} team games (minutes per team game ${fmtMinutes(prior.toiPerTeamGame.value)} to ${fmtMinutes(recent.toiPerTeamGame.value)})`;
    if (up && down) { dir = "unclassified"; label = "Opportunity mixed (total and PP minutes moved in opposite directions); durability uncertain"; }
    else if ((up && share.value < -EPSILON) || (down && share.value > EPSILON)) {
      dir = "unclassified"; label = `Opportunity mixed: minutes per appearance ${up ? "rose" : "fell"} while ${appearancesText}; durability uncertain`;
    }
    else if (up) { dir = "rising"; label = "Opportunity rising; durability uncertain"; }
    else if (down) { dir = "falling"; label = "Opportunity falling; durability uncertain"; }
    else if (shareMoved) { dir = "unclassified"; label = `Minutes per appearance unchanged beyond rule ${rule.ruleId}, but ${appearancesText}`; }
    else if (roleChanges.length) {
      dir = "unclassified";
      label = `Minutes per appearance unchanged beyond rule ${rule.ruleId}, but a role change was reported: ${roleChanges.map(item => `${item.label} (effective ${item.effectiveAt.slice(0, 10)})`).join("; ")}`;
    }
    else { dir = "steady"; label = `Total and PP minutes per appearance and appearance share unchanged beyond rule ${rule.ruleId}`; }
  }
  const ppRole = known.filter(item => item.kind === "pp_unit")
    .sort((a, b) => Date.parse(a.effectiveAt) - Date.parse(b.effectiveAt)).at(-1);
  return {
    recent, prior, toiChangeMinutes: toi, ppToiChangeMinutes: pp, toiPerTeamGameChange, appearanceShareChange: share, direction: dir, label,
    ruleId: rule?.ruleId ?? null, ruleStatus: rule?.status ?? "none",
    blockCoverage: { kind: "comparison_block_not_episode", teamGames: recent.teamGames, appearances: recent.appearances, startDate: recent.startDate, endDate: recent.endDate },
    powerPlayRole: ppRole
      ? { value: ppRole.label, status: "sourced", source: ppRole.source, effectiveAt: ppRole.effectiveAt, knownAt: ppRole.knownAt }
      : { value: null, status: "unavailable", source: null, effectiveAt: null, knownAt: null },
    roleChanges: roleChanges.map(item => ({ ...item })), roleEvidenceExcluded,
    scenarios: { status: "not_supplied", reason: "FORGE game expectations v1 supply no role-continuation, reversal or teammate-return scenarios." },
  };
}

function goalieResults(games: ObservedTeamGame[], membershipComplete: boolean): GoalieResults {
  const appeared = games.filter(game => game.status === "appeared");
  const invalid = appeared.some(({ goalie: g }) => g && (
    [g.saves, g.shotsAgainst, g.goalsAgainst].some(v => v != null && (!Number.isSafeInteger(v) || v < 0))
    || finite(g.saves) && finite(g.shotsAgainst) && g.saves > g.shotsAgainst
    || finite(g.goalsAgainst) && finite(g.shotsAgainst) && g.goalsAgainst > g.shotsAgainst
    || finite(g.saves) && finite(g.goalsAgainst) && finite(g.shotsAgainst) && g.saves + g.goalsAgainst !== g.shotsAgainst
    || g.minutes === 0 && ((g.shotsAgainst ?? 0) > 0 || (g.goalsAgainst ?? 0) > 0)));
  const reason = !membershipComplete ? "window_membership_incomplete" : games.some(g => g.status === "unknown") ? "unknown_team_game_status"
    : invalid ? "inconsistent_goalie_primitives" : !appeared.length ? "no_appearances" : null;
  const sum = (key: "saves" | "shotsAgainst" | "goalsAgainst" | "minutes") =>
    !reason && appeared.every(game => finite(game.goalie?.[key])) ? appeared.reduce((total, game) => total + game.goalie![key]!, 0) : null;
  const saves = sum("saves"), shotsAgainst = sum("shotsAgainst"), goalsAgainst = sum("goalsAgainst"), minutes = sum("minutes");
  const ratio = (numerator: number | null, denominator: number | null, multiplier: number) =>
    reason ? na(reason) : numerator === null || denominator === null ? na("incomplete_primitives")
      : denominator <= 0 ? na("zero_denominator") : ok(multiplier * numerator / denominator);
  const participationKnown = games.length > 0 && !games.some(g => g.status === "unknown")
    && appeared.every(g => g.goalie?.appearanceType === "start" || g.goalie?.appearanceType === "relief");
  const starts = participationKnown ? ok(appeared.filter(g => g.goalie?.appearanceType === "start").length) : na("start_relief_evidence_unavailable");
  return { appearances: appeared.length, saves, shotsAgainst, goalsAgainst, minutes,
    savePercentage: ratio(saves, shotsAgainst, 1), goalsAgainstAverage: ratio(goalsAgainst, minutes, 60), starts,
    reliefAppearances: starts.value === null ? na(starts.reason!) : ok(appeared.length - starts.value),
    startShare: starts.value === null ? na(starts.reason!) : ok(starts.value / games.length) };
}

function interpretGoalie(recentGames: ObservedTeamGame[], priorGames: ObservedTeamGame[], forecast: ForgeForecastInput | undefined,
  admission: ForecastAdmission, horizonOk: boolean, expired: boolean, membershipComplete: boolean): GoalieInterpretation {
  const gate = () => !forecast ? "no_forecast" : admission.status === "not_admitted" ? `forecast_${admission.reasons[0]}`
    : !horizonOk ? "horizon_mismatch" : expired ? "forecast_expired" : null;
  const expectedRatio = (key: string) => {
    const blocked = gate();
    if (blocked) return na(blocked);
    const value = forecast!.player.ratios[key];
    if (!value) return na("not_supplied");
    if (value.value === null) return na(value.reason ?? "unavailable");
    // A ratio of totals is admitted only when both of its totals are.
    const parts = [value.numerator, value.denominator].map(target => admission.targets[target]);
    if (parts.some(part => part?.status !== "admitted")) {
      return na(`target_${parts.find(part => part && part.status !== "admitted")?.reasons[0] ?? "not_supplied"}`);
    }
    return !finite(value.value) || value.value < 0 || key === "SAVE_PERCENTAGE" && value.value > 1 ? na("invalid_forecast_ratio") : ok(value.value);
  };
  const starts = forecast?.player.expectedStarts;
  return {
    observed: goalieResults(recentGames, membershipComplete), personalReference: goalieResults(priorGames, membershipComplete),
    expected: { savePercentage: expectedRatio("SAVE_PERCENTAGE"), goalsAgainstAverage: expectedRatio("GOALS_AGAINST_AVERAGE"),
      expectedStarts: gate() ? na(gate()!) : !finite(starts) ? na("start_participation_unavailable")
        : starts < 0 || starts > forecast!.player.games.length ? na("invalid_expected_starts") : ok(starts),
      interpretation: "ratio_of_expected_totals" },
    gap: { status: "pending_goalie_adapter", reason: "VuDu gaps await an accepted goalie adapter and goalie evidence; ratios are shown as context only." },
  };
}

const fmt = (value: number | null, digits = 2) => value === null ? "unavailable" : value.toFixed(digits);
const signed = (value: number) => `${value > 0 ? "+" : ""}${value.toFixed(2)}`;

export type InterpretInput = {
  evidence: ObservedEvidence;
  /**
   * The FORGE forecast. Omit it for an observation-only record: observed and personal-reference
   * values are produced, every expected value is withheld as `no_forecast`, and the horizon is
   * incomplete so consumers never treat the record as a forecast. Nothing is fabricated.
   */
  forecast?: ForgeForecastInput;
  /** An earlier FORGE issuance for the same player, used only for outlook change. */
  priorForecast?: ForgeForecastInput;
  config: InterpretationConfig;
  asOf: string;
  horizon: HorizonGames;
  fixture: boolean;
};

type IppResult = { observed: Measured; exposure: InterpretationRecord["ipp"]["exposure"] };

/** Pooled points ÷ pooled on-ice goals over complete, per-game-consistent appearances (A2): an impossible row is never hidden by pooling. */
function ippFor(games: ObservedTeamGame[], membershipComplete: boolean): IppResult {
  const appeared = games.filter(game => game.status === "appeared");
  const blocked = windowReason(games, membershipComplete);
  const unknownExposure = { appearances: appeared.length, points: null, onIceGoalsFor: null };
  if (blocked) return { observed: na(blocked), exposure: unknownExposure };
  if (!appeared.length) return { observed: na("no_appearances"), exposure: unknownExposure };
  if (!appeared.every(game => finite(game.stats.POINTS) && finite(game.onIceGoalsFor))) return { observed: na("missing_on_ice_goals"), exposure: unknownExposure };
  const consistent = appeared.every(game => {
    const points = game.stats.POINTS as number, goalsFor = game.onIceGoalsFor as number;
    return Number.isSafeInteger(points) && Number.isSafeInteger(goalsFor) && points >= 0 && points <= goalsFor;
  });
  if (!consistent) return { observed: na("inconsistent_counts"), exposure: unknownExposure };
  const points = appeared.reduce((sum, game) => sum + (game.stats.POINTS as number), 0);
  const goalsFor = appeared.reduce((sum, game) => sum + (game.onIceGoalsFor as number), 0);
  return { observed: goalsFor <= 0 ? na("zero_denominator") : ok(points / goalsFor), exposure: { appearances: appeared.length, points, onIceGoalsFor: goalsFor } };
}

/** Pure, deterministic interpretation. Never alters a supplied FORGE value. */
export function interpretPlayer(input: InterpretInput): InterpretationRecord {
  const { evidence, forecast, priorForecast, config, horizon } = input;
  if (!validTime(input.asOf)) throw new Error("Invalid asOf time.");
  if (forecast && forecast.player.playerId !== evidence.playerId) throw new Error("Evidence and forecast identify different players.");
  if (forecast && (evidence.modelClass === "G") !== (forecast.player.playerClass === "goalie")) throw new Error("Model class does not match forecast player class.");
  if (!forecast && !evidence.playerName?.trim()) throw new Error("Observation-only interpretation needs evidence.playerName.");
  if (priorForecast && priorForecast.player.playerId !== evidence.playerId) throw new Error("Prior forecast identifies a different player.");
  const asOfMs = Date.parse(input.asOf);
  const normalized = normalizeTeamGames(evidence, asOfMs);
  const membershipComplete = normalized.unplacedRows === 0;
  const k = config.recentWindowTeamGames;
  const recentGames = normalized.games.slice(-k);
  const priorGames = normalized.games.slice(-2 * k, -k);
  const appearances = recentGames.filter(game => game.status === "appeared").length;
  const unknownGames = recentGames.filter(game => game.status === "unknown").length;

  const cutoffMs = validTime(evidence.sourceCutoffAt) ? Date.parse(evidence.sourceCutoffAt) : NaN;
  const evidenceAgeHours = Number.isFinite(cutoffMs) && cutoffMs <= asOfMs ? (asOfMs - cutoffMs) / 3_600_000 : null;
  const evidenceStatus = evidenceAgeHours === null ? "invalid" as const : evidenceAgeHours > config.maxEvidenceAgeHours ? "stale" as const : "fresh" as const;
  const admission = admitForecast(forecast, horizon, asOfMs);
  const notAdmitted = admission.status === "not_admitted";
  const rawExpiry = forecast ? forecastExpiry(forecast, asOfMs) : { expiresAt: null, status: "unknown" as const };
  const expiry = notAdmitted ? { expiresAt: rawExpiry.expiresAt, status: "not_admitted" as const } : rawExpiry;
  const expired = expiry.status === "expired";
  const horizonOk = !!forecast && !notAdmitted && forecast.scope.mode === "next_n" && forecast.scope.games === horizon;
  const isGoalie = evidence.modelClass === "G";

  // The prior issuance is validated at its own read time: it must have been admissible then, not unexpired now.
  const priorReadMs = priorForecast ? parse(priorForecast.readAsOf) : NaN;
  const priorLevelReason = !priorForecast ? null : !Number.isFinite(priorReadMs) ? "prior_read_as_of_invalid"
    : !forecast || !(priorReadMs < parse(forecast.readAsOf)) ? "prior_not_earlier" : null;
  const priorAdmission = priorForecast && !priorLevelReason ? admitForecast(priorForecast, horizon, priorReadMs) : null;
  const sameIds = (a: string[], b: string[]) => a.length === b.length && a.every((id, index) => id === b[index]);
  const priorForecastAdmission: InterpretationRecord["priorForecastAdmission"] = !priorForecast ? null : {
    status: priorLevelReason || priorAdmission?.status !== "admitted" ? "not_admitted" : "admitted",
    reasons: priorLevelReason ? [priorLevelReason] : priorAdmission?.reasons ?? [],
    readAsOf: priorForecast.readAsOf,
    sameGameIds: forecast ? sameIds(priorForecast.player.games.map(game => game.gameId), forecast.player.games.map(game => game.gameId)) : null,
  };

  const metrics: MetricInterpretation[] = isGoalie ? [] : SKATER_TARGETS.map(target => {
    const teamGame = perTeamGameValues(recentGames, target, membershipComplete);
    const observedPerTeamGame = teamGame.values ? ok(mean(teamGame.values)) : na(teamGame.reason!);
    const perAppearance = (games: ObservedTeamGame[]) => {
      const blocked = windowReason(games, membershipComplete);
      const appeared = games.filter(game => game.status === "appeared");
      return blocked ? na(blocked) : !appeared.length ? na("no_appearances")
        : appeared.every(game => finite(game.stats[target])) ? ok(mean(appeared.map(game => game.stats[target] as number))) : na("missing_stat");
    };
    const observedPerAppearance = perAppearance(recentGames);
    const priorTeamGame = perTeamGameValues(priorGames, target, membershipComplete);
    const priorPerTeamGame = priorTeamGame.values ? ok(mean(priorTeamGame.values)) : na(priorTeamGame.reason!);
    const personalReference = { perTeamGame: priorPerTeamGame, perAppearance: perAppearance(priorGames),
      changePerTeamGame: observedPerTeamGame.value !== null && priorPerTeamGame.value !== null
        ? ok(observedPerTeamGame.value - priorPerTeamGame.value) : na(observedPerTeamGame.reason ?? priorPerTeamGame.reason ?? "unavailable") };
    const expected = expectedPerTeamGame(forecast, admission, horizon, target, expired);
    const targetAdmission = admission.targets[target];
    const conditional = !forecast ? na("no_forecast") : notAdmitted ? na(`forecast_${admission.reasons[0]}`) : expired ? na("forecast_expired")
      : !horizonOk ? na("horizon_mismatch") : targetAdmission && targetAdmission.status !== "admitted" ? na(`target_${targetAdmission.reasons[0]}`)
        : forecast.player.games.length && forecast.player.games.every(game => finite(game.targets[target]?.conditional))
          ? ok(mean(forecast.player.games.map(game => game.targets[target].conditional as number))) : na("conditional_not_permitted_or_missing");
    const gap = evidenceStatus !== "fresh" ? na(`${evidenceStatus}_evidence`)
      : expected.value === null ? na(`expected_${expected.reason}`)
        : observedPerTeamGame.value === null ? na(`observed_${observedPerTeamGame.reason}`)
          : ok(expected.value - observedPerTeamGame.value);
    let outlook: Measured = na(!forecast ? "no_forecast" : "no_prior_forecast");
    if (priorForecast && forecast) {
      const prior = priorAdmission ? expectedPerTeamGame(priorForecast, priorAdmission, horizon, target, false) : null;
      outlook = priorLevelReason ? na(priorLevelReason) : prior!.value === null ? na(`prior_${prior!.reason}`)
        : expected.value === null ? na(`expected_${expected.reason}`) : ok(expected.value - prior!.value);
    }
    return {
      target, label: TARGET_LABELS[target], unit: "count", observedPerTeamGame, observedPerAppearance, personalReference,
      expectedPerTeamGame: expected, expectedPerAppearanceConditional: conditional, gapPerTeamGame: gap,
      gapSign: gapSign(gap), direction: direction(gap),
      comparisons: {
        forecastVsRecent: comparison(gap, "forge_expected_per_scheduled_team_game", "recent_observed_per_team_game"),
        recentVsPersonalReference: comparison(personalReference.changePerTeamGame, "recent_observed_per_team_game", "preceding_disjoint_block_per_team_game"),
        observedVsSameWindowSupport: comparison(na("same_window_support_expectation_not_supplied"), "recent_observed_per_team_game", "same_window_support_expectation"),
      },
      outlookChangePerTeamGame: outlook,
      observedVariability: !teamGame.values ? na(teamGame.reason!) : teamGame.values.length < 2 ? na("fewer_than_two_team_games") : ok(sampleSd(teamGame.values)),
      sparse: appearances < config.minAppearancesForRate,
    };
  });

  const ipp: InterpretationRecord["ipp"] = (() => {
    const strength = "all_situations" as const;
    if (isGoalie) return { observed: na("not_applicable"), reference: na("not_applicable"), deviation: na("not_applicable"), referenceSource: null, strength,
      exposure: { appearances: 0, points: null, onIceGoalsFor: null }, referenceMeta: null, personalReference: na("not_applicable") };
    const { observed, exposure } = ippFor(recentGames, membershipComplete);
    const ref = config.ippReferences[evidence.modelClass as "F" | "D"];
    const windowStartMs = recentGames[0] ? Date.parse(`${recentGames[0].date}T00:00:00Z`) : NaN;
    // Decision 68: a point-in-time reference built before the judged window.
    const reference = !ref || !finite(ref.value) ? na("class_reference_missing") : !validTime(ref.cutoffAt) ? na("reference_cutoff_unknown")
      : !(Date.parse(ref.cutoffAt) < windowStartMs) ? na("reference_not_pre_window") : ok(ref.value);
    const deviation = observed.value !== null && reference.value !== null ? ok(observed.value - reference.value)
      : na(observed.reason ?? reference.reason ?? "unavailable");
    return { observed, reference, deviation, referenceSource: ref?.source ?? null, strength, exposure,
      referenceMeta: ref ? { version: ref.version, status: ref.status, cutoffAt: ref.cutoffAt, population: ref.population, sampleSize: ref.sampleSize } : null,
      personalReference: ippFor(priorGames, membershipComplete).observed };
  })();

  const opportunity = isGoalie ? null : interpretOpportunity(recentGames, priorGames, evidence, config, asOfMs, membershipComplete);
  const goalie = isGoalie ? interpretGoalie(recentGames, priorGames, forecast, admission, horizonOk, expired, membershipComplete) : null;
  const player = forecast?.player;
  const horizonReason = !forecast ? "no_forecast" : notAdmitted ? `forecast_${admission.reasons[0]}` : !horizonOk ? "horizon_mismatch"
    : !player!.horizonComplete ? "incomplete_horizon" : null;

  const explanations: InterpretationRecord["explanations"] = [];
  const points = metrics.find(metric => metric.target === "POINTS");
  if (points) {
    const facts = [`recent window ${recentGames[0]?.date ?? "?"} to ${recentGames.at(-1)?.date ?? "?"}`, `${recentGames.length} team games`, `${appearances} appearances`];
    explanations.push(points.gapPerTeamGame.value !== null ? {
      id: "points-gap", facts,
      text: `Recent ${fmt(points.observedPerTeamGame.value)} points per team game; FORGE expects ${fmt(points.expectedPerTeamGame.value)} per scheduled team game over the next ${horizon}. Forecast minus recent: ${signed(points.gapPerTeamGame.value)} points per team game. This signed difference is not an alert, a probability or a trade instruction, and it is separate from the comparison with this player's earlier block and from same-window support (not supplied).`,
    } : { id: "points-gap", facts, text: `Points gap unavailable (${points.gapPerTeamGame.reason?.replace(/_/g, " ")}). Observed and expected values are shown where available.` });
    if (opportunity?.direction === "steady" && points.gapSign === "negative") explanations.push({ id: "conversion-not-role", facts: [opportunity.label],
      text: "Total and PP minutes per appearance and appearance share did not change beyond the rule, and no role change was reported, so the recent excess over the forecast is not explained by those measured opportunity changes. It may reflect conversion or omitted context; it is not proven luck." });
    if (points.gapSign === "negative" && (points.outlookChangePerTeamGame.value ?? 0) > EPSILON) explanations.push({ id: "forecast-below-recent-with-upgrade", facts: [`outlook ${signed(points.outlookChangePerTeamGame.value!)}`],
      text: "FORGE expects less than the recent rate while its outlook is higher than the prior issuance; these are separate comparisons." });
  }
  if (opportunity && opportunity.toiChangeMinutes.value !== null) explanations.push({ id: "opportunity", facts: [`prior ${opportunity.prior.startDate} to ${opportunity.prior.endDate}`, `${opportunity.prior.appearances} prior appearances`],
    text: `${opportunity.label}. Total TOI ${signed(opportunity.toiChangeMinutes.value)} min per appearance${opportunity.ppToiChangeMinutes.value !== null ? `, PP TOI ${signed(opportunity.ppToiChangeMinutes.value)} min` : ""} versus the prior block. Recent block: ${opportunity.blockCoverage.teamGames} team games, ${opportunity.blockCoverage.appearances} appearances; this is block coverage, not how long the change has lasted or will last.` });
  if (ipp.deviation.value !== null) explanations.push({ id: "ipp", facts: [`reference ${ipp.referenceSource}`, `reference version ${ipp.referenceMeta?.version}`],
    text: `IPP ${fmt(ipp.observed.value, 3)} (${ipp.exposure.points} points on ${ipp.exposure.onIceGoalsFor} on-ice goals over ${ipp.exposure.appearances} appearances) versus the ${evidence.modelClass === "F" ? "forward" : "defense"} reference ${fmt(ipp.reference.value, 3)} (${signed(ipp.deviation.value)}), all situations. IPP overlaps with points; it is not an independent vote.` });

  const refusedTargets = Object.entries(admission.targets).filter(([key, item]) => item.status === "withheld" && finite(player?.totals[key]?.expected));
  const limitations = [...new Set([
    "The personal comparison uses the preceding disjoint block, not a career or prior-season estimate. Short history and role or team changes can make it unrepresentative.",
    "Expected values are FORGE game expectations passed through unchanged when admitted; no SKO score or weights are applied.",
    "The signed gap (forecast minus recent, per team game) is descriptive. It is not an alert, a buy/sell instruction, a probability or a quality rating; its uncertainty would need Var(F) + Var(R) − 2Cov(F, R), which is not supplied.",
    "Predictive spread and mean uncertainty are not supplied by FORGE game expectations v1.",
    "Scheduled team games are not guaranteed appearances or starts.",
    ...(config.status !== "accepted" ? [`Interpretation config ${config.configId} is provisional; windows, sparse-sample and opportunity rules are illustrative.`] : []),
    ...(evidence.retrospective ? ["Evidence availability times are retrospective reconstructions, not authentic as-of records."] : []),
    ...(!membershipComplete ? [`${normalized.unplacedRows} source row(s) could not be placed in the team-game sequence (missing game id or impossible date); window membership is incomplete and window rates are withheld.`] : []),
    ...(unknownGames ? [`${unknownGames} recent team game(s) have unknown participation; per-team-game and per-appearance rates, IPP and opportunity are withheld.`] : []),
    ...(normalized.conflictingGameIds.length ? [`Conflicting source rows for ${normalized.conflictingGameIds.join(", ")} were excluded, not summed.`] : []),
    ...(evidenceStatus === "stale" ? ["Observed evidence is stale; gaps are withheld."] : []),
    ...(notAdmitted ? [`FORGE forecast not admitted (${admission.reasons.join(", ").replace(/_/g, " ")}): every expected value and gap is withheld.`] : []),
    ...(!notAdmitted && refusedTargets.length ? [`Forecast targets withheld from comparisons: ${refusedTargets.map(([key, item]) => `${key} (${item.reasons.join(", ").replace(/_/g, " ")})`).join("; ")}.`] : []),
    ...(forecast ? forecast.limitations : ["No FORGE forecast was supplied: observed results only; every expected value and gap is withheld."]),
  ])];

  return {
    contractVersion: SKO_CONTRACT_VERSION,
    config: { configId: config.configId, version: config.version, status: config.status },
    fixture: input.fixture,
    asOf: input.asOf,
    identity: {
      playerId: evidence.playerId, name: player?.name ?? evidence.playerName!.trim(),
      team: player ? player.team : normalized.games.at(-1)?.team ?? null,
      modelClass: evidence.modelClass, eligibility: [...evidence.eligibility],
      evidenceSnapshotId: evidence.evidenceSnapshotId, forecastVersion: forecast?.version ?? null, forecastManifestId: forecast?.manifestId ?? null,
      forecastReadAsOf: forecast?.readAsOf ?? null, baselineChecksum: forecast?.baselineChecksum ?? null,
    },
    horizon: {
      requestedGames: horizon, scheduledGames: player?.scheduledOpportunities ?? 0, complete: !!player && horizonOk && player.horizonComplete,
      gameIds: player?.games.map(game => game.gameId) ?? [], startDate: player?.games[0]?.date ?? null, endDate: player?.games.at(-1)?.date ?? null,
      expectedAppearances: player?.expectedAppearances ?? null, expectedStarts: player?.expectedStarts ?? null, reason: horizonReason,
    },
    recentWindow: {
      requestedTeamGames: k, teamGames: recentGames.length, appearances, unknownGames,
      confirmedAbsences: recentGames.filter(game => game.status === "confirmed_absent").length,
      startDate: recentGames[0]?.date ?? null, endDate: recentGames.at(-1)?.date ?? null,
      rule: `last ${k} completed team games at as-of; a game whose row was invalid or not yet available stays unknown`,
      gameIds: recentGames.map(game => game.gameId), membership: membershipComplete ? "complete" : "incomplete", unplacedRows: normalized.unplacedRows,
    },
    personalReferenceWindow: { teamGames: priorGames.length, appearances: priorGames.filter(g => g.status === "appeared").length,
      unknownGames: priorGames.filter(g => g.status === "unknown").length, gameIds: priorGames.map(game => game.gameId), startDate: priorGames[0]?.date ?? null,
      endDate: priorGames.at(-1)?.date ?? null, method: "preceding_disjoint_team_game_block" },
    forecastTotals: Object.fromEntries(Object.entries(player?.totals ?? {}).map(([key, total]) => {
      const item = admission.targets[key];
      return [key, !notAdmitted && item?.status === "admitted" ? { expected: total.expected, unit: total.unit, reason: total.reason }
        : { expected: null, unit: total.unit, reason: notAdmitted ? `forecast_${admission.reasons[0]}` : total.expected === null ? total.reason ?? item?.reasons[0] ?? "unavailable" : item?.reasons[0] ?? "unavailable" }];
    })),
    forecastAdmission: admission, priorForecastAdmission,
    metrics, ipp, opportunity, goalie,
    uncertainty: { predictiveSpread: na("not_supplied_by_forge_v1"), meanUncertainty: na("not_supplied_by_forge_v1") },
    freshness: { evidenceCutoffAt: evidence.sourceCutoffAt, evidenceAgeHours, evidenceStatus,
      forecastExpiresAt: expiry.expiresAt, forecastStatus: expiry.status },
    diagnostics: { excludedFutureRows: normalized.excludedFutureRows, invalidRows: normalized.invalidRows,
      duplicateRows: normalized.duplicateRows, conflictingGameIds: normalized.conflictingGameIds, retrospective: evidence.retrospective,
      unplacedRows: normalized.unplacedRows },
    explanations, limitations,
  };
}

/** League points view: explicit weights over compatible per-team-game category means (FR-17). */
export function weightedPointsGap(record: InterpretationRecord, weights: Partial<Record<SkaterTarget, number>>) {
  const used = Object.entries(weights).filter(([, weight]) => finite(weight) && weight !== 0) as Array<[SkaterTarget, number]>;
  const combine = (key: "observedPerTeamGame" | "expectedPerTeamGame"): Measured => {
    if (record.identity.modelClass === "G") return na("not_applicable");
    if (!used.length) return na("no_weights");
    let total = 0;
    for (const [target, weight] of used) {
      const value = record.metrics.find(metric => metric.target === target)?.[key];
      if (!value || value.value === null) return na(`${target}_${value?.reason ?? "missing"}`);
      total += weight * value.value;
    }
    return ok(total);
  };
  const observed = combine("observedPerTeamGame"), expected = combine("expectedPerTeamGame");
  const gap = record.freshness.evidenceStatus !== "fresh" ? na(`${record.freshness.evidenceStatus}_evidence`)
    : observed.value !== null && expected.value !== null ? ok(expected.value - observed.value) : na(expected.reason ?? observed.reason ?? "unavailable");
  return { observed, expected, gap, gapSign: gapSign(gap), direction: direction(gap) };
}
