import { defineShareModule, type SharePostEvidence, type SharePostLoadResult, type SharePostSource, UNKNOWN_EVIDENCE } from "./contract";
import candidateFile from "./playerVsPlayer.candidates.json";
import { completeThrough, completeThroughNote, countNights } from "./shared/completeThrough";
import { bsh, lastN, per60, versusSeason, type ShareWindow } from "./shared/definitions";
import type { SkaterAppearance } from "./shared/skaterAppearances";

/**
 * Player vs Player (SS 5.0, CONTRACT §4). Two players on one basis and strength, beside any reviewed discussion posts.
 * The posts are a hand-picked file with no sampling frame, so no state ever claims a consensus or tallies a side.
 */
export const NO_CONSENSUS = "No consensus established";
export const SAMPLE_CAVEAT = "Hand-picked posts. Not a market price, a poll or a consensus.";
export const CANDIDATE_FILE = "playerVsPlayer.candidates.json";
const CLAIM_MAX = 240, NOTE_MAX = 160, URL_MAX = 200, CARD_CLAIMS = 2;

export type CandidatePlatform = "reddit" | "x";
export type CandidateClaimKind = "quoted" | "paraphrased";
export type CandidatePlayer = { id: number; name: string };
export type CandidateRecord = {
  id: string; players: [CandidatePlayer, CandidatePlayer];
  url: string; date: string; platform: CandidatePlatform; claimKind: CandidateClaimKind; claim: string;
  /** The player this post leans toward, or null when it takes no side. Never derived, only reviewed. */
  favorsPlayerId: number | null;
  selectionRationale: string; limitations: string;
};
export type CandidateRefusal = { index: number; id: string | null; reasons: string[] };

const PLATFORM_HOSTS: Record<CandidatePlatform, readonly string[]> = { reddit: ["reddit.com", "redd.it"], x: ["x.com", "twitter.com"] };
const isPlatform = (value: unknown): value is CandidatePlatform => value === "reddit" || value === "x";
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const isDate = (value: string) => /^[1-9]\d{3}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
const hostMatches = (url: string, platform: CandidatePlatform) => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && PLATFORM_HOSTS[platform].some(host => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`));
  } catch { return false; }
};
const candidatePlayer = (value: unknown): CandidatePlayer | null => {
  const player = value as { id?: unknown; name?: unknown } | null;
  return player && Number.isInteger(player.id) && (player.id as number) > 0 && text(player.name) ? { id: player.id as number, name: text(player.name) } : null;
};

/** One record, or why it is refused. No URL or no date means no claim. `today` refuses a post dated in the future. */
export function validateCandidate(raw: unknown, today: string | null = null): { record: CandidateRecord; reasons: [] } | { record: null; reasons: string[] } {
  const input = (raw ?? {}) as Record<string, unknown>, reasons: string[] = [];
  const id = text(input.id), url = text(input.url), date = text(input.date), claim = text(input.claim), selectionRationale = text(input.selectionRationale), limitations = text(input.limitations);
  const platform = input.platform, claimKind = input.claimKind as CandidateClaimKind;
  const players = Array.isArray(input.players) ? input.players.map(candidatePlayer) : [];
  if (!id) reasons.push("Missing id.");
  if (!isPlatform(platform)) reasons.push("Platform must be reddit or x.");
  if (!url) reasons.push("Missing URL.");
  else if (url.length > URL_MAX) reasons.push(`URL is over ${URL_MAX} characters.`);
  else if (isPlatform(platform) && !hostMatches(url, platform)) reasons.push("URL must be https on the stated platform.");
  if (!date) reasons.push("Missing date.");
  else if (!isDate(date)) reasons.push("Date must be YYYY-MM-DD.");
  else if (today && date > today) reasons.push("Date is in the future.");
  if (claimKind !== "quoted" && claimKind !== "paraphrased") reasons.push("Claim must be labeled quoted or paraphrased.");
  if (!claim) reasons.push("Missing claim.");
  else if (claim.length > CLAIM_MAX) reasons.push(`Claim is over ${CLAIM_MAX} characters.`);
  if (!selectionRationale) reasons.push("Missing selection rationale.");
  else if (selectionRationale.length > NOTE_MAX) reasons.push(`Selection rationale is over ${NOTE_MAX} characters.`);
  if (!limitations) reasons.push("Missing limitations.");
  else if (limitations.length > NOTE_MAX) reasons.push(`Limitations are over ${NOTE_MAX} characters.`);
  const [first, second] = players;
  if (players.length !== 2 || !first || !second) reasons.push("Needs exactly two players with NHL id and name.");
  else if (first.id === second.id) reasons.push("The two players must differ.");
  const favors = input.favorsPlayerId;
  if (favors !== null && !(first && second && (favors === first.id || favors === second.id))) reasons.push("favorsPlayerId must be one of the two players, or null.");
  if (reasons.length) return { record: null, reasons };
  return { record: { id, players: [first!, second!], url, date, platform: platform as CandidatePlatform, claimKind, claim, favorsPlayerId: favors as number | null, selectionRationale, limitations }, reasons: [] };
}
export function validateCandidateFile(raw: unknown, today: string | null = null): { accepted: CandidateRecord[]; refused: CandidateRefusal[] } {
  const list = (raw as { candidates?: unknown } | null)?.candidates;
  if (!Array.isArray(list)) return { accepted: [], refused: [{ index: -1, id: null, reasons: ["The candidate file has no candidates list."] }] };
  const accepted: CandidateRecord[] = [], refused: CandidateRefusal[] = [], ids = new Set<string>();
  list.forEach((entry, index) => {
    const result = validateCandidate(entry, today);
    if (!result.record) { refused.push({ index, id: text((entry as { id?: unknown } | null)?.id) || null, reasons: result.reasons }); return; }
    if (ids.has(result.record.id)) { refused.push({ index, id: result.record.id, reasons: ["Duplicate id."] }); return; }
    ids.add(result.record.id); accepted.push(result.record);
  });
  return { accepted, refused };
}

const pairKey = (a: number, b: number) => `${Math.min(a, b)}-${Math.max(a, b)}`;
/** A pair's posts in either player order, newest first. */
export const claimsForPair = (records: readonly CandidateRecord[], a: number, b: number) => records.filter(record => pairKey(record.players[0].id, record.players[1].id) === pairKey(a, b)).sort((x, y) => y.date.localeCompare(x.date) || x.id.localeCompare(y.id));

export type DiscussionKind = "empty" | "no-side" | "one-sided" | "conflicting";
export type PvpDiscussion = {
  /** Always NO_CONSENSUS: a hand-picked file cannot establish one, however uniform it looks. */
  headline: typeof NO_CONSENSUS; kind: DiscussionKind; note: string; caveat: string | null;
  claims: CandidateRecord[]; shown: CandidateRecord[]; rationales: string[];
};
const DISCUSSION_NOTES: Record<DiscussionKind, string> = {
  empty: "No sourced discussion is on file for this pair.",
  "no-side": "The reviewed posts here take no side.",
  "one-sided": "The reviewed posts that take a side all lean one way. That is what was selected, not what people think.",
  conflicting: "The reviewed posts here disagree.",
};
/** The card's cut goes round the sides, so trimming can never hide a disagreement. */
function cardClaims(claims: readonly CandidateRecord[]) {
  const sides = new Map<number | null, CandidateRecord[]>();
  for (const claim of claims) sides.set(claim.favorsPlayerId, [...sides.get(claim.favorsPlayerId) ?? [], claim]);
  const queues = [...sides.entries()].sort(([a], [b]) => (a === null ? 1 : 0) - (b === null ? 1 : 0)).map(([, queue]) => [...queue]), shown: CandidateRecord[] = [];
  while (shown.length < Math.min(CARD_CLAIMS, claims.length)) for (const queue of queues) { const next = queue.shift(); if (next && shown.length < CARD_CLAIMS) shown.push(next); }
  return shown;
}
export function summarizeDiscussion(claims: readonly CandidateRecord[]): PvpDiscussion {
  const sides = new Set(claims.flatMap(claim => claim.favorsPlayerId === null ? [] : [claim.favorsPlayerId]));
  const kind: DiscussionKind = !claims.length ? "empty" : sides.size === 0 ? "no-side" : sides.size === 1 ? "one-sided" : "conflicting";
  return { headline: NO_CONSENSUS, kind, note: DISCUSSION_NOTES[kind], caveat: claims.length ? SAMPLE_CAVEAT : null, claims: [...claims], shown: cardClaims(claims), rationales: [...new Set(claims.map(claim => claim.selectionRationale))] };
}

export type PvpWindowId = "l5" | "l10" | "std";
export type PvpBasis = "per-game" | "total" | "per-60";
export type PvpStrength = "all" | "pp";
export const PVP_WINDOW_LABELS: Record<PvpWindowId, string> = { l5: "Last 5 appearances", l10: "Last 10 appearances", std: "Season to date" };
export const PVP_BASIS_LABELS: Record<PvpBasis, string> = { "per-game": "Per appearance", total: "Totals", "per-60": "Per 60" };
export const PVP_STRENGTH_LABELS: Record<PvpStrength, string> = { all: "All situations", pp: "Power play" };

/** An appearance joined to its NST row on date; a null means no NST row or no value, never zero. */
export type PvpGame = SkaterAppearance & { ixg: number | null; iscf: number | null };
export type PvpNstRow = { player_id: number; date_scraped: string; gp: number | null; ixg: number | null; iscfs: number | null };
/** One player per date can be joined; a repeated date is unresolved, so it joins nothing. */
export function joinNst(appearances: readonly SkaterAppearance[], nst: readonly PvpNstRow[]): PvpGame[] {
  const rows = new Map<string, PvpNstRow | null>();
  for (const row of nst) { if (row.gp === 0) continue; const key = `${row.player_id}:${row.date_scraped}`; rows.set(key, rows.has(key) ? null : row); }
  return appearances.map(game => { const row = rows.get(`${game.playerId}:${game.date}`); return { ...game, ixg: row?.ixg ?? null, iscf: row?.iscfs ?? null }; });
}
export const selectWindow = <T>(games: readonly T[], window: PvpWindowId): ShareWindow<T> => window === "std" ? versusSeason(games, 0).season : lastN(games, window === "l5" ? 5 : 10);

type MetricSource = "wgo" | "nst";
type PvpMetric = { id: string; label: string; strength: PvpStrength; source: MetricSource; time?: boolean; decimals: number; value: (game: PvpGame) => number | null };
export const PVP_METRICS: readonly PvpMetric[] = [
  { id: "goals", label: "Goals", strength: "all", source: "wgo", decimals: 0, value: game => game.goals },
  { id: "assists", label: "Assists", strength: "all", source: "wgo", decimals: 0, value: game => game.assists },
  { id: "points", label: "Points", strength: "all", source: "wgo", decimals: 0, value: game => game.points },
  { id: "shots", label: "SOG", strength: "all", source: "wgo", decimals: 0, value: game => game.shots },
  { id: "hits", label: "Hits", strength: "all", source: "wgo", decimals: 0, value: game => game.hits },
  { id: "blocks", label: "Blocks", strength: "all", source: "wgo", decimals: 0, value: game => game.blocks },
  { id: "bsh", label: "BSH", strength: "all", source: "wgo", decimals: 0, value: game => bsh(game) },
  { id: "toi", label: "TOI", strength: "all", source: "wgo", time: true, decimals: 0, value: game => game.toiSeconds },
  { id: "ixg", label: "ixG (NST)", strength: "all", source: "nst", decimals: 2, value: game => game.ixg },
  { id: "iscf", label: "iSCF (NST)", strength: "all", source: "nst", decimals: 0, value: game => game.iscf },
  { id: "ppPoints", label: "PP points", strength: "pp", source: "wgo", decimals: 0, value: game => game.ppPoints },
  { id: "ppToi", label: "PP TOI", strength: "pp", source: "wgo", time: true, decimals: 0, value: game => game.ppToiSeconds },
];

export const mmss = (seconds: number) => { const whole = Math.round(seconds); return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`; };

export type PvpMetricSide = { value: number | null; shown: string; observed: number; expected: number; missing: number; admitted: boolean };
export type PvpMetricRow = { id: string; label: string; source: MetricSource; a: PvpMetricSide; b: PvpMetricSide; higher: "a" | "b" | "tie" | null };
/** The one window a comparison reads: player, window, basis and strength travel together so a mismatch can be refused. */
export type PvpPlayerWindow = { playerId: number; name: string; group: "F" | "D" | null; windowId: PvpWindowId; basis: PvpBasis; strength: PvpStrength; window: ShareWindow<PvpGame> };
export function playerWindow(playerId: number, games: readonly PvpGame[], view: { windowId: PvpWindowId; basis: PvpBasis; strength: PvpStrength }): PvpPlayerWindow {
  const window = selectWindow(games, view.windowId), latest = games[games.length - 1];
  return { playerId, name: latest?.name ?? `Player ${playerId}`, group: latest?.group ?? null, ...view, window };
}
function metricSide(metric: PvpMetric, side: PvpPlayerWindow, minCoverage: number): PvpMetricSide {
  const known = side.window.rows.flatMap(game => { const value = metric.value(game); return value === null ? [] : [{ game, value }]; });
  const expected = side.window.rows.length, observed = known.length, missing = expected - observed;
  const admitted = expected > 0 && (metric.source === "nst" ? observed * 100 >= minCoverage * expected : observed > 0);
  const unknown = { value: null, shown: "—", observed, expected, missing, admitted };
  if (!admitted) return unknown;
  const sum = known.reduce((total, row) => total + row.value, 0);
  const seconds = (game: PvpGame) => side.strength === "pp" ? game.ppToiSeconds : game.toiSeconds;
  const timed = known.filter(row => seconds(row.game) !== null);
  const value = side.basis === "total" ? sum : side.basis === "per-game" ? sum / observed
    /* Per 60 is summed over games with both the count and the time, and each strength uses its own time. */
    : per60(timed.reduce((total, row) => total + row.value, 0), timed.reduce((total, row) => total + (seconds(row.game) ?? 0), 0));
  if (value === null) return unknown;
  const decimals = side.basis === "total" ? metric.decimals : 2;
  return { value, shown: metric.time ? mmss(value) : value.toFixed(decimals), observed, expected, missing, admitted };
}
export type PvpComparison = { ok: true; metrics: PvpMetricRow[]; notes: string[] } | { ok: false; reason: string };
/** Refuses a different strength, basis or window. Differing samples stay comparable but are always disclosed. */
export function comparePlayerWindows(a: PvpPlayerWindow, b: PvpPlayerWindow, minCoverage: number): PvpComparison {
  if (a.strength !== b.strength) return { ok: false, reason: `Refused: ${PVP_STRENGTH_LABELS[a.strength]} cannot be compared with ${PVP_STRENGTH_LABELS[b.strength]}.` };
  if (a.basis !== b.basis) return { ok: false, reason: `Refused: ${PVP_BASIS_LABELS[a.basis]} cannot be compared with ${PVP_BASIS_LABELS[b.basis]}.` };
  if (a.windowId !== b.windowId) return { ok: false, reason: `Refused: ${PVP_WINDOW_LABELS[a.windowId]} cannot be compared with ${PVP_WINDOW_LABELS[b.windowId]}.` };
  const samplesDiffer = a.window.actual !== b.window.actual, notes: string[] = [];
  const metrics = PVP_METRICS.filter(metric => metric.strength === a.strength && !(metric.time && a.basis === "per-60")).map((metric): PvpMetricRow => {
    const left = metricSide(metric, a, minCoverage), right = metricSide(metric, b, minCoverage);
    /* Compared as printed, so a shown tie is a tie. Totals over different samples are printed but not compared. */
    const higher = left.value === null || right.value === null || (a.basis === "total" && samplesDiffer) ? null : left.shown === right.shown ? "tie" : left.value > right.value ? "a" : "b";
    return { id: metric.id, label: metric.label, source: metric.source, a: left, b: right, higher };
  });
  if (samplesDiffer) notes.push(`Samples differ: ${a.name} ${a.window.actual}, ${b.name} ${b.window.actual} appearances.${a.basis === "total" ? " Totals are shown but not compared." : ""}`);
  if (a.group && b.group && a.group !== b.group) notes.push(`Different positions: ${a.name} is ${a.group}, ${b.name} is ${b.group}.`);
  for (const side of [a, b]) {
    const teams = [...new Set(side.window.rows.flatMap(game => game.team ? [game.team] : []))];
    if (teams.length > 1) notes.push(`${side.name} played for ${teams.join(" and ")} in this window.`);
  }
  for (const row of metrics) {
    if (row.source === "nst") notes.push(`${row.label} coverage (minimum ${minCoverage}%): ${a.name} ${row.a.observed} of ${row.a.expected}, ${row.a.missing} missing; ${b.name} ${row.b.observed} of ${row.b.expected}, ${row.b.missing} missing. NST individual, all situations, not on-ice.`);
    else if (row.a.missing || row.b.missing) notes.push(`${row.label} missing: ${a.name} ${row.a.missing}, ${b.name} ${row.b.missing} of their appearances.`);
  }
  return { ok: true, metrics, notes };
}

export type PlayerVsPlayerSettings = { pair: string; playerA: number | null; playerB: number | null; window: PvpWindowId; basis: PvpBasis; strength: PvpStrength; minCoverage: number };
export type PvpSide = { playerId: number; name: string; group: "F" | "D" | null; team: string | null; appearances: number; requested: number | null; short: boolean; firstDate: string | null; lastDate: string | null };
export type PlayerVsPlayerData = {
  settingsKey: string; through: string; season: number; windowLabel: string; basisLabel: string; strengthLabel: string;
  a: PvpSide; b: PvpSide; metrics: PvpMetricRow[]; notes: string[];
  discussion: PvpDiscussion; selection: { sourced: boolean; rationales: string[] };
};
/** Identifies what a snapshot holds. The shell prints current settings, so data loaded under others must not export. */
export const pvpSettingsKey = (settings: PlayerVsPlayerSettings) => {
  const players = resolvePlayers(settings);
  return [players ? `${players.a}-${players.b}` : "none", settings.window, settings.basis, settings.strength, settings.minCoverage].join("|");
};
const NONE = "manual";
/** A sourced pair if one is chosen, otherwise the two entered ids. */
export function resolvePlayers(settings: Pick<PlayerVsPlayerSettings, "pair" | "playerA" | "playerB">): { a: number; b: number } | null {
  if (settings.pair !== NONE) {
    const [a, b] = settings.pair.split("-").map(Number);
    return a > 0 && b > 0 ? { a, b } : null;
  }
  return settings.playerA !== null && settings.playerB !== null ? { a: settings.playerA, b: settings.playerB } : null;
}
export function validatePlayerVsPlayer(settings: PlayerVsPlayerSettings): string | null {
  if (settings.pair !== NONE && (settings.playerA !== null || settings.playerB !== null)) return "Clear the player ids to use a sourced pair.";
  for (const id of [settings.playerA, settings.playerB]) if (id !== null && !Number.isInteger(id)) return "Player ids must be whole numbers.";
  const players = resolvePlayers(settings);
  return players && players.a === players.b ? "Choose two different players." : null;
}

/** One team's scheduled games through the edition, each with whether its result is reported. */
export type PvpTeamCoverage = { team: string; games: readonly { date: string; completed: boolean }[] };
export type BuildPvpInput = {
  settings: PlayerVsPlayerSettings; season: number; through: string; today: string;
  appearances: readonly SkaterAppearance[];
  /** Null when the NST read failed; an empty list is a read that found nothing. Not read for power-play views. */
  nst: readonly PvpNstRow[] | null;
  teamCoverage: readonly PvpTeamCoverage[];
  candidates: unknown;
};
const side = (player: PvpPlayerWindow): PvpSide => {
  const rows = player.window.rows, latest = rows[rows.length - 1];
  return { playerId: player.playerId, name: player.name, group: player.group, team: latest?.team ?? null, appearances: player.window.actual, requested: player.window.requested, short: player.window.short, firstDate: rows[0]?.date ?? null, lastDate: latest?.date ?? null };
};
const sampleText = (player: PvpSide) => `${player.name} ${player.appearances}${player.short ? ` of ${player.requested}` : ""} appearances${player.firstDate ? ` (${player.firstDate} to ${player.lastDate})` : ""}`;
const newest = (dates: readonly string[]) => dates.reduce<string | null>((latest, date) => !latest || date > latest ? date : latest, null);

export function buildPlayerVsPlayer(input: BuildPvpInput): SharePostLoadResult<PlayerVsPlayerData> {
  const { settings } = input, players = resolvePlayers(settings);
  const blocked = (reason: string): SharePostLoadResult<PlayerVsPlayerData> => ({ state: "blocked", reasons: [reason], evidence: UNKNOWN_EVIDENCE, data: null });
  if (!players) return blocked("Enter two NHL player ids, or choose a sourced pair.");
  /* A late feed on the newest nights ends the card at the last complete night (TJ, 2026-11-03); an older gap still blocks export. */
  const teamGames = input.teamCoverage.flatMap(team => team.games);
  const cut = completeThrough(countNights(teamGames.map(game => game.date), teamGames.flatMap(game => game.completed ? [game.date] : [])), input.through), through = cut.through;
  if (!through) return blocked("No night in this window is fully reported yet.");
  const appearances = input.appearances.filter(game => game.date <= through);
  const nstRows = (input.nst ?? []).filter(row => row.date_scraped <= through), games = joinNst(appearances, nstRows), view = { windowId: settings.window, basis: settings.basis, strength: settings.strength };
  const windowA = playerWindow(players.a, games.filter(game => game.playerId === players.a), view), windowB = playerWindow(players.b, games.filter(game => game.playerId === players.b), view);
  const comparison = comparePlayerWindows(windowA, windowB, settings.minCoverage);
  if (!comparison.ok) return blocked(comparison.reason);

  const { accepted, refused } = validateCandidateFile(input.candidates, input.today);
  const claims = claimsForPair(accepted, players.a, players.b), discussion = summarizeDiscussion(claims);
  const a = side(windowA), b = side(windowB), usesNst = settings.strength === "all";
  const coverage = input.teamCoverage.map(team => { const kept = team.games.filter(game => game.date <= through); return { team: team.team, scheduled: kept.length, completed: kept.filter(game => game.completed).length }; });
  const scheduled = coverage.reduce((total, team) => total + team.scheduled, 0), completed = coverage.reduce((total, team) => total + team.completed, 0);
  const reasons = [
    /* Only older gaps are left by now: the cut removed every late newest night. */
    ...coverage.flatMap(team => team.scheduled > team.completed ? [`${team.team}: ${team.scheduled - team.completed} of ${team.scheduled} scheduled games have no reported result.`] : []),
    ...comparison.metrics.flatMap(row => row.source === "wgo" && (row.a.missing || row.b.missing) ? [`${row.label} has missing game values.`] : []),
    ...(usesNst && input.nst === null ? ["Natural Stat Trick game logs could not be read."] : []),
    ...(refused.length ? [`Candidate records refused: ${refused.map(entry => entry.id ?? `#${entry.index + 1}`).join(", ")}.`] : []),
  ];
  const wgoDates = appearances.map(game => game.date), note = completeThroughNote(cut);
  const sources: SharePostSource[] = [{ name: "NHL.com skater game stats", tables: ["wgo_skater_stats", "wgo_team_stats", "games"], state: scheduled > completed ? "partial" : "ready", asOf: newest(wgoDates), updatedAt: null }];
  if (usesNst) sources.push({ name: "Natural Stat Trick game logs", tables: ["nst_gamelog_as_counts"], state: input.nst === null ? "missing" : "ready", asOf: newest(nstRows.map(row => row.date_scraped)), updatedAt: null });
  if (claims.length) sources.push({ name: "Reviewed discussion posts", tables: [CANDIDATE_FILE], state: "ready", asOf: newest(claims.map(claim => claim.date)), updatedAt: null });
  /* The card carries one legend line; the disclosures it used to print sit beside the preview and in the alt text. */
  const cohort = ["Two selected players, not a league ranking.", claims.length ? `Selected because: ${discussion.rationales.join(" ")}` : "Editor-chosen pair, with no sourced discussion behind it.", discussion.note, ...(discussion.caveat ? [discussion.caveat] : []), ...comparison.notes].join(" ");
  const evidence: SharePostEvidence = {
    sources, sample: `${PVP_WINDOW_LABELS[settings.window]}: ${sampleText(a)}; ${sampleText(b)}`, strength: PVP_STRENGTH_LABELS[settings.strength], cohort,
    coverage: { observed: completed, expected: scheduled, missing: Math.max(0, scheduled - completed), unit: "team games" },
  };
  return {
    state: reasons.length ? "partial" : "ready", reasons, evidence, ...(note ? { pageNotes: [note] } : {}), teams: [...new Set([a.team, b.team].flatMap(team => team ? [team] : []))],
    data: {
      settingsKey: pvpSettingsKey(settings), through, season: input.season, windowLabel: PVP_WINDOW_LABELS[settings.window], basisLabel: PVP_BASIS_LABELS[settings.basis], strengthLabel: PVP_STRENGTH_LABELS[settings.strength],
      a, b, metrics: comparison.metrics, notes: comparison.notes, discussion, selection: { sourced: claims.length > 0, rationales: discussion.rationales },
    },
  };
}

export const pvpDataMatches = (data: PlayerVsPlayerData, settings: PlayerVsPlayerSettings) => data.settingsKey === pvpSettingsKey(settings);
export const pvpHasRows = (data: PlayerVsPlayerData, settings: PlayerVsPlayerSettings) => pvpDataMatches(data, settings) && data.a.appearances > 0 && data.b.appearances > 0 && data.metrics.some(row => row.a.value !== null && row.b.value !== null);

/**
 * Each side's share of the pair's combined value, for the head-to-head bars. Null means no bar: a missing value has no share,
 * and neither does its opponent, and an uncompared row (totals over differing samples) stays uncompared. A printed tie is an even split.
 */
export function pvpBarShares({ a, b, higher }: Pick<PvpMetricRow, "a" | "b" | "higher">): { a: number | null; b: number | null } {
  if (higher === null || a.value === null || b.value === null) return { a: null, b: null };
  const total = a.value + b.value;
  if (total <= 0) return { a: 0, b: 0 };
  if (higher === "tie") { const even = Number(a.shown) === 0 ? 0 : 0.5; return { a: even, b: even }; }
  return { a: a.value / total, b: b.value / total };
}

/** The card's one line under the stats: how to read the marks, and what the posts are. */
export function pvpLegend(data: PlayerVsPlayerData) {
  const marks = data.metrics.some(row => row.higher !== null) ? "Bright = higher." : data.a.appearances !== data.b.appearances && data.basisLabel === PVP_BASIS_LABELS.total ? "Totals not compared: samples differ." : "Not compared.";
  return `${marks} ${data.discussion.claims.length ? "Hand-picked posts, not a market price or a poll." : "No posts on file."}`;
}

const claimAlt = (claim: CandidateRecord) => `${claim.platform === "x" ? "X" : "Reddit"}, ${claim.date}, ${claim.claimKind}: ${claim.claimKind === "quoted" ? `"${claim.claim}"` : claim.claim} ${claim.url} Limitations: ${claim.limitations}`;
export function pvpAltText(data: PlayerVsPlayerData, sample: string) {
  const stats = data.metrics.map(row => `${row.label}: ${data.a.name} ${row.a.shown}, ${data.b.name} ${row.b.shown}`).join("; ");
  const selection = data.selection.sourced ? `Selected because: ${data.selection.rationales.join(" ")}` : "Editor-chosen pair.";
  return [`FHFH Player vs Player, ${data.a.name} and ${data.b.name}, ${data.windowLabel}, ${data.basisLabel}, ${data.strengthLabel}, through ${data.through}.`, `${stats}.`, `${sample}.`, ...data.notes, `${data.discussion.headline}. ${data.discussion.note}`, ...(data.discussion.caveat ? [data.discussion.caveat] : []), selection, ...data.discussion.claims.map(claimAlt)].join(" ");
}

/* The dropdown lists pairs that pass validation; the loader re-validates against today's date. */
const pairOptions = () => {
  const pairs = new Map<string, string>();
  for (const record of validateCandidateFile(candidateFile).accepted) pairs.set(pairKey(record.players[0].id, record.players[1].id), `${record.players[0].name} vs ${record.players[1].name}`);
  return [{ value: NONE, label: "None: enter player ids" }, ...[...pairs].sort(([, x], [, y]) => x.localeCompare(y)).map(([value, label]) => ({ value, label }))];
};

export const playerVsPlayerModule = defineShareModule<PlayerVsPlayerSettings, PlayerVsPlayerData>({
  /* Observed, not market-observation: the stats are results, and hand-picked posts are not a market. */
  id: "player-vs-player", title: "Player vs Player", summary: "Two players on one basis and strength, beside any reviewed Reddit or X posts. Never a consensus.", group: "comparison", basis: "observed",
  suggestedUse: "Works when a comparison is already being argued about.",
  fields: [
    { id: "pair", label: "Sourced pair", kind: "select", default: NONE, options: pairOptions() },
    { id: "playerA", label: "Player A NHL id", kind: "number", default: null, min: 1, max: 99999999, step: 1 },
    { id: "playerB", label: "Player B NHL id", kind: "number", default: null, min: 1, max: 99999999, step: 1 },
    { id: "window", label: "Window", kind: "select", default: "l10", options: (["l5", "l10", "std"] as const).map(value => ({ value, label: PVP_WINDOW_LABELS[value] })) },
    { id: "basis", label: "Basis", kind: "select", default: "per-game", options: (["per-game", "per-60", "total"] as const).map(value => ({ value, label: PVP_BASIS_LABELS[value] })) },
    { id: "strength", label: "Strength", kind: "select", default: "all", options: (["all", "pp"] as const).map(value => ({ value, label: PVP_STRENGTH_LABELS[value] })) },
    { id: "minCoverage", label: "Min NST coverage %", kind: "number", default: 90, min: 50, max: 100, step: 1 },
  ],
  validate: validatePlayerVsPlayer,
  load: () => import("./playerVsPlayer.sources").then(sources => sources.loadPlayerVsPlayer),
  card: () => import("components/SocialShare/modules/PlayerVsPlayerCard").then(card => card.default),
  hasRows: pvpHasRows,
  altText: (snapshot, data) => pvpAltText(data, snapshot.evidence.sample),
});
