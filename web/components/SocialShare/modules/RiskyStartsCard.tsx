import type { SharePostCardProps } from "lib/socialShare/modules/contract";
import { RISKY_LENS_LABELS, RISKY_TILE_LIMIT, riskyLensMeaning, riskyRowsForLens, type RiskyPair, type RiskyRow, type RiskyStartsData, type RiskyStartsSettings } from "lib/socialShare/modules/riskyStarts";
import { confirmationFreshness, confirmationLabel, metricLabel } from "lib/socialShare/modules/shared/goalieInventory.sources";
import { PostEmpty, PostTeamMark } from "./kit";
import styles from "./RiskyStartsCard.module.scss";

const dayLabel = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const restLabel = (row: RiskyRow) => row.teamSecondNight === null || row.opponentSecondNight === null ? "Back-to-back unknown" : row.teamSecondNight && row.opponentSecondNight ? "Both on a back-to-back" : row.teamSecondNight ? `${row.team} on a back-to-back` : row.opponentSecondNight ? `${row.opponent} on a back-to-back` : "Both rested";

function Pair({ pair }: { pair: RiskyPair }) {
  return <>
    <dt>{pair.label}</dt>
    <dd data-flagged={pair.flagged || undefined}>{pair.sides.map(side => `${side.team} ${side.label} ${metricLabel(side.metric, side.digits)}`).join(" vs ")}</dd>
  </>;
}
function Tile({ row, lens, logos, generatedAt }: { row: RiskyRow; lens: RiskyStartsSettings["lens"]; logos: Record<string, string | null>; generatedAt: string }) {
  const status = (goalie: RiskyRow["goalies"][number]) => [confirmationLabel(goalie.confirmation, row.conflicting), confirmationFreshness(goalie.confirmation, generatedAt)].filter(Boolean).join(" ");
  return <div className={styles.tile} data-testid="risky-row" data-team={row.team} data-game={row.gameId}>
    <div className={styles.head}>
      <PostTeamMark team={row.team} logo={logos[row.team]} size={36} />
      <strong>{row.team} {row.home ? "vs" : "@"} {row.opponent}</strong>
      <PostTeamMark team={row.opponent} logo={logos[row.opponent]} size={28} />
      <span>{dayLabel(row.date)} · {restLabel(row)}</span>
    </div>
    <dl className={styles.pairs} data-count={row.lenses[lens].length}>{row.lenses[lens].map(pair => <Pair key={pair.id} pair={pair} />)}</dl>
    <p className={styles.goalies}>{row.goalies.slice(0, 2).map(goalie => <span key={goalie.goalieId}><b>{goalie.name}</b> {goalie.starts === null ? "—" : goalie.starts}/{goalie.teamGames} GS · {status(goalie)}</span>)}</p>
  </div>;
}
export default function RiskyStartsCard({ snapshot, data, settings, logos }: SharePostCardProps<RiskyStartsSettings, RiskyStartsData>) {
  const rows = riskyRowsForLens(data.rows, settings.lens), shown = rows.slice(0, RISKY_TILE_LIMIT);
  return <div className={styles.card}>
    <p className={styles.legend} data-testid="risky-legend"><b>{RISKY_LENS_LABELS[settings.lens]}</b> · Flag: {riskyLensMeaning(settings.lens)}, top third · {shown.length} of {rows.length} · No win or start odds · {data.confirmationLegend}</p>
    {shown.length ? <div className={styles.grid} data-full={shown.length > 4 || undefined}>{shown.map(row => <Tile key={`${row.gameId}:${row.team}`} row={row} lens={settings.lens} logos={logos} generatedAt={snapshot.generatedAt} />)}</div>
      : <PostEmpty>No team-night has a flagged pairing in this lens</PostEmpty>}
  </div>;
}
