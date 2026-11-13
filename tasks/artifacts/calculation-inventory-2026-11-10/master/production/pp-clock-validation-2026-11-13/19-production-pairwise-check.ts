// Decision 152 Part B (F11): runs production's own per-player PP code (master
// components/LinemateMatrix/utilities.ts getPairwiseTOI with master
// getPowerPlayBlocks) on the stored shift rows, to tell a code difference from a
// shift-feed difference. Build with the aliases from 16 plus
//   --alias:pp-master-utilities=$S/versions/master/utilities.ts --alias:utils/getPowerPlayBlocks=$S/versions/master/getPowerPlayBlocks.ts
//   (git show master:web/components/LinemateMatrix/utilities.ts > $S/versions/master/utilities.ts), then:
//   node pairwise.mjs <shift rows csv> <pbp_dir> <gameId:teamId:playerId>...
import { readFileSync } from "node:fs";
// @ts-expect-error alias
import { getPairwiseTOI } from "pp-master-utilities";
// @ts-expect-error alias
import masterBlocks from "pp-blocks-master";
const [shiftCsv, pbpDir, ...targets] = process.argv.slice(2);
const csv = (t: string) => { const l = t.split("\n").filter(Boolean); const h = l[0].split(","); return l.slice(1).map((x) => { const c = x.split(","); return Object.fromEntries(h.map((k, i) => [k, c[i] ?? ""])); }); };
import { readdirSync } from "node:fs"; import { join } from "node:path";
const shifts = csv(readFileSync(shiftCsv, "utf8")).filter((r: any) => r.type_code === "517");
for (const t of targets) {
  const [g, team, player] = t.split(":");
  const plays: any[] = [];
  for (const f of readdirSync(pbpDir).filter((x) => x.endsWith(".csv"))) for (const r of csv(readFileSync(join(pbpDir, f), "utf8")) as any[]) {
    if (r.game_id !== g) continue; const d: any = {}; if (r.event_owner_team_id) d.eventOwnerTeamId = +r.event_owner_team_id; if (r.penalty_type_code) d.typeCode = r.penalty_type_code; if (r.penalty_desc_key) d.descKey = r.penalty_desc_key; if (r.penalty_duration_minutes) d.duration = +r.penalty_duration_minutes; if (r.committed_by_player_id) d.committedByPlayerId = +r.committed_by_player_id;
    plays.push({ eventId: +r.event_id, sortOrder: +r.sort_order, periodDescriptor: { number: +r.period_number, periodType: r.period_type }, timeInPeriod: r.time_in_period, timeRemaining: r.time_remaining, situationCode: r.situation_code, typeDescKey: r.type_desc_key, details: d }); }
  plays.sort((a, b) => a.sortOrder - b.sortOrder);
  const blocks = masterBlocks(plays);
  const teamShifts = shifts.filter((r: any) => r.game_id === g && r.team_id === team).map((r: any, i: number) => ({ id: i, gameId: +g, playerId: +r.player_id, period: +r.period, teamId: +r.team_id, startTime: r.start_time, endTime: r.end_time, duration: r.duration, firstName: "", lastName: "", teamName: "" }));
  console.log(t, "master getPairwiseTOI", getPairwiseTOI(teamShifts, +player, +player, blocks), "blocks", JSON.stringify(blocks.filter((b: any) => b.teamId === +team).map((b: any) => [b.start.period, b.start.timeInPeriod, b.end.period, b.end.timeInPeriod])));
}
