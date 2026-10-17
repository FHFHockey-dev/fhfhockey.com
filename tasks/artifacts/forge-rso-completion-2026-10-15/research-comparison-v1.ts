import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { assembleCurrentRosterNativeInputs } from "../../../web/lib/player-forecasts/currentRosterNativeInputs";
import { buildNativeSkaterBaselineSnapshot } from "../../../web/lib/player-forecasts/baselineGeneration";
import { buildNativeGoalieVolumeRates, buildNativeGoalieWinRates, buildNativeGoalieShutoutRates } from "../../../web/lib/player-forecasts/goalieBaselineRates";
import { deriveNativeGoalieOutcomes, deriveNativeGoalieShutoutCredit } from "../../../web/lib/player-forecasts/nativeGoalieOutcomes";
import { deriveNativePowerPlayPoints } from "../../../web/lib/player-forecasts/nativePowerPlayPoints";

const repo = resolve(__dirname, "../../.."), base = "/Users/tim/Documents/FHFH-private/forge-rso-completion-20261016-v1";
const protocolPath = resolve(repo, "tasks/artifacts/forge-rso-completion-2026-10-15/research-comparison-protocol-v1.md");
const protocolHash = "0233b918bf2a43bc10ca7140e5b7d598ca816e0bf5b72a14fb82a130b2504e9e";
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const source = readFileSync(resolve(repo, "web/lib/projections/seasonBootstrap.ts"), "utf8");
const ast = ts.createSourceFile("seasonBootstrap.ts", source, ts.ScriptTarget.Latest, true);
const declaration = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "averageBootstrapStats");
if (!declaration) throw new Error("Missing existing pure arithmetic helper");
const arithmetic = new Function(ts.transpileModule(declaration.getText(ast).replace(/^export\s+/, ""),
  { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText + "\nreturn averageBootstrapStats;")() as
  (rows: Array<Record<string, number | null>>) => Record<string, number | null>;
const skaterKeys = ["GOALS", "ASSISTS", "POINTS", "PP_POINTS", "SHOTS_ON_GOAL", "HITS", "BLOCKED_SHOTS", "PENALTY_MINUTES", "TIME_ON_ICE_PER_GAME"];
const goalieKeys = ["SAVES_GOALIE", "GOALS_AGAINST_GOALIE", "SHOTS_AGAINST_GOALIE", "GOALIE_MINUTES", "WINS_GOALIE", "SHUTOUTS_GOALIE"];
const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0;

// Synthetic formula/missingness check does not open source outcomes or start a run.
if (process.argv.includes("--self-check")) {
  const mean = arithmetic([{ GOALS: 0, HITS: null }, { GOALS: 2, HITS: null }]);
  if (mean.GOALS !== 1 || mean.HITS !== null || JSON.stringify(arithmetic([])) !== "{}") throw new Error("Arithmetic self-check failed");
  console.log("Pure existing arithmetic/missingness self-check passed; no source bodies read.");
} else {
  if (process.argv[2] !== "--execute-frozen" || process.argv[3] !== protocolHash) throw new Error("Exact frozen protocol SHA required");
  if (sha(readFileSync(protocolPath)) !== protocolHash) throw new Error("Protocol changed");
  const started = performance.now(), cutoffAt = new Date().toISOString();
  let bytes = 0, bodyReads = 0, outputBytes = 0, producerCalls = 0;
  const out = resolve(base, "research-native-comparison-v1-recovery");
  mkdirSync(out, { mode: 0o700 });
  const guard = () => { if (performance.now() - started > 180000 || bytes > 4 * 1024 * 1024 || bodyReads > 122) throw new Error("Comparison budget exceeded"); };
  const save = (name: string, value: unknown) => {
    guard(); const raw = JSON.stringify(value, null, 2) + "\n"; outputBytes += Buffer.byteLength(raw);
    if (outputBytes > 16 * 1024 * 1024) throw new Error("Output budget exceeded");
    writeFileSync(resolve(out, name), raw, { mode: 0o600, flag: "wx" }); return sha(raw);
  };
  save("intent.json", { protocolHash, authority: "Root task directive: scoped standing authorization for checklist3.2 development-purpose extension", startedAt: cutoffAt,
    recoveryAuthority: "Root authorized one bounded continuation using equivalent verified ISO game metadata; prior attempt had0producer calls/predictions/scoring game reads",
    exposedDevelopment: true, noPromotion: true, arithmeticSourceHash: sha(source),
    implementationHashes: Object.fromEntries(["baselineRates.ts", "baselineGeneration.ts", "goalieBaselineRates.ts", "nativeGoalieOutcomes.ts",
      "currentRosterNativeInputs.ts", "baselineSourceLineage.ts", "nativePowerPlayPoints.ts", "settlement.ts"].map(name =>
      [name, sha(readFileSync(resolve(repo, "web/lib/player-forecasts", name)))])), runnerHash: sha(readFileSync(__filename)) });
  try {
    const metadata = readFileSync(resolve(base, "candidate-development-reuse-allocation-v1.json"));
    if (sha(metadata) !== "7464a036b119d286629aafeba4b6fbbde1271093c6b21bb5eb83473852b4b078") throw new Error("Allocation changed");
    const allocation = JSON.parse(metadata.toString());
    const scopeBytes = readFileSync(resolve(base, "native-assembly-scope-v2.json"));
    if (sha(scopeBytes) !== "ef001e6f3addf93feb7d5214081905bd79b3224d915bb566f73c3a33b87c8794") throw new Error("Owned scope changed");
    const scope = JSON.parse(scopeBytes.toString());
    if (scope.roster.length !== 19 || allocation.games.length !== 60 || allocation.originalBodies.length !== 120
      || allocation.games.some((g: any) => g.date < "2026-09-29" || g.date > "2026-10-12" || allocation.reservedGameIds.includes(g.id))) throw new Error("Scope/reservation conflict");
    const scopeGames = new Map(scope.games.map((g: any) => [g.id, g]));
    if (scopeGames.size !== 60 || allocation.games.some((g: any) => {
      const verified: any = scopeGames.get(g.id);
      return !verified || ["id", "date", "seasonId", "type", "homeTeamId", "awayTeamId"].some(key => g[key] !== verified[key])
        || !Number.isFinite(Date.parse(g.startTime)) || Date.parse(g.startTime) !== Date.parse(verified.startTime);
    })) throw new Error("Verified ISO metadata does not bind original allocation");
    save("corrected-metadata-binding.json", { allocationHash: sha(metadata), scopeHash: sha(scopeBytes),
      games: allocation.games.map((g: any) => ({ original: g, verified: scopeGames.get(g.id) })),
      reason: "Equivalent SQL/ISO timestamp representation; original response clocks and split unchanged" });
    const reservation = allocation.reservationMetadata;
    // Recheck only the explicitly allocated reservation metadata, never experiment labels.
    if (!reservation?.path || !reservation?.sha256 || sha(readFileSync(reservation.path)) !== reservation.sha256) throw new Error("Reservation metadata changed");
    const summaries = new Map<number, any>();
    for (const directory of ["goalie-shutout-hart-v1", "goalie-shutout-oettinger-v1"]) {
      const observations = JSON.parse(readFileSync(resolve(base, directory, "observation.json"), "utf8"));
      if (observations.length !== 1 || !scope.roster.some((p: any) => p.playerId === observations[0].payload.playerId && p.playerClass === "goalie")) throw new Error("SO scope mismatch");
      const summary = observations[0].payload.shutoutSummary;
      if (summary.scope.approvedGameIds.some((id: number) => !allocation.games.some((g: any) => g.id === id))) throw new Error("SO outside60games");
      for (const receipt of summary.receipts) {
        bodyReads++; bytes += Buffer.byteLength(receipt.rawBody);
        if (sha(receipt.rawBody) !== receipt.bodySha256 || Buffer.byteLength(receipt.rawBody) > 1024 * 1024) throw new Error("SO original hash/cap failed");
      }
      summaries.set(observations[0].payload.playerId, summary);
    }
    const loadSplit = (training: boolean) => {
      const games = allocation.games.filter((g: any) => (g.date <= "2026-10-05") === training);
      if (games.length !== (training ? 29 : 31)) throw new Error("Split mismatch");
      const ids = new Set(games.map((g: any) => g.id));
      const receipts = allocation.originalBodies.filter((r: any) => ids.has(r.gameId)).map((r: any) => {
        guard(); const raw = readFileSync(r.path); bodyReads++; bytes += raw.length;
        if (raw.length !== r.bytes || raw.length > 1024 * 1024 || sha(raw) !== r.sha256) throw new Error("Original hash/cap failed");
        return { url: r.url, capturedAt: r.capturedAt, bodySha256: r.sha256, rawBody: raw.toString("utf8") };
      });
      const normalized = assembleCurrentRosterNativeInputs({ ...scope, cutoffAt,
        games: games.map((g: any) => scopeGames.get(g.id)), receipts }, new Date(cutoffAt));
      return normalized;
    };
    const rowValues = (observation: any, appearance: any, goalie: boolean): Record<string, number | null> => {
      const p = observation.payload;
      if (!goalie) {
        const values = { ...appearance.targets, TIME_ON_ICE_PER_GAME: appearance.finalBoxscore.appearanceSeconds / 60 };
        const landing = p.derivedPowerPlayPoints?.landings.find((row: any) => row.rawRow.game_id === appearance.gameId);
        values.PP_POINTS = landing ? deriveNativePowerPlayPoints({ appearance, landing, nhlPlayerId: p.nhlPlayerId, cutoffAt }).powerPlayPoints : null;
        return Object.fromEntries(skaterKeys.map(key => [key, finite(values[key]) ? values[key] : null]));
      }
      const values: Record<string, number | null> = { SAVES_GOALIE: appearance.saves, GOALS_AGAINST_GOALIE: appearance.goalsAgainst,
        SHOTS_AGAINST_GOALIE: appearance.shotsAgainst, GOALIE_MINUTES: appearance.toiMinutes, WINS_GOALIE: null, SHUTOUTS_GOALIE: null };
      try { values.WINS_GOALIE = deriveNativeGoalieOutcomes({ appearance, nhlPlayerId: p.nhlPlayerId, cutoffAt }).winCredit; } catch { /* Known unsupported outcome remains null. */ }
      values.SHUTOUTS_GOALIE = deriveNativeGoalieShutoutCredit({ appearance, nhlPlayerId: p.nhlPlayerId, cutoffAt, summary: summaries.get(p.playerId) }).shutoutCredit;
      return values;
    };
    const training = loadSplit(true), predictions: any[] = [];
    for (const player of scope.roster) {
      guard(); const goalie = player.playerClass === "goalie", keys = goalie ? goalieKeys : skaterKeys;
      const observation = (goalie ? training.goalieVolume : training.skaters).find((o: any) => o.payload.playerId === player.playerId);
      const a: Record<string, number | null> = Object.fromEntries(keys.map(key => [key, null]));
      let b = { ...a }, support: Record<string, number> = {}, selectedGameIds: number[] = [];
      if (observation) {
        const p = observation.payload;
        const input = { ...p, cutoffAt, seasonId: scope.seasonId, sourceWatermark: observation.payload_hash };
        const selected = [...p.appearances].sort((a: any, b: any) => b.gameDate.localeCompare(a.gameDate) || b.gameId - a.gameId).slice(0, 20);
        selectedGameIds = selected.map((r: any) => r.gameId);
        const values = selected.map((row: any) => rowValues(observation, row, goalie));
        b = { ...b, ...arithmetic(values) };
        support = Object.fromEntries(keys.map(key => [key, values.filter(row => finite(row[key])).length]));
        if (goalie) {
          for (const fn of [buildNativeGoalieVolumeRates, buildNativeGoalieWinRates, buildNativeGoalieShutoutRates]) {
            producerCalls++;
            for (const target of fn({ ...input, shutoutSummary: summaries.get(player.playerId) }).targets) a[target.targetKey] = target.rate;
          }
          for (const key of keys) if (!finite(a[key])) b[key] = null;
          for (const key of keys) if (finite(a[key]) && Math.abs(a[key]! - b[key]!) > 1e-12) throw new Error("Goalie arithmetic identity mismatch");
        } else {
          producerCalls++;
          for (const target of buildNativeSkaterBaselineSnapshot(input).targets) a[target.targetKey] = target.ratePerAppearance;
          for (const key of keys) if (!finite(a[key])) b[key] = null;
        }
      }
      predictions.push({ playerId: player.playerId, playerClass: player.playerClass, a, b, selectedGameIds, support,
        unavailable: keys.filter(key => !finite(a[key]) || !finite(b[key])) });
    }
    if (producerCalls > 23) throw new Error("Producer bound exceeded");
    const predictionHash = save("frozen-predictions.json", { frozenAt: new Date().toISOString(), protocolHash, cutoffAt, predictions });
    const scoring = loadSplit(false), cases: any[] = [], omissions: any[] = [], ratioDiagnostics: any[] = [];
    for (const player of scope.roster) {
      const goalie = player.playerClass === "goalie", keys = goalie ? goalieKeys : skaterKeys;
      const observation = (goalie ? scoring.goalieVolume : scoring.skaters).find((o: any) => o.payload.playerId === player.playerId);
      const prediction = predictions.find(p => p.playerId === player.playerId);
      if (!observation) { omissions.push({ playerId: player.playerId, reason: "no_verified_scoring_appearance" }); continue; }
      if (goalie) {
        const appearances = observation.payload.appearances;
        const totals = appearances.reduce((sum: any, row: any) => ({ saves: sum.saves + row.saves,
          shots: sum.shots + row.shotsAgainst, ga: sum.ga + row.goalsAgainst, minutes: sum.minutes + row.toiMinutes }),
        { saves: 0, shots: 0, ga: 0, minutes: 0 });
        const ratios = (v: Record<string, number | null>) => ({
          SAVE_PERCENTAGE: finite(v.SAVES_GOALIE) && finite(v.SHOTS_AGAINST_GOALIE) && v.SHOTS_AGAINST_GOALIE > 0
            ? v.SAVES_GOALIE / v.SHOTS_AGAINST_GOALIE : null,
          GOALS_AGAINST_AVERAGE: finite(v.GOALS_AGAINST_GOALIE) && finite(v.GOALIE_MINUTES) && v.GOALIE_MINUTES > 0
            ? 60 * v.GOALS_AGAINST_GOALIE / v.GOALIE_MINUTES : null });
        ratioDiagnostics.push({ playerId: player.playerId, scoringAppearances: appearances.length,
          a: ratios(prediction.a), b: ratios(prediction.b), observed: ratios({ SAVES_GOALIE: totals.saves,
            SHOTS_AGAINST_GOALIE: totals.shots, GOALS_AGAINST_GOALIE: totals.ga, GOALIE_MINUTES: totals.minutes }),
          interpretation: "Ratios of coherent summed primitives; not expected realized ratios or separately scored forecast heads." });
      }
      for (const appearance of observation.payload.appearances) {
        const values = rowValues(observation, appearance, goalie);
        for (const key of keys) {
          const label = values[key], a = prediction.a[key], b = prediction.b[key];
          if (!finite(label) || !finite(a) || !finite(b)) { omissions.push({ playerId: player.playerId, gameId: appearance.gameId, key,
            reason: !finite(label) ? "unknown_label" : "no_paired_training_prediction" }); continue; }
          cases.push({ playerId: player.playerId, playerClass: player.playerClass, gameId: appearance.gameId, date: appearance.gameDate,
            key, label, a, b, squaredA: (label - a) ** 2, squaredB: (label - b) ** 2, absoluteA: Math.abs(label - a), absoluteB: Math.abs(label - b) });
        }
      }
    }
    const metric = (rows: any[]) => ({ n: rows.length, players: new Set(rows.map(r => r.playerId)).size,
      games: new Set(rows.map(r => r.gameId)).size, dates: new Set(rows.map(r => r.date)).size,
      ...Object.fromEntries(["squaredA", "squaredB", "absoluteA", "absoluteB"].map(k => [k, rows.length ? rows.reduce((s, r) => s + r[k], 0) / rows.length : null])) });
    const heads = Object.fromEntries([...skaterKeys, ...goalieKeys].map(key => {
      const rows = cases.filter(r => r.key === key), perPlayer = predictions.filter(p => (p.playerClass === "goalie" ? goalieKeys : skaterKeys).includes(key))
        .map(p => ({ playerId: p.playerId, ...metric(rows.filter(r => r.playerId === p.playerId)) }));
      const covered = perPlayer.filter(p => p.n > 0);
      const values = metric(rows);
      return [key, { ...values, mseDifferenceAminusB: values.n ? values.squaredA! - values.squaredB! : null,
        maeDifferenceAminusB: values.n ? values.absoluteA! - values.absoluteB! : null,
        perPlayer, macro: Object.fromEntries(["squaredA", "squaredB", "absoluteA", "absoluteB"]
        .map(k => [k, covered.length ? covered.reduce((s, row: any) => s + row[k], 0) / covered.length : null])) }];
    }));
    save("paired-cases.json", cases); save("omissions.json", { omissions, trainingCoverage: training.coverage, scoringCoverage: scoring.coverage });
    save("report.json", { protocolHash, predictionHash, status: "completed_exposed_development_only", heads, ratioDiagnostics,
      sources: { bodyReads, bytes }, producerCalls, coverage: { trainingGames: 29, scoringGames: 31, players: 19 },
      unsupported: ["scheduled_game_expectations", "participation", "pStart", "per_start_ability", "full_fantasy_points", "predictive_uncertainty"],
      unchangedProduction: true, originalAsOfReplay: false, endAt: new Date().toISOString(), elapsedMs: performance.now() - started });
    console.log(JSON.stringify({ status: "completed_exposed_development_only", bodyReads, bytes, producerCalls, pairedCases: cases.length, out }));
  } catch (error) {
    save("stopped.json", { status: "stopped_no_retry", error: error instanceof Error ? error.message : "unknown", bodyReads, bytes, producerCalls });
    throw error;
  }
}
