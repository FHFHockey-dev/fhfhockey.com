import type { CardSettings, MetricId, MetricReading, Period, Strength } from "./contracts";
import { METRICS, REGISTRY_VERSION } from "./registry";
import { adaptLocalSnapshot, type AdaptedCard, type LocalCardInput, type MetricCoverage } from "./adapter";
import { instant, settingsError, validDate } from "./windows";

type Origin = LocalCardInput["origin"];
export type ReceiptRef = { receiptId: string; sha256: string };
type Retained<K extends string, S> = { kind: K; receiptId: string; sha256: string; retainedPath: string; origin: Origin; capturedAt: string; subject: S };
export type HistoryReceipt = Retained<"appearance-history", {
  playerId: number; season: number; gameType: "regular"; dateBasis: "UTC" | "provider-game-date";
  sourceClass: "complete-official-log" | "latest-n" | "row-count"; through: string;
  appearances: readonly { gameId: number; date: string; played: boolean }[];
}>;
export type FinalityReceipt = Retained<"game-finality", {
  gameId: number; season: number; date: string; endedAt: string;
  sourceClass: "official-game-end" | "ingestion-completion" | "scheduled-start";
}>;
export type DefinitionReceipt = Retained<"metric-definition", {
  metricId: MetricId; registryVersion: string; sourceDefinition: string; sourceVersion: string; definitionVersion: string;
  zeroSemantics: "verified-distinct" | "placeholder-coerced" | "unknown";
}>;
export type PopulationReceipt = Retained<"population-membership", {
  metricId: MetricId; scope: LocalCardInput["population"]["scope"]; definitionVersion: string;
  sourceClass: "metric-population-inventory" | "roster-snapshot" | "ingestion-position-filter";
  season: number; gameType: "regular"; strength: Strength; period: Period; cutoff: string; memberIds: readonly number[];
}>;
export type RetainedReceipt = HistoryReceipt | FinalityReceipt | DefinitionReceipt | PopulationReceipt;
type ReceiptKind = RetainedReceipt["kind"];

/** Card claims bound to retained receipt references. Caller flags in LocalCardInput are never consulted as proof. */
export type EvidenceBundle = {
  id: string; origin: Origin;
  selection: { playerId: number; season: number; gameType: "regular"; strength: Strength; period: Period; cutoff: string };
  history: readonly { playerId: number; receipt: ReceiptRef }[];
  finality: readonly { gameId: number; receipt: ReceiptRef }[];
  definitions: readonly { metricId: MetricId; definitionVersion: string; receipt: ReceiptRef }[];
  populations: readonly { metricId: MetricId; receipt: ReceiptRef }[];
};
export type EvidenceIssue = { severity: "rejected" | "incomplete"; code: string; reason: string; playerId?: number; gameId?: number; metricId?: MetricId; receiptId?: string };
export type MetricEvidence = { state: "eligible" | "incomplete" | "rejected"; reasons: string[] };
export type EvidenceResult = {
  state: "eligible" | "incomplete" | "rejected"; bundleId: string; issues: EvidenceIssue[];
  metrics: Record<MetricId, MetricEvidence>; card: AdaptedCard | null;
  liveActivation: false; premiumActivation: false;
};
type At = Pick<EvidenceIssue, "playerId" | "gameId" | "metricId">;

const samePeriod = (a: Period, b: Period) => a.mode === b.mode && (a.mode === "appearances"
  ? b.mode === "appearances" && a.count === b.count
  : b.mode === "calendar" && a.start === b.start && a.end === b.end && a.timezone === b.timezone);
const inPeriod = (date: string, settings: CardSettings) => date <= settings.cutoff.slice(0, 10)
  && (settings.period.mode !== "calendar" || (date >= settings.period.start && date <= settings.period.end));
const positiveIds = (ids: readonly number[]) => ids.every(id => Number.isSafeInteger(id) && id > 0) && new Set(ids).size === ids.length;

/**
 * Offline classifier for supplied card inputs. `retained` must come from the retained-artifact
 * loader (hashes computed over kept receipt files), not from the card caller; no fetch or file access here.
 * Eligible means every claim resolves to a matching retained receipt; it is not live or premium activation.
 */
export function validateEvidenceBundle(input: LocalCardInput, bundle: EvidenceBundle, retained: readonly RetainedReceipt[]): EvidenceResult {
  const issues: EvidenceIssue[] = [];
  const reject = (code: string, reason: string, at: At & { receiptId?: string } = {}) => { issues.push({ severity: "rejected", code, reason, ...at }); };
  const lack = (code: string, reason: string, at: At & { receiptId?: string } = {}) => { issues.push({ severity: "incomplete", code, reason, ...at }); };
  const settings = input.settings, selection = bundle.selection, playerId = selection.playerId;
  const scope = input.origin === "synthetic" ? "synthetic-all-values" : "all-nhl";
  const supplied = input.players.map(player => player.frame.playerId);

  if (!bundle.id.trim()) reject("bundle-identity", "Evidence bundle identity is missing");
  if (bundle.origin !== input.origin) reject("origin-mismatch", "Bundle origin does not match the card input origin");
  const settingsProblem = settingsError(settings);
  if (settingsProblem) reject("settings", settingsProblem);
  if (selection.season !== settings.season) reject("selection-season", "Bundle season does not match the selected season");
  if (selection.gameType !== settings.gameType) reject("selection-game-type", "Bundle game type does not match the selected game type");
  if (selection.strength !== settings.strength) reject("selection-strength", "Bundle strength does not match the selected strength");
  if (!samePeriod(selection.period, settings.period)) reject("selection-window", "Bundle window does not match the selected window");
  if (instant(selection.cutoff) === null || instant(selection.cutoff) !== instant(settings.cutoff)) reject("selection-cutoff", "Bundle cutoff does not match the selected cutoff");
  if (!Number.isSafeInteger(playerId) || playerId <= 0 || !supplied.includes(playerId)) reject("selection-player", "Selected player is absent from the supplied card inputs", { playerId });
  if (!positiveIds(supplied)) reject("player-identity", "Supplied player identities are invalid or duplicated");
  if (issues.length) return finish(issues, null, new Map());
  const cutoff = instant(settings.cutoff)!;

  const byId = new Map<string, RetainedReceipt[]>();
  for (const receipt of retained) byId.set(receipt.receiptId, [...(byId.get(receipt.receiptId) || []), receipt]);
  function resolve<K extends ReceiptKind>(ref: ReceiptRef | undefined, kind: K, at: At): Extract<RetainedReceipt, { kind: K }> | null {
    if (!ref || !ref.receiptId.trim()) { lack(`${kind}-missing`, `No ${kind} receipt is referenced`, at); return null; }
    const found = byId.get(ref.receiptId) || [], receiptId = ref.receiptId;
    if (found.length > 1) { reject("receipt-ambiguous", `Receipt ${receiptId} is retained more than once`, { ...at, receiptId }); return null; }
    const receipt = found[0];
    if (!receipt || !receipt.retainedPath.trim()) { lack("receipt-not-retained", `Receipt ${receiptId} is not among retained receipts; a reference or hash alone is not evidence`, { ...at, receiptId }); return null; }
    if (!/^[0-9a-f]{64}$/.test(receipt.sha256) || receipt.sha256 !== ref.sha256) { reject("receipt-hash", `Receipt ${receiptId} hash does not match the retained receipt`, { ...at, receiptId }); return null; }
    if (receipt.kind !== kind) { reject("receipt-kind", `Receipt ${receiptId} is a ${receipt.kind} receipt, not ${kind}`, { ...at, receiptId }); return null; }
    if (receipt.origin !== bundle.origin) { reject("receipt-origin", `Receipt ${receiptId} origin does not match the bundle origin`, { ...at, receiptId }); return null; }
    if (instant(receipt.capturedAt) === null) { reject("receipt-time", `Receipt ${receiptId} capture time is invalid`, { ...at, receiptId }); return null; }
    return receipt as Extract<RetainedReceipt, { kind: K }>;
  }
  function single<T>(entries: readonly T[], at: At, label: string): T | undefined {
    if (entries.length > 1) { reject("duplicate-evidence", `Multiple ${label} entries for one subject`, at); return undefined; }
    return entries[0];
  }

  // Complete appearance history, per supplied player (every pool member needs its own window).
  const verifiedHistory = new Map<number, HistoryReceipt>();
  for (const entry of bundle.history) if (!supplied.includes(entry.playerId)) reject("history-unknown-player", "History receipt references a player without supplied card inputs", { playerId: entry.playerId });
  const required = new Map<number, { date: string }>();
  for (const player of input.players) {
    const id = player.frame.playerId, at = { playerId: id }, before = issues.length;
    const games = player.frame.appearances.filter(game => game.playerId === id && game.season === settings.season && game.gameType === settings.gameType);
    if (!positiveIds(games.map(game => game.gameId)) || games.some(game => !validDate(game.date))) { reject("frame-game-identity", "Supplied frame has an invalid or duplicate game identity", at); continue; }
    if (new Set(games.map(game => game.date)).size !== games.length) { reject("duplicate-date", "Supplied frame lists multiple appearances on one date; date-keyed NST rows cannot identify the game", at); continue; }
    for (const game of games) {
      if (game.played !== true || !inPeriod(game.date, settings)) continue;
      const known = required.get(game.gameId);
      if (known && known.date !== game.date) reject("game-date-conflict", "One game identity carries different dates across players", { gameId: game.gameId });
      required.set(game.gameId, { date: game.date });
    }
    const receipt = resolve(single(bundle.history.filter(entry => entry.playerId === id), at, "history")?.receipt, "appearance-history", at);
    if (!receipt) continue;
    const history = receipt.subject, through = instant(history.through);
    if (history.playerId !== id || history.season !== settings.season || history.gameType !== settings.gameType) { reject("history-identity", "History receipt player, season or game type does not match the supplied frame", at); continue; }
    if (through === null || through > instant(receipt.capturedAt)!) { reject("history-time", "History receipt claims coverage beyond its own capture time", at); continue; }
    if (!positiveIds(history.appearances.map(game => game.gameId)) || history.appearances.some(game => !validDate(game.date))) { reject("history-game-identity", "History receipt has an invalid or duplicate game identity", at); continue; }
    if (new Set(history.appearances.map(game => game.date)).size !== history.appearances.length) { reject("duplicate-date", "History receipt lists multiple appearances on one date; date-keyed NST rows cannot identify the game", at); continue; }
    for (const game of games) {
      const listed = history.appearances.find(entry => entry.gameId === game.gameId);
      if (!listed) reject("history-extra-appearance", `Supplied appearance ${game.gameId} is not in the history receipt`, { ...at, gameId: game.gameId });
      else if (listed.date !== game.date || listed.played !== game.played) reject("history-conflict", `Supplied appearance ${game.gameId} date or participation conflicts with the history receipt`, { ...at, gameId: game.gameId });
    }
    for (const listed of history.appearances) if (!games.some(game => game.gameId === listed.gameId)) lack("history-appearance-absent", `History receipt appearance ${listed.gameId} is absent from the supplied frame`, { ...at, gameId: listed.gameId });
    if (history.sourceClass !== "complete-official-log") lack("history-not-complete", `History source "${history.sourceClass}" does not establish complete appearance history`, at);
    if (history.dateBasis !== "UTC") lack("date-basis", "Game dates are not established as UTC calendar dates", at);
    if (through < cutoff) lack("history-through", "Complete appearance history does not reach the selected cutoff", at);
    if (issues.length === before) verifiedHistory.set(id, receipt);
  }

  // Independently sourced finality for every played appearance the window could select.
  const verifiedFinal = new Map<number, FinalityReceipt>();
  for (const [gameId, game] of required) {
    const at = { gameId };
    const receipt = resolve(single(bundle.finality.filter(entry => entry.gameId === gameId), at, "finality")?.receipt, "game-finality", at);
    if (!receipt) continue;
    const final = receipt.subject, ended = instant(final.endedAt);
    if (final.gameId !== gameId || final.season !== settings.season || final.date !== game.date) { reject("finality-identity", "Finality receipt game, season or date does not match the appearance", at); continue; }
    if (ended === null || ended > instant(receipt.capturedAt)! || ended < Date.parse(`${game.date}T00:00:00Z`)) { reject("finality-time", "Finality end time is invalid, precedes the game date or follows its own capture", at); continue; }
    if (final.sourceClass !== "official-game-end") { lack("finality-not-actual-end", final.sourceClass === "ingestion-completion" ? "Ingestion completion is not an actual game-end time" : `Finality source "${final.sourceClass}" is not an actual game-end time`, at); continue; }
    verifiedFinal.set(gameId, receipt);
  }

  // Metric-definition version and metric-specific population membership.
  const verifiedDefinitions = new Map<MetricId, DefinitionReceipt>();
  const verifiedPopulations = new Map<MetricId, readonly number[]>();
  for (const metric of METRICS) {
    const at = { metricId: metric.id };
    const declared = single(bundle.definitions.filter(entry => entry.metricId === metric.id), at, "definition");
    const definition = resolve(declared?.receipt, "metric-definition", at);
    if (definition && declared) {
      const subject = definition.subject;
      if (subject.metricId !== metric.id || subject.registryVersion !== REGISTRY_VERSION || subject.sourceDefinition !== input.source.definition || subject.sourceVersion !== input.source.version || !subject.definitionVersion.trim() || subject.definitionVersion !== declared.definitionVersion) reject("definition-mismatch", "Metric definition receipt does not match the registry, source or declared definition version", at);
      else if (subject.zeroSemantics !== "verified-distinct") lack("zero-semantics", "Provider zero/placeholder semantics are unverified; a stored zero may not be a measured zero", at);
      else verifiedDefinitions.set(metric.id, definition);
    }
    const population = resolve(single(bundle.populations.filter(entry => entry.metricId === metric.id), at, "population")?.receipt, "population-membership", at);
    if (!population) continue;
    const pool = population.subject, members = pool.memberIds;
    if (pool.metricId !== metric.id || pool.season !== settings.season || pool.gameType !== settings.gameType || pool.strength !== settings.strength || !samePeriod(pool.period, settings.period) || instant(pool.cutoff) !== cutoff) reject("population-selection", "Population receipt does not match the selected metric, season, strength, window or cutoff", at);
    else if (pool.scope !== scope) reject("population-scope", `Population scope "${pool.scope}" does not match the required "${scope}"`, at);
    else if (declared && pool.definitionVersion !== declared.definitionVersion) reject("population-definition", "Population receipt was built for a different metric-definition version", at);
    else if (!members.length || !positiveIds(members)) reject("population-members", "Population receipt members are empty, invalid or duplicated", at);
    else if (!members.includes(playerId)) reject("population-selected-player", "Selected player is not a member of this metric population", at);
    else if (pool.sourceClass !== "metric-population-inventory") lack("population-source", `Population source "${pool.sourceClass}" does not establish metric-specific membership`, at);
    else {
      const absent = members.filter(id => !supplied.includes(id));
      if (absent.length) lack("population-incomplete", `${absent.length} population member(s) lack supplied card inputs: ${absent.join(", ")}`, at);
      else verifiedPopulations.set(metric.id, members);
    }
  }
  if (issues.some(issue => issue.severity === "rejected")) return finish(issues, null, new Map());

  // Re-derive every adapter proof flag from verified receipts, then reuse the accepted adapter unchanged.
  const players = input.players.map(player => {
    const history = verifiedHistory.get(player.frame.playerId);
    return { records: player.records, frame: {
      ...player.frame, completeHistory: !!history, historyThrough: history?.subject.through ?? "", historyReference: history?.receiptId ?? "",
      appearances: player.frame.appearances.map(game => {
        const final = verifiedFinal.get(game.gameId);
        return { ...game, completion: final ? { status: "verified-final" as const, completedAt: final.subject.endedAt, reference: final.receiptId } : { status: "unverified" as const } };
      }),
    } };
  });
  const verifiedMetrics = METRICS.filter(metric => verifiedDefinitions.has(metric.id)).map(metric => metric.id);
  const base: LocalCardInput = { ...input, players, source: { ...input.source, definitionReference: verifiedMetrics.length ? `evidence-bundle:${bundle.id}` : "", verifiedMetrics } };
  const groups = new Map<string, { members: readonly number[] | null; metrics: MetricId[] }>();
  for (const metric of METRICS) {
    const members = verifiedPopulations.get(metric.id) ?? null;
    const key = members ? [...members].sort((a, b) => a - b).join(",") : "unverified";
    groups.set(key, { members, metrics: [...(groups.get(key)?.metrics || []), metric.id] });
  }
  const readings = new Map<MetricId, MetricReading>(), coverage = {} as Record<MetricId, MetricCoverage>;
  let card: AdaptedCard | null = null;
  for (const group of groups.values()) {
    const result = adaptLocalSnapshot({
      ...base,
      players: group.members ? players.filter(player => group.members!.includes(player.frame.playerId)) : players,
      population: group.members
        ? { scope, complete: true, reference: `evidence-bundle:${bundle.id}`, expectedPlayerIds: [...group.members] }
        : { scope, complete: false, reference: "", expectedPlayerIds: supplied },
    }, playerId);
    if (result.state === "rejected") { reject("adapter-rejected", result.reason); return finish(issues, null, new Map()); }
    for (const id of group.metrics) { readings.set(id, result.readings.find(reading => reading.id === id)!); coverage[id] = result.coverage[id]; }
    card ??= result;
  }
  const ordered = METRICS.map(metric => readings.get(metric.id)!);
  const valid = ordered.filter(reading => reading.state === "valid").length;
  return finish(issues, { ...card!, readings: ordered, coverage, state: valid === ordered.length ? "ready" : valid ? "partial" : "unavailable" }, readings);

  function finish(found: EvidenceIssue[], adapted: AdaptedCard | null, values: Map<MetricId, MetricReading>): EvidenceResult {
    const metrics = Object.fromEntries(METRICS.map(metric => {
      const own = found.filter(issue => issue.metricId === metric.id), reading = values.get(metric.id);
      const reasons = own.map(issue => issue.reason);
      if (reading?.state === "missing") reasons.push(reading.reason || "Metric value missing");
      if (reading?.state === "valid" && !reading.rank) reasons.push(reading.rankReason || "League rank unavailable");
      const state = found.some(issue => issue.severity === "rejected" && (issue.metricId === undefined || issue.metricId === metric.id)) ? "rejected" : reasons.length || !reading ? "incomplete" : "eligible";
      return [metric.id, { state, reasons }];
    })) as Record<MetricId, MetricEvidence>;
    const state = found.some(issue => issue.severity === "rejected") ? "rejected" : found.length || Object.values(metrics).some(metric => metric.state !== "eligible") ? "incomplete" : "eligible";
    return { state, bundleId: bundle.id, issues: found, metrics, card: state === "rejected" ? null : adapted, liveActivation: false, premiumActivation: false };
  }
}
