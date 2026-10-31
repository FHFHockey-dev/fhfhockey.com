import type { SharePostCardProps } from "lib/socialShare/modules/contract";
import { confirmationFreshness, confirmationLabel, confirmationSourceLabel, forecastLabel, metricLabel } from "lib/socialShare/modules/shared/goalieInventory.sources";
import type { InventoryMetric } from "lib/socialShare/modules/shared/goalieInventory";
import { START_SIT_ROW_LIMIT, startSitConflicting, startSitRows, type StartSitData, type StartSitSettings } from "lib/socialShare/modules/startSit";
import { PostEmpty, PostTeamMark } from "./kit";
import styles from "./StartSitCard.module.scss";

const dayLabel = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
/** The table's narrow form of a rate and its rank. */
const rate = (metric: InventoryMetric, digits: number) => metricLabel(metric, digits).replace(/[()]/g, "");
const HEADS: readonly (readonly [string, string?])[] = [["DATE"], ["GOALIE", "L10 STARTS"], ["GAME"], ["SOURCE STATUS"], ["FORECAST"], ["VOLUME", "OPP SF / SA"], ["RATIO", "OPP xGF / xGA"], ["WIN", "GF / OPP GA"]];

export default function StartSitCard({ snapshot, data, settings, logos }: SharePostCardProps<StartSitSettings, StartSitData>) {
  const rows = startSitRows(data, settings.search), shown = rows.slice(0, START_SIT_ROW_LIMIT);
  if (!rows.length) return <PostEmpty>{settings.search ? `No goalie or team matches "${settings.search}"` : "No goalie games in this window"}</PostEmpty>;
  const qualified = rows.some(row => row.game.forecast.state === "qualified");
  return <div className={styles.card}>
    <p className={styles.legend} data-testid="start-sit-legend">{shown.length} of {rows.length} goalie games · #1 = highest · {qualified ? "No win odds" : "No win or start odds"} · {data.confirmationLegend}</p>
    <div className={styles.table} data-full={shown.length >= 10 || undefined}>
      {HEADS.map(([label, detail]) => <span key={label} className={styles.head}>{label}{detail && <small>{detail}</small>}</span>)}
      {shown.map(({ key, goalie, game }) => {
        const { volume, ratioExposure: ratio, winSupport: win } = game.signals;
        const conflicting = startSitConflicting(data, game), freshness = confirmationFreshness(game.confirmation, snapshot.generatedAt);
        return <div key={key} className={styles.row} data-testid="start-sit-row" data-goalie={goalie.goalieId} data-game={game.gameId}>
          <span>{dayLabel(game.date)}</span>
          <span className={styles.goalie}><b>{goalie.name}</b><small>{goalie.recentStarts.starts === null ? "—" : goalie.recentStarts.starts}/{goalie.recentStarts.teamGames} GS{goalie.recentStarts.reliefAppearances ? ` · ${goalie.recentStarts.reliefAppearances} relief` : ""}</small></span>
          <span className={styles.game}><PostTeamMark team={game.team} logo={logos[game.team]} size={24} />{game.home ? "vs" : "@"} {game.opponent}</span>
          <span data-testid="start-sit-confirmation" data-state={conflicting ? "conflicting" : game.confirmation.state} className={styles.status}>{confirmationLabel(game.confirmation, conflicting)}{freshness && <small>{confirmationSourceLabel(game.confirmation.source)} · {freshness}</small>}</span>
          <span data-testid="start-sit-forecast" data-state={game.forecast.state}>{forecastLabel(game.forecast)}</span>
          <span className={styles.rate}>{rate(volume.opponentShotsForPerGame, 1)} / {rate(volume.teamShotsAgainstPerGame, 1)}</span>
          <span className={styles.rate}>{rate(ratio.opponentXgfPerGame, 2)} / {rate(ratio.teamXgaPerGame, 2)}</span>
          <span className={styles.rate}>{rate(win.teamGoalsForPerGame, 2)} / {rate(win.opponentGoalsAgainstPerGame, 2)}</span>
        </div>;
      })}
    </div>
  </div>;
}
