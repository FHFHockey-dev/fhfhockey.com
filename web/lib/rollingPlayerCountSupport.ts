import { createHash } from "node:crypto";

export const ALIGNED_COUNT_SUPPORT_VERSION = "rolling-player-aligned-counts-v1" as const;
export type CountStrength = "ev" | "pp";
export type CountAnchor = { gameId: number; gameDate: string; seasonId: number };
type PairName = "goalPerShot" | "assistPerGoal";
type Frame = CountAnchor & { sourceRowId: number; numerator: number; denominator: number };
type PairWindow = { observations: number; numerator: number; denominator: number; firstDate: string; lastDate: string; frameHash: string };
export type AlignedCountPair = { all: PairWindow; last5: PairWindow & { frames: Frame[] } };
export type RollingPlayerAlignedCountSupport = {
  version: typeof ALIGNED_COUNT_SUPPORT_VERSION;
  playerId: number;
  strengthState: CountStrength;
  anchor: CountAnchor;
  window: { policy: "canonical_observed_source_pairs_through_anchor"; startDate: string; endDate: string; endInclusive: true; recentObservations: 5; missing: "exclude_and_report" };
  sourceBinding: "nst_date_equals_canonical_wgo_game_date_and_season";
  sourceTable: "nst_gamelog_es_counts" | "nst_gamelog_pp_counts";
  pairs: Record<PairName, AlignedCountPair | null>;
  coverage: { examined: number; canonicalMatched: number; excluded: Record<string, number>; missingPair: Record<PairName, number> };
};
export type AlignedCountScope = { playerId: number; strengthState: CountStrength; anchor: CountAnchor };
type CanonicalGame = { id: number; date: string; seasonId?: number };
type SourceRow = { id?: number; player_id?: number; date_scraped: string; season: number; goals?: number | null; shots?: number | null; total_assists?: number | null; strength_state?: string };
type WgoIdentity = { player_id: number; game_id: number | null; date: string; season_id: number | null };
const validDate = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const count = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const positiveId = (value: unknown): value is number => count(value) && (value as number) > 0;
const frameText = (frame: Frame) => JSON.stringify([frame.gameId, frame.gameDate, frame.seasonId, frame.sourceRowId, frame.numerator, frame.denominator]) + "\n";
const frameHash = (frames: Frame[]) => createHash("sha256").update(frames.map(frameText).join("")).digest("hex");

/** The WGO event must agree with the canonical game. A source date join remains explicitly declared, not independent NST event proof. */
export function createAlignedCountSupportBuilder(options: {
  playerId: number; strengthState: CountStrength; sourceTable: string; startDate: string;
  canonicalGames: CanonicalGame[]; countsRows: SourceRow[];
}) {
  const expectedTable = options.strengthState === "ev" ? "nst_gamelog_es_counts" : "nst_gamelog_pp_counts";
  if (!positiveId(options.playerId) || !["ev", "pp"].includes(options.strengthState)
    || !validDate(options.startDate) || options.sourceTable !== expectedTable) throw new Error("Invalid aligned count source scope");
  const games = new Map<number, CanonicalGame>(), duplicateGames = new Set<number>();
  for (const game of options.canonicalGames) {
    if (games.has(game.id)) duplicateGames.add(game.id);
    games.set(game.id, game);
  }
  const byDate = new Map<string, SourceRow[]>();
  for (const row of options.countsRows) byDate.set(row.date_scraped, [...(byDate.get(row.date_scraped) ?? []), row]);
  const coverage: RollingPlayerAlignedCountSupport["coverage"] = { examined: 0, canonicalMatched: 0, excluded: {}, missingPair: { goalPerShot: 0, assistPerGoal: 0 } };
  const names: PairName[] = ["goalPerShot", "assistPerGoal"];
  const states = Object.fromEntries(names.map(name => [name, { observations: 0, numerator: 0, denominator: 0, firstDate: "", lastDate: "", hash: createHash("sha256"), recent: [] as Frame[] }])) as Record<PairName, { observations: number; numerator: number; denominator: number; firstDate: string; lastDate: string; hash: ReturnType<typeof createHash>; recent: Frame[] }>;
  const seen = new Set<number>();
  let previousDate = "";
  const exclude = (reason: string) => { coverage.excluded[reason] = (coverage.excluded[reason] ?? 0) + 1; };
  return {
    push(wgo: WgoIdentity): RollingPlayerAlignedCountSupport | null {
      if (!validDate(wgo.date) || wgo.date < previousDate || wgo.date < options.startDate) throw new Error("Aligned count observations are outside the declared order/window");
      previousDate = wgo.date; coverage.examined += 1;
      const game = positiveId(wgo.game_id) ? games.get(wgo.game_id) : undefined;
      const canonical = wgo.player_id === options.playerId && game && !duplicateGames.has(game.id)
        && positiveId(game.seasonId) && game.date === wgo.date && game.seasonId === wgo.season_id;
      if (!canonical) { exclude("missing_or_mismatched_canonical_event"); return null; }
      if (seen.has(game.id)) throw new Error("Duplicate aligned count event");
      seen.add(game.id); coverage.canonicalMatched += 1;
      const matches = byDate.get(wgo.date) ?? [];
      let source: SourceRow | undefined;
      if (matches.length !== 1) exclude(matches.length ? "ambiguous_source_date" : "missing_source_row");
      else if (matches[0].player_id !== options.playerId || matches[0].season !== game.seasonId
        || !positiveId(matches[0].id) || matches[0].strength_state !== undefined && matches[0].strength_state !== options.strengthState) exclude("mismatched_source_identity");
      else source = matches[0];
      const anchor = { gameId: game.id, gameDate: game.date, seasonId: game.seasonId! };
      for (const name of names) {
        const numerator = name === "goalPerShot" ? source?.goals : source?.total_assists;
        const denominator = name === "goalPerShot" ? source?.shots : source?.goals;
        if (!count(numerator) || !count(denominator) || name === "goalPerShot" && numerator > denominator) { coverage.missingPair[name] += 1; continue; }
        const frame: Frame = { ...anchor, sourceRowId: source!.id!, numerator, denominator };
        const state = states[name];
        state.observations += 1; state.numerator += numerator; state.denominator += denominator;
        if (!count(state.numerator) || !count(state.denominator)) throw new Error("Aligned count total overflow");
        state.firstDate ||= game.date; state.lastDate = game.date; state.hash.update(frameText(frame));
        state.recent.push(frame); if (state.recent.length > 5) state.recent.shift();
      }
      const pairs = Object.fromEntries(names.map(name => {
        const state = states[name], frames = state.recent.map(frame => ({ ...frame }));
        return [name, state.observations ? {
          all: { observations: state.observations, numerator: state.numerator, denominator: state.denominator, firstDate: state.firstDate, lastDate: state.lastDate, frameHash: state.hash.copy().digest("hex") },
          last5: { observations: frames.length, numerator: frames.reduce((n, frame) => n + frame.numerator, 0), denominator: frames.reduce((n, frame) => n + frame.denominator, 0), firstDate: frames[0].gameDate, lastDate: frames.at(-1)!.gameDate, frameHash: frameHash(frames), frames },
        } : null];
      })) as Record<PairName, AlignedCountPair | null>;
      return { version: ALIGNED_COUNT_SUPPORT_VERSION, playerId: options.playerId, strengthState: options.strengthState, anchor,
        window: { policy: "canonical_observed_source_pairs_through_anchor", startDate: options.startDate, endDate: game.date, endInclusive: true, recentObservations: 5, missing: "exclude_and_report" },
        sourceBinding: "nst_date_equals_canonical_wgo_game_date_and_season", sourceTable: expectedTable,
        pairs, coverage: { ...coverage, excluded: { ...coverage.excluded }, missingPair: { ...coverage.missingPair } } };
    },
  };
}

/** Unversioned/legacy scalar totals never establish a common observation frame. */
export function readAlignedCountSupport(value: unknown, scope: AlignedCountScope): RollingPlayerAlignedCountSupport | null {
  const support = value as RollingPlayerAlignedCountSupport | undefined;
  if (!support || !positiveId(scope.playerId) || !["ev", "pp"].includes(scope.strengthState) || support.version !== ALIGNED_COUNT_SUPPORT_VERSION || support.playerId !== scope.playerId
    || support.strengthState !== scope.strengthState || support.anchor?.gameId !== scope.anchor.gameId
    || support.anchor?.gameDate !== scope.anchor.gameDate || support.anchor?.seasonId !== scope.anchor.seasonId
    || !positiveId(scope.anchor.gameId) || !positiveId(scope.anchor.seasonId) || !validDate(scope.anchor.gameDate)
    || support.sourceTable !== (scope.strengthState === "ev" ? "nst_gamelog_es_counts" : "nst_gamelog_pp_counts")
    || support.sourceBinding !== "nst_date_equals_canonical_wgo_game_date_and_season"
    || support.window?.policy !== "canonical_observed_source_pairs_through_anchor" || support.window.endInclusive !== true
    || support.window.recentObservations !== 5 || support.window.missing !== "exclude_and_report"
    || !validDate(support.window.startDate) || support.window.startDate > scope.anchor.gameDate
    || support.window.endDate !== scope.anchor.gameDate || !support.pairs || !support.coverage
    || !count(support.coverage.examined) || !count(support.coverage.canonicalMatched)
    || support.coverage.canonicalMatched > support.coverage.examined || !support.coverage.excluded || !support.coverage.missingPair
    || Object.values(support.coverage.excluded).some(value => !count(value))
    || Object.values(support.coverage.excluded).reduce((sum, value) => sum + value, 0) > support.coverage.examined) return null;
  for (const name of ["goalPerShot", "assistPerGoal"] as const) {
    const pair = support.pairs[name];
    if (!count(support.coverage.missingPair[name])) return null;
    if (pair === null) {
      if (support.coverage.missingPair[name] !== support.coverage.canonicalMatched) return null;
      continue;
    }
    if (!pair || !Array.isArray(pair.last5?.frames)) return null;
    for (const window of [pair.all, pair.last5]) {
      if (!window || !positiveId(window.observations) || !count(window.numerator) || !count(window.denominator)
        || !validDate(window.firstDate) || !validDate(window.lastDate) || window.firstDate > window.lastDate
        || window.firstDate < support.window.startDate || window.lastDate > support.window.endDate
        || !/^[a-f0-9]{64}$/.test(window.frameHash) || name === "goalPerShot" && window.numerator > window.denominator) return null;
    }
    const frames = pair.last5.frames;
    if (frames.length !== Math.min(5, pair.all.observations) || pair.last5.observations !== frames.length
      || pair.all.observations + support.coverage.missingPair[name] !== support.coverage.canonicalMatched
      || pair.all.numerator < pair.last5.numerator
      || pair.all.denominator < pair.last5.denominator || pair.all.lastDate !== pair.last5.lastDate
      || pair.all.firstDate > pair.last5.firstDate
      || pair.all.observations <= 5 && (pair.all.numerator !== pair.last5.numerator
        || pair.all.denominator !== pair.last5.denominator || pair.all.frameHash !== pair.last5.frameHash)
      || pair.last5.firstDate !== frames[0]?.gameDate || pair.last5.lastDate !== frames.at(-1)?.gameDate
      || frames.some(frame => !frame || typeof frame !== "object")
      || new Set(frames.map(frame => frame.gameId)).size !== frames.length
      || frames.some((frame, index) => !positiveId(frame.gameId) || !positiveId(frame.seasonId) || !positiveId(frame.sourceRowId)
        || !validDate(frame.gameDate) || !count(frame.numerator) || !count(frame.denominator)
        || name === "goalPerShot" && frame.numerator > frame.denominator
        || frame.gameDate < support.window.startDate || frame.gameDate > support.window.endDate
        || index > 0 && frame.gameDate < frames[index - 1].gameDate)
      || pair.last5.numerator !== frames.reduce((n, frame) => n + frame.numerator, 0)
      || pair.last5.denominator !== frames.reduce((n, frame) => n + frame.denominator, 0)
      || pair.last5.frameHash !== frameHash(frames)) return null;
  }
  return support;
}
