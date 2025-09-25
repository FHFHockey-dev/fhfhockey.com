import { useRouter } from "next/router";
import styles from "../../pages/trends/index.module.scss";
import { formatNumber } from "lib/trends/skoUtils";
import type { PlayerPredictionDatum } from "lib/trends/skoTypes";
import Sparkline from "./Sparkline";

export default function PlayerTable({
  players
}: {
  players: PlayerPredictionDatum[];
}) {
  const router = useRouter();
  if (!players?.length) return null;

  return (
    <table className={styles.playerTable}>
      <thead>
        <tr>
          <th>Player</th>
          <th>
            <abbr title="Sustainability K‑Value Outlook — expected production adjusted by how steady recent play has been (prediction × stability). Higher is better.">sKO</abbr>
          </th>
          <th>
            <abbr title="Projected total points over the forecast window (e.g., next 5 games).">Projected Pts</abbr>
          </th>
          <th>
            <abbr title="Stability multiplier (about 0.8–1.0) based on recent consistency. Steadier players get closer to 1.0.">Stability ×</abbr>
          </th>
          <th>
            <abbr title="Recent sKO trend (sparkline) so you can see whether a player is rising or cooling off.">Trend</abbr>
          </th>
        </tr>
      </thead>
      <tbody>
        {players.map((player) => (
          <tr
            key={player.playerId}
            className={styles.clickableRow}
            onClick={() =>
              router.push(
                `/trends/player/${player.playerId}?name=${encodeURIComponent(player.playerName)}`
              )
            }
          >
            <td className={styles.playerCell}>
              <span className={styles.playerName}>{player.playerName}</span>
              <span className={styles.playerMeta}>
                {[player.team ?? "", player.position ?? ""]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </td>
            <td>{formatNumber(player.sko, 1)}</td>
            <td>{formatNumber(player.predPoints, 1)}</td>
            <td>{formatNumber(player.stability, 2)}</td>
            <td className={styles.sparklineCell}>
              <Sparkline data={player.sparkline} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
