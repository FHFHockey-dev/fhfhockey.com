import type { SharePostCardProps } from "lib/socialShare/modules/contract";
import { nightlyFloorCurrent, type FloorRow, type NightlyFloorData, type NightlyFloorSettings } from "lib/socialShare/modules/nightlyFloor";
import { STALE_SETTINGS_NOTE } from "lib/socialShare/modules/bshBoard";
import { ownershipLabel } from "lib/socialShare/modules/shared/definitions";
import { SkaterCell } from "./BshBoardCard";
import { PostEmpty, PostTable, type PostColumn } from "./kit";
import styles from "./BshBoardCard.module.scss";

export default function NightlyFloorCard({ data, settings, logos }: SharePostCardProps<NightlyFloorSettings, NightlyFloorData>) {
  if (!nightlyFloorCurrent(data, settings)) return <PostEmpty>{STALE_SETTINGS_NOTE}</PostEmpty>;
  const { cohort } = data;
  const columns: PostColumn<FloorRow>[] = [
    { id: "rank", label: "RK", numeric: true, cell: row => row.rank },
    { id: "player", label: "SKATER", cell: row => <SkaterCell row={row} logo={row.team ? logos[row.team] : null} /> },
    { id: "owned", label: "ROST", numeric: true, cell: row => ownershipLabel(row.ownership) },
    { id: "gp", label: "GP", numeric: true, cell: row => row.appearances },
    { id: "count", label: "MET / KNOWN", numeric: true, cell: row => `${row.numerator} / ${row.denominator}` },
    { id: "missing", label: "MISSING", numeric: true, cell: row => row.missing ? <span className={styles.missing}>{row.missing}</span> : 0 },
    { id: "pct", label: "%", numeric: true, cell: row => <b className={styles.strong}>{Math.round(row.pct * 100)}%</b> },
  ];
  const lead = <p className={styles.lead}><b>{data.viewLabel}.</b> {data.test} Over each skater&apos;s <b>{data.windowLabel}</b>. A DNP is not an appearance, and a missing stat counts as neither. {cohort.ranked} ranked of {cohort.pool} eligible.</p>;
  const notes = [
    cohort.outOfOwnershipRange ? `${cohort.outOfOwnershipRange} outside the rostered range.` : "",
    cohort.unknownOwnershipExcluded ? `${cohort.unknownOwnershipExcluded} with unknown rostered % excluded.` : "",
    cohort.unadmitted ? `${cohort.unadmitted} below min coverage, unranked.` : "",
    data.notShown ? `${data.notShown} more ranked below${data.tiedBeyondCut ? `, ${data.tiedBeyondCut} tied with the last row` : ""}.` : "",
  ].filter(Boolean).join(" ");
  const anyone = data.rows.some(row => row.numerator > 0);
  return <div className={styles.board}>
    {lead}
    {anyone ? <PostTable columns={columns} rows={data.rows} rowKey={row => row.playerId} /> : <PostEmpty>No skater meets this test with these settings</PostEmpty>}
    {notes && <p className={styles.note}>{notes}</p>}
  </div>;
}
