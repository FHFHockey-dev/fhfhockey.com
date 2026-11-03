import { UNKNOWN_EVIDENCE, defineShareModule, type SharePostEvidence, type SharePostLoadResult, type SharePostSource } from "./contract";
import { periodDates } from "./shared/periodWindow";
import type { GoalieConfirmation, GoalieGameSignals, GoalieInventory, InventoryMetric } from "./shared/goalieInventory";
import { confirmationLegend, inventoryEvidence, TREND_GAMES, WEAKER_OPPONENT_SOURCE, inventoryPeriodFields, inventoryPeriodReason, INVENTORY_PERIOD_CONTROL, isUpcomingGame, noUpcomingEvidence, periodLine, periodSources, type InventoryPeriod, type InventoryPeriodSettings, headToHeadWinner, metricLabel, puckDropTtlSeconds, rankBand, rankedSide, type GoalieInventoryDetail, type InventoryBackToBack, type InventoryConflict, type InventoryLowFirstRanks, type RankedSide, type TeamLensMetric } from "./shared/goalieInventory.sources";

/**
 * Risky Starts (SS 11.0, SS-R14) mirrors Cherry-Picked Matchups from the goalie's chair: one tile per team-night, a pairing
 * of the opponent's rate against this team's, flagged when both sit in the league's top third. Each lens is read alone.
 */
export const RISKY_LENSES = ["volume", "ratio", "win"] as const;
export type RiskyLens = typeof RISKY_LENSES[number];
export const RISKY_LENS_LABELS: Record<RiskyLens, string> = { volume: "Volume upside", ratio: "Ratio exposure", win: "Win support" };
const LENS_MEANINGS: Record<RiskyLens, string> = { volume: "more shots to save", ratio: "more danger against", win: "goals in the goalie's favor" };
export const RISKY_CORRELATION_NOTE = "These signals are correlated: shots, xG and chances overlap, and penalties feed all three. Each lens stands alone, flags are never added across lenses, and no win or start odds are given.";
export const RISKY_TILE_LIMIT = 8;

export type RiskyStartsSettings = InventoryPeriodSettings & { lens: RiskyLens };
export type RiskySide = RankedSide & { team: string; label: string; digits: number };
/** `winner` is the team with the stronger rank, null when equal, missing or one-sided. */
export type RiskyPair = { id: string; label: string; sides: RiskySide[]; flagged: boolean; winner: string | null };
export type RiskyGoalie = { goalieId: number; name: string; starts: number | null; teamGames: number; confirmation: GoalieConfirmation; role: GoalieRole };
export type GoalieRoleKind = "confirmed" | "projected" | "backup" | "backup-projected" | "conflicting" | "b2b" | "likely-starter" | "likely-backup" | "split";
/** What the tile prints for one goalie. `handle` is the reporting account, only when a report names one. */
export type GoalieRole = { kind: GoalieRoleKind; label: string; handle: string | null };
/** A goalie's decisions against one opponent, this season and last, by `goalieId:opponent`. */
export type OpponentRecord = { wins: number; losses: number; otLosses: number };
export type RoleContext = { backToBacks?: Readonly<Record<string, InventoryBackToBack>>; recentTrend?: Readonly<Record<string, number>>; records?: Readonly<Record<string, OpponentRecord>> };
/** Pipeline keys that name no account. The resolver falls back to these when a report has no `source_account`. */
const PIPELINE_SOURCES: ReadonlySet<string> = new Set(["validated_events"]);
export const sourceHandle = (confirmation: GoalieConfirmation) => confirmation.state === "none" || PIPELINE_SOURCES.has(confirmation.source) || !/^@?\w{1,15}$/.test(confirmation.source) ? null : `@${confirmation.source.replace(/^@/, "")}`;
export const ROLE_PICK_NOTE = `Goalie labels: a source's report for this game shows as Projected or Confirmed, and the other goalie as Backup. With no report, Likely Starter has the most starts in the team's last 10 games; a tie goes to the most starts in its last ${TREND_GAMES}, then the better win share in decisions against this opponent, this season and last (NHL.com goalie game stats). Split means still tied. In a back-to-back, when this game is against the weaker opponent by ${WEAKER_OPPONENT_SOURCE}, both goalies show which game of the back-to-back it is instead. A source's account shows only when its report names one.`;
export const RISKY_READING_NOTE = "Reading the card: blue marks a flagged pairing, a longer bar is the stronger side, and 1ST is the league's highest value. Moneylines and totals are DraftKings market lines, shown only when one exists.";
const winShare = (record: OpponentRecord | undefined) => { const decisions = record ? record.wins + record.losses + record.otLosses : 0; return decisions ? record!.wins / decisions : null; };
/** The likely starter with no report: most L10 starts, then most recent starts, then the better record against this opponent. Null while still tied. */
export function likelyStarter(goalies: readonly Pick<RiskyGoalie, "goalieId" | "starts">[], team: string, opponent: string, { recentTrend = {}, records = {} }: RoleContext) {
  const top = <T>(pool: readonly T[], score: (item: T) => number | null) => { const known = pool.flatMap(item => { const value = score(item); return value === null ? [] : [{ item, value }]; }); const best = Math.max(...known.map(entry => entry.value)); return known.length === pool.length ? known.filter(entry => entry.value === best).map(entry => entry.item) : pool; };
  let pool = top(goalies, goalie => goalie.starts);
  if (pool.length > 1) pool = top(pool, goalie => recentTrend[`${team}:${goalie.goalieId}`] ?? null);
  if (pool.length > 1) pool = top(pool, goalie => winShare(records[`${goalie.goalieId}:${opponent}`]));
  return pool.length === 1 && goalies.length > 0 ? pool[0].goalieId : null;
}
/** A source's report for this exact game wins; then the back-to-back rule; then the likely starter. */
export function goalieRoles(row: Pick<RiskyRow, "gameId" | "team" | "opponent" | "conflicting">, goalies: readonly Omit<RiskyGoalie, "role">[], context: RoleContext): Map<number, GoalieRole> {
  const all = (role: GoalieRole) => new Map(goalies.map(goalie => [goalie.goalieId, role]));
  if (row.conflicting) return all({ kind: "conflicting", label: "Conflicting reports", handle: null });
  const reported = goalies.find(goalie => goalie.confirmation.state !== "none");
  if (reported) {
    const confirmed = reported.confirmation.state === "confirmed";
    return new Map(goalies.map(goalie => [goalie.goalieId, goalie === reported ? { kind: confirmed ? "confirmed" : "projected", label: confirmed ? "CONFIRMED" : "PROJECTED", handle: sourceHandle(goalie.confirmation) } : { kind: confirmed ? "backup" : "backup-projected", label: confirmed ? "Backup" : "Backup (Projected)", handle: null }]));
  }
  const b2b = context.backToBacks?.[`${row.gameId}:${row.team}`];
  if (b2b?.weakerOpponent) return all({ kind: "b2b", label: `${b2b.order === 1 ? "1st" : "2nd"} game of a B2B`, handle: null });
  const pick = likelyStarter(goalies, row.team, row.opponent, context);
  return new Map(goalies.map(goalie => [goalie.goalieId, pick === null ? { kind: "split", label: "Split", handle: null } : goalie.goalieId === pick ? { kind: "likely-starter", label: "LIKELY STARTER", handle: null } : { kind: "likely-backup", label: "LIKELY BACKUP", handle: null }]));
}
/** Each label's text colour, with no fill (TJ, 2026-11-03). Each is at least 4.5:1 on the card's #1a1d21, so the PNG reads at AA. */
export const ROLE_COLORS: Record<GoalieRoleKind, string> = {
  confirmed: "#3fd17a", projected: "#3fd17a", "likely-starter": "#c6e35a", "likely-backup": "#f5b041",
  "backup-projected": "#ff7a4d", backup: "#c7d0d8", b2b: "#a9c7e0", split: "#c7d0d8", conflicting: "#f29bc4",
};
export const ROLE_CARD_BACKGROUND = "#1a1d21";
export const ROLE_HANDLE_INK = "#b8c2cc";
export type RiskyRow = { gameId: number; date: string; startTimeUtc: string | null; team: string; opponent: string; home: boolean; teamSecondNight: boolean | null; opponentSecondNight: boolean | null; conflicting: boolean; goalies: RiskyGoalie[]; lenses: Record<RiskyLens, RiskyPair[]> };
/** A market line from one source and one book, by the game's home and away teams. These are the book's prices and nothing is derived from them. */
export type RiskyGameLine = { gameId: number; source: "stored" | "nhl"; book: string; capturedAt: string; home: string; away: string; homeMoneyline: number; awayMoneyline: number; total: number | null };
export type RiskyMarketLines = { lines: Record<string, RiskyGameLine>; sources: readonly SharePostSource[]; notes: readonly string[] };
export type RiskyStartsData = { from: string; through: string; periodLabel: string; rows: RiskyRow[]; lines: Record<string, RiskyGameLine>; confirmationLegend: string };
export const moneylineLabel = (price: number) => price > 0 ? `+${price}` : `${price}`;
const BOOK_SHORT: Record<string, string> = { DraftKings: "DK" };
export const bookLabel = (book: string) => BOOK_SHORT[book] ?? book;

const topThird = (metric: InventoryMetric) => rankBand(metric) === "top";
const bottomThird = (metric: InventoryMetric) => rankBand(metric) === "bottom";

/** Every pairing for one side of a game. Mirror the two teams and each pairing's sides swap to the other team's rates. */
export function riskyPairs(team: string, opponent: string, { volume, ratioExposure: ratio, winSupport: win }: GoalieGameSignals, lowFirstRanks: InventoryLowFirstRanks): Record<RiskyLens, RiskyPair[]> {
  const pair = (id: string, label: string, flagged: boolean, ...entries: [string, string, TeamLensMetric, InventoryMetric, number][]): RiskyPair => {
    const sides = entries.map(([owner, name, metricId, metric, digits]) => ({ ...rankedSide(lowFirstRanks, owner, metricId, metric), team: owner, label: name, digits }));
    const winner = sides.length === 2 ? headToHeadWinner(sides[0], sides[1]) : null;
    return { id, label, flagged, sides, winner: winner === null ? null : sides[winner].team };
  };
  return {
    volume: [pair("shots", "Shots", topThird(volume.opponentShotsForPerGame) && topThird(volume.teamShotsAgainstPerGame), [opponent, "SF/GP", "shotsFor", volume.opponentShotsForPerGame, 1], [team, "SA/GP", "shotsAgainst", volume.teamShotsAgainstPerGame, 1])],
    ratio: [
      pair("xg", "xG", topThird(ratio.opponentXgfPerGame) && topThird(ratio.teamXgaPerGame), [opponent, "xGF/GP", "xgf", ratio.opponentXgfPerGame, 2], [team, "xGA/GP", "xga", ratio.teamXgaPerGame, 2]),
      pair("chances", "Chances", topThird(ratio.opponentScoringChancesPerGame) && topThird(ratio.teamScoringChancesAgainstPerGame), [opponent, "SCF/GP", "chancesFor", ratio.opponentScoringChancesPerGame, 1], [team, "SCA/GP", "chancesAgainst", ratio.teamScoringChancesAgainstPerGame, 1]),
      pair("special-teams", "PP v PK", topThird(ratio.opponentPowerPlayPct) && bottomThird(ratio.teamPenaltyKillPct), [opponent, "PP%", "powerPlayPct", ratio.opponentPowerPlayPct, 1], [team, "PK%", "penaltyKillPct", ratio.teamPenaltyKillPct, 1]),
      pair("penalties", "Penalties", topThird(ratio.opponentPowerPlayPct) && topThird(ratio.teamTimesShorthandedPerGame), [opponent, "PP%", "powerPlayPct", ratio.opponentPowerPlayPct, 1], [team, "TSH/GP", "timesShorthanded", ratio.teamTimesShorthandedPerGame, 1]),
    ],
    win: [
      pair("goals", "Goals", topThird(win.teamGoalsForPerGame) && topThird(win.opponentGoalsAgainstPerGame), [team, "GF/GP", "goalsFor", win.teamGoalsForPerGame, 2], [opponent, "GA/GP", "goalsAgainst", win.opponentGoalsAgainstPerGame, 2]),
      pair("differential", "Goal diff", topThird(win.teamGoalDifferentialPerGame), [team, "GD/GP", "goalDifferential", win.teamGoalDifferentialPerGame, 2]),
    ],
  };
}
export function riskyRows(inventory: GoalieInventory, conflicts: readonly InventoryConflict[], lowFirstRanks: InventoryLowFirstRanks, context: RoleContext = {}): RiskyRow[] {
  const rows = new Map<string, RiskyRow>();
  for (const goalie of inventory.goalies) for (const game of goalie.games) {
    if (!isUpcomingGame(game, inventory.generatedAt)) continue;
    const key = `${game.gameId}:${game.team}`;
    const row = rows.get(key) ?? { gameId: game.gameId, date: game.date, startTimeUtc: game.startTimeUtc, team: game.team, opponent: game.opponent, home: game.home, teamSecondNight: game.teamSecondNight, opponentSecondNight: game.opponentSecondNight, conflicting: conflicts.some(item => item.gameId === game.gameId && item.team === game.team), goalies: [], lenses: riskyPairs(game.team, game.opponent, game.signals, lowFirstRanks) };
    row.goalies.push({ goalieId: goalie.goalieId, name: goalie.name, starts: goalie.recentStarts.starts, teamGames: goalie.recentStarts.teamGames, confirmation: game.confirmation, role: { kind: "split", label: "Split", handle: null } });
    rows.set(key, row);
  }
  for (const row of rows.values()) { const roles = goalieRoles(row, row.goalies, context); for (const goalie of row.goalies) goalie.role = roles.get(goalie.goalieId)!; }
  return [...rows.values()];
}
export const riskyFlags = (row: RiskyRow, lens: RiskyLens) => row.lenses[lens].filter(pair => pair.flagged).length;
/** Team-nights with a flagged pairing in this lens alone, most flags first. Another lens never moves a row. */
export const riskyRowsForLens = (rows: readonly RiskyRow[], lens: RiskyLens) => rows.filter(row => riskyFlags(row, lens) > 0)
  .sort((a, b) => riskyFlags(b, lens) - riskyFlags(a, lens) || a.date.localeCompare(b.date) || a.gameId - b.gameId || a.team.localeCompare(b.team));
/** The game's two sides, the actual home team first. The other team's goalies come from its own row; none there leaves that side empty. */
export function riskyGameSides(rows: readonly RiskyRow[], row: RiskyRow) {
  const other = rows.find(item => item.gameId === row.gameId && item.team === row.opponent);
  const own = { team: row.team, goalies: row.goalies, conflicting: row.conflicting, subject: true }, opposing = { team: row.opponent, goalies: other?.goalies ?? [], conflicting: other?.conflicting ?? false, subject: false };
  return row.home ? { home: own, away: opposing } : { home: opposing, away: own };
}
export function ordinalRank(rank: number) {
  const tens = rank % 100;
  return `${rank}${tens >= 11 && tens <= 13 ? "TH" : ({ 1: "ST", 2: "ND", 3: "RD" } as Record<number, string>)[rank % 10] ?? "TH"}`;
}
export const riskyLensMeaning = (lens: RiskyLens) => LENS_MEANINGS[lens];

const SOURCE_PUBLISHERS: readonly (readonly [string, string])[] = [["NHL.com", "NHL.com"], ["NST", "NST"], ["Goalie start", "goalie reports"], ["DraftKings", "DraftKings"], ["Yahoo", "Yahoo"]];
const publisher = (name: string) => SOURCE_PUBLISHERS.find(([prefix]) => name.startsWith(prefix))?.[1] ?? name;
const updatedLabel = (at: string) => new Date(at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
const sourceDetail = ({ name, asOf, updatedAt }: SharePostSource) => `${name}${asOf ? ` through ${asOf}` : ""}${updatedAt ? ` (updated ${updatedLabel(updatedAt)} ET)` : ""}`;
/**
 * The shell prints `evidence.sources` on the PNG's footer, so this post files one combined source there, through the oldest
 * date any of them reaches, and spells out each source in the cohort line of the panel beside the preview. Tables and reasons carry over.
 */
export function compactRiskyEvidence(evidence: SharePostEvidence): SharePostEvidence {
  const { sources } = evidence;
  if (!sources.length) return evidence;
  const dates = sources.flatMap(source => source.asOf ? [source.asOf] : []).sort();
  return {
    ...evidence, strength: "All situations",
    cohort: `${evidence.cohort} ${evidence.strength}. Sources: ${sources.map(sourceDetail).join(" · ")}.`,
    sources: [{ name: [...new Set(sources.map(source => publisher(source.name)))].join(", "), tables: [...new Set(sources.flatMap(source => source.tables))], state: sources.some(source => source.state === "partial") ? "partial" : "ready", asOf: dates[0] ?? null, updatedAt: null, reasons: sources.flatMap(source => source.reasons ?? []) }],
  };
}
/** The detail's own role facts, which a records read adds to. */
export const roleContext = ({ backToBacks, recentTrend }: GoalieInventoryDetail, records?: RoleContext["records"]): RoleContext => ({ backToBacks, recentTrend, records });
export function riskyStartsResult(detail: GoalieInventoryDetail, market: RiskyMarketLines = { lines: {}, sources: [], notes: [] }, period?: InventoryPeriod, records?: RoleContext["records"]): SharePostLoadResult<RiskyStartsData> {
  const { inventory, coverage, conflicts, lowFirstRanks, ratesThrough, pageNotes } = detail;
  if (inventory.state === "missing") return { state: "missing", reasons: [...inventory.reasons], evidence: UNKNOWN_EVIDENCE, data: null };
  const rows = riskyRows(inventory, conflicts, lowFirstRanks, roleContext(detail, records)), cohort = rows[0]?.lenses.volume[0].sides[0].metric.leagueCohort ?? null;
  const evidence = inventoryEvidence({ inventory, coverage, ratesThrough }, `${rows.length} team-nights in the window; ranks ${cohort === null ? "withheld without a complete league" : `over all ${cohort} teams`}. ${RISKY_CORRELATION_NOTE}`, rows.length, [...market.notes, ROLE_PICK_NOTE, RISKY_READING_NOTE]);
  return {
    ...(pageNotes?.length ? { pageNotes: [...pageNotes] } : {}),
    state: inventory.state, reasons: inventory.state === "ready" ? [] : [...inventory.reasons], ttlSeconds: puckDropTtlSeconds(rows.map(row => row.startTimeUtc), inventory.generatedAt),
    data: { from: inventory.from, through: inventory.through, periodLabel: period ? periodLine(period) : periodDates(inventory.from, inventory.through), rows, lines: market.lines, confirmationLegend: confirmationLegend(inventory) },
    teams: [...new Set(rows.flatMap(row => [row.team, row.opponent]))].sort(),
    evidence: compactRiskyEvidence({ ...evidence, sources: [...evidence.sources, ...market.sources, ...period ? periodSources(period) : []] }),
  };
}
/** A period wholly past: nothing to advise on, and with no rows nothing to export. */
export const riskyStartsNoUpcoming = (period: InventoryPeriod): SharePostLoadResult<RiskyStartsData> => ({ state: "ready", reasons: [], teams: [], evidence: noUpcomingEvidence(period), data: { from: period.from, through: period.through, periodLabel: period.label, rows: [], lines: {}, confirmationLegend: "" } });

/** Only a DraftKings line prints; anything else shows nothing. */
export const shownLine = (line: RiskyGameLine | undefined) => line?.book === "DraftKings" ? line : undefined;
const lineAlt = (line: RiskyGameLine | undefined) => line ? `Market line, ${line.book}: ${line.home} ${moneylineLabel(line.homeMoneyline)}, ${line.away} ${moneylineLabel(line.awayMoneyline)}${line.total === null ? "" : `, total ${line.total}`}` : "";
export const riskyStartsModule = defineShareModule<RiskyStartsSettings, RiskyStartsData>({
  id: "risky-starts", title: "Risky Starts", summary: "Goalie matchups by volume upside, ratio exposure and win support, as three separate lenses.", group: "goalies", basis: "observed",
  suggestedUse: "Works before a busy night, or for a week's goalie planning.",
  fields: [
    ...inventoryPeriodFields(),
    { id: "lens", label: "Lens", kind: "select", default: "ratio", clientOnly: true, options: RISKY_LENSES.map(value => ({ value, label: RISKY_LENS_LABELS[value] })) },
  ],
  periodControl: INVENTORY_PERIOD_CONTROL,
  validate: inventoryPeriodReason,
  load: () => import("./riskyStarts.sources").then(sources => sources.loadRiskyStarts),
  card: () => import("components/SocialShare/modules/RiskyStartsCard").then(card => card.default),
  hasRows: (data, settings) => riskyRowsForLens(data.rows, settings.lens).length > 0,
  altText: (snapshot, data, settings) => {
    const rows = riskyRowsForLens(data.rows, settings.lens), side = (pair: RiskyPair) => `${pair.sides.map(item => `${item.team} ${item.label} ${metricLabel(item.metric, item.digits)}`).join(" against ")}${pair.winner ? `, stronger ${pair.winner}` : ""}`;
    return `FHFH Risky Starts, ${RISKY_LENS_LABELS[settings.lens]}, ${data.from} to ${data.through}. ${rows.slice(0, RISKY_TILE_LIMIT).map(row => `${row.team} ${row.home ? "vs" : "at"} ${row.opponent} on ${row.date}: ${row.lenses[settings.lens].filter(pair => pair.flagged).map(side).join("; ")}. Goalies: ${row.goalies.map(goalie => `${goalie.name}, ${goalie.role.label}${goalie.role.handle ? ` ${goalie.role.handle}` : ""}`).join(", ")}.${lineAlt(shownLine(data.lines[row.gameId])) ? ` ${lineAlt(shownLine(data.lines[row.gameId]))}.` : ""}`).join(". ")}. ${RISKY_CORRELATION_NOTE} ${snapshot.evidence.sample}.`;
  },
});
