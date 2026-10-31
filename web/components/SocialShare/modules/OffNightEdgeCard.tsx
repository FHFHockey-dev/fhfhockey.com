import type { SharePostCardProps } from "lib/socialShare/modules/contract";
import type { OffNightData, OffNightGroup, OffNightRow, OffNightSettings } from "lib/socialShare/modules/offNightEdge";
import { ownershipLabel } from "lib/socialShare/modules/shared/definitions";
import { PostEmpty, PostTable, PostTeamMark, type PostColumn } from "./kit";
import styles from "./OffNightEdgeCard.module.scss";

function PickCell({ row, group }: { row: OffNightRow; group: OffNightGroup }) {
  const pick = row.picks[group];
  if (!pick) return <span className={styles.gap} data-testid="off-night-gap">{row.gaps[group]}</span>;
  return <span className={styles.pick}><b>{pick.name}</b><small>{ownershipLabel(pick.ownership)} · {pick.fantasyPerGame.toFixed(1)} FP/G</small></span>;
}

export default function OffNightEdgeCard({ data, settings, logos }: Pick<SharePostCardProps<OffNightSettings, OffNightData>, "data" | "settings" | "logos">) {
  if (!data.rows.length) return <PostEmpty>No team has a game left in these dates</PostEmpty>;
  const columns: PostColumn<OffNightRow>[] = [
    { id: "rank", label: "RK", numeric: true, cell: row => row.rank },
    { id: "team", label: "TEAM", cell: row => <span className={styles.team}><PostTeamMark team={row.team} logo={logos[row.team]} size={24} />{row.team}</span> },
    { id: "score", label: "SCORE", numeric: true, cell: row => row.score.toFixed(1) },
    { id: "games", label: "GP", numeric: true, cell: row => row.games },
    { id: "off", label: "OFF", numeric: true, cell: row => row.offNightGames },
    ...data.days.map((day, index): PostColumn<OffNightRow> => ({ id: day.date, label: day.label.slice(0, 2).toUpperCase(), numeric: true,
      cell: row => <span className={styles.day} data-off={day.offNight || undefined}>{row.gamesByDay[index] || "·"}</span> })),
    { id: "f", label: "FORWARD", cell: row => <PickCell row={row} group="F" /> },
    { id: "d", label: "DEFENSE", cell: row => <PickCell row={row} group="D" /> },
  ];
  return <div className={styles.body} data-dates={data.dates}>
    <p className={styles.slate} data-testid="off-night-slate">
      <b>{data.dates === "weekly" ? "Full week, played games included" : "Games still to start"}</b>
      {data.days.map(day => <span key={day.date} className={styles.day} data-off={day.offNight || undefined}>{day.label} {day.leagueGames}</span>)}
    </p>
    <PostTable columns={columns} rows={data.rows} rowKey={row => row.team} />
    <p className={styles.note} data-testid="off-night-note">
      Tinted days have 8 or fewer NHL games. Picks: at or under {settings.ownershipCeiling}% rostered, best L5 fantasy pts/GP × ice time. Ownership among qualified skaters: {data.ownership.known} known, {data.ownership.unknown} unknown ({settings.includeUnknown === "on" ? "included, shown —" : "excluded"}).
      {data.tiedOut.length ? ` Also tied at the last rank: ${data.tiedOut.join(", ")}.` : ""}
    </p>
  </div>;
}
