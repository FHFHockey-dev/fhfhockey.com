import { useId, useMemo, useState } from "react";
import type { RosterScheduleOptimizerState } from "hooks/useRosterScheduleOptimizer";
import type { DashboardMatchupWeek } from "lib/draftDashboard/scheduleMetrics";
import styles from "./DustMatrix.module.scss";

export default function DustMatrix({ state, weeks, period, error }: {
  state: RosterScheduleOptimizerState;
  weeks: readonly DashboardMatchupWeek[];
  period: string;
  error?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const contentId = useId();
  const [offset, setOffset] = useState(0);
  const [detail, setDetail] = useState<string | null>(null);
  const pageSize = 4;
  const page = Math.min(offset, Math.max(0, Math.ceil(weeks.length / pageSize) - 1));
  const visible = weeks.slice(page * pageSize, (page + 1) * pageSize);
  const rows = useMemo(() => {
    const baseline = state.baseline;
    if (!baseline?.players || !baseline.daily) return [];
    return baseline.players.map((player) => ({
      ...player,
      cells: new Map(weeks.map((week) => {
        const days = baseline.daily.filter((day) => day.yahooWeek === week.week);
        return [week.week, {
          scheduled: days.filter((day) => day.scheduledPlayerIds.includes(player.playerId)).length,
          active: days.filter((day) => day.assignments.some((assignment) => assignment.playerId === player.playerId)).length,
          bench: days.filter((day) => day.benchedPlayerIds.includes(player.playerId)).length,
          unresolved: days.some((day) => day.unresolvedPlayers.some((item) => item.playerId === player.playerId)),
        }];
      })),
    })).sort((a, b) => b.benchGames - a.benchGames || (a.playerName ?? a.playerId).localeCompare(b.playerName ?? b.playerId));
  }, [state.baseline, weeks]);
  const max = Math.max(1, ...rows.flatMap((row) => [...row.cells.values()].map((cell) => cell.bench)));
  const ready = !error && state.status === "ready" && state.baseline?.complete && weeks.length > 0;
  return <section className={styles.matrix} aria-label="DUST dashboard">
    <button type="button" className={styles.toggle} aria-expanded={open} aria-controls={contentId} onClick={() => setOpen((value) => !value)}>{open ? "▾" : "▸"} DUST dashboard <span>{period}</span></button>
    <div id={contentId} hidden={!open}>
    {!ready ? <p role="status">{error ?? (state.status === "loading" || !weeks.length ? "Loading weekly schedule…" : state.error ?? "Complete schedule and eligibility data are required for the matrix.")}</p> : !rows.length ? <p>Draft players to see weekly lineup conflicts.</p> : <>
      <p className={styles.legend}>◇ Zero · ◆ More unstartable games → larger, brighter diamonds. Lower is better.</p>
      {state.stale && <p role="status">Using cached schedule data that may be out of date.</p>}
      <nav aria-label="DUST week pages">
        <button type="button" disabled={page === 0} onClick={() => { setOffset(page - 1); setDetail(null); }}>Previous weeks</button>
        <span>Weeks {visible[0]?.week}–{visible.at(-1)?.week}</span>
        <button type="button" disabled={(page + 1) * pageSize >= weeks.length} onClick={() => { setOffset(page + 1); setDetail(null); }}>Next weeks</button>
      </nav>
      <table aria-label="Unstartable player games by Yahoo week">
        <thead><tr><th scope="col">Player</th>{visible.map((week) => <th scope="col" key={week.week} title={`${week.start_date} – ${week.end_date}`}>W{week.week}</th>)}</tr></thead>
        <tbody>{rows.map((row) => <tr key={row.playerId}>
          <th scope="row" title={row.playerName ?? row.playerId}>{row.playerName ?? row.playerId}</th>
          {visible.map((week) => {
            const cell = row.cells.get(week.week)!;
            const description = `${row.playerName ?? row.playerId} · Week ${week.week} (${week.start_date} – ${week.end_date}): ${cell.scheduled} scheduled, ${cell.active} startable, ${cell.bench} benched${cell.unresolved ? ", eligibility unresolved" : ""}.`;
            const strength = cell.bench / max;
            return <td key={week.week}><button type="button" aria-label={description} title={description} onFocus={() => setDetail(description)} onMouseEnter={() => setDetail(description)} onClick={() => setDetail(description)}>
              {cell.unresolved ? "—" : <span aria-hidden="true" className={styles.diamond} style={{ width: `${7 + strength * 13}px`, height: `${7 + strength * 13}px`, backgroundColor: cell.bench ? `hsl(150 55% ${28 + strength * 49}%)` : "transparent" }} />}
            </button></td>;
          })}
        </tr>)}</tbody>
        <tfoot><tr><th scope="row">Benched</th>{visible.map((week) => <td key={week.week}>{rows.reduce((total, row) => total + (row.cells.get(week.week)?.bench ?? 0), 0)}</td>)}</tr></tfoot>
      </table>
      <p className={styles.detail} role="status">{detail ?? "Select or focus a diamond for its game counts."}</p>
    </>}
    </div>
  </section>;
}
