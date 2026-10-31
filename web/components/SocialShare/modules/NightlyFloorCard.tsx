import type { SharePostCardProps } from "lib/socialShare/modules/contract";
import { nightlyFloorCurrent, type FloorRow, type NightlyFloorData, type NightlyFloorSettings } from "lib/socialShare/modules/nightlyFloor";
import { STALE_SETTINGS_NOTE } from "lib/socialShare/modules/bshBoard";
import { ownershipLabel } from "lib/socialShare/modules/shared/definitions";
import { SkaterBoard, SkaterCell, skaterLogoSize, windowShort } from "./BshBoardCard";
import { PostEmpty, type PostColumn } from "./kit";
import styles from "./BshBoardCard.module.scss";

export default function NightlyFloorCard({ data, settings, logos }: SharePostCardProps<NightlyFloorSettings, NightlyFloorData>) {
  if (!nightlyFloorCurrent(data, settings)) return <PostEmpty>{STALE_SETTINGS_NOTE}</PostEmpty>;
  const { cohort } = data, size = skaterLogoSize(data.rows.length);
  const columns: PostColumn<FloorRow>[] = [
    { id: "rank", label: "RK", numeric: true, cell: row => row.rank },
    { id: "player", label: "SKATER", cell: row => <SkaterCell row={row} logo={row.team ? logos[row.team] : null} size={size} /> },
    { id: "owned", label: "ROST", numeric: true, cell: row => ownershipLabel(row.ownership) },
    { id: "gp", label: "GP", numeric: true, cell: row => row.appearances },
    { id: "count", label: "MET / KNOWN", numeric: true, cell: row => `${row.numerator} / ${row.denominator}` },
    { id: "missing", label: "MISSING", numeric: true, cell: row => row.missing ? <span className={styles.missing}>{row.missing}</span> : 0 },
    { id: "pct", label: "%", numeric: true, cell: row => <b className={styles.strong}>{Math.round(row.pct * 100)}%</b> },
  ];
  const legend = `${data.test} ${windowShort(settings.window)}: ${cohort.ranked} of ${cohort.pool} ranked.`;
  return <SkaterBoard legend={legend} columns={columns} rows={data.rows} rowKey={row => row.playerId} empty={data.rows.some(row => row.numerator > 0) ? null : "No skater meets this test with these settings"} />;
}
