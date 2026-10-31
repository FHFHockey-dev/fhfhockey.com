import type { ReactNode } from "react";
import { bshBoardCurrent, bshStackTops, STALE_SETTINGS_NOTE, type BshBoardData, type BshBoardSettings, type BshGameStack, type BshRow, type SkaterWindowId } from "lib/socialShare/modules/bshBoard";
import type { SharePostCardProps } from "lib/socialShare/modules/contract";
import { seriesRuns } from "lib/socialShare/modules/whatChanged";
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
/** One legend line over a table that takes the rest of the body. */
export function SkaterBoard<Row>({ legend, columns, rows, rowKey, empty, charted, compact }: { legend: ReactNode; columns: readonly PostColumn<Row>[]; rows: readonly Row[]; rowKey: (row: Row) => string | number; empty: string | null; charted?: boolean; compact?: boolean }) {
  return <div className={styles.board}>
    <p className={styles.legend}>{legend}</p>
    {empty ? <PostEmpty>{empty}</PostEmpty> : <div className={styles.fill} data-dense={rows.length > DENSE_ROWS || undefined} data-charted={charted || undefined} data-compact={compact || undefined}><PostTable columns={columns} rows={rows} rowKey={rowKey} /></div>}
  </div>;
}
export const skaterLogoSize = logoSize;
const total = (count: number | null, per: number | null) => count === null ? <span className={styles.missing}>{MISSING}</span> : <span className={styles.stat}>{count} <small>{rate(per)}</small></span>;

const CHART_WIDTH = 180, CHART_HEIGHT = 48, CHART_LAYERS = ["b", "s", "h"] as const;
/** Games left to right, oldest first, on one scale across rows. A missing game breaks the shape; a known 0 sits on the baseline. */
function BshStackChart({ games, highest, recentFrom = 0 }: { games: readonly BshGameStack[]; highest: number; recentFrom?: number }) {
  const start = recentFrom * CHART_WIDTH / Math.max(1, games.length), step = CHART_WIDTH / Math.max(1, games.length), y = (value: number) => (CHART_HEIGHT - 2 - value / highest * (CHART_HEIGHT - 4)).toFixed(2);
  const runs = seriesRuns(games.map(game => game.bsh)).map(run => run.map(index => ({ x: step * (index + 0.5), tops: bshStackTops(games[index])! })));
  // A lone game has no neighbour to slope to, so it takes the width of a bar.
  const shapes = runs.map(run => run.length > 1 ? run : [{ ...run[0], x: run[0].x - step * 0.35 }, { ...run[0], x: run[0].x + step * 0.35 }]);
  const line = (points: typeof shapes[number], layer: number) => points.map((point, at) => `${at ? "L" : "M"}${point.x.toFixed(2)} ${y(point.tops[layer])}`).join("");
  const under = (points: typeof shapes[number], layer: number) => [...points].reverse().map(point => `L${point.x.toFixed(2)} ${y(layer ? point.tops[layer - 1] : 0)}`).join("");
  return <span className={styles.chart}><svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} preserveAspectRatio="none" aria-hidden="true" data-testid="bsh-stack" data-recent-from={recentFrom} data-stack={games.map(game => game.bsh === null ? "gap" : `${game.blocks}+${game.shots}+${game.hits}`).join(",")}>
    {recentFrom > 0 && <rect className={styles.recentBand} x={start.toFixed(2)} y="0" width={(CHART_WIDTH - start).toFixed(2)} height={CHART_HEIGHT} />}
    {shapes.map(points => <g key={points[0].x}>
      {CHART_LAYERS.map((layer, index) => <path key={layer} className={styles.layer} data-layer={layer} d={`${line(points, index)}${under(points, index)}Z`} />)}
      <path className={styles.edge} data-edge="" d={line(points, 2)} />
    </g>)}
    {recentFrom > 0 && <path className={styles.recentMark} data-recent-mark="" d={`M${start.toFixed(2)} 0V${CHART_HEIGHT}`} />}
  </svg></span>;
}

const MoverPart = ({ layer, label, recent, base }: { layer: "b" | "s" | "h"; label: string; recent: number | null; base: number | null }) => <span className={styles.part} data-layer={layer}>
  <small>{label}</small>
  <span className={styles.pair}>{rate(recent)} <small>{rate(base)}</small></span>
</span>;
const Key = () => <span className={styles.key}><i data-layer="b" />B<i data-layer="s" />S<i data-layer="h" />H</span>;

function BshMovers({ data, settings, logos }: SharePostCardProps<BshBoardSettings, BshBoardData>) {
  const { cohort } = data, all = [...data.risers, ...data.fallers], highest = Math.max(1, ...all.flatMap(row => row.games.map(game => game.bsh ?? 0))), largest = Math.max(0, ...all.map(row => Math.abs(row.delta ?? 0)));
  const window = windowShort(settings.window), base = settings.comparison === "previous" ? `previous ${settings.window === "l5" ? 5 : 10}` : "earlier season";
  const renderRow = (row: BshRow) => <>
    <span className={board.rank}>{row.rank}</span>
    <span className={board.logo}>{row.team && <PostTeamMark team={row.team} logo={logos[row.team]} size={34} />}</span>
    <span className={board.ident}>
      <b>{row.name}</b>
      <small>{[row.position, row.teams.length > 1 ? row.teams.join("/") : null].filter(Boolean).join(" · ")}{row.position || row.teams.length > 1 ? " · " : ""}{rate(row.recent.bshPerGame)} vs {rate(row.baseline?.bshPerGame ?? null)} BSH/G · {row.recent.games} vs {row.baseline?.games ?? MISSING} GP</small>
    </span>
    <HeatTile value={row.delta} text={signed(row.delta)} caption="BSH/G" largest={largest} />
    <div className={`${board.strip} ${styles.moverStrip}`}>
      <MoverPart layer="b" label="BLK/G" recent={row.recent.blocksPerGame} base={row.baseline?.blocksPerGame ?? null} />
      <MoverPart layer="s" label="SOG/G" recent={row.recent.shotsPerGame} base={row.baseline?.shotsPerGame ?? null} />
      <MoverPart layer="h" label="HITS/G" recent={row.recent.hitsPerGame} base={row.baseline?.hitsPerGame ?? null} />
      <BshStackChart games={row.games} highest={highest} recentFrom={row.recentFrom} />
    </div>
  </>;
  return <div className={styles.board}>
    <p className={styles.legend}>{window} vs {base} (grey). <Key /> by game; dashes = {window} starts. {cohort.risers} up, {cohort.fallers} down of {cohort.comparable}{cohort.shortWindow ? `, ${cohort.shortWindow} short` : ""}.</p>
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
  const highest = Math.max(1, ...data.rows.flatMap(row => row.games.map(game => game.bsh ?? 0))), largestRate = Math.max(0, ...data.rows.map(row => row.recent.bshPerGame ?? 0));
  const columns: PostColumn<BshRow>[] = [
    { id: "rank", label: "RK", numeric: true, cell: row => row.rank },
    { id: "player", label: "SKATER", cell: row => <SkaterCell row={row} logo={row.team ? logos[row.team] : null} size={size} /> },
    { id: "gp", label: "GP", numeric: true, cell: row => row.recent.games },
    { id: "blk", label: "BLK /G", numeric: true, cell: row => total(row.recent.blocks, row.recent.blocksPerGame) },
    { id: "sog", label: "SOG /G", numeric: true, cell: row => total(row.recent.shots, row.recent.shotsPerGame) },
    { id: "hits", label: "HITS /G", numeric: true, cell: row => total(row.recent.hits, row.recent.hitsPerGame) },
    { id: "chart", label: "BY GAME", numeric: true, cell: row => <BshStackChart games={row.games} highest={highest} /> },
    { id: "bsh", label: "BSH /G", numeric: true, cell: row => <span className={styles.tile}><HeatTile value={row.recent.bshPerGame} text={rate(row.recent.bshPerGame)} caption={`${row.recent.bsh} total`} largest={largestRate} /></span> },
  ];
  const legend = <><Key /> by game, oldest to newest, one scale. {windowShort(settings.window)}: total, then per game. {cohort.ranked} of {cohort.eligible} ranked.</>;
  return <SkaterBoard legend={legend} columns={columns} rows={data.rows} rowKey={row => row.playerId} empty={data.rows.length ? null : "No skater qualifies with these settings"} charted />;
}
