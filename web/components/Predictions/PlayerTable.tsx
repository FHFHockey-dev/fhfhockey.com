import { useRouter } from "next/router";
import styles from "./Predictions.module.scss";
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
            <abbr title="Volatility-Discounted Points Pace: recent points per appearance × appearances × a 0.8–1.0 volatility discount. Unvalidated; not a sustainability rating.">
              VDP
            </abbr>
          </th>
          <th>
            <abbr title="Unshrunk recent points pace (0.6 × last-10 + 0.4 × last-5 mean) × appearances (default 5 player appearances, not team games).">
              Pace × Apps
            </abbr>
          </th>
          <th>
            <abbr title="Volatility discount 0.8–1.0 from last-10 vs last-20 points SD. Every series of 10 or fewer games gets 0.9. A presentation choice, not evidence that steadier is better.">
              Volatility ×
            </abbr>
          </th>
          <th>
            <abbr title="Stored VDP by as-of date (one model, version and horizon).">
              VDP history
            </abbr>
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
