import type { SharePostCardProps } from "lib/socialShare/modules/contract";
import { ROLE_WATCH_COPY, roleSlotLabel, type RoleChange, type RoleWatchData, type RoleWatchRow, type RoleWatchSettings } from "lib/socialShare/modules/roleWatch";
import { formatSeconds, windowLabel } from "lib/socialShare/modules/whatChanged";
import { PostEmpty, PostTable, PostTeamMark, type PostColumn } from "./kit";
import styles from "./RoleWatchCard.module.scss";

const arrow = (change: RoleChange) => change.direction === "up" ? "▲" : change.direction === "down" ? "▼" : "";

export default function RoleWatchCard({ data, logos }: SharePostCardProps<RoleWatchSettings, RoleWatchData>) {
  const recentLabel = windowLabel(data.window), { cohort } = data;
  if (!data.toiMovers.length && !data.ppMovers.length) return <PostEmpty>No change meets the minimums: {cohort.compared} compared, {cohort.shortSample} short sample</PostEmpty>;
  const columns = (change: (row: RoleWatchRow) => RoleChange): PostColumn<RoleWatchRow>[] => [
    { id: "rank", label: "RK", numeric: true, cell: row => row.rank },
    { id: "player", label: "PLAYER", cell: row => <span className={styles.player}><PostTeamMark team={row.team ?? "—"} logo={row.team ? logos[row.team] : null} size={26} />{row.name ?? `Player ${row.playerId}`}{row.teamChange ? " †" : ""}</span> },
    { id: "recent", label: recentLabel, numeric: true, cell: row => formatSeconds(change(row).recentSeconds) },
    { id: "base", label: "BASE", numeric: true, cell: row => formatSeconds(change(row).baselineSeconds) },
    { id: "change", label: "CHANGE", numeric: true, cell: row => `${arrow(change(row))} ${formatSeconds(change(row).changeSeconds, true)}` },
    { id: "gp", label: "GP", numeric: true, cell: row => `${row.recentGames}/${row.baselineGames}` },
    { id: "role", label: "BEFORE → LATEST", cell: row => <small className={styles.role}>{row.before ? roleSlotLabel(row.before.role) : "No game before"} → {roleSlotLabel(row.latest.role)}</small> },
  ];
  const moved = [...data.toiMovers, ...data.ppMovers].filter(row => row.teamChange);
  return <div className={styles.card}>
    <section className={styles.list}><h3>TOI PER GAME · ALL SITUATIONS · {formatSeconds(data.minToiChange)}+ CHANGE</h3>{data.toiMovers.length ? <PostTable columns={columns(row => row.toi)} rows={data.toiMovers} rowKey={row => row.playerId} /> : <p className={styles.note}>No TOI change meets the minimum</p>}</section>
    <section className={styles.list}><h3>PP TOI PER GAME · POWER PLAY · {formatSeconds(data.minPpChange)}+ CHANGE</h3>{data.ppMovers.length ? <PostTable columns={columns(row => row.pp)} rows={data.ppMovers} rowKey={row => row.playerId} /> : <p className={styles.note}>No PP TOI change meets the minimum</p>}</section>
    <p className={styles.note}>{ROLE_WATCH_COPY} BASE is the season before the {recentLabel}, with no game in both. GP = {recentLabel}/BASE. {cohort.compared} compared; {cohort.shortSample} short sample unranked{cohort.unlisted ? `; ${cohort.unlisted} more not listed` : ""}. Unknown means no source row for that game; Off PP means the game has PP rows and this skater is not on PP1 or PP2.{moved.length ? ` † New team: ${[...new Set(moved.map(row => `${row.name ?? row.playerId} ${row.teamChange!.from} to ${row.teamChange!.to}, ${row.teamChange!.recentGamesWithNewTeam} of ${row.recentGames} recent games`))].join("; ")}.` : ""}</p>
  </div>;
}
