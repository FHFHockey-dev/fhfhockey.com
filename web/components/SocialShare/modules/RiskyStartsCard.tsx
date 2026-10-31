import type { SharePostCardProps } from "lib/socialShare/modules/contract";
import { RISKY_LENSES, RISKY_LENS_LABELS, RISKY_TILE_LIMIT, riskyFlags, riskyLensMeaning, riskyRowsForLens, type RiskyPair, type RiskyRow, type RiskyStartsData, type RiskyStartsSettings } from "lib/socialShare/modules/riskyStarts";
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
    <dl className={styles.pairs}>{row.lenses[lens].map(pair => <Pair key={pair.id} pair={pair} />)}</dl>
    <p className={styles.flags}>{RISKY_LENSES.map(item => <span key={item} data-active={item === lens || undefined}>{RISKY_LENS_LABELS[item]} {riskyFlags(row, item)}</span>)}</p>
    <p className={styles.goalies}>{row.goalies.slice(0, 2).map(goalie => `${goalie.name} ${goalie.starts === null ? "—" : goalie.starts}/${goalie.teamGames} GS · ${status(goalie)}`).join(" | ")}</p>
  </div>;
}
export default function RiskyStartsCard({ snapshot, data, settings, logos }: SharePostCardProps<RiskyStartsSettings, RiskyStartsData>) {
  const rows = riskyRowsForLens(data.rows, settings.lens), shown = rows.slice(0, RISKY_TILE_LIMIT);
  return <div className={styles.card}>
    <p className={styles.lens}><b>{RISKY_LENS_LABELS[settings.lens]}</b> {riskyLensMeaning(settings.lens)} Top third of the league, season to date; #1 is the highest value.</p>
    {shown.length ? <div className={styles.grid}>{shown.map(row => <Tile key={`${row.gameId}:${row.team}`} row={row} lens={settings.lens} logos={logos} generatedAt={snapshot.generatedAt} />)}</div>
      : <PostEmpty>No team-night has a flagged pairing in this lens</PostEmpty>}
    {rows.length > shown.length && <p className={styles.more}>Showing {shown.length} of {rows.length} flagged team-nights</p>}
    <p className={styles.note} data-testid="risky-correlation-note">{data.correlationNote}</p>
    <p className={styles.note} data-testid="risky-confirmation-note">{data.confirmationNote}</p>
  </div>;
}
