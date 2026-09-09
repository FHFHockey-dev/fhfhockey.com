import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { RosterScheduleOptimizerState } from "hooks/useRosterScheduleOptimizer";
import type { DashboardMatchupWeek } from "lib/draftDashboard/scheduleMetrics";
import styles from "./DustMatrix.module.scss";

type DustRosterPlayer = { playerId: string; playerName?: string; position?: string };
type MatrixCell = { scheduled: number; active: number; bench: number; unresolved: boolean; playerCount: number };
type MatrixRow = { id: string; label: string; cells: Map<number, MatrixCell>; benchGames: number };

function describeCell(row: MatrixRow, week: DashboardMatchupWeek, cell: MatrixCell, drilldown: boolean) {
  const scope = drilldown ? row.label : `${row.label} position`;
  if (cell.unresolved) return `${scope} · Week ${week.week} (${week.start_date} – ${week.end_date}): schedule coverage unavailable.`;
  const players = drilldown ? "" : ` across ${cell.playerCount} player${cell.playerCount === 1 ? "" : "s"}`;
  return `${scope} · Week ${week.week} (${week.start_date} – ${week.end_date}): ${cell.scheduled} scheduled, ${cell.active} startable, ${cell.bench} benched${players}.`;
}

export default function DustMatrix({ state, weeks, roster = [], selectedWeeks = weeks, period, error }: {
  state: RosterScheduleOptimizerState;
  weeks: readonly DashboardMatchupWeek[];
  roster?: readonly DustRosterPlayer[];
  selectedWeeks?: readonly DashboardMatchupWeek[];
  period: string;
  error?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<string | null>(null);
  const contentId = useId();
  const [detail, setDetail] = useState<string | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [fitScale, setFitScale] = useState(1);
  const selectedWeekNumbers = useMemo(() => new Set(selectedWeeks.map((week) => week.week)), [selectedWeeks]);
  const playerRows = useMemo(() => {
    const baseline = state.baseline;
    if (!baseline?.players || !baseline.daily) return [];
    const baselineByPlayerId = new Map(baseline.players.map((player) => [player.playerId, player]));
    const matrixPlayers = roster.length
      ? roster.map((player) => ({ ...player, ...baselineByPlayerId.get(player.playerId), position: player.position ?? "Unassigned" }))
      : baseline.players.map((player) => ({ ...player, position: "Unassigned" }));
    return matrixPlayers.map((player) => {
      const cells = new Map(weeks.map((week) => {
        const days = baseline.daily.filter((day) => day.yahooWeek === week.week);
        return [week.week, {
          scheduled: days.filter((day) => day.scheduledPlayerIds.includes(player.playerId)).length,
          active: days.filter((day) => day.assignments.some((assignment) => assignment.playerId === player.playerId)).length,
          bench: days.filter((day) => day.benchedPlayerIds.includes(player.playerId)).length,
          unresolved: !baseline.complete || !baselineByPlayerId.has(player.playerId) || days.some((day) => day.unresolvedPlayers.some((item) => item.playerId === player.playerId)),
          playerCount: 1,
        } satisfies MatrixCell];
      }));
      return { id: player.playerId, label: player.playerName ?? player.playerId, position: player.position, cells, benchGames: player.benchGames ?? 0 };
    }).sort((left, right) => right.benchGames - left.benchGames || left.label.localeCompare(right.label));
  }, [roster, state.baseline, weeks]);
  const positionRows = useMemo(() => {
    const byPosition = new Map<string, typeof playerRows>();
    playerRows.forEach((player) => byPosition.set(player.position, [...(byPosition.get(player.position) ?? []), player]));
    return [...byPosition.entries()].map(([position, players]) => {
      const cells = new Map(weeks.map((week) => {
        const cellsForWeek = players.map((player) => player.cells.get(week.week)!);
        return [week.week, {
          scheduled: cellsForWeek.reduce((total, cell) => total + cell.scheduled, 0),
          active: cellsForWeek.reduce((total, cell) => total + cell.active, 0),
          bench: cellsForWeek.reduce((total, cell) => total + cell.bench, 0),
          unresolved: cellsForWeek.some((cell) => cell.unresolved),
          playerCount: players.length,
        } satisfies MatrixCell];
      }));
      return { id: position, label: position, cells, benchGames: players.reduce((total, player) => total + player.benchGames, 0) } satisfies MatrixRow;
    }).sort((left, right) => right.benchGames - left.benchGames || left.label.localeCompare(right.label));
  }, [playerRows, weeks]);
  const drilldown = selectedPosition !== null && positionRows.some((row) => row.id === selectedPosition);
  const rows = drilldown ? playerRows.filter((row) => row.position === selectedPosition) : positionRows;
  const max = Math.max(1, ...rows.flatMap((row) => [...row.cells.values()].map((cell) => cell.bench)));
  const ready = !error && state.status === "ready" && Boolean(state.baseline) && weeks.length > 0;
  const weekTotals = useMemo(() => new Map(weeks.map((week) => [week.week, rows.reduce((total, row) => total + (row.cells.get(week.week)?.bench ?? 0), 0)])), [rows, weeks]);
  const weekUnavailable = useMemo(() => new Map(weeks.map((week) => [week.week, rows.some((row) => row.cells.get(week.week)?.unresolved)])), [rows, weeks]);
  const weekAxis = { x: 32, y: 8 };
  const rowAxis = { x: 20, y: 34 };
  const plotWidth = 190 + Math.max(0, weeks.length - 1) * weekAxis.x + Math.max(0, rows.length - 1) * rowAxis.x;
  const plotHeight = 56 + Math.max(0, weeks.length - 1) * weekAxis.y + Math.max(0, rows.length - 1) * rowAxis.y;

  useLayoutEffect(() => {
    if (!open || !viewportRef.current || !plotWidth || typeof ResizeObserver === "undefined") return;
    const updateScale = () => setFitScale(Math.min(1, Math.max(0.25, (viewportRef.current?.clientWidth ?? plotWidth) / plotWidth)));
    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(viewportRef.current);
    return () => observer.disconnect();
  }, [open, plotWidth]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const trigger = triggerRef.current;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const dialog = closeRef.current?.closest("[role=dialog]");
      if (!dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])")).filter((element) => !element.hasAttribute("disabled"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      trigger?.focus();
    };
  }, [open]);

  return <section className={styles.matrix} data-dust-matrix="true" aria-label="DUST schedule overview">
    <button ref={triggerRef} type="button" className={styles.toggle} aria-expanded={open} aria-controls={contentId} onClick={() => setOpen((value) => !value)}>
      {open ? "▾" : "▸"} DUST schedule overview <span>Full-season DUST baseline · {period}</span>
    </button>
    {open && <div className={styles.modalLayer}>
      <button type="button" tabIndex={-1} className={styles.modalBackdrop} aria-label="Close DUST schedule overview" onClick={() => setOpen(false)} />
      <div id={contentId} className={styles.modal} role="dialog" aria-modal="true" aria-labelledby={`${contentId}-title`}>
        <h2 id={`${contentId}-title`} className={styles.visuallyHidden}>DUST schedule overview</h2>
        <button ref={closeRef} type="button" className={styles.modalClose} onClick={() => setOpen(false)}>Close</button>
        <div className={styles.modalContent}>
      {!ready ? <p role="status">{error ?? (state.status === "loading" || !weeks.length ? "Loading weekly schedule…" : state.error ?? "Complete schedule and eligibility data are required for the matrix.")}</p> : !rows.length ? <p>Draft players to see weekly lineup conflicts.</p> : <>
        <div className={styles.heading}><div><h3>{drilldown ? `${selectedPosition} players by week` : "Position overlap by week"}</h3><p id={`${contentId}-legend`} className={styles.legend}>Each diamond is a known DUST count. Larger, brighter green diamonds mean more benched or unstartable games—more is worse. ◇ is a known zero; — is unavailable. Positions are a single display grouping per player, not a claim that a specific position caused a benching.</p></div>{drilldown ? <button type="button" className={styles.back} onClick={() => setSelectedPosition(null)}>Back to positions</button> : <div className={styles.scaleLegend} aria-label="Diamond size legend"><span>0</span><i className={styles.legendZero} aria-hidden="true">◇</i><i className={styles.legendDiamond} style={{ "--strength": .45 } as React.CSSProperties} aria-hidden="true" /><i className={styles.legendDiamond} style={{ "--strength": 1 } as React.CSSProperties} aria-hidden="true" /><span>{max}</span></div>}</div>
        {state.stale && <p role="status">Using cached schedule data that may be out of date.</p>}
        {!drilldown ? <div className={styles.mobilePositionControls} aria-label="Position drilldown">{positionRows.map((row) => <button key={row.id} type="button" onClick={() => { setSelectedPosition(row.id); setDetail(null); }}>Show {row.label} players</button>)}</div> : null}
        <div className={styles.viewport} ref={viewportRef}>
          <div className={styles.plot} style={{ width: `${plotWidth}px`, height: `${plotHeight}px`, "--fit-scale": fitScale } as React.CSSProperties} aria-describedby={`${contentId}-legend`}>
            <span className={styles.axisTitle}>{drilldown ? "Player / week" : "Position / week"}</span>
            {weeks.map((week, weekIndex) => <span key={week.week} className={`${styles.weekLabel} ${selectedWeekNumbers.has(week.week) ? styles.selectedWeek : ""}`} style={{ left: `${168 + weekIndex * weekAxis.x}px`, top: `${weekIndex * weekAxis.y}px` }}>W{week.week}</span>)}
            <svg className={styles.lattice} aria-hidden="true" width={plotWidth} height={plotHeight}>{rows.flatMap((row, rowIndex) => weeks.slice(1).map((week, weekIndex) => <line key={`row-${row.id}-${week.week}`} x1={178.5 + weekIndex * weekAxis.x + rowIndex * rowAxis.x} y1={38.5 + weekIndex * weekAxis.y + rowIndex * rowAxis.y} x2={178.5 + (weekIndex + 1) * weekAxis.x + rowIndex * rowAxis.x} y2={38.5 + (weekIndex + 1) * weekAxis.y + rowIndex * rowAxis.y} />)).concat(rows.slice(1).flatMap((row, rowIndex) => weeks.map((week, weekIndex) => <line key={`column-${row.id}-${week.week}`} x1={178.5 + weekIndex * weekAxis.x + rowIndex * rowAxis.x} y1={38.5 + weekIndex * weekAxis.y + rowIndex * rowAxis.y} x2={178.5 + weekIndex * weekAxis.x + (rowIndex + 1) * rowAxis.x} y2={38.5 + weekIndex * weekAxis.y + (rowIndex + 1) * rowAxis.y} />)))}</svg>
            {rows.map((row, rowIndex) => drilldown
              ? <span key={row.id} className={styles.rowLabel} title={row.label} style={{ left: `${rowIndex * rowAxis.x}px`, top: `${28 + rowIndex * rowAxis.y}px` }}>{row.label}</span>
              : <button key={row.id} type="button" className={styles.positionLabel} title={`Show ${row.label} players by week`} style={{ left: `${rowIndex * rowAxis.x}px`, top: `${24 + rowIndex * rowAxis.y}px` }} onClick={() => { setSelectedPosition(row.id); setDetail(null); }}>{row.label}</button>)}
            {rows.flatMap((row, rowIndex) => weeks.map((week, weekIndex) => {
              const cell = row.cells.get(week.week)!;
              const description = describeCell(row, week, cell, drilldown);
              const strength = cell.bench / max;
              const stateName = cell.unresolved ? "unresolved" : cell.bench ? "bench" : "zero";
              const visual = cell.unresolved ? <span aria-hidden="true">—</span> : cell.bench === 0 ? <span aria-hidden="true" className={styles.zero}>◇</span> : <span aria-hidden="true" className={styles.diamond} style={{ "--strength": strength } as React.CSSProperties} />;
              return <span key={`${row.id}-${week.week}`} className={`${styles.cell} ${selectedWeekNumbers.has(week.week) ? styles.selectedWeek : ""} ${cell.unresolved ? styles.unresolved : ""}`} style={{ left: `${168 + weekIndex * weekAxis.x + rowIndex * rowAxis.x}px`, top: `${28 + weekIndex * weekAxis.y + rowIndex * rowAxis.y}px` }} data-selected-week={selectedWeekNumbers.has(week.week) || undefined} data-dust-state={stateName}>
                <span className={styles.cellVisual}>{visual}</span>
                <button type="button" className={styles.cellButton} aria-label={description} title={description} onFocus={() => setDetail(description)} onClick={() => setDetail(description)} />
              </span>;
            }))}
          </div>
          <div className={styles.matrixFooter} aria-label="Benched games by matchup week"><strong>Benched games</strong>{weeks.map((week) => <span key={week.week} className={selectedWeekNumbers.has(week.week) ? styles.selectedWeek : undefined} title={weekUnavailable.get(week.week) ? `Week ${week.week}: unavailable` : `Week ${week.week}: ${weekTotals.get(week.week) ?? 0} benched games`}>W{week.week} {weekUnavailable.get(week.week) ? "Unavailable" : weekTotals.get(week.week) ?? 0}</span>)}</div>
        </div>
        <details className={styles.detailList}><summary>Inspect exact {drilldown ? "player" : "position"}-week counts</summary><ul>{rows.flatMap((row) => weeks.map((week) => { const cell = row.cells.get(week.week)!; const description = describeCell(row, week, cell, drilldown); return <li key={`${row.id}-${week.week}`}><button type="button" aria-label={description} onFocus={() => setDetail(description)} onClick={() => setDetail(description)}>{row.label} · W{week.week}</button></li>; }))}</ul></details>
        <p className={styles.mobileHint}>All weeks remain visible in the overview. Open the exact-count list to select a {drilldown ? "player" : "position"}-week.</p>
        <p className={styles.detail} role="status">{detail ?? (drilldown ? "Select or focus a diamond for its exact player and week counts." : "Select a position label to inspect its players, or focus a diamond for exact weekly counts.")}</p>
      </>}
        </div>
      </div>
    </div>}
  </section>;
}
