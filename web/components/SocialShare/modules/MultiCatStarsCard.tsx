import { STALE_SETTINGS_NOTE } from "lib/socialShare/modules/bshBoard";
import type { SharePostCardProps } from "lib/socialShare/modules/contract";
import { multiCatCurrent, multiCatFormulaLabel, multiCatScoreText, radarRuns, type MultiCatData, type MultiCatPercentile, type MultiCatRow, type MultiCatSettings } from "lib/socialShare/modules/multiCatStars";
import { PostEmpty, PostTeamMark } from "./kit";
import styles from "./MultiCatStarsCard.module.scss";

const MISSING = "—";
const count = (value: number | null) => value === null ? MISSING : value;
const shortDate = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const span = (from: string, to: string) => `${shortDate(from)}-${shortDate(to)}`;

/* Colours are SVG attributes: the PNG capture drops stylesheet fills. Wigo's radar colours, on its 0 to 100 scale with rings every 20. */
const FILL = "rgba(43, 168, 242, 0.65)", LINE = "#07aae2", RING = "rgba(255, 255, 255, 0.28)", SPOKE = "rgba(255, 255, 255, 0.2)", TEXT = "#ffffff", VALUE = "#4ca7dd", GAP = "#f5b342";
const WIDTH = 320, HEIGHT = 292, CENTER_X = WIDTH / 2, CENTER_Y = HEIGHT / 2, RADIUS = 104, RINGS = [20, 40, 60, 80, 100];
const at = (spoke: number, spokes: number, radius: number) => {
  const angle = spoke / spokes * 2 * Math.PI;
  return { x: CENTER_X + radius * Math.sin(angle), y: CENTER_Y - radius * Math.cos(angle) };
};
const points = (spokes: readonly { x: number; y: number }[]) => spokes.map(point => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");

function Radar({ spokes }: { spokes: readonly MultiCatPercentile[] }) {
  const values = spokes.map(spoke => spoke.percentile), { closed, runs } = radarRuns(values), total = spokes.length;
  const vertex = (index: number) => at(index, total, RADIUS * values[index]! / 100);
  return <svg className={styles.radar} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Season percentile radar" data-testid="multi-cat-radar" data-closed={closed} preserveAspectRatio="xMidYMid meet">
    {RINGS.map(ring => <polygon key={ring} points={points(spokes.map((_, index) => at(index, total, RADIUS * ring / 100)))} fill="none" stroke={RING} strokeWidth="1" />)}
    {spokes.map((spoke, index) => { const end = at(index, total, RADIUS); return <line key={spoke.id} x1={CENTER_X} y1={CENTER_Y} x2={end.x} y2={end.y} stroke={SPOKE} strokeWidth="1" />; })}
    {closed ? <polygon points={points(runs[0].map(vertex))} fill={FILL} stroke={LINE} strokeWidth="2.5" data-testid="multi-cat-shape" />
      : runs.map(run => run.length > 1 ? <polyline key={run[0]} points={points(run.map(vertex))} fill="none" stroke={LINE} strokeWidth="2.5" data-testid="multi-cat-open-line" /> : null)}
    {spokes.map((spoke, index) => {
      if (values[index] === null) { const end = at(index, total, RADIUS); return <circle key={spoke.id} cx={end.x} cy={end.y} r="6" fill="none" stroke={GAP} strokeWidth="2" strokeDasharray="3 2" data-testid="multi-cat-gap" />; }
      const point = vertex(index);
      return <circle key={spoke.id} cx={point.x} cy={point.y} r="3.5" fill={LINE} stroke={TEXT} strokeWidth="1" />;
    })}
    {spokes.map((spoke, index) => {
      const { x, y } = at(index, total, RADIUS + 10), side = Math.sin(index / total * 2 * Math.PI), anchor = Math.abs(side) < 0.01 ? "middle" : side > 0 ? "start" : "end";
      const vertical = Math.cos(index / total * 2 * Math.PI), top = y + (vertical > 0.5 ? -14 : vertical < -0.5 ? 8 : -4);
      return <text key={spoke.id} textAnchor={anchor} fontWeight="800" fontSize="19">
        <tspan x={x} y={top} fill={TEXT}>{spoke.label}</tspan>
        <tspan x={x} y={top + 20} fill={spoke.percentile === null ? GAP : VALUE}>{spoke.percentile === null ? MISSING : spoke.percentile.toFixed(0)}</tspan>
      </text>;
    })}
  </svg>;
}

function Panel({ row, data, logo }: { row: MultiCatRow; data: MultiCatData; logo: string | null | undefined }) {
  const { week } = row;
  return <article className={styles.panel} data-testid="multi-cat-panel">
    <header className={styles.ident}>
      <b className={styles.rank}>{row.rank}</b>
      {row.team && <PostTeamMark team={row.team} logo={logo} size={44} />}
      <span className={styles.who}>
        <b className={styles.name}>{row.name}</b>
        <small>{[row.position, row.teams.length > 1 ? row.teams.join("/") : null, `${week.games} GP`].filter(Boolean).join(" · ")} · {count(week.points)} PTS {count(week.blocks)} BLK {count(week.shots)} SOG {count(week.hits)} HIT</small>
      </span>
      <span className={styles.score} data-testid="multi-cat-score"><b>{multiCatScoreText(row.score, data.basis)}</b><small>{data.basis === "perGame" ? "PER GAME" : "WEEK"}</small></span>
    </header>
    <div className={styles.body}>
      <div className={styles.chart}><p className={styles.caption}>SEASON PERCENTILE</p><Radar spokes={row.radar} /></div>
      <div className={styles.stats} data-testid="multi-cat-table">
        <p className={styles.caption}>LAST 7 DAYS</p>
        <div className={styles.line}><span>GP</span><b>{row.last7.games}</b></div>
        {row.last7.values.map(value => <div key={value.id} className={styles.line}><span>{value.label}</span>{value.total === null ? <b className={styles.missing}>{MISSING}</b> : <b>{value.id === "plusMinus" && value.total > 0 ? `+${value.total}` : value.total}</b>}</div>)}
      </div>
    </div>
  </article>;
}

export default function MultiCatStarsCard({ data, settings, logos }: SharePostCardProps<MultiCatSettings, MultiCatData>) {
  if (!multiCatCurrent(data, settings)) return <PostEmpty>{STALE_SETTINGS_NOTE}</PostEmpty>;
  if (!data.rows.length) return <PostEmpty>{data.basis === "perGame" ? `No skater has ${data.minGp} GP this fantasy week yet` : "No skater qualifies this fantasy week"}</PostEmpty>;
  const inProgress = data.through < data.weekEnd ? `, through ${shortDate(data.through)}` : "";
  return <div className={styles.board}>
    <p className={styles.legend}>
      <b>RANKED</b> fantasy week {span(data.weekStart, data.weekEnd)}{inProgress}: {multiCatFormulaLabel(data.formula)}, {data.basis === "perGame" ? `per game, ${data.minGp}+ GP` : "total"}. Ties share a rank.{data.tiedBeyondCut ? ` ${data.tiedBeyondCut} more tied at #${data.rows[data.rows.length - 1].rank}.` : ""}<br />
      <b>TABLE</b> last 7 days, {span(data.last7From, data.last7To)}. <b>RADAR</b> season per-game percentile among {data.cohort.percentile} skaters.
    </p>
    <div className={styles.grid}>{data.rows.map(row => <Panel key={row.playerId} row={row} data={data} logo={row.team ? logos[row.team] : null} />)}</div>
  </div>;
}
