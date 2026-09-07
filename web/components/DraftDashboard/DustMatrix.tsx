import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { RosterScheduleOptimizerState } from "hooks/useRosterScheduleOptimizer";
import type { DashboardMatchupWeek } from "lib/draftDashboard/scheduleMetrics";
import styles from "./DustMatrix.module.scss";

type DustRosterPlayer = { playerId: string; playerName?: string };

export default function DustMatrix({ state, weeks, roster = [], selectedWeeks = weeks, period, error }: {
  state: RosterScheduleOptimizerState;
  weeks: readonly DashboardMatchupWeek[];
  roster?: readonly DustRosterPlayer[];
  selectedWeeks?: readonly DashboardMatchupWeek[];
  period: string;
  error?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const contentId = useId();
  const [detail, setDetail] = useState<string | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(1);
  const selectedWeekNumbers = useMemo(() => new Set(selectedWeeks.map((week) => week.week)), [selectedWeeks]);
  const rows = useMemo(() => {
    const baseline = state.baseline;
    if (!baseline?.players || !baseline.daily) return [];
    const baselineByPlayerId = new Map(baseline.players.map((player) => [player.playerId, player]));
    const matrixPlayers = roster.length
      ? roster.map((player) => baselineByPlayerId.get(player.playerId) ?? { ...player, benchGames: 0 })
      : baseline.players;
    return matrixPlayers.map((player) => ({
      ...player,
      cells: new Map(weeks.map((week) => {
        const days = baseline.daily.filter((day) => day.yahooWeek === week.week);
        return [week.week, {
          scheduled: days.filter((day) => day.scheduledPlayerIds.includes(player.playerId)).length,
          active: days.filter((day) => day.assignments.some((assignment) => assignment.playerId === player.playerId)).length,
          bench: days.filter((day) => day.benchedPlayerIds.includes(player.playerId)).length,
          unresolved: !baseline.complete || !baselineByPlayerId.has(player.playerId) || days.some((day) => day.unresolvedPlayers.some((item) => item.playerId === player.playerId)),
        }];
      })),
    })).sort((a, b) => b.benchGames - a.benchGames || (a.playerName ?? a.playerId).localeCompare(b.playerName ?? b.playerId));
  }, [roster, state.baseline, weeks]);
  const max = Math.max(1, ...rows.flatMap((row) => [...row.cells.values()].map((cell) => cell.bench)));
  const ready = !error && state.status === "ready" && Boolean(state.baseline) && weeks.length > 0;
  const weekTotals = useMemo(() => new Map(weeks.map((week) => [week.week, rows.reduce((total, row) => total + (row.cells.get(week.week)?.bench ?? 0), 0)])), [rows, weeks]);
  const weekAxis = { x: 32, y: 8 };
  const playerAxis = { x: 20, y: 32 };
  const plotWidth = 170 + Math.max(0, weeks.length - 1) * weekAxis.x + Math.max(0, rows.length - 1) * playerAxis.x;
  const plotHeight = 52 + Math.max(0, weeks.length - 1) * weekAxis.y + Math.max(0, rows.length - 1) * playerAxis.y;

  useLayoutEffect(() => {
    if (!open || !viewportRef.current || !plotWidth || typeof ResizeObserver === "undefined") return;
    const updateScale = () => setFitScale(Math.min(1, Math.max(0.25, (viewportRef.current?.clientWidth ?? plotWidth) / plotWidth)));
    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(viewportRef.current);
    return () => observer.disconnect();
  }, [open, plotWidth]);

  return <section className={styles.matrix} data-dust-matrix="true" data-open={open ? "true" : "false"} aria-label="DUST schedule overview">
    <button type="button" className={styles.toggle} aria-expanded={open} aria-controls={contentId} onClick={() => setOpen((value) => !value)}>
      {open ? "▾" : "▸"} DUST schedule overview <span>Full-season DUST baseline · {period}</span>
    </button>
    <div id={contentId} hidden={!open}>
      {!ready ? <p role="status">{error ?? (state.status === "loading" || !weeks.length ? "Loading weekly schedule…" : state.error ?? "Complete schedule and eligibility data are required for the matrix.")}</p> : !rows.length ? <p>Draft players to see weekly lineup conflicts.</p> : <>
        <p id={`${contentId}-legend`} className={styles.legend}>Every Yahoo 477 week is shown. Larger, brighter diamonds mean more unstartable games; ◇ is zero and — is unresolved. {selectedWeeks.length === weeks.length ? "Full-season scope is selected." : `${period} weeks are outlined.`}</p>
        {state.stale && <p role="status">Using cached schedule data that may be out of date.</p>}
        <div className={styles.viewport} ref={viewportRef}>
          <div className={styles.plot} style={{ width: `${plotWidth}px`, height: `${plotHeight}px`, "--fit-scale": fitScale } as React.CSSProperties} aria-describedby={`${contentId}-legend`}>
            <span className={styles.axisTitle}>Player / week</span>
            {weeks.map((week, weekIndex) => <span key={week.week} className={`${styles.weekLabel} ${selectedWeekNumbers.has(week.week) ? styles.selectedWeek : ""}`} style={{ left: `${148 + weekIndex * weekAxis.x}px`, top: `${weekIndex * weekAxis.y}px` }}>W{week.week}</span>)}
            {rows.map((row, rowIndex) => <span key={row.playerId} className={styles.playerName} title={row.playerName ?? row.playerId} style={{ left: `${rowIndex * playerAxis.x}px`, top: `${26 + rowIndex * playerAxis.y}px` }}>{row.playerName ?? row.playerId}</span>)}
            {rows.flatMap((row, rowIndex) => weeks.map((week, weekIndex) => {
                  const cell = row.cells.get(week.week)!;
                  const description = cell.unresolved
                    ? `${row.playerName ?? row.playerId} · Week ${week.week} (${week.start_date} – ${week.end_date}): schedule coverage unavailable.`
                    : `${row.playerName ?? row.playerId} · Week ${week.week} (${week.start_date} – ${week.end_date}): ${cell.scheduled} scheduled, ${cell.active} startable, ${cell.bench} benched.`;
                  const strength = cell.bench / max;
                  const stateName = cell.unresolved ? "unresolved" : cell.bench ? "bench" : "zero";
                  const visual = cell.unresolved ? <span aria-hidden="true">—</span> : cell.bench === 0 ? <span aria-hidden="true" className={styles.zero}>◇</span> : <span aria-hidden="true" className={styles.diamond} style={{ "--strength": strength } as React.CSSProperties} />;
                  return <span key={`${row.playerId}-${week.week}`} className={`${styles.cell} ${selectedWeekNumbers.has(week.week) ? styles.selectedWeek : ""} ${cell.unresolved ? styles.unresolved : ""}`} style={{ left: `${148 + weekIndex * weekAxis.x + rowIndex * playerAxis.x}px`, top: `${26 + weekIndex * weekAxis.y + rowIndex * playerAxis.y}px` }} data-selected-week={selectedWeekNumbers.has(week.week) || undefined} data-dust-state={stateName}>
                    <span className={styles.cellVisual}>{visual}</span>
                    <button type="button" className={styles.cellButton} aria-label={description} title={description} onFocus={() => setDetail(description)} onClick={() => setDetail(description)} />
                  </span>;
                }))}
          </div>
          <div className={styles.matrixFooter} aria-label="Benched games by Yahoo week"><strong>Benched games</strong>{weeks.map((week) => <span key={week.week} className={selectedWeekNumbers.has(week.week) ? styles.selectedWeek : undefined} title={state.baseline?.complete === false ? `Week ${week.week}: unavailable` : `Week ${week.week}: ${weekTotals.get(week.week) ?? 0} benched games`}>W{week.week} {state.baseline?.complete === false ? "Unavailable" : weekTotals.get(week.week) ?? 0}</span>)}</div>
        </div>
        <details className={styles.detailList}>
          <summary>Inspect exact player-week counts</summary>
          <ul>{rows.flatMap((row) => weeks.map((week) => {
            const cell = row.cells.get(week.week)!;
            const description = cell.unresolved
              ? `${row.playerName ?? row.playerId} · Week ${week.week} (${week.start_date} – ${week.end_date}): schedule coverage unavailable.`
              : `${row.playerName ?? row.playerId} · Week ${week.week} (${week.start_date} – ${week.end_date}): ${cell.scheduled} scheduled, ${cell.active} startable, ${cell.bench} benched.`;
            return <li key={`${row.playerId}-${week.week}`}><button type="button" aria-label={description} onFocus={() => setDetail(description)} onClick={() => setDetail(description)}>{row.playerName ?? row.playerId} · W{week.week}</button></li>;
          }))}</ul>
        </details>
        <p className={styles.mobileHint}>All 27 weeks fit in this overview. Open the exact counts list to select a player-week.</p>
        <p className={styles.detail} role="status">{detail ?? "Select or focus a diamond for its exact player, week, and game counts."}</p>
      </>}
    </div>
  </section>;
}
