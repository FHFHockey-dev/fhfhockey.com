// Decision 144 (F11): compare the reconstructed team PP clock with the official
// NHL team PP TOI already stored in teamGameStats.powerPlayToi.
//
// Runs the production code path, unmodified: buildTeamPpClock() from
// web/utils/getPowerPlayBlocks.ts (penalty-context clock v2 in
// web/lib/projections/penaltyClock.ts, situation-code audit, completeness gate).
// Input is stored evidence only: the classes CSV from 03-run-summary.sql and the
// scalar play-by-play pages from 04-fetch-pbp.sh. No network calls.
//
// Build + run (from the repo root):
//   npx --prefix web esbuild <this file> --bundle --platform=node --format=esm \
//     --tsconfig=web/tsconfig.json --loader:.scss=empty --outfile=$SCRATCH/compare.mjs
//   node $SCRATCH/compare.mjs <classes.csv> <pbp_dir> <out_dir>
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import getPowerPlayBlocks, {
  buildTeamPpClock,
  teamPpClockSeconds,
  PP_CLOCK_QUALIFIED,
  PP_CLOCK_SOURCE,
  PP_CLOCK_UNQUALIFIED_REASON,
} from "../../../../../../web/utils/getPowerPlayBlocks";
import { buildPenaltyClock } from "../../../../../../web/lib/projections/penaltyClock";
import { classifyTeamManpower, parseSituationCode } from "../../../../../../web/lib/supabase/Upserts/nhlStrengthState";

const [classesPath, pbpDir, outDir] = process.argv.slice(2);
if (!classesPath || !pbpDir || !outDir) {
  throw new Error("usage: compare.mjs <classes.csv> <pbp_dir> <out_dir>");
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split("\n").filter((l) => l.length > 0);
  const header = lines[0].split(",");
  return lines.slice(1).map((line) => {
    // psql CSV quotes only fields that need it; none of the selected scalar
    // columns contain commas, but handle quotes defensively.
    const cells: string[] = [];
    let cur = "";
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (quoted) {
        if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (c === '"') quoted = false;
        else cur += c;
      } else if (c === '"') quoted = true;
      else if (c === ",") { cells.push(cur); cur = ""; }
      else cur += c;
    }
    cells.push(cur);
    return Object.fromEntries(header.map((h, i) => [h, cells[i] ?? ""]));
  });
}

const num = (s: string) => (s === "" ? null : Number(s));
const str = (s: string) => (s === "" ? null : s);

type TeamRow = {
  game_id: number; season_id: number; game_type: number; team_id: number; opp_id: number;
  is_home: boolean; toi: string; pp: string; toi_s: number | null; pp_goals: number | null;
  pp_opps: number | null; own_pim: number | null; opp_pim: number | null; class: string;
};

const classes: TeamRow[] = parseCsv(readFileSync(classesPath, "utf8")).map((r) => ({
  game_id: Number(r.game_id), season_id: Number(r.season_id), game_type: Number(r.game_type),
  team_id: Number(r.team_id), opp_id: Number(r.opp_id), is_home: r.is_home === "t",
  toi: r.toi, pp: r.pp, toi_s: num(r.toi_s), pp_goals: num(r.pp_goals), pp_opps: num(r.pp_opps),
  own_pim: num(r.own_pim), opp_pim: num(r.opp_pim), class: r.class,
}));

// Rebuild NHL play objects from the stored scalar columns (the fields the clock reads).
const playsByGame = new Map<number, any[]>();
for (const file of readdirSync(pbpDir).filter((f) => f.endsWith(".csv")).sort()) {
  for (const r of parseCsv(readFileSync(join(pbpDir, file), "utf8"))) {
    const gameId = Number(r.game_id);
    const details: Record<string, unknown> = {};
    if (r.event_owner_team_id !== "") details.eventOwnerTeamId = Number(r.event_owner_team_id);
    if (r.penalty_type_code !== "") details.typeCode = r.penalty_type_code;
    if (r.penalty_desc_key !== "") details.descKey = r.penalty_desc_key;
    if (r.penalty_duration_minutes !== "") details.duration = Number(r.penalty_duration_minutes);
    if (r.committed_by_player_id !== "") details.committedByPlayerId = Number(r.committed_by_player_id);
    if (r.served_by_player_id !== "") details.servedByPlayerId = Number(r.served_by_player_id);
    const play = {
      eventId: Number(r.event_id),
      sortOrder: num(r.sort_order),
      periodDescriptor: { number: num(r.period_number), periodType: str(r.period_type) },
      timeInPeriod: str(r.time_in_period),
      timeRemaining: str(r.time_remaining),
      situationCode: str(r.situation_code),
      typeDescKey: str(r.type_desc_key),
      details,
    };
    const list = playsByGame.get(gameId) ?? [];
    list.push(play);
    playsByGame.set(gameId, list);
  }
}

const secondOf = (p: any) => {
  const [m, s] = String(p.timeInPeriod).split(":").map(Number);
  return (p.periodDescriptor.number - 1) * 1200 + m * 60 + s;
};
const digits = (code: string | null) =>
  code && /^\d{4}$/.test(code)
    ? { awayGoalie: +code[0], awaySkaters: +code[1], homeSkaters: +code[2], homeGoalie: +code[3] }
    : null;

// Game features used to attribute a disagreement to a cause (decision 144
// list), measured against the clock's own PP spans for the game.
const STOPPAGE_TYPES = new Set(["penalty", "goal", "stoppage", "period-start", "period-end", "game-end"]);
function features(plays: any[], spans: { teamId: number; start: number; end: number }[]) {
  const phys = plays.filter((p) => p.periodDescriptor.periodType !== "SO");
  const penalties = phys.filter((p) => p.typeDescKey === "penalty");
  const bySecond = new Map<number, Set<number>>();
  for (const p of penalties) {
    if ((p.details.duration ?? 0) < 2 || p.details.typeCode === "MIS") continue;
    const s = secondOf(p);
    const set = bySecond.get(s) ?? new Set<number>();
    set.add(p.details.eventOwnerTeamId);
    bySecond.set(s, set);
  }
  const inside = (p: any) => {
    const s = secondOf(p);
    return spans.some((sp) => sp.start < s && s < sp.end);
  };
  let fiveOnThree = false;
  let pulledGoalieInPp = false;
  for (const p of phys) {
    if (STOPPAGE_TYPES.has(p.typeDescKey) || !inside(p)) continue;
    const d = digits(p.situationCode);
    if (!d) continue;
    if (Math.abs(d.homeSkaters - d.awaySkaters) >= 2 && d.homeGoalie === 1 && d.awayGoalie === 1) fiveOnThree = true;
    if ((d.homeGoalie === 0 || d.awayGoalie === 0) && d.homeSkaters > 1 && d.awaySkaters > 1) pulledGoalieInPp = true;
  }
  const goalSeconds = new Set(phys.filter((p) => p.typeDescKey === "goal").map(secondOf));
  const typeCodes = new Set(penalties.map((p) => p.details.typeCode));
  return {
    overtimePp: spans.some((sp) => sp.end > 3600),
    shootout: plays.some((p) => p.periodDescriptor.periodType === "SO"),
    coincident: [...bySecond.values()].some((s) => s.size === 2),
    major: typeCodes.has("MAJ") || typeCodes.has("MAT"),
    doubleMinor: penalties.some((p) => p.details.typeCode === "MIN" && p.details.duration === 4),
    fiveOnThree,
    pulledGoalieInPp,
    goalEndsPp: spans.some((sp) => goalSeconds.has(sp.end)),
    expiryAcrossPeriod: spans.some((sp) => Math.floor(sp.start / 1200) !== Math.floor((sp.end - 1) / 1200)),
    ppEndsAtGameEnd: spans.some((sp) => sp.end === Math.max(...phys.map(secondOf))),
  };
}

// Analysis-only variant of auditPpBlocksAgainstSituationCodes that skips the
// same observations the clock itself refuses to use: stoppage-type events and
// any second with a penalty or goal (their codes can be pre- or post-change).
function alignedAuditDisagreements(plays: any[], spans: { teamId: number; start: number; end: number }[], homeTeamId: number, awayTeamId: number) {
  const phys = plays.filter((p) => p.periodDescriptor.periodType !== "SO");
  const busy = new Set(phys.filter((p) => p.typeDescKey === "penalty" || p.typeDescKey === "goal").map(secondOf));
  const boundaries = new Set(spans.flatMap((sp) => [sp.start, sp.end]));
  let n = 0;
  for (const p of phys) {
    if (STOPPAGE_TYPES.has(p.typeDescKey)) continue;
    const s = secondOf(p);
    if (busy.has(s) || boundaries.has(s)) continue;
    const parsed = parseSituationCode(p.situationCode);
    const home = classifyTeamManpower(parsed, "home");
    if (!home || home.manpowerState === null) continue;
    const sim = spans.find((sp) => sp.start < s && s < sp.end)?.teamId ?? null;
    const codes = home.manpowerState === "PP" ? homeTeamId : home.manpowerState === "PK" ? awayTeamId : null;
    if (sim !== codes) n++;
  }
  return n;
}

type Result = TeamRow & {
  pbp: boolean; sim_s: number | null; qualified: boolean; reason: string | null;
  audit_checked: number | null; audit_disagreements: number | null; diff_s: number | null;
  aligned_audit_disagreements: number | null; qualified_aligned: boolean;
  complete_pbp: boolean | null; validation: string; features: string;
};

const results: Result[] = [];
for (const row of classes) {
  const plays = playsByGame.get(row.game_id);
  const homeTeamId = row.is_home ? row.team_id : row.opp_id;
  const awayTeamId = row.is_home ? row.opp_id : row.team_id;
  const base = { ...row, pbp: !!plays?.length };
  if (row.class === "missing_row" || !plays?.length) {
    results.push({ ...base, sim_s: null, qualified: false,
      reason: !plays?.length ? "no stored play-by-play" : null, audit_checked: null,
      audit_disagreements: null, diff_s: null, aligned_audit_disagreements: null,
      qualified_aligned: false, complete_pbp: null,
      validation: row.class === "missing_row" ? "missing_official" : "no_pbp", features: "" });
    continue;
  }
  const contract = buildTeamPpClock({
    gameId: row.game_id, teamId: row.team_id, homeTeamId, awayTeamId,
    gameType: row.game_type, plays,
  });
  let spans: { teamId: number; start: number; end: number }[] | null = null;
  try { spans = buildPenaltyClock(plays, { homeTeamId, awayTeamId, gameType: row.game_type }).spans; } catch { spans = null; }
  const f = spans ? features(plays, spans) : {};
  const flags = Object.entries(f).filter(([, v]) => v === true).map(([k]) => k).join("|");
  const aligned = spans ? alignedAuditDisagreements(plays, spans, homeTeamId, awayTeamId) : null;
  const complete = contract.unqualifiedReason !== PP_CLOCK_UNQUALIFIED_REASON && contract.seconds != null;
  const sim = contract.seconds;
  const official = row.toi_s;
  const diff = sim != null && official != null ? sim - official : null;
  let validation: string;
  if (sim == null) validation = "clock_error";
  else if (row.class === "malformed") validation = "official_malformed";
  else if (row.class === "placeholder_00") validation = sim > 0 ? "official_placeholder_confirmed" : "official_placeholder_sim_zero";
  else if (row.class === "zero_unverified") validation = sim === 0 ? "verified_no_pp" : "official_zero_sim_positive";
  else if (diff === 0) validation = "match";
  else if (Math.abs(diff!) <= 2) validation = "within_2s";
  else validation = "mismatch";
  results.push({ ...base, sim_s: sim, qualified: contract.qualified, reason: contract.unqualifiedReason,
    audit_checked: contract.audit?.checkedEvents ?? null,
    audit_disagreements: contract.audit?.disagreements ?? null, diff_s: diff,
    aligned_audit_disagreements: aligned, qualified_aligned: complete && aligned === 0,
    complete_pbp: contract.seconds == null ? null : complete, validation, features: flags });
}

mkdirSync(outDir, { recursive: true });
const cols = ["game_id", "season_id", "game_type", "team_id", "opp_id", "is_home", "toi", "pp", "toi_s",
  "pp_opps", "opp_pim", "class", "pbp", "sim_s", "diff_s", "qualified", "audit_checked",
  "audit_disagreements", "aligned_audit_disagreements", "complete_pbp", "qualified_aligned",
  "validation", "reason", "features"] as const;
const esc = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
writeFileSync(join(outDir, "team-game-results.csv"),
  [cols.join(","), ...results.map((r) => cols.map((c) => esc((r as any)[c])).join(","))].join("\n") + "\n");

// Summaries.
const key = (r: Result) => `${r.season_id}|${r.game_type}`;
const summary: Record<string, Record<string, number>> = {};
for (const r of results) {
  const k = key(r);
  summary[k] ??= {};
  summary[k][r.validation] = (summary[k][r.validation] ?? 0) + 1;
  const q = r.validation === "clock_error" || r.validation === "no_pbp" || r.validation === "missing_official"
    ? null : r.qualified ? "clock_qualified" : "clock_unqualified";
  if (q) summary[k][q] = (summary[k][q] ?? 0) + 1;
  if (q && r.qualified_aligned) summary[k].clock_qualified_aligned = (summary[k].clock_qualified_aligned ?? 0) + 1;
}
const reasons: Record<string, number> = {};
for (const r of results) if (r.reason && !r.qualified) reasons[r.reason.replace(/\d+ event\(s\)/, "N event(s)").replace(/at game second \d+/, "at game second N")] = (reasons[r.reason.replace(/\d+ event\(s\)/, "N event(s)").replace(/at game second \d+/, "at game second N")] ?? 0) + 1;

// Mismatch attribution among comparable rows (official nonzero, clock computed).
const comparable = results.filter((r) => ["match", "within_2s", "mismatch"].includes(r.validation));
const byFeature: Record<string, { n: number; match: number; within2: number; mismatch: number; absDiff: number }> = {};
for (const r of comparable) {
  const tags = r.features ? r.features.split("|") : ["none"];
  for (const t of [...tags, "all"]) {
    byFeature[t] ??= { n: 0, match: 0, within2: 0, mismatch: 0, absDiff: 0 };
    const b = byFeature[t];
    b.n++;
    if (r.validation === "match") b.match++;
    else if (r.validation === "within_2s") b.within2++;
    else b.mismatch++;
    b.absDiff += Math.abs(r.diff_s ?? 0);
  }
}
const diffHistogram: Record<string, number> = {};
for (const r of comparable) {
  const d = r.diff_s!;
  const b = d === 0 ? "0" : Math.abs(d) <= 2 ? "±1-2" : Math.abs(d) <= 10 ? (d > 0 ? "+3-10" : "-3-10")
    : Math.abs(d) <= 60 ? (d > 0 ? "+11-60" : "-11-60") : d > 0 ? "+61+" : "-61+";
  diffHistogram[b] = (diffHistogram[b] ?? 0) + 1;
}
const out = {
  source: PP_CLOCK_SOURCE, algorithmQualifiedFlag: PP_CLOCK_QUALIFIED,
  games: new Set(results.map((r) => r.game_id)).size, teamGames: results.length,
  bySeasonType: summary, unqualifiedReasons: reasons, diffHistogram, byFeature,
};
writeFileSync(join(outDir, "summary.json"), JSON.stringify(out, null, 2) + "\n");
console.log(JSON.stringify(out, null, 2));
void getPowerPlayBlocks; void teamPpClockSeconds;
