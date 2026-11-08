import type { CardSettings } from "./contracts";

/** Dates are canonical UTC game dates supplied by an inspected adapter. */
export type Appearance = {
  playerId: number; gameId: number; season: number; gameType: "regular" | "playoffs";
  date: string; played: boolean | null;
  completion: { status: "verified-final"; completedAt: string; reference: string } | { status: "unverified" };
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
    if (!validDate(game.date)) return unavailable("Appearance has an invalid UTC game date");
    if (game.date > settings.cutoff.slice(0, 10)) continue;
    if (settings.period.mode === "calendar" && (game.date < settings.period.start || game.date > settings.period.end)) continue;
    if (!Number.isSafeInteger(game.gameId) || game.gameId <= 0 || seen.has(game.gameId)) return unavailable("Appearance has an invalid or duplicate game identity");
    seen.add(game.gameId);
    if (game.played === false) continue;
    if (game.played !== true) return unavailable("Appearance participation is unverified");
    if (game.completion.status !== "verified-final" || !game.completion.reference.trim()) return unavailable("Completed-game evidence is unverified");
    const finished = instant(game.completion.completedAt);
    if (finished === null || finished < Date.parse(`${game.date}T00:00:00Z`)) return unavailable("Completed-game timestamp is invalid");
    if (finished > cutoff) continue;
    games.push({ ...game, completion: { ...game.completion } });
  }
  games.sort((a, b) => b.date.localeCompare(a.date)
    || (b.completion.status === "verified-final" ? instant(b.completion.completedAt)! : 0) - (a.completion.status === "verified-final" ? instant(a.completion.completedAt)! : 0)
    || b.gameId - a.gameId);
  const chosen = settings.period.mode === "appearances" ? games.slice(0, settings.period.count) : games;
  const short = settings.period.mode === "appearances" && chosen.length < settings.period.count;
  const result: WindowSelection = { ...base, state: "ready", games: chosen, actualGp: chosen.length, knownShort: short, firstDate: chosen.at(-1)?.date ?? null, lastDate: chosen[0]?.date ?? null };
  if (!chosen.length) return { ...result, state: "undefined", reason: "No completed appearances in the selected period" };
  if (short && settings.shortSamplePolicy === "require-full-proposed") return { ...result, state: "undefined", reason: "Known short season sample excluded by the proposed full-N policy" };
  return result;
}

