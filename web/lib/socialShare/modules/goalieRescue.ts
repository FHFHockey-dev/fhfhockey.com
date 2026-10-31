import { GOALIE_WINDOW_OPTIONS, goalieWindows, ledgerCoverage, windowLabel, type GoalieWindowKey } from "./busyQuiet";
import { defineShareModule, type SharePostLoadResult } from "./contract";
import { competitionRanks, ownershipInRange, ownershipLabel, ownershipOf, pooledGaa, pooledSavePct, type OwnershipState } from "./shared/definitions";
import type { CompletedTeamGame, GoalieAppearance } from "./shared/goalieLedger";

/**
 * Goalie Category Rescue (SS 10.0, SS-R13). Win support, save volume and ratio exposure are separate columns and only
 * one category orders the list at a time. There is deliberately no combined score: these lenses are correlated.
 */
export type RescueCategory = "wins" | "saves" | "savePct" | "gaa";
export const RESCUE_CATEGORY_OPTIONS = [{ value: "wins", label: "Wins" }, { value: "saves", label: "Saves" }, { value: "savePct", label: "SV%" }, { value: "gaa", label: "GAA" }] as const;
export type GoalieRescueSettings = { category: RescueCategory; window: GoalieWindowKey; ownershipCeiling: number; includeUnknown: "off" | "on"; minStarts: number };

/** Fills the card's 860px body. Ties may run past the size; the hard cap keeps them from clipping, and the sample names any left out. */
export const RESCUE_LIST_SIZE = 20;
const RESCUE_MAX_ROWS = 30;
/** Same rule as the pickup cards: anything but healthy or day to day is not a candidate. */
const AVAILABLE_STATUSES = new Set(["", "DTD"]);
export const RESCUE_NOTE = "Rostered % is Yahoo-wide. GMS LEFT are team games, not starts.";

export type YahooGoalieRow = { player_key: string; player_id: string | null; percent_ownership: number | null; status: string | null; last_updated: string | null };
export type YahooMapRow = { yahoo_player_id: string | null; nhl_player_id: string | null };
export const YAHOO_GOALIE_COLUMNS = "player_key,player_id,percent_ownership,status,last_updated";
export type ScheduledGame = { date: string; homeTeamId: number; awayTeamId: number };

export type GoalieAvailability = { ownership: OwnershipState; status: string };
/** Yahoo joins only through the map. A Yahoo id with two NHL ids, or an NHL id claimed twice, is dropped to unknown. */
export function goalieAvailability(yahoo: readonly YahooGoalieRow[], map: readonly YahooMapRow[]): Map<number, GoalieAvailability> {
  const nhlIds = new Map<string, Set<number>>();
  for (const row of map) {
    const id = Number(row.nhl_player_id);
    if (row.yahoo_player_id && Number.isSafeInteger(id) && id > 0) nhlIds.set(row.yahoo_player_id, (nhlIds.get(row.yahoo_player_id) ?? new Set()).add(id));
  }
  const byGoalie = new Map<number, GoalieAvailability | null>();
  for (const row of yahoo) {
    const ids = new Set([...(nhlIds.get(row.player_key) ?? []), ...(row.player_id ? nhlIds.get(row.player_id) ?? [] : [])]);
    if (ids.size !== 1) continue;
    const [id] = ids;
    byGoalie.set(id, byGoalie.has(id) ? null : { ownership: ownershipOf(row.percent_ownership, row.last_updated?.slice(0, 10) ?? null), status: row.status ?? "" });
  }
  return new Map([...byGoalie].flatMap(([id, entry]) => entry ? [[id, entry] as const] : []));
}
const UNKNOWN_AVAILABILITY: GoalieAvailability = { ownership: ownershipOf(null), status: "" };

export type RescueRow = {
  goalieId: number; name: string | null; team: string; rank: number; ownership: OwnershipState; status: string;
  appearances: number; requested: number | null; short: boolean; starts: number; relief: number;
  /** Win support. */ wins: number | null;
  /** Save volume, with shots against as its context. */ saves: number | null; shotsAgainst: number | null;
  /** Ratio exposure, pooled from the summed parts. */ goalsAgainst: number | null; toiSeconds: number | null; savePct: number | null; gaa: number | null;
  /** Team of the latest appearance, today through Sunday. Null when that team is unknown to the schedule read. */ teamGamesLeft: number | null;
};
export type RescueData = { category: RescueCategory; window: GoalieWindowKey; through: string; weekEnd: string; rows: RescueRow[]; qualified: number; aboveCeiling: number; unknownExcluded: number; unavailableStatus: number; unranked: number };

const sumOrNull = (values: readonly (number | null)[]) => values.some(value => value === null) ? null : values.reduce<number>((total, value) => total + value!, 0);
const categoryValue = (row: Omit<RescueRow, "rank">, category: RescueCategory) => row[category];

export function buildGoalieRescue(input: {
  settings: GoalieRescueSettings; appearances: readonly GoalieAppearance[]; teamGames: readonly CompletedTeamGame[]; scheduledDates: readonly string[];
  availability: ReadonlyMap<number, GoalieAvailability>; ownershipAsOf: string | null; ownershipFresh: boolean; teamGamesLeft: ReadonlyMap<string, number>; through: string; weekEnd: string;
}): SharePostLoadResult<RescueData> {
  const { settings } = input;
  const windows = goalieWindows(input.appearances, settings.window), qualified = windows.filter(window => window.starts >= settings.minStarts);
  const since = qualified.reduce<string | null>((oldest, window) => !oldest || window.firstDate < oldest ? window.firstDate : oldest, null);
  const ledger = ledgerCoverage({ scheduledDates: input.scheduledDates, teamGames: input.teamGames, appearances: input.appearances, since });
  let aboveCeiling = 0, unknownExcluded = 0, unavailableStatus = 0;
  const candidates = qualified.flatMap(window => {
    const { ownership, status } = input.availability.get(window.goalieId) ?? UNKNOWN_AVAILABILITY;
    if (!AVAILABLE_STATUSES.has(status)) { unavailableStatus++; return []; }
    if (!ownershipInRange(ownership, 0, settings.ownershipCeiling, settings.includeUnknown === "on")) { if (ownership.state === "known") aboveCeiling++; else unknownExcluded++; return []; }
    const saves = sumOrNull(window.rows.map(row => row.saves)), shotsAgainst = sumOrNull(window.rows.map(row => row.shotsAgainst)), goalsAgainst = sumOrNull(window.rows.map(row => row.goalsAgainst)), toiSeconds = sumOrNull(window.rows.map(row => row.toiSeconds));
    return [{ goalieId: window.goalieId, name: window.name, team: window.team, ownership, status, appearances: window.actual, requested: window.requested, short: window.short, starts: window.starts, relief: window.relief,
      wins: sumOrNull(window.rows.map(row => row.wins)), saves, shotsAgainst, goalsAgainst, toiSeconds, savePct: pooledSavePct(saves, shotsAgainst), gaa: pooledGaa(goalsAgainst, toiSeconds), teamGamesLeft: input.teamGamesLeft.get(window.team) ?? null }];
  });
  const ranked = competitionRanks(candidates, row => categoryValue(row, settings.category), row => row.goalieId, settings.category === "gaa" ? "low" : "high");
  const listed = ranked.filter(entry => entry.rank <= RESCUE_LIST_SIZE).map(({ row, rank }): RescueRow => ({ ...row, rank }));
  const rows = listed.slice(0, RESCUE_MAX_ROWS), tiedOut = listed.length - rows.length;
  const unranked = candidates.length - ranked.length;
  const reasons = [...ledger.reasons, ...(unranked ? [`${unranked} candidates have no recorded value for this category and are unranked.`] : []), ...(input.ownershipFresh ? [] : [`Yahoo ownership was last observed ${input.ownershipAsOf ?? "at an unknown date"}, older than yesterday.`])];
  const complete = reasons.length === 0, asOf = input.appearances[input.appearances.length - 1]?.date ?? null;
  return {
    state: complete ? "ready" : "partial", reasons, teams: [...new Set(rows.map(row => row.team))],
    data: { category: settings.category, window: settings.window, through: input.through, weekEnd: input.weekEnd, rows, qualified: qualified.length, aboveCeiling, unknownExcluded, unavailableStatus, unranked },
    evidence: {
      sources: [
        { name: "NHL.com goalie and team game stats", tables: ["wgo_goalie_stats", "wgo_team_stats"], state: ledger.complete ? "ready" : "partial", asOf, updatedAt: null, reasons: ledger.reasons },
        { name: "Yahoo rostered %", tables: ["yahoo_players", "yahoo_nhl_player_map_read"], state: input.ownershipFresh ? "ready" : "stale", asOf: input.ownershipAsOf, updatedAt: null, reasons: ["Candidate availability is Yahoo-wide rostered %, never a league's own roster."] },
        { name: "NHL schedule", tables: ["games"], state: "ready", asOf: input.weekEnd, updatedAt: null },
      ],
      sample: `${windowLabel(settings.window)} through ${input.through}: ${candidates.length} candidates, ${candidates.reduce((total, row) => total + row.starts, 0)} starts, ${candidates.reduce((total, row) => total + row.relief, 0)} relief. Win support: W. Volume: SV, with SA as context. Ratio exposure: SV%, GA, GAA, pooled. One selected category orders the list. Team games left run through ${input.weekEnd}.${tiedOut ? ` ${tiedOut} more tied ${tiedOut === 1 ? "goalie is" : "goalies are"} not listed.` : ""}`,
      strength: "All situations",
      cohort: `${candidates.length} of ${qualified.length} goalies with at least ${settings.minStarts} official starts at or under ${settings.ownershipCeiling}% rostered${settings.includeUnknown === "on" ? ", unknown ownership included" : `; ${unknownExcluded} unknown ownership excluded`}; ${aboveCeiling} above the ceiling; ${unavailableStatus} excluded by Yahoo status`,
      coverage: ledger.coverage,
    },
  };
}

export const formatSavePct = (value: number | null) => value === null ? "—" : value.toFixed(3).replace(/^0/, "");
export const formatGaa = (value: number | null) => value === null ? "—" : value.toFixed(2);
export const formatRescueValue = (row: Pick<RescueRow, RescueCategory>, category: RescueCategory) => category === "savePct" ? formatSavePct(row.savePct) : category === "gaa" ? formatGaa(row.gaa) : row[category] ?? "—";
const categoryLabel = (category: RescueCategory) => RESCUE_CATEGORY_OPTIONS.find(option => option.value === category)!.label;

export const goalieRescueModule = defineShareModule<GoalieRescueSettings, RescueData>({
  id: "goalie-rescue", title: "Goalie Category Rescue", summary: "Lower-rostered goalies by one category: wins, saves, SV% or GAA, never blended.", group: "goalies", basis: "observed",
  suggestedUse: "Works for a Thursday or Friday post.",
  fields: [
    { id: "category", label: "Category", kind: "select", default: "wins", options: RESCUE_CATEGORY_OPTIONS },
    { id: "window", label: "Window", kind: "select", default: "l10", options: GOALIE_WINDOW_OPTIONS },
    { id: "ownershipCeiling", label: "Ownership ceiling %", kind: "number", default: 50, min: 0, max: 100, step: 1 },
    { id: "includeUnknown", label: "Include unknown ownership", kind: "select", default: "off", options: [{ value: "off", label: "Off" }, { value: "on", label: "On" }] },
    { id: "minStarts", label: "Min starts in window", kind: "number", default: 3, min: 1, max: 82, step: 1 },
  ],
  load: () => import("./goalieRescue.sources").then(sources => sources.loadGoalieRescue),
  card: () => import("components/SocialShare/modules/GoalieRescueCard").then(card => card.default),
  hasRows: data => data.rows.length > 0,
  altText: (snapshot, data) => `FHFH goalie category rescue by ${categoryLabel(data.category)}, ${windowLabel(data.window)} through ${data.through}. ${data.rows.map(row => `${row.rank}. ${row.name ?? `Goalie ${row.goalieId}`} (${row.team}): ${formatRescueValue(row, data.category)}, ${ownershipLabel(row.ownership)} rostered`).join("; ")}. ${snapshot.evidence.cohort}.`,
});
