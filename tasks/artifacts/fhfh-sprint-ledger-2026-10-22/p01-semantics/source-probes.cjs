// Offline extraction of current expressions. Observations are not acceptance tests.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "../../../..");
const ts = require(path.join(root, "web/node_modules/typescript"));
const { format, parseISO, startOfDay } = require(path.join(root, "web/node_modules/date-fns"));
const pins = {};
function source(file) {
  const text = fs.readFileSync(path.join(root, file), "utf8");
  pins[file] = crypto.createHash("sha256").update(text).digest("hex");
  return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}
function find(tree, predicate) {
  let found;
  function visit(node) {
    if (!found && predicate(node)) found = node;
    if (!found) ts.forEachChild(node, visit);
  }
  visit(tree);
  assert.ok(found, "Expected source node missing");
  return found;
}
function initializer(tree, name) {
  return find(tree, n => ts.isVariableDeclaration(n) && n.name.getText() === name).initializer;
}
function evaluate(expression, globals = {}) {
  const compiled = ts.transpileModule(`globalThis.result = (${expression});`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const context = vm.createContext({ Date, format, parseISO, ...globals });
  vm.runInContext(compiled, context, { timeout: 1000 });
  return context.result;
}
const calendar = source("web/components/TeamScheduleCalendar/TeamScheduleCalendar.tsx");
const hook = source("web/hooks/useTeamSchedule.ts");
const header = source("web/hooks/useTeamStatsHeaderData.ts");
const game = {
  id: 2026020001, season: 20262027, gameDate: "2026-10-19", gameType: 2,
  homeTeam: { id: 22 }, awayTeam: { id: 6 }, homeTeamScore: 3, awayTeamScore: 2,
  gameState: "UNKNOWN", gameScheduleState: "OK",
};
const resultFunction = initializer(calendar, "getGameResult");
const parsedGameDate = evaluate(initializer(resultFunction, "gameDate").getText(), { game });
const resultFor = (rows = []) => evaluate(resultFunction.getText(), {
  useCallback: fn => fn, teamId: 22, wgoStats: rows, teamStats: rows,
  today: startOfDay(new Date("2026-10-22T12:00:00Z")),
});
const enriched = find(hook, n => ts.isBinaryExpression(n) && n.left.getText() === "nextGames" && n.right.getText().startsWith("baseGames.map"));
const enrichedGames = evaluate(enriched.right.getText(), {
  baseGames: [game], gameStatsData: [{ gameId: game.id, teamId: 22, score: 3 }, { gameId: game.id, teamId: 6, score: 2 }],
});
const typeProperty = find(hook, n => ts.isPropertyAssignment(n) && n.name.getText() === "gameType");
const scoreDisplay = initializer(calendar, "getScoreDisplay");
const renderScore = homeScore => evaluate(scoreDisplay.getText(), {
  game: { ...game, homeTeamScore: homeScore, awayTeamScore: 3 }, result: "loss", homeAway: "vs",
})();
const rwProperty = find(header, n => ts.isPropertyAssignment(n) && n.name.getText() === "regulation_wins");
const rows = [
  { date: "2026-10-17", games_played: 1, points: 2, wins: 1, losses: 0, ot_losses: 0 },
  { date: "2026-10-19", games_played: 3, points: 4, wins: 2, losses: 1, ot_losses: 0 },
];
console.log(JSON.stringify({
  node: process.version, timezone: process.env.TZ, source_pins: pins,
  observations: {
    dateOnly: { input: game.gameDate, joinedDay: format(parsedGameDate, "yyyy-MM-dd"), expected: "2026-10-19" },
    finality: { input: game.gameState, afterScoreEnrichment: enrichedGames[0].gameState,
      calendarResults: Object.fromEntries(["LIVE", "UNKNOWN", "FINAL", "FUT"].map(gameState => [gameState, resultFor()({ ...game, gameState })])) },
    missingType: { input: null, output: evaluate(typeProperty.initializer.getText(), { game: { type: null } }) },
    zeroHomeScore: { zero: renderScore(0), nonzeroControl: renderScore(1) },
    wgoGap: { assumedGrain: "synthetic cumulative", gamesBetweenObservations: 2, pointsBetweenObservations: 2, calendarResult: resultFor(rows)({ ...game, homeTeamScore: undefined, awayTeamScore: undefined }), perGameOutcomeEstablished: false },
    headerRw: { regulationAndOtWins: 25, outputRegulationWins: evaluate(rwProperty.initializer.getText(), { summary: { regulation_and_ot_wins: 25 } }) },
  },
  limits: "Source extraction with synthetic inputs only; no service, database, environment file, browser or application module loaded. Does not establish stored WGO grain or authoritative finality. Counts and outputs describe observations, not passing acceptance.",
}, null, 2));
