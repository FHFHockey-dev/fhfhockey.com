import type { SharePostCardProps } from "lib/socialShare/modules/contract";
import { GSAX_SHOWN, gsaxLagLabel, type GoalieGsaxData, type GoalieGsaxRow, type GoalieGsaxSettings } from "lib/socialShare/modules/goalieGsax";
import { PostEmpty, PostTable, type PostColumn } from "./kit";
import styles from "./GoalieGsaxCard.module.scss";

const signed = (value: number | null, digits: number) => value === null ? "—" : `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(digits)}`;
const minutes = (seconds: number | null) => {
  if (seconds === null) return "—";
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
};

export default function GoalieGsaxCard({ data }: SharePostCardProps<GoalieGsaxSettings, GoalieGsaxData>) {
  const ranked = data.rows.filter(row => row.rank !== null), shown = ranked.slice(0, GSAX_SHOWN);
  const lag = data.lagDays ? `, ${gsaxLagLabel(data.lagDays)} behind NHL.com (${data.wgoThrough}); later appearances not counted: ${data.appearancesBehindNst}` : "";
  const columns: PostColumn<GoalieGsaxRow>[] = [
    { id: "rank", label: "RK", numeric: true, cell: row => row.rank },
    { id: "goalie", label: "GOALIE", cell: row => <span className={styles.goalie}><b>{row.name ?? row.goalieId}</b><small>{row.teams.join(", ")}</small></span> },
    { id: "gsax", label: "GSAX", numeric: true, cell: row => <b>{signed(row.gsax, 2)}</b> },
    { id: "per60", label: "/60", numeric: true, cell: row => signed(row.gsaxPer60, 2) },
    { id: "xga", label: "XGA", numeric: true, cell: row => row.xgAgainst.toFixed(2) },
    { id: "ga", label: "GA", numeric: true, cell: row => row.goalsAgainst },
    { id: "sa", label: "SA", numeric: true, cell: row => row.shotsAgainst ?? "—" },
    { id: "toi", label: "TOI", numeric: true, cell: row => minutes(row.toiSeconds) },
    { id: "games", label: "GS / REL", numeric: true, cell: row => `${row.starts} / ${row.relief}` },
    { id: "coverage", label: "NST", numeric: true, cell: row => `${row.covered}/${row.appearances}` },
  ];
  return <div className={styles.card}>
    <p className={styles.note}><b>NST model, {data.strengthLabel}.</b> GSAx = expected goals against − goals against, through {data.nstThrough}{lag}. Above 0 means fewer goals allowed than this model expected.</p>
    {shown.length ? <PostTable columns={columns} rows={shown} rowKey={row => row.goalieId} /> : <PostEmpty>No goalie has {data.minAppearances} appearances at {data.minCoverage}% NST coverage</PostEmpty>}
    <p className={styles.note}>
      {data.fhfhModel.reason} Not comparable across models or strengths, and says nothing about the next start.
      {data.unadmitted ? ` ${data.unadmitted} goalies unranked for sample or coverage.` : ""}
      {data.unmatchedNstRows ? ` ${data.unmatchedNstRows} NST rows dropped: no NHL.com appearance for that goalie and date.` : ""}
      {ranked.length > shown.length ? ` Showing ${shown.length} of ${ranked.length} ranked goalies.` : ""}
    </p>
  </div>;
}
