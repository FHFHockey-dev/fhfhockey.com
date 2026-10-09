import { useMemo, useState } from "react";
import Image from "next/image";
import { getLocalTeamLogoPath, fallbackTeamLogo } from "lib/images";
import { expandActiveSlots } from "lib/rosterScheduleOptimizer/slots";
import { canEligibilityOccupySlot, normalizeEligibility } from "lib/rosterScheduleOptimizer/eligibility";
import { lineupPeriodAtDate, localDate, nextLocalMidnight } from "lib/rosterScheduleOptimizer/planningDates";
import { buildTimeline } from "lib/rosterScheduleOptimizer/planningTimeline";
import { sanitizeForecastInputs } from "lib/rosterScheduleOptimizer/planning";
import { resolvePlanningContributions } from "lib/player-forecasts/planningContributions";
import type { LeagueRules, PlanIntent, PlanningAssignment, PlanningPlayer, PlanningSnapshot, RosterEntry } from "lib/rosterScheduleOptimizer/planningTypes";
import styles from "./RosterScheduleOptimizer.module.scss";

const order = ["C", "LW", "RW", "D", "UTIL", "G", "BN", "IR", "IR+", "F", "W", "NA", "Review", "Plan changes"];
const dateLabel = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const offsetDate = (date: string, days: number) => new Date(Date.parse(`${date}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
export function scheduleWeek(date: string): string[] {
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  const monday = offsetDate(date, -((weekday + 6) % 7));
  return Array.from({ length: 7 }, (_, index) => offsetDate(monday, index));
}
export type CompactRow = { id: string; slot: string; playerId?: string; player?: PlanningPlayer; status: string; assigned: boolean; change?: string };
export type CompactGroup = { position: string; rows: CompactRow[] };

/** A complete display of existing planning results, not a second assignment engine. */
export function compactGroups({ snapshot, roster, rules, players, assignments, intent, date, ready }: {
  snapshot: PlanningSnapshot | null; roster: RosterEntry[]; rules: LeagueRules; players: PlanningPlayer[];
  assignments: PlanningAssignment[]; intent: PlanIntent; date: string; ready: boolean;
}): CompactGroup[] {
  const members = snapshot && ready
    ? buildTimeline(snapshot, intent, intent.steps).at(new Date(Date.parse(nextLocalMidnight(date, snapshot.context.timeZone)) - 1).toISOString())
    : new Map(roster.map(entry => [entry.playerId, entry]));
  const window = rules.lineupMode === "weekly" && snapshot ? lineupPeriodAtDate(date, rules.lineupPeriods, snapshot.context.timeZone) : null;
  const windowVerified = rules.lineupMode !== "weekly" || Boolean(window);
  const actionableDate = !snapshot || date >= localDate(snapshot.context.asOf, snapshot.context.timeZone);
  const inWindow = (day: string) => window && snapshot ? lineupPeriodAtDate(day, rules.lineupPeriods, snapshot.context.timeZone)?.id === window.id : day === date;
  const locks = snapshot?.lockedAssignments.filter(lock => inWindow(lock.date)) ?? [];
  const dayAssignments = assignments.filter(row => row.date === date);
  const windowAssignments = rules.lineupMode === "weekly" ? assignments.filter(row => inWindow(row.date)) : dayAssignments;
  const used = new Set<string>();
  const groups = new Map<string, CompactRow[]>();
  const add = (position: string, row: CompactRow) => {
    if (row.playerId && !roster.some(entry => entry.playerId === row.playerId)) {
      const member = members.get(row.playerId);
      if (member && "since" in member && snapshot) row.change = `Planned addition · effective ${new Date(String(member.since)).toLocaleString("en-US", { timeZone: snapshot.context.timeZone })} (${snapshot.context.timeZone})`;
    }
    const rows = groups.get(position) ?? []; rows.push(row); groups.set(position, rows);
  };
  for (const slot of expandActiveSlots(rules.rosterSlots).activeSlots) {
    const claims = locks.filter(lock => lock.slotId === slot.id);
    const claimIds = new Set(claims.map(lock => lock.playerId));
    const assignment = windowAssignments.find(row => row.slotId === slot.id);
    const playerId = claims[0]?.playerId ?? assignment?.playerId;
    const player = players.find(row => row.id === playerId);
    const supported = !player || canEligibilityOccupySlot(normalizeEligibility(player.eligiblePositions), slot.type);
    const conflict = claimIds.size > 1 || Boolean(playerId && used.has(playerId))
      || Boolean(claims.length && assignment && assignment.playerId !== playerId)
      || Boolean(playerId && locks.some(lock => lock.playerId === playerId && lock.slotId !== slot.id))
      || Boolean(playerId && !members.has(playerId) && !dayAssignments.some(row => row.playerId === playerId)) || !supported;
    const assigned = Boolean(windowVerified && player?.teamAbbreviation && player.eligibilityVerified === true && playerId && dayAssignments.some(row => row.slotId === slot.id && row.playerId === playerId) && !conflict);
    if (playerId && !used.has(playerId) && (members.has(playerId) || dayAssignments.some(row => row.playerId === playerId))) {
      used.add(playerId);
      add(slot.type, { id: slot.id, slot: slot.id, playerId, player, assigned,
        status: conflict ? "Assignment conflict" : !windowVerified ? "Weekly window unverified" : !player || player.eligibilityVerified !== true ? "Eligibility unverified"
          : !player.teamAbbreviation ? "Team unknown" : assigned ? "Fantasy assigned" : "Held · no active game" });
    } else add(slot.type, { id: slot.id, slot: slot.id, assigned: false,
      status: conflict || playerId ? `Review ${slot.type}` : ready && windowVerified && actionableDate ? `Open ${slot.type}` : `Pending ${slot.type}` });
  }
  for (const [playerId, entry] of members) {
    if (used.has(playerId)) continue;
    used.add(playerId);
    const player = players.find(row => row.id === playerId);
    const reserve = ["IR", "IR+", "NA"].includes(entry.position);
    const reserveSupported = reserve && (rules.rosterSlots[entry.position] ?? 0) > 0;
    const bench = entry.position === "bench" || locks.some(lock => lock.playerId === playerId && lock.slotId === null);
    const position = reserve ? reserveSupported ? entry.position : "Review" : bench && (rules.rosterSlots.BN ?? rules.rosterSlots.BENCH ?? 0) > 0 ? "BN" : "Review";
    const hasGame = snapshot?.games.some(game => game.date === date && game.teamAbbreviation === player?.teamAbbreviation && ["scheduled", "live", "final"].includes(game.status));
    add(position, { id: `player:${playerId}`, slot: position, playerId, player, assigned: false,
      status: !player ? "Unmatched player" : reserve ? !reserveSupported || !player.reserveEligibility.includes(entry.position as "IR" | "IR+" | "NA") ? "Reserve unverified"
        : [...members.values()].filter(member => member.position === entry.position).length > rules.rosterSlots[entry.position] ? "Reserve capacity conflict" : "Reserve"
        : locks.some(lock => lock.playerId === playerId && lock.slotId === null) ? "Bench locked"
        : !ready ? "Assignment pending" : player.eligibilityVerified !== true ? "Eligibility unverified" : !actionableDate ? "Past assignment unverified"
        : !player.teamAbbreviation ? "Team unknown" : hasGame ? "Unassigned · review bench evidence" : snapshot?.evidence.schedule?.completeness === "complete" ? "No game" : "Schedule unknown" });
  }
  for (const entry of roster) {
    if (used.has(entry.playerId)) continue;
    used.add(entry.playerId);
    add("Plan changes", { id: `changed:${entry.playerId}`, slot: "—", playerId: entry.playerId,
      player: players.find(player => player.id === entry.playerId), status: "Planned drop · current roster; review effective time in Plan details", change: "Planned drop; review effective time in Plan details", assigned: false });
  }
  return [...groups].sort(([a], [b]) => order.indexOf(a) - order.indexOf(b)).map(([position, rows]) => ({ position, rows }));
}

export function ScheduleIdentity({ player }: { player: PlanningPlayer }) {
  return <><Image src={getLocalTeamLogoPath(player.teamAbbreviation)} alt="" width={18} height={18} unoptimized
    onError={event => { event.currentTarget.src = fallbackTeamLogo; }} /><span>{player.name.split(" ").slice(1).join(" ") || player.name}</span></>;
}

export default function CompactSchedule({ snapshot, roster, rules, players, assignments, intent, dates, date, today, ready, selectDate, selectPlayer }: {
  snapshot: PlanningSnapshot | null; roster: RosterEntry[]; rules: LeagueRules; players: PlanningPlayer[];
  assignments: PlanningAssignment[]; intent: PlanIntent; dates: string[]; date: string; today: string; ready: boolean;
  selectDate: (date: string) => void; selectPlayer: (id: string) => void;
}) {
  const [benchOpen, setBenchOpen] = useState(true);
  const week = scheduleWeek(date);
  const included = week.map((day, index) => dates.includes(day) ? index : -1).filter(index => index >= 0);
  const groups = useMemo(() => compactGroups({ snapshot, roster, rules, players, assignments, intent, date, ready }), [snapshot, roster, rules, players, assignments, intent, date, ready]);
  const assignedByDay = new Map(week.map(day => [day, new Set((day === date ? groups : compactGroups({ snapshot, roster, rules, players, assignments, intent, date: day, ready }))
    .flatMap(group => group.rows.filter(row => row.assigned).map(row => row.playerId)))]));
  const goalieEvidence = useMemo(() => {
    if (!snapshot) return null;
    const goalies = snapshot.players.filter(player => player.playerClass === "goalie");
    const ids = new Set(goalies.map(player => player.id));
    return resolvePlanningContributions(sanitizeForecastInputs({ ...snapshot, players: goalies,
      forecasts: snapshot.forecasts.filter(row => ids.has(row.playerId)), baselineSources: snapshot.baselineSources?.filter(row => ids.has(String(row.playerId))) }));
  }, [snapshot]);
  const completeSchedule = snapshot?.evidence.schedule?.completeness === "complete";
  const gameLabel = (player: PlanningPlayer, day: string): { text: string; detail: string; assigned: boolean; goalie?: string } => {
    if (!dates.includes(day)) return { text: "—", detail: "Outside selected range", assigned: false };
    if (!player.teamAbbreviation) return { text: "?", detail: "Team unknown; schedule unresolved", assigned: false };
    const game = snapshot?.games.find(game => game.date === day && game.teamAbbreviation === player.teamAbbreviation);
    const assigned = ready && assignedByDay.get(day)?.has(player.id) === true;
    if (!game) return { text: completeSchedule ? "—" : "?", detail: completeSchedule ? "No game" : "Schedule unknown", assigned: false };
    if (["cancelled", "postponed"].includes(game.status)) return { text: "—", detail: game.status, assigned: false };
    let detail = `${game.status === "final" ? "Completed game" : "Has game"} · ${assigned ? "Fantasy assigned" : "Not fantasy assigned"}`;
    let goalie: string | undefined;
    if (player.playerClass === "goalie") {
      const conflict = goalieEvidence?.forecastInputExclusions?.some(row => row.playerId === player.id && row.gameId === game.id && row.reasons.includes("unsupported_conditioning"));
      const forecast = goalieEvidence?.forecasts.find(row => row.playerId === player.id && row.gameId === game.id);
      detail += conflict ? " · Starter conflict" : forecast?.confirmedStart ? " · Confirmed goalie starter"
        : forecast?.startProbability != null ? " · Projected goalie starter" : " · Starter unknown";
      goalie = conflict ? "!" : forecast?.confirmedStart ? "✓" : forecast?.startProbability != null ? "~" : "?";
    }
    return { text: `${game.home ? "vs" : "@"}${game.opponent}`, detail, assigned, goalie };
  };
  const moveWeek = (offset: number) => {
    const next = scheduleWeek(offsetDate(week[0], offset)).filter(day => dates.includes(day));
    if (next.length) selectDate(next.includes(today) ? today : next[0]);
  };
  return <div className={styles.compactSchedule}>
    <div className={styles.dayControls}>
      <button aria-label="Previous schedule week" disabled={!dates.some(day => day < week[0])} onClick={() => moveWeek(-7)}>‹</button>
      <label>Day <input type="range" aria-label="Selected planning day" min={included[0] ?? 0} max={included.at(-1) ?? 6} step={1}
        value={week.indexOf(date)} aria-valuetext={dateLabel(date)} onChange={event => selectDate(week[Number(event.target.value)])} /></label>
      <output aria-live="polite">{dateLabel(date)}</output>
      <button aria-label="Next schedule week" disabled={!dates.some(day => day > week[6])} onClick={() => moveWeek(7)}>›</button>
    </div>
    <div className={styles.scheduleLegend}>{!ready ? "Assignments pending / unverified" : snapshot && date < localDate(snapshot.context.asOf, snapshot.context.timeZone) ? "Past lineup unverified" : "Local planning lineup"} · GP: scheduled games{!completeSchedule && " · partial/unknown schedule"} · G: ? unknown, ~ projected, ✓ confirmed, ! conflict</div>
    <div className={styles.compactScroll} tabIndex={0} role="region" aria-label="Player weekly schedule scroll area">
      <table className={styles.compactTable} aria-label="Individual player weekly schedule">
        <thead><tr><th scope="col">Slot / player</th>{week.map(day => <th scope="col" key={day} className={`${day === date ? styles.chosenDay : ""} ${day < today ? styles.elapsedDay : ""}`}>
          <button aria-label={`Select ${dateLabel(day)}`} aria-pressed={day === date} disabled={!dates.includes(day)} onClick={() => selectDate(day)}>{dateLabel(day)}</button>
        </th>)}<th scope="col" title="Known scheduled games in displayed week; not fantasy or confirmed goalie starts">GP</th></tr></thead>
        {groups.map(group => <tbody key={group.position} className={styles.positionGroup} data-position={group.position === "BN" ? "BENCH" : group.position} aria-label={`${group.position} group`}>
          {group.position === "BN" && <tr className={styles.benchHeading}><th colSpan={9}><button aria-expanded={benchOpen} aria-controls={group.rows.map((_, index) => `rso-bench-${index}`).join(" ")} onClick={() => setBenchOpen(open => !open)}>Bench <span className={styles.countChip}>{group.rows.length}</span> <span aria-hidden="true">{benchOpen ? "▾" : "▸"}</span></button></th></tr>}
          {group.rows.map((row, index) => <tr key={row.id} data-compact-row="" data-player-id={row.playerId} hidden={group.position === "BN" && !benchOpen} id={group.position === "BN" ? `rso-bench-${index}` : undefined}>
            <th scope="row" title={`${row.slot} · ${row.player?.name ?? row.status} · ${row.status}${row.change ? ` · ${row.change}` : ""}${row.player ? ` · Eligible: ${row.player.eligiblePositions.join("/") || "unknown"}` : ""}`}>
              <span className={styles.slotLabel}>{row.slot}</span>{row.player ? <button className={styles.schedulePlayer} onClick={() => selectPlayer(row.playerId!)} aria-label={`Schedule details for ${row.player.name}, ${row.slot}, eligible ${row.player.eligiblePositions.join("/") || "unknown"}, ${row.status}`}>
                <ScheduleIdentity player={row.player} /><span className={styles.scheduleSrOnly}>{row.player.name} · {row.player.teamAbbreviation ?? "Team unknown"}</span>
              </button> : <span>{row.playerId ?? row.status}</span>}{row.change && <small className={styles.plannedChange} title={row.change} aria-label={row.change}>Planned</small>}
              <span className={styles.rowStatus} aria-label={row.status}>{row.assigned ? "●" : row.status.startsWith("Open") ? "Open" : /conflict|Review/.test(row.status) ? "!" : /unverified|pending|unknown/i.test(row.status) ? "?" : /Held|locked/.test(row.status) ? "L" : "·"}</span>
            </th>
            {week.map(day => { const cell = row.player ? gameLabel(row.player, day) : null; return <td key={day} title={`${dateLabel(day)} · ${cell?.detail ?? row.status}`} aria-label={`${dateLabel(day)} · ${cell?.detail ?? row.status}`}
              className={`${day === date ? styles.chosenDay : ""} ${day < today ? styles.elapsedDay : ""} ${cell?.assigned ? styles.fantasyAssigned : ""}`}>{cell?.text ?? "—"}{cell?.goalie && <sup aria-hidden="true">{cell.goalie}</sup>}</td>; })}
            <td>{row.player ? (() => { if (!row.player.teamAbbreviation) return "?"; const count = snapshot?.games.filter(game => week.includes(game.date) && dates.includes(game.date) && game.teamAbbreviation === row.player?.teamAbbreviation && !["cancelled", "postponed"].includes(game.status)).length ?? 0; return completeSchedule ? count : count ? `${count}?` : "?"; })() : "—"}</td>
          </tr>)}
        </tbody>)}
      </table>
    </div>
  </div>;
}
