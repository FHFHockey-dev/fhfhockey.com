import type { SharePostCardProps } from "lib/socialShare/modules/contract";
import { bookLabel, moneylineLabel, ordinalRank, ROLE_HANDLE_INK, ROLE_TONES, shownLine, RISKY_LENS_LABELS, RISKY_TILE_LIMIT, riskyGameSides, riskyLensMeaning, riskyRowsForLens, type RiskyGameLine, type RiskyPair, type RiskyRow, type RiskySide, type RiskyStartsData, type RiskyStartsSettings } from "lib/socialShare/modules/riskyStarts";
import { NO_UPCOMING_LABEL, strengthShare } from "lib/socialShare/modules/shared/goalieInventory.sources";
import { PostEmpty, PostTeamMark } from "./kit";
import styles from "./RiskyStartsCard.module.scss";

const dayLabel = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
/** Only a known second night prints; rested or unknown says nothing. */
const restLabel = (row: RiskyRow) => row.teamSecondNight && row.opponentSecondNight ? "Both on a B2B" : row.teamSecondNight ? `${row.team} on a B2B` : row.opponentSecondNight ? `${row.opponent} on a B2B` : null;
/** Inline so the PNG keeps the tile's edge. */
const TILE_EDGE = { border: "1.5px solid rgba(255,255,255,0.3)", borderRadius: 10, boxShadow: "0 2px 6px rgba(0,0,0,0.45)" } as const;
const COLORS = { home: "#4be08f", away: "#ff6b6b", flagged: "#2a7fb8", plain: "#3a4a57", track: "rgba(255,255,255,0.07)", missing: "#ffcc33", triangle: "#ffffff" } as const;

/** One team's half of a row, its value printed over a bar that grows out from the centre label. Longer is stronger. No rank gives a dashed empty track. */
function SideBar({ side, placement, flagged }: { side: RiskySide | undefined; placement: "home" | "away"; flagged: boolean }) {
  if (!side) return <span className={styles.side} data-side={placement} data-empty="" />;
  const share = strengthShare(side), width = share === null ? 0 : share * 100, value = side.metric.value === null ? "—" : side.metric.value.toFixed(side.digits), rank = side.metric.leagueRank === null ? "—" : ordinalRank(side.metric.leagueRank);
  return <span className={styles.side} data-side={placement} data-team={side.team}>
    <svg viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true">{share === null
      ? <rect data-testid="risky-bar" data-mark="missing" fill="none" stroke={COLORS.missing} strokeWidth="1" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" x="0" y="0" width="100" height="10" />
      : <><rect fill={COLORS.track} x="0" y="0" width="100" height="10" /><rect data-testid="risky-bar" data-mark="bar" fill={flagged ? COLORS.flagged : COLORS.plain} x={(placement === "home" ? 100 - width : 0).toFixed(2)} y="0" width={width.toFixed(2)} height="10" /></>}</svg>
    <b>{value} {side.label.toUpperCase()} | {rank}</b>
  </span>;
}
function Edge({ points, team }: { points: "left" | "right"; team: string }) {
  return <svg data-testid="risky-edge" data-points={points} data-winner={team} viewBox="0 0 8 10" width="8" height="10" aria-hidden="true"><polygon fill={COLORS.triangle} points={points === "left" ? "8,0 8,10 0,5" : "0,0 0,10 8,5"} /></svg>;
}
function Pair({ pair, home, away }: { pair: RiskyPair; home: string; away: string }) {
  return <div className={styles.pair} data-testid="risky-pair" data-pair={pair.id} data-flagged={pair.flagged || undefined}>
    <SideBar side={pair.sides.find(side => side.team === home)} placement="home" flagged={pair.flagged} />
    <span className={styles.label}>{pair.winner === home && <Edge points="left" team={home} />}{pair.label}{pair.winner === away && <Edge points="right" team={away} />}</span>
    <SideBar side={pair.sides.find(side => side.team === away)} placement="away" flagged={pair.flagged} />
  </div>;
}
function Goalies({ side, placement }: { side: ReturnType<typeof riskyGameSides>["home"]; placement: "home" | "away" }) {
  return <p className={styles.goalies} data-testid="risky-goalies" data-side={placement} data-team={side.team} data-subject={side.subject || undefined}>
    {side.goalies.length ? side.goalies.slice(0, 2).map(goalie => <span key={goalie.goalieId}><b>{goalie.name}</b> {goalie.starts === null ? "—" : goalie.starts}/{goalie.teamGames}
      <em data-testid="risky-role" data-role={goalie.role.kind} className={styles.role} style={{ background: ROLE_TONES[goalie.role.kind].fill, color: ROLE_TONES[goalie.role.kind].ink }}>{goalie.role.label}</em>
      {goalie.role.handle && <small data-testid="risky-handle" style={{ color: ROLE_HANDLE_INK }}>{goalie.role.handle}</small>}</span>) : <span data-testid="risky-goalies-empty">No goalie listed</span>}
  </p>;
}
function Moneyline({ team, price }: { team: string; price: number }) {
  return <strong className={styles.moneyline} data-testid="risky-moneyline" data-team={team}>{moneylineLabel(price)}</strong>;
}
function Tile({ row, rows, line, lens, logos }: { row: RiskyRow; rows: readonly RiskyRow[]; line: RiskyGameLine | undefined; lens: RiskyStartsSettings["lens"]; logos: Record<string, string | null> }) {
  const { home, away } = riskyGameSides(rows, row), rest = restLabel(row);
  return <div className={styles.tile} style={TILE_EDGE} data-testid="risky-row" data-team={row.team} data-game={row.gameId}>
    <div className={styles.head}>
      <span className={styles.teamHead}><b style={{ color: COLORS.home }}>HOME</b><PostTeamMark team={home.team} logo={logos[home.team]} size={32} />{line && <Moneyline team={line.home} price={line.homeMoneyline} />}</span>
      <span className={styles.when}>{dayLabel(row.date)}{rest && <> · {rest}</>}{line && <em data-testid="risky-line" data-source={line.source}>{`${line.total === null ? "" : `O/U ${line.total} · `}${bookLabel(line.book)}`}</em>}</span>
      <span className={styles.teamHead} data-side="away">{line ? <Moneyline team={line.away} price={line.awayMoneyline} /> : <span />}<PostTeamMark team={away.team} logo={logos[away.team]} size={32} /><b style={{ color: COLORS.away }}>AWAY</b></span>
    </div>
    <div className={styles.pairs}>{row.lenses[lens].map(pair => <Pair key={pair.id} pair={pair} home={home.team} away={away.team} />)}</div>
    <div className={styles.goalieSides}><Goalies side={home} placement="home" /><Goalies side={away} placement="away" /></div>
  </div>;
}
export default function RiskyStartsCard({ data, settings, logos }: SharePostCardProps<RiskyStartsSettings, RiskyStartsData>) {
  const rows = riskyRowsForLens(data.rows, settings.lens), shown = rows.slice(0, RISKY_TILE_LIMIT);
  if (!data.rows.length) return <PostEmpty>{NO_UPCOMING_LABEL}: {data.periodLabel}</PostEmpty>;
  return <div className={styles.card}>
    <p className={styles.legend} data-testid="risky-legend"><b data-testid="risky-period">{data.periodLabel}</b> · <b>{RISKY_LENS_LABELS[settings.lens]}</b> · Blue: {riskyLensMeaning(settings.lens)}</p>
    {shown.length ? <div className={styles.grid} data-full={shown.length > 4 || undefined}>{shown.map(row => <Tile key={`${row.gameId}:${row.team}`} row={row} rows={data.rows} line={shownLine(data.lines[row.gameId])} lens={settings.lens} logos={logos} />)}</div>
      : <PostEmpty>No team-night has a flagged pairing in this lens</PostEmpty>}
  </div>;
}
