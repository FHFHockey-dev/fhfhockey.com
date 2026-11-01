import { GOALIE_PERIOD_CONTROL, GOALIE_PERIOD_FIELDS, goalieDatesLine, goalieShortDate, goalieWindows, ledgerCoverage, MIN_STARTS_RANGE_RULE, rangeLedger, validateGoaliePeriodChoice, type GoalieDateRange, type GoalieWindowKey } from "./busyQuiet";
import { defineShareModule, type SharePostLoadResult } from "./contract";
import { competitionRanks, ownershipInRange, ownershipLabel, ownershipOf, pooledGaa, pooledSavePct, type OwnershipState } from "./shared/definitions";
import type { CompletedTeamGame, GoalieAppearance } from "./shared/goalieLedger";
import type { PeriodWindowSettings } from "./shared/periodWindow";

/**
 * Goalie Category Rescue (SS 10.0, SS-R13). Win support, save volume and ratio exposure are separate columns and only
 * one category orders the list at a time. There is deliberately no combined score: these lenses are correlated.
 */
export type RescueCategory = "wins" | "saves" | "savePct" | "gaa";
export const RESCUE_CATEGORY_OPTIONS = [{ value: "wins", label: "Wins" }, { value: "saves", label: "Saves" }, { value: "savePct", label: "SV%" }, { value: "gaa", label: "GAA" }] as const;
export type GoalieRescueSettings = PeriodWindowSettings & { category: RescueCategory; window: GoalieWindowKey; ownershipCeiling: number; includeUnknown: "off" | "on"; minStarts: number };

/** Fills the card's 860px body. Ties may run past the size; the hard cap keeps them from clipping, and the sample names any left out. */
export const RESCUE_LIST_SIZE = 20;
/** (845px body - 28 legend - 40 group and column heads) / 27px minimum row. */
const RESCUE_MAX_ROWS = 28;
/** Chosen dates still under way add the GMS LEFT label, which takes the legend to a second line. */
const RESCUE_MAX_ROWS_LONG_LEGEND = 27;
/** Same rule as the pickup cards: anything but healthy or day to day is not a candidate. */
const AVAILABLE_STATUSES = new Set(["", "DTD"]);
export const RESCUE_NOTE = "Rostered % is Yahoo-wide. GMS LEFT are team games, not starts.";
/** Yahoo keeps no history here, so a past period still reads today's rostered % and status. */
export const RESCUE_PAST_NOTE = "Rostered % and status are current and Yahoo-wide, not as of these dates.";
/** GMS LEFT counts the current calendar week. Beside dates that have ended it would read as games left in them, so the card hides it there. */
export const RESCUE_LEFT_HIDDEN = "GMS LEFT is hidden: it counts the current week's games, and these dates have ended.";

export type YahooGoalieRow = { player_key: string; player_id: string | null; percent_ownership: number | null; status: string | null; last_updated: string | null };
export type YahooMapRow = { yahoo_player_id: string | null; nhl_player_id: string | null };
export const YAHOO_GOALIE_COLUMNS = "player_key,player_id,percent_ownership,status,last_updated";
export type ScheduledGame = { id: number; date: string | null; gameType: number | null; startTimeUtc: string | null; state: string | null; scheduleState: string | null; homeTeamId: number; awayTeamId: number };

export type GoalieAvailability = { ownership: OwnershipState; status: string; stale?: { lastObserved: string | null } };
/**
 * Yahoo joins only through the map. A Yahoo id with two NHL ids, or an NHL id claimed twice, is dropped to unknown.
 * Freshness is each goalie's own: a percentage last observed before `freshSince`, or undated, is unknown, so it can't qualify anyone under the ceiling.
 */
export function goalieAvailability(yahoo: readonly YahooGoalieRow[], map: readonly YahooMapRow[], freshSince: string): Map<number, GoalieAvailability> {
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
    const lastObserved = row.last_updated?.slice(0, 10) ?? null, ownership = ownershipOf(row.percent_ownership, lastObserved), stale = ownership.state === "known" && (!lastObserved || lastObserved < freshSince);
    byGoalie.set(id, byGoalie.has(id) ? null : stale ? { ownership: ownershipOf(null), status: row.status ?? "", stale: { lastObserved } } : { ownership, status: row.status ?? "" });
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
export type RescueData = { category: RescueCategory; window: GoalieWindowKey; through: string; dates: string; ranged: boolean; past: boolean; weekEnd: string; rows: RescueRow[]; qualified: number; aboveCeiling: number; unknownExcluded: number; unavailableStatus: number; unranked: number };

const sumOrNull = (values: readonly (number | null)[]) => values.some(value => value === null) ? null : values.reduce<number>((total, value) => total + value!, 0);
const categoryValue = (row: Omit<RescueRow, "rank">, category: RescueCategory) => row[category];

export function buildGoalieRescue(input: {
  settings: GoalieRescueSettings; appearances: readonly GoalieAppearance[]; teamGames: readonly CompletedTeamGame[]; scheduledDates: readonly string[];
  availability: ReadonlyMap<number, GoalieAvailability>; teamGamesLeft: ReadonlyMap<string, number | null>; scheduleReasons: readonly string[]; through: string; weekEnd: string;
  /** The chosen dates; absent for a rolling window. */
  range?: GoalieDateRange | null;
}): SharePostLoadResult<RescueData> {
  const { settings, range } = input, { appearances, teamGames, scheduledDates } = rangeLedger(input, range), past = !!range?.past, scheduleReasons = past ? [] : input.scheduleReasons;
  const windows = goalieWindows(appearances, range ? "std" : settings.window), qualified = windows.filter(window => window.starts >= settings.minStarts);
  const since = range ? range.from : qualified.reduce<string | null>((oldest, window) => !oldest || window.firstDate < oldest ? window.firstDate : oldest, null);
  const ledger = ledgerCoverage({ scheduledDates, teamGames, appearances, since });
  const dates = goalieDatesLine(settings.window, range, qualified, input.through);
  let aboveCeiling = 0, unknownExcluded = 0, unavailableStatus = 0, staleOwnership = 0, oldestStale: string | null = null;
  const candidates = qualified.flatMap(window => {
    const { ownership, status, stale } = input.availability.get(window.goalieId) ?? UNKNOWN_AVAILABILITY;
    if (!AVAILABLE_STATUSES.has(status)) { unavailableStatus++; return []; }
    if (stale) { staleOwnership++; if (stale.lastObserved && (!oldestStale || stale.lastObserved < oldestStale)) oldestStale = stale.lastObserved; }
    if (!ownershipInRange(ownership, 0, settings.ownershipCeiling, settings.includeUnknown === "on")) { if (ownership.state === "known") aboveCeiling++; else unknownExcluded++; return []; }
    const saves = sumOrNull(window.rows.map(row => row.saves)), shotsAgainst = sumOrNull(window.rows.map(row => row.shotsAgainst)), goalsAgainst = sumOrNull(window.rows.map(row => row.goalsAgainst)), toiSeconds = sumOrNull(window.rows.map(row => row.toiSeconds));
    return [{ goalieId: window.goalieId, name: window.name, team: window.team, ownership, status, appearances: window.actual, requested: window.requested, short: window.short, starts: window.starts, relief: window.relief,
      wins: sumOrNull(window.rows.map(row => row.wins)), saves, shotsAgainst, goalsAgainst, toiSeconds, savePct: pooledSavePct(saves, shotsAgainst), gaa: pooledGaa(goalsAgainst, toiSeconds), teamGamesLeft: past ? null : input.teamGamesLeft.get(window.team) ?? null }];
  });
  const ranked = competitionRanks(candidates, row => categoryValue(row, settings.category), row => row.goalieId, settings.category === "gaa" ? "low" : "high");
  const listed = ranked.filter(entry => entry.rank <= RESCUE_LIST_SIZE).map(({ row, rank }): RescueRow => ({ ...row, rank }));
  const rows = listed.slice(0, range && !past ? RESCUE_MAX_ROWS_LONG_LEGEND : RESCUE_MAX_ROWS), tiedOut = listed.length - rows.length;
  const unranked = candidates.length - ranked.length;
  const admittedDates = candidates.flatMap(row => row.ownership.state === "known" && row.ownership.asOf ? [row.ownership.asOf] : []).sort(), oldestAdmitted = admittedDates[0] ?? null, newestAdmitted = admittedDates[admittedDates.length - 1] ?? null;
  const ownershipReasons = [
    ...(staleOwnership ? [`${staleOwnership === 1 ? "1 goalie's" : `${staleOwnership} goalies'`} Yahoo ownership is older than ${input.through}${oldestStale ? `, the oldest from ${oldestStale}` : ""}: treated as unknown and ${settings.includeUnknown === "on" ? "shown as a dash" : "excluded"}.`] : []),
    ...(input.availability.size ? [] : ["No Yahoo goalie ownership could be read."]),
  ];
  const reasons = [...ledger.reasons, ...(unranked ? [`${unranked} candidates have no recorded value for this category and are unranked.`] : []), ...ownershipReasons, ...scheduleReasons];
  const complete = reasons.length === 0, asOf = appearances[appearances.length - 1]?.date ?? null;
  return {
    state: complete ? "ready" : "partial", reasons, teams: [...new Set(rows.map(row => row.team))],
    data: { category: settings.category, window: settings.window, through: input.through, dates, ranged: !!range, past, weekEnd: input.weekEnd, rows, qualified: qualified.length, aboveCeiling, unknownExcluded, unavailableStatus, unranked },
    evidence: {
      sources: [
        { name: "NHL.com goalie and team game stats", tables: ["wgo_goalie_stats", "wgo_team_stats"], state: ledger.complete ? "ready" : "partial", asOf, updatedAt: null, reasons: ledger.reasons },
        { name: "Yahoo rostered %", tables: ["yahoo_players", "yahoo_nhl_player_map_read"], state: ownershipReasons.length ? "stale" : "ready", asOf: oldestAdmitted, updatedAt: null, reasons: ["Candidate availability is Yahoo-wide rostered %, never a league's own roster.", ...(oldestAdmitted ? [`Listed ownership was last observed ${oldestAdmitted === newestAdmitted ? oldestAdmitted : `${oldestAdmitted} at the oldest, ${newestAdmitted} at the newest`}.`] : []), ...(past ? [RESCUE_PAST_NOTE] : []), ...ownershipReasons] },
        { name: "NHL schedule", tables: ["api-web.nhle.com/v1/schedule", "games"], state: scheduleReasons.length ? "partial" : "ready", asOf: input.weekEnd, updatedAt: null, reasons: past ? [RESCUE_LEFT_HIDDEN] : [...scheduleReasons] },
      ],
      sample: `${dates}: ${candidates.length} candidates, ${candidates.reduce((total, row) => total + row.starts, 0)} starts, ${candidates.reduce((total, row) => total + row.relief, 0)} relief. Win support: W. Volume: SV, with SA as context. Ratio exposure: SV%, GA, GAA, pooled. One selected category orders the list. ${past ? RESCUE_LEFT_HIDDEN : `Team games left run through ${input.weekEnd} and count games not yet started or in progress at generation; a finished game drops out.`}${range ? ` ${MIN_STARTS_RANGE_RULE}` : ""}${tiedOut ? ` ${tiedOut} more tied ${tiedOut === 1 ? "goalie is" : "goalies are"} not listed.` : ""}`,
      strength: "All situations",
      cohort: `${candidates.length} of ${qualified.length} goalies with at least ${settings.minStarts} official starts${range ? " in these dates" : ""} at or under ${settings.ownershipCeiling}% rostered${past ? " now" : ""}${settings.includeUnknown === "on" ? ", unknown ownership included" : `; ${unknownExcluded} unknown ownership excluded`}; ${aboveCeiling} above the ceiling; ${unavailableStatus} excluded by Yahoo status`,
      coverage: ledger.coverage,
    },
  };
}

/** The card's one legend line, past periods apart: the dates, and what is current rather than of those dates. */
export const rescueNote = (data: Pick<RescueData, "dates" | "ranged" | "past" | "weekEnd">) => data.past ? `${RESCUE_PAST_NOTE} ${data.dates}.` : `${RESCUE_NOTE} ${data.dates}.${data.ranged ? ` GMS LEFT count the current week, through ${goalieShortDate(data.weekEnd)}.` : ""}`;

export const formatSavePct = (value: number | null) => value === null ? "—" : value.toFixed(3).replace(/^0/, "");
export const formatGaa = (value: number | null) => value === null ? "—" : value.toFixed(2);
export const formatRescueValue = (row: Pick<RescueRow, RescueCategory>, category: RescueCategory) => category === "savePct" ? formatSavePct(row.savePct) : category === "gaa" ? formatGaa(row.gaa) : row[category] ?? "—";

/** The card's three lenses, never blended. `better` sets which end reads as better; SA is context with no such end, so it stays unshaded. */
export type RescueColumnId = RescueCategory | "shotsAgainst" | "goalsAgainst";
export type RescueColumn = { id: RescueColumnId; label: string; better: "high" | "low" | null };
export const RESCUE_GROUPS: readonly { id: string; label: string; columns: readonly RescueColumn[] }[] = [
  { id: "wins", label: "Wins", columns: [{ id: "wins", label: "W", better: "high" }] },
  { id: "volume", label: "Volume", columns: [{ id: "saves", label: "SV", better: "high" }, { id: "shotsAgainst", label: "SA", better: null }] },
  { id: "ratios", label: "Ratios", columns: [{ id: "savePct", label: "SV%", better: "high" }, { id: "goalsAgainst", label: "GA", better: "low" }, { id: "gaa", label: "GAA", better: "low" }] },
];
export type RescueShade = { tone: "better" | "worse" | "level" | "none"; goodness: number | null; alpha: number };
/** Each column on its own, over the goalies listed: goodness 1 is the best end whichever way the stat runs, so a low GAA reads like a high SV%. */
export function cellShade(value: number | null, rows: readonly RescueRow[], column: RescueColumn): RescueShade {
  if (value === null || column.better === null) return { tone: "none", goodness: null, alpha: 0 };
  const known = rows.flatMap(row => row[column.id] ?? []), low = Math.min(...known), high = Math.max(...known);
  if (high === low) return { tone: "level", goodness: 0.5, alpha: 0 };
  const position = (value - low) / (high - low), goodness = column.better === "low" ? 1 - position : position;
  if (goodness === 0.5) return { tone: "level", goodness, alpha: 0 };
  return { tone: goodness > 0.5 ? "better" : "worse", goodness, alpha: Math.round((0.16 + 0.54 * Math.abs(goodness - 0.5) * 2) * 100) / 100 };
}
const categoryLabel = (category: RescueCategory) => RESCUE_CATEGORY_OPTIONS.find(option => option.value === category)!.label;

export const goalieRescueModule = defineShareModule<GoalieRescueSettings, RescueData>({
  id: "goalie-rescue", title: "Goalie Category Rescue", summary: "Lower-rostered goalies by one category: wins, saves, SV% or GAA, never blended.", group: "goalies", basis: "observed",
  suggestedUse: "Works for a Thursday or Friday post.",
  fields: [
    { id: "category", label: "Category", kind: "select", default: "wins", options: RESCUE_CATEGORY_OPTIONS },
    ...GOALIE_PERIOD_FIELDS,
    { id: "ownershipCeiling", label: "Ownership ceiling %", kind: "number", default: 50, min: 0, max: 100, step: 1 },
    { id: "includeUnknown", label: "Include unknown ownership", kind: "select", default: "off", options: [{ value: "off", label: "Off" }, { value: "on", label: "On" }] },
    { id: "minStarts", label: "Min starts in period", kind: "number", default: 3, min: 1, max: 82, step: 1 },
  ],
  periodControl: GOALIE_PERIOD_CONTROL,
  validate: validateGoaliePeriodChoice,
  load: () => import("./goalieRescue.sources").then(sources => sources.loadGoalieRescue),
  card: () => import("components/SocialShare/modules/GoalieRescueCard").then(card => card.default),
  hasRows: data => data.rows.length > 0,
  altText: (snapshot, data) => `FHFH goalie category rescue by ${categoryLabel(data.category)}, ${data.dates}.${data.past ? ` ${RESCUE_PAST_NOTE}` : ""} ${data.rows.map(row => `${row.rank}. ${row.name ?? `Goalie ${row.goalieId}`} (${row.team}): ${formatRescueValue(row, data.category)}, ${ownershipLabel(row.ownership)} rostered`).join("; ")}. ${snapshot.evidence.cohort}.`,
});
