import type { SharePostCardProps } from "lib/socialShare/modules/contract";
import { confirmationFreshness, confirmationLabel, forecastLabel, metricLabel } from "lib/socialShare/modules/shared/goalieInventory.sources";
import { START_SIT_ROW_LIMIT, startSitConflicting, startSitRows, type StartSitData, type StartSitSettings } from "lib/socialShare/modules/startSit";
import { PostEmpty, PostTeamMark } from "./kit";
import styles from "./StartSitCard.module.scss";

const dayLabel = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export default function StartSitCard({ snapshot, data, settings, logos }: SharePostCardProps<StartSitSettings, StartSitData>) {
  const rows = startSitRows(data, settings.search), shown = rows.slice(0, START_SIT_ROW_LIMIT);
  if (!rows.length) return <PostEmpty>{settings.search ? `No goalie or team matches "${settings.search}"` : "No goalie games in this window"}</PostEmpty>;
  return <div className={styles.card}>
    <div className={styles.table}>
      {["DATE", "GOALIE", "GAME", "SOURCE STATUS", "FORECAST", "VOLUME: OPP SF / SA", "RATIO: OPP xGF / xGA", "WIN: GF / OPP GA"].map(label => <span key={label} className={styles.head}>{label}</span>)}
      {shown.map(({ key, goalie, game }) => {
        const { volume, ratioExposure: ratio, winSupport: win } = game.signals;
        const conflicting = startSitConflicting(data, game), freshness = confirmationFreshness(game.confirmation, snapshot.generatedAt);
        return <div key={key} className={styles.row} data-testid="start-sit-row" data-goalie={goalie.goalieId} data-game={game.gameId}>
          <span>{dayLabel(game.date)}</span>
          <span className={styles.goalie}><b>{goalie.name}</b><small>{goalie.recentStarts.starts === null ? "—" : goalie.recentStarts.starts}/{goalie.recentStarts.teamGames} GS, last {goalie.recentStarts.teamGames} team games{goalie.recentStarts.reliefAppearances ? `, ${goalie.recentStarts.reliefAppearances} relief` : ""}</small></span>
          <span className={styles.game}><PostTeamMark team={game.team} logo={logos[game.team]} size={24} />{game.home ? "vs" : "@"} {game.opponent}</span>
          <span data-testid="start-sit-confirmation" data-state={conflicting ? "conflicting" : game.confirmation.state} className={styles.status}>{confirmationLabel(game.confirmation, conflicting)}{freshness && <small>{game.confirmation.source} · {freshness}</small>}</span>
          <span data-testid="start-sit-forecast" data-state={game.forecast.state}>{forecastLabel(game.forecast)}</span>
          <span>{metricLabel(volume.opponentShotsForPerGame, 1)} / {metricLabel(volume.teamShotsAgainstPerGame, 1)}</span>
          <span>{metricLabel(ratio.opponentXgfPerGame, 2)} / {metricLabel(ratio.teamXgaPerGame, 2)}</span>
          <span>{metricLabel(win.teamGoalsForPerGame, 2)} / {metricLabel(win.opponentGoalsAgainstPerGame, 2)}</span>
        </div>;
      })}
    </div>
    {rows.length > shown.length && <p className={styles.note}>Showing {shown.length} of {rows.length} goalie games. Search a goalie or team to narrow.</p>}
    <p className={styles.note}>Season-to-date rates; #1 is the highest value. Volume, ratio and win are separate, correlated lenses, never added, and no win odds are given.</p>
    <p className={styles.note} data-testid="start-sit-confirmation-note">{data.confirmationNote}</p>
    <p className={styles.note} data-testid="start-sit-forecast-note">{data.forecastNote}</p>
  </div>;
}
