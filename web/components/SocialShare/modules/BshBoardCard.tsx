import type { ReactNode } from "react";
import { bshBoardCurrent, STALE_SETTINGS_NOTE, type BshBoardData, type BshBoardSettings, type BshRow } from "lib/socialShare/modules/bshBoard";
import type { SharePostCardProps } from "lib/socialShare/modules/contract";
import { PostEmpty, PostTable, PostTeamMark, type PostColumn } from "./kit";
import styles from "./BshBoardCard.module.scss";

const MISSING = "—";
const rate = (value: number | null) => value === null ? MISSING : value.toFixed(2);
const signed = (value: number | null) => value === null ? MISSING : `${value > 0 ? "+" : ""}${value.toFixed(2)}`;
export const SkaterCell = ({ row, logo }: { row: { name: string; position: string | null; team: string | null; teams: string[] }; logo: string | null | undefined }): ReactNode => <span className={styles.player}>
  {row.team && <PostTeamMark team={row.team} logo={logo} size={26} />}
  <span className={styles.name}>{row.name}</span>
  <span className={styles.pos}>{[row.position, row.teams.length > 1 ? row.teams.join("/") : null].filter(Boolean).join(" · ")}</span>
</span>;
const total = (count: number | null, per: number | null) => count === null ? <span className={styles.missing}>{MISSING}</span> : <span className={styles.pair}>{count} <small>{rate(per)}</small></span>;
const change = (recent: number | null, base: number | null) => <span className={styles.pair}>{rate(recent)} <small>was {rate(base)}</small></span>;

export default function BshBoardCard({ data, settings, logos }: SharePostCardProps<BshBoardSettings, BshBoardData>) {
  if (!bshBoardCurrent(data, settings)) return <PostEmpty>{STALE_SETTINGS_NOTE}</PostEmpty>;
  const { cohort } = data, leaders = data.view === "leaders";
  const shared: PostColumn<BshRow>[] = [
    { id: "rank", label: "RK", numeric: true, cell: row => row.rank },
    { id: "player", label: "SKATER", cell: row => <SkaterCell row={row} logo={row.team ? logos[row.team] : null} /> },
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
  const lead = leaders ? <>BLK + SOG + HITS over each skater&apos;s <b>{data.windowLabel}</b>. Ranked by BSH per game among <b>{cohort.ranked}</b> of {cohort.eligible} eligible.</>
    : <>BLK + SOG + HITS per game: <b>{data.windowLabel}</b> against <b>{data.comparisonLabel}</b>. {cohort.ranked} {data.view} among {cohort.comparable} comparable of {cohort.eligible} eligible.</>;
  const notes = [
    cohort.missingComponent ? `${cohort.missingComponent} unranked: a game lacks BLK, SOG or HITS.` : "",
    cohort.shortWindow ? `${cohort.shortWindow} excluded: not enough games for both windows.` : "",
    !leaders && cohort.flat ? `${cohort.flat} unchanged.` : "",
    data.notShown ? `${data.notShown} more ranked below${data.tiedBeyondCut ? `, ${data.tiedBeyondCut} tied with the last row` : ""}.` : "",
  ].filter(Boolean).join(" ");
  if (!data.rows.length) return <div className={styles.board}><p className={styles.lead}>{lead}</p><PostEmpty>{leaders ? "No skater qualifies with these settings" : `No ${data.view} qualify with these settings`}</PostEmpty>{notes && <p className={styles.note}>{notes}</p>}</div>;
  return <div className={styles.board}>
    <p className={styles.lead}>{lead}</p>
    <PostTable columns={columns} rows={data.rows} rowKey={row => row.playerId} />
    {notes && <p className={styles.note}>{notes}</p>}
  </div>;
}
