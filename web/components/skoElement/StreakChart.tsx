import { useEffect, useRef, useState } from "react";
import type { StreakGame, StreakPlayer } from "lib/skoElement/streakHistory";
import shared from "./SkoElement.module.scss";
import styles from "./StreakChart.module.scss";

const stateLabel = (value: string) => ({ hot: "Hot", cold: "Cold", neutral: "Neutral" }[value] ?? "Insufficient history");
const format = (value: number | null) => value === null ? "Unavailable" : value.toFixed(2);
const events = (g: StreakGame) => [g.breach && g.breach + " breach", g.confirmation && g.confirmation + " confirmation", g.exit && g.exit + " exit"].filter(Boolean).join(" · ");

function line(games: StreakGame[], field: "recent" | "reference", x: (i: number) => number, y: (n: number) => number) {
  return games.map((g, i) => {
    const n = g[field];
    if (n === null) return "";
    const move = i === 0 || games[i - 1][field] === null || games[i - 1].segment !== g.segment;
    return (move ? "M" : "L") + x(i) + "," + y(n);
  }).join(" ");
}

export default function StreakChart({ player, games, initialCutoff }: { player: StreakPlayer; games: StreakGame[]; initialCutoff: number | null }) {
  const [asOf, setAsOf] = useState(initialCutoff !== null);
  const [cutoff, setCutoff] = useState(initialCutoff ?? games.length - 1);
  const [selected, setSelected] = useState(initialCutoff ?? games.length - 1);
  const visible = asOf ? games.slice(0, cutoff + 1) : games;
  const chart = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = chart.current;
    const position = 48 + selected * 22;
    if (box && (position < box.scrollLeft + 22 || position > box.scrollLeft + box.clientWidth - 22)) {
      box.scrollLeft = position - box.clientWidth / 2;
    }
  }, [selected]);
  const chosen = visible[Math.min(selected, visible.length - 1)];
  if (!chosen) return <p>No played appearances retained.</p>;
  const selectedIndex = visible.indexOf(chosen);
  const x = (i: number) => 48 + i * 22;
  const maxPoints = Math.max(2, ...visible.map(g => Math.ceil(Math.max(g.points, g.recent ?? 0, g.reference ?? 0))));
  const y = (n: number) => 170 - 120 * n / maxPoints;
  const episodeGames = visible.filter(g => g.episode && g.segment === chosen.segment);
  // Use the selected run, the one exiting now, or the nearest known run in this uninterrupted segment.
  const near = episodeGames.reduce<StreakGame | undefined>((best, g) =>
    !best || Math.abs(visible.indexOf(g) - selectedIndex) < Math.abs(visible.indexOf(best) - selectedIndex) ? g : best, undefined);
  const episode = (chosen.exit && visible[selectedIndex - 1]?.episode) || chosen.episode || near?.episode;
  const segmentStart = visible.find(g => g.segment === chosen.segment);
  const activeStart = chosen.episode ? visible.find(g => g.episode === chosen.episode) : undefined;
  const first = episode ? visible.findIndex(g => g.episode === episode) : -1;
  const inside = episode ? visible.filter(g => g.episode === episode) : [];
  const last = inside.length ? visible.indexOf(inside[inside.length - 1]) : -1;
  const exit = last >= 0 && visible[last + 1]?.segment === visible[last].segment && visible[last + 1]?.exit === visible[last].state ? last + 1 : -1;
  function inspect(i: number) {
    setSelected(i);
    if (asOf) setCutoff(i);
  }
  const width = x(visible.length) + 16;
  const renderWindow = (center: number, offsets: number[], prefix: string) => <div className={styles.windows}>
    {offsets.map(d => {
      const i = center + d;
      const g = visible[i];
      const label = prefix + (d > 0 ? "+" : "") + (d || "");
      return g && g.segment === visible[center].segment ? <button type="button" key={d} className={shared.smallButton}
        onClick={() => inspect(i)}>{label} · {g.date} · {g.points} PTS</button> : <span key={d}>{label} · unavailable</span>;
    })}
  </div>;
  return <>
    <div className={shared.controls}>
      <label className={shared.control}>Time view<select value={asOf ? "asof" : "history"} onChange={e => {
        const next = e.target.value === "asof"; setAsOf(next); if (next) setCutoff(selectedIndex);
      }}><option value="history">Historical explanation</option><option value="asof">As known then</option></select></label>
      {asOf && <label className={shared.control}>Through appearance<input type="number" min={1} max={games.length} value={cutoff + 1}
        onChange={e => { const i = Math.min(games.length - 1, Math.max(0, Math.trunc(Number(e.target.value)) - 1)); setCutoff(i); setSelected(i); }} /></label>}
      <label className={shared.control}>Inspect appearance<select value={selectedIndex} onChange={e => inspect(Number(e.target.value))}>
        {visible.map((g, i) => <option key={g.id} value={i}>{i + 1} · {g.date} · {g.opponent}</option>)}
      </select></label>
    </div>
    {asOf && <p role="note">Through the selected game’s close, reconstructed from retained records. Historical publication and revision times are unavailable.</p>}
    <div><h2>{player.name} · Game log</h2>
      <p>Bars show game points. The solid line tracks the last 5 GP average. The dashed line shows the preceding 20 GP average.
        Two consecutive closes at least 0.40 points/GP above or below that reference confirm a streak.</p></div>
    <p className={styles.key}>H striped = hot · C dotted = cold · N = neutral · ? = insufficient history<br />
      △ first breach · ◆ confirmation · × first game outside</p>
    <div ref={chart} className={styles.scroll} tabIndex={0} role="group" aria-label="Scoring chart. Use left and right arrows to inspect games."
      onKeyDown={e => {
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          e.preventDefault(); const i = Math.max(0, Math.min(visible.length - 1, selectedIndex + (e.key === "ArrowLeft" ? -1 : 1)));
          inspect(i);
        }
      }}>
      <svg width={width} height={222} role="img" aria-label={player.name + " points per played game"}>
        <defs>
          <pattern id="sko-hot" width="7" height="7" patternUnits="userSpaceOnUse"><rect width="7" height="7" fill="#412e28" /><path d="M0 7L7 0" stroke="#765041" /></pattern>
          <pattern id="sko-cold" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#193541" /><circle cx="3" cy="3" r="1.2" fill="#49829c" /></pattern>
        </defs>
        {visible.map((g, i) => <rect key={g.id} x={x(i)-11} y={42} width={22} height={148} fill={g.state === "hot" || g.state === "cold" ? "url(#sko-" + g.state + ")" : "transparent"} />)}
        {Array.from({ length: maxPoints + 1 }, (_, n) => <g key={n}><line x1="35" x2={width-10} y1={y(n)} y2={y(n)} stroke="#596773" strokeDasharray="2 4" />
          <text x={20} y={y(n)+4}>{n}</text></g>)}
        {visible.map((g, i) => <g key={g.id}>
          <rect x={x(i)-5} y={y(g.points)-1} width={10} height={Math.max(2, 170-y(g.points))} fill="#c8d3dc" />
          <text x={x(i)} y={189}>{({ hot: "H", cold: "C", neutral: "N" }[g.state] ?? "?")}</text>
          {g.breach && <text x={x(i)} y={16}>△</text>}{g.confirmation && <text x={x(i)} y={30}>◆</text>}{g.exit && <text x={x(i)} y={42}>×</text>}
          {(i === 0 || (i+1) % 5 === 0) && <text x={x(i)} y={211}>{i+1}</text>}
        </g>)}
        <path d={line(visible, "recent", x, y)} fill="none" stroke="#ffb762" strokeWidth={3} />
        <path d={line(visible, "reference", x, y)} fill="none" stroke="#90ebf1" strokeWidth={3} strokeDasharray="5 3" />
        <rect x={x(selectedIndex)-10} y="4" width="20" height="188" rx="3" stroke="white" fill="none" />
        {visible.map((g, i) => <rect key={g.id} x={x(i)-11} y="0" width="22" height="195" fill="transparent"
          onMouseEnter={() => { if (!asOf) setSelected(i); }} onClick={() => inspect(i)}><title>{g.date} · {g.opponent} · {g.points} PTS · {stateLabel(g.state)}</title></rect>)}
      </svg>
    </div>
    <div className={styles.detail} aria-live="polite"><h3>{player.name} · {chosen.date} · {chosen.team} vs {chosen.opponent || "unknown opponent"}</h3>
      <p>Appearance {selectedIndex + 1} · Game {chosen.id} · {chosen.points} PTS · {stateLabel(chosen.state)}</p>
      <p>Last 5 GP {format(chosen.recent)} · Personal reference {format(chosen.reference)} points/GP</p>
      <p>{events(chosen) || "No transition recorded"} · {chosen.state === "unavailable" || chosen.reference === null ? "The retained history cannot establish a state at this close." : "Knowable after this game closed under the retained scoring record."}</p>
      {activeStart && <p>{activeStart.startUnknown ? "The first breach could predate reliable history. The start of this run is unknown." : "First confirmable after the " + activeStart.date + " close."}</p>}
      {segmentStart?.boundary && (chosen === segmentStart || chosen.reference === null) && <p>History boundary · {segmentStart.date} · {segmentStart.boundary.replace(/_/g, " ")}</p>}</div>
    <section><h3>{first < 0 ? "Episode windows" : stateLabel(visible[first].state) + " episode nearest the selected game"}</h3>
      {first < 0 ? <p>No confirmed episode in this visible segment.</p> : <>
        <p>{visible[first].startUnknown ? "Start unknown at the history boundary" : "Confirmed " + visible[first].date} · Last inside in view {visible[last].date}
          {" · "}{exit < 0 ? "Exit unobserved in this view" : "First outside " + visible[exit].date}</p>
        {!visible[first].startUnknown && <><h4>Lead-in to confirmation</h4>{renderWindow(first, [-5,-4,-3,-2,-1], "S")}</>}
        {exit >= 0 && <><h4>Two games either side of exit</h4>{renderWindow(exit, [-2,-1,0,1,2], "E")}</>}
      </>}</section>
  </>;
}
