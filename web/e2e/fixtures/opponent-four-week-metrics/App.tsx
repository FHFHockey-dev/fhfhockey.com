import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import DesktopMasterTable from "components/GameGrid/DesktopMasterTable";
import OpponentMetricsTable from "components/GameGrid/OpponentMetricsTable";
import FourWeekGrid from "components/GameGrid/utils/FourWeekGrid";
import { getFourWeekAverages, getFourWeekScore } from "components/GameGrid/utils/scheduleSummary";
import type { TeamDataWithTotals } from "lib/NHL/types";
import type { OpponentMetricAverages, OpponentMetricColumn, OpponentMetricCoverage, UseOpponentMetricsDataResult } from "components/GameGrid/utils/useOpponentMetricsData";
import { teams } from "./data";
const columns: OpponentMetricColumn[] = [
  { label: "xGF", key: "avgXgf" }, { label: "xGA", key: "avgXga" }, { label: "GF", key: "avgGoalFor" },
  { label: "GA", key: "avgGoalAgainst" }, { label: "SF", key: "avgSf" }, { label: "SA", key: "avgSa" }, { label: "PTS%", key: "avgWinPct" },
];
const empty = Object.fromEntries(columns.map(({ key }) => [key, null])) as OpponentMetricAverages;
function App() {
  const [equal, setEqual] = useState(false);
  const [state, setState] = useState("partial");
  const [unknownProvenance, setUnknownProvenance] = useState(true);
  const failed = state === "failed";
  const calendar = { start: "2026-10-05", end: "2026-11-01", knownDays: failed ? 0 : state === "partial" ? 21 : 28, expectedDays: 28, error: failed ? "Schedule could not be read." : null };
  const teamData: TeamDataWithTotals[] = Object.values(teams).map((team, index) => {
    const rank = Math.floor(index / 2);
    const gamesPlayed = equal ? 12 : 16 - Math.floor(rank / 3);
    const offNights = equal ? 5 : 8 - Math.floor(rank / 2);
    const missing = failed || (state === "partial" && team.id === 32);
    return { teamId: team.id, teamAbbreviation: team.abbreviation,
      weeks: [
        { weekNumber: 1, gamesPlayed: 3, offNights: 1, opponents: [{ teamId: 2, abbreviation: teams[2].abbreviation }], scheduleCoverage: { known: missing ? 0 : 7, expected: 7 } },
        { weekNumber: 2, gamesPlayed: 3, offNights: 1, opponents: [{ teamId: 2, abbreviation: teams[2].abbreviation }], scheduleCoverage: { known: missing ? 3 : 7, expected: 7 } },
      ],
      totals: { gamesPlayed, offNights, opponents: [], scheduleCoverage: { known: missing ? 21 : 28, expected: 28 } },
      avgOpponentPointPct: missing ? null : equal ? .5 : .3 + rank / 64,
      opponentCoverage: { known: missing ? 0 : 12, expected: 12 },
    };
  });
  const averages = getFourWeekAverages(teamData);
  const summaries = Object.fromEntries(teamData.map((team) => [team.teamId, {
    gamesPlayed: team.totals.scheduleCoverage!.known < 28 ? null : team.totals.gamesPlayed,
    offNights: team.totals.scheduleCoverage!.known < 28 ? null : team.totals.offNights,
    avgOpponentPointPct: team.avgOpponentPointPct, score: getFourWeekScore(team, averages),
    opponentCoverage: team.opponentCoverage, scheduleCoverage: team.totals.scheduleCoverage,
  }]));
  const entries = teamData.map((team, index) => {
    const missing = failed || (state === "partial" && team.teamId === 32);
    const values = Object.fromEntries(columns.map(({ key }) => [key, missing ? null : key === "avgWinPct" ? .3 + index / 100 : 1 + index / 10])) as OpponentMetricAverages;
    const coverage = Object.fromEntries(columns.map(({ key }) => [key, { known: missing ? 0 : 2, expected: 2 }])) as OpponentMetricCoverage;
    return { team, averages: values, coverage };
  });
  const metrics: UseOpponentMetricsDataResult = { entries, metricsByTeamId: Object.fromEntries(entries.map((entry) => [entry.team.teamId, entry.averages])),
    coverageByTeamId: Object.fromEntries(entries.map((entry) => [entry.team.teamId, entry.coverage])),
    leagueAverages: empty, leagueCoverage: Object.fromEntries(columns.map(({ key }) => [key, { known: failed ? 0 : state === "partial" ? 31 : 32, expected: 32 }])) as OpponentMetricCoverage,
    metricColumns: columns, statsLoading: false, statsError: failed ? "Synthetic provider failure" : null, sourceLabel: failed ? "Current-season totals unavailable. Snapshot freshness unknown." : `2026–27 regular-season totals. ${unknownProvenance ? "Snapshot freshness unknown." : "Database snapshot updated 2026-10-10 01:30:08 UTC (oldest team row). Source observation freshness unknown."}` };
  return <main>
    <h1>OMT and 4WG production rendering</h1><p>Synthetic fixture. All network access stays local. React production bundle.</p>
    <button onClick={() => setEqual((value) => !value)}>Toggle equal values</button>
    <select aria-label="Data state" value={state} onChange={(event) => setState(event.target.value)}><option value="complete">Complete</option><option value="partial">Partial</option><option value="failed">Failed</option></select>
    <button onClick={() => setUnknownProvenance((value) => !value)}>Toggle snapshot provenance</button>
    <section aria-label="Combined Game Grid"><DesktopMasterTable start="2026-10-05" extended={false}
      scheduleRows={teamData.map((team) => ({ teamId: team.teamId, totalGamesPlayed: 3, totalOffNights: 1, weekScore: 1 }))}
      gamesPerDay={[2, 3, 4, 5, 6, 7, 8]} excludedDays={[]} setExcludedDays={() => {}}
      opponentMetricsByTeamId={metrics.metricsByTeamId} opponentMetricColumns={columns} opponentLeagueAverages={empty}
      opponentMetricsLoading={false} opponentMetricsError={metrics.statsError} opponentCoverageByTeamId={metrics.coverageByTeamId}
      opponentLeagueCoverage={metrics.leagueCoverage} opponentSourceLabel={metrics.sourceLabel}
      fourWeekSummaryByTeamId={summaries} fourWeekAverages={averages} fourWeekCalendar={calendar}
      onToggleTeam={() => {}}
    /></section>
    <div className="panels"><section aria-label="Standalone OMT"><OpponentMetricsTable teamData={teamData} metricsData={metrics} /></section>
      <section aria-label="Standalone 4WG"><FourWeekGrid teamDataArray={teamData} calendar={calendar} /></section></div>
  </main>;
}
document.body.style.cssText = "margin:0;background:#101115;color:#fff;font-family:Arial,sans-serif";
const style = document.createElement("style");
style.textContent = "main{padding:12px}h1{font-size:20px}.panels{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:20px}@media(max-width:767px){.panels{grid-template-columns:1fr}}";
document.head.append(style);
createRoot(document.getElementById("root")!).render(<App />);
