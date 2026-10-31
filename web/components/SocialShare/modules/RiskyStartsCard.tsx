import type { SharePostCardProps } from "lib/socialShare/modules/contract";
import { RISKY_LENS_LABELS, RISKY_TILE_LIMIT, riskyLensMeaning, riskyRowsForLens, type RiskyPair, type RiskyRow, type RiskySide, type RiskyStartsData, type RiskyStartsSettings } from "lib/socialShare/modules/riskyStarts";
import { confirmationFreshness, confirmationLabel, metricLabel, rankBand, rankShare, RANK_BANDS, type RankBand } from "lib/socialShare/modules/shared/goalieInventory.sources";
import { PostEmpty, PostTeamMark } from "./kit";
import styles from "./RiskyStartsCard.module.scss";

const dayLabel = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const restLabel = (row: RiskyRow) => row.teamSecondNight === null || row.opponentSecondNight === null ? "Back-to-back unknown" : row.teamSecondNight && row.opponentSecondNight ? "Both on a back-to-back" : row.teamSecondNight ? `${row.team} on a back-to-back` : row.opponentSecondNight ? `${row.opponent} on a back-to-back` : "Both rested";

const BAR_SPAN = 99, BAR_HEIGHT = 10;
/** One side of the head-to-head, growing out from the centre by league rank. A metric with no rank has a dashed empty track, never a short bar. */
function SideBar({ side, flip }: { side: RiskySide; flip: boolean }) {
  const start = flip ? 0 : 200 - BAR_SPAN, share = rankShare(side.metric), band = rankBand(side.metric);
  if (share === null || band === null) return <rect data-testid="risky-bar" data-mark="missing" data-side={side.label} fill="none" stroke="#ffcc33" strokeWidth="1" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" x={start} y="0.5" width={BAR_SPAN} height={BAR_HEIGHT - 1} />;
  const width = share * BAR_SPAN;
  return <>
    <rect fill="rgba(255,255,255,0.08)" x={start} y="0" width={BAR_SPAN} height={BAR_HEIGHT} />
    <rect data-testid="risky-bar" data-mark={band} data-side={side.label} data-rank={side.metric.leagueRank} fill={RANK_BANDS[band].fill} x={(flip ? BAR_SPAN - width : start).toFixed(2)} y="0" width={width.toFixed(2)} height={BAR_HEIGHT} />
  </>;
}
function Pair({ pair }: { pair: RiskyPair }) {
  const [left, right] = pair.sides, text = (side?: RiskySide) => side ? `${side.team} ${side.label} ${metricLabel(side.metric, side.digits)}` : "";
  return <div className={styles.pair} data-flagged={pair.flagged || undefined}>
    <dt>{pair.label}</dt>
    <dd>{text(left)}</dd>
    <dd className={styles.bars}><svg viewBox={`0 0 200 ${BAR_HEIGHT}`} preserveAspectRatio="none" aria-hidden="true">{pair.sides.map((side, index) => <SideBar key={side.label} side={side} flip={index === 0} />)}</svg></dd>
    <dd>{text(right)}</dd>
  </div>;
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
    <p className={styles.legend} data-testid="risky-legend"><b>{RISKY_LENS_LABELS[settings.lens]}</b> · Flag: {riskyLensMeaning(settings.lens)}, top third · {shown.length} of {rows.length} · Bar = league rank <span className={styles.key}>{(Object.keys(RANK_BANDS) as RankBand[]).map(band => <span key={band}><i style={{ background: RANK_BANDS[band].fill }} />{RANK_BANDS[band].label}</span>)}</span> · No win or start odds · {data.confirmationLegend}</p>
    {shown.length ? <div className={styles.grid} data-full={shown.length > 4 || undefined}>{shown.map(row => <Tile key={`${row.gameId}:${row.team}`} row={row} lens={settings.lens} logos={logos} generatedAt={snapshot.generatedAt} />)}</div>
      : <PostEmpty>No team-night has a flagged pairing in this lens</PostEmpty>}
  </div>;
}
