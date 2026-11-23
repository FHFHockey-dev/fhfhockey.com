// web/lib/sustainability/entityProducerReport.ts
//
// Coverage and calibration report for a producer run (dry-run evidence).

import {
  SANDBOX_ENTITY_CONFIG,
  extractReasonHighlights
} from "lib/sustainability/entitySurface";
import {
  ENTITY_SUSTAINABILITY_WINDOWS,
  type BandRow,
  type ProducerResult,
  type ScoreRow,
  type SkipRecord
} from "./entityProducer";

const STATES = ["overperforming", "stable", "underperforming"] as const;

function sd(values: number[]): number | null {
  if (values.length < 2) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / (values.length - 1));
}

function r(value: number | null, digits = 3) {
  return value === null ? null : Number(value.toFixed(digits));
}

/** Row-level checks against the table constraints and the reader contract. */
export function checkRows(result: ProducerResult): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const row of result.scores) {
    const key = `${row.snapshot_date}|${row.entity_type}|${row.entity_id}|${row.metric_scope}|${row.window_code}`;
    if (seen.has(key)) problems.push(`duplicate score key ${key}`);
    seen.add(key);
    if (!(row.s_100 >= 0 && row.s_100 <= 100)) problems.push(`s_100 out of range ${key}`);
    if (!Number.isFinite(row.s_raw)) problems.push(`s_raw not finite ${key}`);
    if (!STATES.includes(row.expectation_state)) problems.push(`bad state ${key}`);
    if (!extractReasonHighlights(row.components).length) problems.push(`no reason highlights ${key}`);
    for (const [k, v] of Object.entries(row.components)) {
      if (typeof v === "number" && !k.startsWith("z_")) {
        problems.push(`non-z top-level component ${k} ${key}`);
      }
    }
  }
  const bandSeen = new Set<string>();
  for (const row of result.bands) {
    const key = `${row.snapshot_date}|${row.entity_type}|${row.entity_id}|${row.metric_key}|${row.window_code}`;
    if (bandSeen.has(key)) problems.push(`duplicate band key ${key}`);
    bandSeen.add(key);
    if (!(row.ci_lower <= row.ci_upper)) problems.push(`ci order ${key}`);
    if (!Number.isFinite(row.value)) problems.push(`value not finite ${key}`);
    const allowed = SANDBOX_ENTITY_CONFIG[row.entity_type].metrics.map((m) => m.key);
    if (!allowed.includes(row.metric_key)) problems.push(`unknown metric ${key}`);
  }
  return problems;
}

function stateCounts(rows: ScoreRow[]) {
  const out: Record<string, Record<string, number>> = {};
  for (const w of ENTITY_SUSTAINABILITY_WINDOWS) {
    const subset = rows.filter((row) => row.window_code === w.code);
    out[w.code] = Object.fromEntries(
      STATES.map((s) => [s, subset.filter((row) => row.expectation_state === s).length])
    );
    out[w.code].total = subset.length;
  }
  return out;
}

function zSpread(bands: BandRow[], scores: ScoreRow[]) {
  const out: Record<string, Record<string, { n: number; sd: number | null; meanAbs: number | null }>> = {};
  const add = (window: string, key: string, values: number[]) => {
    out[window] = out[window] ?? {};
    out[window][key] = {
      n: values.length,
      sd: r(sd(values)),
      meanAbs: values.length ? r(values.reduce((a, b) => a + Math.abs(b), 0) / values.length) : null
    };
  };
  for (const w of ENTITY_SUSTAINABILITY_WINDOWS) {
    const subset = bands.filter((b) => b.window_code === w.code && b.z_score !== null);
    const keys = [...new Set(subset.map((b) => b.metric_key))].sort();
    for (const key of keys) {
      add(w.code, key, subset.filter((b) => b.metric_key === key).map((b) => b.z_score as number));
    }
    add(
      w.code,
      "expectation_gap_z",
      scores.filter((s) => s.window_code === w.code && s.z_score !== null).map((s) => s.z_score as number)
    );
  }
  return out;
}

function quantile(sorted: number[], q: number): number | null {
  if (!sorted.length) return null;
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
}

function scoreSpread(rows: ScoreRow[]) {
  const out: Record<string, Record<string, number | null>> = {};
  for (const w of ENTITY_SUSTAINABILITY_WINDOWS) {
    const subset = rows.filter((row) => row.window_code === w.code);
    const s100 = subset.map((row) => row.s_100).sort((a, b) => a - b);
    out[w.code] = {
      sRawSd: r(sd(subset.map((row) => row.s_raw))),
      s100P10: quantile(s100, 0.1),
      s100P50: quantile(s100, 0.5),
      s100P90: quantile(s100, 0.9),
      below5: subset.filter((row) => row.s_100 < 5).length,
      above95: subset.filter((row) => row.s_100 > 95).length
    };
  }
  return out;
}

function skipSummary(skips: SkipRecord[]) {
  const out: Record<string, number> = {};
  for (const skip of skips) out[skip.reason] = (out[skip.reason] ?? 0) + 1;
  return out;
}

export function buildEntityCoverageReport(args: {
  result: ProducerResult;
  focusDate: string;
  teamIds: number[];
  teamNames: Map<number, string>;
}) {
  const { result, focusDate } = args;
  const forType = (type: "team" | "goalie") => ({
    scores: result.scores.filter((s) => s.entity_type === type),
    bands: result.bands.filter((b) => b.entity_type === type),
    skips: result.skips.filter((s) => s.entity_type === type)
  });
  const team = forType("team");
  const goalie = forType("goalie");

  const focusTeams = args.teamIds.map((teamId) => {
    const rows = team.scores.filter(
      (s) => s.snapshot_date === focusDate && s.entity_id === teamId
    );
    const l5 = rows.find((s) => s.window_code === "l5");
    return {
      teamId,
      team: args.teamNames.get(teamId) ?? String(teamId),
      windows: ENTITY_SUSTAINABILITY_WINDOWS.map((w) => w.code).filter((code) =>
        rows.some((s) => s.window_code === code)
      ),
      bandsL5: team.bands.filter(
        (b) => b.snapshot_date === focusDate && b.entity_id === teamId && b.window_code === "l5"
      ).length,
      l5: l5
        ? {
            s_100: l5.s_100,
            state: l5.expectation_state,
            goal_share_pct: l5.recent_value,
            xg_share_pct: l5.expected_value,
            played_on_snapshot: l5.metadata.played_on_snapshot,
            last_game_date: l5.metadata.last_game_date,
            window_dates: [l5.provenance.window_start_game_date, l5.provenance.window_end_game_date]
          }
        : null,
      skips: team.skips
        .filter((s) => s.snapshot_date === focusDate && s.entity_id === teamId)
        .map((s) => ({ window: s.window_code, reason: s.reason, detail: s.detail }))
    };
  });

  // Every date: how many of the 32 teams have an l5 reading, and why not.
  const dates = [...new Set(result.scores.map((s) => s.snapshot_date).concat(result.skips.map((s) => s.snapshot_date)))].sort();
  const perDate = dates.map((date) => {
    const covered = new Set(
      team.scores.filter((s) => s.snapshot_date === date && s.window_code === "l5").map((s) => s.entity_id)
    );
    const missing = args.teamIds.filter((id) => !covered.has(id));
    return {
      date,
      teamsWithL5: covered.size,
      missing: missing.map((id) => ({
        team: args.teamNames.get(id) ?? String(id),
        reasons: [
          ...new Set(
            team.skips
              .filter((s) => s.snapshot_date === date && s.entity_id === id && (s.window_code === null || s.window_code === "l5"))
              .map((s) => s.reason)
          )
        ]
      }))
    };
  });

  const focusGoalies = new Set(
    goalie.scores.filter((s) => s.snapshot_date === focusDate && s.window_code === "l5").map((s) => s.entity_id)
  );
  const focusGoalieEntities = new Set(
    goalie.scores
      .filter((s) => s.snapshot_date === focusDate)
      .map((s) => s.entity_id)
      .concat(goalie.skips.filter((s) => s.snapshot_date === focusDate).map((s) => s.entity_id))
  );

  return {
    focusDate,
    rowChecks: checkRows(result),
    totals: {
      teamScores: team.scores.length,
      teamBands: team.bands.length,
      goalieScores: goalie.scores.length,
      goalieBands: goalie.bands.length
    },
    team: {
      focusCoverage: `${focusTeams.filter((t) => t.l5).length}/${args.teamIds.length}`,
      focusOffDayTeams: focusTeams.filter((t) => t.l5 && t.l5.played_on_snapshot === false).map((t) => t.team),
      focusTeams,
      datesWithFullCoverage: perDate.filter((d) => d.teamsWithL5 === args.teamIds.length).length,
      datesTotal: perDate.length,
      datesWithGaps: perDate.filter((d) => d.teamsWithL5 < args.teamIds.length),
      stateCounts: stateCounts(team.scores),
      scoreSpread: scoreSpread(team.scores),
      zSpread: zSpread(team.bands, team.scores),
      partialWindowRows: team.scores.filter((s) => s.metadata.partial_window).length,
      seasonToDateWindowRows: team.scores.filter((s) => s.metadata.window_is_season_to_date).length,
      carriedForwardRows: team.scores.filter((s) => s.metadata.carried_forward).length,
      skips: skipSummary(team.skips)
    },
    goalie: {
      focusCoverageL5: `${focusGoalies.size}/${focusGoalieEntities.size}`,
      stateCounts: stateCounts(goalie.scores),
      scoreSpread: scoreSpread(goalie.scores),
      zSpread: zSpread(goalie.bands, goalie.scores),
      partialWindowRows: goalie.scores.filter((s) => s.metadata.partial_window).length,
      carriedForwardRows: goalie.scores.filter((s) => s.metadata.carried_forward).length,
      skips: skipSummary(goalie.skips),
      focusSkips: goalie.skips.filter((s) => s.snapshot_date === focusDate)
    }
  };
}
