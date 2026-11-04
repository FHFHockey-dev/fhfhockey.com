import React, { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { TeamDataWithTotals } from "lib/NHL/types";
import { useTeamsMap } from "hooks/useTeams";
import MetricInfoDisclosure from "../MetricInfoDisclosure";
import OpportunitySparkline from "../OpportunitySparkline";
import { LoadingRows } from "../LoadingCells";
import toggleStyles from "../DetailToggle.module.scss";
import rankStyles from "../OpponentMetricsTable.module.scss";
import { toRankMaps } from "./metricRanks";
import { formatOpportunity, type TeamOpportunity } from "./scheduleOpportunity";
import { getFourWeekAverages } from "./scheduleSummary";
import { toFourWeekMetricBands } from "./fourWeekMetricBands";
import type { FourWeekCalendar } from "./useFourWeekSchedule";
import { buildFourWeekDetailCells } from "./fourWeekGridViews";
import styles from "./FourWeekGrid.module.scss";

type Props = {
  loading?: boolean;
  teamDataArray: TeamDataWithTotals[];
  calendar?: FourWeekCalendar;
  warningTarget?: HTMLElement | null;
  opportunityByTeamId?: Record<number, TeamOpportunity>;
  sharedScale?: number;
};
type Key = "teamName" | "gamesPlayed" | "offNights" | "avgOpponentPointPct" | "score";
// "2026-11-02" → "Nov 2" (date-only, read as UTC so the viewer's timezone never shifts it)
const shortDate = (date: string) => new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" }).format(new Date(`${date}T00:00:00Z`));

export default function FourWeekGrid({ loading = false, teamDataArray, calendar, warningTarget, opportunityByTeamId = {}, sharedScale = 1 }: Props) {
  const teams = useTeamsMap();
  const [expanded, setExpanded] = useState(false);
  const [weekly, setWeekly] = useState(false);
  const [sort, setSort] = useState<{ key: Key; ascending: boolean }>({ key: "teamName", ascending: true });
  const complete = (team: TeamDataWithTotals) => team.totals.scheduleCoverage != null && team.totals.scheduleCoverage.known === team.totals.scheduleCoverage.expected;
  const value = (team: TeamDataWithTotals, key: Key): string | number | null => {
    if (key === "teamName") return teams[team.teamId]?.name ?? team.teamAbbreviation;
    if (key === "score") return opportunityByTeamId[team.teamId]?.opportunity ?? null;
    if (!complete(team)) return null;
    return key === "avgOpponentPointPct" ? team.avgOpponentPointPct : team.totals[key];
  };
  const sorted = [...teamDataArray].sort((a, b) => {
    const av = value(a, sort.key), bv = value(b, sort.key);
    if (av == null || bv == null) return av == null ? bv == null ? String(value(a, "teamName")).localeCompare(String(value(b, "teamName"))) : 1 : -1;
    return (av < bv ? -1 : av > bv ? 1 : 0) * (sort.ascending ? 1 : -1) || String(value(a, "teamName")).localeCompare(String(value(b, "teamName")));
  });
  const averages = useMemo(() => getFourWeekAverages(teamDataArray.filter(complete)), [teamDataArray]);
  const scores = Object.values(opportunityByTeamId).flatMap((v) => v.opportunity == null ? [] : [v.opportunity]);
  const scoreMean = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  const metricBands = Object.fromEntries((["gamesPlayed", "offNights", "avgOpponentPointPct"] as const).map((key) => [key,
    toFourWeekMetricBands(teamDataArray.map((team) => ({ teamId: team.teamId, value: value(team, key) as number | null })), key === "avgOpponentPointPct" ? "asc" : "desc")]));
  // 4WK Value shares the opponent table's top/bottom-10 rank shading.
  const valueRanks = toRankMaps(teamDataArray.flatMap((team) => {
    const score = opportunityByTeamId[team.teamId]?.opportunity;
    return score == null ? [] : [{ teamId: team.teamId, value: score }];
  }), "desc");
  const valueRankClass = (teamId: number) => {
    const best = valueRanks.best.get(teamId);
    if (best != null) return rankStyles[`rankGood${best}`];
    const worst = valueRanks.worst.get(teamId);
    return worst != null ? rankStyles[`rankBad${worst}`] : undefined;
  };
  const header = (label: string, key: Key) => <th><button className={styles.sortButton} type="button" onClick={() => setSort((old) => ({ key, ascending: old.key === key ? !old.ascending : key === "teamName" }))} aria-label={`Sort by ${key === "score" ? "four-week opportunity" : label}`}>{label}<span className={`${styles.sortMark} ${sort.key === key ? styles.sortMarkActive : ""}`} aria-hidden="true">{sort.key === key && sort.ascending ? "▲" : "▼"}</span></button></th>;
  return <div className={styles.container}>
    <div className={styles.titleHeader}><span className={styles.titleText}>4-Week <span className={styles.spanColorBlue}>Opportunity</span> <small>higher = more</small></span></div>
    <div className={styles.tableWrapper}>
      <MetricInfoDisclosure label="four-week forecast" warningTarget={warningTarget} action={
        <button type="button" className={toggleStyles.detailToggle} aria-expanded={expanded} aria-label={expanded ? "Collapse four-week columns" : "Expand four-week columns"} onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Hide details" : "Show details"} <span aria-hidden="true">{expanded ? "▴" : "▾"}</span>
        </button>
      } warnings={loading ? [] : calendar?.error
        ? ["Schedule unavailable. Reload to retry."]
        : Object.values(opportunityByTeamId).some((v) => v.weeks.some((w) => w.unknown > 0))
          ? ["Some fixture starts or states are unresolved. Affected opportunity totals are unavailable."]
        : (calendar && calendar.knownDays < calendar.expectedDays) || teamDataArray.some((team) => !complete(team))
          ? ["Schedule incomplete. Affected totals are unavailable; check back after schedule updates."]
          : teamDataArray.some((team) => team.opponentCoverage && team.opponentCoverage.known < team.opponentCoverage.expected)
            ? ["Some opponent strength values are unavailable. Check back after standings update."] : []}>
        {/* Plain-language version of OPPORTUNITY_INFO / FOUR_WEEK_COLOR_LEGEND (desktop keeps the formulas) */}
        <p>
          <strong>Total</strong> = remaining team games + 0.25 × off-night games, this week and the next three.
          Higher means more chances to play.
        </p>
        <p>
          <strong>Weekly</strong> lines show the same, week by week, on a shared scale (higher = more), coloured by how tough
          the opponents are: green easier, yellow average, pink-red harder. It&rsquo;s schedule opportunity, not a promise of starts.
        </p>
        <p>
          <strong>Show details</strong> adds GP, OFF (off-night games) and OPP% (opponents&rsquo; points %; lower is easier).
          Cell colours run green (best) to gold to red (worst); &ldquo;—&rdquo; means missing.
        </p>
        {/* Window and schedule status: metadata, last and set apart like the Opponent source line */}
        {calendar && <p className={rankStyles.infoSource}>{shortDate(calendar.start)} – {shortDate(calendar.end)} · {loading ? "loading schedule…" : calendar.error ?? (calendar.knownDays === calendar.expectedDays ? "schedule complete" : "schedule incomplete; affected totals unavailable")}</p>}
      </MetricInfoDisclosure>
      {expanded && <div className={styles.viewTabs} role="tablist" aria-label="Four-week forecast views">
        <button type="button" role="tab" aria-selected={!weekly} onClick={() => setWeekly(false)}>4W Summary</button>
        <button type="button" role="tab" aria-selected={weekly} onClick={() => setWeekly(true)}>Weekly Detail</button>
      </div>}
      {!loading && !teamDataArray.length && <p>No schedule data available.</p>}
      <div style={{ overflowX: "auto" }}>
        <table className={styles.table} aria-busy={loading} data-four-week-state={loading ? "loading" : "ready"}>
          <thead><tr>{header("Team", "teamName")}{expanded && weekly ? [1, 2, 3, 4].map((n) => <th key={n}>W{n}</th>) : <>
            {expanded && <>{header("GP", "gamesPlayed")}{header("OFF", "offNights")}{header("OPP (%)", "avgOpponentPointPct")}</>}
            {header("Total", "score")}<th>Weekly<span className={styles.matchupKey}><i data-tone="easier" />easy<i data-tone="average" />avg<i data-tone="harder" />hard</span></th>
          </>}</tr></thead>
          <tbody>
            {loading || !teamDataArray.length ? <LoadingRows columns={expanded ? weekly ? 5 : 6 : 3} rowHeight={37} waiting={loading} /> : <>
            <tr className={styles.averagesRow}><td>AVG</td>{expanded && weekly ? [1, 2, 3, 4].map((n) => <td key={n}>—</td>) : <>
              {expanded && <><td>{formatOpportunity(averages.gamesPlayed)}</td><td>{formatOpportunity(averages.offNights)}</td><td>{averages.avgOpponentPointPct == null ? "—" : `${(averages.avgOpponentPointPct * 100).toFixed(1)}%`}</td></>}
              <td>{formatOpportunity(scoreMean)}</td><td />
            </>}</tr>
            {sorted.map((team) => <tr key={team.teamId} data-team-id={team.teamId}>
              <td className={styles.teamCell}><Link href={`/stats/team/${team.teamAbbreviation}`} aria-label={`Open ${teams[team.teamId]?.name ?? team.teamAbbreviation} Team HQ`} className={styles.teamInfo}>
                <Image src={teams[team.teamId]?.logo ?? `/teamLogos/${team.teamAbbreviation}.png`} alt={team.teamAbbreviation} width={24} height={24} />
                <span className={styles.teamAbbr} aria-hidden="true">{team.teamAbbreviation}</span>
              </Link></td>
              {expanded && weekly ? buildFourWeekDetailCells(team, [1, 2, 3, 4]).map((week) => <td key={week.weekNumber}>
                <strong>{week.gamesPlayed == null ? `Schedule ${week.coverage?.known ? "partial" : "unavailable"}` : `${week.gamesPlayed}G / ${week.offNights}O`}</strong>
                <span className={styles.opponentList}>{week.opponents.join(" · ") || (week.gamesPlayed == null ? "" : "No remaining games")}</span>
              </td>) : <>
                {expanded && <><td data-favorability={metricBands.gamesPlayed.get(team.teamId)}>{formatOpportunity(value(team, "gamesPlayed") as number | null)}</td><td data-favorability={metricBands.offNights.get(team.teamId)}>{formatOpportunity(value(team, "offNights") as number | null)}</td><td data-favorability={metricBands.avgOpponentPointPct.get(team.teamId)}>{value(team, "avgOpponentPointPct") == null ? "—" : `${(team.avgOpponentPointPct! * 100).toFixed(1)}%`}</td></>}
                <td className={valueRankClass(team.teamId)}>{formatOpportunity(value(team, "score") as number | null)}</td>
                <td className={styles.trendCell}><OpportunitySparkline value={opportunityByTeamId[team.teamId]} scale={sharedScale} team={team.teamAbbreviation} /></td>
              </>}
            </tr>)}
            </>}
          </tbody>
        </table>
      </div>
    </div>
  </div>;
}
