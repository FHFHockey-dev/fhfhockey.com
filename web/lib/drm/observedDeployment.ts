import { buildEvenStrengthTeamUnitToiRows } from "../rankings/teamUnitToiBuilder";

export type MatrixStrength = "all" | "fiveOnFive" | "otherEs" | "pp" | "pk";
type Strength = "es" | "pp" | "pk";
type Role = "F" | "D" | "G";
export type DeploymentShiftRow = {
  game_id: number;
  player_id: number;
  team_id: number;
  player_type: Role;
  game_toi: string;
  game_length: string;
  total_es_toi: string;
  total_pp_toi: string;
  total_pk_toi: string;
  shifts: unknown;
  pp_shifts: unknown;
  es_shifts: unknown;
};
export type ObservedDeploymentUnit = {
  teamId: number;
  gameIds: number[];
  strength: "fiveOnFive" | "pp" | "pk";
  kind: "forward_line" | "defense_pair" | "power_play" | "penalty_kill";
  playerIds: number[];
  seconds: number;
  skaterCount: number;
};
export type DeploymentAnalysis = {
  totalsByStrength: Record<MatrixStrength, Record<number, number>>;
  pairsByStrength: Record<MatrixStrength, Array<{ firstPlayerId: number; secondPlayerId: number; seconds: number }>>;
  units: ObservedDeploymentUnit[];
  formationCoverage: {
    fiveOnFiveSeconds: number;
    otherEsSecondsByTeam: Record<number, number>;
    excludedSpecialTeamsSecondsByTeam: Record<number, number>;
    unrepresentedFiveOnFiveSecondsByTeam: Record<number, number>;
  };
};
type Interval = { period: number; start: number; end: number; localStart: number; localEnd: number };
type TaggedInterval = Interval & { strength: Strength; playerId: number; teamId: number; role: Role };
const strengths: MatrixStrength[] = ["all", "fiveOnFive", "otherEs", "pp", "pk"];
const object = (value: unknown): value is Record<string, unknown> =>
  value != null && typeof value === "object" && !Array.isArray(value);
const id = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0;
function invalid(reason: string): never { throw new Error(`Invalid deployment evidence: ${reason}`); }
function clock(value: unknown): number {
  if (typeof value !== "string" || !/^\d+:[0-5]\d$/.test(value)) invalid("clock");
  const [minutes, seconds] = value.split(":").map(Number);
  const result = minutes * 60 + seconds;
  if (!Number.isSafeInteger(result)) invalid("clock overflow");
  return result;
}
function add(record: Record<number, number>, key: number, seconds: number) {
  const next = (record[key] ?? 0) + seconds;
  if (!Number.isSafeInteger(next)) invalid("seconds overflow");
  record[key] = next;
}
function compareIds(left: readonly number[], right: readonly number[]): number {
  for (let i = 0; i < Math.min(left.length, right.length); i += 1) {
    if (left[i] !== right[i]) return left[i] - right[i];
  }
  return left.length - right.length;
}
function unitKey(unit: Pick<ObservedDeploymentUnit, "teamId" | "strength" | "kind" | "skaterCount" | "playerIds">) {
  return [unit.teamId, unit.strength, unit.kind, unit.skaterCount, unit.playerIds.join(",")].join(":");
}
function recordUnit(units: Map<string, ObservedDeploymentUnit>, unit: ObservedDeploymentUnit) {
  const key = unitKey(unit);
  const existing = units.get(key);
  if (existing) {
    existing.seconds += unit.seconds;
    existing.gameIds = [...new Set([...existing.gameIds, ...unit.gameIds])].sort((a, b) => a - b);
    if (!Number.isSafeInteger(existing.seconds)) invalid("unit seconds overflow");
  } else units.set(key, { ...unit, playerIds: [...unit.playerIds], gameIds: [...new Set(unit.gameIds)].sort((a, b) => a - b) });
}

export function analyzeDeploymentGame(args: {
  gameId: number;
  gameType: 2 | 3;
  homeTeamId: number;
  awayTeamId: number;
  rows: readonly DeploymentShiftRow[];
}): DeploymentAnalysis {
  if (!id(args.gameId) || !id(args.homeTeamId) || !id(args.awayTeamId) || args.homeTeamId === args.awayTeamId ||
    ![2, 3].includes(args.gameType) || !Array.isArray(args.rows) || args.rows.length === 0) invalid("game scope");
  const teamIds = [args.homeTeamId, args.awayTeamId];
  const seenPlayers = new Set<number>();
  const seenTeams = new Set<number>();
  const tagged: TaggedInterval[] = [];
  let gameLength: number | undefined;
  const totalsByStrength = Object.fromEntries(strengths.map(strength => [strength, {}])) as DeploymentAnalysis["totalsByStrength"];

  for (const row of args.rows) {
    if (!object(row) || row.game_id !== args.gameId || !id(row.player_id) || seenPlayers.has(row.player_id) ||
      !id(row.team_id) || !teamIds.includes(row.team_id) ||
      (row.player_type !== "F" && row.player_type !== "D" && row.player_type !== "G")) invalid("player/game/team identity");
    seenPlayers.add(row.player_id);
    seenTeams.add(row.team_id);
    const length = clock(row.game_length);
    if (length < 3600 || (args.gameType === 2 && length > 3900) || (gameLength != null && length !== gameLength)) invalid("game length");
    gameLength = length;
    const parseIntervals = (value: unknown): Array<Interval & { source: Record<string, unknown> }> => {
      if (!Array.isArray(value)) invalid("missing interval array");
      const parsed = value.map(segment => {
        if (!object(segment) || !id(segment.period) || (segment.playerId != null && segment.playerId !== row.player_id) ||
          (segment.shift_number != null && !id(segment.shift_number))) invalid("interval identity");
        const period = segment.period;
        const nominalLength = period <= 3 || args.gameType === 3 ? 1200 : 300;
        const offset = period <= 3 ? (period - 1) * 1200 : 3600 + (period - 4) * nominalLength;
        const start = clock(segment.start_time);
        const end = clock(segment.end_time);
        if ((args.gameType === 2 && period > 4) || !Number.isSafeInteger(offset) || end <= start || end > nominalLength ||
          offset + end > length || clock(segment.duration) !== end - start) invalid("interval bounds/duration");
        return { period, start: offset + start, end: offset + end, localStart: start, localEnd: end, source: segment };
      }).sort((a, b) => a.start - b.start || a.end - b.end);
      if (parsed.some((segment, index) => index > 0 && segment.start < parsed[index - 1].end)) invalid("overlapping/duplicate intervals");
      return parsed;
    };
    const physical = parseIntervals(row.shifts);
    const pp = parseIntervals(row.pp_shifts);
    const nonPp = parseIntervals(row.es_shifts);
    const classified = [...pp.map(segment => {
      if (segment.source.strength !== "pp") invalid("PP segment strength");
      return { ...segment, strength: "pp" as const };
    }), ...nonPp.map((segment): Interval & { strength: Strength } => {
      if (segment.source.strength !== "es" && segment.source.strength !== "pk") invalid("non-PP segment strength");
      return { ...segment, strength: segment.source.strength };
    })].sort((a, b) => a.start - b.start || a.end - b.end);
    // Compare interval unions, allowing a strength transition inside one physical shift.
    let classifiedIndex = 0;
    for (const interval of physical) {
      let coveredUntil = interval.start;
      while (classifiedIndex < classified.length && classified[classifiedIndex].start < interval.end) {
        const segment = classified[classifiedIndex];
        if (segment.start !== coveredUntil || segment.end > interval.end) invalid("strength partition");
        coveredUntil = segment.end;
        classifiedIndex += 1;
      }
      if (coveredUntil !== interval.end) invalid("strength partition");
    }
    if (classifiedIndex !== classified.length) invalid("strength partition outside physical ice time");
    const total = physical.reduce((sum, interval) => sum + interval.end - interval.start, 0);
    if (total <= 0 || total !== clock(row.game_toi) || total > length) invalid("player TOI");
    const byStrength = { es: 0, pp: 0, pk: 0 };
    for (const segment of classified) {
      byStrength[segment.strength] += segment.end - segment.start;
      tagged.push({ ...segment, playerId: row.player_id, teamId: row.team_id, role: row.player_type });
    }
    if (byStrength.es !== clock(row.total_es_toi) || byStrength.pp !== clock(row.total_pp_toi) ||
      byStrength.pk !== clock(row.total_pk_toi)) invalid("input strength totals");
    for (const strength of strengths) totalsByStrength[strength][row.player_id] = 0;
  }
  if (seenTeams.size !== 2) invalid("both teams required");

  const pairMaps = Object.fromEntries(strengths.map(strength => [strength, new Map<string, { firstPlayerId: number; secondPlayerId: number; seconds: number }>()])) as Record<MatrixStrength, Map<string, { firstPlayerId: number; secondPlayerId: number; seconds: number }>>;
  const units = new Map<string, ObservedDeploymentUnit>();
  const formationCoverage: DeploymentAnalysis["formationCoverage"] = {
    fiveOnFiveSeconds: 0,
    otherEsSecondsByTeam: Object.fromEntries(teamIds.map(team => [team, 0])),
    excludedSpecialTeamsSecondsByTeam: Object.fromEntries(teamIds.map(team => [team, 0])),
    unrepresentedFiveOnFiveSecondsByTeam: Object.fromEntries(teamIds.map(team => [team, 0])),
  };
  const expectedUnitSeconds: Record<number, number> = Object.fromEntries(teamIds.map(team => [team, 0]));
  const events = new Map<number, { enter: TaggedInterval[]; exit: number[] }>();
  for (const segment of tagged) {
    const start = events.get(segment.start) ?? { enter: [], exit: [] };
    start.enter.push(segment);
    events.set(segment.start, start);
    const end = events.get(segment.end) ?? { enter: [], exit: [] };
    end.exit.push(segment.playerId);
    events.set(segment.end, end);
  }
  const boundaries = [...events.keys()].sort((a, b) => a - b);
  const active = new Map<number, TaggedInterval>();
  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const boundary = boundaries[index];
    const event = events.get(boundary)!;
    for (const playerId of event.exit) active.delete(playerId);
    for (const segment of event.enter) active.set(segment.playerId, segment);
    const seconds = boundaries[index + 1] - boundary;
    const teams = teamIds.map(team => [...active.values()].filter(segment => segment.teamId === team));
    const states = teams.map(players => {
      const states = new Set(players.map(player => player.strength));
      if (states.size > 1) invalid("teammates disagree on strength");
      return players[0]?.strength;
    });
    if (states[0] && states[1] && !((states[0] === "es" && states[1] === "es") ||
      (states[0] === "pp" && states[1] === "pk") || (states[0] === "pk" && states[1] === "pp"))) invalid("opponents disagree on strength");
    const skaters = teams.map(players => players.filter(player => player.role !== "G"));
    const goalieCounts = teams.map(players => players.filter(player => player.role === "G").length);
    const fiveOnFive = states.every(state => state === "es") && skaters.every(players => players.length === 5) && goalieCounts.every(count => count === 1);
    if (fiveOnFive) formationCoverage.fiveOnFiveSeconds += seconds;
    for (let teamIndex = 0; teamIndex < teams.length; teamIndex += 1) {
      const players = teams[teamIndex].sort((a, b) => a.playerId - b.playerId);
      const teamId = teamIds[teamIndex];
      if (states[teamIndex] === "es" && !fiveOnFive) add(formationCoverage.otherEsSecondsByTeam, teamId, seconds);
      if (fiveOnFive) {
        const forwards = skaters[teamIndex].filter(player => player.role === "F").length;
        if (forwards === 3) add(expectedUnitSeconds, teamId, seconds);
        else add(formationCoverage.unrepresentedFiveOnFiveSecondsByTeam, teamId, seconds);
      }
      const teamState = states[teamIndex];
      const state: MatrixStrength = teamState === "es" ? fiveOnFive ? "fiveOnFive" : "otherEs" : teamState ?? "otherEs";
      for (const player of players) {
        add(totalsByStrength.all, player.playerId, seconds);
        add(totalsByStrength[state], player.playerId, seconds);
      }
      for (let first = 0; first < players.length; first += 1) {
        for (let second = first + 1; second < players.length; second += 1) {
          const key = `${players[first].playerId}:${players[second].playerId}`;
          for (const strength of ["all", state] as MatrixStrength[]) {
            const fact = pairMaps[strength].get(key) ?? { firstPlayerId: players[first].playerId, secondPlayerId: players[second].playerId, seconds: 0 };
            fact.seconds += seconds;
            pairMaps[strength].set(key, fact);
          }
        }
      }
    }
    const ppIndex = states.findIndex(state => state === "pp");
    if (ppIndex >= 0) {
      const pkIndex = 1 - ppIndex;
      const ppCount = skaters[ppIndex].length;
      const pkCount = skaters[pkIndex].length;
      const normalAdvantage = (ppCount === 5 && (pkCount === 3 || pkCount === 4)) || (ppCount === 4 && pkCount === 3);
      if (normalAdvantage && states[pkIndex] === "pk" && goalieCounts.every(count => count === 1)) {
        for (const [teamIndex, kind, strength] of [[ppIndex, "power_play", "pp"], [pkIndex, "penalty_kill", "pk"]] as const) {
          recordUnit(units, { teamId: teamIds[teamIndex], gameIds: [args.gameId], strength, kind,
            playerIds: skaters[teamIndex].map(player => player.playerId).sort((a, b) => a - b),
            seconds, skaterCount: skaters[teamIndex].length });
        }
      } else for (const teamIndex of [ppIndex, pkIndex]) {
        if (states[teamIndex] === "pp" || states[teamIndex] === "pk") add(formationCoverage.excludedSpecialTeamsSecondsByTeam, teamIds[teamIndex], seconds);
      }
    } else teams.forEach((_players, teamIndex) => {
      if (states[teamIndex] === "pk") add(formationCoverage.excludedSpecialTeamsSecondsByTeam, teamIds[teamIndex], seconds);
    });
  }

  const observedEs = buildEvenStrengthTeamUnitToiRows({
    // Internal placeholders satisfy the reusable pure builder's season/snapshot shape;
    // these rows are never persisted and do not assert cache provenance.
    season: 0, snapshotDate: "", players: args.rows.map(row => ({ id: row.player_id, position: row.player_type === "F" ? "F" : row.player_type })),
    shifts: tagged.filter(segment => segment.strength === "es").map(segment => ({
      game_id: args.gameId, season_id: 0, game_date: null, team_id: segment.teamId, team_abbrev: null,
      player_id: segment.playerId, period: segment.period, start_seconds: segment.localStart,
      end_seconds: segment.localEnd, duration_seconds: segment.localEnd - segment.localStart,
    })),
  });
  const actualUnitSeconds = new Map<string, number>();
  for (const row of observedEs) {
    const count = row.unit_type === "forward_line" ? 3 : row.unit_type === "defense_pair" ? 2 : 0;
    const seconds = row.unit_toi_seconds / count;
    if (!count || row.player_count !== count || row.player_ids.length !== count || new Set(row.player_ids).size !== count ||
      !teamIds.includes(row.team_id) || !Number.isSafeInteger(seconds) || seconds <= 0) invalid("observed ES unit conversion");
    const key = `${row.team_id}:${row.unit_type}`;
    actualUnitSeconds.set(key, (actualUnitSeconds.get(key) ?? 0) + seconds);
    recordUnit(units, { teamId: row.team_id, gameIds: [args.gameId], strength: "fiveOnFive", kind: row.unit_type as "forward_line" | "defense_pair",
      playerIds: [...row.player_ids].sort((a, b) => a - b), seconds, skaterCount: 5 });
  }
  for (const teamId of teamIds) for (const kind of ["forward_line", "defense_pair"]) {
    if ((actualUnitSeconds.get(`${teamId}:${kind}`) ?? 0) !== expectedUnitSeconds[teamId]) invalid("observed ES duration consistency");
  }
  return {
    totalsByStrength,
    pairsByStrength: Object.fromEntries(strengths.map(strength => [strength, [...pairMaps[strength].values()]
      .sort((a, b) => a.firstPlayerId - b.firstPlayerId || a.secondPlayerId - b.secondPlayerId)])) as DeploymentAnalysis["pairsByStrength"],
    units: [...units.values()].sort((a, b) => a.teamId - b.teamId || a.kind.localeCompare(b.kind) || b.seconds - a.seconds || compareIds(a.playerIds, b.playerIds)),
    formationCoverage,
  };
}

/** Aggregate observed clock durations before choosing disjoint primary units. */
export function selectMainDeploymentUnits(input: readonly ObservedDeploymentUnit[]): {
  main: ObservedDeploymentUnit[];
  alternatives: ObservedDeploymentUnit[];
} {
  const aggregated = new Map<string, ObservedDeploymentUnit>();
  for (const unit of input) {
    if (!id(unit.teamId) || !Number.isSafeInteger(unit.seconds) || unit.seconds <= 0 || !Array.isArray(unit.playerIds) ||
      !Array.isArray(unit.gameIds) || unit.gameIds.length === 0 || !unit.gameIds.every(id) ||
      !unit.playerIds.every(id) || new Set(unit.playerIds).size !== unit.playerIds.length ||
      !["forward_line", "defense_pair", "power_play", "penalty_kill"].includes(unit.kind)) invalid("unit selection input");
    const expectedCount = unit.kind === "forward_line" ? 3 : unit.kind === "defense_pair" ? 2 : unit.skaterCount;
    if (unit.playerIds.length !== expectedCount ||
      ((unit.kind === "forward_line" || unit.kind === "defense_pair") && (unit.strength !== "fiveOnFive" || unit.skaterCount !== 5)) ||
      (unit.kind === "power_play" && (unit.strength !== "pp" || ![4, 5].includes(unit.skaterCount))) ||
      (unit.kind === "penalty_kill" && (unit.strength !== "pk" || ![3, 4].includes(unit.skaterCount)))) invalid("unit selection shape");
    recordUnit(aggregated, { ...unit, playerIds: [...unit.playerIds].sort((a, b) => a - b) });
  }
  const result: ReturnType<typeof selectMainDeploymentUnits> = { main: [], alternatives: [] };
  const usedByFormation = new Map<string, Set<number>>();
  const counts = new Map<string, number>();
  const ranked = [...aggregated.values()].sort((a, b) => b.seconds - a.seconds || compareIds(a.playerIds, b.playerIds) || a.kind.localeCompare(b.kind));
  for (const unit of ranked) {
    const formation = [unit.teamId, unit.strength, unit.skaterCount].join(":");
    const kind = `${formation}:${unit.kind}`;
    const used = usedByFormation.get(formation) ?? new Set<number>();
    const selected = counts.get(kind) ?? 0;
    const limit = unit.kind === "forward_line" ? 4 : unit.kind === "defense_pair" ? 3 : 2;
    if (selected < limit && unit.playerIds.every(playerId => !used.has(playerId))) {
      result.main.push(unit);
      unit.playerIds.forEach(playerId => used.add(playerId));
      usedByFormation.set(formation, used);
      counts.set(kind, selected + 1);
    } else result.alternatives.push(unit);
  }
  return result;
}
