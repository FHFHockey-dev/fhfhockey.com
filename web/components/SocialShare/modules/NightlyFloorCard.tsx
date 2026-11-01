import type { SharePostCardProps } from "lib/socialShare/modules/contract";
import { floorViewIsUnwanted, nightlyFloorCurrent, type FloorRow, type NightlyFloorData, type NightlyFloorSettings } from "lib/socialShare/modules/nightlyFloor";
import { STALE_SETTINGS_NOTE } from "lib/socialShare/modules/bshBoard";
import { ownershipLabel } from "lib/socialShare/modules/shared/definitions";
import { SkaterBoard, SkaterCell, skaterLogoSize, windowShort } from "./BshBoardCard";
import { HeatTile } from "./GoalieBoards";
import { PostEmpty, type PostColumn } from "./kit";
import styles from "./BshBoardCard.module.scss";

const STRIP_WIDTH = 180, STRIP_HEIGHT = 30;
/** One mark per appearance, oldest first: a tall bar for met, a low bar for not met, and a hollow amber box for a missing stat. */
function FloorStrip({ marks, unwanted }: { marks: readonly (boolean | null)[]; unwanted: boolean }) {
  const step = STRIP_WIDTH / Math.max(1, marks.length), width = (step * 0.72).toFixed(2);
  return <span className={styles.strip}><svg viewBox={`0 0 ${STRIP_WIDTH} ${STRIP_HEIGHT}`} preserveAspectRatio="none" aria-hidden="true" data-testid="floor-strip" data-unwanted={unwanted || undefined}>
    {marks.map((mark, index) => {
      const x = (step * (index + 0.14)).toFixed(2), kind = mark === null ? "gap" : mark ? "met" : "not";
      return <rect key={index} data-mark={kind} fill={kind === "gap" ? "none" : kind === "not" ? "rgba(255,255,255,0.28)" : unwanted ? "#ff6384" : "#00ff99"} stroke={kind === "gap" ? "#ffcc33" : undefined} strokeWidth={kind === "gap" ? 1.5 : undefined} vectorEffect={kind === "gap" ? "non-scaling-stroke" : undefined} x={x} width={width} y={mark === false ? STRIP_HEIGHT - 8 : 1} height={mark === false ? 7 : STRIP_HEIGHT - 2} />;
    })}
  </svg></span>;
}

export default function NightlyFloorCard({ data, settings, logos }: SharePostCardProps<NightlyFloorSettings, NightlyFloorData>) {
  if (!nightlyFloorCurrent(data, settings)) return <PostEmpty>{STALE_SETTINGS_NOTE}</PostEmpty>;
  const unwanted = floorViewIsUnwanted(settings.view), { cohort } = data, size = skaterLogoSize(data.rows.length);
  const columns: PostColumn<FloorRow>[] = [
    { id: "rank", label: "RK", numeric: true, cell: row => row.rank },
    { id: "player", label: "SKATER", cell: row => <SkaterCell row={row} logo={row.team ? logos[row.team] : null} size={size} /> },
    { id: "owned", label: "ROST", numeric: true, cell: row => ownershipLabel(row.ownership) },
    { id: "gp", label: "GP", numeric: true, cell: row => row.appearances },
    { id: "average", label: data.averageLabel, numeric: true, cell: row => row.average === null ? <span className={styles.missing}>—</span> : row.average.toFixed(2) },
    { id: "count", label: "# GP", numeric: true, cell: row => `${row.numerator} / ${row.denominator}` },
    { id: "strip", label: "BY GAME", numeric: true, cell: row => <FloorStrip marks={row.marks} unwanted={unwanted} /> },
    // On one absolute scale, 100% at full strength, so a colour means the same on every board. Red where the count is unwanted.
    { id: "pct", label: "%", numeric: true, cell: row => <span className={styles.floorTile}><HeatTile value={unwanted ? -row.pct : row.pct} text={`${Math.round(row.pct * 100)}%`} caption={unwanted ? "of GP" : "met"} largest={1} /></span> },
  ];
  const legend = <>{data.test} {data.periodLabel ?? windowShort(settings.window)}, oldest to newest: <span className={styles.markKey}><i data-mark="met" style={{ backgroundColor: unwanted ? "#ff6384" : "#00ff99" }} />met<i data-mark="not" style={{ backgroundColor: "rgba(255,255,255,0.28)" }} />not<i data-mark="gap" style={{ border: "1.5px solid #ffcc33" }} />missing</span>. {cohort.ranked} of {cohort.pool} ranked.</>;
  return <SkaterBoard banner={<h3 className={styles.metricLabel} data-testid="floor-metric" style={{ color: "#ffffff" }}>{data.metricLabel}</h3>} legend={legend} columns={columns} rows={data.rows} rowKey={row => row.playerId} empty={data.rows.some(row => row.numerator > 0) ? null : "No skater meets this test with these settings"} compact />;
}
