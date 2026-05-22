import Link from "next/link";
import { useMemo } from "react";

import {
  DenseList,
  DenseListRow,
  MetricPill,
  ModuleState,
  StatusChip,
  TrendSparkline
} from "components/forge-command-center/CommandCenterShell";
import type { CommandCenterData } from "lib/dashboard/commandCenterData";
import {
  buildSlateMatchupEdgeMap,
  computeCtpiDelta,
  computeTeamPowerScore
} from "lib/dashboard/teamContext";
import { getTeamMetaByAbbr } from "lib/dashboard/teamMetadata";
import styles from "styles/ForgeCommandCenter.module.scss";

type TeamPowerTerminalProps = {
  module: CommandCenterData["modules"]["teamPower"];
  slateModule: CommandCenterData["modules"]["focusedSlate"];
  selectedTeam: string;
  teamHref: (teamAbbr: string) => string;
};

const formatMetric = (value: number | null | undefined, digits = 0) =>
  value == null || Number.isNaN(value) ? "--" : value.toFixed(digits);

const formatSigned = (value: number | null | undefined) => {
  if (value == null || Number.isNaN(value)) return "--";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}`;
};

export default function TeamPowerTerminal({
  module,
  slateModule,
  selectedTeam,
  teamHref
}: TeamPowerTerminalProps) {
  const rows = useMemo(() => {
    const ctpiByTeam = new Map(
      module.data.ctpi.teams.map((row) => [
        row.team.toUpperCase(),
        {
          score: row.ctpi_0_to_100,
          delta: computeCtpiDelta(row),
          spark: row.sparkSeries.map((point) => point.value)
        }
      ])
    );
    const matchupByTeam = buildSlateMatchupEdgeMap(slateModule.data.games);

    return [...module.data.ratings]
      .map((row) => {
        const key = row.teamAbbr.toUpperCase();
        const powerScore = computeTeamPowerScore(row);
        return {
          ...row,
          powerScore,
          ctpi: ctpiByTeam.get(key) ?? null,
          matchup: matchupByTeam.get(key) ?? null
        };
      })
      .sort((a, b) => b.powerScore - a.powerScore)
      .map((row, index) => ({ ...row, rank: index + 1 }));
  }, [module.data.ctpi.teams, module.data.ratings, slateModule.data.games]);

  const selectedRow =
    rows.find((row) => row.teamAbbr.toUpperCase() === selectedTeam.toUpperCase()) ??
    rows[0] ??
    null;
  const leagueAverage =
    rows.length > 0
      ? rows.reduce((sum, row) => sum + row.powerScore, 0) / rows.length
      : null;
  const risers = rows.filter((row) => row.trend10 >= 0).slice(0, 5);
  const fallers = [...rows]
    .filter((row) => row.trend10 < 0)
    .sort((a, b) => a.trend10 - b.trend10)
    .slice(0, 5);
  const selectedMeta = selectedRow ? getTeamMetaByAbbr(selectedRow.teamAbbr) : null;
  const selectedSpark =
    selectedRow?.ctpi?.spark && selectedRow.ctpi.spark.length > 1
      ? selectedRow.ctpi.spark
      : selectedRow
        ? [
            selectedRow.powerScore - Math.abs(selectedRow.trend10),
            selectedRow.powerScore - selectedRow.trend10 / 2,
            selectedRow.powerScore
          ]
        : [];
  const deltaVsLeague =
    selectedRow && leagueAverage != null ? selectedRow.powerScore - leagueAverage : null;

  return (
    <ModuleState module={module}>
      {selectedRow ? (
        <div className={styles.teamTerminal}>
          <div className={styles.terminalFocus}>
            <div className={styles.teamIdentity}>
              {selectedMeta ? (
                <img src={selectedMeta.logo} alt="" className={styles.teamLogoLg} />
              ) : null}
              <div>
                <span>Selected Team Power Trend</span>
                <strong>{selectedMeta?.name ?? selectedRow.teamAbbr}</strong>
              </div>
            </div>
            <TrendSparkline
              values={selectedSpark}
              tone={selectedRow.trend10 >= 0 ? "up" : "down"}
              label={`${selectedRow.teamAbbr} team power trend`}
            />
          </div>

          <div className={styles.metricStrip}>
            <MetricPill label="Power" value={formatMetric(selectedRow.powerScore, 1)} tone="good" />
            <MetricPill label="Vs Lg" value={formatSigned(deltaVsLeague)} tone={deltaVsLeague != null && deltaVsLeague >= 0 ? "good" : "danger"} />
            <MetricPill label="CTPI" value={formatMetric(selectedRow.ctpi?.score, 0)} />
            <MetricPill label="Edge" value={formatSigned(selectedRow.matchup?.edge)} tone={selectedRow.matchup?.edge != null && selectedRow.matchup.edge >= 0 ? "good" : "warn"} />
          </div>

          <div className={styles.scoreBarGrid}>
            {[
              ["Offense", selectedRow.offRating],
              ["Defense", selectedRow.defRating],
              ["Pace", selectedRow.paceRating],
              ["Trend", Math.max(0, 50 + selectedRow.trend10 * 5)],
              ["Finish", selectedRow.finishingRating],
              ["Goalie", selectedRow.goalieRating],
              ["Variance", selectedRow.varianceFlag]
            ].map(([label, value]) => {
              const numeric = typeof value === "number" ? Math.max(0, Math.min(100, value)) : null;
              return (
                <div key={label} className={styles.scoreBarRow}>
                  <span>{label}</span>
                  <div className={styles.scoreBarTrack}>
                    <div
                      className={Number(value) >= 50 ? styles.scoreBarFillGood : styles.scoreBarFillRisk}
                      style={{ width: `${numeric ?? 0}%` }}
                    />
                  </div>
                  <strong>{formatMetric(typeof value === "number" ? value : null, 0)}</strong>
                </div>
              );
            })}
          </div>

          <div className={styles.terminalLists}>
            <DenseList columns="32px minmax(0, 1fr) 54px 60px" aria-label="Top team power risers">
              {risers.map((row) => (
                <DenseListRow key={row.teamAbbr}>
                  <span>{row.rank}</span>
                  <Link href={teamHref(row.teamAbbr)} className={styles.teamListLink}>
                    <img src={`/teamLogos/${row.teamAbbr}.png`} alt="" />
                    {row.teamAbbr}
                  </Link>
                  <strong>{formatMetric(row.powerScore, 1)}</strong>
                  <StatusChip tone="good">{formatSigned(row.trend10)}</StatusChip>
                </DenseListRow>
              ))}
            </DenseList>
            <DenseList columns="32px minmax(0, 1fr) 54px 60px" aria-label="Team power fallers">
              {fallers.map((row) => (
                <DenseListRow key={row.teamAbbr}>
                  <span>{row.rank}</span>
                  <Link href={teamHref(row.teamAbbr)} className={styles.teamListLink}>
                    <img src={`/teamLogos/${row.teamAbbr}.png`} alt="" />
                    {row.teamAbbr}
                  </Link>
                  <strong>{formatMetric(row.powerScore, 1)}</strong>
                  <StatusChip tone="danger">{formatSigned(row.trend10)}</StatusChip>
                </DenseListRow>
              ))}
            </DenseList>
          </div>
        </div>
      ) : null}
    </ModuleState>
  );
}
