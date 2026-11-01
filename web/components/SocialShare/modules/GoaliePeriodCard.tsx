import type { SharePostCardProps } from "lib/socialShare/modules/contract";
import { goaliePeriodRanks, TGV_GRADES, TGV_LABEL, type GoaliePeriodData, type GoaliePeriodRow, type GoaliePeriodSettings, type TgvResult, type TgvSeasonWeek } from "lib/socialShare/modules/goaliePeriod";
import { boardSides, bothSidesNote, countOf, largestShown } from "lib/socialShare/modules/shared/goalieBoards";
import { categoryById, CATEGORY_COUNTS_LABEL, cellTone } from "lib/socialShare/modules/shared/categoryCounts";
import { PostEmpty } from "./kit";
import { GoalieBoards, GoalieIdent, HeatTile } from "./GoalieBoards";
import styles from "./GoaliePeriodCard.module.scss";

/* html-to-image does not carry class styles onto SVG children, so the line sets its colours as attributes. */
const LINE = "#63D2F5", SELECTED = "#ffffff";
const signed = (value: number) => value > 0 ? `+${value}` : value < 0 ? `−${Math.abs(value)}` : "0";

const SPARK_WIDTH = 78, SPARK_HEIGHT = 40, SPARK_PAD = 5, POINTS_LOW = 1, POINTS_HIGH = 20;
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
/** The selected week's grade, or for a month each assigned week's first letter. */
function selectedGrade(tgv: TgvResult) {
  const selected = tgv.series.filter(week => week.selected);
  if (selected.length === 1) return selected[0].ranking ?? "No grade";
  return selected.map(week => week.ranking?.[0] ?? "–").join(" ");
}

export default function GoaliePeriodCard({ data, logos }: SharePostCardProps<GoaliePeriodSettings, GoaliePeriodData>) {
  const { period } = data, noun = period.kind === "month" ? "Month" : "Week";
  if (!data.ranked) return <PostEmpty>No goalie has {countOf(data.minStarts, "official start")} in {period.label}{period.kind === "month" ? ". Choose a month in the settings" : ""}</PostEmpty>;
  const { sides, onBoth } = boardSides(data.rows, goaliePeriodRanks, data.board);
  const winners = data.rows.filter(row => data.winners.includes(row.goalieId)), largest = largestShown(sides, row => row.categoryCounts.gameNet);
  const strip = data.tgvLeague, plural = strip !== null && strip.weeks.length > 1;
  const renderRow = (row: GoaliePeriodRow, rank: number) => {
    const counts = row.categoryCounts, name = row.name ?? String(row.goalieId), team = row.teams[row.teams.length - 1];
    return <div className={styles.goalie} data-testid="goalie-period-row">
      <div className={styles.top}>
        <GoalieIdent rank={rank} team={team} logo={team ? logos[team] : null} name={name} detail={[...row.teams.length > 1 ? [row.teams.join(", ")] : [], countOf(counts.starts, "start"), ...counts.relief ? [`${counts.relief} relief`] : [], `week net ${signed(counts.weekNet)}`].join(" · ")} />
        <div className={styles.tgv} data-group="tgv">
          {row.tgv.counts ? <>
            <span className={styles.chip}><span className={styles.grade} data-selected-grade="">{selectedGrade(row.tgv)}</span><small>{row.tgv.points} pts</small></span>
            <GradeLine series={row.tgv.series} name={name} />
          </> : <span className={styles.unavailable}>Unavailable</span>}
        </div>
        <span data-group="category-counts"><HeatTile value={counts.gameNet} text={signed(counts.gameNet)} caption="games net" largest={largest} /></span>
      </div>
      <div className={styles.tiles} data-group="category-counts" data-many={data.categories.length > 6 || undefined}>
        {counts.byCategory.map(entry => <span key={entry.category} className={styles.tile} data-tone={cellTone(entry.game)} data-category={entry.category}>{categoryById(entry.category).label} {entry.game.compared ? `${entry.game.better}/${entry.game.compared}` : "—"}</span>)}
      </div>
    </div>;
  };
  return <div className={styles.card} data-testid="goalie-period-card">
    <header className={styles.lead}>
      <h3><small>{period.label}.</small> {data.board === "worst" ? `Worst of the ${noun}` : `Goalie of the ${noun}`}: <span data-testid="goalie-period-winners">{winners.map(row => row.name ?? row.goalieId).join(" · ")}</span></h3>
    </header>
    <GoalieBoards sides={sides} rowKey={row => row.goalieId} renderRow={renderRow} headNote={TGV_LABEL} note={bothSidesNote(onBoth.length, data.ranked)} />
    <section className={styles.strip} data-testid="tgv-existing">
      <h4>{TGV_LABEL}: {plural ? "goalie weeks" : "goalies"} at each grade{strip ? `, week${plural ? "s" : ""} ${strip.weeks.join(", ")}` : ""}</h4>
      {strip ? <div className={styles.stripCells}>{TGV_GRADES.map(grade => <span key={grade} className={styles.stripCell} data-strip-grade={grade}><small>{grade}</small><b>{strip.counts[grade]}</b><small>{strip.points[grade]} pts</small></span>)}</div>
        : <p className={styles.stripEmpty}>Unavailable</p>}
    </section>
    <p className={styles.legend} data-testid="category-counts">{CATEGORY_COUNTS_LABEL}: W 2/2 = better than league average in 2 of 2 starts.</p>
  </div>;
}
