import type { SharePostCardProps } from "lib/socialShare/modules/contract";
import { GOALIE_PERIOD_SHOWN, type GoaliePeriodData, type GoaliePeriodRow, type GoaliePeriodSettings } from "lib/socialShare/modules/goaliePeriod";
import { categoryById, CATEGORY_COUNTS_LABEL, type CellCounts } from "lib/socialShare/modules/shared/categoryCounts";
import { PostEmpty, PostTable, type PostColumn } from "./kit";
import styles from "./GoaliePeriodCard.module.scss";

const triple = (counts: CellCounts) => `${counts.above}–${counts.below}–${counts.tied}`;
const signed = (value: number) => value > 0 ? `+${value}` : value < 0 ? `−${Math.abs(value)}` : "0";
const tgvText = (row: GoaliePeriodRow) => row.tgv.state === "unavailable" ? "Unavailable" : row.tgv.grades.length ? row.tgv.grades.map(grade => `W${grade.week} ${grade.ranking ?? "Unclassified"}`).join(", ") : "No week";
const rankOf = (data: GoaliePeriodData, row: GoaliePeriodRow) => data.board === "worst" ? row.categoryCounts.worstRank : row.categoryCounts.rank;

export default function GoaliePeriodCard({ data }: SharePostCardProps<GoaliePeriodSettings, GoaliePeriodData>) {
  const { period } = data, noun = period.kind === "month" ? "Month" : "Week";
  if (!data.ranked) return <PostEmpty>No goalie has {data.minStarts} official starts in {period.label}{period.kind === "month" ? ". Choose a month in the settings" : ""}</PostEmpty>;
  const ranked = data.rows.filter(row => rankOf(data, row) !== null), shown = ranked.slice(0, GOALIE_PERIOD_SHOWN);
  const winners = ranked.filter(row => data.winners.includes(row.goalieId));
  const columns: PostColumn<GoaliePeriodRow>[] = [
    { id: "rank", label: "RK", numeric: true, cell: row => rankOf(data, row) },
    { id: "goalie", label: "GOALIE", cell: row => <span className={styles.goalie}><b>{row.name ?? row.goalieId}</b><small>{row.teams.join(", ")}</small></span> },
    { id: "starts", label: "GS", numeric: true, cell: row => row.categoryCounts.starts },
    { id: "relief", label: "REL", numeric: true, cell: row => row.categoryCounts.relief },
    ...data.categories.map((id): PostColumn<GoaliePeriodRow> => {
      const category = categoryById(id);
      return { id, label: `${category.label}${category.direction === "lower" ? " ↓" : ""}`, numeric: true, cell: row => {
        const counts = row.categoryCounts.byCategory.find(entry => entry.category === id)!;
        return <span className={styles.counts}><span>{triple(counts.game)}</span><small>{triple(counts.week)}</small></span>;
      } };
    }),
    { id: "compared", label: "CMP", numeric: true, cell: row => <span className={styles.counts}><span>{row.categoryCounts.game.compared}</span><small>{row.categoryCounts.week.compared}</small></span> },
    { id: "net", label: "NET", numeric: true, cell: row => <span className={styles.counts}><span>{signed(row.categoryCounts.gameNet)}</span><small>{signed(row.categoryCounts.weekNet)}</small></span> },
  ];
  const tgvColumns: PostColumn<GoaliePeriodRow>[] = [
    { id: "goalie", label: "GOALIE", cell: row => row.name ?? row.goalieId },
    { id: "tgv", label: "GRADE", cell: tgvText },
  ];
  return <div className={styles.card}>
    <header className={styles.lead}>
      <p>{data.board === "worst" ? `Worst of the ${noun}` : `Goalie of the ${noun}`}{winners.length > 1 ? `: ${winners.length} tied` : ""}, {period.label}</p>
      <h3 data-testid="goalie-period-winners">{winners.map(row => row.name ?? row.goalieId).join(" · ")}</h3>
    </header>
    <section data-testid="category-counts">
      <h4 className={styles.method}>{CATEGORY_COUNTS_LABEL}</h4>
      <PostTable columns={columns} rows={shown} rowKey={row => row.goalieId} />
      <p className={styles.note}>Each cell is above–below–tied against the league baseline: games on top, weeks beneath. ↓ means lower is better, so below counts as better there. NET is better minus worse. CMP is cells compared. Rank: game net, then week net, then better ÷ compared.</p>
      <p className={styles.note}>
        {period.weeks.map(week => `Week ${week.week}: ${week.poolGoalies} goalies, ${week.officialStarts} starts`).join(" · ")}. Unavailable cells: {data.unavailableCells}.
        {data.reliefOnly.length ? ` Relief-only, no cells: ${data.reliefOnly.map(goalie => `${goalie.name ?? goalie.goalieId} (W${goalie.weeks.join(", W")})`).join(", ")}.` : ""}
        {ranked.length > shown.length ? ` Showing ${shown.length} of ${ranked.length} ranked goalies.` : ""}
      </p>
    </section>
    <section data-testid="tgv-existing">
      <h4 className={styles.method}>{shown[0].tgv.label}</h4>
      <PostTable columns={tgvColumns} rows={shown} rowKey={row => row.goalieId} />
    </section>
  </div>;
}
