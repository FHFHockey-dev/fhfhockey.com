import type { SharePostCardProps } from "lib/socialShare/modules/contract";
import { pvpDataMatches, pvpHasRows, SAMPLE_CAVEAT, type CandidateRecord, type PlayerVsPlayerData, type PlayerVsPlayerSettings, type PvpMetricRow, type PvpSide } from "lib/socialShare/modules/playerVsPlayer";
import { PostEmpty, PostTable, PostTeamMark, type PostColumn } from "./kit";
import styles from "./PlayerVsPlayerCard.module.scss";

const surname = (name: string) => name.trim().split(/\s+/).at(-1)?.toUpperCase() ?? name;

function Player({ player, logo }: { player: PvpSide; logo: string | null | undefined }) {
  return <div className={styles.player}>
    {player.team && <PostTeamMark team={player.team} logo={logo} size={44} />}
    <div><strong>{player.name}</strong>
      <span>{[player.group, player.team].filter(Boolean).join(" · ")}{player.group || player.team ? " · " : ""}{player.appearances}{player.short ? ` of ${player.requested}` : ""} GP</span>
      {player.firstDate && <span>{player.firstDate} to {player.lastDate}</span>}</div>
  </div>;
}
function Claim({ claim }: { claim: CandidateRecord }) {
  return <li className={styles.claim}>
    <span className={styles.claimMeta}>{claim.platform === "x" ? "X" : "Reddit"} · {claim.date} · {claim.claimKind === "quoted" ? "Quoted" : "Paraphrased"}</span>
    <p>{claim.claimKind === "quoted" ? `“${claim.claim}”` : claim.claim}</p>
    <span className={styles.url}>{claim.url}</span>
    <span className={styles.limit}>Limits: {claim.limitations}</span>
  </li>;
}

export default function PlayerVsPlayerCard({ data, settings, logos }: SharePostCardProps<PlayerVsPlayerSettings, PlayerVsPlayerData>) {
  if (!pvpDataMatches(data, settings)) return <PostEmpty>Settings changed. Refresh this post.</PostEmpty>;
  if (!pvpHasRows(data, settings)) return <PostEmpty>{data.a.appearances && data.b.appearances ? "Nothing comparable in this window" : "One or both players have no appearance in this window"}</PostEmpty>;
  const { discussion } = data;
  const mark = (row: PvpMetricRow, key: "a" | "b") => row.higher === key || row.higher === "tie" ? <b className={styles.higher}>{row[key].shown}</b> : row[key].shown;
  const columns: PostColumn<PvpMetricRow>[] = [
    { id: "metric", label: data.basisLabel.toUpperCase(), cell: row => row.label },
    { id: "a", label: surname(data.a.name), numeric: true, cell: row => mark(row, "a") },
    { id: "b", label: surname(data.b.name), numeric: true, cell: row => mark(row, "b") },
  ];
  return <div className={styles.card}>
    <div className={styles.players}><Player player={data.a} logo={data.a.team ? logos[data.a.team] : null} /><Player player={data.b} logo={data.b.team ? logos[data.b.team] : null} /></div>
    <div className={styles.columns}>
      <section>
        <p className={styles.view}>{data.windowLabel} · {data.strengthLabel} · through {data.through}</p>
        <PostTable columns={columns} rows={data.metrics} rowKey={row => row.id} />
        <ul className={styles.notes}>{data.notes.map(note => <li key={note}>{note}</li>)}</ul>
      </section>
      <section className={styles.discussion} data-testid="pvp-discussion" data-kind={discussion.kind}>
        <h3>{discussion.headline}</h3>
        <p>{discussion.note}</p>
        <p className={styles.selection}>{data.selection.sourced ? `Why this pair: ${data.selection.rationales[0]}` : "Why this pair: chosen by the editor, with no sourced discussion behind it."}</p>
        {discussion.shown.length > 0 && <ul className={styles.claims}>{discussion.shown.map(claim => <Claim key={claim.id} claim={claim} />)}</ul>}
        {discussion.claims.length > discussion.shown.length && <p className={styles.limit}>More posts and links are in the alt text.</p>}
        {discussion.caveat && <p className={styles.caveat}>{SAMPLE_CAVEAT}</p>}
      </section>
    </div>
  </div>;
}
