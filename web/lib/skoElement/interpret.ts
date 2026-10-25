import {
  SKATER_TARGETS, SKO_CONTRACT_VERSION, TARGET_LABELS,
  type ForgeForecastInput, type GapDirection, type GoalieInterpretation, type HorizonGames, type InterpretationConfig,
  type InterpretationRecord, type Measured, type MetricInterpretation, type ObservedEvidence, type ObservedTeamGame,
  type OpportunityBlock, type OpportunityInterpretation, type SkaterTarget,
} from "./contract";

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const ok = (value: number): Measured => ({ value, reason: null });
const na = (reason: string): Measured => ({ value: null, reason });
const validTime = (value: unknown): value is string => typeof value === "string" && Number.isFinite(Date.parse(value));
const DATE = /^\d{4}-\d{2}-\d{2}$/;
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

/** Point-in-time filter, validation and identity deduplication. Contradictory rows become unknown, never summed. */
export function normalizeTeamGames(evidence: ObservedEvidence, asOfMs: number) {
  let excludedFutureRows = 0, invalidRows = 0, duplicateRows = 0;
  const byId = new Map<string, ObservedTeamGame>();
  const conflicts = new Set<string>();
  for (const row of evidence.teamGames) {
    if (!row?.gameId || !DATE.test(row.date) || !validTime(row.availableAt) || !STATUSES.has(row.status) || hasNegative(row)) {
      invalidRows++; continue;
    }
    if (Date.parse(row.availableAt) > asOfMs || Date.parse(`${row.date}T00:00:00Z`) > asOfMs) { excludedFutureRows++; continue; }
    const previous = byId.get(row.gameId);
    if (!previous) { byId.set(row.gameId, row); continue; }
    const { availableAt: _a, ...left } = previous;
    const { availableAt: _b, ...right } = row;
    if (stable(left) === stable(right)) duplicateRows++;
    else conflicts.add(row.gameId);
  }
  const games = [...byId.values()].map((game): ObservedTeamGame => conflicts.has(game.gameId)
    ? { ...game, status: "unknown", stats: {}, toiMinutes: null, ppToiMinutes: null, onIceGoalsFor: null, goalie: undefined }
    : game).sort((a, b) => a.date.localeCompare(b.date) || a.gameId.localeCompare(b.gameId));
  return { games, excludedFutureRows, invalidRows, duplicateRows, conflictingGameIds: [...conflicts].sort() };
}

function opportunityBlock(games: ObservedTeamGame[]): OpportunityBlock {
  const appeared = games.filter(game => game.status === "appeared");
  const perAppearance = (key: "toiMinutes" | "ppToiMinutes") => !appeared.length ? na("no_appearances")
    : appeared.every(game => finite(game[key])) ? ok(mean(appeared.map(game => game[key] as number))) : na("minutes_unknown");
  return {
    startDate: games[0]?.date ?? null, endDate: games.at(-1)?.date ?? null, teamGames: games.length,
    appearances: appeared.length, toiPerAppearance: perAppearance("toiMinutes"), ppToiPerAppearance: perAppearance("ppToiMinutes"),
  };
}

function perTeamGameValues(games: ObservedTeamGame[], target: SkaterTarget): { values: number[] | null; reason: string | null } {
  if (!games.length) return { values: null, reason: "no_completed_team_games" };
  if (games.some(game => game.status === "unknown")) return { values: null, reason: "unknown_team_game_status" };
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

function expectedPerTeamGame(forecast: ForgeForecastInput | undefined, horizon: number, target: string, expired: boolean): Measured {
  if (!forecast) return na("no_forecast");
  if (forecast.scope.mode !== "next_n" || forecast.scope.games !== horizon) return na("horizon_mismatch");
  const total = forecast.player.totals[target];
  if (!total) return na("target_not_supplied");
  if (total.unit !== "count") return na("incompatible_units");
  if (total.expected === null) return na(total.reason ?? "unavailable");
  if (total.requiredGames <= 0) return na("no_scheduled_opportunity");
  if (expired) return na("forecast_expired");
  return ok(total.expected / total.requiredGames);
}

function forecastExpiry(forecast: ForgeForecastInput, asOfMs: number) {
  const times = forecast.player.games.flatMap(game => Object.values(game.targets)
    .flatMap(target => target.expected !== null && validTime(target.expiresAt) ? [Date.parse(target.expiresAt)] : []));
  if (!times.length) return { expiresAt: null, status: "unknown" as const };
  const earliest = Math.min(...times);
  return { expiresAt: new Date(earliest).toISOString(), status: earliest <= asOfMs ? "expired" as const : "current" as const };
}

const direction = (gap: Measured): GapDirection => gap.value === null ? "unavailable"
  : gap.value > EPSILON ? "rebound" : gap.value < -EPSILON ? "cooling" : "level";

function interpretOpportunity(recentGames: ObservedTeamGame[], priorGames: ObservedTeamGame[], evidence: ObservedEvidence,
  config: InterpretationConfig, asOfMs: number): OpportunityInterpretation {
  const recent = opportunityBlock(recentGames), prior = opportunityBlock(priorGames);
  const change = (key: "toiPerAppearance" | "ppToiPerAppearance") =>
    recent[key].value !== null && prior[key].value !== null ? ok(recent[key].value! - prior[key].value!)
      : na(recent[key].reason ? `recent_${recent[key].reason}` : `prior_${prior[key].reason ?? "unavailable"}`);
  const toi = change("toiPerAppearance"), pp = change("ppToiPerAppearance");
  const rule = config.opportunityRule;
  let dir: OpportunityInterpretation["direction"];
  let label: string;
  if (toi.value === null) {
    dir = "unknown"; label = `Opportunity unknown: ${toi.reason?.replace(/_/g, " ")}`;
  } else if (!rule) {
    dir = "unclassified"; label = "Opportunity change shown; no alert rule accepted";
  } else if (recent.appearances < rule.minAppearancesEachBlock || prior.appearances < rule.minAppearancesEachBlock) {
    dir = "unknown"; label = "Opportunity unknown: too few appearances to compare blocks";
  } else {
    const up = toi.value >= rule.minToiChangeMinutes || (pp.value !== null && pp.value >= rule.minPpToiChangeMinutes);
    const down = toi.value <= -rule.minToiChangeMinutes || (pp.value !== null && pp.value <= -rule.minPpToiChangeMinutes);
    if (up && down) { dir = "unclassified"; label = "Opportunity mixed (total and PP minutes moved in opposite directions); durability uncertain"; }
    else if (up) { dir = "rising"; label = "Opportunity rising; durability uncertain"; }
    else if (down) { dir = "falling"; label = "Opportunity falling; durability uncertain"; }
    else { dir = "steady"; label = `No opportunity change beyond rule ${rule.ruleId}`; }
  }
  const ppRole = (evidence.roleEvidence ?? [])
    .filter(item => item.kind === "pp_unit" && validTime(item.effectiveAt) && Date.parse(item.effectiveAt) <= asOfMs)
    .sort((a, b) => Date.parse(a.effectiveAt) - Date.parse(b.effectiveAt)).at(-1);
  return {
    recent, prior, toiChangeMinutes: toi, ppToiChangeMinutes: pp, direction: dir, label,
    ruleId: rule?.ruleId ?? null, ruleStatus: rule?.status ?? "none",
    observedDuration: { appearances: recent.appearances, startDate: recent.startDate, endDate: recent.endDate },
    powerPlayRole: ppRole
      ? { value: ppRole.label, status: "sourced", source: ppRole.source, effectiveAt: ppRole.effectiveAt }
      : { value: null, status: "unavailable", source: null, effectiveAt: null },
    scenarios: { status: "not_supplied", reason: "FORGE game expectations v1 supply no role-continuation, reversal or teammate-return scenarios." },
  };
}

function interpretGoalie(recentGames: ObservedTeamGame[], forecast: ForgeForecastInput, horizonOk: boolean): GoalieInterpretation {
  const appeared = recentGames.filter(game => game.status === "appeared");
  const sum = (key: "saves" | "shotsAgainst" | "goalsAgainst" | "minutes") =>
    appeared.length && appeared.every(game => finite(game.goalie?.[key])) ? appeared.reduce((total, game) => total + game.goalie![key]!, 0) : null;
  const saves = sum("saves"), shotsAgainst = sum("shotsAgainst"), goalsAgainst = sum("goalsAgainst"), minutes = sum("minutes");
  const ratio = (numerator: number | null, denominator: number | null, multiplier: number) =>
    !appeared.length ? na("no_appearances") : numerator === null || denominator === null ? na("incomplete_primitives")
      : denominator <= 0 ? na("zero_denominator") : ok(multiplier * numerator / denominator);
  const expectedRatio = (key: string) => {
    if (!horizonOk) return na("horizon_mismatch");
    const value = forecast.player.ratios[key];
    return !value ? na("not_supplied") : value.value === null ? na(value.reason ?? "unavailable") : ok(value.value);
  };
  return {
    observed: { appearances: appeared.length, saves, shotsAgainst, goalsAgainst, minutes,
      savePercentage: ratio(saves, shotsAgainst, 1), goalsAgainstAverage: ratio(goalsAgainst, minutes, 60) },
    expected: { savePercentage: expectedRatio("SAVE_PERCENTAGE"), goalsAgainstAverage: expectedRatio("GOALS_AGAINST_AVERAGE"),
      expectedStarts: !horizonOk ? na("horizon_mismatch") : finite(forecast.player.expectedStarts) ? ok(forecast.player.expectedStarts) : na("start_participation_unavailable"),
      interpretation: "ratio_of_expected_totals" },
    gap: { status: "pending_goalie_adapter", reason: "VuDu gaps await an accepted goalie adapter and goalie evidence; ratios are shown as context only." },
  };
}

const fmt = (value: number | null, digits = 2) => value === null ? "unavailable" : value.toFixed(digits);
const signed = (value: number) => `${value > 0 ? "+" : ""}${value.toFixed(2)}`;

export type InterpretInput = {
  evidence: ObservedEvidence;
  forecast: ForgeForecastInput;
  /** An earlier FORGE issuance for the same player, used only for outlook change. */
  priorForecast?: ForgeForecastInput;
  config: InterpretationConfig;
  asOf: string;
  horizon: HorizonGames;
  fixture: boolean;
};

/** Pure, deterministic interpretation. Never alters a supplied FORGE value. */
export function interpretPlayer(input: InterpretInput): InterpretationRecord {
  const { evidence, forecast, priorForecast, config, horizon } = input;
  if (!validTime(input.asOf)) throw new Error("Invalid asOf time.");
  if (forecast.player.playerId !== evidence.playerId) throw new Error("Evidence and forecast identify different players.");
  if ((evidence.modelClass === "G") !== (forecast.player.playerClass === "goalie")) throw new Error("Model class does not match forecast player class.");
  if (priorForecast && priorForecast.player.playerId !== evidence.playerId) throw new Error("Prior forecast identifies a different player.");
  const asOfMs = Date.parse(input.asOf);
  const normalized = normalizeTeamGames(evidence, asOfMs);
  const k = config.recentWindowTeamGames;
  const recentGames = normalized.games.slice(-k);
  const priorGames = normalized.games.slice(-2 * k, -k);
  const appearances = recentGames.filter(game => game.status === "appeared").length;
  const unknownGames = recentGames.filter(game => game.status === "unknown").length;

  const cutoffMs = validTime(evidence.sourceCutoffAt) ? Date.parse(evidence.sourceCutoffAt) : NaN;
  const evidenceAgeHours = Number.isFinite(cutoffMs) && cutoffMs <= asOfMs ? (asOfMs - cutoffMs) / 3_600_000 : null;
  const evidenceStatus = evidenceAgeHours === null ? "invalid" as const : evidenceAgeHours > config.maxEvidenceAgeHours ? "stale" as const : "fresh" as const;
  const expiry = forecastExpiry(forecast, asOfMs);
  const horizonOk = forecast.scope.mode === "next_n" && forecast.scope.games === horizon;
  const isGoalie = evidence.modelClass === "G";

  const metrics: MetricInterpretation[] = isGoalie ? [] : SKATER_TARGETS.map(target => {
    const teamGame = perTeamGameValues(recentGames, target);
    const observedPerTeamGame = teamGame.values ? ok(mean(teamGame.values)) : na(teamGame.reason!);
    const appeared = recentGames.filter(game => game.status === "appeared");
    const observedPerAppearance = !appeared.length ? na("no_appearances")
      : appeared.every(game => finite(game.stats[target])) ? ok(mean(appeared.map(game => game.stats[target] as number))) : na("missing_stat");
    const expected = expectedPerTeamGame(forecast, horizon, target, expiry.status === "expired");
    const conditional = horizonOk && forecast.player.games.length
      && forecast.player.games.every(game => finite(game.targets[target]?.conditional))
      ? ok(mean(forecast.player.games.map(game => game.targets[target].conditional as number))) : na(horizonOk ? "conditional_not_permitted_or_missing" : "horizon_mismatch");
    const gap = evidenceStatus !== "fresh" ? na(`${evidenceStatus}_evidence`)
      : expected.value === null ? na(`expected_${expected.reason}`)
        : observedPerTeamGame.value === null ? na(`observed_${observedPerTeamGame.reason}`)
          : ok(expected.value - observedPerTeamGame.value);
    let outlook: Measured = na("no_prior_forecast");
    if (priorForecast) {
      const prior = expectedPerTeamGame(priorForecast, horizon, target, false);
      outlook = Date.parse(priorForecast.readAsOf) >= Date.parse(forecast.readAsOf) ? na("prior_not_earlier")
        : prior.value === null ? na(`prior_${prior.reason}`) : expected.value === null ? na(`expected_${expected.reason}`)
          : ok(expected.value - prior.value);
    }
    return {
      target, label: TARGET_LABELS[target], unit: "count", observedPerTeamGame, observedPerAppearance,
      expectedPerTeamGame: expected, expectedPerAppearanceConditional: conditional, gapPerTeamGame: gap, direction: direction(gap),
      outlookChangePerTeamGame: outlook,
      observedVariability: !teamGame.values ? na(teamGame.reason!) : teamGame.values.length < 2 ? na("fewer_than_two_team_games") : ok(sampleSd(teamGame.values)),
      sparse: appearances < config.minAppearancesForRate,
    };
  });

  const ipp = (() => {
    const strength = "all_situations" as const;
    if (isGoalie) return { observed: na("not_applicable"), reference: na("not_applicable"), deviation: na("not_applicable"), referenceSource: null, strength };
    const appeared = recentGames.filter(game => game.status === "appeared");
    let observed: Measured;
    if (!appeared.length) observed = na("no_appearances");
    else if (!appeared.every(game => finite(game.stats.POINTS) && finite(game.onIceGoalsFor))) observed = na("missing_on_ice_goals");
    else {
      const points = appeared.reduce((sum, game) => sum + (game.stats.POINTS as number), 0);
      const goalsFor = appeared.reduce((sum, game) => sum + (game.onIceGoalsFor as number), 0);
      observed = goalsFor <= 0 ? na("zero_denominator") : points > goalsFor ? na("inconsistent_counts") : ok(points / goalsFor);
    }
    const ref = config.ippReferences[evidence.modelClass as "F" | "D"];
    const reference = ref && finite(ref.value) ? ok(ref.value) : na("class_reference_missing");
    const deviation = observed.value !== null && reference.value !== null ? ok(observed.value - reference.value)
      : na(observed.reason ?? reference.reason ?? "unavailable");
    return { observed, reference, deviation, referenceSource: ref?.source ?? null, strength };
  })();

  const opportunity = isGoalie ? null : interpretOpportunity(recentGames, priorGames, evidence, config, asOfMs);
  const goalie = isGoalie ? interpretGoalie(recentGames, forecast, horizonOk) : null;
  const player = forecast.player;
  const horizonReason = !horizonOk ? "horizon_mismatch" : !player.horizonComplete ? "incomplete_horizon" : null;

  const explanations: InterpretationRecord["explanations"] = [];
  const points = metrics.find(metric => metric.target === "POINTS");
  if (points) {
    const facts = [`recent window ${recentGames[0]?.date ?? "?"} to ${recentGames.at(-1)?.date ?? "?"}`, `${recentGames.length} team games`, `${appearances} appearances`];
    explanations.push(points.gapPerTeamGame.value !== null ? {
      id: "points-gap", facts,
      text: `Recent ${fmt(points.observedPerTeamGame.value)} points per team game; FORGE expects ${fmt(points.expectedPerTeamGame.value)} per scheduled team game over the next ${horizon}. Gap ${signed(points.gapPerTeamGame.value)} (${points.direction === "rebound" ? "Rebound watch: more expected than recently produced" : points.direction === "cooling" ? "Cooling watch: less expected than recently produced" : "level"}). This is descriptive, not a probability or trade instruction.`,
    } : { id: "points-gap", facts, text: `Points gap unavailable (${points.gapPerTeamGame.reason?.replace(/_/g, " ")}). Observed and expected values are shown where available.` });
    if (opportunity?.direction === "steady" && points.direction === "cooling") explanations.push({ id: "conversion-not-role", facts: [opportunity.label],
      text: "Measured minutes did not change beyond the rule, so the recent excess is not explained by an opportunity change. It may reflect conversion or omitted context; it is not proven luck." });
    if (points.direction === "cooling" && (points.outlookChangePerTeamGame.value ?? 0) > EPSILON) explanations.push({ id: "cooling-with-upgrade", facts: [`outlook ${signed(points.outlookChangePerTeamGame.value!)}`],
      text: "Expected cooling from the recent run coexists with a higher FORGE outlook than the prior issuance." });
  }
  if (opportunity && opportunity.toiChangeMinutes.value !== null) explanations.push({ id: "opportunity", facts: [`prior ${opportunity.prior.startDate} to ${opportunity.prior.endDate}`, `${opportunity.prior.appearances} prior appearances`],
    text: `${opportunity.label}. Total TOI ${signed(opportunity.toiChangeMinutes.value)} min per appearance${opportunity.ppToiChangeMinutes.value !== null ? `, PP TOI ${signed(opportunity.ppToiChangeMinutes.value)} min` : ""} versus the prior block. Observed over ${opportunity.observedDuration.appearances} appearances; this does not predict how long it lasts.` });
  if (ipp.deviation.value !== null) explanations.push({ id: "ipp", facts: [`reference ${ipp.referenceSource}`],
    text: `IPP ${fmt(ipp.observed.value, 3)} versus the ${evidence.modelClass === "F" ? "forward" : "defense"} reference ${fmt(ipp.reference.value, 3)} (${signed(ipp.deviation.value)}), all situations. IPP overlaps with points; it is not an independent vote.` });

  const limitations = [...new Set([
    "Expected values are FORGE game expectations passed through unchanged; no SKO score or weights are applied.",
    "Gap direction is descriptive. It is not a buy/sell instruction, a probability or a quality rating; a level gap does not mean low volatility.",
    "Predictive spread and mean uncertainty are not supplied by FORGE game expectations v1.",
    "Scheduled team games are not guaranteed appearances or starts.",
    ...(config.status !== "accepted" ? [`Interpretation config ${config.configId} is provisional; windows, sparse-sample and opportunity rules are illustrative.`] : []),
    ...(evidence.retrospective ? ["Evidence availability times are retrospective reconstructions, not authentic as-of records."] : []),
    ...(unknownGames ? [`${unknownGames} recent team game(s) have unknown participation; per-team-game rates are withheld.`] : []),
    ...(normalized.conflictingGameIds.length ? [`Conflicting source rows for ${normalized.conflictingGameIds.join(", ")} were excluded, not summed.`] : []),
    ...(evidenceStatus === "stale" ? ["Observed evidence is stale; gaps are withheld."] : []),
    ...forecast.limitations,
  ])];

  return {
    contractVersion: SKO_CONTRACT_VERSION,
    config: { configId: config.configId, version: config.version, status: config.status },
    fixture: input.fixture,
    asOf: input.asOf,
    identity: {
      playerId: player.playerId, name: player.name, team: player.team, modelClass: evidence.modelClass, eligibility: [...evidence.eligibility],
      evidenceSnapshotId: evidence.evidenceSnapshotId, forecastVersion: forecast.version, forecastManifestId: forecast.manifestId,
      forecastReadAsOf: forecast.readAsOf, baselineChecksum: forecast.baselineChecksum,
    },
    horizon: {
      requestedGames: horizon, scheduledGames: player.scheduledOpportunities, complete: horizonOk && player.horizonComplete,
      gameIds: player.games.map(game => game.gameId), startDate: player.games[0]?.date ?? null, endDate: player.games.at(-1)?.date ?? null,
      expectedAppearances: player.expectedAppearances, expectedStarts: player.expectedStarts, reason: horizonReason,
    },
    recentWindow: {
      requestedTeamGames: k, teamGames: recentGames.length, appearances, unknownGames,
      confirmedAbsences: recentGames.filter(game => game.status === "confirmed_absent").length,
      startDate: recentGames[0]?.date ?? null, endDate: recentGames.at(-1)?.date ?? null,
      rule: `last ${k} completed team games available at as-of`,
    },
    forecastTotals: Object.fromEntries(Object.entries(player.totals).map(([key, total]) =>
      [key, { expected: total.expected, unit: total.unit, reason: total.reason }])),
    metrics, ipp, opportunity, goalie,
    uncertainty: { predictiveSpread: na("not_supplied_by_forge_v1"), meanUncertainty: na("not_supplied_by_forge_v1") },
    freshness: { evidenceCutoffAt: evidence.sourceCutoffAt, evidenceAgeHours, evidenceStatus,
      forecastExpiresAt: expiry.expiresAt, forecastStatus: expiry.status },
    diagnostics: { excludedFutureRows: normalized.excludedFutureRows, invalidRows: normalized.invalidRows,
      duplicateRows: normalized.duplicateRows, conflictingGameIds: normalized.conflictingGameIds, retrospective: evidence.retrospective },
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
  return { observed, expected, gap, direction: direction(gap) };
}
