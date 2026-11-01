import type { SharePostCardProps } from "lib/socialShare/modules/contract";
import { STALE_SETTINGS_NOTE } from "lib/socialShare/modules/bshBoard";
import { goalieRanking, isGoalieView, isHandBuilt, lineChipText, percentLabel, ppChipText, rankingText, slateLabel, STANDOUT_MAX_ROWS, standoutPool, standoutRows, standoutsCurrent, statText, viewTitle, type LastNightsStandoutsData, type LastNightsStandoutsSettings, type StandoutGoalie, type StandoutSkater, type StandoutStat } from "lib/socialShare/modules/lastNightsStandouts";
import { ownershipLabel } from "lib/socialShare/modules/shared/definitions";
import { formatSeconds } from "lib/socialShare/modules/whatChanged";
import { SkaterBoard, SkaterCell, skaterLogoSize } from "./BshBoardCard";
import { PostEmpty, PostTeamMark, type PostColumn } from "./kit";
import boardStyles from "./BshBoardCard.module.scss";
import styles from "./LastNightsStandoutsCard.module.scss";

/** Colours are inline: the PNG capture can drop what a stylesheet sets. The sign prints too, so colour is never alone. */
const UP = "#00ff99", DOWN = "#ff6384", QUIET = "#b8c0c8";
const changeColour = (change: number | null) => change === null ? QUIET : change > 0 ? UP : change < 0 ? DOWN : QUIET;
const tileTint = (change: number | null) => change === null || Math.round(change) === 0 ? "rgba(255,255,255,0.07)" : change > 0 ? "rgba(0,255,153,0.14)" : "rgba(255,99,132,0.16)";
const chipTint = (known: boolean) => known ? "rgba(77,166,222,0.32)" : "rgba(255,255,255,0.08)";
const ppTint = (pp: StandoutSkater["role"]["pp"]) => pp === 1 ? "rgba(229,174,91,0.42)" : pp === 2 ? "rgba(229,174,91,0.22)" : "rgba(255,255,255,0.08)";
/** Fewer skaters get larger type, so a short card has no dead band. */
const rowType = (rows: number) => rows >= 7 ? 24 : rows >= 5 ? 28 : rows >= 3 ? 34 : 42;

export const StandoutChips = ({ row }: { row: Pick<StandoutSkater, "role" | "lineAsOf"> }) => <span className={styles.chips}>
  <span className={styles.chip} data-testid="line-chip" style={{ backgroundColor: chipTint(row.role.line !== "unknown" && !row.lineAsOf), color: "#ffffff" }}>{lineChipText(row)}</span>
  <span className={styles.chip} data-testid="pp-chip" style={{ backgroundColor: ppTint(row.role.pp), color: "#ffffff" }}>{ppChipText(row.role)}</span>
</span>;
const Tile = ({ stat }: { stat: StandoutStat }) => <span className={styles.tile} data-testid="stat-tile" data-stat={stat.id} style={{ backgroundColor: tileTint(stat.change) }}>
  <b style={{ color: "#ffffff" }}>{statText(stat)}</b>
  <span className={styles.tileSide}><small style={{ color: QUIET }}>{stat.label}</small><i style={{ color: changeColour(stat.change) }}>{percentLabel(stat.change)}</i></span>
</span>;
function SkaterRow({ row, rank, logo, logoSize }: { row: StandoutSkater; rank: number | null; logo: string | null | undefined; logoSize: number }) {
  return <div className={styles.row} data-testid="standout-row">
    <div className={styles.who}>
      {rank !== null && <span className={styles.rank} style={{ color: QUIET }}>{rank}</span>}
      {row.team && <PostTeamMark team={row.team} logo={logo} size={logoSize} />}
      <span className={styles.name} style={{ color: "#ffffff" }}>{row.name ?? `Player ${row.playerId}`}</span>
      <span className={styles.pos} style={{ color: QUIET }}>{row.position}</span>
      <StandoutChips row={row} />
      <strong className={styles.goalLine} data-testid="goal-line" style={{ color: "#ffffff" }}>{row.goalLine}</strong>
      <span className={styles.owned} style={{ color: QUIET }}>{ownershipLabel(row.ownership)} ROST</span>
    </div>
    <div className={styles.tiles}>{row.stats.map(stat => <Tile key={stat.id} stat={stat} />)}</div>
  </div>;
}
const Banner = ({ settings, slate }: { settings: LastNightsStandoutsSettings; slate: string }) => <h3 className={styles.banner} data-testid="standouts-view" style={{ color: "#ffffff" }}>{viewTitle(settings)}<span style={{ color: QUIET }}>{slateLabel(slate)}</span></h3>;

function GoalieCard({ data, settings, logos }: Pick<SharePostCardProps<LastNightsStandoutsSettings, LastNightsStandoutsData>, "data" | "settings" | "logos">) {
  const { rows, qualified } = goalieRanking(data, settings), size = skaterLogoSize(rows.length), missing = data.goalies.filter(row => row.gsax === null).length;
  const text = (value: number | null) => value === null ? <span className={boardStyles.missing}>—</span> : value;
  const columns: PostColumn<StandoutGoalie & { rank: number }>[] = [
    { id: "rank", label: "RK", numeric: true, cell: row => row.rank },
    { id: "goalie", label: "GOALIE", cell: row => <SkaterCell row={{ name: row.name ?? `Goalie ${row.goalieId}`, position: null, team: row.team, teams: [] }} logo={logos[row.team]} size={size} /> },
    { id: "owned", label: "ROST", numeric: true, cell: row => ownershipLabel(row.ownership) },
    { id: "saves", label: "SV", numeric: true, cell: row => text(row.saves) },
    { id: "shots", label: "SA", numeric: true, cell: row => text(row.shotsAgainst) },
    { id: "ga", label: "GA", numeric: true, cell: row => text(row.goalsAgainst) },
    { id: "pct", label: "SV%", numeric: true, cell: row => row.savePct === null ? text(null) : row.savePct.toFixed(3).replace(/^0/, "") },
    { id: "toi", label: "TOI", numeric: true, cell: row => row.toiSeconds === null ? text(null) : formatSeconds(row.toiSeconds) },
    { id: "gsax", label: "GSAx", numeric: true, cell: row => row.gsax === null ? text(null) : <span data-testid="goalie-gsax" style={{ color: changeColour(row.gsax) }}>{row.gsax > 0 ? "+" : row.gsax < 0 ? "−" : ""}{Math.abs(row.gsax).toFixed(2)}</span> },
  ];
  const legend = <>Ranked by SV%, then saves, with {settings.minShotsAgainst}+ shots against: top {rows.length} of {qualified}.{missing ? <span data-testid="nst-goalie-note" style={{ color: "#ffcc33" }}> NST has no row yet for {missing} of {data.goalies.length} goalies, so their GSAx prints —.</span> : null}</>;
  return <SkaterBoard banner={<Banner settings={settings} slate={data.slate} />} legend={legend} columns={columns} rows={rows.map((row, index) => ({ ...row, rank: index + 1 }))} rowKey={row => row.goalieId} empty={rows.length ? null : "No goalie on this slate meets the shots-against minimum"} compact />;
}

export default function LastNightsStandoutsCard({ data, settings, logos }: SharePostCardProps<LastNightsStandoutsSettings, LastNightsStandoutsData>) {
  if (!standoutsCurrent(data, settings)) return <PostEmpty>{STALE_SETTINGS_NOTE}</PostEmpty>;
  if (isGoalieView(settings.view)) return <GoalieCard data={data} settings={settings} logos={logos} />;
  const rows = standoutRows(data, settings), hand = isHandBuilt(settings.view), type = rowType(rows.length);
  if (!rows.length) return <div className={styles.board}><Banner settings={settings} slate={data.slate} /><div className={styles.blank} data-testid="standouts-blank">{hand ? `Pick up to ${STANDOUT_MAX_ROWS} skaters in the sidebar to build this card.` : "No skater played on this slate in this view."}</div></div>;
  const pool = standoutPool(data, settings).length;
  const legend = hand ? "Picked by hand, in this order." : `Top ${rows.length} of ${pool} by ${rankingText(settings.rankBy)}.`;
  return <div className={styles.board}>
    <Banner settings={settings} slate={data.slate} />
    <p className={styles.legend} style={{ color: QUIET }} data-testid="standouts-legend">{legend} % is against the player&apos;s own season per game before this slate; — means no baseline or value.{rows.some(row => row.lineAsOf) ? " A dated line is from that earlier game." : ""}</p>
    <div className={styles.rows} style={{ fontSize: type }} data-few={rows.length <= 2 || undefined}>{rows.map((row, index) => <SkaterRow key={row.playerId} row={row} rank={hand ? null : index + 1} logo={row.team ? logos[row.team] : null} logoSize={Math.round(type * 1.3)} />)}</div>
  </div>;
}
