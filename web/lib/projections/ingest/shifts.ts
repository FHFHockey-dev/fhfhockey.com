import supabase from "lib/supabase/server";

import { nhleFetchJson } from "./nhleFetch";
import { formatSecondsToClock, parseClockToSeconds } from "./time";
import { fetchPbpGame } from "./pbp";

type ShiftRow = {
  gameId: number;
  playerId: number;
  teamId: number;
  teamAbbrev: string;
  firstName: string;
  lastName: string;
  period: number;
  startTime: string;
  endTime: string;
  duration: string;
  typeCode: number;
};

type ShiftchartsResponse = {
  total: number;
  data: ShiftRow[];
};

type Strength = "es" | "pp" | "pk";

type SituationDigits = {
  awaySkaters: number;
  homeSkaters: number;
  awayGoalie: number;
  homeGoalie: number;
};

function assertSupabase() {
  if (!supabase) throw new Error("Supabase server client not available");
}

function parseSituationDigits(situationCode: string | null | undefined): SituationDigits | null {
  if (!situationCode) return null;
  const s = situationCode.trim();
  if (s.length !== 4) return null;
  const awaySkaters = Number(s[0]);
  const homeSkaters = Number(s[1]);
  const awayGoalie = Number(s[2]);
  const homeGoalie = Number(s[3]);
  if (
    !Number.isFinite(awaySkaters) ||
    !Number.isFinite(homeSkaters) ||
    !Number.isFinite(awayGoalie) ||
    !Number.isFinite(homeGoalie)
  ) {
    return null;
  }
  return { awaySkaters, homeSkaters, awayGoalie, homeGoalie };
}

function strengthForTeam(
  digits: SituationDigits,
  teamId: number,
  homeTeamId: number,
  awayTeamId: number
): Strength {
  const isHome = teamId === homeTeamId;
  const mySkaters = isHome ? digits.homeSkaters : digits.awaySkaters;
  const oppSkaters = isHome ? digits.awaySkaters : digits.homeSkaters;
  if (mySkaters > oppSkaters) return "pp";
  if (mySkaters < oppSkaters) return "pk";
  return "es";
}

type Segment = {
  start: number;
  end: number;
  digits: SituationDigits | null;
};

function buildSituationSegmentsForPeriod(plays: any[], period: number): Segment[] {
  const periodPlays = plays
    .filter((p) => p?.periodDescriptor?.number === period)
    .map((p) => ({
      t: parseClockToSeconds(p?.timeInPeriod ?? "0:00"),
      digits: parseSituationDigits(p?.situationCode ?? null)
    }))
    .sort((a, b) => a.t - b.t);

  if (periodPlays.length === 0) return [{ start: 0, end: 20 * 60, digits: null }];

  const segments: Segment[] = [];
  for (let i = 0; i < periodPlays.length; i++) {
    const start = periodPlays[i].t;
    const end = i + 1 < periodPlays.length ? periodPlays[i + 1].t : 20 * 60;
    if (end <= start) continue;
    segments.push({ start, end, digits: periodPlays[i].digits });
  }

  if (segments.length === 0) return [{ start: 0, end: 20 * 60, digits: null }];
  return segments;
}

function overlapSeconds(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  const start = Math.max(aStart, bStart);
  const end = Math.min(aEnd, bEnd);
  return Math.max(0, end - start);
}

async function fetchAllShiftCharts(gameId: number): Promise<ShiftRow[]> {
  const pageSize = 1000;
  let start = 0;
  let rows: ShiftRow[] = [];
  let total = Infinity;

  while (start < total) {
    const url = `https://api.nhle.com/stats/rest/en/shiftcharts?cayenneExp=gameId=${gameId}&start=${start}&limit=${pageSize}`;
    const resp = await nhleFetchJson<ShiftchartsResponse>(url);
    total = resp.total ?? 0;
    rows = rows.concat(resp.data ?? []);
    start += pageSize;
    if (!resp.data || resp.data.length === 0) break;
  }

  return rows;
}

export async function upsertShiftTotalsForGame(gameId: number): Promise<{
  rowsUpserted: number;
}> {
  assertSupabase();

  const pbp = await fetchPbpGame(gameId);
  const shiftRows = await fetchAllShiftCharts(gameId);

  const homeTeamId = pbp.homeTeam.id;
  const awayTeamId = pbp.awayTeam.id;
  const gameDate = pbp.gameDate;
  const seasonId = Number(pbp.season);

  const segmentsByPeriod = new Map<number, Segment[]>();
  for (const shift of shiftRows) {
    if (!segmentsByPeriod.has(shift.period)) {
      segmentsByPeriod.set(shift.period, buildSituationSegmentsForPeriod(pbp.plays, shift.period));
    }
  }

  type Totals = {
    game_id: number;
    player_id: number;
    team_id: number;
    opponent_team_id: number;
    team_abbreviation: string;
    opponent_team_abbreviation: string;
    game_date: string;
    season_id: number;
    player_first_name: string;
    player_last_name: string;
    total_es_toi: string;
    total_pp_toi: string;
    home_or_away: "home" | "away";
    updated_at: string;
  };

  const totalsByPlayer = new Map<number, { es: number; pp: number; pk: number; meta: Omit<Totals, "total_es_toi" | "total_pp_toi"> }>();

  for (const shift of shiftRows) {
    const playerId = shift.playerId;
    const teamId = shift.teamId;

    const segments = segmentsByPeriod.get(shift.period) ?? [{ start: 0, end: 20 * 60, digits: null }];

    const shiftStart = parseClockToSeconds(shift.startTime);
    const shiftEnd = parseClockToSeconds(shift.endTime);
    const duration = parseClockToSeconds(shift.duration);

    const normalizedEnd = shiftEnd > shiftStart ? shiftEnd : shiftStart + duration;

    let es = 0;
    let pp = 0;
    let pk = 0;
    for (const seg of segments) {
      const olap = overlapSeconds(shiftStart, normalizedEnd, seg.start, seg.end);
      if (olap === 0) continue;
      const digits = seg.digits;
      if (!digits) {
        es += olap;
        continue;
      }
      const strength = strengthForTeam(digits, teamId, homeTeamId, awayTeamId);
      if (strength === "pp") pp += olap;
      else if (strength === "pk") pk += olap;
      else es += olap;
    }

    const existing = totalsByPlayer.get(playerId);
    const homeOrAway: "home" | "away" = teamId === homeTeamId ? "home" : "away";
    const opponentTeamId = homeOrAway === "home" ? awayTeamId : homeTeamId;
    const opponentTeamAbbrev = homeOrAway === "home" ? pbp.awayTeam.abbrev : pbp.homeTeam.abbrev;

    const meta = {
      game_id: gameId,
      player_id: playerId,
      team_id: teamId,
      opponent_team_id: opponentTeamId,
      team_abbreviation: shift.teamAbbrev,
      opponent_team_abbreviation: opponentTeamAbbrev,
      game_date: gameDate,
      season_id: seasonId,
      player_first_name: shift.firstName,
      player_last_name: shift.lastName,
      home_or_away: homeOrAway,
      updated_at: new Date().toISOString()
    } satisfies Omit<Totals, "total_es_toi" | "total_pp_toi">;

    if (!existing) {
      totalsByPlayer.set(playerId, { es, pp, pk, meta });
    } else {
      existing.es += es;
      existing.pp += pp;
      existing.pk += pk;
    }
  }

  const upserts: Totals[] = [];
  for (const { es, pp, meta } of totalsByPlayer.values()) {
    upserts.push({
      ...meta,
      total_es_toi: formatSecondsToClock(es),
      total_pp_toi: formatSecondsToClock(pp)
    });
  }

  if (upserts.length === 0) return { rowsUpserted: 0 };

  const { error } = await supabase.from("shift_charts").upsert(upserts, {
    onConflict: "game_id,player_id"
  });
  if (error) throw error;

  return { rowsUpserted: upserts.length };
}

