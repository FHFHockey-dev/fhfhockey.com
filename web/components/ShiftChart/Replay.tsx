import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import Image from "next/image";
import useResizeObserver from "hooks/useResizeObserver";
import { LinemateMatrixView, type Mode } from "components/LinemateMatrix";
import {
  clampTime,
  formatClock,
  isActive,
  matrixData,
  positionGroup,
  sortedPlayers,
  statsAt,
  toiAt,
  type Game,
  type Player,
  type Team,
  type TimelineFilter,
} from "./model";
import styles from "styles/ShiftChart.module.scss";

const SPEEDS = [1, 2, 4, 8];
const FILTERS: { value: TimelineFilter; label: string }[] = [
  { value: "all", label: "All players" },
  { value: "active", label: "On ice" },
  { value: "F", label: "Forwards" },
  { value: "D", label: "Defense" },
  { value: "G", label: "Goalies" },
];

const MatrixPanel = memo(function MatrixPanel({
  game,
  mode,
  onModeChanged,
}: {
  game: Game;
  mode: Mode;
  onModeChanged: (mode: Mode) => void;
}) {
  const data = useMemo(() => matrixData(game, mode), [game, mode]);
  const teams = useMemo(() => [game.home, game.away], [game]);
  return (
    <aside className={styles.matrixSidebar} aria-label="Linemate matrices">
      <LinemateMatrixView
        key={game.id}
        compact
        gameInfo={teams}
        rosters={data.rosters}
        toiData={data.toi}
        mode={mode}
        onModeChanged={onModeChanged}
      />
    </aside>
  );
});

export default function Replay({
  game,
  selection,
  mode,
  onModeChanged,
}: {
  game: Game;
  selection: ReactNode;
  mode: Mode;
  onModeChanged: (mode: Mode) => void;
}) {
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [filter, setFilter] = useState<TimelineFilter>("all");
  useEffect(() => {
    if (!playing) return;
    // Preserve the existing accelerated replay: the 1x setting advances four game seconds per second.
    const interval = window.setInterval(
      () =>
        setTime((t) =>
          clampTime(Math.round((t + 0.4 * speed) * 100) / 100, game.duration),
        ),
      100,
    );
    return () => window.clearInterval(interval);
  }, [playing, speed, game.duration]);
  useEffect(() => {
    if (time >= game.duration) setPlaying(false);
  }, [time, game.duration]);

  const activeKey = game.players
    .filter((p) => isActive(p, time))
    .map((p) => p.id)
    .join(",");
  const active = useMemo(
    () => new Set(activeKey ? activeKey.split(",").map(Number) : []),
    [activeKey],
  );
  const ordered = useMemo(
    () => sortedPlayers(game.players, active),
    [game.players, active],
  );
  const chartRef = useRef<HTMLDivElement>(null);
  const chartSize = useResizeObserver(chartRef);
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1200px)");
    const update = () => setDesktop(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const visiblePlayers = ordered.filter(p => filter === "all" ||
    (filter === "active" ? active.has(p.id) : positionGroup(p.position) === filter));
  // A 12px label needs a 15px row. Split complete rosters before sacrificing readability.
  const split = desktop && chartSize.height > 0 &&
    (chartSize.height - 64 - 44) / game.players.length < 15;
  useAnimatedRows(chartRef, visiblePlayers.map(p => p.id).join(","),
    `${split}:${filter}:${chartSize.width}:${chartSize.height}`);
  const teamGroups = split ? [[game.home], [game.away]] : [[game.home, game.away]];
  const stats = statsAt(game, time);
  const period =
    game.periods.find((p) => time >= p.start && time < p.start + p.duration) ??
    game.periods[game.periods.length - 1];
  const seek = (next: number) => setTime(clampTime(next, game.duration));
  return (
    <>
      <div className={styles.mainColumn}>
        <div className={styles.topPanels}>
          {selection}
          <section className={styles.scoreboard} aria-label="Replay scoreboard">
            <div className={styles.scoreLine}>
              {[game.home, game.away].map((team, i) => (
                <div
                  key={team.id}
                  className={styles.scoreTeam}
                  style={{ gridColumn: i === 0 ? 1 : 3 }}
                >
                  <Image
                    src={team.logo}
                    width={50}
                    height={50}
                    alt={`${team.name} logo`}
                    unoptimized
                  />
                  <strong>{team.abbrev}</strong>
                  <span
                    className={styles.score}
                    data-testid={`score-${team.id}`}
                  >
                    {stats.teams[team.id].goals}
                  </span>
                  <span className={styles.sog}>
                    SOG {stats.teams[team.id].shots}
                  </span>
                </div>
              ))}
              <div className={styles.clock}>
                <span>{period.label}</span>
                <strong>
                  {formatClock(period.duration - (time - period.start))}
                </strong>
                <span className={styles.replayBadge}>
                  {playing ? "Playing" : "Replay"}
                </span>
              </div>
            </div>
            <div className={styles.playback}>
              <button
                type="button"
                aria-label="Skip back 30 seconds"
                onClick={() => seek(time - 30)}
                disabled={time === 0}
              >
                ↶<span>30</span>
              </button>
              <button
                type="button"
                className={styles.playButton}
                aria-label={playing ? "Pause replay" : "Play replay"}
                onClick={() => {
                  if (time >= game.duration) seek(0);
                  setPlaying((p) => !p);
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  aria-hidden="true"
                  fill="currentColor"
                >
                  {playing ? (
                    <path d="M6 4h4v16H6zm8 0h4v16h-4z" />
                  ) : (
                    <path d="M6 3l15 9-15 9z" />
                  )}
                </svg>
              </button>
              <button
                type="button"
                aria-label="Skip forward 30 seconds"
                onClick={() => seek(time + 30)}
                disabled={time >= game.duration}
              >
                ↷<span>30</span>
              </button>
              <label className={styles.srOnly} htmlFor="playback-speed">
                Playback speed
              </label>
              <select
                id="playback-speed"
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
              >
                {SPEEDS.map((s) => (
                  <option key={s} value={s}>
                    {s}x
                  </option>
                ))}
              </select>
            </div>
            {game.shootout && (
              <p className={styles.resultNote}>
                Final (SO): {game.home.abbrev} {game.home.score} –{" "}
                {game.away.score} {game.away.abbrev}
              </p>
            )}
          </section>
          <section className={styles.onIce} aria-label="Active players on ice">
            <h2>Active players on ice</h2>
            <div className={styles.formations}>
              {[game.home, game.away].map((team) => (
                <Formation
                  key={team.id}
                  team={team}
                  players={ordered.filter(
                    (p) => p.teamId === team.id && active.has(p.id),
                  )}
                />
              ))}
            </div>
          </section>
        </div>
        <section className={styles.timelinePanel} aria-label="Shift timeline">
          <div className={styles.timelineToolbar}>
            <h2>Shift timeline</h2>
            <div className={styles.legend} aria-label="Timeline legend">
              <span>
                <i className={styles.forward} />
                Forward
              </span>
              <span>
                <i className={styles.defense} />
                Defense
              </span>
              <span>
                <i className={styles.goalie} />
                Goalie
              </span>
              <span>
                <i className={styles.powerPlay} />
                Power play
              </span>
              <span>
                <i className={styles.penaltyKill} />
                Penalty kill
              </span>
              <span>
                <i className={styles.goalDot} />
                Goal
              </span>
              <span className={styles.homeKey}>{game.home.abbrev} home</span>
              <span className={styles.awayKey}>{game.away.abbrev} away</span>
            </div>
            <label>
              View{" "}
              <select
                aria-label="Timeline players"
                value={filter}
                onChange={(e) => setFilter(e.target.value as TimelineFilter)}
              >
                {FILTERS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div
            ref={chartRef}
            className={`${styles.tableScroll} ${split ? styles.splitTimelines : ""}`}
            data-layout={split ? "side-by-side" : "stacked"}
            tabIndex={0}
            role="region"
            aria-label="Scrollable shift chart"
          >
            {teamGroups.map((teams, tableIndex) => {
              const count = visiblePlayers.filter(p => teams.some(t => t.id === p.teamId)).length;
              const rowHeight = desktop && chartSize.height > 0
                ? Math.max(15, Math.min(28, (chartSize.height - 65 - teams.length * 22) / Math.max(1, count)))
                : 23;
              return <table key={teams[0].id} className={styles.timelineTable}
                style={{ "--row-height": `${rowHeight}px` } as CSSProperties}>
              <caption className={styles.srOnly}>
                Player shifts and statistics at the selected replay time
              </caption>
              <colgroup>
                <col className={styles.playerCol} />
                <col className={styles.numberCol} />
                <col className={styles.positionCol} />
                <col className={styles.toiCol} />
                <col className={styles.shotsCol} />
                <col />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">Player</th>
                  <th scope="col">#</th>
                  <th scope="col">Pos</th>
                  <th scope="col">TOI</th>
                  <th scope="col">
                    <abbr title="Shots on goal">S</abbr>
                  </th>
                  <th scope="col" className={styles.axisCell}>
                    <div className={styles.periodLabels}>
                      {game.periods.map((p) => (
                        <span
                          key={p.number}
                          title={p.label}
                          style={{
                            width: `${(p.duration / game.axisDuration) * 100}%`,
                          }}
                        >
                          {p.number === 4 ? "OT" : p.label}
                        </span>
                      ))}
                    </div>
                    <div
                      className={styles.ruler}
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        seek(
                          ((e.clientX - rect.left) / rect.width) *
                            game.axisDuration,
                        );
                      }}
                    >
                      {game.periods
                        .flatMap((p) =>
                          Array.from(
                            { length: Math.ceil(p.duration / 300) },
                            (_, i) => p.start + i * 300,
                          ),
                        )
                        .map((t) => (
                          <span
                            key={t}
                            style={{
                              left: `${(t / game.axisDuration) * 100}%`,
                            }}
                          >
                            {t / 60}
                          </span>
                        ))}
                      {game.events.filter(event => event.goal).map(event => {
                        const team = event.teamId === game.home.id ? game.home : game.away;
                        const player = game.players.find(p => p.id === event.playerId);
                        const label = `${team.abbrev} goal · ${player?.fullName ?? player?.name ?? "Unknown scorer"} · ${formatClock(event.time)} elapsed`;
                        return <button key={event.id} type="button" data-goal-id={event.id}
                          className={`${styles.rulerGoal} ${event.teamId === game.home.id ? styles.homeGoal : styles.awayGoal}`}
                          style={{ left: `clamp(4px, ${event.time / game.axisDuration * 100}%, calc(100% - 4px))` }}
                          title={label} aria-label={label}
                          onClick={e => { e.stopPropagation(); seek(event.time); }} />;
                      })}
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={game.duration}
                      step={1}
                      value={Math.floor(time)}
                      style={{
                        width: `${(game.duration / game.axisDuration) * 100}%`,
                      }}
                      aria-label={tableIndex === 0 ? "Replay time" : `Replay time for ${teams[0].abbrev}`}
                      aria-valuetext={`${period.label}, ${formatClock(time - period.start)} elapsed`}
                      onChange={(e) => seek(Number(e.target.value))}
                    />
                  </th>
                </tr>
              </thead>
              {teams.map((team) => (
                <tbody key={team.id} data-team-side={team.id === game.home.id ? "home" : "away"} aria-label={`${team.abbrev} shifts`}>
                  <tr className={styles.teamRow}>
                    <th colSpan={5} scope="rowgroup">
                      <span>{team.abbrev}</span> {team.name}
                    </th>
                    <td />
                  </tr>
                  {visiblePlayers
                    .filter((p) => p.teamId === team.id)
                    .map((player) => (
                      <tr
                        key={player.id}
                        className={
                          active.has(player.id) ? styles.activeRow : undefined
                        }
                        data-player-id={player.id}
                      >
                        <th scope="row" title={player.fullName ?? player.name}>
                          {active.has(player.id) && (
                            <span
                              className={styles.activeDot}
                              aria-label="On ice"
                            />
                          )}
                          {player.name}
                        </th>
                        <td>{player.sweaterNumber}</td>
                        <td>{player.position}</td>
                        <td>{formatClock(toiAt(player, time))}</td>
                        <td>{stats.shots[player.id] ?? 0}</td>
                        <td className={styles.trackCell}>
                          <ShiftBars player={player} game={game} />
                          <span
                            className={styles.cursor}
                            style={{
                              left: `${(time / game.axisDuration) * 100}%`,
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                </tbody>
              ))}
            </table>;
            })}
          </div>
        </section>
      </div>
      <MatrixPanel game={game} mode={mode} onModeChanged={onModeChanged} />
    </>
  );
}

const Formation = memo(function Formation({
  team,
  players,
}: {
  team: Team;
  players: Player[];
}) {
  return (
    <fieldset className={styles.formation}>
      <legend>
        {team.abbrev}{" "}
        <span>({players.filter((p) => p.position !== "G").length} skaters)</span>
      </legend>
      {(["F", "D", "G"] as const).map((group) => (
        <div key={group} className={styles.formationRow}>
          <span className={styles.positionLabel}>{group}</span>
          <div>
            {players
              .filter((p) => positionGroup(p.position) === group)
              .map((p) => (
                <span key={p.id} title={p.fullName ?? p.name}>
                  {p.name}
                </span>
              ))}
          </div>
        </div>
      ))}
      {players.length === 0 && (
        <span className={styles.noActive}>No recorded players on ice</span>
      )}
    </fieldset>
  );
});

const ShiftBars = memo(function ShiftBars({
  player,
  game,
}: {
  player: Player;
  game: Game;
}) {
  const group = positionGroup(player.position);
  return (
    <div className={styles.track} style={{ backgroundSize: `${300 / game.axisDuration * 100}% 100%` }}>
      {game.powerPlays.map((pp, i) => (
        <span
          key={`pp-${i}`}
          className={
            pp.teamId === player.teamId ? styles.ppBand : styles.pkBand
          }
          style={{
            left: `${(pp.start / game.axisDuration) * 100}%`,
            width: `${((pp.end - pp.start) / game.axisDuration) * 100}%`,
          }}
        />
      ))}
      {game.periods.slice(1).map((p) => (
        <span
          key={p.number}
          className={styles.periodDivider}
          style={{ left: `${(p.start / game.axisDuration) * 100}%` }}
        />
      ))}
      {player.shifts.map((shift, i) => (
        <span
          key={i}
          className={`${styles.shift} ${group === "F" ? styles.forward : group === "D" ? styles.defense : styles.goalie}`}
          title={`${player.fullName ?? player.name} · ${formatClock(shift.start)}–${formatClock(shift.end)} · ${formatClock(shift.end - shift.start)} TOI`}
          style={{
            left: `${(shift.start / game.axisDuration) * 100}%`,
            width: `${((shift.end - shift.start) / game.axisDuration) * 100}%`,
          }}
        />
      ))}
      {game.events
        .filter((e) => e.goal && e.playerId === player.id)
        .map((e) => (
          <span
            key={e.id}
            className={styles.goalMarker}
            title={`${player.name} goal at ${formatClock(e.time)}`}
            style={{ left: `${(e.time / game.axisDuration) * 100}%` }}
          />
        ))}
    </div>
  );
});


const useBrowserLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

// FLIP keeps keyed table rows and their shift bars intact while active players change order.
function useAnimatedRows(ref: RefObject<HTMLDivElement>, order: string, layout: string) {
  const previous = useRef({ layout: "", tops: new Map<string, number>() });
  useBrowserLayoutEffect(() => {
    const rows = Array.from(ref.current?.querySelectorAll<HTMLTableRowElement>("tr[data-player-id]") ?? []);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tops = new Map<string, number>();
    const origin = ref.current?.getBoundingClientRect().top ?? 0;
    rows.forEach(row => {
      const id = row.dataset.playerId!;
      const transform = getComputedStyle(row).transform;
      const translation = transform && transform !== "none" ? new DOMMatrixReadOnly(transform).m42 : 0;
      const top = row.getBoundingClientRect().top - translation - origin;
      const oldTop = previous.current.tops.get(id);
      row.getAnimations?.().forEach(animation => animation.cancel());
      tops.set(id, top);
      if (!reduced && previous.current.layout === layout && oldTop !== undefined && row.animate) {
        const distance = oldTop + translation - top;
        if (Math.abs(distance) > 1) row.animate(
          [{ transform: `translateY(${distance}px)` }, { transform: "translateY(0)" }],
          { duration: 260, easing: "cubic-bezier(0.2, 0, 0, 1)" },
        );
      }
    });
    previous.current = { layout, tops };
  }, [ref, order, layout]);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const cancel = () => ref.current?.getAnimations?.({ subtree: true }).forEach(animation => animation.cancel());
    media.addEventListener("change", cancel);
    return () => { media.removeEventListener("change", cancel); cancel(); };
  }, [ref]);
}
