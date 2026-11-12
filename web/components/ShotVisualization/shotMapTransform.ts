import { normalizeCoordinatesToAttackingDirection } from "lib/supabase/Upserts/nhlCoordinates";

/**
 * Folds an NHL play-by-play shot location onto the vertical half rink drawn by
 * `drawHockeyRink(container, { vertical: true, halfRink: true })`, with the
 * attacked net at the top of the SVG.
 *
 * NHL coordinates: x runs along the rink (-100..100), y across it (-42.5..42.5),
 * y up in the standard broadcast view, so a skater attacking +x has +y on
 * their left. SVG y points down, so a mapping that keeps the shooter's left on
 * the viewer's left (looking over the shooter's shoulder toward the net) has
 * determinant -1. Shots in the +x half are folded with (x, y) -> (-y, -x); the
 * -x half is the 180-degree rotation of the same rink, (x, y) -> (y, x). Both
 * branches must keep the same handedness, otherwise the same physical spot
 * plots on opposite sides depending on which end the team attacked.
 *
 * Folding by the sign of x assumes the shot was taken in the attacking half;
 * it is only the fallback when the attack direction is unknown.
 */
export function foldShotToHalfRink(x: number, y: number): [number, number] {
  return x > 0 ? [-y, -x] : [y, x];
}

/** Half-rink fold expressed in the SVG user space of the drawn rink. */
export function shotToHalfRinkSvg(x: number, y: number): [number, number] {
  const [tx, ty] = foldShotToHalfRink(x, y);
  return [tx + 42.5, ty + 100];
}

export type ShotMapShot = {
  xcoord: number;
  ycoord: number;
  hometeamdefendingside?: string | null;
  eventownerteamid?: number | null;
  hometeamid?: number | null;
};

/**
 * Places a shot by the net its team actually attacked: the play-by-play's
 * `hometeamdefendingside` and whether the shooter's team is home (the same
 * normalization the xG features use), so a shot from the team's own half
 * stays in its own half instead of being folded onto the attacked end.
 * Falls back to the sign-of-x fold only when the side or ids are missing.
 */
export function shotToHalfRinkSvgForShot(shot: ShotMapShot): [number, number] {
  const side = shot.hometeamdefendingside;
  if (
    (side === "left" || side === "right") &&
    shot.eventownerteamid != null &&
    shot.hometeamid != null
  ) {
    const normalized = normalizeCoordinatesToAttackingDirection(shot.xcoord, shot.ycoord, {
      homeTeamDefendingSide: side,
      teamSide: shot.eventownerteamid === shot.hometeamid ? "home" : "away",
    });
    if (normalized.normalizedX != null && normalized.normalizedY != null) {
      // Attacking +x: the same fold as the +x branch above.
      return [-normalized.normalizedY + 42.5, -normalized.normalizedX + 100];
    }
  }
  return shotToHalfRinkSvg(shot.xcoord, shot.ycoord);
}
