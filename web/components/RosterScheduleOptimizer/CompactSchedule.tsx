import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
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

const activePositions = ["C", "LW", "RW", "D", "UTIL", "G", "F", "W"];
const order = [...activePositions, "BN", "IR", "IR+", "NA", "Review", "Plan changes"];
const dateLabel = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const offsetDate = (date: string, days: number) => new Date(Date.parse(`${date}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
export function scheduleWeek(date: string): string[] {
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  const monday = offsetDate(date, -((weekday + 6) % 7));
  return Array.from({ length: 7 }, (_, index) => offsetDate(monday, index));
}
export function defaultScheduleDate(dates: string[], today: string): string | undefined {
  if (dates.includes(today)) return today;
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  return dates.find(day => new Date(`${day}T12:00:00Z`).getUTCDay() === weekday) ?? dates[0];
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
  const windowVerified = rules.lineupMode === "daily" || rules.lineupMode === "weekly" && Boolean(window);
  const actionableDate = !snapshot || date >= localDate(snapshot.context.asOf, snapshot.context.timeZone);
  const inWindow = (day: string) => window && snapshot ? lineupPeriodAtDate(day, rules.lineupPeriods, snapshot.context.timeZone)?.id === window.id : day === date;
  const locks = snapshot?.lockedAssignments.filter(lock => inWindow(lock.date)) ?? [];
  const dayAssignments = assignments.filter(row => row.date === date);
  const windowAssignments = rules.lineupMode === "weekly" ? assignments.filter(row => inWindow(row.date)) : dayAssignments;
  const slots = expandActiveSlots(rules.rosterSlots);
  // A missing game assignment is not proof that a fantasy slot is vacant.
  const vacanciesVerified = ready && windowVerified && actionableDate && snapshot?.evidence.schedule?.completeness === "complete"
    && !slots.diagnostics.some(item => item.severity === "error") && [...members].every(([playerId, entry]) => {
      if (["IR", "IR+", "NA"].includes(entry.position) || locks.some(lock => lock.playerId === playerId && lock.slotId === null)) return true;
      const player = players.find(item => item.id === playerId);
      if (!player?.teamAbbreviation || player.eligibilityVerified !== true) return false;
      return entry.position !== "active" || [...locks, ...windowAssignments].some(row => row.playerId === playerId && row.slotId
        && slots.activeSlots.some(slot => slot.id === row.slotId && canEligibilityOccupySlot(normalizeEligibility(player.eligiblePositions), slot.type)));
    });
  const used = new Set<string>();
  const groups = new Map<string, CompactRow[]>();
  const add = (position: string, row: CompactRow) => {
    if (row.playerId && !roster.some(entry => entry.playerId === row.playerId)) {
      const member = members.get(row.playerId);
      if (member && "since" in member && snapshot) row.change = `Planned addition · effective ${new Date(String(member.since)).toLocaleString("en-US", { timeZone: snapshot.context.timeZone })} (${snapshot.context.timeZone})`;
    }
    const rows = groups.get(position) ?? []; rows.push(row); groups.set(position, rows);
  };
  for (const slot of slots.activeSlots) {
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
      status: conflict || playerId ? `Review ${slot.type}` : vacanciesVerified ? `Open ${slot.type}` : `Pending ${slot.type}` });
  }
  for (const [playerId, entry] of members) {
    if (used.has(playerId)) continue;
    used.add(playerId);
    const player = players.find(row => row.id === playerId);
    const reserve = ["IR", "IR+", "NA"].includes(entry.position);
    const reserveSupported = reserve && (rules.rosterSlots[entry.position] ?? 0) > 0;
    const bench = entry.position === "bench" || locks.some(lock => lock.playerId === playerId && lock.slotId === null);
    const position = reserve ? reserveSupported ? entry.position : "Review" : bench && slots.benchCapacity > 0 ? "BN" : "Review";
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
  if ([...groups].some(([position, rows]) => activePositions.includes(position)
    && rows.some(row => !row.status.startsWith("Open ") && row.status !== "Fantasy assigned" && row.status !== "Held · no active game"))) {
    for (const rows of groups.values()) for (const row of rows) if (row.status.startsWith("Open ")) row.status = `Pending ${row.slot.split("#")[0]}`;
  }
  return [...groups].sort(([a], [b]) => order.indexOf(a) - order.indexOf(b)).map(([position, rows]) => ({ position, rows }));
}

export function summarizeCompactDay(groups: CompactGroup[], snapshot: PlanningSnapshot | null, date: string) {
  const slots = groups.filter(group => activePositions.includes(group.position)).flatMap(group => group.rows);
  const occupied = slots.filter(row => row.status === "Fantasy assigned" || row.status === "Held · no active game").length;
  const open = slots.filter(row => row.status.startsWith("Open ")).length;
  const games = snapshot?.games.filter(game => game.date === date && ["scheduled", "live", "final"].includes(game.status)) ?? [];
  const members = groups.filter(group => group.position !== "Plan changes").flatMap(group => group.rows);
  return { capacity: slots.length, occupied, open, unresolved: slots.length - occupied - open,
    rosterGames: new Set(members.filter(row => row.player?.teamAbbreviation && games.some(game => game.teamAbbreviation === row.player!.teamAbbreviation)).map(row => row.playerId)).size,
    nhlGames: new Set(games.map(game => game.id)).size, scheduleComplete: snapshot?.evidence.schedule?.completeness === "complete",
    rosterComplete: members.filter(row => row.playerId).every(row => Boolean(row.player?.teamAbbreviation)) };
}

const knownCount = (count: number, complete: boolean) => complete ? String(count) : count ? `${count} known` : "Unknown";

export function ScheduleIdentity({ player }: { player: PlanningPlayer }) {
  return <><Image src={getLocalTeamLogoPath(player.teamAbbreviation)} alt="" width={18} height={18} unoptimized
    onError={event => { event.currentTarget.src = fallbackTeamLogo; }} /><span>{player.name.split(" ").slice(1).join(" ") || player.name}</span></>;
}

export default function CompactSchedule({ snapshot, roster, rules, players, assignments, intent, dates, date, today, ready, selectDate, selectPlayer, benchOpen: controlledBenchOpen, onBenchChange }: {
  snapshot: PlanningSnapshot | null; roster: RosterEntry[]; rules: LeagueRules; players: PlanningPlayer[];
  assignments: PlanningAssignment[]; intent: PlanIntent; dates: string[]; date: string; today: string; ready: boolean;
  selectDate: (date: string) => void; selectPlayer: (id: string) => void;
  benchOpen?: boolean; onBenchChange?: (open: boolean) => void;
}) {
  const [localBenchOpen, setLocalBenchOpen] = useState(true);
  const benchOpen = controlledBenchOpen ?? localBenchOpen;
  const toggleBench = () => { setLocalBenchOpen(!benchOpen); onBenchChange?.(!benchOpen); };
  const scrollElement = useRef<HTMLDivElement>(null);
  const week = scheduleWeek(date);
  const included = week.map((day, index) => dates.includes(day) ? index : -1).filter(index => index >= 0);
  const groups = useMemo(() => compactGroups({ snapshot, roster, rules, players, assignments, intent, date, ready }), [snapshot, roster, rules, players, assignments, intent, date, ready]);
  const daySummary = summarizeCompactDay(groups, snapshot, date);
  const displayedRows = groups.reduce((count, group) => count + (group.position === "BN" && !benchOpen ? 0 : group.rows.length), 0);
  useEffect(() => {
    const scroll = scrollElement.current;
    if (!scroll) return;
    const measure = () => {
      const css = getComputedStyle(scroll);
      const table = scroll.querySelector("table");
      const rowSpace = [...scroll.querySelectorAll('tr[data-compact-row]:not([hidden])')]
        .reduce((total, row) => total + row.getBoundingClientRect().height, 0);
      const extraSpace = (table?.getBoundingClientRect().height ?? 0)
        + (scroll.querySelector(`.${styles.dayControls}`)?.getBoundingClientRect().height ?? 0) - rowSpace;
      const available = scroll.clientHeight - parseFloat(css.paddingTop) - parseFloat(css.paddingBottom) - extraSpace - 1;
      const rowHeight = Math.max(24, Math.min(32, Math.floor(available / Math.max(1, displayedRows))));
      scroll.style.setProperty("--schedule-row-height", `${rowHeight}px`);
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(scroll);
    return () => observer?.disconnect();
  }, [displayedRows, groups, benchOpen]);
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
    const nextDate = defaultScheduleDate(next, today);
    if (nextDate) selectDate(nextDate);
  };
  return <div className={styles.compactSchedule}>
    <section className={styles.daySummary} aria-label="Selected-day lineup summary">
      <div title="Verified occupied starting fantasy slots, including held slots without an NHL game; excludes Bench and reserves"><span>Active slots</span><strong>{daySummary.occupied}{daySummary.unresolved ? " known" : ""}/{daySummary.capacity}</strong></div>
      <div title="Verified vacant starting fantasy slots; an occupied no-game slot is not open"><span>Open slots</span><strong>{daySummary.unresolved ? `${daySummary.open ? `${daySummary.open} verified · ` : ""}${daySummary.unresolved} unresolved` : daySummary.open}</strong></div>
      <div title="Individual players in the local planning roster with a scheduled, live or completed NHL game on this date; not fantasy starts"><span>Roster games</span><strong>{knownCount(daySummary.rosterGames, daySummary.scheduleComplete && daySummary.rosterComplete)}</strong></div>
      <div title="Distinct league-wide NHL games on this date; not roster-player games or goalie starts"><span>NHL games</span><strong>{knownCount(daySummary.nhlGames, daySummary.scheduleComplete)}</strong></div>
    </section>
    <div className={styles.scheduleLegend}>{!ready ? "Assignments pending / unverified" : snapshot && date < localDate(snapshot.context.asOf, snapshot.context.timeZone) ? "Past lineup unverified" : "Local planning lineup"} · GP: scheduled games{!completeSchedule && " · partial/unknown schedule"} · G: ? unknown, ~ projected, ✓ confirmed, ! conflict</div>
    <div ref={scrollElement} className={styles.compactScroll} tabIndex={0} role="region" aria-label="Player weekly schedule scroll area">
      <div className={styles.dayControls}>
        <div className={styles.dayNavigation}>
          <button aria-label="Previous schedule week" disabled={!dates.some(day => day < week[0])} onClick={() => moveWeek(-7)}>‹</button>
          <output aria-live="polite">{dateLabel(date)}</output>
          <button aria-label="Next schedule week" disabled={!dates.some(day => day > week[6])} onClick={() => moveWeek(7)}>›</button>
        </div>
        <div className={styles.daySlider} style={{ gridColumn: `${(included[0] ?? 0) + 2} / ${(included.at(-1) ?? 6) + 3}`,
          "--slider-day-count": (included.at(-1) ?? 6) - (included[0] ?? 0) + 1 } as CSSProperties}>
          <input type="range" aria-label="Selected planning day" min={included[0] ?? 0} max={included.at(-1) ?? 6} step={1}
            value={week.indexOf(date)} aria-valuetext={dateLabel(date)} onChange={event => selectDate(week[Number(event.target.value)])}
            onKeyDown={event => {
              const current = week.indexOf(date);
              const index = event.key === "Home" ? included[0] : event.key === "End" ? included.at(-1)
                : event.key === "ArrowLeft" ? current - 1 : event.key === "ArrowRight" ? current + 1 : undefined;
              if (index === undefined) return;
              event.preventDefault();
              if (included.includes(index)) selectDate(week[index]);
            }} />
        </div>
      </div>
      <table className={styles.compactTable} aria-label="Individual player weekly schedule">
        <thead><tr><th scope="col">Slot / player</th>{week.map(day => <th scope="col" key={day} className={`${day === date ? styles.chosenDay : ""} ${day < today ? styles.elapsedDay : ""}`}>
          <button aria-label={`Select ${dateLabel(day)}`} aria-pressed={day === date} disabled={!dates.includes(day)} onClick={() => selectDate(day)}>
            <span>{dateLabel(day).split(", ")[0]}</span><span>{dateLabel(day).split(", ")[1]}</span>
            {dates.includes(day) && <small>{knownCount(new Set(snapshot?.games.filter(game => game.date === day && ["scheduled", "live", "final"].includes(game.status)).map(game => game.id)).size, completeSchedule)} NHL</small>}
          </button>
        </th>)}<th scope="col" title="Known scheduled games in displayed week; not fantasy or confirmed goalie starts">GP</th></tr></thead>
        {groups.map(group => <tbody key={group.position} className={styles.positionGroup} data-position={group.position === "BN" ? "BENCH" : group.position === "F" ? "FWD" : group.position}
          data-label={group.position === "BN" ? "Bench" : group.position} data-rotated-label={["UTIL", "Review", "Plan changes"].includes(group.position) || undefined}
          data-bench-open={group.position === "BN" ? benchOpen : undefined} aria-label={`${group.position} group`}>
          {group.position === "BN" && <tr data-bench-heading="" className={styles.benchHeading}><th colSpan={9}><button aria-label={`Bench ${group.rows.length}, ${benchOpen ? "collapse" : "expand"}`} aria-expanded={benchOpen} aria-controls={group.rows.map((_, index) => `rso-bench-${index}`).join(" ")} onClick={toggleBench}><span aria-hidden="true">Bench</span></button></th></tr>}
          {group.rows.map((row, index) => <tr key={row.playerId ?? row.id} data-compact-row="" data-player-id={row.playerId} hidden={group.position === "BN" && !benchOpen} id={group.position === "BN" ? `rso-bench-${index}` : undefined}>
            <th scope="row" title={`${row.slot} · ${row.player?.name ?? row.status} · ${row.status}${row.change ? ` · ${row.change}` : ""}${row.player ? ` · ${row.player.eligibilityVerified === true ? "League positions" : "Positions on file (unconfirmed)"}: ${row.player.eligiblePositions.join("/") || "unknown"}` : ""}`}>
              {row.player ? <button className={styles.schedulePlayer} onClick={() => selectPlayer(row.playerId!)} aria-label={`Schedule details for ${row.player.name}, ${row.slot}, ${row.player.eligibilityVerified === true ? "league positions" : "unconfirmed positions"} ${row.player.eligiblePositions.join("/") || "unknown"}, ${row.status}`}>
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
