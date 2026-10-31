import type { SharePostCardProps } from "lib/socialShare/modules/contract";
import { GOALIE_PERIOD_SHOWN, TGV_GRADES, TGV_LABEL, type GoaliePeriodData, type GoaliePeriodRow, type GoaliePeriodSettings, type TgvSeasonWeek } from "lib/socialShare/modules/goaliePeriod";
import { categoryById, CATEGORY_COUNTS_LABEL, cellTone, type CellCounts } from "lib/socialShare/modules/shared/categoryCounts";
import { PostEmpty } from "./kit";
import styles from "./GoaliePeriodCard.module.scss";

/* html-to-image does not carry class styles onto SVG children, so marks and lines set their colours as attributes. */
const BETTER = "#00ff99", WORSE = "#ff6384", LINE = "#63D2F5", SELECTED = "#ffffff";
const signed = (value: number) => value > 0 ? `+${value}` : value < 0 ? `−${Math.abs(value)}` : "0";
const rankOf = (data: GoaliePeriodData, row: GoaliePeriodRow) => data.board === "worst" ? row.categoryCounts.worstRank : row.categoryCounts.rank;

const Mark = ({ kind }: { kind: "better" | "worse" }) => <svg className={styles.mark} width="10" height="9" viewBox="0 0 10 9" aria-hidden="true"><path d={kind === "better" ? "M5 0L10 9H0Z" : "M5 9L10 0H0Z"} fill={kind === "better" ? BETTER : WORSE} /></svg>;
function Tile({ counts, label }: { counts: CellCounts; label: string }) {
  const tone = cellTone(counts);
  if (tone === "none") return <span className={styles.tile} data-tone="none" aria-label={`${label}: not compared`}>—</span>;
  return <span className={styles.tile} data-tone={tone} aria-label={`${label}: ${counts.better} better than league, ${counts.worse} worse${counts.tied ? `, ${counts.tied} level` : ""}`}>
    <span><Mark kind="better" />{counts.better}</span><span><Mark kind="worse" />{counts.worse}</span>{counts.tied > 0 && <span data-level="">={counts.tied}</span>}
  </span>;
}

const SPARK_WIDTH = 92, SPARK_HEIGHT = 44, SPARK_PAD = 6, POINTS_LOW = 1, POINTS_HIGH = 20;
/** Weekly grade points on one fixed scale for every goalie. Lines join consecutive graded weeks only: a gap is a break, never 0. */
function GradeLine({ series, name }: { series: TgvSeasonWeek[]; name: string }) {
  const x = (index: number) => series.length === 1 ? SPARK_WIDTH / 2 : SPARK_PAD + index * (SPARK_WIDTH - 2 * SPARK_PAD) / (series.length - 1);
  const y = (points: number) => SPARK_HEIGHT - SPARK_PAD - (points - POINTS_LOW) / (POINTS_HIGH - POINTS_LOW) * (SPARK_HEIGHT - 2 * SPARK_PAD);
  const segments = series.flatMap((week, index) => {
    const next = series[index + 1];
    return week.points !== null && next && next.points !== null ? [`M${x(index).toFixed(1)} ${y(week.points).toFixed(1)}L${x(index + 1).toFixed(1)} ${y(next.points).toFixed(1)}`] : [];
  });
  return <svg className={styles.spark} width={SPARK_WIDTH} height={SPARK_HEIGHT} viewBox={`0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}`} role="img"
    aria-label={`${name}, TGV grade points by week: ${series.map(week => `week ${week.week} ${week.points ?? "no grade"}`).join(", ")}`} data-sparkline={series.map(week => week.points ?? "gap").join(",")}>
    {series.map((week, index) => week.selected ? <line key={`s${week.week}`} x1={x(index)} x2={x(index)} y1={1} y2={SPARK_HEIGHT - 1} stroke={SELECTED} strokeOpacity="0.45" strokeWidth="1" data-selected-week={week.week} /> : null)}
    {segments.map(d => <path key={d} d={d} fill="none" stroke={LINE} strokeWidth="2" strokeLinecap="round" />)}
    {series.map((week, index) => week.points === null
      ? <path key={`g${week.week}`} d={`M${(x(index) - 2).toFixed(1)} ${SPARK_HEIGHT - 2}H${(x(index) + 2).toFixed(1)}`} stroke={LINE} strokeOpacity="0.5" strokeWidth="1.5" data-gap="" />
      : <circle key={`p${week.week}`} cx={x(index)} cy={y(week.points)} r={week.selected ? 3.5 : 2.2} fill={week.selected ? SELECTED : LINE} data-point="" />)}
  </svg>;
}

export default function GoaliePeriodCard({ data }: SharePostCardProps<GoaliePeriodSettings, GoaliePeriodData>) {
  const { period } = data, noun = period.kind === "month" ? "Month" : "Week";
  if (!data.ranked) return <PostEmpty>No goalie has {data.minStarts} official starts in {period.label}{period.kind === "month" ? ". Choose a month in the settings" : ""}</PostEmpty>;
  const ranked = data.rows.filter(row => rankOf(data, row) !== null), shown = ranked.slice(0, GOALIE_PERIOD_SHOWN);
  const winners = ranked.filter(row => data.winners.includes(row.goalieId)), many = data.categories.length > 6 || undefined;
  const countColumns = { gridTemplateColumns: `44px repeat(${data.categories.length}, minmax(0, 1fr)) 70px` };
  const lastWeek = period.weeks[period.weeks.length - 1]?.week;
  const selectedWord = period.kind === "month" ? "this month's weeks" : "this week";
  return <div className={styles.card} data-testid="goalie-period-card" data-many={many}>
    <header className={styles.lead}>
      <p>{data.board === "worst" ? `Worst of the ${noun}` : `Goalie of the ${noun}`}{winners.length > 1 ? `: ${winners.length} tied` : ""}, {period.label}</p>
      <h3 data-testid="goalie-period-winners">{winners.map(row => row.name ?? row.goalieId).join(" · ")}</h3>
    </header>
    <div className={styles.head}>
      <span className={styles.rankHead}>RK</span><span>GOALIE</span>
      <div data-testid="category-counts">
        <h4 className={styles.method}>{CATEGORY_COUNTS_LABEL}</h4>
        <div className={styles.counts} style={countColumns}><span />{data.categories.map(id => <span key={id} className={styles.columnHead}>{categoryById(id).label}</span>)}<span className={styles.columnHead}>NET</span></div>
      </div>
      <div data-testid="tgv-existing">
        <h4 className={styles.method}>{TGV_LABEL}</h4>
        <div className={styles.grades}>{TGV_GRADES.map(grade => <span key={grade} className={styles.columnHead}>{grade}</span>)}<span className={styles.columnHead}>PTS</span><span className={styles.columnHead}>BY WEEK</span></div>
      </div>
    </div>
    {shown.map(row => {
      const counts = row.categoryCounts, name = row.name ?? String(row.goalieId), selected = new Set(row.tgv.series.filter(week => week.selected).map(week => week.ranking));
      return <div key={row.goalieId} className={styles.row} data-testid="goalie-period-row">
        <span className={styles.rank}>{rankOf(data, row)}</span>
        <span className={styles.goalie}><b>{name}</b><small>{row.teams.join(", ")} · {counts.starts} starts · {counts.relief} relief</small></span>
        <div className={styles.counts} style={countColumns} data-group="category-counts">
          <span className={styles.unit}>Games</span>
          {counts.byCategory.map(entry => <Tile key={entry.category} counts={entry.game} label={`${categoryById(entry.category).label}, games`} />)}
          <span className={styles.net}>{signed(counts.gameNet)} <small>of {counts.game.compared}</small></span>
          <span className={styles.unit}>Weeks</span>
          {counts.byCategory.map(entry => <Tile key={entry.category} counts={entry.week} label={`${categoryById(entry.category).label}, weeks`} />)}
          <span className={styles.net}>{signed(counts.weekNet)} <small>of {counts.week.compared}</small></span>
        </div>
        <div className={styles.grades} data-group="tgv">
          {row.tgv.counts ? <>
            {TGV_GRADES.map(grade => <span key={grade} className={styles.grade} data-grade={grade} data-selected={selected.has(grade) || undefined} data-empty={row.tgv.counts![grade] === 0 || undefined}>{row.tgv.counts![grade]}</span>)}
            <span className={styles.points}>{row.tgv.points}</span>
            <GradeLine series={row.tgv.series} name={name} />
          </> : <span className={styles.unavailable}>Unavailable</span>}
        </div>
      </div>;
    })}
    <div className={styles.legend}>
      <p data-group="category-counts"><b>{CATEGORY_COUNTS_LABEL}.</b> <Mark kind="better" /> better than the league average, <Mark kind="worse" /> worse, = level (shown only when it happens). Games: each official start against that week&apos;s average. Weeks: the goalie&apos;s week totals against the week&apos;s average. Lower GAA already counts as better, so every category reads the same way. NET is better minus worse, out of the comparisons made. Rank is games NET, then weeks NET, then share of game comparisons better.</p>
      <p data-group="tgv"><b>{TGV_LABEL}.</b> Weeks at each grade through week {lastWeek}, outlined for {selectedWord}. PTS adds 20, 10, 5, 3 or 1 a week. The line plots those points week by week, white at {selectedWord}; a break is a week with no grade. A separate method: these grades are not applied to Category Counts.</p>
      <p>
        {period.weeks.map(week => `Week ${week.week}: ${week.poolGoalies} goalies, ${week.officialStarts} starts`).join(" · ")}. Unavailable comparisons: {data.unavailableCells}.
        {data.reliefOnly.length ? ` Relief-only, not compared: ${data.reliefOnly.map(goalie => `${goalie.name ?? goalie.goalieId} (W${goalie.weeks.join(", W")})`).join(", ")}.` : ""}
        {ranked.length > shown.length ? ` Showing ${shown.length} of ${ranked.length} ranked goalies.` : ""}
      </p>
    </div>
  </div>;
}
