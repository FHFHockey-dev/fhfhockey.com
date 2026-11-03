// @vitest-environment node
// C7 property control for GS official starts: valid labels → starts sum to window games; any corruption withholds the whole team window.
import { describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import { buildGoalieShareByTeam, type GoalieGameRow, type SpanType } from "lib/goalieWorkload";
describe("C7 GS starts", () => {
  it("G1 400 random teams × 4 spans", () => {
    let seed = 5; const r = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    const bad: string[] = []; let withheld = 0, counted = 0;
    for (let n = 0; n < 400; n++) {
      const games = 5 + Math.floor(r() * 40), rows: GoalieGameRow[] = [];
      for (let g = 1; g <= games; g++) {
        const date = new Date(Date.UTC(2026, 9, 1) + g * 86400000).toISOString().slice(0, 10), starter = r() < 0.7 ? 1 : 2;
        const base = { gameId: 2026020000 + g, gameDate: date, teamAbbrev: "PHI", wins: 0, losses: 1, otLosses: 0, saves: 25, shotsAgainst: 28, goalsAgainst: 3, timeOnIce: 3600, gamesPlayed: 1 };
        rows.push({ ...base, playerId: starter, goalieFullName: `G${starter}`, gamesStarted: 1 });
        if (r() < 0.1) rows.push({ ...base, playerId: starter === 1 ? 2 : 1, goalieFullName: "Relief", gamesStarted: 0, timeOnIce: 600 });
      }
      const corrupt = r() < 0.4 ? Math.floor(r() * rows.length) : -1, kind = Math.floor(r() * 4);
      if (corrupt >= 0) rows[corrupt] = { ...rows[corrupt], gamesStarted: [null, 2, 0.5, rows[corrupt].gamesStarted === 1 ? 0 : 1][kind] as any };
      for (const span of ["L10", "L20", "L30", "Season"] as SpanType[]) {
        const t: any = buildGoalieShareByTeam(rows, span); const team = t.PHI ?? t["PHI"] ?? Object.values(t)[0]; const goalies = team.goalies as any[];
        const limit = { L10: 10, L20: 20, L30: 30, Season: Infinity }[span]; const windowIds = new Set(Array.from({ length: games }, (_, i) => 2026020000 + i + 1).slice(-Math.min(limit, games)));
        const corruptIn = corrupt >= 0 && windowIds.has(rows[corrupt].gameId);
        const starts = goalies.map(g => g.gamesStarted);
        if (corruptIn) { if (starts.some(s => s !== null)) bad.push(`${n} ${span} not withheld`); else withheld++; }
        else { const sum = starts.reduce((a, b) => a + (b ?? NaN), 0); if (sum !== windowIds.size) bad.push(`${n} ${span} sum ${sum} vs ${windowIds.size}`); else counted++; }
        const apps = goalies.reduce((a, g) => a + g.gamesPlayed, 0), wantApps = rows.filter(x => windowIds.has(x.gameId)).length;
        if (apps !== wantApps) bad.push(`${n} ${span} appearances ${apps} vs ${wantApps}`);
      }
    }
    if (process.env.C7_GS_OUT) writeFileSync(process.env.C7_GS_OUT, JSON.stringify({ withheld, counted, bad: bad.slice(0, 10), badCount: bad.length }, null, 2));
    expect(bad).toEqual([]); expect(withheld).toBeGreaterThan(0); expect(counted).toBeGreaterThan(0);
  });
});
