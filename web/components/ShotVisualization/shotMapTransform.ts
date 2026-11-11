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
 * Folding by the sign of x assumes the shot was taken in the attacking half.
 * Attack direction from `hometeamdefendingside` needs the game's home team id
 * on each shot, which the shot-data hook does not carry yet.
 */
export function foldShotToHalfRink(x: number, y: number): [number, number] {
  return x > 0 ? [-y, -x] : [y, x];
}

/** Half-rink fold expressed in the SVG user space of the drawn rink. */
export function shotToHalfRinkSvg(x: number, y: number): [number, number] {
  const [tx, ty] = foldShotToHalfRink(x, y);
  return [tx + 42.5, ty + 100];
}
