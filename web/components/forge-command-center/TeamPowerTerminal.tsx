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

/** Ratings are 100-centred (SD 15); bars reach the edge at 100 ± 30 (2 SD). */
export const RATING_BAR_CENTER = 100;
export const RATING_BAR_HALF_RANGE = 30;

/**
 * Diverging bar geometry, in % of the track, centred at 100 (decision 58).
 * A rating is never drawn as a percentile from 0. Null for an unknown rating.
 */
export const divergingRatingBar = (
  value: number | null | undefined
): { offsetPct: number; widthPct: number; above: boolean } | null => {
  if (value == null || !Number.isFinite(value)) return null;
  const share = Math.max(
    -1,
    Math.min(1, (value - RATING_BAR_CENTER) / RATING_BAR_HALF_RANGE)
  );
  const widthPct = Math.abs(share) * 50;
  return {
    offsetPct: share >= 0 ? 50 : 50 - widthPct,
    widthPct,
    above: share >= 0
  };
};

/** Risers and fallers by their actual change (trend10), never by power order. */
export const selectPowerMovers = <T extends { teamAbbr: string; trend10: number }>(
  rows: readonly T[],
  limit = 5
) => {
  const byChange = (a: T, b: T) => b.trend10 - a.trend10 || a.teamAbbr.localeCompare(b.teamAbbr);
  return {
    risers: rows.filter((row) => row.trend10 > 0).sort(byChange).slice(0, limit),
    fallers: rows
      .filter((row) => row.trend10 < 0)
      .sort((a, b) => a.trend10 - b.trend10 || a.teamAbbr.localeCompare(b.teamAbbr))
      .slice(0, limit)
  };
};

const CENTER_LINE =
  "linear-gradient(90deg, transparent calc(50% - 1px), rgba(232, 244, 248, 0.55) calc(50% - 1px), rgba(232, 244, 248, 0.55) calc(50% + 1px), transparent calc(50% + 1px))";

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
  const { risers, fallers } = selectPowerMovers(rows);
  const selectedMeta = selectedRow ? getTeamMetaByAbbr(selectedRow.teamAbbr) : null;
  // Real dated history only (decision 58): the CTPI series is shown as CTPI
  // form; without it the trend is unavailable, never a synthetic line.
  const selectedSpark =
    selectedRow?.ctpi?.spark && selectedRow.ctpi.spark.length > 1
      ? selectedRow.ctpi.spark
      : null;
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
                <span>{selectedSpark ? "Selected team CTPI form" : "Selected team"}</span>
                <strong>{selectedMeta?.name ?? selectedRow.teamAbbr}</strong>
              </div>
            </div>
            {selectedSpark ? (
              <TrendSparkline
                values={selectedSpark}
                tone={(selectedRow.ctpi?.delta ?? 0) >= 0 ? "up" : "down"}
                label={`${selectedRow.teamAbbr} CTPI form trend`}
              />
            ) : (
              <span>Power history unavailable</span>
            )}
          </div>

          <div className={styles.metricStrip}>
            <MetricPill label="Power" value={formatMetric(selectedRow.powerScore, 1)} tone="good" />
            <MetricPill label="Vs Lg" value={formatSigned(deltaVsLeague)} tone={deltaVsLeague != null && deltaVsLeague >= 0 ? "good" : "danger"} />
            <MetricPill label="CTPI" value={formatMetric(selectedRow.ctpi?.score, 0)} />
            <MetricPill label="Edge" value={formatSigned(selectedRow.matchup?.edge)} tone={selectedRow.matchup?.edge != null && selectedRow.matchup.edge >= 0 ? "good" : "warn"} />
          </div>

          <div
            className={styles.scoreBarGrid}
            aria-label={`Ratings centred on 100 (league average); bars span ${RATING_BAR_CENTER - RATING_BAR_HALF_RANGE} to ${RATING_BAR_CENTER + RATING_BAR_HALF_RANGE}`}
          >
            {(
              [
                ["Offense", selectedRow.offRating],
                ["Defense", selectedRow.defRating],
                ["Pace", selectedRow.paceRating],
                ["Finish", selectedRow.finishingRating],
                ["Goalie", selectedRow.goalieRating]
              ] as const
            ).map(([label, value]) => {
              const bar = divergingRatingBar(value);
              return (
                <div key={label} className={styles.scoreBarRow}>
                  <span>{label}</span>
                  <div className={styles.scoreBarTrack} style={{ backgroundImage: CENTER_LINE }}>
                    {bar ? (
                      <div
                        data-testid={`rating-bar-${label}`}
                        className={bar.above ? styles.scoreBarFillGood : styles.scoreBarFillRisk}
                        style={{ marginLeft: `${bar.offsetPct}%`, width: `${bar.widthPct}%` }}
                      />
                    ) : null}
                  </div>
                  <strong>{formatMetric(value, 0)}</strong>
                </div>
              );
            })}
            <div className={styles.scoreBarRow}>
              <span>Off. chg</span>
              <span title="Offense rating minus its average over the prior 10 games">vs prior 10 games</span>
              <strong>{formatSigned(selectedRow.trend10)}</strong>
            </div>
            <div className={styles.scoreBarRow}>
              <span>PDO</span>
              <span>{selectedRow.varianceFlag == null ? "unknown" : selectedRow.varianceFlag ? "variance flag" : "normal"}</span>
              <strong />
            </div>
          </div>

          <div className={styles.terminalLists}>
            <DenseList columns="32px minmax(0, 1fr) 54px 60px" aria-label="Biggest offense-rating risers vs prior 10 games">
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
            <DenseList columns="32px minmax(0, 1fr) 54px 60px" aria-label="Biggest offense-rating fallers vs prior 10 games">
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
