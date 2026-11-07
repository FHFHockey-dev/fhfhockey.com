import { test } from "vitest";
import { config } from "/Users/tim/Code/fhfhockey.com/web/node_modules/dotenv/lib/main.js";
import { writeFileSync } from "node:fs";
config({ path: "/Users/tim/Code/fhfhockey.com/web/.env.local", quiet: true } as any);

test("rso week coverage", async () => {
  const { default: db } = await import("lib/supabase/server");
  const { loadPlanningData, parsePlanningDataQuery } = await import("lib/rosterScheduleData/planning");
  const { selectForecastServingSource } = await import("lib/player-forecasts/forecastServingSource");
  const { compactBridgeForecasts, fitBridgeWire, PLANNING_RESPONSE_BYTE_BUDGET, jsonUtf8Bytes } = await import("lib/rosterScheduleData/bridgeForecastWire");
  const { encodePlanningDataTransport } = await import("lib/rosterScheduleData/planningDataTransport");
  const query = parsePlanningDataQuery({ seasonId: "20262027", startDate: "2026-10-26", endDate: "2026-11-01", timeZone: "America/New_York" });
  const now = new Date();
  const source = await selectForecastServingSource(db, query.seasonId, now);
  const data = await loadPlanningData(db, query, { now, source, forgeDailyBridge: true, consumer: "rso" });
  const bridge = compactBridgeForecasts(data.forecasts, data, query.seasonId);
  const transport = encodePlanningDataTransport({ ...data, forecasts: bridge.forecasts });
  const body: any = fitBridgeWire(bridge.wire, wire => ({ success: true, data: transport, ...(wire ? { bridgeForecasts: wire } : {}) }), PLANNING_RESPONSE_BYTE_BUDGET);
  const served = body?.bridgeForecasts?.rows?.length ?? 0;
  const byId = new Map(data.players.map(p => [p.id, p]));
  const sched = data.games.filter(g => g.status === "scheduled");
  const future = sched.filter(g => g.startsAt && Date.parse(g.startsAt) > now.getTime());
  const fc = data.forecasts;
  const servedKeys = new Set((body?.bridgeForecasts?.rows ?? []).map((r: any) => `${r[0]}|${r[1]}`));
  const perDate: Record<string, any> = {};
  for (const g of sched) {
    const d = (perDate[g.date] ??= { teamGames: 0, futureTeamGames: 0, sk: 0, gl: 0, skCovered: 0, glCovered: 0, skServed: 0, glServed: 0 });
    d.teamGames++;
    const isFuture = g.startsAt && Date.parse(g.startsAt) > now.getTime();
    if (isFuture) d.futureTeamGames++;
    for (const p of data.players) if (p.teamAbbreviation === g.teamAbbreviation && isFuture) {
      const k = p.playerClass === "goalie" ? "gl" : "sk"; d[k]++;
      const has = fc.some(f => f.playerId === p.id && f.gameId === g.id);
      if (has) d[k + "Covered"]++;
      if (servedKeys.has(`${p.id}|${g.id}`)) d[k + "Served"]++;
    }
  }
  const out = {
    now: now.toISOString(), sourceKind: source.kind, players: data.players.length,
    skaters: data.players.filter(p => p.playerClass === "skater").length, goalies: data.players.filter(p => p.playerClass === "goalie").length,
    noTeam: data.players.filter(p => !p.teamAbbreviation).length,
    scheduledTeamGames: sched.length, futureTeamGames: future.length,
    forecastsBuilt: fc.length, bridgeRowsWire: bridge.wire?.rows.length ?? 0, bridgeRowsServed: served,
    bodyBytes: body ? jsonUtf8Bytes(body) : null, budget: PLANNING_RESPONSE_BYTE_BUDGET,
    manifest: { required: data.forecastManifest?.requiredOpportunities, forecasted: data.forecastManifest?.forecastedOpportunities, exclusionCounts: data.forecastManifest?.exclusionCounts },
    perDate, limitations: data.evidence?.forecasts?.limitations,
    servedLimitations: body?.bridgeForecasts?.limitations,
  };
  writeFileSync("out.json", JSON.stringify(out, null, 2));
  const covered = new Set(fc.map(f => f.playerId));
  const unc = data.players.filter(p => p.teamAbbreviation).map(p => ({ nhlId: p.nhlId, cls: p.playerClass, team: p.teamAbbreviation, hasTeamId: Number.isFinite(p.nhlTeamId), rev: !!p.rosterRevision,
    games: future.filter(g => g.teamAbbreviation === p.teamAbbreviation).length, coveredGames: fc.filter(f => f.playerId === p.id).length }))
    .filter(r => r.coveredGames < r.games);
  writeFileSync("uncovered.json", JSON.stringify(unc));
  const { bridgeWireRowBytes } = await import("lib/rosterScheduleData/bridgeForecastWire");
  writeFileSync("bytes.json", JSON.stringify({ wire: fc.reduce((s, f) => s + bridgeWireRowBytes(f), 0), expanded: fc.reduce((s, f) => s + jsonUtf8Bytes(f) + 1, 0), rows: fc.length }));
});
