// Reduce the Frozen Tools planner export to schedule facts only (team, date, opponent, venue)
// and validate it: every game appears once for each side and nightly counts match the header.
import { readFileSync, writeFileSync } from "node:fs";
const [, , input, output] = process.argv;
const parse = (line) => [...line.matchAll(/"([^"]*)"/g)].map((m) => m[1]);
const [header, ...rows] = readFileSync(input, "utf8").trim().split(/\r?\n/).map(parse);
const dayCols = header.map((h, i) => [h, i]).filter(([h]) => /^\w{3} \d\d\/\d\d \(\d+\)$/.test(h));
const dates = dayCols.map(([h]) => { const [, mm, dd] = h.match(/(\d\d)\/(\d\d)/); return `2025-${mm}-${dd}`; });
const headerCounts = dayCols.map(([h]) => Number(h.match(/\((\d+)\)/)[1]));
const schedule = {};
for (const row of rows) schedule[row[0]] = Object.fromEntries(dayCols.flatMap(([, col], i) =>
  row[col] ? [[dates[i], { opponent: row[col].replace(/^@/, ""), home: !row[col].startsWith("@") }]] : []));
const teams = Object.keys(schedule).sort();
if (teams.length !== 32) throw new Error(`expected 32 teams, got ${teams.length}`);
dates.forEach((date, i) => {
  const playing = teams.filter((t) => schedule[t][date]);
  for (const t of playing) {
    const g = schedule[t][date], back = schedule[g.opponent]?.[date];
    if (!back || back.opponent !== t || back.home === g.home) throw new Error(`unreciprocated ${t} ${date}`);
  }
  if (playing.length !== 2 * headerCounts[i]) throw new Error(`${date}: ${playing.length / 2} games vs header ${headerCounts[i]}`);
});
writeFileSync(output, JSON.stringify({ source: "Frozen Tools Schedule Planner export (TJ Downloads), schedule cells only", dates, gamesPerDate: headerCounts, teams, schedule }, null, 1));
console.log(`ok: ${teams.length} teams, ${dates.length} dates ${dates[0]}..${dates.at(-1)}, ${headerCounts.reduce((a, b) => a + b)} games`);
