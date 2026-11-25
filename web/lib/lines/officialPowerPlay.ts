import { HTMLElement, parse } from "node-html-parser";
import { get } from "lib/NHL/base";
import { createSharedReadCache } from "lib/NHL/client/sharedRead";
import type { LineGame, OfficialPowerPlayObservation } from "./types";

type Spot = {
  teamId: number;
  sweaterNumber: number;
  playerId: number;
  positionCode: string;
  firstName: { default: string };
  lastName: { default: string };
};
type Play = {
  eventId: number;
  periodDescriptor: { number: number };
  timeInPeriod: string;
  typeDescKey: string;
  situationCode: string;
  sortOrder: number;
  details?: { descKey?: string; committedByPlayerId?: number; drawnByPlayerId?: number; eventOwnerTeamId?: number };
};
export type PlayByPlay = {
  id: number;
  gameDate: string;
  homeTeam: { id: number };
  awayTeam: { id: number };
  plays: Play[];
  rosterSpots: Spot[];
};
const eventTypes: Record<string, string> = {
  FAC: "faceoff",
  GOAL: "goal",
  SHOT: "shot-on-goal",
  MISS: "missed-shot",
  BLOCK: "blocked-shot",
  GIVE: "giveaway",
  TAKE: "takeaway",
  HIT: "hit",
  PENL: "penalty",
  STOP: "stoppage",
  PEND: "period-end",
};
const normalized = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").trim().toLowerCase();
const eventsCache = createSharedReadCache<OfficialPowerPlayEvidence | null>(60_000, 64);

/** A penalty from the play-by-play. `penalizedTeamId` is the event owner. */
export type OfficialPenalty = {
  eventId: number; order: number; period: number; elapsed: string;
  committedByPlayerId: number | null; drawnByPlayerId: number | null; infraction: string; penalizedTeamId: number;
};
/** Official wall-clock period anchors from the HTML report's PSTR/PEND rows (minute precision). */
export type PeriodAnchor = { period: number; startedAt: string | null; endedAt: string | null; precisionSeconds: 60 };
/** One power-play opportunity, from play-by-play strength: `fromOrder` is the penalty, `toOrder` the first play after the advantage. */
export type OpportunitySpan = {
  penaltyEventId: number; beneficiaryTeamId: number; fromOrder: number; toOrder: number;
  endedBy: "goal" | "expiry" | "penalty" | "period_end" | "unknown";
};
export type OfficialPowerPlayEvidence = {
  observations: OfficialPowerPlayObservation[]; penalties: OfficialPenalty[]; periods: PeriodAnchor[];
  opportunities: OpportunitySpan[]; gameEndedAt: string | null;
  /** Play-by-play event IDs of faceoffs; observations carry no event type. */
  faceoffEventIds: number[];
  /** Both teams' roster spots, for reading a penalty clue's names. */
  roster: { playerId: number; name: string; teamId: number }[];
};

export function officialPenalties(pbp: PlayByPlay): OfficialPenalty[] {
  return pbp.plays.filter((play) => play.typeDescKey === "penalty" && play.details?.descKey && Number.isSafeInteger(play.details.eventOwnerTeamId)
    && Number.isSafeInteger(play.periodDescriptor?.number))
    .map((play) => ({ eventId: play.eventId, order: play.sortOrder, period: play.periodDescriptor.number, elapsed: play.timeInPeriod,
      committedByPlayerId: play.details!.committedByPlayerId ?? null, drawnByPlayerId: play.details!.drawnByPlayerId ?? null,
      infraction: play.details!.descKey!, penalizedTeamId: play.details!.eventOwnerTeamId! }))
    .sort((a, b) => a.order - b.order);
}

const skaters = (code: string, home: boolean) => /^\d{4}$/.test(code) ? Number(code[home ? 2 : 1]) : null;
/**
 * The span of each penalty's advantage. Only the clean case is read: even strength (1551) at the penalty, then a
 * beneficiary advantage before play resumes. Anything else (coincidental minors, an existing PP, a missing code) is `unknown`.
 */
export function opportunitySpans(pbp: PlayByPlay): OpportunitySpan[] {
  const plays = [...pbp.plays].sort((a, b) => a.sortOrder - b.sortOrder);
  return officialPenalties(pbp).map((penalty) => {
    const beneficiaryTeamId = penalty.penalizedTeamId === pbp.homeTeam.id ? pbp.awayTeam.id : pbp.homeTeam.id;
    const home = beneficiaryTeamId === pbp.homeTeam.id;
    const unknown = { penaltyEventId: penalty.eventId, beneficiaryTeamId, fromOrder: penalty.order, toOrder: penalty.order, endedBy: "unknown" as const };
    const at = plays.findIndex((play) => play.eventId === penalty.eventId);
    if (at < 0 || plays[at]!.situationCode !== "1551") return unknown;
    const advantage = (play: Play) => {
      const own = skaters(play.situationCode, home), other = skaters(play.situationCode, !home);
      return own != null && other != null && own > other;
    };
    let started = false;
    for (const play of plays.slice(at + 1)) {
      if (play.periodDescriptor?.number !== penalty.period) return started ? { ...unknown, toOrder: play.sortOrder, endedBy: "period_end" as const } : unknown;
      if (play.typeDescKey === "period-end") return started ? { ...unknown, toOrder: play.sortOrder, endedBy: "period_end" as const } : unknown;
      if (play.typeDescKey === "penalty") return started ? { ...unknown, toOrder: play.sortOrder, endedBy: "penalty" as const } : unknown;
      if (!started) {
        if (advantage(play)) started = true;
        else if (play.typeDescKey !== "stoppage") return unknown;
        continue;
      }
      if (play.typeDescKey === "goal" && play.details?.eventOwnerTeamId === beneficiaryTeamId) {
        const next = plays.find((candidate) => candidate.sortOrder > play.sortOrder);
        return { ...unknown, toOrder: next?.sortOrder ?? play.sortOrder + 1, endedBy: "goal" as const };
      }
      if (!advantage(play)) return { ...unknown, toOrder: play.sortOrder, endedBy: "expiry" as const };
    }
    return unknown;
  });
}

const ZONE_OFFSETS: Record<string, number> = { EST: -5, EDT: -4, CST: -6, CDT: -5, MST: -7, MDT: -6, PST: -8, PDT: -7, AST: -4, ADT: -3 };
/**
 * Period anchors from "Local time: 7:09 MST". The report has no AM/PM: the first anchor takes the half-day nearest the stored
 * actual start, or PM (12 = noon) without one; each later anchor is the first candidate at or after the one before.
 */
export function officialPeriodAnchors(html: string, gameDate: string, actualStart: string | null): { periods: PeriodAnchor[]; gameEndedAt: string | null } {
  const rows: { period: number; kind: string; hour: number; minute: number; zone: string }[] = [];
  for (const row of parse(html).querySelectorAll("tr[id^=PL-]")) {
    const cells = row.childNodes.filter((c): c is HTMLElement => c instanceof HTMLElement && c.tagName === "TD");
    if (cells.length !== 8) continue;
    const kind = cells[4]!.text.trim();
    if (!["PSTR", "PEND", "GEND"].includes(kind)) continue;
    const time = cells[5]!.text.match(/Local time:\s*(\d{1,2}):([0-5]\d)\s*([A-Z]{3})/);
    const period = Number(cells[1]!.text.trim());
    if (!time || !Number.isSafeInteger(period)) continue;
    rows.push({ period, kind, hour: Number(time[1]), minute: Number(time[2]), zone: time[3]! });
  }
  const periods = new Map<number, PeriodAnchor>();
  let previous: number | null = null, gameEndedAt: string | null = null;
  const start = actualStart ? Date.parse(actualStart) : NaN;
  for (const row of rows) {
    const offset = ZONE_OFFSETS[row.zone];
    if (offset == null || row.hour < 1 || row.hour > 12) continue;
    const base = Date.parse(`${gameDate}T00:00:00Z`) - offset * 3_600_000 + row.minute * 60_000;
    const am = base + (row.hour % 12) * 3_600_000, pm = am + 12 * 3_600_000;
    let at: number;
    if (previous == null) at = Number.isFinite(start) ? (Math.abs(am - start) < Math.abs(pm - start) ? am : pm) : pm;
    else { at = am; while (at < previous) at += 12 * 3_600_000; }
    previous = at;
    const iso = new Date(at).toISOString().replace(".000Z", "Z");
    const anchor = periods.get(row.period) ?? { period: row.period, startedAt: null, endedAt: null, precisionSeconds: 60 as const };
    if (row.kind === "PSTR") anchor.startedAt = iso;
    else if (row.kind === "PEND") anchor.endedAt = iso;
    else gameEndedAt = iso;
    periods.set(row.period, anchor);
  }
  return { periods: [...periods.values()].sort((a, b) => a.period - b.period), gameEndedAt };
}

/** Everything the PP binder needs from one game's official reports, or null when the reports do not validate. */
export function officialPowerPlayEvidence(game: LineGame, pbp: PlayByPlay, html: string, sourceUrl: string): OfficialPowerPlayEvidence | null {
  const observations = officialPowerPlayEvents(game, pbp, html, sourceUrl);
  if (!observations) return null;
  const { periods, gameEndedAt } = officialPeriodAnchors(html, game.date, game.actualStart);
  return { observations, penalties: officialPenalties(pbp), periods, gameEndedAt, opportunities: opportunitySpans(pbp),
    faceoffEventIds: pbp.plays.filter((play) => play.typeDescKey === "faceoff").map((play) => play.eventId),
    roster: pbp.rosterSpots.map((spot) => ({ playerId: spot.playerId, name: [spot.firstName?.default, spot.lastName?.default].filter(Boolean).join(" "), teamId: spot.teamId })) };
}

function onIce(cell: HTMLElement, teamId: number, roster: Spot[], skaterCount: number) {
  const players: { playerId: number; name: string }[] = [];
  const seen = new Set<number>();
  let goalies = 0;
  for (const label of cell.querySelectorAll("font[title]")) {
    const number = Number(label.text.trim());
    const spots = roster.filter((spot) => spot.teamId === teamId && spot.sweaterNumber === number);
    const spot = spots[0];
    if (spots.length !== 1 || !spot || !Number.isSafeInteger(spot.playerId) || spot.playerId <= 0 || seen.has(spot.playerId))
      return null;
    const name = [spot.firstName?.default, spot.lastName?.default].filter(Boolean).join(" ");
    const title = label.getAttribute("title")?.match(/^(.+?) - (.+)$/);
    if (
      !["C", "L", "R", "D", "G"].includes(spot.positionCode) ||
      !name ||
      !title ||
      normalized(title[2]!) !== normalized(name) ||
      (title[1] === "Goalie") !== (spot.positionCode === "G")
    )
      return null;
    seen.add(spot.playerId);
    if (spot.positionCode === "G") goalies++;
    else players.push({ playerId: spot.playerId, name });
  }
  return goalies === 1 && players.length === skaterCount ? players : null;
}

/** The HTML report supplies on-ice personnel; Gamecenter supplies team-scoped roster IDs, strength and event order. */
export function officialPowerPlayEvents(
  game: LineGame,
  pbp: PlayByPlay,
  html: string,
  sourceUrl: string,
): OfficialPowerPlayObservation[] | null {
  if (
    pbp?.id !== game.id ||
    pbp.gameDate !== game.date ||
    pbp.homeTeam?.id !== game.homeTeamId ||
    pbp.awayTeam?.id !== game.awayTeamId ||
    !Array.isArray(pbp.plays) ||
    !Array.isArray(pbp.rosterSpots)
  )
    return null;
  const report = parse(html);
  const header = report.querySelectorAll("#GameInfo td").map((cell) => cell.text.trim());
  const date = new Date(game.date + "T12:00:00Z").toLocaleDateString("en-US", { dateStyle: "full", timeZone: "UTC" });
  if (!header.includes("Play By Play") || !header.includes("Game " + String(game.id).slice(-4)) || !header.includes(date))
    return null;
  const byClock = new Map<string, Play | null>();
  for (const play of pbp.plays) {
    const key = [play.periodDescriptor?.number, play.timeInPeriod, play.typeDescKey].join("/");
    byClock.set(key, byClock.has(key) ? null : play);
  }
  const matched = new Map<number, OfficialPowerPlayObservation>();
  const seen = new Set<number>();
  for (const row of report.querySelectorAll("tr[id^=PL-]")) {
    const cells = row.childNodes.filter((c): c is HTMLElement => c instanceof HTMLElement && c.tagName === "TD");
    if (cells.length !== 8) continue;
    const reportEvent = Number(cells[0]!.text.trim());
    if (!Number.isSafeInteger(reportEvent) || reportEvent <= 0 || row.id !== "PL-" + reportEvent) continue;
    const period = Number(cells[1]!.text.trim());
    const elapsed = cells[3]!.firstChild?.text.trim().padStart(5, "0");
    if (!elapsed || !/^\d\d:[0-5]\d$/.test(elapsed)) continue;
    const play = byClock.get([period, elapsed, eventTypes[cells[4]!.text.trim()]].join("/"));
    if (!play || !Number.isSafeInteger(play.eventId) || !/^1(?:5[34]|[34]5)1$/.test(play.situationCode)) continue;
    // Without a unique clock/type pair in both reports, the on-ice cells cannot be attributed to an event.
    if (seen.has(play.eventId)) {
      matched.delete(play.eventId);
      continue;
    }
    seen.add(play.eventId);
    const away = onIce(cells[6]!, game.awayTeamId, pbp.rosterSpots, Number(play.situationCode[1]));
    const home = onIce(cells[7]!, game.homeTeamId, pbp.rosterSpots, Number(play.situationCode[2]));
    if (!away || !home) continue;
    const awayPowerPlay = away.length === 5;
    matched.set(play.eventId, {
      gameId: game.id,
      teamId: awayPowerPlay ? game.awayTeamId : game.homeTeamId,
      eventId: play.eventId,
      reportEvent,
      order: play.sortOrder,
      period,
      elapsed,
      players: awayPowerPlay ? away : home,
      sourceUrl: sourceUrl + "#PL-" + reportEvent,
    });
  }
  return [...matched.values()].sort((a, b) => b.order - a.order);
}

export async function readOfficialPowerPlay(game: LineGame) {
  return (await readOfficialPowerPlayEvidence(game))?.observations ?? null;
}

export function readOfficialPowerPlayEvidence(game: LineGame) {
  const id = String(game.id);
  const season = id.slice(0, 4);
  const sourceUrl = `https://www.nhl.com/scores/htmlreports/${season}${Number(season) + 1}/PL${id.slice(4)}.HTM`;
  return eventsCache.read(game.scheduleIdentity + ":" + game.phase, async () => {
    try {
      const signal = AbortSignal.timeout(5000);
      const [pbp, html] = await Promise.all([
        get<PlayByPlay>(`/gamecenter/${game.id}/play-by-play`, false, signal),
        fetch(sourceUrl, { signal }).then((response) => {
          if (!response.ok) throw new Error("NHL on-ice report unavailable");
          return response.text();
        }),
      ]);
      return officialPowerPlayEvidence(game, pbp, html, sourceUrl);
    } catch {
      return null;
    }
  });
}
