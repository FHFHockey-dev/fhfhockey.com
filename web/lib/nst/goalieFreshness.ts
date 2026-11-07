import { completedGoalieDate, goalieDateMillis } from "./goalieCatchup";

export type ExpectedGoalieGame = { season: string; goalieId: number; date: string };
export type NstGoalieGame = ExpectedGoalieGame & { hdShotsAgainst: number | null };
export type GoalieCheckpointProgress = {
  status: "healthy" | "warning" | "critical" | "unknown" | "disabled";
  pending: number | null;
  held: number | null;
  inFlight: number | null;
  noProgressWindows: number | null;
  lastCommitAt: string | null;
  datasets: Array<{ dataset: string; pending: number; held: number; inFlight: number; complete: number }>;
};
export type GoalieFreshness = {
  status: "healthy" | "warning" | "critical" | "unknown" | "not_due";
  checkedAt: string;
  cutoffDate: string;
  expected: number | null;
  matched: number | null;
  missing: Array<ExpectedGoalieGame & { reason: "missing_row" | "missing_hd" }>;
  oldestGap: string | null;
  latestExpectedDate: string | null;
  latestCompleteDate: string | null;
  perDate: Array<{ date: string; expected: number; matched: number }>;
  warnings: string[];
  checkpoint?: GoalieCheckpointProgress;
};

/** Evaluate supplied, completely enumerated snapshots. No database/provider
 * reads, notification delivery, repair or audit-success inference occurs here. */
export function assessGoalieFreshness(input: {
  now: Date;
  season: string;
  seasonStartDate: string;
  regularSeasonEndDate: string;
  finalGameDates: readonly string[];
  expected: readonly ExpectedGoalieGame[];
  observed: readonly NstGoalieGame[];
  calendarComplete: boolean;
  wgoComplete: boolean;
  nstComplete: boolean;
  noProgressWindows: number;
  writerAuditPresent: boolean;
  writerAuditExpected: boolean;
}): GoalieFreshness {
  const cutoffDate = [completedGoalieDate(input.now), input.regularSeasonEndDate].sort()[0];
  const cutoff = goalieDateMillis(cutoffDate);
  const seasonStart = goalieDateMillis(input.seasonStartDate);
  if (seasonStart > goalieDateMillis(input.regularSeasonEndDate)) throw new Error("Invalid goalie season bounds.");
  const floor = Math.max(seasonStart, cutoff - 13 * 86_400_000);
  const warnings = input.writerAuditPresent || !input.writerAuditExpected ? [] : ["No acknowledged goalie writer audit in the expected window."];
  const result: GoalieFreshness = { status: "unknown", checkedAt: input.now.toISOString(), cutoffDate,
    expected: null, matched: null, missing: [], oldestGap: null, latestExpectedDate: null,
    latestCompleteDate: null, perDate: [], warnings };
  const unknown = (reason: string): GoalieFreshness => ({ ...result, warnings: [...warnings, reason] });
  if (!/^\d{8}$/.test(input.season)) return unknown("Goalie season is invalid.");
  if (!input.calendarComplete || !input.wgoComplete || !input.nstComplete) {
    return unknown("Calendar, WGO or NST enumeration is incomplete; coverage is unknown.");
  }
  if (!Number.isSafeInteger(input.noProgressWindows) || input.noProgressWindows < 0) return unknown("Progress observation is invalid.");
  const inWindow = (date: string) => { const ms = goalieDateMillis(date); return ms >= floor && ms <= cutoff; };
  const finalDates = new Set(input.finalGameDates.filter(inWindow));
  const key = (row: ExpectedGoalieGame) => `${row.season}/${row.date}/${row.goalieId}`;
  const expected = new Map<string, ExpectedGoalieGame>();
  for (const row of input.expected) {
    if (row.season !== input.season || !inWindow(row.date)) continue;
    if (!Number.isSafeInteger(row.goalieId) || row.goalieId <= 0 || !finalDates.has(row.date)) {
      return unknown("WGO identity/date conflicts with the final-game calendar.");
    }
    expected.set(key(row), row);
  }
  if ([...finalDates].some(date => ![...expected.values()].some(row => row.date === date))) {
    return unknown("WGO has no goalie appearances for a final-game date.");
  }
  const observed = new Map<string, NstGoalieGame>();
  for (const row of input.observed) {
    if (row.season !== input.season || !inWindow(row.date)) continue;
    const previous = observed.get(key(row));
    if (previous && previous.hdShotsAgainst !== row.hdShotsAgainst) return unknown("NST duplicate observations disagree.");
    if (row.hdShotsAgainst !== null && (!Number.isFinite(row.hdShotsAgainst) || row.hdShotsAgainst < 0)) {
      return unknown("NST HD observation is invalid.");
    }
    observed.set(key(row), row);
  }
  const perDate = new Map<string, { date: string; expected: number; matched: number }>();
  for (const row of expected.values()) {
    const date = perDate.get(row.date) ?? { date: row.date, expected: 0, matched: 0 };
    date.expected++;
    const found = observed.get(key(row));
    if (!found || found.hdShotsAgainst === null) result.missing.push({ ...row, reason: found ? "missing_hd" : "missing_row" });
    else date.matched++;
    perDate.set(row.date, date);
  }
  result.perDate = [...perDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  result.expected = expected.size;
  result.matched = expected.size - result.missing.length;
  result.missing.sort((a, b) => a.date.localeCompare(b.date) || a.goalieId - b.goalieId);
  result.oldestGap = result.missing[0]?.date ?? null;
  result.latestExpectedDate = result.perDate.at(-1)?.date ?? null;
  result.latestCompleteDate = result.perDate.filter(day => day.expected === day.matched).at(-1)?.date ?? null;
  // The report runs at 13:00 UTC, after the proposed catch-up window. Earlier
  // previews retain all findings without escalating before that window closes.
  const reportDue = input.now.getUTCHours() >= 13;
  if (result.missing.length && reportDue) {
    const oldGap = cutoff - goalieDateMillis(result.oldestGap!) >= 2 * 86_400_000;
    result.status = oldGap || input.noProgressWindows >= 2 ? "critical" : "warning";
  } else if (result.missing.length) result.status = "not_due";
  else result.status = "healthy";
  return result;
}
