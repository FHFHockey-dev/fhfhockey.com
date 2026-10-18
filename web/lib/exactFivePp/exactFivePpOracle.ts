/**
 * Independent oracle for exact-five PP fixtures. It deliberately shares no
 * code with `exactFivePpUnits.ts`: instead of a boundary sweep over merged
 * intervals, it samples every whole second `t` of each period and asks, by
 * direct point-in-interval tests on the raw rows, who was on the ice and what
 * the PBP situation was. Shift clocks are whole seconds, so per-second
 * sampling of half-open intervals is exact.
 *
 * Test-only. Not imported by application code.
 */
import type { ExactFiveGameInput } from "./exactFivePpUnits";

export type OracleTallies = {
  unitSeconds: Record<string, number>;
  qualifyingSeconds: Record<string, number>;
  unknownSeconds: Record<string, number>;
  excludedSeconds: Record<string, number>;
};

function bump(target: Record<string, number>, key: string, amount = 1) {
  target[key] = (target[key] ?? 0) + amount;
}

function situationAt(game: ExactFiveGameInput, period: number, t: number): string {
  const periodInput = game.periods.find((candidate) => candidate.period === period)!;
  const segment = periodInput.situationSegments.find(
    (candidate) => candidate.startSecond <= t && t < candidate.endSecond,
  );
  if (!segment) throw new Error(`oracle: no situation at P${period} ${t}s`);
  return segment.situationCode;
}

export function playersOnIceAt(
  game: ExactFiveGameInput,
  teamId: number,
  period: number,
  t: number,
): number[] {
  const ids = new Set<number>();
  for (const shift of game.shifts) {
    if (
      shift.teamId === teamId &&
      shift.period === period &&
      shift.startSecond <= t &&
      t < shift.endSecond
    ) {
      ids.add(shift.playerId);
    }
  }
  return Array.from(ids);
}

function positionOf(game: ExactFiveGameInput, teamId: number, playerId: number) {
  const spot = game.roster.find(
    (candidate) => candidate.teamId === teamId && candidate.playerId === playerId,
  );
  const code = spot?.positionCode?.toUpperCase() ?? null;
  return code && ["C", "L", "R", "D", "G"].includes(code) ? code : null;
}

/** Manpower label for one team from the four situation digits. */
function labelFor(code: string, isHome: boolean): string {
  const awayGoalie = Number(code.charAt(0));
  const awaySkaters = Number(code.charAt(1));
  const homeSkaters = Number(code.charAt(2));
  const homeGoalie = Number(code.charAt(3));
  const mine = isHome ? [homeGoalie, homeSkaters] : [awayGoalie, awaySkaters];
  const theirs = isHome ? [awayGoalie, awaySkaters] : [homeGoalie, homeSkaters];
  if (mine[0] !== 1) return "own_net_empty";
  if (theirs[0] !== 1) return "opponent_net_empty";
  const label = `${mine[1]}v${theirs[1]}`;
  if (label === "5v4" || label === "5v3" || label === "4v3") return label;
  if (mine[1] === theirs[1]) return "even";
  return mine[1] < theirs[1] ? "shorthanded" : "other_advantage";
}

export function runExactFiveOracle(game: ExactFiveGameInput): OracleTallies {
  const tallies: OracleTallies = {
    unitSeconds: {},
    qualifyingSeconds: {},
    unknownSeconds: {},
    excludedSeconds: {},
  };
  const teams = [game.homeTeamId, game.awayTeamId];

  for (const periodInput of game.periods) {
    for (let t = 0; t < periodInput.playedEndSecond; t += 1) {
      const code = situationAt(game, periodInput.period, t);
      const census = new Map<
        number,
        { skaters: number[]; goalies: number; unknown: boolean }
      >();
      for (const teamId of teams) {
        const entry = { skaters: [] as number[], goalies: 0, unknown: false };
        for (const playerId of playersOnIceAt(game, teamId, periodInput.period, t)) {
          const position = positionOf(game, teamId, playerId);
          if (position == null) entry.unknown = true;
          else if (position === "G") entry.goalies += 1;
          else entry.skaters.push(playerId);
        }
        census.set(teamId, entry);
      }

      for (const teamId of teams) {
        const isHome = teamId === game.homeTeamId;
        const label = labelFor(code, isHome);
        const mine = census.get(teamId)!;
        const theirs = census.get(isHome ? game.awayTeamId : game.homeTeamId)!;
        if (label !== "5v4" && label !== "5v3") {
          if (!["even", "shorthanded"].includes(label)) {
            bump(tallies.excludedSeconds, `${teamId}|${label}`);
          }
          continue;
        }
        bump(tallies.qualifyingSeconds, `${teamId}|${label}`);
        let reason: string | null = null;
        if (mine.unknown || theirs.unknown) reason = "unknown_position";
        else if (mine.goalies !== 1 || theirs.goalies !== 1) {
          reason = "goalie_presence_conflict";
        } else if (mine.skaters.length !== 5) reason = "team_skater_count_mismatch";
        else if (theirs.skaters.length !== (label === "5v4" ? 4 : 3)) {
          reason = "opponent_skater_count_mismatch";
        }
        if (reason) {
          bump(tallies.unknownSeconds, `${teamId}|${reason}`);
          continue;
        }
        const ids = mine.skaters.slice().sort((a, b) => a - b).join("-");
        bump(tallies.unitSeconds, `${teamId}|${label}|x5:${ids}`);
      }
    }
  }
  return tallies;
}

/** Seconds two same-team players were on the ice together, any strength. */
export function oraclePairwiseSeconds(
  game: ExactFiveGameInput,
  teamId: number,
  left: number,
  right: number,
): number {
  let seconds = 0;
  for (const periodInput of game.periods) {
    for (let t = 0; t < periodInput.playedEndSecond; t += 1) {
      const onIce = playersOnIceAt(game, teamId, periodInput.period, t);
      if (onIce.includes(left) && onIce.includes(right)) seconds += 1;
    }
  }
  return seconds;
}
