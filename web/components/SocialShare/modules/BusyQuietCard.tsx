import { BASIS_LABELS, formatVolume, TEAM_CHANCES_NOTE, VOLUME_NOTE, windowLabel, type BusyQuietData, type BusyQuietRow, type BusyQuietSettings } from "lib/socialShare/modules/busyQuiet";
import type { SharePostCardProps } from "lib/socialShare/modules/contract";
import { PostEmpty, PostTable, PostTeamMark, type PostColumn } from "./kit";
import styles from "./BusyQuietCard.module.scss";

export default function BusyQuietCard({ data, settings, logos }: SharePostCardProps<BusyQuietSettings, BusyQuietData>) {
  if (!data.busy.length && !data.quiet.length) return <PostEmpty>No goalie has {settings.minStarts} official starts in this window</PostEmpty>;
  const suffix = BASIS_LABELS[data.basis];
  const columns: PostColumn<BusyQuietRow>[] = [
    { id: "rank", label: "RK", numeric: true, cell: row => row.rank },
    { id: "goalie", label: "GOALIE", cell: row => <span className={styles.goalie}><PostTeamMark team={row.team} logo={logos[row.team]} size={26} /><span className={styles.name}>{row.name ?? `Goalie ${row.goalieId}`}</span></span> },
    { id: "gp", label: "GP", numeric: true, cell: row => row.short ? `${row.appearances}/${row.requested}` : row.appearances },
    { id: "gs", label: "GS", numeric: true, cell: row => row.starts },
    { id: "relief", label: "RELIEF", numeric: true, cell: row => row.relief },
    { id: "sa", label: "SA", numeric: true, cell: row => row.totalShots ?? "—" },
    { id: "volume", label: `SA${suffix}`, numeric: true, cell: row => <b>{formatVolume(row.volume.value)}</b> },
    { id: "hd", label: `HD SHOTS${suffix}`, numeric: true, cell: row => row.danger.admitted ? formatVolume(row.danger.hd) : <span className={styles.gap}>— {row.danger.covered}/{row.danger.expected}</span> },
    { id: "sca", label: "TEAM SCA/GM", numeric: true, cell: row => row.teamChances.admitted ? formatVolume(row.teamChances.sca) : "—" },
    { id: "hdca", label: "TEAM HDCA/GM", numeric: true, cell: row => row.teamChances.admitted ? formatVolume(row.teamChances.hdca) : "—" },
  ];
  const shared = [...data.busy, ...data.quiet].reduce((total, row) => total + row.teamChances.sharedNetGames, 0);
  return <div className={styles.card} data-testid="busy-quiet-card">
    <p className={styles.note}>{VOLUME_NOTE} {windowLabel(data.window)} through {data.through}.</p>
    {([["Busy", data.busy], ["Quiet", data.quiet]] as const).map(([title, rows]) => rows.length ? <section key={title}>
      <h3 className={styles.title}>{title}</h3>
      <PostTable columns={columns} rows={rows} rowKey={row => row.goalieId} />
    </section> : null)}
    <p className={styles.note}>
      {data.basis === "start" ? "Per start reads official starts only; relief is counted apart. " : ""}HD SHOTS are shots from the high-danger zone, not chances, shown once 90% of games are covered, otherwise as covered/expected games. {TEAM_CHANCES_NOTE}{shared ? ` ${shared} listed ${shared === 1 ? "appearance" : "appearances"} shared the net.` : ""}
    </p>
  </div>;
}
