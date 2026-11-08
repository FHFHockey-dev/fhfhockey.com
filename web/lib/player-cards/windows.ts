import type { CardSettings } from "./contracts";

export type EndMinute = {
  startInclusive: string; endExclusive: string; timezone: string;
  clockBasis: "explicit-24h" | "schedule-bound-12h" | "unresolved";
};
/** `date` is the canonical UTC calendar date; `sourceDate` preserves the provider lookup day. */
export type Appearance = {
  playerId: number; gameId: number; season: number; gameType: "regular" | "playoffs";
  date: string; sourceDate?: string; played: boolean | null;
  completion: { status: "verified-final"; completedAt?: string; completedDuring?: EndMinute; reference: string } | { status: "unverified" };
};
export type AppearanceFrame = {
  playerId: number; season: number; gameType: "regular"; dateBasis: "UTC";
  completeHistory: boolean; historyThrough: string; historyReference: string;
  appearances: readonly Appearance[];
};
export type WindowSelection = {
  state: "ready" | "undefined" | "missing";
  reason?: string; settings: CardSettings; playerId: number;
  games: readonly Appearance[]; actualGp: number; requestedN: number | null;
  knownShort: boolean; firstDate: string | null; lastDate: string | null;
};

export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}
export function instant(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)) return null;
  const time = Date.parse(value);
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 19) !== value.slice(0, 19)) return null;
  return time;
}
/** A minute is a range, never an invented exact second. Unresolved clocks are not finality proof. */
export function completionBounds(completion: Appearance["completion"]): { earliest: number; safeAfter: number; exact: boolean } | null {
  if (completion.status !== "verified-final") return null;
  if (completion.completedAt !== undefined) {
    if (completion.completedDuring !== undefined) return null;
    const time = typeof completion.completedAt === "string" ? instant(completion.completedAt) : null;
    return time === null ? null : { earliest: time, safeAfter: time, exact: true };
  }
  const minute = completion.completedDuring;
  if (!minute || !["explicit-24h", "schedule-bound-12h"].includes(minute.clockBasis)) return null;
  const start = instant(minute.startInclusive), end = instant(minute.endExclusive);
  if (start === null || end === null || start % 60000 !== 0 || end - start !== 60000 || typeof minute.timezone !== "string" || !minute.timezone.trim()) return null;
  try { new Intl.DateTimeFormat("en", { timeZone: minute.timezone }); } catch { return null; }
  return { earliest: start, safeAfter: end, exact: false };
}
export function settingsError(settings: CardSettings): string | null {
  const season = String(settings.season);
  if (!/^\d{8}$/.test(season) || Number(season.slice(4)) !== Number(season.slice(0, 4)) + 1 || instant(settings.cutoff) === null) return "Invalid season or UTC cutoff";
  if (settings.gameType !== "regular" || !["all", "5v5", "pp"].includes(settings.strength) || settings.seasonPolicy !== "season-only-proposed" || !["allow-known-short-proposed", "require-full-proposed"].includes(settings.shortSamplePolicy) || settings.rankPolicy !== "competition-midrank-proposed") return "Unsupported or undeclared proposed policy";
  const period = settings.period;
  if (period.mode === "appearances") return [5, 10, 20].includes(period.count) ? null : "Invalid appearance count";
  if (period.mode !== "calendar" || period.timezone !== "UTC" || !validDate(period.start) || !validDate(period.end) || period.start > period.end) return "Invalid inclusive UTC calendar range";
  return null;
}

/** No implicit defaults; provisional season and short-sample choices are explicit. */
export function selectWindow(frame: AppearanceFrame, settings: CardSettings): WindowSelection {
  const base: WindowSelection = { state: "missing", settings, playerId: frame.playerId, games: [], actualGp: 0, requestedN: settings.period.mode === "appearances" ? settings.period.count : null, knownShort: false, firstDate: null, lastDate: null };
  const unavailable = (reason: string): WindowSelection => ({ ...base, reason });
  const error = settingsError(settings);
  if (error) return unavailable(error);
  const cutoff = instant(settings.cutoff)!;
  if (!Number.isSafeInteger(frame.playerId) || frame.playerId <= 0 || frame.season !== settings.season || frame.gameType !== settings.gameType || frame.dateBasis !== "UTC") return unavailable("Appearance-frame identity, season, type or date basis does not match");
  if (!frame.completeHistory || !frame.historyReference.trim() || (instant(frame.historyThrough) ?? -Infinity) < cutoff) return unavailable("Complete appearance history through the common cutoff is unverified");
  const games: Appearance[] = [];
  const seen = new Set<number>();
  for (const game of frame.appearances) {
    if (game.playerId !== frame.playerId || game.season !== settings.season || game.gameType !== settings.gameType) continue;
    if (!validDate(game.date) || (game.sourceDate !== undefined && !validDate(game.sourceDate))) return unavailable("Appearance has an invalid calendar or source game date");
    if (game.date > settings.cutoff.slice(0, 10)) continue;
    if (settings.period.mode === "calendar" && (game.date < settings.period.start || game.date > settings.period.end)) continue;
    if (!Number.isSafeInteger(game.gameId) || game.gameId <= 0 || seen.has(game.gameId)) return unavailable("Appearance has an invalid or duplicate game identity");
    seen.add(game.gameId);
    if (game.played === false) continue;
    if (game.played !== true) return unavailable("Appearance participation is unverified");
    if (game.completion.status !== "verified-final" || !game.completion.reference.trim()) return unavailable("Completed-game evidence is unverified");
    const finished = completionBounds(game.completion);
    if (!finished || finished.earliest < Date.parse(`${game.date}T00:00:00Z`)) return unavailable("Completed-game time or clock precision is unverified");
    if (finished.safeAfter > cutoff) {
      if (finished.earliest > cutoff) continue;
      return unavailable("Game-end minute overlaps the cutoff; completion at the cutoff is unknown");
    }
    games.push({ ...game, completion: { ...game.completion, ...(game.completion.completedDuring ? { completedDuring: { ...game.completion.completedDuring } } : {}) } });
  }
  for (let i = 0; i < games.length; i++) for (let j = i + 1; j < games.length; j++) {
    if (games[i].date !== games[j].date) continue;
    const a = completionBounds(games[i].completion)!, b = completionBounds(games[j].completion)!;
    const aBeforeB = a.exact ? a.safeAfter < b.earliest : a.safeAfter <= b.earliest;
    const bBeforeA = b.exact ? b.safeAfter < a.earliest : b.safeAfter <= a.earliest;
    if ((!a.exact || !b.exact) && !aBeforeB && !bBeforeA) return unavailable("Same-date appearance order is unknown at the reported end-time precision");
  }
  games.sort((a, b) => b.date.localeCompare(a.date)
    || completionBounds(b.completion)!.safeAfter - completionBounds(a.completion)!.safeAfter
    || b.gameId - a.gameId);
  const chosen = settings.period.mode === "appearances" ? games.slice(0, settings.period.count) : games;
  const short = settings.period.mode === "appearances" && chosen.length < settings.period.count;
  const result: WindowSelection = { ...base, state: "ready", games: chosen, actualGp: chosen.length, knownShort: short, firstDate: chosen.at(-1)?.date ?? null, lastDate: chosen[0]?.date ?? null };
  if (!chosen.length) return { ...result, state: "undefined", reason: "No completed appearances in the selected period" };
  if (short && settings.shortSamplePolicy === "require-full-proposed") return { ...result, state: "undefined", reason: "Known short season sample excluded by the proposed full-N policy" };
  return result;
}

