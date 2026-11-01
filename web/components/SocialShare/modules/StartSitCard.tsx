import type { SharePostCardProps } from "lib/socialShare/modules/contract";
import { confirmationFreshness, confirmationSourceLabel, CONFIRMATION_TONES, headToHeadWinner, HEAD_TO_HEAD_COLORS, metricLabel, NO_UPCOMING_LABEL, rankedSide, type RankedSide, type TeamLensMetric } from "lib/socialShare/modules/shared/goalieInventory.sources";
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
  if (!data.inventory.goalies.length) return <PostEmpty>{NO_UPCOMING_LABEL}: {data.periodLabel}</PostEmpty>;
  if (!rows.length) return <PostEmpty>{`No goalie or team matches "${settings.search}"`}</PostEmpty>;
  const qualified = rows.some(row => row.game.forecast.state === "qualified");
  const side = (team: string, metricId: TeamLensMetric, metric: InventoryMetric): LensSide => ({ ...rankedSide(data.lowFirstRanks, team, metricId, metric), team });
  return <div className={styles.card}>
    <p className={styles.legend} data-testid="start-sit-legend"><b data-testid="start-sit-period">{data.periodLabel}</b> · {shown.length} of {rows.length} goalie games · Green = stronger by league rank · #1 = highest · {qualified ? "No win odds" : "No win or start odds"} · {data.confirmationLegend}</p>
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
          <LensCell lens="quality" first={side(game.team, "xga", quality.teamXgaPerGame)} second={side(game.opponent, "xgf", quality.opponentXgfPerGame)} digits={2} logos={logos} />
          <LensCell lens="quantity" first={side(game.team, "shotsAgainst", quantity.teamShotsAgainstPerGame)} second={side(game.opponent, "shotsFor", quantity.opponentShotsForPerGame)} digits={1} logos={logos} />
          <LensCell lens="win" first={side(game.team, "goalsFor", win.teamGoalsForPerGame)} second={side(game.opponent, "goalsAgainst", win.opponentGoalsAgainstPerGame)} digits={2} logos={logos} />
        </div>;
      })}
    </div>
  </div>;
}
