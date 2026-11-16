// Reviewer reproducer: loopback-only HTTPS server presenting a throwaway self-signed cert for api-web.nhle.com.
// Usage: node loopback-server.mjs <key.pem> <cert.pem> <CONVERSION.json> <portFile>
// Serves one synthetic final boxscore per scheduled game (one skater per side, 10:00 TOI). No real data.
import https from "node:https";
import { readFileSync, writeFileSync } from "node:fs";
const [keyPath, certPath, conversionPath, portFile] = process.argv.slice(2);
const facts = JSON.parse(readFileSync(conversionPath, "utf8")).scheduleFacts;
const byId = new Map(facts.games.map(g => [g.gameId, g]));
const side = (pid) => ({ forwards: [{ playerId: pid, toi: "10:00" }], defense: [], goalies: [] });
let served = 0;
const server = https.createServer({ key: readFileSync(keyPath), cert: readFileSync(certPath) }, (req, res) => {
  served++;
  const id = Number(/\/v1\/gamecenter\/(\d+)\/boxscore$/.exec(req.url)?.[1]), g = byId.get(id);
  if (!g) { res.statusCode = 404; return res.end("{}"); }
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify({ id, season: 20262027, gameType: 2, gameDate: facts.date, gameState: "OFF", gameScheduleState: "OK",
    awayTeam: { abbrev: g.away }, homeTeam: { abbrev: g.home }, playerByGameStats: { awayTeam: side(id - 2026020000), homeTeam: side(id - 2026010000) } }));
});
server.listen(0, "127.0.0.1", () => writeFileSync(portFile, String(server.address().port)));
setTimeout(() => { process.stdout.write(`served=${served}\n`); process.exit(0); }, 90_000);
