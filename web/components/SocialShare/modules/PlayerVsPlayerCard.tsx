import type { SharePostCardProps } from "lib/socialShare/modules/contract";
import { pvpBarShares, pvpDataMatches, pvpHasRows, pvpLegend, type CandidateRecord, type PlayerVsPlayerData, type PlayerVsPlayerSettings, type PvpMetricRow, type PvpSide } from "lib/socialShare/modules/playerVsPlayer";
import { PostEmpty, PostTeamMark } from "./kit";
import styles from "./PlayerVsPlayerCard.module.scss";

const BRIGHT = "#14a2d2", DIM = "rgba(255, 255, 255, 0.28)", TRACK = "rgba(255, 255, 255, 0.06)";

function Player({ player, logo, side }: { player: PvpSide; logo: string | null | undefined; side: "a" | "b" }) {
  return <div className={styles.player} data-side={side}>
    {player.team && <PostTeamMark team={player.team} logo={logo} size={60} />}
    <div><strong>{player.name}</strong>
      <span>{[player.group, player.team].filter(Boolean).join(" · ")}{player.group || player.team ? " · " : ""}{player.appearances}{player.short ? ` of ${player.requested}` : ""} GP</span></div>
  </div>;
}
const isHigher = (row: PvpMetricRow, side: "a" | "b") => row.higher === side || row.higher === "tie";
function Value({ row, side }: { row: PvpMetricRow; side: "a" | "b" }) {
  return <span className={styles.value} data-higher={isHigher(row, side) || undefined}>{row[side].shown}</span>;
}
/* Grows outward from the centre label. Colours are inline so the PNG keeps them. */
function Track({ row, side }: { row: PvpMetricRow; side: "a" | "b" }) {
  const share = pvpBarShares(row)[side], missing = row[side].value === null;
  return <span className={styles.track} aria-hidden="true" data-side={side} data-missing={missing || undefined} style={{ backgroundColor: missing ? "transparent" : TRACK }}>
    {share !== null && <span className={styles.bar} data-testid="pvp-bar" data-side={side} style={{ width: `${(share * 100).toFixed(3)}%`, backgroundColor: isHigher(row, side) ? BRIGHT : DIM }} />}
  </span>;
}
function Claim({ claim }: { claim: CandidateRecord }) {
  return <li className={styles.claim}>
    <span className={styles.claimMeta}>{claim.platform === "x" ? "X" : "Reddit"} · {claim.date} · {claim.claimKind === "quoted" ? "Quoted" : "Paraphrased"}</span>
    <p>{claim.claimKind === "quoted" ? `“${claim.claim}”` : claim.claim}</p>
    <span className={styles.url}>{claim.url}</span>
  </li>;
}

export default function PlayerVsPlayerCard({ data, settings, logos }: SharePostCardProps<PlayerVsPlayerSettings, PlayerVsPlayerData>) {
  if (!pvpDataMatches(data, settings)) return <PostEmpty>Settings changed. Refresh this post.</PostEmpty>;
  if (!pvpHasRows(data, settings)) return <PostEmpty>{data.a.appearances && data.b.appearances ? "Nothing comparable in this window" : "One or both players have no appearance in this window"}</PostEmpty>;
  const { discussion } = data;
  /* The stat rows share whatever the discussion leaves, so type size follows how many rows there are and how much room they get. */
  return <div className={styles.card} data-density={data.metrics.length > 3 ? "dense" : "sparse"} data-room={discussion.shown.length ? "shared" : "full"}>
    <div className={styles.players}>
      <Player player={data.a} logo={data.a.team ? logos[data.a.team] : null} side="a" />
      <p className={styles.view}>{data.windowLabel}<br />{data.basisLabel}</p>
      <Player player={data.b} logo={data.b.team ? logos[data.b.team] : null} side="b" />
    </div>
    <div className={styles.stats} data-testid="pvp-stats">
      {data.metrics.map(row => <div key={row.id} className={styles.row} data-metric={row.id}><Value row={row} side="a" /><Track row={row} side="a" /><span className={styles.label}>{row.label}</span><Track row={row} side="b" /><Value row={row} side="b" /></div>)}
    </div>
    <p className={styles.legend} data-testid="pvp-legend">{pvpLegend(data)}</p>
    <section className={styles.discussion} data-testid="pvp-discussion" data-kind={discussion.kind}>
      <h3 data-size={discussion.shown.length ? "full" : "small"}>{discussion.headline}</h3>
      {discussion.shown.length > 0 && <ul className={styles.claims} data-count={discussion.shown.length}>{discussion.shown.map(claim => <Claim key={claim.id} claim={claim} />)}</ul>}
    </section>
  </div>;
}
