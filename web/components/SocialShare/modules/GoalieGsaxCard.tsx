import type { SharePostCardProps } from "lib/socialShare/modules/contract";
import { goalieGsaxRanks, GSAX_SHOWN, type GoalieGsaxData, type GoalieGsaxRow, type GoalieGsaxSettings } from "lib/socialShare/modules/goalieGsax";
import { boardSides, bothSidesNote, countOf, largestShown } from "lib/socialShare/modules/shared/goalieBoards";
import { PostEmpty } from "./kit";
import { GoalieBoards, GoalieIdent, HeatTile } from "./GoalieBoards";
import styles from "./GoalieGsaxCard.module.scss";

const signed = (value: number | null, digits: number) => value === null ? "—" : `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(digits)}`;
export default function GoalieGsaxCard({ data, logos }: SharePostCardProps<GoalieGsaxSettings, GoalieGsaxData>) {
  const { sides, onBoth } = boardSides(data.rows, goalieGsaxRanks, data.board, GSAX_SHOWN), largest = largestShown(sides, row => row.gsax);
  const renderRow = (row: GoalieGsaxRow, rank: number) => {
    const team = row.teams[row.teams.length - 1];
    return <div className={styles.goalie} data-testid="goalie-gsax-row">
      <GoalieIdent rank={rank} team={team} logo={team ? logos[team] : null} name={row.name ?? String(row.goalieId)}
        detail={`${row.missing ? `${row.covered} of ${row.appearances}` : row.covered} GP · xGA ${row.xgAgainst.toFixed(2)} · GA ${row.goalsAgainst} · SA ${row.shotsAgainst ?? "—"}`} />
      <HeatTile value={row.gsax} text={signed(row.gsax, 2)} caption="GSAx" largest={largest} />
    </div>;
  };
  return <div className={styles.card} data-testid="goalie-gsax-card">
    <h3 className={styles.lead}><small>{data.windowLabel}.</small> NST model, {data.strengthLabel}, through {data.nstThrough}</h3>
    {data.ranked ? <GoalieBoards sides={sides} rowKey={row => row.goalieId} renderRow={renderRow} note={bothSidesNote(onBoth.length, data.ranked)} /> : <PostEmpty>No goalie has {countOf(data.minAppearances, "appearance")} at {data.minCoverage}% NST coverage</PostEmpty>}
    <p className={styles.legend}>GSAx = NST expected goals against − goals against. Above 0: fewer goals allowed than this model expected.</p>
  </div>;
}
