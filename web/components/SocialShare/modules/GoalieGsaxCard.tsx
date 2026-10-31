import type { SharePostCardProps } from "lib/socialShare/modules/contract";
import { goalieGsaxRanks, GSAX_SHOWN, gsaxLagLabel, type GoalieGsaxData, type GoalieGsaxRow, type GoalieGsaxSettings } from "lib/socialShare/modules/goalieGsax";
import { boardSides, bothSidesNote, largestShown } from "lib/socialShare/modules/shared/goalieBoards";
import { PostEmpty } from "./kit";
import { GoalieBoards, GoalieIdent, HeatTile } from "./GoalieBoards";
import styles from "./GoalieGsaxCard.module.scss";

const signed = (value: number | null, digits: number) => value === null ? "—" : `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(digits)}`;
const minutes = (seconds: number | null) => {
  if (seconds === null) return "—";
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
};

export default function GoalieGsaxCard({ data, logos }: SharePostCardProps<GoalieGsaxSettings, GoalieGsaxData>) {
  const { sides, onBoth } = boardSides(data.rows, goalieGsaxRanks, data.board, GSAX_SHOWN), largest = largestShown(sides, row => row.gsax);
  const lag = data.lagDays ? `, ${gsaxLagLabel(data.lagDays)} behind NHL.com (${data.wgoThrough})` : "";
  const later = data.lagDays && data.window !== "week" ? ` Later appearances not counted: ${data.appearancesBehindNst}.` : "";
  const smallPool = bothSidesNote(onBoth.length, data.ranked);
  const renderRow = (row: GoalieGsaxRow, rank: number) => {
    const team = row.teams[row.teams.length - 1];
    return <div className={styles.goalie} data-testid="goalie-gsax-row">
      <GoalieIdent rank={rank} team={team} logo={team ? logos[team] : null} name={row.name ?? String(row.goalieId)}
        detail={`${row.teams.join(", ")} · ${row.starts} starts · ${row.relief} relief · xGA ${row.xgAgainst.toFixed(2)} · GA ${row.goalsAgainst} · SA ${row.shotsAgainst ?? "—"} · TOI ${minutes(row.toiSeconds)} · NST ${row.covered}/${row.appearances} · per 60 ${signed(row.gsaxPer60, 2)}`} />
      <HeatTile value={row.gsax} text={signed(row.gsax, 2)} caption="GSAx" largest={largest} />
    </div>;
  };
  return <div className={styles.card}>
    <header className={styles.lead}>
      <p>{data.windowLabel}</p>
      <h3>NST model, {data.strengthLabel}. NST through {data.nstThrough}{lag}.</h3>
    </header>
    {data.ranked ? <GoalieBoards sides={sides} rowKey={row => row.goalieId} renderRow={renderRow} /> : <PostEmpty>No goalie has {data.minAppearances} appearances at {data.minCoverage}% NST coverage</PostEmpty>}
    <div className={styles.legend}>
      <p>GSAx = NST expected goals against − goals against. Above 0 means fewer goals allowed than this model expected. It is one model&apos;s context beside SV% and GAA, not comparable across models or strengths, and says nothing about the next start.</p>
      <p>
        {data.fhfhModel.reason}{later}
        {data.unadmitted ? ` ${data.unadmitted} goalies unranked for sample or coverage.` : ""}
        {data.unmatchedNstRows ? ` ${data.unmatchedNstRows} NST rows dropped: no NHL.com appearance for that goalie and date.` : ""}
        {smallPool ? ` ${smallPool}` : ""}
      </p>
    </div>
  </div>;
}
