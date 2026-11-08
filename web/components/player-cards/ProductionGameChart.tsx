import React from "react";
import type { CurrentNhlCard } from "../../lib/player-cards/currentNhl";

/** Fixed 0–5 point scale across every window/player; larger games retain their actual labels. */
export default function ProductionGameChart({ card }: { card: CurrentNhlCard }) {
  const games = [...card.evidence.selectedGames].reverse();
  if (card.state !== "ready" || !games.length || games.length !== card.sample.gp) return <g data-production-unavailable="true"><text x="40" y="440" fontSize="30">Game-by-game production unavailable</text><text x="40" y="480" fontSize="22">Missing evidence is not a zero-point appearance.</text></g>;
  const left = 90, plotWidth = 1050, bottom = 630, unit = 26, step = plotWidth / games.length;
  return <g data-production-chart="true" fill="#1A1D21">
    <text x="40" y="372" fontSize="18" fontWeight="700" fill="#555D60">PRODUCTION BY APPEARANCE · REGULAR SEASON</text>
    {([['goals', 'GOALS'], ['assists', 'ASSISTS'], ['points', 'POINTS'], ['shots', 'SHOTS ON GOAL']] as const).map(([key, label], i) => <g key={key} transform={`translate(${40 + i * 285} 0)`} data-metric={key}><text y="405" fontSize="38" fontWeight="700">{card.values[key] ?? "—"}</text><text y="430" fontSize="17" fill="#555D60">{label}</text></g>)}
    <rect x="90" y="444" width="16" height="16" fill="#07AAE2" /><text x="114" y="458" fontSize="18">Goals</text><rect x="190" y="444" width="16" height="16" fill="#49565E" /><text x="214" y="458" fontSize="18">Assists</text>
    <text x="1140" y="458" textAnchor="end" fontSize="17">Points = goals + assists · fixed 0–5 scale · ↑ above scale</text>
    {[0, 1, 2, 3, 4, 5].map(tick => <g key={tick}><line x1={left} x2={left + plotWidth} y1={bottom - tick * unit} y2={bottom - tick * unit} stroke="#D0D3CE" /><text x="70" y={bottom - tick * unit + 6} textAnchor="end" fontSize="17" fill="#555D60">{tick}</text></g>)}
    {games.map((game, index) => {
      const x = left + step * (index + .5), width = Math.min(48, step * .62), goals = Math.min(game.goals, 5), assists = Math.min(game.assists, 5 - goals), top = bottom - (goals + assists) * unit;
      const showDate = games.length <= 10 || index === 0 || index === games.length - 1 || (index + 1) % 5 === 0;
      return <g key={game.gameId} data-game-id={game.gameId} data-game-points={game.points} data-game-date={game.providerDate}>
        <title>{game.providerDate}: {game.goals} goals, {game.assists} assists, {game.points} points, {game.shots} shots on goal</title>
        <rect x={x - width / 2} y={bottom - goals * unit} width={width} height={goals * unit} fill="#07AAE2" data-goals={game.goals} />
        <rect x={x - width / 2} y={top} width={width} height={assists * unit} fill="#49565E" data-assists={game.assists} />
        {game.points === 0 && <circle cx={x} cy={bottom} r="3" fill="#F2F1EB" stroke="#49565E" />}
        <text x={x} y={top - 7} textAnchor="middle" fontSize="19" fontWeight="700">{game.points}{game.points > 5 ? "↑" : ""}</text>
        {showDate && <text x={x} y="654" textAnchor="middle" fontSize="16" fill="#555D60">{game.providerDate.slice(5).replace('-', '/')}</text>}
      </g>;
    })}
    <text x="40" y="682" fontSize="16" fill="#555D60">Oldest → newest · one column per appearance, not equal calendar intervals · labels show actual points</text>
  </g>;
}
