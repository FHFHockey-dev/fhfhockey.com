import type { SharePostCardProps } from "lib/socialShare/modules/contract";
import { confirmationFreshness, confirmationSourceLabel, CONFIRMATION_TONES, headToHeadWinner, HEAD_TO_HEAD_COLORS, metricLabel, type RankedSide } from "lib/socialShare/modules/shared/goalieInventory.sources";
import type { InventoryMetric } from "lib/socialShare/modules/shared/goalieInventory";
import { START_SIT_ROW_LIMIT, startSitConflicting, startSitForecastLabel, startSitRows, startSitStatusLabel, type StartSitData, type StartSitSettings } from "lib/socialShare/modules/startSit";
import { PostEmpty, PostTeamMark } from "./kit";
import styles from "./StartSitCard.module.scss";

const dayLabel = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
/** The table's narrow form of a rate and its rank. */
const rate = (metric: InventoryMetric, digits: number) => metricLabel(metric, digits).replace(/[()]/g, "");
type LensSide = RankedSide & { team: string };
/** One side's value and rank. Green or red only when the pair has a winner; a tie or a missing side stays plain, and a missing metric keeps a dashed edge. */
function Chip({ side, digits, result }: { side: LensSide; digits: number; result: "winner" | "loser" | null }) {
  const missing = side.metric.value === null || side.metric.leagueRank === null;
  return <span data-testid="lens-chip" data-result={result ?? (missing ? "missing" : "neutral")} className={styles.chip} style={result ? { background: HEAD_TO_HEAD_COLORS[result], color: HEAD_TO_HEAD_COLORS.ink } : undefined}>{rate(side.metric, digits)}</span>;
}
/** The goalie's team on the left and the opponent on the right in every lens, each chip beside its logo, with a triangle between the logos at the stronger team. */
function LensCell({ lens, first, second, digits, logos }: { lens: "quality" | "quantity" | "win"; first: LensSide; second: LensSide; digits: number; logos: Record<string, string | null> }) {
  const winner = headToHeadWinner(first, second), result = (index: 0 | 1) => winner === null ? null : winner === index ? "winner" : "loser";
  return <span className={styles.lens} data-testid="lens-cell" data-lens={lens} data-winner={winner === null ? undefined : [first, second][winner].team}>
    <Chip side={first} digits={digits} result={result(0)} />
    <PostTeamMark team={first.team} logo={logos[first.team]} size={18} />
    <svg className={styles.edge} viewBox="0 0 8 10" width="8" height="10" aria-hidden="true">{winner !== null && <polygon data-testid="lens-edge" data-points={winner === 0 ? "left" : "right"} fill={HEAD_TO_HEAD_COLORS.ink} points={winner === 0 ? "8,0 8,10 0,5" : "0,0 0,10 8,5"} />}</svg>
    <PostTeamMark team={second.team} logo={logos[second.team]} size={18} />
    <Chip side={second} digits={digits} result={result(1)} />
  </span>;
}
const HEADS: readonly (readonly [string, string?])[] = [["DATE"], ["GOALIE", "L10 STARTS"], ["GAME"], ["STATUS", "SOURCE · FORECAST"], ["QUALITY", "xGA / OPP xGF"], ["QUANTITY", "SA / OPP SF"], ["WIN", "GF / OPP GA"]];

export default function StartSitCard({ snapshot, data, settings, logos }: SharePostCardProps<StartSitSettings, StartSitData>) {
  const rows = startSitRows(data, settings.search), shown = rows.slice(0, START_SIT_ROW_LIMIT);
  if (!rows.length) return <PostEmpty>{settings.search ? `No goalie or team matches "${settings.search}"` : "No goalie games in this window"}</PostEmpty>;
  const qualified = rows.some(row => row.game.forecast.state === "qualified");
  return <div className={styles.card}>
    <p className={styles.legend} data-testid="start-sit-legend">{shown.length} of {rows.length} goalie games · Green = stronger by league rank · #1 = highest · {qualified ? "No win odds" : "No win or start odds"} · {data.confirmationLegend}</p>
    <div className={styles.table} data-full={shown.length >= 10 || undefined}>
      {HEADS.map(([label, detail]) => <span key={label} className={styles.head}>{label}{detail && <small>{detail}</small>}</span>)}
      {shown.map(({ key, goalie, game }) => {
        const { volume: quantity, ratioExposure: quality, winSupport: win } = game.signals;
        const conflicting = startSitConflicting(data, game), freshness = confirmationFreshness(game.confirmation, snapshot.generatedAt), state = conflicting ? "conflicting" : game.confirmation.state, tone = state === "none" ? null : CONFIRMATION_TONES[state];
        return <div key={key} className={styles.row} data-testid="start-sit-row" data-goalie={goalie.goalieId} data-game={game.gameId}>
          <span>{dayLabel(game.date)}</span>
          <span className={styles.goalie}><b>{goalie.name}</b><small>{goalie.recentStarts.starts === null ? "—" : goalie.recentStarts.starts}/{goalie.recentStarts.teamGames} GS{goalie.recentStarts.reliefAppearances ? ` · ${goalie.recentStarts.reliefAppearances} relief` : ""}</small></span>
          <span className={styles.game} data-testid="start-sit-game"><PostTeamMark team={game.team} logo={logos[game.team]} size={24} />{game.home ? "vs" : "@"}<PostTeamMark team={game.opponent} logo={logos[game.opponent]} size={24} /></span>
          <span data-testid="start-sit-confirmation" data-state={state} className={styles.status} style={tone ? { background: tone.fill, color: tone.ink, border: tone.border ?? undefined } : undefined}>{startSitStatusLabel(state)}{freshness && <small>{confirmationSourceLabel(game.confirmation.source)} · {freshness}</small>}{game.forecast.state === "qualified" && <small data-testid="start-sit-forecast">{startSitForecastLabel(game.forecast.startProbability)}</small>}</span>
          <LensCell lens="quality" first={{ team: game.team, metricId: "xga", metric: quality.teamXgaPerGame }} second={{ team: game.opponent, metricId: "xgf", metric: quality.opponentXgfPerGame }} digits={2} logos={logos} />
          <LensCell lens="quantity" first={{ team: game.team, metricId: "shotsAgainst", metric: quantity.teamShotsAgainstPerGame }} second={{ team: game.opponent, metricId: "shotsFor", metric: quantity.opponentShotsForPerGame }} digits={1} logos={logos} />
          <LensCell lens="win" first={{ team: game.team, metricId: "goalsFor", metric: win.teamGoalsForPerGame }} second={{ team: game.opponent, metricId: "goalsAgainst", metric: win.opponentGoalsAgainstPerGame }} digits={2} logos={logos} />
        </div>;
      })}
    </div>
  </div>;
}
