// Decision 144 (F11): explain one game's clock. Prints the penalties, goals,
// the clock's PP spans and every situation-code audit disagreement, from the
// same stored scalar play-by-play pages 05-compare-clock.ts reads.
// Build like 05-compare-clock.ts, then:
//   node inspect.mjs <classes.csv> <pbp_dir> <gameId> [<gameId> ...]
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import getPowerPlayBlocks, {
  auditPpBlocksAgainstSituationCodes,
} from "../../../../../../web/utils/getPowerPlayBlocks";

const [classesPath, pbpDir, ...gameArgs] = process.argv.slice(2);
const wanted = new Set(gameArgs.map(Number));

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split("\n").filter((l) => l.length > 0);
  const header = lines[0].split(",");
  return lines.slice(1).map((line) => {
    const cells = line.split(",");
    return Object.fromEntries(header.map((h, i) => [h, cells[i] ?? ""]));
  });
}
const num = (s: string) => (s === "" ? null : Number(s));
const str = (s: string) => (s === "" ? null : s);

const teams = new Map<number, { home: number; away: number; type: number; rows: Record<string, string>[] }>();
for (const r of parseCsv(readFileSync(classesPath, "utf8"))) {
  const id = Number(r.game_id);
  if (!wanted.has(id)) continue;
  const t = teams.get(id) ?? { home: 0, away: 0, type: Number(r.game_type), rows: [] };
  if (r.is_home === "t") { t.home = Number(r.team_id); t.away = Number(r.opp_id); }
  t.rows.push(r);
  teams.set(id, t);
}

const plays = new Map<number, any[]>();
for (const file of readdirSync(pbpDir).filter((f) => f.endsWith(".csv"))) {
  for (const r of parseCsv(readFileSync(join(pbpDir, file), "utf8"))) {
    const id = Number(r.game_id);
    if (!wanted.has(id)) continue;
    const details: Record<string, unknown> = {};
    if (r.event_owner_team_id !== "") details.eventOwnerTeamId = Number(r.event_owner_team_id);
    if (r.penalty_type_code !== "") details.typeCode = r.penalty_type_code;
    if (r.penalty_desc_key !== "") details.descKey = r.penalty_desc_key;
    if (r.penalty_duration_minutes !== "") details.duration = Number(r.penalty_duration_minutes);
    if (r.committed_by_player_id !== "") details.committedByPlayerId = Number(r.committed_by_player_id);
    if (r.served_by_player_id !== "") details.servedByPlayerId = Number(r.served_by_player_id);
    const list = plays.get(id) ?? [];
    list.push({
      eventId: Number(r.event_id), sortOrder: num(r.sort_order),
      periodDescriptor: { number: num(r.period_number), periodType: str(r.period_type) },
      timeInPeriod: str(r.time_in_period), timeRemaining: str(r.time_remaining),
      situationCode: str(r.situation_code), typeDescKey: str(r.type_desc_key), details,
    });
    plays.set(id, list);
  }
}

const sec = (p: any) => {
  const [m, s] = String(p.timeInPeriod).split(":").map(Number);
  return (p.periodDescriptor.number - 1) * 1200 + m * 60 + s;
};
const clock = (g: number) => `P${Math.floor(g / 1200) + 1} ${String(Math.floor((g % 1200) / 60)).padStart(2, "0")}:${String(g % 60).padStart(2, "0")}`;

for (const id of wanted) {
  const t = teams.get(id);
  const list = (plays.get(id) ?? []).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  console.log(`\n=== game ${id} type ${t?.type} home ${t?.home} away ${t?.away} (${list.length} plays)`);
  for (const r of t?.rows ?? []) console.log(`  official team ${r.team_id}: toi ${r.toi} pp ${r.pp} class ${r.class}`);
  for (const p of list.filter((p) => ["penalty", "goal"].includes(p.typeDescKey))) {
    if (p.periodDescriptor.periodType === "SO") continue;
    const d = p.details;
    console.log(`  ${clock(sec(p))} ${p.typeDescKey.padEnd(7)} team ${d.eventOwnerTeamId} ${d.typeCode ?? ""}/${d.duration ?? ""} ${d.descKey ?? ""} by ${d.committedByPlayerId ?? "-"} srv ${d.servedByPlayerId ?? "-"} sit ${p.situationCode} ev ${p.eventId}`);
  }
  try {
    const blocks = getPowerPlayBlocks(list, { homeTeamId: t!.home, awayTeamId: t!.away, gameType: t!.type });
    const toS = (b: any) => (b.period - 1) * 1200 + Number(b.timeInPeriod.split(":")[0]) * 60 + Number(b.timeInPeriod.split(":")[1]);
    for (const b of blocks) console.log(`  span team ${b.teamId} ${clock(toS(b.start))} -> ${clock(toS(b.end))} (${toS(b.end) - toS(b.start)} s)`);
    const audit = auditPpBlocksAgainstSituationCodes(list, blocks, { homeTeamId: t!.home, awayTeamId: t!.away });
    for (const d of audit.disagreements) {
      const p = list.find((x) => x.eventId === d.eventId);
      console.log(`  AUDIT ${clock(d.gameSecond)} ev ${d.eventId} ${p?.typeDescKey} sit ${d.situationCode} sim ${d.simulatedAdvantageTeamId} codes ${d.situationAdvantageTeamId}`);
    }
  } catch (e) {
    console.log(`  CLOCK ERROR ${(e as Error).message}`);
  }
}
