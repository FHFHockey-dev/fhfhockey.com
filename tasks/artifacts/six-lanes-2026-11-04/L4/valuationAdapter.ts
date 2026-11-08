import type { GameExpectationsResponse } from "../../../../web/lib/player-forecasts/gameExpectations";
import type { TradeScoring } from "../../../../web/lib/buyLowSellHigh/trade";
import { scoreBoardStats } from "../../../../web/lib/projections/starterBoardScoring";
import type { Result } from "../../../../web/lib/tradeValue/contracts";

/**
 * Offline next-slice implementation, not installed or wired.
 * Input must come from the existing admitted consumer -> contribution resolution ->
 * buildGameExpectations path at asOf. A caller-supplied view is not proof of admission.
 * This function adds no reads and cannot validate new accepted news or re-admit cached outputs.
 */
export function leagueValuationComponents(input: {
  view: GameExpectationsResponse | null; playerId: string; asOf: string;
  leagueProfile: { id: string; version: string; origin: "connected" | "manual" | "fhfh_standard" };
  scoring: TradeScoring | null;
}) {
  const unavailable = (reason: string): Result<number> => ({ status: "unavailable", reasons: [reason] });
  let projectedPoints: Result<number> = unavailable("qualified_forecast_unavailable");
  const { view, scoring } = input;
  const asOf = Date.parse(input.asOf);
  if (!input.leagueProfile.id.trim() || !input.leagueProfile.version.trim()) projectedPoints = unavailable("league_profile_unavailable");
  else if (!scoring || scoring.mode !== "points") projectedPoints = unavailable("points_scoring_required");
  else if (!scoring.scoringBasis.trim() || !Object.values(scoring.weights).some(weight => weight !== 0)
    || Object.values(scoring.weights).some(weight => !Number.isFinite(weight))) projectedPoints = unavailable("invalid_scoring");
  else if (!view || !Number.isFinite(asOf) || Date.parse(view.readAsOf) !== asOf) projectedPoints = unavailable("current_admitted_view_required");
  else if (view.scope.mode !== "next_n" || ![5, 10, 20].includes(view.scope.games)) projectedPoints = unavailable("unsupported_horizon");
  else {
    const matches = view.players.filter(player => player.playerId === input.playerId);
    const player = matches.length === 1 ? matches[0] : null;
    const keys = Object.entries(scoring.weights).filter(([, weight]) => weight !== 0).map(([key]) => key);
    if (!player || player.nhlPlayerId === null) projectedPoints = unavailable("player_identity_unavailable");
    else if (!player.horizonComplete || player.requestedGames !== view.scope.games || player.games.length !== view.scope.games
      || new Set(player.games.map(game => game.gameId)).size !== player.games.length) projectedPoints = unavailable("incomplete_horizon");
    else if (keys.some(key => {
      const total = player.totals[key];
      return !total || total.expected === null || !Number.isFinite(total.expected) || total.unit === null
        || total.coveredGames !== player.games.length || total.requiredGames !== player.games.length
        || player.games.some(game => {
          const target = game.targets[key];
          if (!target || !target.allowedUses.totals || !target.allowedUses.comparison || !target.sourceIds.length
            || target.unit !== total.unit || target.expected === null || !Number.isFinite(target.expected)) return true;
          const cutoff = Date.parse(target.cutoffAt ?? ""), issued = Date.parse(target.issuedAt ?? ""), expires = Date.parse(target.expiresAt ?? "");
          return !Number.isFinite(cutoff) || !Number.isFinite(issued) || !Number.isFinite(expires) || cutoff > issued || issued > asOf || expires <= asOf;
        })
        || total.expected !== player.games.reduce((sum, game) => sum + game.targets[key].expected!, 0);
    })) projectedPoints = unavailable("scored_target_unqualified");
    else {
      const scored = scoreBoardStats(Object.fromEntries(keys.map(key => [key, player.totals[key].expected])), scoring.weights);
      projectedPoints = scored.points !== null && Number.isFinite(scored.points)
        ? { status: "available", value: scored.points } : unavailable("scored_points_unavailable");
    }
  }
  return {
    version: "league-valuation-components-v1" as const,
    leagueProfile: input.leagueProfile,
    scoringBasis: scoring?.mode === "points" ? scoring.scoringBasis : null,
    playerId: input.playerId, asOf: input.asOf,
    horizonTeamGames: view?.scope.mode === "next_n" ? view.scope.games : null,
    // Existing scorer's four-decimal rounding; not a new utility or blended valuation method.
    projectedPoints,
    vor: unavailable("qualified_replacement_level_unavailable"),
    actualPoints: unavailable("season_actuals_unavailable"), actualRank: unavailable("season_rank_unavailable"),
    adp: unavailable("dated_adp_unavailable"),
    combined: unavailable("validated_normalization_and_weights_unavailable"),
    plausibility: { status: "unavailable" as const, reasons: ["validated_guard_thresholds_unavailable"] },
  };
}
