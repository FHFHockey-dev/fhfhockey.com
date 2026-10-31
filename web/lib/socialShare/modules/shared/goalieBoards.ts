/** Best and Worst side by side, shared by the goalie posts. A goalie's rank comes from the post's own method; this only lays out and scales. */
export const BOARD_ROWS = 5;
export type BoardChoice = "both" | "best" | "worst";
export const BOARD_FIELD_OPTIONS = [{ value: "both", label: "Best and Worst" }, { value: "best", label: "Best only" }, { value: "worst", label: "Worst only" }];
export const boardChoice = (value: string): BoardChoice => value === "best" || value === "worst" ? value : "both";

export type BoardEntry<Row> = { row: Row; rank: number };
export type BoardSide<Row> = {
  kind: "best" | "worst"; entries: BoardEntry<Row>[];
  /** Ranked goalies left off this side, and those among them who share the last shown rank. */
  notShown: number; moreTied: number;
};
export type BoardRanks<Row> = { id: (row: Row) => number; best: (row: Row) => number | null; worst: (row: Row) => number | null };
function side<Row>(kind: "best" | "worst", rows: readonly Row[], rank: (row: Row) => number | null, id: (row: Row) => number, shown: number): BoardSide<Row> {
  const ranked = rows.flatMap(row => { const value = rank(row); return value === null ? [] : [{ row, rank: value }]; }).sort((a, b) => a.rank - b.rank || id(a.row) - id(b.row));
  const entries = ranked.slice(0, shown), last = entries[entries.length - 1]?.rank;
  return { kind, entries, notShown: ranked.length - entries.length, moreTied: ranked.slice(shown).filter(entry => entry.rank === last).length };
}
/** The chosen sides, and any goalie on both, which a small pool makes possible and the card must say. */
export function boardSides<Row>(rows: readonly Row[], ranks: BoardRanks<Row>, choice: BoardChoice, shown = BOARD_ROWS) {
  const sides = (["best", "worst"] as const).filter(kind => choice === "both" || choice === kind).map(kind => side(kind, rows, ranks[kind], ranks.id, shown));
  const seen = sides.length === 2 ? new Set(sides[0].entries.map(entry => ranks.id(entry.row))) : new Set<number>();
  const onBoth = sides.length === 2 ? sides[1].entries.filter(entry => seen.has(ranks.id(entry.row))).map(entry => entry.row) : [];
  return { sides, onBoth };
}
export const bothSidesNote = (onBoth: number, ranked: number) => onBoth ? `Only ${ranked} goalie${ranked === 1 ? "" : "s"} qualified, so ${onBoth} appear${onBoth === 1 ? "s" : ""} on both sides.` : "";

export type HeatTone = "better" | "worse" | "level" | "none";
/** Colour strength by size against the largest shown value. Sign sets the colour, so a good goalie in a small Worst column stays green. */
export function heatLevel(value: number | null, largest: number): { tone: HeatTone; alpha: number } {
  if (value === null) return { tone: "none", alpha: 0 };
  if (value === 0 || largest <= 0) return { tone: "level", alpha: 0 };
  return { tone: value > 0 ? "better" : "worse", alpha: Math.round((0.2 + 0.6 * Math.min(1, Math.abs(value) / largest)) * 100) / 100 };
}
export const largestShown = <Row>(sides: readonly BoardSide<Row>[], value: (row: Row) => number | null) => Math.max(0, ...sides.flatMap(entry => entry.entries.map(({ row }) => Math.abs(value(row) ?? 0))));
