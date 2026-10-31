import { BASIS_LABELS, formatVolume, shotScale, VOLUME_NOTE, windowLabel, workloadLevel, type BusyQuietData, type BusyQuietRow, type BusyQuietSettings, type ShotPoint } from "lib/socialShare/modules/busyQuiet";
import type { SharePostCardProps } from "lib/socialShare/modules/contract";
import { GoalieIdent } from "./GoalieBoards";
import { PostEmpty } from "./kit";
import styles from "./BusyQuietCard.module.scss";

/* html-to-image does not carry class styles onto SVG children, so the line sets its colours as attributes. */
const LINE = "#63D2F5", WORKLOAD = "99, 210, 245";
const SPARK_WIDTH = 90, SPARK_HEIGHT = 48, SPARK_PAD = 5;
/** Past this many games the dots would merge into a bar: the line carries it, and only a game with no neighbour keeps its dot. */
const DOTS_THROUGH = 20;

/** Shots against by appearance on the card's one scale. Lines join consecutive known games only: a gap is a break, never 0. */
function ShotLine({ series, scale, name }: { series: readonly ShotPoint[]; scale: { low: number; high: number } | null; name: string }) {
  const x = (index: number) => series.length === 1 ? SPARK_WIDTH / 2 : SPARK_PAD + index * (SPARK_WIDTH - 2 * SPARK_PAD) / (series.length - 1);
  const y = (shots: number) => !scale || scale.high === scale.low ? SPARK_HEIGHT / 2 : SPARK_HEIGHT - SPARK_PAD - (shots - scale.low) / (scale.high - scale.low) * (SPARK_HEIGHT - 2 * SPARK_PAD);
  const known = (index: number) => series[index]?.shots != null;
  return <svg className={styles.spark} width={SPARK_WIDTH} height={SPARK_HEIGHT} viewBox={`0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}`} role="img"
    aria-label={`${name}, shots against by game: ${series.map(point => point.shots ?? "no data").join(", ")}`} data-sparkline={series.map(point => point.shots ?? "gap").join(",")} data-scale={scale ? `${scale.low}-${scale.high}` : undefined}>
    {series.map((point, index) => point.shots !== null && known(index + 1) ? <path key={`s${point.gameId}`} d={`M${x(index).toFixed(1)} ${y(point.shots).toFixed(1)}L${x(index + 1).toFixed(1)} ${y(series[index + 1].shots!).toFixed(1)}`} fill="none" stroke={LINE} strokeWidth="2" strokeLinecap="round" data-segment="" /> : null)}
    {series.map((point, index) => {
      if (point.shots === null) return <path key={point.gameId} d={`M${(x(index) - 2).toFixed(1)} ${SPARK_HEIGHT - 2}H${(x(index) + 2).toFixed(1)}`} stroke={LINE} strokeOpacity="0.5" strokeWidth="1.5" data-gap="" />;
      if (series.length > DOTS_THROUGH && (known(index - 1) || known(index + 1))) return null;
      return point.relief
        ? <circle key={point.gameId} cx={x(index).toFixed(1)} cy={y(point.shots).toFixed(1)} r="2.5" fill="#101215" stroke={LINE} strokeWidth="1.5" data-point="" data-relief="" />
        : <circle key={point.gameId} cx={x(index).toFixed(1)} cy={y(point.shots).toFixed(1)} r="2.2" fill={LINE} data-point="" />;
    })}
  </svg>;
}

/** A large value whose fill strength follows how much work it is, in one hue: more shots are not better or worse goaltending. */
function WorkloadTile({ value, caption, low, high }: { value: number | null; caption: string; low: number; high: number }) {
  const level = workloadLevel(value, low, high), alpha = level === null ? 0 : Math.round((0.14 + 0.66 * level) * 100) / 100;
  const style = level === null ? undefined : { background: `rgba(${WORKLOAD}, ${alpha})`, color: alpha > 0.55 ? "#0b0f12" : "#ffffff" };
  return <span className={styles.tile} data-testid="workload-tile" data-level={level ?? undefined} style={style}><b>{formatVolume(value)}</b><small>{caption}</small></span>;
}

/** Rows share the height left in the body, so the boards fill it however many goalies qualify; a small pool stops short of oversized rows. */
const FILL_FROM_ROWS = 4;

export default function BusyQuietCard({ data, settings, logos }: SharePostCardProps<BusyQuietSettings, BusyQuietData>) {
  if (!data.busy.length && !data.quiet.length) return <PostEmpty>No goalie has {settings.minStarts} official starts in this window</PostEmpty>;
  const suffix = BASIS_LABELS[data.basis], shown = [...data.busy, ...data.quiet], scale = shotScale(shown);
  const volumes = shown.flatMap(row => row.volume.value === null ? [] : [row.volume.value]), low = Math.min(...volumes), high = Math.max(...volumes);
  const sides = ([["busy", "Busy", data.busy], ["quiet", "Quiet", data.quiet]] as const).filter(([, , rows]) => rows.length);
  const renderRow = (row: BusyQuietRow) => {
    const name = row.name ?? `Goalie ${row.goalieId}`, chances = row.teamChances;
    return <>
      <GoalieIdent rank={row.rank} team={row.team} logo={logos[row.team]} name={name} detail={<>
        <span className={styles.detail}>{row.short ? `${row.appearances}/${row.requested}` : row.appearances} GP · {row.starts} GS · {row.relief} relief · {row.totalShots ?? "—"} SA</span>
        <span className={styles.detail}>HD SHOTS{suffix} {row.danger.admitted ? formatVolume(row.danger.hd) : `— ${row.danger.covered}/${row.danger.expected}`} · TEAM SCA {chances.admitted ? formatVolume(chances.sca) : "—"} · HDCA {chances.admitted ? formatVolume(chances.hdca) : "—"}</span>
      </>} />
      <ShotLine series={row.series} scale={scale} name={name} />
      <WorkloadTile value={row.volume.value} caption={`SA${suffix}`} low={low} high={high} />
    </>;
  };
  return <div className={styles.card} data-testid="busy-quiet-card">
    <p className={styles.note}>{VOLUME_NOTE} {windowLabel(data.window)} through {data.through}. Line: SA by game{shown.some(row => row.series.some(point => point.relief)) ? ", open dot relief" : ""}.</p>
    <div className={styles.boards} data-sides={sides.length}>
      {sides.map(([kind, title, rows]) => {
        const track = rows.length >= FILL_FROM_ROWS ? "minmax(min-content, 1fr)" : "minmax(min-content, 130px)";
        return <section key={kind} className={styles.side} data-testid={`board-${kind}`} style={{ gridTemplateRows: `auto repeat(${rows.length}, ${track})` }}>
          <h3 className={styles.title}>{title}</h3>
          {rows.map(row => <div key={row.goalieId} className={styles.row}>{renderRow(row)}</div>)}
        </section>;
      })}
    </div>
  </div>;
}
