import { DEFAULT_GOALIE_FANTASY_POINTS, DEFAULT_SKATER_FANTASY_POINTS } from "lib/projectionsConfig/fantasyPointsConfig";
import type { SharePlayer } from "./types";

/**
 * L5 ranking for every player card (TJ, ticket 15): fantasy points per game over the last five games,
 * scored with the site's default fantasy values (read-only), times an opportunity multiplier from the
 * player's even-strength line or pair, power-play unit and L5 ice time. Season rates break ties.
 */
export const OPPORTUNITY = {
  line: { L1: 0.15, L2: 0.1, L3: 0.05, L4: 0, P1: 0.1, P2: 0.05, P3: 0 } as Record<string, number>,
  pp: { PP1: 0.1, PP2: 0.05 } as Record<string, number>,
  /** Per minute of L5 TOI above (or below) the position baseline, capped either way. */
  toiPerMinute: 0.02,
  toiCap: 0.1,
  toiBaselineSeconds: { F: 16 * 60, D: 20 * 60 },
} as const;

const fp = (key: string, group: "skater" | "goalie") => (group === "goalie" ? DEFAULT_GOALIE_FANTASY_POINTS : DEFAULT_SKATER_FANTASY_POINTS)[key] ?? 0;

/** L5 fantasy points per game from the default config; null without recent games or when any scored part is unknown. */
export function fantasyPointsPerGame(player: Pick<SharePlayer, "recent">): number | null {
  const recent = player.recent;
  if (!recent || recent.games <= 0) return null;
  if (recent.kind === "goalie") {
    // Every scored part must be known over the same games; an unknown part leaves the score unavailable, never 0 (W3-3 A1).
    if (!recent.record || recent.saves === null || recent.goalsAgainst === null || recent.shutouts === null) return null;
    return (recent.record.wins * fp("WINS_GOALIE", "goalie") + recent.saves * fp("SAVES_GOALIE", "goalie") + recent.goalsAgainst * fp("GOALS_AGAINST_GOALIE", "goalie")
      + recent.shutouts * fp("SHUTOUTS_GOALIE", "goalie")) / recent.games;
  }
  // Same rule for skaters (F17): a missing part, such as blocks, leaves the score unavailable; it never scores like a known 0.
  const { goals, assists, ppPoints, shots, hitsPerGame, blocksPerGame } = recent;
  if (goals === null || assists === null || ppPoints === null || shots === null || hitsPerGame === null || blocksPerGame === null) return null;
  const total = goals * fp("GOALS", "skater") + assists * fp("ASSISTS", "skater") + ppPoints * fp("PP_POINTS", "skater")
    + shots * fp("SHOTS_ON_GOAL", "skater") + (hitsPerGame * fp("HITS", "skater") + blocksPerGame * fp("BLOCKED_SHOTS", "skater")) * recent.games;
  return total / recent.games;
}

/** 1 + line/pair + PP unit + relative L5 TOI; goalies and players without recent games stay at 1. */
export function opportunityMultiplier(player: Pick<SharePlayer, "recent" | "group">): number {
  const recent = player.recent;
  if (!recent || recent.kind === "goalie" || player.group === "G") return 1;
  const line = recent.line ? OPPORTUNITY.line[recent.line] ?? 0 : 0, pp = recent.ppUnit ? OPPORTUNITY.pp[recent.ppUnit] ?? 0 : 0;
  const baseline = OPPORTUNITY.toiBaselineSeconds[player.group];
  const toi = recent.toiSeconds === null ? 0 : Math.max(-OPPORTUNITY.toiCap, Math.min(OPPORTUNITY.toiCap, ((recent.toiSeconds - baseline) / 60) * OPPORTUNITY.toiPerMinute));
  return 1 + line + pp + toi;
}

/** Card score: L5 fantasy points per game × opportunity. Null without recent games or with an unknown part (season rate decides). */
export function playerScore(player: Pick<SharePlayer, "recent" | "group">): number | null {
  const perGame = fantasyPointsPerGame(player);
  return perGame === null ? null : perGame * opportunityMultiplier(player);
}

/** Scored players first, best score first; `season` (the existing per-player rate order) breaks ties and orders the unscored. */
export function byScore<T extends Pick<SharePlayer, "recent" | "group">>(score: (player: T) => number | null, season: (a: T, b: T) => number) {
  return (a: T, b: T) => {
    const x = score(a), y = score(b);
    if (x !== null && y !== null && Math.abs(x - y) > 1e-9) return y - x;
    if ((x === null) !== (y === null)) return x === null ? 1 : -1;
    return season(a, b);
  };
}

const signed = (value: number) => (value < 0 ? `−${Math.abs(value)}` : `${value}`);
const pct = (value: number) => `+${Math.round(value * 100)}%`;
const s = DEFAULT_SKATER_FANTASY_POINTS, g = DEFAULT_GOALIE_FANTASY_POINTS, o = OPPORTUNITY;
/** The parts of the formula as printed on the cards, built from the same values the score uses. */
export const FANTASY_TEXT = `L5 fantasy pts/GP (G ${s.GOALS} · A ${s.ASSISTS} · PPP ${s.PP_POINTS} · SOG ${s.SHOTS_ON_GOAL} · HIT ${s.HITS} · BLK ${s.BLOCKED_SHOTS}; goalies W ${g.WINS_GOALIE} · SV ${g.SAVES_GOALIE} · GA ${signed(g.GOALS_AGAINST_GOALIE)} · SO ${g.SHUTOUTS_GOALIE})`;
export const OPPORTUNITY_TEXT = `opportunity (L1 ${pct(o.line.L1)} · L2 ${pct(o.line.L2)} · L3 ${pct(o.line.L3)} · D P1 ${pct(o.line.P1)} · P2 ${pct(o.line.P2)} · PP1 ${pct(o.pp.PP1)} · PP2 ${pct(o.pp.PP2)} · ±${o.toiPerMinute * 100}% per L5 TOI min vs ${o.toiBaselineSeconds.F / 60}:00 F / ${o.toiBaselineSeconds.D / 60}:00 D, max ±${o.toiCap * 100}%)`;
export const SCORE_FORMULA = `Score = ${FANTASY_TEXT} × ${OPPORTUNITY_TEXT}; season rate breaks ties`;
export const SPECIALIST_FORMULA = `Score = L5 category per GP × ${OPPORTUNITY_TEXT}; season per-GP breaks ties`;
