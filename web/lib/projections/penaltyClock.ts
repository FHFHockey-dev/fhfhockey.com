import { parseSituationDigits, strengthForTeam } from "./derived/situation";
import { parseStrictShiftClock } from "./shiftChartCompleteness";

export type PenaltyClockSpan = { teamId: number; start: number; end: number };
type Teams = { homeTeamId: number; awayTeamId: number; gameType?: number };
type Segment = { seconds: number; releasable: boolean; kind: "minor" | "major"; penaltyId: number; assessedAt: number; order: number; coincident?: boolean };
type Service = { server: string; segments: Segment[]; remaining: number };
type Box = { serving: Service[]; waiting: Service[]; held: Service[] };
type State = { boxes: Record<number, Box>; spans: PenaltyClockSpan[] };
type Unit = Segment & { server: string };

// Continuous playing time: regulation and playoff periods are 20 minutes;
// the sole regular-season OT begins at 3600. Shootouts never enter this clock.
export function penaltyGameSecond(play: any): number {
  const period = play?.periodDescriptor?.number;
  const seconds = parseStrictShiftClock(play?.timeInPeriod);
  if (!Number.isSafeInteger(period) || period < 1 || seconds == null || seconds > 1200) {
    throw new Error("Invalid penalty-clock event time");
  }
  return (period - 1) * 1200 + seconds;
}

/** Qualification requires a final, contiguous physical-game clock, not merely
 * a few mutually consistent sampled events. Pure rule fixtures may omit it. */
export function hasCompletePenaltyClockSource(plays: readonly any[], gameType: number): boolean {
  if (![1, 2, 3].includes(gameType)) return false;
  const terminal = plays.filter(p => p?.typeDescKey === "game-end");
  if (terminal.length !== 1) return false;
  const shootout = terminal[0].periodDescriptor?.periodType === "SO";
  if (shootout && (gameType === 3 || terminal[0].periodDescriptor.number !== 5)) return false;
  const physical = plays.filter(p => p?.periodDescriptor?.periodType !== "SO");
  const last = shootout ? 4 : terminal[0].periodDescriptor?.number;
  if (!Number.isSafeInteger(last) || last < 3 || (gameType !== 3 && last > 4)) return false;
  const eventIds = new Set<number>();
  for (const play of plays) {
    if (!Number.isSafeInteger(play.eventId) || play.eventId <= 0 || eventIds.has(play.eventId)) return false;
    eventIds.add(play.eventId);
  }
  if (physical.some(p => !Number.isSafeInteger(p.periodDescriptor?.number) || p.periodDescriptor.number < 1 || p.periodDescriptor.number > last)) return false;
  for (let period = 1; period <= last; period++) {
    const rows = physical.filter(p => p.periodDescriptor.number === period);
    const nominal = period <= 3 || gameType === 3 ? 1200 : 300;
    const starts = rows.filter(p => p.typeDescKey === "period-start");
    const ends = rows.filter(p => p.typeDescKey === "period-end" || p.typeDescKey === "game-end");
    if (starts.length !== 1 || parseStrictShiftClock(starts[0].timeInPeriod) !== 0 || !ends.length) return false;
    const playedEnd = parseStrictShiftClock(ends[0].timeInPeriod);
    if (playedEnd == null || playedEnd <= 0 || playedEnd > nominal ||
      ((period <= 3 || period < last || shootout) && playedEnd !== nominal) ||
      ends.some(p => parseStrictShiftClock(p.timeInPeriod) !== playedEnd)) return false;
    for (const play of rows) {
      const elapsed = parseStrictShiftClock(play.timeInPeriod);
      const remaining = parseStrictShiftClock(play.timeRemaining);
      if (play.periodDescriptor.periodType !== (period <= 3 ? "REG" : "OT") ||
        elapsed == null || remaining == null || elapsed + remaining !== nominal || elapsed > playedEnd ||
        typeof play.situationCode !== "string" || !parseSituationDigits(play.situationCode)) return false;
    }
  }
  return true;
}

function unitsForPenalty(play: any, teams: Teams): Unit[] {
  const d = play.details;
  if (!d || ![teams.homeTeamId, teams.awayTeamId].includes(d.eventOwnerTeamId)) {
    throw new Error("Invalid penalty-clock penalty team");
  }
  if (!Number.isFinite(d.duration) || d.duration < 0) {
    throw new Error("Invalid penalty-clock penalty duration");
  }
  if (["MIS", "GAM", "GMIS", "PS"].includes(d.typeCode)) return [];
  const minor = ["MIN", "BEN", "BENCH"].includes(d.typeCode);
  const major = ["MAJ", "MAT", "MATCH"].includes(d.typeCode);
  if ((!minor || ![2, 4].includes(d.duration)) && (!major || d.duration !== 5)) {
    throw new Error(`Unsupported penalty-clock penalty ${String(d.typeCode)}/${d.duration}`);
  }
  const offender = d.committedByPlayerId ?? d.servedByPlayerId;
  const bench = ["BEN", "BENCH"].includes(d.typeCode) || /bench|too-many/.test(d.descKey ?? "");
  if ((!Number.isSafeInteger(offender) || offender <= 0) && !bench) {
    throw new Error("Missing penalty-clock offender identity");
  }
  const server = Number.isSafeInteger(offender) ? `player:${offender}` : `bench:${play.eventId}`;
  if (!Number.isSafeInteger(play.eventId) || play.eventId <= 0) throw new Error("Missing penalty identity");
  return Array.from({ length: minor && d.duration === 4 ? 2 : 1 }, () => ({
    server, seconds: minor ? 120 : 300, releasable: minor, kind: minor ? "minor" : "major", penaltyId: play.eventId,
    assessedAt: penaltyGameSecond(play), order: play.sortOrder ?? play.eventId,
  }));
}

function groupServices(units: Unit[]): Service[] {
  const grouped = new Map<string, Segment[]>();
  for (const { server, ...segment } of units) {
    grouped.set(server, [...(grouped.get(server) ?? []), segment]);
  }
  // Rule26: delayed penalties start in assessment order, not player-ID order.
  return [...grouped].map(([server, segments]) => {
    // Rule20.1: simultaneous major before minor. Coincident majors have
    // already been removed, so their accompanying minor starts immediately.
    segments.sort((a, b) => Number(a.kind === "minor") - Number(b.kind === "minor"));
    return { server, segments, remaining: segments[0].seconds };
  });
}

function remainingChoices(units: Unit[], removeMinor: number, removeMajor: number): Unit[][] {
  const choices: Unit[][] = [];
  const visit = (index: number, minors: number, majors: number, kept: Unit[]) => {
    if (choices.length > 256) throw new Error("Ambiguous penalty service exceeds supported choice bound");
    if (index === units.length) {
      if (minors === 0 && majors === 0) choices.push(kept);
      return;
    }
    const u = units[index];
    if (u.kind === "minor" && minors > 0) visit(index + 1, minors - 1, majors, kept);
    if (u.kind === "major" && majors > 0) visit(index + 1, minors, majors - 1, kept);
    visit(index + 1, minors, majors, [...kept, u]);
  };
  visit(0, removeMinor, removeMajor, []);
  // Equivalent halves / duplicate offenders need only one candidate history.
  return [...new Map(choices.map(units => [JSON.stringify(groupServices(units)), units])).values()];
}

function assessmentChoices(events: any[], ids: number[], teams: Teams, state: State, second: number, regularOt: boolean): Service[][][] {
  const units = ids.map(id => events.filter(e => e.details.eventOwnerTeamId === id).flatMap(e => unitsForPenalty(e, teams)));
  // Rules19.1/26: one coincidental minor per side at full strength is served
  // without substitution. Keep both clock slots, protected from goal release.
  const empty = ids.every(id => state.boxes[id].serving.length === 0 && state.boxes[id].waiting.length === 0);
  if (empty && !regularOt && units.every(u => u.length === 1 && u[0].kind === "minor")) {
    return [units.map(u => groupServices(u.map(x => ({ ...x, releasable: false, coincident: true }))))];
  }
  // Rule19.4: last five minutes or OT, one major vs one minor/double minor
  // offender: only the differential is served, with major goal-release rules.
  if (second >= 3300) {
    // Table13 example22: offset the separate minors, then apply the 5-v-4
    // differential. Offsetting half the double minor instead is not the
    // table's prescribed service arrangement.
    for (let side = 0; side < 2; side++) {
      const own = groupServices(units[side]);
      const other = groupServices(units[1 - side]);
      const major = own.find(s => s.segments.length === 1 && s.segments[0].kind === "major");
      if (own.length === 2 && other.length === 2 && major &&
        own.some(s => s.segments.length === 1 && s.segments[0].kind === "minor") &&
        other.some(s => s.segments.length === 1 && s.segments[0].kind === "minor") &&
        other.some(s => s.segments.length === 2 && s.segments.every(p => p.kind === "minor" && p.penaltyId === s.segments[0].penaltyId))) {
        const result: Service[][] = [[], []];
        result[side] = groupServices([{ ...major.segments[0], server: major.server, seconds: 60 }]);
        return [result];
      }
    }
  }
  const count = (side: number, kind: Unit["kind"]) => units[side].filter(u => u.kind === kind).length;
  const removeMinor = Math.min(count(0, "minor"), count(1, "minor"));
  const removeMajor = Math.min(count(0, "major"), count(1, "major"));
  const choices = units.map(u => remainingChoices(u, removeMinor, removeMajor));
  return choices[0].flatMap(a => choices[1].map(b => {
    const residual = [a, b];
    if (second < 3300) return residual.map(groupServices);
    const majorSide = residual.findIndex(u => u.length === 1 && u[0].kind === "major");
    if (majorSide !== -1) {
      const other = 1 - majorSide;
      const minors = residual[other];
      if (minors.length >= 1 && minors.length <= 2 && minors.every(u => u.kind === "minor" && u.server === minors[0].server && u.penaltyId === minors[0].penaltyId)) {
        const result: Service[][] = [[], []];
        result[majorSide] = groupServices([{ ...residual[majorSide][0], seconds: 300 - minors.length * 120 }]);
        return result;
      }
    }
    return residual.map(groupServices);
  }));
}

function remainingPenalty(service: Service): number {
  let seconds = service.remaining;
  for (const segment of service.segments.slice(1)) {
    if (segment.penaltyId !== service.segments[0].penaltyId) break;
    seconds += segment.seconds;
  }
  return seconds;
}

function releaseForGoal(state: State, goal: any, ids: number[]): State[] {
  if (isPenaltyShot(goal)) return [state];
  const scorer = goal.details?.eventOwnerTeamId;
  if (!ids.includes(scorer)) throw new Error("Invalid penalty-clock goal team");
  if (advantagedTeam(state, ids) !== scorer) return [state];
  const opponent = ids.find(id => id !== scorer)!;
  const eligible = state.boxes[opponent].serving.filter(s => s.segments[0].releasable);
  const leastRemaining = Math.min(...eligible.map(remainingPenalty));
  const choices = eligible.filter(s => remainingPenalty(s) === leastRemaining);
  if (!choices.length) return [state];
  // Table12C5 compares the complete double minor's clock. Rule16.2/Table12C9
  // gives the Captain a choice on ties: keep both histories until evidenced.
  return choices.map(service => {
    const candidate = choices.length === 1 ? state : structuredClone(state);
    const box = candidate.boxes[opponent];
    finishSegment(box, box.serving.find(s => s.server === service.server)!);
    startWaiting(box);
    return candidate;
  });
}

function startWaiting(box: Box) {
  box.waiting.sort((a, b) => a.segments[0].assessedAt - b.segments[0].assessedAt || a.segments[0].order - b.segments[0].order);
  while (box.serving.length < 2 && box.waiting.length) box.serving.push(box.waiting.shift()!);
}

function finishSegment(box: Box, service: Service) {
  service.segments.shift();
  if (service.segments.length) service.remaining = service.segments[0].seconds;
  else box.serving.splice(box.serving.indexOf(service), 1);
}

function addServices(box: Box, services: Service[]) {
  for (const service of services) {
    const existing = [...box.serving, ...box.waiting, ...box.held].find(s => s.server === service.server);
    // Preserve offender identity across stoppages (e.g. Rule39.2vi).
    if (existing) existing.segments.push(...service.segments);
    else box.waiting.push(service);
  }
  startWaiting(box);
}

function advantagedTeam(state: State, ids: number[]): number | null {
  const [a, b] = ids.map(id => state.boxes[id].serving.length);
  return a === b ? null : ids[a < b ? 0 : 1];
}

function isPenaltyShot(play: any): boolean {
  const digits = parseSituationDigits(play?.situationCode);
  return !!digits && ((digits.awaySkaters === 1 && digits.homeSkaters === 0) ||
    (digits.awaySkaters === 0 && digits.homeSkaters === 1));
}

function observedAdvantage(play: any, teams: Teams): number | null | undefined {
  const digits = parseSituationDigits(play?.situationCode);
  if (!digits || digits.homeSkaters < 3 || digits.awaySkaters < 3) return undefined;
  const strength = strengthForTeam(digits, teams.homeTeamId, teams.homeTeamId, teams.awayTeamId);
  return strength === "pp" ? teams.homeTeamId : strength === "pk" ? teams.awayTeamId : null;
}

/**
 * NHL penalty-context exposure, in half-open playing-clock seconds. Rules16–20,
 * 24,26,39 and84 (2026–27). Captain-selected coincident service can be ambiguous:
 * retain legal alternatives, constrain them with interior event observations,
 * and refuse a result if distinct exposure histories remain. Never use the
 * next sampled situation as the timestamp of a penalty's expiry.
 */
export function buildPenaltyClock(plays: readonly any[], teams: Teams): { spans: PenaltyClockSpan[] } {
  const ids = [teams.homeTeamId, teams.awayTeamId];
  if (ids.some(id => !Number.isSafeInteger(id) || id <= 0) || ids[0] === ids[1]) {
    throw new Error("Invalid penalty-clock teams");
  }
  const events = plays.filter(p => p?.periodDescriptor?.periodType !== "SO")
    .map(p => ({ play: p, second: penaltyGameSecond(p) }))
    .sort((a, b) => a.second - b.second || (a.play.sortOrder ?? a.play.eventId ?? 0) - (b.play.sortOrder ?? b.play.eventId ?? 0));
  if (!events.length) return { spans: [] };
  const end = events[events.length - 1].second;
  if (end > 24 * 1200) throw new Error("Invalid penalty-clock game length");
  const bySecond = new Map<number, any[]>();
  const regularOvertime = teams.gameType === 1 || teams.gameType === 2 ||
    (teams.gameType == null && events.some(({ play }) => play.periodDescriptor.number === 4 &&
      parseStrictShiftClock(play.timeRemaining) != null &&
      parseStrictShiftClock(play.timeRemaining)! + parseStrictShiftClock(play.timeInPeriod)! === 300));
  for (const { play, second } of events) {
    if (play.situationCode != null &&
      (typeof play.situationCode !== "string" || !parseSituationDigits(play.situationCode))) {
      throw new Error("Invalid penalty-clock situation code");
    }
    if (play.typeDescKey === "penalty") unitsForPenalty(play, teams);
    bySecond.set(second, [...(bySecond.get(second) ?? []), play]);
  }
  let states: State[] = [{ boxes: Object.fromEntries(ids.map(id => [id, { serving: [], waiting: [], held: [] }])), spans: [] }];
  for (let second = 0; second < end; second++) {
    const at = bySecond.get(second) ?? [];
    const penalties = at.filter(p => p.typeDescKey === "penalty");
    const goals = at.filter(p => p.typeDescKey === "goal");
    const nextStates: State[] = [];
    for (const state of states) {
      let expiry = false;
      for (const id of ids) {
        const box = state.boxes[id];
        // Rule84.3/Table15: regulation's coincident 4v4 timers come off the
        // manpower clock at regular OT. Continue their personal service off
        // clock so a later serial penalty cannot start early or use a slot.
        if (regularOvertime && second === 3600) {
          for (const service of [...box.serving]) if (service.segments[0].coincident) {
            box.serving.splice(box.serving.indexOf(service), 1);
            box.held.push(service);
          }
        }
        for (const service of [...box.held]) if (service.remaining === 0) {
          expiry = true;
          box.held.splice(box.held.indexOf(service), 1);
          service.segments.shift();
          if (service.segments.length) {
            service.remaining = service.segments[0].seconds;
            box.waiting.push(service);
          }
        }
        for (const service of [...box.serving]) if (service.remaining === 0) {
          expiry = true;
          finishSegment(box, service);
        }
        startWaiting(box);
      }
      // Observation at a live expiry/assessment/goal clock can be pre- or
      // post-transition. Only interior observations constrain alternatives.
      if (!expiry && penalties.length === 0 && goals.length === 0) {
        const actual = advantagedTeam(state, ids);
        if (at.some(p => !["period-start", "period-end", "game-end", "stoppage"].includes(p.typeDescKey) &&
          observedAdvantage(p, teams) !== undefined && observedAdvantage(p, teams) !== actual)) continue;
      }
      let afterGoals = [state];
      for (const goal of goals) afterGoals = afterGoals.flatMap(s => releaseForGoal(s, goal, ids));
      for (const afterGoal of afterGoals) {
        const choices = penalties.length
          ? assessmentChoices(penalties, ids, teams, afterGoal, second, regularOvertime && second >= 3600)
          : [[[], []]];
        for (const services of choices) {
          const candidate: State = choices.length === 1 ? afterGoal : structuredClone(afterGoal);
          for (let i = 0; i < 2; i++) addServices(candidate.boxes[ids[i]], structuredClone(services[i]));
          const teamId = advantagedTeam(candidate, ids);
          if (teamId != null) {
            const last = candidate.spans[candidate.spans.length - 1];
            if (last?.teamId === teamId && last.end === second) last.end++;
            else candidate.spans.push({ teamId, start: second, end: second + 1 });
          }
          for (const id of ids) for (const s of [...candidate.boxes[id].serving, ...candidate.boxes[id].held]) s.remaining--;
          nextStates.push(candidate);
        }
      }
    }
    states = nextStates.length <= 1 ? nextStates : [...new Map(nextStates.map(s => [JSON.stringify(s), s])).values()];
    if (!states.length) throw new Error(`Penalty-clock disagrees with PBP manpower at game second ${second}`);
    if (states.length > 256) throw new Error("Ambiguous penalty service exceeds supported choice bound");
  }
  const histories = new Map(states.map(s => [JSON.stringify(s.spans), s.spans]));
  if (histories.size !== 1) throw new Error("Ambiguous penalty service: PBP does not determine a unique exposure clock");
  return { spans: histories.values().next().value! };
}
