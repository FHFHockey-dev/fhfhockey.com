// Executable research specification only. No application imports or consumers.
// Inputs are normalized fictional packets; this is not a provider adapter.
const THRESHOLDS = [2, 3, 4];
const BINS = ["0", "1", "2", "3", "4+"];
const LAST_N = { last10: 10, last20: 20, last30: 30 };
const fail = (message) => { throw new Error(message); };
const id = (value) => typeof value === "string" && value.trim().length > 0;
const date = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};
const integer = (value) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

function validatePacket(input) {
  if (!id(input.playerId) || !Number.isInteger(input.seasonId) || !["regular", "playoff"].includes(input.phase)) fail("Invalid scope");
  const seasonStart = Math.floor(input.seasonId / 10000), seasonEnd = input.seasonId % 10000;
  if (seasonEnd !== seasonStart + 1) fail("Invalid season ID");
  if (!date(input.asOfDate) || !date(input.seasonWindow?.start) || !date(input.seasonWindow?.end)
      || input.seasonWindow.start > input.seasonWindow.end) fail("Invalid scope dates");
  if (![...Object.keys(LAST_N), "season", "custom"].includes(input.window?.kind)) fail("Invalid window");
  if (input.window.kind === "custom" && (!date(input.window.start) || !date(input.window.end) || input.window.start > input.window.end)) fail("Invalid custom dates");
  if (!["complete", "partial", "unknown"].includes(input.populationCoverage) || !integer(input.unconfirmedScheduleGames)) fail("Invalid population coverage");
  if (!Array.isArray(input.rows)) fail("Rows required");
}

function validateRow(value, playerId) {
  if (value.playerId !== playerId || !id(value.gameId) || !id(value.teamId)) fail("Invalid player/game/team identity");
  if (!date(value.date) || !Number.isInteger(value.seasonId) || !["regular", "playoff"].includes(value.phase)
      || typeof value.final !== "boolean") fail("Invalid row scope");
  // Canonical appearance convention is games_played > 0. Its normalized
  // per-game domain here is 1, 0 or null, never an aggregate game count.
  if (![0, 1, null].includes(value.games_played)) fail("Unnormalized appearance");
  if (value.shots !== null && !integer(value.shots)) fail("Unnormalized SOG");
  if (value.games_played === 0 && value.shots > 0) fail("Nonappearance has positive SOG");
}

const sameRow = (left, right) => ["playerId", "gameId", "teamId", "date", "seasonId", "phase", "final", "games_played", "shots"]
  .every(key => left[key] === right[key]);

/** Computes only descriptive summaries over already qualified synthetic rows. */
export function describeSyntheticSog(input) {
  validatePacket(input);
  const unique = new Map();
  let collapsedDuplicates = 0;
  for (const value of input.rows) {
    validateRow(value, input.playerId);
    const prior = unique.get(value.gameId);
    if (prior && !sameRow(prior, value)) fail(`Conflicting duplicate: ${value.gameId}`);
    if (prior) collapsedDuplicates++;
    else unique.set(value.gameId, value);
  }
  // In real integration use the existing page's season bounds and selected
  // log window; never reselect a longer window to fill missing shot counts.
  const exclusions = { otherSeason: 0, otherPhase: 0, outsideSeasonDates: 0, currentOrFuture: 0, notFinal: 0, outsideCustom: 0, olderThanWindow: 0 };
  let selected = [...unique.values()].filter(value => {
    let reason = value.seasonId !== input.seasonId ? "otherSeason"
      : value.phase !== input.phase ? "otherPhase"
      : value.date < input.seasonWindow.start || value.date > input.seasonWindow.end ? "outsideSeasonDates"
      : value.date >= input.asOfDate ? "currentOrFuture"
      : !value.final ? "notFinal"
      : input.window.kind === "custom" && (value.date < input.window.start || value.date > input.window.end) ? "outsideCustom" : null;
    if (reason) exclusions[reason]++;
    return reason === null;
  }).sort((left, right) => left.date.localeCompare(right.date) || left.gameId.localeCompare(right.gameId));
  const requestedLogGames = LAST_N[input.window.kind] ?? null;
  if (requestedLogGames !== null) {
    exclusions.olderThanWindow = Math.max(0, selected.length - requestedLogGames);
    selected = selected.slice(-requestedLogGames);
  }

  const appearances = selected.filter(value => value.games_played > 0);
  const observed = appearances.filter(value => value.shots !== null);
  const unknownAppearanceGames = selected.filter(value => value.games_played === null).length;
  const missingSogAppearances = appearances.length - observed.length;
  const nonAppearances = selected.filter(value => value.games_played === 0).length;
  const denominator = observed.length;
  const sum = observed.reduce((total, value) => total + value.shots, 0);
  if (!Number.isSafeInteger(sum)) fail("SOG total exceeds safe integer precision");
  const frequency = count => denominator ? count / denominator : null;
  const thresholdRows = THRESHOLDS.map(threshold => {
    const hits = observed.filter(value => value.shots >= threshold).length;
    return { threshold, hits, denominator, frequency: frequency(hits) };
  });
  const distribution = BINS.map(bin => {
    const count = observed.filter(value => bin === "4+" ? value.shots >= 4 : value.shots === Number(bin)).length;
    return { bin, count, denominator, frequency: frequency(count) };
  });
  const complete = input.populationCoverage === "complete" && unknownAppearanceGames === 0
    && missingSogAppearances === 0 && input.unconfirmedScheduleGames === 0;
  const state = denominator ? complete ? "complete" : "partial"
    : complete && appearances.length === 0 ? "no_appearances" : "unavailable";
  const teams = [...new Set(appearances.map(value => value.teamId))].sort();
  return {
    contract: "sog-historical-descriptive-research-v1", populationCoverage: input.populationCoverage,
    state, selectedGameIds: selected.map(value => value.gameId),
    selectedLogGames: selected.length, requestedLogGames,
    windowFill: requestedLogGames === null ? "not_applicable" : selected.length === requestedLogGames ? "filled" : "short",
    confirmedAppearances: appearances.length, observedSogAppearances: denominator,
    missingSogAppearances, unknownAppearanceGames, nonAppearances,
    unconfirmedScheduleGames: input.unconfirmedScheduleGames,
    totalObservedSog: denominator ? sum : null, meanObservedSog: denominator ? sum / denominator : null,
    thresholdRows, distribution, teams, mixedTeamContext: teams.length > 1,
    observedSpan: selected.length ? { first: selected[0].date, last: selected.at(-1).date } : null,
    collapsedDuplicates, exclusions,
  };
}
