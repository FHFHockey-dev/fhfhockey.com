import { Fragment } from "react";
import { MIN_STARTS_RANGE_RULE } from "lib/socialShare/modules/busyQuiet";
import type { SharePostCardProps } from "lib/socialShare/modules/contract";
import { cellShade, formatGaa, formatSavePct, RESCUE_GROUPS, rescueNote, type GoalieRescueSettings, type RescueColumn, type RescueData, type RescueRow } from "lib/socialShare/modules/goalieRescue";
import { ownershipLabel } from "lib/socialShare/modules/shared/definitions";
import { PostEmpty, PostTeamMark } from "./kit";
import styles from "./GoalieRescueCard.module.scss";

const SHADE = { better: "0, 255, 153", worse: "255, 99, 132" };
const LEAD_HEADS = ["RK", "GOALIE", "OWN", "GS", "RELIEF"], LEAD_COLUMNS = LEAD_HEADS.length;

const columnText = (row: RescueRow, column: RescueColumn) => column.id === "savePct" ? formatSavePct(row.savePct) : column.id === "gaa" ? formatGaa(row.gaa) : row[column.id] ?? "—";

function MetricCell({ row, rows, column, group, first, selected }: { row: RescueRow; rows: readonly RescueRow[]; column: RescueColumn; group: string; first: boolean; selected: boolean }) {
  const { tone, alpha } = cellShade(row[column.id], rows, column), text = columnText(row, column);
  const style = tone === "better" || tone === "worse" ? { background: `rgba(${SHADE[tone]}, ${alpha})`, color: alpha > 0.55 ? "#0b0f12" : "#ffffff" } : undefined;
  return <span className={styles.cell} data-numeric="" data-column={column.id} data-group={group} data-tone={tone} data-first={first || undefined} data-selected={selected || undefined} style={style}>{selected ? <b>{text}</b> : text}</span>;
}

export default function GoalieRescueCard({ data, settings, logos }: SharePostCardProps<GoalieRescueSettings, RescueData>) {
  if (!data.rows.length) return <PostEmpty>No goalie with {settings.minStarts} official starts is at or under {settings.ownershipCeiling}% rostered in {data.ranged ? <>{data.dates}. {MIN_STARTS_RANGE_RULE}</> : "this window"}</PostEmpty>;
  return <div className={styles.card} data-testid="goalie-rescue-card">
    <p className={styles.note}>{rescueNote(data)} Colour compares this list, by column.</p>
    <div className={styles.fill}><div className={styles.table} data-past={data.past || undefined}>
      <span style={{ gridColumn: `span ${LEAD_COLUMNS}` }} />
      {RESCUE_GROUPS.map(group => <span key={group.id} className={styles.groupHead} data-group-head="" style={{ gridColumn: `span ${group.columns.length}` }}>{group.label}</span>)}
      {data.past ? null : <span />}
      {LEAD_HEADS.map(label => <span key={label} className={styles.head} data-numeric={label === "GOALIE" ? undefined : ""}>{label}</span>)}
      {RESCUE_GROUPS.flatMap(group => group.columns.map((column, index) => <span key={column.id} className={styles.head} data-head="" data-numeric="" data-column={column.id} data-group={group.id} data-first={index === 0 || undefined} data-selected={column.id === data.category || undefined}>{column.label}</span>))}
      {data.past ? null : <span className={styles.head} data-numeric="" data-first="" data-left-head="">GMS LEFT</span>}
      {data.rows.map(row => <Fragment key={row.goalieId}>
        <span className={styles.cell} data-numeric="">{row.rank}</span>
        <span className={styles.cell}><span className={styles.goalie}><PostTeamMark team={row.team} logo={logos[row.team]} size={26} /><span className={styles.name} data-goalie-name="">{row.name ?? `Goalie ${row.goalieId}`}</span>{row.status ? <small>{row.status}</small> : null}</span></span>
        <span className={styles.cell} data-numeric="">{ownershipLabel(row.ownership)}</span>
        <span className={styles.cell} data-numeric="">{row.starts}</span>
        <span className={styles.cell} data-numeric="">{row.relief}</span>
        {RESCUE_GROUPS.flatMap(group => group.columns.map((column, index) => <MetricCell key={column.id} row={row} rows={data.rows} column={column} group={group.id} first={index === 0} selected={column.id === data.category} />))}
        {data.past ? null : <span className={styles.cell} data-numeric="" data-column="left" data-first="">
          {row.teamGamesLeft ? <span className={styles.dots} aria-hidden="true">{Array.from({ length: row.teamGamesLeft }, (_, index) => <i key={index} className={styles.dot} data-dot="" />)}</span> : null}
          {row.teamGamesLeft ?? "—"}
        </span>}
      </Fragment>)}
    </div></div>
  </div>;
}
