import type { LocalCardInput } from "./adapter";
import type { Components, GameMetricRecord } from "./aggregation";
import type { CardSettings } from "./contracts";
import { instant, settingsError, validDate, type AppearanceFrame } from "./windows";

export type NstCaptureBatch = {
  table: string;
  toiUnit: "seconds" | "minutes";
  capturedAt: string;
  reference: string;
  readStatus: "ok" | "error";
  identity: { mode: "row-player-id" } | { mode: "single-player-query"; playerId: number; reference: string };
  rows: readonly Readonly<Record<string, unknown>>[];
};
export type NstCapture = {
  id: string; capturedAt: string; settings: CardSettings;
  source: LocalCardInput["source"];
  population: LocalCardInput["population"];
  frames: readonly AppearanceFrame[];
  individual: NstCaptureBatch; onIce: NstCaptureBatch;
};
export type CaptureIssue = { group: "individual" | "onIce" | "both"; reason: string; playerId?: number; gameId?: number };
export type NstCaptureResult = {
  state: "mapped"; input: LocalCardInput; issues: CaptureIssue[];
  liveActivation: false; premiumActivation: false;
} | { state: "rejected"; reason: string; liveActivation: false; premiumActivation: false };

const fields = {
  individual: ["toi", "shots", "icf", "iscfs", "ixg", "total_points", "goals"],
  onIce: ["toi", "cf", "scf", "xgf", "xga", "gf", "sf"],
} as const;
const suffix = { all: "as", "5v5": "5v5", pp: "pp" } as const;
const key = (player: number, season: number, date: string) => `${player}:${season}:${date}`;
const positiveId = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value > 0;

/** Supplied local rows only. A successful read is not proof of history or population coverage. */
export function mapNstCapture(capture: NstCapture): NstCaptureResult {
  const reject = (reason: string): NstCaptureResult => ({ state: "rejected", reason, liveActivation: false, premiumActivation: false });
  const error = settingsError(capture.settings), capturedAt = instant(capture.capturedAt);
  if (error) return reject(error);
  if (!capture.id.trim() || capturedAt === null || capturedAt < instant(capture.settings.cutoff)!) return reject("Capture identity/time does not cover the declared cutoff");
  if (capture.population.scope !== "all-nhl") return reject("Observed captures require an explicitly declared all-NHL population scope");
  const issues: CaptureIssue[] = [];
  const indexed = (["individual", "onIce"] as const).map(group => {
    const batch = capture[group], time = instant(batch.capturedAt);
    const expected = `nst_gamelog_${suffix[capture.settings.strength]}_counts${group === "onIce" ? "_oi" : ""}`;
    const fail = (reason: string) => { issues.push({ group, reason }); return { rows: new Map<string, Readonly<Record<string, unknown>>[]>(), time: null }; };
    if (batch.table !== expected || batch.toiUnit !== "seconds") return fail("Table/strength or seconds unit does not match the selected NST contract");
    if (batch.readStatus !== "ok" || !batch.reference.trim() || time === null || time > capturedAt) return fail("Source read or capture provenance is unverified");
    if (batch.identity.mode === "single-player-query" && (!positiveId(batch.identity.playerId) || !batch.identity.reference.trim())) return fail("Single-player query identity receipt is missing");
    if (!["row-player-id", "single-player-query"].includes(batch.identity.mode)) return fail("Unsupported row identity contract");
    const rows = new Map<string, Readonly<Record<string, unknown>>[]>();
    for (const row of batch.rows) {
      if (!row || typeof row !== "object" || Array.isArray(row)) return fail("Source row is not a count record");
      const scoped = batch.identity.mode === "single-player-query" ? batch.identity.playerId : null;
      const playerId = row.player_id === undefined ? scoped : row.player_id;
      if (!positiveId(playerId) || (scoped !== null && playerId !== scoped) || !positiveId(row.season) || typeof row.date_scraped !== "string" || !validDate(row.date_scraped)) return fail("Source row identity, season or date is invalid/conflicts with the query receipt");
      const rowKey = key(playerId, row.season, row.date_scraped);
      rows.set(rowKey, [...(rows.get(rowKey) || []), row]);
    }
    return { rows, time };
  });

  const players = capture.frames.map(frame => {
    const appearances = frame.appearances.map(game => ({ ...game, completion: { ...game.completion } }));
    const eligible = appearances.filter(game => game.playerId === frame.playerId && game.season === capture.settings.season && game.gameType === capture.settings.gameType && game.played !== false);
    const dates = new Map<string, Set<number>>();
    for (const game of eligible) dates.set(game.date, new Set([...(dates.get(game.date) || []), game.gameId]));
    const records: GameMetricRecord[] = eligible.map(game => {
      const components: Components = { toiUnit: "seconds", individual: {}, onIce: {} };
      const times: number[] = [];
      const ambiguous = (dates.get(game.date)?.size || 0) > 1;
      if (ambiguous) issues.push({ group: "both", playerId: frame.playerId, gameId: game.gameId, reason: "Multiple official games share one date; NST date rows cannot identify the game" });
      if (!ambiguous) (["individual", "onIce"] as const).forEach((group, index) => {
        const batch = indexed[index], matches = batch.rows.get(key(frame.playerId, game.season, game.date)) || [];
        const completed = game.completion.status === "verified-final" ? instant(game.completion.completedAt) : null;
        const issue = (reason: string) => issues.push({ group, playerId: frame.playerId, gameId: game.gameId, reason });
        if (batch.time === null) return;
        if (matches.length !== 1) { issue(matches.length ? "Duplicate NST date rows; no row chosen or pooled" : "No captured NST row for this official appearance"); return; }
        if (completed !== null && batch.time < completed) { issue("Source was captured before the verified game completion"); return; }
        const row = matches[0];
        if (row.gp !== 1 && !(row.gp === 0 && fields[group].every(field => row[field] === 0))) { issue("NST row does not establish a single game or explicit zero exposure"); return; }
        components[group] = Object.fromEntries(fields[group].map(field => {
          const value = row[field];
          return [field, typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null];
        }));
        times.push(batch.time);
      });
      return { ...components, playerId: frame.playerId, gameId: game.gameId, season: game.season, date: game.date,
        strength: capture.settings.strength, sourceDefinition: capture.source.definition, sourceVersion: capture.source.version,
        capturedAt: new Date(times.length ? Math.min(...times) : capturedAt).toISOString(), state: "ready" };
    });
    return { frame: { ...frame, appearances }, records };
  });

  return { state: "mapped", input: {
    id: capture.id, origin: "local-observed", capturedAt: capture.capturedAt,
    settings: { ...capture.settings, period: { ...capture.settings.period } },
    source: { ...capture.source, verifiedMetrics: [...capture.source.verifiedMetrics] },
    population: { ...capture.population, expectedPlayerIds: [...capture.population.expectedPlayerIds] }, players,
  }, issues, liveActivation: false, premiumActivation: false };
}
