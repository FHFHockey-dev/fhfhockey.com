import Image from "next/image";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { fallbackTeamLogo, getLocalTeamLogoPath } from "lib/images";
import { canEligibilityOccupySlot, normalizeEligibility } from "lib/rosterScheduleOptimizer/eligibility";
import type { ActiveSlotInstance } from "lib/rosterScheduleOptimizer/types";
import type { GameForecastPoints } from "lib/rosterScheduleOptimizer/planning";
import type { GameForecast, PastLineup, PlanningAssignment, PlanningGame, PlanningPlayer, RosterEntry } from "lib/rosterScheduleOptimizer/planningTypes";
import { providerStartNote } from "lib/rosterScheduleOptimizer/providerGoalieStarts";
import InfoTooltip from "./InfoTooltip";
import ForecastPoints from "./ForecastPoints";
import PlanFromSlider, { type PlanFrom } from "./PlanFromSlider";
import styles from "./SlotWeekGrid.module.scss";

export type Props = {
  dates: string[];
  slots: readonly ActiveSlotInstance[];
  assignments: PlanningAssignment[];
  games: PlanningGame[];
  players: PlanningPlayer[];
  roster: RosterEntry[];
  forecasts?: GameForecast[];
  pointsFor?: (playerId: string, gameId: string) => GameForecastPoints;
  focusedDate?: string | null;
  onSelectPlayer?: (playerId: string) => void;
  /** Each new value replays the optimize animation: every day from `today` moves from the current lineup to the optimized one. */
  animationToken?: number;
  today?: string;
  /** League bench (BN) spots; the bench block keeps at least this many rows. */
  benchCapacity?: number;
  /** The lineups the provider recorded on elapsed days; those columns show them, with each player's actual points. */
  pastLineups?: PastLineup[];
  /** The plan-from slider over the day columns; days before `planFrom.from` are greyed and left out of the plan. */
  planFrom?: PlanFrom;
};

const SUFFIXES = new Set(["jr", "jr.", "sr", "sr.", "ii", "iii", "iv"]);
export function lastName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length > 1 && SUFFIXES.has(parts[parts.length - 1].toLowerCase())) return parts.slice(-2).join(" ");
  return parts[parts.length - 1] ?? name;
}
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function dateParts(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return { weekday: DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()], label: `${MONTHS[m - 1]} ${d}` };
}
/** Shared RSO position palette keys (styles/vars draft-position-colors). */
const positionKey = (type: string) => type === "F" || type === "W" ? "FWD" : type;

function InjuryFlag({ player }: { player: PlanningPlayer }) {
  if (!player.injury) return null;
  const text = `${player.injury.label}${player.injury.note ? ` · ${player.injury.note}` : ""}`;
  return <Image className={styles.injuryIcon} src="/pictures/injured.png" alt={text} title={text} width={12} height={12} />;
}

/** Yahoo's goalie mark for this date, and whether it set that game's start chance. */
function yahooStartMark(player: PlanningPlayer, date: string, forecast: GameForecast | undefined) {
  const status = player.playerClass === "goalie" && player.startingStatus?.date === date ? player.startingStatus : null;
  if (!status) return null;
  const read = new Date(status.observedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const effect = forecast?.limitations.includes(providerStartNote(player.name, status))
    ? `; start chance ${status.isStarting ? "100%" : "0%"} for this game` : forecast ? "; FORGE's start chance unchanged" : "";
  return { glyph: status.isStarting ? "✓" : "✗", text: `${status.isStarting ? "Starting" : "Not starting"} (Yahoo, read ${read})${effect}`, out: !status.isStarting };
}

function Logo({ abbr }: { abbr: string | null }) {
  if (!abbr) return null;
  return <Image className={styles.logo} src={getLocalTeamLogoPath(abbr)} alt="" width={18} height={18} onError={event => { event.currentTarget.src = fallbackTeamLogo; }} />;
}

export default function SlotWeekGrid({ dates, slots, assignments, games, players, roster, forecasts, pointsFor, focusedDate, onSelectPlayer, animationToken, today, benchCapacity = 0, pastLineups, planFrom }: Props) {
  const playerById = new Map(players.map(player => [player.id, player]));
  // An elapsed day shows the lineup the provider recorded, not the planner's assignments (which start today).
  const pastByDate = new Map((pastLineups ?? []).filter(day => today && day.date < today).map(day => [day.date, day]));
  // Each game has one row per team (same id), so a player's game is keyed by id and his own team.
  const gameBySide = new Map(games.map(game => [`${game.id}|${game.teamAbbreviation}`, game]));
  const gameCount = new Map(dates.map(date => [date, new Set(games.filter(game => game.date === date).map(game => game.id)).size]));
  const assignmentAt = new Map(assignments.map(a => [`${a.date}|${a.slotId}`, a]));
  const forecastAt = new Map((forecasts ?? []).map(f => [`${f.playerId}|${f.gameId}`, f]));
  const gameFor = (player: PlanningPlayer | undefined, date: string, gameId?: string) =>
    (gameId && player?.teamAbbreviation ? gameBySide.get(`${gameId}|${player.teamAbbreviation}`) : undefined)
    ?? games.find(game => game.date === date && player?.teamAbbreviation != null && game.teamAbbreviation === player.teamAbbreviation);
  // The "before" picture for the animation: today's active players fill slots in roster order, as the provider lineup
  // carries forward day to day, and everyone else sits. It is display only; the plan comes from `assignments`.
  const rostered = roster.filter(entry => entry.position === "active" || entry.position === "bench");
  const beforeSlots = new Map<string, string>(), beforeActive = new Set<string>();
  for (const entry of rostered.filter(item => item.position === "active")) {
    const player = playerById.get(entry.playerId);
    if (!player) continue;
    const eligibility = normalizeEligibility(player.eligiblePositions);
    const slot = slots.find(item => !beforeSlots.has(item.id) && canEligibilityOccupySlot(eligibility, item.type));
    if (slot) { beforeSlots.set(slot.id, player.id); beforeActive.add(player.id); }
  }
  // Left of the slider: elapsed days keep their recorded lineup and skipped days stay empty, both greyed.
  const greyed = (date: string) => Boolean(planFrom && date < planFrom.from);
  const skipped = (date: string) => greyed(date) && !pastByDate.has(date);
  const sequence = dates.filter(date => date >= (today ?? dates[0] ?? "") && !greyed(date) && gameCount.get(date));
  const [run, setRun] = useState<{ index: number; stage: "before" | "after" } | null>(null);
  const current = run ? sequence[run.index] ?? null : null;
  const gridRef = useRef<HTMLDivElement>(null);
  const firstRects = useRef(new Map<string, DOMRect>());
  useEffect(() => {
    if (!animationToken || !sequence.length) return;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    setRun({ index: 0, stage: "before" });
    // Only a new Optimize click restarts the sequence.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animationToken]);
  useEffect(() => {
    if (!run) return;
    const timer = setTimeout(() => setRun(run.stage === "before" ? { ...run, stage: "after" }
      : run.index + 1 < sequence.length ? { index: run.index + 1, stage: "before" } : null), run.stage === "before" ? 280 : 620);
    return () => clearTimeout(timer);
  }, [run, sequence.length]);
  // FLIP: remember where each chip sat in the current lineup, then glide it from there to its optimized cell.
  useLayoutEffect(() => {
    if (!run || !current || !gridRef.current) return;
    const chips = [...gridRef.current.querySelectorAll<HTMLElement>(`td[data-date="${current}"] [data-chip]`)];
    if (run.stage === "before") { firstRects.current = new Map(chips.map(chip => [chip.dataset.chip!, chip.getBoundingClientRect()])); return; }
    for (const chip of chips) {
      if (typeof chip.animate !== "function") continue;
      const first = firstRects.current.get(chip.dataset.chip!), last = chip.getBoundingClientRect();
      if (!first) chip.animate([{ opacity: 0, transform: "scale(0.92)" }, { opacity: 1, transform: "none" }], { duration: 320, easing: "ease-out" });
      else if (Math.abs(first.top - last.top) > 1 || Math.abs(first.left - last.left) > 1) chip.animate(
        [{ transform: `translate(${first.left - last.left}px, ${first.top - last.top}px)` }, { transform: "none" }],
        { duration: 480, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" });
    }
  }, [run, current]);
  const before = (date: string) => {
    if (!run) return false;
    const position = sequence.indexOf(date);
    return position > run.index || position === run.index && run.stage === "before";
  };
  const columnAttrs = (date: string) => ({ "data-date": date, ...focus(date), ...(greyed(date) ? { "data-greyed": "" } : {}),
    ...(run && sequence.indexOf(date) > run.index ? { "data-pending": "" } : {}),
    ...(current === date && run?.stage === "after" ? { "data-pulse": "" } : {}) });
  // Bench: everyone rostered (not IR/NA) who is out of the lineup that day. Players with a game come first and are
  // highlighted (a game left on the bench); players without one are greyed out, and extras fold into one "+N off" chip.
  const sittingOn = (date: string) => {
    const past = pastByDate.get(date);
    if (past) {
      const sitting = past.entries.filter(entry => entry.slotId === null && entry.position.toUpperCase() === "BN" && entry.playerId)
        .map(entry => playerById.get(entry.playerId!)).filter((player): player is PlanningPlayer => !!player);
      return [...sitting.filter(player => gameFor(player, date)).map(player => ({ player, playing: true })),
        ...sitting.filter(player => !gameFor(player, date)).map(player => ({ player, playing: false }))];
    }
    const lineup = before(date) ? beforeActive : new Set(assignments.filter(row => row.date === date).map(row => row.playerId));
    const sitting = rostered.filter(entry => !lineup.has(entry.playerId)).map(entry => playerById.get(entry.playerId))
      .filter((player): player is PlanningPlayer => !!player);
    return [...sitting.filter(player => gameFor(player, date)).map(player => ({ player, playing: true })),
      ...sitting.filter(player => !gameFor(player, date)).map(player => ({ player, playing: false }))];
  };
  const benchLists = new Map(dates.map(date => [date, sittingOn(date)]));
  const benchRows = Math.max(benchCapacity, ...[...benchLists.values()].map(list => {
    const playing = list.filter(item => item.playing).length;
    return playing + (list.length > playing ? 1 : 0);
  }));
  const reserve = roster.filter(entry => entry.position === "IR" || entry.position === "IR+" || entry.position === "NA");
  const groupSize = (start: number) => { let n = 1; while (slots[start + n]?.type === slots[start].type) n++; return n; };
  const focus = (date: string) => date === focusedDate ? { "data-focused": "" } : {};
  const groups: Array<{ type: string; slots: ActiveSlotInstance[] }> = [];
  for (const slot of slots) { const last = groups.at(-1); if (last?.type === slot.type) last.slots.push(slot); else groups.push({ type: slot.type, slots: [slot] }); }

  function wrap(playerId: string, label: string, content: ReactNode, idle = false, bench?: "playing" | "idle") {
    const chip = { "data-chip": playerId, ...(idle ? { "data-idle": "" } : {}), ...(bench ? { "data-bench": bench } : {}),
      ...(playerById.get(playerId)?.injury ? { "data-injured": "" } : {}) };
    return onSelectPlayer
      ? <button type="button" className={styles.cellButton} aria-label={label} onClick={() => onSelectPlayer(playerId)} {...chip}>{content}</button>
      : <div className={styles.cellBody} {...chip}>{content}</div>;
  }

  function pastCell(slot: ActiveSlotInstance, date: string, past: PastLineup) {
    const entry = past.entries.find(row => row.slotId === slot.id);
    if (!entry) return <td key={date} role="cell" {...columnAttrs(date)} data-past=""><span className={styles.empty}>Empty</span></td>;
    const player = entry.playerId ? playerById.get(entry.playerId) : undefined;
    const game = player ? gameFor(player, date) : undefined;
    const content = <>
      <span className={styles.nameLine}>
        <Logo abbr={player?.teamAbbreviation ?? null} />
        <span className={styles.name}>{lastName(player?.name ?? entry.name)}</span>
        {player && <InjuryFlag player={player} />}
      </span>
      {game ? <span className={styles.opp}>{game.home ? `vs${game.opponent}` : `@${game.opponent}`}</span> : <span className={styles.noGameTag}>{player ? "No game" : "Unmatched"}</span>}
      {typeof entry.points === "number" && <span className={styles.points} data-actual="" title="Actual fantasy points that night, from NHL game stats and your league's scoring (Yahoo's own total can differ after stat corrections)">{entry.points.toFixed(1)}</span>}
    </>;
    return <td key={date} role="cell" {...columnAttrs(date)} data-past="">
      {player ? wrap(player.id, `${player.name}, ${slot.type}, ${date}, recorded lineup${typeof entry.points === "number" ? `, ${entry.points.toFixed(1)} actual points` : ""}`, content, !game)
        : <div className={styles.cellBody} data-idle="">{content}</div>}
    </td>;
  }

  function slotCell(slot: ActiveSlotInstance, date: string) {
    if (!gameCount.get(date) || skipped(date)) return <td key={date} role="cell" {...columnAttrs(date)}><span className={styles.noGames}>—</span></td>;
    const past = pastByDate.get(date);
    if (past) return pastCell(slot, date, past);
    const showBefore = before(date);
    const assignment = showBefore ? undefined : assignmentAt.get(`${date}|${slot.id}`);
    const player = playerById.get((showBefore ? beforeSlots.get(slot.id) : assignment?.playerId) ?? "");
    if (!player) return <td key={date} role="cell" {...columnAttrs(date)}><span className={styles.empty}>Empty</span></td>;
    const game = gameFor(player, date, assignment?.gameId);
    const forecast = game ? forecastAt.get(`${player.id}|${game.id}`) : undefined;
    let mark: { glyph: string; text: string; out?: boolean } | null = yahooStartMark(player, date, forecast);
    if (!mark && slot.type === "G" && forecast) {
      if (forecast.confirmedStart) mark = { glyph: "✓", text: "Confirmed starter" };
      else if ((forecast.startProbability ?? 0) >= 0.5) mark = { glyph: "~", text: `Likely starter (${Math.round((forecast.startProbability ?? 0) * 100)}%)` };
    }
    const points = game && pointsFor ? pointsFor(player.id, game.id) : null;
    const name = lastName(player.name);
    return (
      <td key={date} role="cell" {...columnAttrs(date)}>
        {wrap(player.id, `${player.name}, ${slot.type}, ${date}`, <>
          <span className={styles.nameLine}>
            <Logo abbr={player.teamAbbreviation} />
            <span className={styles.name}>{name}</span>
            <InjuryFlag player={player} />
            {assignment?.locked && <span className={styles.lock} title="Locked" aria-label="Locked">🔒</span>}
            {mark && <span className={styles.start} data-out={mark.out ? "" : undefined} title={mark.text} aria-label={mark.text}>{mark.glyph}</span>}
          </span>
          {game ? <span className={styles.opp}>{game.home ? `vs${game.opponent}` : `@${game.opponent}`}</span> : <span className={styles.noGameTag}>No game</span>}
          {points && <ForecastPoints points={points} goalie={player.playerClass === "goalie"}
            tier={typeof points.expected === "number" ? tier(player.playerClass, points.expected) : undefined} />}
        </>, !game)}
      </td>
    );
  }

  // High / mid / low thirds of this week's lineup values; goalies are ranked apart because their scoring runs on another scale.
  const cutoffs = new Map<string, [number, number]>();
  if (pointsFor) {
    const values: Record<string, number[]> = { skater: [], goalie: [] };
    for (const assignment of assignments) {
      const player = playerById.get(assignment.playerId), game = player ? gameFor(player, assignment.date, assignment.gameId) : undefined;
      const value = player && game ? pointsFor(player.id, game.id).expected : null;
      if (player && typeof value === "number" && Number.isFinite(value)) values[player.playerClass].push(value);
    }
    for (const [playerClass, list] of Object.entries(values)) if (list.length >= 3) {
      list.sort((a, b) => a - b);
      cutoffs.set(playerClass, [list[Math.floor(list.length / 3)], list[Math.floor(2 * list.length / 3)]]);
    }
  }
  const tier = (playerClass: string, value: number) => {
    const cut = cutoffs.get(playerClass);
    return !cut || cut[0] === cut[1] ? "mid" : value >= cut[1] ? "high" : value < cut[0] ? "low" : "mid";
  };
  const row = (key: string, children: ReactNode) => <tr key={key} role="row" className={styles.row}>{children}</tr>;
  return (
    <div className={styles.frame}>
    <div className={styles.scroller} ref={gridRef}>
      <table className={styles.grid} aria-label="Lineup by position" style={{ "--day-count": dates.length } as CSSProperties}>
        <thead role="rowgroup">
          {planFrom && <tr role="row" className={`${styles.row} ${styles.headRow} ${styles.sliderRow}`}>
            <td role="cell" className={styles.sliderCell}><PlanFromSlider days={dates} {...planFrom} /></td>
          </tr>}
          <tr role="row" className={`${styles.row} ${styles.headRow}`}>
            <th scope="col" role="columnheader" className={styles.corner}><InfoTooltip label="About the lineup grid"><span className={styles.legend}>Numbers are each player&apos;s projected fantasy points for that game, using your league&apos;s scoring: <span className={styles.points} data-tier="high">high</span> <span className={styles.points} data-tier="mid">mid</span> <span className={styles.points} data-tier="low">low</span> for your lineup this week. Goalie expected FP includes participation probability; if-starts FP assumes a start. These are alternative views of the same game, not values to add. — means complete approved scoring inputs are unavailable. <b>✓</b> confirmed starter · <b>✗</b> not starting (Yahoo) · <b>~</b> likely starter · <span className={styles.dust} aria-hidden="true" /> game on the bench · grey: no game that night. Past days show the lineup Yahoo recorded and each player&apos;s <span className={styles.points} data-actual="">actual</span> points.</span></InfoTooltip></th>
            {dates.map(date => {
              const { weekday, label } = dateParts(date);
              return <th key={date} scope="col" role="columnheader" {...columnAttrs(date)}>
                <span className={styles.weekday}>{weekday}</span> <span className={styles.date}>{label}</span>
                <span className={styles.count}>{gameCount.get(date)} NHL</span>
              </th>;
            })}
          </tr>
        </thead>
        {groups.map(group => (
          <tbody key={group.slots[0].id} role="rowgroup" className={styles.group} data-position={positionKey(group.type)}>
            {group.slots.map((slot, index) => row(slot.id, <>
              {index === 0 && <th scope="rowgroup" role="rowheader" rowSpan={group.slots.length} className={styles.band}><span>{slot.type}</span></th>}
              {dates.map(date => slotCell(slot, date))}
            </>))}
          </tbody>
        ))}
        {benchRows > 0 && (
          <tbody role="rowgroup" className={`${styles.group} ${styles.bench}`} data-position="BENCH">
            {Array.from({ length: benchRows }, (_, index) => row(`bn${index}`, <>
              {index === 0 && <th scope="rowgroup" role="rowheader" rowSpan={benchRows} className={styles.band}><span>BN</span></th>}
              {dates.map(date => {
                if (skipped(date)) return <td key={date} role="cell" {...columnAttrs(date)} />;
                const list = benchLists.get(date)!, folded = list.length > benchRows ? list.length - benchRows + 1 : 0;
                if (folded && index === benchRows - 1) return <td key={date} role="cell" {...columnAttrs(date)}>
                  <span className={styles.offChip} title={list.slice(index).map(item => item.player.name).join(", ")}>+{folded} off</span></td>;
                const item = list[index];
                return <td key={date} role="cell" {...columnAttrs(date)}>
                  {item && wrap(item.player.id, `${item.player.name}, bench, ${item.playing ? "has a game" : "no game"}, ${date}`, <>
                    <span className={styles.nameLine}>
                      <Logo abbr={item.player.teamAbbreviation} />
                      <span className={styles.name}>{lastName(item.player.name)}</span>
                      <InjuryFlag player={item.player} />
                      {item.playing && <span className={styles.dust} title="Game on the bench" aria-label="Bench game" />}
                      {item.playing && (() => {
                        const game = gameFor(item.player, date), mark = yahooStartMark(item.player, date, game ? forecastAt.get(`${item.player.id}|${game.id}`) : undefined);
                        return mark && <span className={styles.start} data-out={mark.out ? "" : undefined} title={mark.text} aria-label={mark.text}>{mark.glyph}</span>;
                      })()}
                    </span>
                    {item.playing ? (() => { const game = gameFor(item.player, date); return game ? <span className={styles.opp}>{game.home ? `vs${game.opponent}` : `@${game.opponent}`}</span> : null; })()
                      : <span className={styles.noGameTag} data-quiet="">No game</span>}
                  </>, !item.playing, item.playing ? "playing" : "idle")}
                </td>;
              })}
            </>))}
          </tbody>
        )}
        {reserve.length > 0 && (
          <tbody role="rowgroup" className={`${styles.group} ${styles.reserve}`} data-position="BENCH">
            {row("ir", <>
              <th scope="row" role="rowheader" className={styles.band}><span>IR</span></th>
              <td role="cell" className={styles.reserveList}>{reserve.map(entry => {
                const player = playerById.get(entry.playerId);
                return player ? `${lastName(player.name)} (${entry.position})` : null;
              }).filter(Boolean).join(", ")}</td>
            </>)}
          </tbody>
        )}
        <tfoot role="rowgroup">
          <tr role="row" className={`${styles.row} ${styles.footRow}`}>
            <th scope="row" role="rowheader" className={styles.corner}>Filled</th>
            {dates.map(date => {
              const past = pastByDate.get(date);
              const filled = past ? slots.filter(slot => past.entries.some(entry => entry.slotId === slot.id)).length
                : slots.filter(slot => assignmentAt.has(`${date}|${slot.id}`)).length;
              return <td key={date} role="cell" className={styles.footer} {...columnAttrs(date)}>{gameCount.get(date) && !skipped(date) ? `${filled}/${slots.length}` : ""}</td>;
            })}
          </tr>
        </tfoot>
      </table>
    </div>
      <span className={styles.srOnly} aria-live="polite">{current ? `Optimizing ${dateParts(current).weekday} ${dateParts(current).label}…` : ""}</span>
    </div>
  );
}
