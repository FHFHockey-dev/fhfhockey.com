// TT-17 genuine capture run-3 (TJ approval: READ-APPROVAL addendum 4). One loadTrendLayer run WITH sparkline series
// (S1/M2) against production with the public anon key, within READ-PLAN v3: GET only to the Supabase host, at most 22
// statements, pages ≤ 1,000 (loader), concurrency 2 (loader), no retries, no writes. Saves the shown-players layer, a
// statement log (in-lists reduced to counts) and facts computed in memory from the same responses, including a
// per-tile series diagnosis: each shown skater's S1 rows (date, season games played, season totals) and, for every
// missing appearance, why it is missing. No other raw rows are written. Copied from ../capture.run.ts (TT-2).
import { writeFileSync } from "node:fs";
import { it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
vi.mock("lib/supabase/public-client", () => ({ default: { from: () => { throw new Error("capture must use the guarded client"); } } }));
import { loadTrendLayer, TREND_LIMITS } from "lib/socialShare/trendSources";
import { SERIES_COLUMNS, SERIES_GAMES } from "lib/socialShare/trends";

const MAX_STATEMENTS = 22;
it("captures one genuine Tuesday layer", async () => {
  // TT_DRY_* point a rehearsal at a fictional .invalid host and a scratch folder.
  const dir = process.env.TT_DRY_DIR ?? process.env.TT_RUN_DIR ?? process.env.TT_CAPTURE_DIR!, url = process.env.TT_DRY_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!, key = process.env.NEXT_PUBLIC_SUPABASE_PUBLIC_KEY!;
  if (!url || !key) throw new Error("Supabase URL or public key missing from web/.env.local");
  const host = new URL(url).host, log: Record<string, unknown>[] = [], bodies: Record<string, unknown[][]> = {}, bodyOf = new Map<Record<string, unknown>, unknown[]>();
  let inFlight = 0, maxInFlight = 0;
  const guarded: typeof fetch = async (input, init) => {
    const target = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url), method = (init?.method ?? "GET").toUpperCase();
    if (target.host !== host || method !== "GET" || !target.pathname.startsWith("/rest/v1/")) throw new Error(`Refused ${method} ${target.host}${target.pathname}`);
    if (log.length >= MAX_STATEMENTS) throw new Error(`Statement ceiling ${MAX_STATEMENTS} reached`);
    const table = decodeURIComponent(target.pathname.slice("/rest/v1/".length));
    const filters = [...target.searchParams].filter(([name]) => name !== "select").map(([name, value]) => `${name}=${value.replace(/^in\.\((.*)\)$/, (_, list: string) => `in.(${list.split(",").length} values)`)}`);
    const entry: Record<string, unknown> = { n: log.length + 1, table, select: target.searchParams.get("select"), filters, range: (init?.headers as Record<string, string> | undefined)?.Range ?? null, startedAt: new Date().toISOString() };
    log.push(entry);
    inFlight++; maxInFlight = Math.max(maxInFlight, inFlight); entry.inFlight = inFlight;
    const started = performance.now();
    try {
      const response = await fetch(target, init);
      const text = await response.text();
      entry.status = response.status; entry.ms = Math.round(performance.now() - started); entry.contentRange = response.headers.get("content-range");
      try {
        const body = JSON.parse(text);
        if (Array.isArray(body)) { entry.rows = body.length; (bodies[table] ??= []).push(body); bodyOf.set(entry, body); }
        else { entry.errorCode = body?.code ?? null; entry.errorMessage = typeof body?.message === "string" ? body.message.slice(0, 200) : null; }
      } catch { entry.errorCode = "non-json"; }
      return new Response(text, { status: response.status, statusText: response.statusText, headers: response.headers });
    } catch (error) { entry.ms = Math.round(performance.now() - started); entry.errorCode = "fetch-failed"; entry.errorMessage = String(error).slice(0, 200); throw error; }
    finally { inFlight--; }
  };
  const client = createClient(url, key, { global: { fetch: guarded }, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const capturedAt = new Date().toISOString(), context = { season: 20262027, fetchedAt: capturedAt, generatedAt: capturedAt };
  const layer = await loadTrendLayer(context, client as never, { sparklines: true });
  const finishedAt = new Date().toISOString();

  // Aggregate facts from the same responses (in memory only).
  const rows = (table: string) => (bodies[table] ?? []).flat() as Record<string, unknown>[];
  const rolling = rows("rolling_player_game_metrics").filter(row => row.strength_state === "all"), ev = rows("rolling_player_game_metrics").filter(row => row.strength_state === "ev");
  const perPlayer = new Map<number, Record<string, unknown>[]>();
  for (const row of rolling) perPlayer.set(row.player_id as number, [...(perPlayer.get(row.player_id as number) ?? []), row]);
  const num = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
  const latest = [...perPlayer.values()].map(list => list.sort((a, b) => String(b.game_date).localeCompare(String(a.game_date)))[0]);
  const seasonPoints = latest.filter(row => num(row.points_avg_season) && num(row.season_games_played)).map(row => (row.points_avg_season as number) * (row.season_games_played as number));
  const offInteger = seasonPoints.filter(value => Math.abs(value - Math.round(value)) > 0.05).length;
  const toiWindow = latest.filter(row => num(row.toi_seconds_total_last5) && num(row.toi_seconds_avg_last5) && (row.toi_seconds_avg_last5 as number) > 0).map(row => ({ gp: row.season_games_played as number, ratio: (row.toi_seconds_total_last5 as number) / (row.toi_seconds_avg_last5 as number) }));
  const ratioIs = (want: (gp: number) => number) => toiWindow.filter(item => Math.abs(item.ratio - want(item.gp)) < 0.05).length;
  const ownership = rows("yahoo_player_ownership_history"), byDate: Record<string, number> = {};
  for (const row of ownership) if (typeof row.ownership_date === "string" && "player_key" in row) byDate[row.ownership_date] = (byDate[row.ownership_date] ?? 0) + 1;
  const ppc = rows("powerPlayCombinations"), ppcGames = new Set(ppc.map(row => row.gameId)), queriedGames = new Set(rolling.flatMap(row => [row.game_id]).filter(num));
  const latestGames = new Set(latest.map(row => row.game_id).filter(num));
  const map = rows("yahoo_nhl_player_map_read"), mapIds = new Map<string, Set<string>>();
  for (const row of map) mapIds.set(String(row.yahoo_player_id), (mapIds.get(String(row.yahoo_player_id)) ?? new Set()).add(String(row.nhl_player_id)));
  const names = rows("players"), goalies = names.filter(row => row.position === "G").length;
  const facts = {
    statements: log.length, ceiling: { statements: MAX_STATEMENTS, rowsPerStatement: 1000, concurrency: TREND_LIMITS.concurrency }, maxInFlight,
    maxRowsInOneStatement: Math.max(0, ...log.map(entry => (entry.rows as number) ?? 0)), errors: log.filter(entry => entry.errorCode || (entry.status as number) >= 400).length,
    fact1_rolling: { rows: rolling.length, statements: log.filter(entry => entry.table === "rolling_player_game_metrics" && String(entry.filters).includes("strength_state=eq.all")).map(entry => ({ ms: entry.ms, rows: entry.rows, contentRange: entry.contentRange })), distinctPlayers: perPlayer.size,
      gamesPerPlayer: Object.fromEntries([...perPlayer.values()].reduce((counts, list) => counts.set(list.length, (counts.get(list.length) ?? 0) + 1), new Map<number, number>())),
      goaliesAmongShortlistedNames: `${goalies} of ${names.length}`, nullTeamIds: latest.filter(row => !num(row.team_id)).length, newestUpdatedAt: latest.map(row => String(row.updated_at)).sort().at(-1), oldestUpdatedAt: latest.map(row => String(row.updated_at)).sort()[0], newestGameDate: latest.map(row => String(row.game_date)).sort().at(-1) },
    fact2_ownership: { latestDate: layer.ownershipLatestDate, previousDate: layer.ownershipPreviousDate, rowsPerDate: byDate, todayNewYork: new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date(capturedAt)), nullPct: ownership.filter(row => "player_key" in row && !num(row.ownership_pct)).length },
    fact3_last5: { latestRows: latest.length, seasonPointsNearInteger: `${seasonPoints.length - offInteger} of ${seasonPoints.length}`, toiTotalOverAvg: { equals5: ratioIs(() => 5), equalsMinGp5: ratioIs(gp => Math.min(gp, 5)), checked: toiWindow.length, gpUnder5: toiWindow.filter(item => item.gp < 5).length, gpUnder5Equals_gp: toiWindow.filter(item => item.gp < 5 && Math.abs(item.ratio - item.gp) < 0.05).length } },
    fact4_pp: { gamesQueried: queriedGames.size, gamesWithPpRows: [...queriedGames].filter(id => ppcGames.has(id)).length, latestGames: latestGames.size, latestGamesWithPpRows: [...latestGames].filter(id => ppcGames.has(id)).length, ppcRows: ppc.length,
      latestRowsPpUnitNull: latest.filter(row => row.pp_unit === null).length, latestRowsPpUnitNullWithoutGameRows: latest.filter(row => row.pp_unit === null && !ppcGames.has(row.game_id)).length },
    fact5_map: { valuesQueried: log.filter(entry => entry.table === "yahoo_nhl_player_map_read").map(entry => entry.filters), mapRows: map.length, keysWithOneNhlId: [...mapIds.values()].filter(set => set.size === 1).length, keysWithManyNhlIds: [...mapIds.values()].filter(set => set.size > 1).length, evRows: ev.length },
    recentForm: { rule: layer.sections.hot.rule, qualifiers: layer.sections.hot.qualifiers, up: layer.sections.hot.hot.length, down: layer.sections.hot.cold.length,
      seasonGpAtLeast10: latest.filter(row => num(row.season_games_played) && (row.season_games_played as number) >= 10).length, last10Present: latest.filter(row => num(row.points_total_last10)).length },
    footerFreshness: { metricsUpdatedAt: layer.metricsUpdatedAt, metricsThrough: layer.metricsThrough },
    sections: Object.fromEntries(Object.entries(layer.sections).map(([kind, section]) => [kind, { state: section.state, reasons: section.reasons, listed: Object.values(section).filter(Array.isArray).filter(list => list.length && typeof list[0] === "object").reduce((total, list) => total + list.length, 0) }])),
  };
  writeFileSync(`${dir}/layer.json`, `${JSON.stringify({ capturedAt, finishedAt, context, layer }, null, 2)}\n`);
  writeFileSync(`${dir}/statements.jsonl`, `${log.map(entry => JSON.stringify(entry)).join("\n")}\n`);
  writeFileSync(`${dir}/facts.json`, `${JSON.stringify({ capturedAt, finishedAt, ...facts }, null, 2)}\n`);
  // Series diagnosis (TT-17), after the capture files are safely written: S1 rows are the rolling statements selecting
  // SERIES_COLUMNS. A failure here is recorded, never thrown, so it cannot lose the one approved capture.
  try {
  const s1 = log.filter(entry => entry.table === "rolling_player_game_metrics" && entry.select === SERIES_COLUMNS.join(",")).flatMap(entry => (bodyOf.get(entry) ?? []) as Record<string, unknown>[]);
  const r3 = (value: unknown) => num(value) ? Math.round(value * 1000) / 1000 : null;
  const diagnose = (card: string, list: { nhlId: number; name: string; series?: (number | null)[] | null }[]) => list.map(row => {
    const rows = s1.filter(item => item.player_id === row.nhlId).sort((a, b) => String(a.game_date).localeCompare(String(b.game_date)))
      .map(item => ({ date: item.game_date, season: item.season, strength: item.strength_state, sgp: item.season_games_played, points: num(item.points_avg_season) && num(item.season_games_played) ? r3(item.points_avg_season * item.season_games_played) : null, toi: num(item.toi_seconds_avg_season) && num(item.season_games_played) ? Math.round(item.toi_seconds_avg_season * item.season_games_played) : null }));
    const latestRow = latest.find(item => item.player_id === row.nhlId), latestSgp = num(latestRow?.season_games_played) ? latestRow!.season_games_played as number : null;
    const at = (sgp: number) => rows.filter(item => item.sgp === sgp);
    const missing = (row.series ?? []).flatMap((value, k) => {
      if (value !== null || latestSgp === null) return [];
      const sgp = latestSgp - (SERIES_GAMES - 1 - k), here = at(sgp), before = sgp === 1 ? null : at(sgp - 1), reasons: string[] = [];
      if (sgp < 1) reasons.push("before game 1");
      if (!here.length) reasons.push(`no row with season games played = ${sgp}`);
      if (here.length > 1) reasons.push(`${here.length} rows with season games played = ${sgp} (${here.map(item => item.date).join(", ")})`);
      if (before && !before.length) reasons.push(`no row with season games played = ${sgp - 1}`);
      if (before && before.length > 1) reasons.push(`${before.length} rows with season games played = ${sgp - 1} (${before.map(item => item.date).join(", ")})`);
      for (const item of [...here, ...(before ?? [])]) if (card === "hot" && (item.points === null || Math.abs(item.points - Math.round(item.points)) > 0.01)) reasons.push(`points total not whole at game ${item.sgp} (${item.points})`);
      return [{ index: k, game: sgp, reasons: reasons.length ? reasons : ["unexplained"] }];
    });
    return { card, nhlId: row.nhlId, name: row.name, latest: latestRow ? { date: latestRow.game_date, sgp: latestSgp } : null, series: row.series ?? null, missing, rows };
  });
  const sections = layer.sections;
  const seriesDiagnosis = {
    s1Rows: s1.length, s1Statements: log.filter(entry => entry.table === "rolling_player_game_metrics" && entry.select === SERIES_COLUMNS.join(",")).length,
    hot: diagnose("hot", [...sections.hot.hot, ...sections.hot.cold]), deployment: diagnose("deployment", [...sections.deployment.up, ...sections.deployment.down]),
    rates: diagnose("rates", [...sections.rates.sogPer60, ...sections.rates.icfPer60, ...sections.rates.ixgPer60]),
  };
  writeFileSync(`${dir}/series-diagnosis.json`, `${JSON.stringify({ capturedAt, ...seriesDiagnosis }, null, 2)}\n`);
  } catch (error) { writeFileSync(`${dir}/series-diagnosis.json`, `${JSON.stringify({ capturedAt, error: String(error) }, null, 2)}\n`); }
});
