import type { SharePostCardProps } from "lib/socialShare/modules/contract";
import { confirmationFreshness, confirmationLabel, confirmationSourceLabel, CONFIRMATION_TONES, forecastLabel, metricLabel, rankBand, RANK_BANDS, type RankBand } from "lib/socialShare/modules/shared/goalieInventory.sources";
import type { InventoryMetric } from "lib/socialShare/modules/shared/goalieInventory";
import { START_SIT_ROW_LIMIT, startSitConflicting, startSitRows, type StartSitData, type StartSitSettings } from "lib/socialShare/modules/startSit";
import { PostEmpty, PostTeamMark } from "./kit";
import styles from "./StartSitCard.module.scss";

const dayLabel = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
/** The table's narrow form of a rate and its rank. */
const rate = (metric: InventoryMetric, digits: number) => metricLabel(metric, digits).replace(/[()]/g, "");
/** One metric on the rank scale. No rank means no fill and a dashed edge, never the bottom colour. */
function RankChip({ metric, digits }: { metric: InventoryMetric; digits: number }) {
  const band = rankBand(metric);
  return <span data-testid="rank-chip" data-band={band ?? "missing"} className={styles.chip} style={band ? { background: RANK_BANDS[band].fill, color: RANK_BANDS[band].ink } : undefined}>{rate(metric, digits)}</span>;
}
function LensCell({ metrics, digits }: { metrics: readonly [InventoryMetric, InventoryMetric]; digits: number }) {
  return <span className={styles.lens}><RankChip metric={metrics[0]} digits={digits} /><RankChip metric={metrics[1]} digits={digits} /></span>;
}
const HEADS: readonly (readonly [string, string?])[] = [["DATE"], ["GOALIE", "L10 STARTS"], ["GAME"], ["SOURCE STATUS"], ["FORECAST"], ["VOLUME", "OPP SF / SA"], ["RATIO", "OPP xGF / xGA"], ["WIN", "GF / OPP GA"]];

export default function StartSitCard({ snapshot, data, settings, logos }: SharePostCardProps<StartSitSettings, StartSitData>) {
  const rows = startSitRows(data, settings.search), shown = rows.slice(0, START_SIT_ROW_LIMIT);
  if (!rows.length) return <PostEmpty>{settings.search ? `No goalie or team matches "${settings.search}"` : "No goalie games in this window"}</PostEmpty>;
  const qualified = rows.some(row => row.game.forecast.state === "qualified");
  return <div className={styles.card}>
    <p className={styles.legend} data-testid="start-sit-legend">{shown.length} of {rows.length} goalie games · #1 = highest <span className={styles.key}>{(Object.keys(RANK_BANDS) as RankBand[]).map(band => <span key={band}><i style={{ background: RANK_BANDS[band].fill }} />{RANK_BANDS[band].label}</span>)}</span> · {qualified ? "No win odds" : "No win or start odds"} · {data.confirmationLegend}</p>
    <div className={styles.table} data-full={shown.length >= 10 || undefined}>
      {HEADS.map(([label, detail]) => <span key={label} className={styles.head}>{label}{detail && <small>{detail}</small>}</span>)}
      {shown.map(({ key, goalie, game }) => {
        const { volume, ratioExposure: ratio, winSupport: win } = game.signals;
        const conflicting = startSitConflicting(data, game), freshness = confirmationFreshness(game.confirmation, snapshot.generatedAt), state = conflicting ? "conflicting" : game.confirmation.state, tone = state === "none" ? null : CONFIRMATION_TONES[state];
        return <div key={key} className={styles.row} data-testid="start-sit-row" data-goalie={goalie.goalieId} data-game={game.gameId}>
          <span>{dayLabel(game.date)}</span>
          <span className={styles.goalie}><b>{goalie.name}</b><small>{goalie.recentStarts.starts === null ? "—" : goalie.recentStarts.starts}/{goalie.recentStarts.teamGames} GS{goalie.recentStarts.reliefAppearances ? ` · ${goalie.recentStarts.reliefAppearances} relief` : ""}</small></span>
          <span className={styles.game}><PostTeamMark team={game.team} logo={logos[game.team]} size={24} />{game.home ? "vs" : "@"} {game.opponent}</span>
          <span data-testid="start-sit-confirmation" data-state={state} className={styles.status} style={tone ? { background: tone.fill, color: tone.ink, border: tone.border ?? undefined } : undefined}>{confirmationLabel(game.confirmation, conflicting)}{freshness && <small>{confirmationSourceLabel(game.confirmation.source)} · {freshness}</small>}</span>
          <span data-testid="start-sit-forecast" data-state={game.forecast.state}>{forecastLabel(game.forecast)}</span>
          <LensCell metrics={[volume.opponentShotsForPerGame, volume.teamShotsAgainstPerGame]} digits={1} />
          <LensCell metrics={[ratio.opponentXgfPerGame, ratio.teamXgaPerGame]} digits={2} />
          <LensCell metrics={[win.teamGoalsForPerGame, win.opponentGoalsAgainstPerGame]} digits={2} />
        </div>;
      })}
    </div>
  </div>;
}
