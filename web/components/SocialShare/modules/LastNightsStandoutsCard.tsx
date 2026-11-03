import type { SharePostCardProps } from "lib/socialShare/modules/contract";
import { STALE_SETTINGS_NOTE } from "lib/socialShare/modules/bshBoard";
import { goalieChangeText, goalieLastText, goalieRank, goalieRanking, goalieRankingText, goalieStdText, goalieTone, isGoalieView, isHandBuilt, isOlderSlate, lineChipText, percentLabel, ppChipText, rankingText, slateLabel, slateWord, STANDOUT_MAX_ROWS, standoutPool, standoutRows, standoutsCurrent, statText, stdText, viewTitle, type LastNightsStandoutsData, type LastNightsStandoutsSettings, type StandoutSkater } from "lib/socialShare/modules/lastNightsStandouts";
import { ownershipLabel } from "lib/socialShare/modules/shared/definitions";
import { PostEmpty, PostTeamMark } from "./kit";
import styles from "./LastNightsStandoutsCard.module.scss";

/** Colours are inline: the PNG capture can drop what a stylesheet sets. The sign prints too, so colour is never alone. */
const UP = "#00ff99", DOWN = "#ff6384", QUIET = "#b8c0c8";
type Tone = "good" | "bad" | "neutral";
export const CHANGE_COLOUR: Record<Tone, string> = { good: UP, bad: DOWN, neutral: QUIET };
const TILE_TINT: Record<Tone, string> = { good: "rgba(0,255,153,0.14)", bad: "rgba(255,99,132,0.16)", neutral: "rgba(255,255,255,0.07)" };
export const changeTone = (change: number | null): Tone => change === null || Math.round(change) === 0 ? "neutral" : change > 0 ? "good" : "bad";
const chipTint = (known: boolean) => known ? "rgba(77,166,222,0.32)" : "rgba(255,255,255,0.08)";
const ppTint = (pp: StandoutSkater["role"]["pp"]) => pp === 1 ? "rgba(229,174,91,0.42)" : pp === 2 ? "rgba(229,174,91,0.22)" : "rgba(255,255,255,0.08)";
/** Fewer skaters get larger type, so a short card has no dead band. */
const rowType = (rows: number) => rows >= 7 ? 24 : rows >= 5 ? 26 : rows >= 3 ? 34 : 38;

export const StandoutChips = ({ row }: { row: Pick<StandoutSkater, "role" | "lineAsOf"> }) => <span className={styles.chips}>
  <span className={styles.chip} data-testid="line-chip" style={{ backgroundColor: chipTint(row.role.line !== "unknown" && !row.lineAsOf), color: "#ffffff" }}>{lineChipText(row)}</span>
  <span className={styles.chip} data-testid="pp-chip" style={{ backgroundColor: ppTint(row.role.pp), color: "#ffffff" }}>{ppChipText(row.role)}</span>
</span>;
/** Every chip reads the same way: its label and the change, then last night beside the STD it is compared with. */
const Tile = ({ id, label, value, std, change, tone }: { id: string; label: string; value: string; std: string; change: string; tone: Tone }) => <span className={styles.tile} data-testid="stat-tile" data-stat={id} data-tone={tone} style={{ backgroundColor: TILE_TINT[tone] }}>
  <span className={styles.tileLine}><small style={{ color: QUIET }}>{label}</small><i data-testid="tile-change" style={{ color: CHANGE_COLOUR[tone] }}>{change}</i></span>
  <span className={styles.tileLine}><b style={{ color: "#ffffff" }}>{value}</b><small data-testid="tile-std" style={{ color: QUIET }}>STD {std}</small></span>
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
    <div className={styles.tiles}>{row.stats.map(stat => <Tile key={stat.id} id={stat.id} label={stat.label} value={statText(stat)} std={stdText(stat)} change={percentLabel(stat.change)} tone={changeTone(stat.change)} />)}</div>
  </div>;
}
/** A blank date whose latest night is still loading shows the last complete one, and says so on the card. */
const FallbackNote = ({ data }: { data: LastNightsStandoutsData }) => data.fallback ? <span data-testid="standouts-fallback" style={{ color: "#ffcc33" }}> {slateLabel(data.fallback.date)} is still loading, so this is {slateLabel(data.slate)}.</span> : null;
const Banner = ({ settings, slate }: { settings: LastNightsStandoutsSettings; slate: string }) => <h3 className={styles.banner} data-testid="standouts-view" style={{ color: "#ffffff" }}>{viewTitle(settings)}<span style={{ color: QUIET }}>{slateLabel(slate)}</span></h3>;

function GoalieCard({ data, settings, logos }: Pick<SharePostCardProps<LastNightsStandoutsSettings, LastNightsStandoutsData>, "data" | "settings" | "logos">) {
  const ranking = goalieRanking(data, settings), { rows } = ranking, type = rowType(rows.length), order = goalieRankingText(ranking, settings.minShotsAgainst);
  if (!rows.length) return <div className={styles.board}><Banner settings={settings} slate={data.slate} /><div className={styles.blank} data-testid="standouts-blank">{data.goalies.length ? "No goalie on this slate meets the shots-against minimum." : "Goalie data is missing for this slate."}</div></div>;
  return <div className={styles.board}>
    <Banner settings={settings} slate={data.slate} />
    <p className={styles.legend} style={{ color: QUIET }} data-testid="standouts-legend">{order.lead} {slateWord(data)}, then STD per appearance before it. SV% changes in points of save percentage, GAA and GSAx in goals, the rest in %. SA is workload, so uncoloured.{isOlderSlate(data) ? " ROST is current." : ""}<FallbackNote data={data} />{order.note ? <span data-testid="nst-goalie-note" style={{ color: "#ffcc33" }}> {order.note}</span> : null}</p>
    <div className={styles.rows} style={{ fontSize: type }} data-few={rows.length <= 4 || undefined}>{rows.map((row, index) => <div key={row.goalieId} className={styles.row} data-testid="standout-row">
      <div className={styles.who}>
        {goalieRank(row, index) !== null && <span className={styles.rank} data-testid="goalie-rank" style={{ color: QUIET }}>{goalieRank(row, index)}</span>}
        <PostTeamMark team={row.team} logo={logos[row.team]} size={Math.round(type * 1.3)} />
        <span className={styles.name} style={{ color: "#ffffff" }}>{row.name ?? `Goalie ${row.goalieId}`}</span>
        <span className={styles.owned} style={{ color: QUIET, marginLeft: "auto" }}>{ownershipLabel(row.ownership)} ROST</span>
      </div>
      <div className={styles.tiles} data-goalie>{row.stats.map(stat => <Tile key={stat.id} id={stat.id} label={stat.label} value={goalieLastText(stat)} std={goalieStdText(stat)} change={goalieChangeText(stat)} tone={goalieTone(stat)} />)}</div>
    </div>)}</div>
  </div>;
}

export default function LastNightsStandoutsCard({ data, settings, logos }: SharePostCardProps<LastNightsStandoutsSettings, LastNightsStandoutsData>) {
  if (!standoutsCurrent(data, settings)) return <PostEmpty>{STALE_SETTINGS_NOTE}</PostEmpty>;
  if (isGoalieView(settings.view)) return <GoalieCard data={data} settings={settings} logos={logos} />;
  const rows = standoutRows(data, settings), hand = isHandBuilt(settings.view), type = rowType(rows.length);
  if (!rows.length) return <div className={styles.board}><Banner settings={settings} slate={data.slate} /><div className={styles.blank} data-testid="standouts-blank">{!data.skaters.length ? "Skater data is missing for this slate." : hand ? `Pick up to ${STANDOUT_MAX_ROWS} skaters in the sidebar to build this card.` : "No skater played on this slate in this view."}</div></div>;
  const pool = standoutPool(data, settings).length;
  const legend = hand ? "Picked by hand, in this order." : `Top ${rows.length} of ${pool} by ${rankingText(settings.rankBy)}.`;
  return <div className={styles.board}>
    <Banner settings={settings} slate={data.slate} />
    <p className={styles.legend} style={{ color: QUIET }} data-testid="standouts-legend">{legend} {slateWord(data)}, then STD: the player&apos;s season per game before this slate. % compares them; — means no baseline or value.{rows.some(row => row.lineAsOf) ? " A dated line is from that earlier game." : ""}{isOlderSlate(data) ? " ROST is current." : ""}<FallbackNote data={data} /></p>
    <div className={styles.rows} style={{ fontSize: type }} data-few={rows.length <= 4 || undefined}>{rows.map((row, index) => <SkaterRow key={row.playerId} row={row} rank={hand ? null : index + 1} logo={row.team ? logos[row.team] : null} logoSize={Math.round(type * 1.3)} />)}</div>
  </div>;
}
