import React, { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { TeamDataWithTotals } from "lib/NHL/types";
import { useTeamsMap } from "hooks/useTeams";
import MetricInfoDisclosure from "../MetricInfoDisclosure";
import OpportunitySparkline from "../OpportunitySparkline";
import toggleStyles from "../DetailToggle.module.scss";
import rankStyles from "../OpponentMetricsTable.module.scss";
import { toRankMaps } from "./metricRanks";
import { OPPORTUNITY_INFO, formatOpportunity, type TeamOpportunity } from "./scheduleOpportunity";
import { getFourWeekAverages } from "./scheduleSummary";
import { toFourWeekMetricBands, FOUR_WEEK_COLOR_LEGEND } from "./fourWeekMetricBands";
import type { FourWeekCalendar } from "./useFourWeekSchedule";
import { buildFourWeekDetailCells } from "./fourWeekGridViews";
import styles from "./FourWeekGrid.module.scss";

type Props = {
  teamDataArray: TeamDataWithTotals[];
  calendar?: FourWeekCalendar;
  warningTarget?: HTMLElement | null;
  opportunityByTeamId?: Record<number, TeamOpportunity>;
  sharedScale?: number;
};
type Key = "teamName" | "gamesPlayed" | "offNights" | "avgOpponentPointPct" | "score";
export default function FourWeekGrid({ teamDataArray, calendar, warningTarget, opportunityByTeamId = {}, sharedScale = 1 }: Props) {
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
  const header = (label: string, key: Key) => <th><button className={styles.sortButton} type="button" onClick={() => setSort((old) => ({ key, ascending: old.key === key ? !old.ascending : key === "teamName" }))} aria-label={`Sort by ${label}`}>{label}</button></th>;
  return <div className={styles.container}>
    <div className={styles.titleHeader}><span className={styles.titleText}>4-Week <span className={styles.spanColorBlue}>Value</span></span></div>
    <div className={styles.tableWrapper}>
      <MetricInfoDisclosure label="four-week forecast" warningTarget={warningTarget} warnings={calendar?.error
        ? ["Schedule unavailable. Reload to retry."]
        : Object.values(opportunityByTeamId).some((v) => v.weeks.some((w) => w.unknown > 0))
          ? ["Some fixture starts or states are unresolved. Affected opportunity totals are unavailable."]
        : (calendar && calendar.knownDays < calendar.expectedDays) || teamDataArray.some((team) => !complete(team))
          ? ["Schedule incomplete. Affected totals are unavailable; check back after schedule updates."]
          : teamDataArray.some((team) => team.opponentCoverage && team.opponentCoverage.known < team.opponentCoverage.expected)
            ? ["Some opponent strength values are unavailable. Check back after standings update."] : []}>
        {calendar && <p>{calendar.start}–{calendar.end}: selected Monday–Sunday week plus three weeks. {calendar.error ?? (calendar.knownDays === calendar.expectedDays ? "Schedule complete." : "Schedule incomplete; affected totals are unavailable.")}</p>}
        <p>{OPPORTUNITY_INFO}</p><p>OPP% = current opponent PTS/(2 × GP). Missing values show “—”.</p>
        <p>{FOUR_WEEK_COLOR_LEGEND.replace("score", "4WK Value")}</p>
      </MetricInfoDisclosure>
      <button type="button" className={toggleStyles.detailToggle} aria-expanded={expanded} aria-label={expanded ? "Collapse four-week columns" : "Expand four-week columns"} onClick={() => setExpanded((v) => !v)}>
        {expanded ? "Hide details" : "Show details"} <span aria-hidden="true">{expanded ? "▴" : "▾"}</span>
      </button>
      {expanded && <div className={styles.viewTabs} role="tablist" aria-label="Four-week forecast views">
        <button type="button" role="tab" aria-selected={!weekly} onClick={() => setWeekly(false)}>4W Summary</button>
        <button type="button" role="tab" aria-selected={weekly} onClick={() => setWeekly(true)}>Weekly Detail</button>
      </div>}
      {!teamDataArray.length ? <p>No schedule data available.</p> : <div style={{ overflowX: "auto" }}>
        <table className={styles.table}>
          <thead><tr>{header("Team", "teamName")}{expanded && weekly ? [1, 2, 3, 4].map((n) => <th key={n}>W{n}</th>) : <>
            {expanded && <>{header("GP", "gamesPlayed")}{header("OFF", "offNights")}{header("OPP (%)", "avgOpponentPointPct")}</>}
            {header("4WK Value", "score")}<th>Trend</th>
          </>}</tr></thead>
          <tbody>
            <tr className={styles.averagesRow}><td>AVG:</td>{expanded && weekly ? [1, 2, 3, 4].map((n) => <td key={n}>—</td>) : <>
              {expanded && <><td>{formatOpportunity(averages.gamesPlayed)}</td><td>{formatOpportunity(averages.offNights)}</td><td>{averages.avgOpponentPointPct == null ? "—" : `${(averages.avgOpponentPointPct * 100).toFixed(1)}%`}</td></>}
              <td>{formatOpportunity(scoreMean)}</td><td />
            </>}</tr>
            {sorted.map((team) => <tr key={team.teamId} data-team-id={team.teamId}>
              <td className={styles.teamCell}><Link href={`/stats/team/${team.teamAbbreviation}`} aria-label={`Open ${teams[team.teamId]?.name ?? team.teamAbbreviation} Team HQ`} className={styles.teamInfo}>
                <Image src={teams[team.teamId]?.logo ?? `/teamLogos/${team.teamAbbreviation}.png`} alt={team.teamAbbreviation} width={24} height={24} />
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
          </tbody>
        </table>
      </div>}
    </div>
  </div>;
}
