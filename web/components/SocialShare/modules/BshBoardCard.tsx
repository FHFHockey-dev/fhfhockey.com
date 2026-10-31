import { bshBoardCurrent, STALE_SETTINGS_NOTE, type BshBoardData, type BshBoardSettings, type BshRow, type SkaterWindowId } from "lib/socialShare/modules/bshBoard";
import type { SharePostCardProps } from "lib/socialShare/modules/contract";
import { PostEmpty, PostTable, PostTeamMark, type PostColumn } from "./kit";
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
export function SkaterBoard<Row>({ legend, columns, rows, rowKey, empty }: { legend: string; columns: readonly PostColumn<Row>[]; rows: readonly Row[]; rowKey: (row: Row) => string | number; empty: string | null }) {
  return <div className={styles.board}>
    <p className={styles.legend}>{legend}</p>
    {empty ? <PostEmpty>{empty}</PostEmpty> : <div className={styles.fill} data-dense={rows.length > DENSE_ROWS || undefined}><PostTable columns={columns} rows={rows} rowKey={rowKey} /></div>}
  </div>;
}
export const skaterLogoSize = logoSize;
const total = (count: number | null, per: number | null) => count === null ? <span className={styles.missing}>{MISSING}</span> : <span className={styles.pair}>{count} <small>{rate(per)}</small></span>;
const change = (recent: number | null, base: number | null) => <span className={styles.pair}>{rate(recent)} <small>{rate(base)}</small></span>;

export default function BshBoardCard({ data, settings, logos }: SharePostCardProps<BshBoardSettings, BshBoardData>) {
  if (!bshBoardCurrent(data, settings)) return <PostEmpty>{STALE_SETTINGS_NOTE}</PostEmpty>;
  const { cohort } = data, leaders = data.view === "leaders", size = logoSize(data.rows.length);
  const shared: PostColumn<BshRow>[] = [
    { id: "rank", label: "RK", numeric: true, cell: row => row.rank },
    { id: "player", label: "SKATER", cell: row => <SkaterCell row={row} logo={row.team ? logos[row.team] : null} size={size} /> },
  ];
  const columns: PostColumn<BshRow>[] = leaders ? [...shared,
    { id: "gp", label: "GP", numeric: true, cell: row => row.recent.games },
    { id: "blk", label: "BLK /G", numeric: true, cell: row => total(row.recent.blocks, row.recent.blocksPerGame) },
    { id: "sog", label: "SOG /G", numeric: true, cell: row => total(row.recent.shots, row.recent.shotsPerGame) },
    { id: "hits", label: "HITS /G", numeric: true, cell: row => total(row.recent.hits, row.recent.hitsPerGame) },
    { id: "bsh", label: "BSH /G", numeric: true, cell: row => <span className={styles.pair}>{row.recent.bsh} <b className={styles.strong}>{rate(row.recent.bshPerGame)}</b></span> },
  ] : [...shared,
    { id: "gp", label: "GP", numeric: true, cell: row => `${row.recent.games}/${row.baseline?.games ?? MISSING}` },
    { id: "blk", label: "BLK/G", numeric: true, cell: row => change(row.recent.blocksPerGame, row.baseline?.blocksPerGame ?? null) },
    { id: "sog", label: "SOG/G", numeric: true, cell: row => change(row.recent.shotsPerGame, row.baseline?.shotsPerGame ?? null) },
    { id: "hits", label: "HITS/G", numeric: true, cell: row => change(row.recent.hitsPerGame, row.baseline?.hitsPerGame ?? null) },
    { id: "bsh", label: "BSH/G", numeric: true, cell: row => change(row.recent.bshPerGame, row.baseline?.bshPerGame ?? null) },
    { id: "delta", label: "CHANGE", numeric: true, cell: row => <b className={styles.strong}>{signed(row.delta)}</b> },
  ];
  const window = windowShort(settings.window), base = settings.comparison === "previous" ? `previous ${settings.window === "l5" ? 5 : 10}` : "earlier season";
  const legend = leaders ? `BLK + SOG + HITS, ${window}: total, then per game. ${cohort.ranked} of ${cohort.eligible} ranked.`
    : `BLK + SOG + HITS per game: ${window}, then ${base} in grey. ${cohort.ranked} ${data.view} of ${cohort.comparable} comparable.`;
  return <SkaterBoard legend={legend} columns={columns} rows={data.rows} rowKey={row => row.playerId} empty={data.rows.length ? null : leaders ? "No skater qualifies with these settings" : `No ${data.view} qualify with these settings`} />;
}
