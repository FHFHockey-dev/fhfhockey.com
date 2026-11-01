import type { ShareSettingField, ShareSettings } from "../contract";
import { defaultWeek, spanDays, toMatchupWeeks, type MatchupWeek } from "./categoryCounts";

/**
 * The shared period control: which dates a post covers, chosen as a matchup week or custom dates, or by the post's own
 * defaults. Matchup weeks run as long as `yahoo_matchup_weeks` says (14 days over a break), so nothing here assumes 7.
 */
export type PeriodMode =
  /** Results posts: a week not yet started and dates past the cutoff are refused. */
  | "past-only"
  /** Schedule posts: any week on the calendar. */
  | "any-week";
export type PeriodControl = {
  mode: PeriodMode;
  /** The `period` option meaning a matchup week. */
  matchupValue?: string;
};
export const PERIOD_MATCHUP = "matchup", PERIOD_CUSTOM = "custom";
export type PeriodWindowSettings = { period: string; week: number | null; start: string | null; end: string | null };

/** The four fields behind the control, which the studio draws itself. A post adds its own defaults as further options. */
export function periodWindowFields({ mode, options, default: chosen = PERIOD_MATCHUP }: { mode: PeriodMode; options: readonly { value: string; label: string }[]; default?: string }): ShareSettingField[] {
  return [
    { id: "period", label: "Period", kind: "select", default: chosen, options, panelOnly: true },
    { id: "week", label: `Week (blank is the ${mode === "past-only" ? "last completed" : "current"})`, kind: "number", default: null, min: 1, max: 30, step: 1, panelOnly: true },
    { id: "start", label: "Custom range start", kind: "date", default: null, panelOnly: true },
    { id: "end", label: "Custom range end", kind: "date", default: null, panelOnly: true },
  ];
}

export type MatchupRow = { week: number; start_date: string | null; end_date: string | null };
export type MatchupCalendar = { weeks: MatchupWeek[]; reasons: string[] };
/** Usable weeks from the table's rows. A row with no dates is skipped and named; overlapping dates are a reason, never a guess. */
export function matchupCalendar(rows: readonly MatchupRow[]): MatchupCalendar {
  const skipped = rows.filter(row => !row.start_date || !row.end_date).map(row => `Week ${row.week} has no dates on the matchup calendar, so it is skipped.`);
  try { return { weeks: toMatchupWeeks(rows), reasons: skipped }; }
  catch (cause) { return { weeks: [], reasons: [...skipped, cause instanceof Error ? cause.message : "Matchup weeks could not be read."] }; }
}

const SHORT = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const shortDate = (date: string) => SHORT.format(new Date(`${date}T12:00:00Z`));
/** "Oct 19 to Oct 25", with years only when the dates cross one. */
export function periodDates(from: string, through: string) {
  const year = (date: string) => from.slice(0, 4) === through.slice(0, 4) ? "" : `, ${date.slice(0, 4)}`;
  return `${shortDate(from)}${year(from)} to ${shortDate(through)}${year(through)}`;
}
export const matchupLabel = (week: MatchupWeek) => `Week ${week.week} · ${periodDates(week.start, week.end)}`;

export type PeriodWindow = {
  kind: string;
  /** The matchup week, for that kind only. */
  week: number | null;
  /** First and last date covered, both counted in `days`. */
  from: string; through: string; label: string; days: number;
};
export type PeriodWindowResult = { window: PeriodWindow; reason?: undefined } | { window?: undefined; reason: string };
/** A post's own default, such as a rolling seven days. */
export type OwnPeriod = (cutoff: string, calendar: MatchupCalendar) => Pick<PeriodWindow, "from" | "through" | "label"> | { reason: string };
export type PeriodWindowOptions = PeriodControl & {
  /** The last date with completed games, from the server. Decides what past-only allows and which week a blank means. */
  cutoff: string;
  own?: Record<string, OwnPeriod>;
};

const canPick = (week: MatchupWeek, { mode, cutoff }: Pick<PeriodWindowOptions, "mode" | "cutoff">) => mode === "any-week" || week.start <= cutoff;
/** A blank week: past-only takes the last completed, any-week the one under way, else the next, else the last. */
function blankWeek(weeks: readonly MatchupWeek[], { mode, cutoff }: Pick<PeriodWindowOptions, "mode" | "cutoff">) {
  return mode === "past-only" ? defaultWeek(weeks, cutoff) : weeks.find(week => week.end > cutoff) ?? weeks[weeks.length - 1] ?? null;
}
/** Why these dates can never be a range, needing no calendar: for a post's `validate`, so a bad range is refused before any read. */
export function customRangeReason({ start, end }: Pick<PeriodWindowSettings, "start" | "end">) {
  if (!start || !end) return "A custom range needs a start date and an end date.";
  return start >= end ? "The start date must be before the end date." : null;
}

export function resolvePeriodWindow(settings: PeriodWindowSettings, calendar: MatchupCalendar, options: PeriodWindowOptions): PeriodWindowResult {
  const { weeks } = calendar, { cutoff, mode, own, matchupValue = PERIOD_MATCHUP } = options, kind = settings.period;
  const span = (week: number | null, from: string, through: string, label: string): PeriodWindowResult => ({ window: { kind, week, from, through, label, days: spanDays(from, through) } });
  if (kind === matchupValue) {
    const week = settings.week === null ? blankWeek(weeks, options) : weeks.find(entry => entry.week === settings.week) ?? null;
    if (!week) return { reason: settings.week === null ? "No matchup week has started." : `Week ${settings.week} is not on the matchup calendar.` };
    if (!canPick(week, { mode, cutoff })) return { reason: `Week ${week.week} has not started; data runs through ${cutoff}.` };
    return span(week.week, week.start, week.end, matchupLabel(week));
  }
  if (kind === PERIOD_CUSTOM) {
    const invalid = customRangeReason(settings);
    if (invalid) return { reason: invalid };
    const start = settings.start!, end = settings.end!, first = weeks[0]?.start, last = weeks[weeks.length - 1]?.end;
    if (!first || start < first || end > last) return { reason: `The range must fall inside the season, ${first ?? "not started"} to ${last ?? "not started"}.` };
    if (mode === "past-only" && end > cutoff) return { reason: `The end date ${end} is past the last completed games, ${cutoff}.` };
    return span(null, start, end, periodDates(start, end));
  }
  const resolved = own?.[kind]?.(cutoff, calendar);
  if (!resolved) return { reason: `Period ${kind} is not available.` };
  return "reason" in resolved ? { reason: resolved.reason } : span(null, resolved.from, resolved.through, resolved.label);
}

export type MatchupPager = {
  /** The week shown; null when the URL names one that is not on the calendar. */
  current: MatchupWeek | null; label: string;
  /** Null disables that side: the end of the calendar, or a week past-only cannot open. */
  prior: MatchupWeek | null; next: MatchupWeek | null;
};
/** Prior and next walk the usable weeks, so a skipped row is stepped over and never lands on an unavailable week. */
export function matchupPager(week: number | null, { weeks }: MatchupCalendar, options: Pick<PeriodWindowOptions, "mode" | "cutoff">): MatchupPager {
  const allowed = weeks.filter(entry => canPick(entry, options));
  const current = week === null ? blankWeek(weeks, options) : weeks.find(entry => entry.week === week) ?? null;
  if (!current) return { current: null, label: week === null ? "No matchup week" : `Week ${week} is not on the calendar`, prior: allowed[allowed.length - 1] ?? null, next: null };
  return { current, label: matchupLabel(current), prior: [...allowed].reverse().find(entry => entry.start < current.start) ?? null, next: allowed.find(entry => entry.start > current.start) ?? null };
}
/** The dates a custom range can use, for the date inputs' limits. */
export const customRangeLimits = ({ weeks }: MatchupCalendar, { mode, cutoff }: Pick<PeriodWindowOptions, "mode" | "cutoff">) => {
  const last = weeks[weeks.length - 1]?.end;
  return { min: weeks[0]?.start, max: mode === "past-only" && last && cutoff < last ? cutoff : last };
};
export const periodSettings = (settings: ShareSettings): PeriodWindowSettings => ({ period: String(settings.period), week: settings.week as number | null, start: settings.start as string | null, end: settings.end as string | null });
