import type { ReactNode } from "react";
import { BSH_BAR_PX, bshBar, bshBoardCurrent, STALE_SETTINGS_NOTE, type BshBoardData, type BshBoardSettings, type BshLayer, type BshRow, type BshTotals, type SkaterWindowId } from "lib/socialShare/modules/bshBoard";
import type { SharePostCardProps } from "lib/socialShare/modules/contract";
import { HeatTile } from "./GoalieBoards";
import { PostEmpty, PostTable, PostTeamMark, type PostColumn } from "./kit";
import { ChangeSide } from "./WhatChangedCard";
import board from "./WhatChangedCard.module.scss";
import styles from "./BshBoardCard.module.scss";

const MISSING = "—";
const rate = (value: number | null) => value === null ? MISSING : value.toFixed(2);
const signed = (value: number | null) => value === null ? MISSING : `${value > 0 ? "+" : ""}${value.toFixed(2)}`;
export const windowShort = (window: SkaterWindowId) => window === "std" ? "season to date" : window.toUpperCase();
/** Boards above this many rows use the smaller type, so 20 rows still fit the body. */
const DENSE_ROWS = 14;
const logoSize = (rows: number) => rows > DENSE_ROWS ? 30 : 34;

export const SkaterCell = ({ row, logo, size }: { row: { name: string; position: string | null; team: string | null; teams: string[] }; logo: string | null | undefined; size: number }) => <span className={styles.player}>
  {row.team && <PostTeamMark team={row.team} logo={logo} size={size} />}
  <span className={styles.name}>{row.name}</span>
  <span className={styles.pos}>{[row.position, row.teams.length > 1 ? row.teams.join("/") : null].filter(Boolean).join(" · ")}</span>
</span>;
/** An optional banner, then one legend line over a table that takes the rest of the body. */
export function SkaterBoard<Row>({ banner, legend, columns, rows, rowKey, empty, charted, compact }: { banner?: ReactNode; legend: ReactNode; columns: readonly PostColumn<Row>[]; rows: readonly Row[]; rowKey: (row: Row) => string | number; empty: string | null; charted?: boolean; compact?: boolean }) {
  return <div className={styles.board}>
    {banner}
    <p className={styles.legend} data-compact={compact || undefined}>{legend}</p>
    {empty ? <PostEmpty>{empty}</PostEmpty> : <div className={styles.fill} data-dense={rows.length > DENSE_ROWS || undefined} data-charted={charted || undefined} data-compact={compact || undefined}><PostTable columns={columns} rows={rows} rowKey={rowKey} /></div>}
  </div>;
}
export const skaterLogoSize = logoSize;
/** Colours are inline: the PNG capture can drop what a stylesheet sets, as it did for the old chart's fills. */
const LAYER: Record<BshLayer, { fill: string; tint: string }> = {
  b: { fill: "#4DA6DE", tint: "rgba(77, 166, 222, 0.18)" },
  s: { fill: "#E5AE5B", tint: "rgba(229, 174, 91, 0.18)" },
  h: { fill: "#C75B52", tint: "rgba(199, 91, 82, 0.18)" },
};
const total = (layer: BshLayer, count: number | null, per: number | null) => <span className={styles.stat} style={{ backgroundColor: LAYER[layer].tint }}>{count === null ? <span className={styles.missing}>{MISSING}</span> : <>{count} <small>{rate(per)}</small></>}</span>;

/** One bar for one skater, split by share of the total. A section too narrow for its letter hides the letter rather than clipping it. */
function BshBarView({ totals, barPx }: { totals: BshTotals; barPx: number }) {
  const bar = bshBar(totals, barPx);
  return <span className={styles.bar} aria-hidden="true" data-testid="bsh-bar" data-state={bar.state} style={{ backgroundColor: "rgba(255, 255, 255, 0.08)" }}>
    {bar.state === "missing" && <span className={styles.barMissing}>missing</span>}
    {bar.sections.map(section => <span key={section.layer} className={styles.section} data-layer={section.layer} data-letter={section.letter || undefined} style={{ width: `${(section.share * 100).toFixed(3)}%`, backgroundColor: LAYER[section.layer].fill, color: "#0b0f12" }}>{section.letter ? section.layer.toUpperCase() : null}</span>)}
  </span>;
}

const MoverPart = ({ layer, label, recent, base }: { layer: BshLayer; label: string; recent: number | null; base: number | null }) => <span className={styles.part} data-layer={layer} style={{ backgroundColor: LAYER[layer].tint }}>
  <small>{label}</small>
  <span className={styles.pair}>{rate(recent)} <small>{rate(base)}</small></span>
</span>;
const Key = () => <span className={styles.key}>{(["b", "s", "h"] as const).map(layer => <span key={layer}><i style={{ backgroundColor: LAYER[layer].fill }} />{layer.toUpperCase()}</span>)}</span>;

function BshMovers({ data, settings, logos }: SharePostCardProps<BshBoardSettings, BshBoardData>) {
  const { cohort } = data, all = [...data.risers, ...data.fallers], largest = Math.max(0, ...all.map(row => Math.abs(row.delta ?? 0)));
  const window = windowShort(settings.window), base = settings.comparison === "previous" ? `previous ${settings.window === "l5" ? 5 : 10}` : "earlier season";
  const renderRow = (row: BshRow) => <>
    <span className={board.rank}>{row.rank}</span>
    <span className={board.logo}>{row.team && <PostTeamMark team={row.team} logo={logos[row.team]} size={34} />}</span>
    <span className={board.ident}>
      <b>{row.name}</b>
      <small>{[row.position, row.teams.length > 1 ? row.teams.join("/") : null].filter(Boolean).join(" · ")}{row.position || row.teams.length > 1 ? " · " : ""}{rate(row.recent.bshPerGame)} vs {rate(row.baseline?.bshPerGame ?? null)} BSH/G · {row.recent.games} vs {row.baseline?.games ?? MISSING} GP</small>
    </span>
    <HeatTile value={row.delta} text={signed(row.delta)} caption="BSH/G" largest={largest} />
    <span className={styles.moverBar}><BshBarView totals={row.recent} barPx={BSH_BAR_PX.movers} /></span>
    <div className={styles.moverStrip}>
      <MoverPart layer="b" label="BLK/G" recent={row.recent.blocksPerGame} base={row.baseline?.blocksPerGame ?? null} />
      <MoverPart layer="s" label="SOG/G" recent={row.recent.shotsPerGame} base={row.baseline?.shotsPerGame ?? null} />
      <MoverPart layer="h" label="HITS/G" recent={row.recent.hitsPerGame} base={row.baseline?.hitsPerGame ?? null} />
    </div>
  </>;
  return <div className={styles.board}>
    <p className={styles.legend}>{window} vs {base} (grey). <Key /> = share of {window} BSH/G. {cohort.risers} up, {cohort.fallers} down of {cohort.comparable}{cohort.shortWindow ? `, ${cohort.shortWindow} short` : ""}.</p>
    {all.length ? <div className={board.boards}>
      <ChangeSide kind="up" rows={data.risers} rowKey={row => row.playerId} empty="No riser qualifies" renderRow={renderRow} />
      <ChangeSide kind="down" rows={data.fallers} rowKey={row => row.playerId} empty="No faller qualifies" renderRow={renderRow} />
    </div> : <PostEmpty>No risers or fallers qualify with these settings</PostEmpty>}
  </div>;
}

export default function BshBoardCard({ data, settings, snapshot, logos }: SharePostCardProps<BshBoardSettings, BshBoardData>) {
  if (!bshBoardCurrent(data, settings)) return <PostEmpty>{STALE_SETTINGS_NOTE}</PostEmpty>;
  if (data.view === "movers") return <BshMovers data={data} settings={settings} snapshot={snapshot} logos={logos} />;
  const { cohort } = data, size = logoSize(data.rows.length);
  const largestRate = Math.max(0, ...data.rows.map(row => row.recent.bshPerGame ?? 0));
  const columns: PostColumn<BshRow>[] = [
    { id: "rank", label: "RK", numeric: true, cell: row => row.rank },
    { id: "player", label: "SKATER", cell: row => <SkaterCell row={row} logo={row.team ? logos[row.team] : null} size={size} /> },
    { id: "gp", label: "GP", numeric: true, cell: row => row.recent.games },
    { id: "blk", label: "BLK /G", numeric: true, cell: row => total("b", row.recent.blocks, row.recent.blocksPerGame) },
    { id: "sog", label: "SOG /G", numeric: true, cell: row => total("s", row.recent.shots, row.recent.shotsPerGame) },
    { id: "hits", label: "HITS /G", numeric: true, cell: row => total("h", row.recent.hits, row.recent.hitsPerGame) },
    { id: "bsh", label: "BSH /G", numeric: true, cell: row => <span className={styles.tile}><HeatTile value={row.recent.bshPerGame} text={rate(row.recent.bshPerGame)} caption={`${row.recent.bsh} total`} largest={largestRate} /></span> },
    { id: "bar", label: "", numeric: true, cell: row => <BshBarView totals={row.recent} barPx={BSH_BAR_PX.leaders} /> },
  ];
  const legend = <><Key /> = share of BSH/G. {data.periodLabel ?? windowShort(settings.window)}: total, then per game. {cohort.ranked} of {cohort.eligible} ranked.</>;
  return <SkaterBoard legend={legend} columns={columns} rows={data.rows} rowKey={row => row.playerId} empty={data.rows.length ? null : "No skater qualifies with these settings"} charted />;
}
