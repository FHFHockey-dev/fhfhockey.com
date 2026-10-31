import { windowLabel } from "lib/socialShare/modules/busyQuiet";
import type { SharePostCardProps } from "lib/socialShare/modules/contract";
import { formatGaa, formatSavePct, RESCUE_NOTE, type GoalieRescueSettings, type RescueData, type RescueRow } from "lib/socialShare/modules/goalieRescue";
import { ownershipLabel } from "lib/socialShare/modules/shared/definitions";
import { PostEmpty, PostTable, PostTeamMark, type PostColumn } from "./kit";
import styles from "./GoalieRescueCard.module.scss";

export default function GoalieRescueCard({ data, settings, logos }: SharePostCardProps<GoalieRescueSettings, RescueData>) {
  if (!data.rows.length) return <PostEmpty>No goalie with {settings.minStarts} official starts is at or under {settings.ownershipCeiling}% rostered in this window</PostEmpty>;
  const active = (id: RescueData["category"], value: string | number) => data.category === id ? <b>{value}</b> : value;
  const columns: PostColumn<RescueRow>[] = [
    { id: "rank", label: "RK", numeric: true, cell: row => row.rank },
    { id: "goalie", label: "GOALIE", cell: row => <span className={styles.goalie}><PostTeamMark team={row.team} logo={logos[row.team]} size={26} /><span className={styles.name}>{row.name ?? `Goalie ${row.goalieId}`}</span>{row.status ? <small>{row.status}</small> : null}</span> },
    { id: "own", label: "OWN", numeric: true, cell: row => ownershipLabel(row.ownership) },
    { id: "gs", label: "GS", numeric: true, cell: row => row.short ? `${row.starts} (${row.appearances}/${row.requested} GP)` : row.starts },
    { id: "relief", label: "RELIEF", numeric: true, cell: row => row.relief },
    { id: "wins", label: "W", numeric: true, cell: row => active("wins", row.wins ?? "—") },
    { id: "saves", label: "SV", numeric: true, cell: row => active("saves", row.saves ?? "—") },
    { id: "sa", label: "SA", numeric: true, cell: row => row.shotsAgainst ?? "—" },
    { id: "savePct", label: "SV%", numeric: true, cell: row => active("savePct", formatSavePct(row.savePct)) },
    { id: "ga", label: "GA", numeric: true, cell: row => row.goalsAgainst ?? "—" },
    { id: "gaa", label: "GAA", numeric: true, cell: row => active("gaa", formatGaa(row.gaa)) },
    { id: "left", label: "TEAM GMS LEFT", numeric: true, cell: row => row.teamGamesLeft ?? "—" },
  ];
  return <div className={styles.card} data-testid="goalie-rescue-card">
    <p className={styles.note}>{windowLabel(data.window)} through {data.through}. Win support: W. Volume: SV, with SA as context. Ratio exposure: SV%, GA, GAA, pooled. Ordered by the one selected category.</p>
    <PostTable columns={columns} rows={data.rows} rowKey={row => row.goalieId} />
    <p className={styles.note}>{RESCUE_NOTE} Games left run through {data.weekEnd}. {data.aboveCeiling} above the ceiling; {data.unknownExcluded} unknown ownership excluded; {data.unavailableStatus} excluded by Yahoo status.{data.unranked ? ` ${data.unranked} unranked for a missing value.` : ""}</p>
  </div>;
}
