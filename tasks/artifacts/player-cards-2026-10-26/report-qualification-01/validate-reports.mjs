// Offline validation of the exact approved capture. No network or admission writes.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.resolve(here, '../../../../web/package.json'));
const { load } = require('cheerio');
const base = path.resolve(here, '..');
const read = p => readFileSync(path.join(base, p));
const json = p => JSON.parse(read(p));
const sha = b => createHash('sha256').update(b).digest('hex');
const approval = json('date-finality-01/APPROVED-REPORT-READ-20261026.json');
const receipt = json('date-finality-01/PUBLIC-REPORT-BATCH-RECEIPT.json');
assert.deepEqual(receipt.results.map(r => r.gameId), approval.gameIds);
assert.equal(receipt.status, 'captured-unadmitted');
assert.equal(receipt.concurrency, 1); assert.equal(receipt.retries, 0);
assert.ok(Date.parse(receipt.finishedAt) - Date.parse(receipt.startedAt) < 50000);
assert.ok(receipt.totalBytes <= 2097152);
assert.equal(receipt.totalBytes, receipt.results.reduce((sum, r) => sum + r.bytes, 0));
const schedule = json('history-qualification-01/SCHEDULE-RAW.json');
const history = json('resume-reconciliation-01/HISTORY-RAW.json');
const dateMap = json('history-qualification-01/GAME-DATE-MAP.json');
const priorReceipt = json('history-qualification-01/REPORT-RECEIPT.json');
const prior = { gameId: 2026020167, url: 'https://www.nhl.com/scores/htmlreports/20262027/GS020167.HTM', ...priorReceipt };
const rows = [];
const cutoff = '2026-10-24T00:00:00Z';
const teamName = t => `${t.placeName.default} ${t.commonName.default}`.toUpperCase();
const formatParts = (time, timezone) => Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
  timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZoneName: 'short',
}).formatToParts(new Date(time)).map(p => [p.type, p.value]));
for (const capture of [...receipt.results, prior]) {
  const game = schedule.games.find(g => g.id === capture.gameId);
  const source = history.gameLog.find(g => g.gameId === capture.gameId);
  const binding = dateMap.mapping.find(g => g.gameId === capture.gameId);
  assert.ok(game && source && binding);
  assert.equal(game.season, 20262027); assert.equal(game.gameType, 2);
  assert.equal(source.teamAbbrev, 'TBL'); assert.equal(game.gameDate, source.gameDate);
  const filename = capture.gameId === 2026020167 ? 'history-qualification-01/REPORT-RAW.html' : `date-finality-01/reports/GS${String(capture.gameId).slice(4)}.html`;
  const bytes = read(filename), digest = sha(bytes);
  assert.equal(bytes.length, capture.bytes); assert.equal(digest, capture.sha256);
  assert.equal(capture.httpStatus ?? capture.status, 200);
  assert.ok(bytes.length <= 262144);
  const $ = load(bytes.toString('utf8')); $('script,style').remove();
  const text = $('body').text().replace(/\s+/g, ' ').trim();
  const day = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(game.gameDate + 'T00:00:00Z'));
  assert.ok(text.includes(day), `Report date ${capture.gameId}`);
  assert.ok(text.includes(`Game ${String(capture.gameId).slice(6)} Final`), `Final identity ${capture.gameId}`);
  assert.ok(text.includes(teamName(game.awayTeam)) && text.includes(teamName(game.homeTeam)), `Team identity ${capture.gameId}`);
  const teamOrdinal = /TAMPA BAY LIGHTNING\s*Game\s+(\d+)/.exec(text.split('SCORING SUMMARY')[0]);
  assert.ok(teamOrdinal, `Team season ordinal ${capture.gameId}`);
  assert.ok(/^\d+:\d{2}$/.test(source.toi) && Number(source.toi.split(':')[1]) < 60 && source.toi !== '00:00', `Observed participation ${capture.gameId}`);
  const clock = /Start (\d{1,2}):(\d{2}) ([A-Z]+); End (\d{1,2}):(\d{2}) ([A-Z]+)/.exec(text);
  assert.ok(clock, `Report clocks ${capture.gameId}`);
  assert.ok([Number(clock[1]), Number(clock[4])].every(h => h >= 1 && h <= 12));
  assert.ok([Number(clock[2]), Number(clock[5])].every(m => m >= 0 && m < 60));
  const offset = /^([+-])(\d{2}):(\d{2})$/.exec(game.venueUTCOffset); assert.ok(offset);
  const offsetMs = (offset[1] === '-' ? -1 : 1) * (Number(offset[2]) * 60 + Number(offset[3])) * 60000;
  const midnight = Date.parse(game.gameDate + 'T00:00:00Z') - offsetMs;
  const scheduled = Date.parse(game.startTimeUTC);
  const candidates = (hour, minute, days) => days.flatMap(day => [0, 12].map(half => midnight + (day * 24 + Number(hour) % 12 + half) * 3600000 + Number(minute) * 60000));
  // Explicit diagnostic bounds, not silently adopted scheduling/business facts.
  const starts = candidates(clock[1], clock[2], [0, 1]).filter(t => t >= scheduled && t - scheduled <= 6 * 3600000);
  const ends = starts.length === 1 ? candidates(clock[4], clock[5], [0, 1, 2]).filter(t => t >= starts[0] && t - starts[0] <= 12 * 3600000) : [];
  assert.equal(starts.length, 1, `Start ambiguity ${capture.gameId}`);
  assert.equal(ends.length, 1, `End ambiguity ${capture.gameId}`);
  const startParts = formatParts(starts[0], game.venueTimezone), endParts = formatParts(ends[0], game.venueTimezone);
  assert.equal(startParts.timeZoneName, clock[3]); assert.equal(endParts.timeZoneName, clock[6]);
  assert.equal(Number(startParts.minute), Number(clock[2])); assert.equal(Number(startParts.hour) % 12, Number(clock[1]) % 12);
  assert.equal(Number(endParts.minute), Number(clock[5])); assert.equal(Number(endParts.hour) % 12, Number(clock[4]) % 12);
  const endMinute = { startInclusive: new Date(ends[0]).toISOString(), endExclusive: new Date(ends[0] + 60000).toISOString(), timezone: game.venueTimezone, clockBasis: 'schedule-bound-12h' };
  rows.push({
    gameId: game.id, playerId: 8476453, season: game.season, gameType: 'regular',
    date: binding.utcStartDate, sourceDate: source.gameDate, reportUrl: capture.url,
    reportSha256: digest, reportBytes: bytes.length, identityDateTeamsFinalMatch: true,
    reportedTeamSeasonGameOrdinal: Number(teamOrdinal[1]), observedPlayerToi: source.toi,
    reportedStart: `${clock[1]}:${clock[2]} ${clock[3]}`, reportedEnd: `${clock[4]}:${clock[5]} ${clock[6]}`,
    scheduledStartUTC: game.startTimeUTC, candidateStartMinuteUTC: new Date(starts[0]).toISOString(), candidateEndMinute: endMinute,
    wholeEndMinuteBeforeCutoff: Date.parse(endMinute.endExclusive) <= Date.parse(cutoff),
    exactEndSecondVerified: false, admissionChanged: false,
  });
}
const regular = schedule.games.filter(g => g.season === 20262027 && g.gameType === 2);
const completed = regular.filter(g => ['OFF', 'FINAL'].includes(g.gameState));
const historyIds = new Set(history.gameLog.map(g => g.gameId));
assert.equal(historyIds.size, history.gameLog.length);
assert.ok(completed.every(g => historyIds.has(g.id)));
assert.ok(history.gameLog.every(g => completed.some(s => s.id === g.gameId)));
assert.deepEqual(rows.filter(r => r.wholeEndMinuteBeforeCutoff).map(r => r.reportedTeamSeasonGameOrdinal).sort((a,b) => a-b), [1,2,3,4,5,6,7,8,9]);
assert.equal(rows.find(r => r.gameId === 2026020167).reportedTeamSeasonGameOrdinal, 10);
const result = {
  playerId: 8476453, season: 20262027, cutoff, reports: rows,
  capturedBatchRequests: receipt.results.length, capturedBatchBytes: receipt.totalBytes,
  matchedReports: rows.length, wholeEndMinutesBeforeCutoff: rows.filter(r => r.wholeEndMinuteBeforeCutoff).length,
  observedCoverage: { capturedRegularScheduleRows: regular.length, capturedCompletedTeamGames: completed.length, capturedPlayerHistoryRows: history.gameLog.length, identicalCompletedGameIdSets: true, observedOmissions: [], reportTeamOrdinalsBeforeCutoff: [1,2,3,4,5,6,7,8,9], nextTeamOrdinalAfterCutoff: 10, observedPositivePlayerToiInAllNine: true, historyCompletenessAdmitted: false },
  clockAssumptionsRequiringIndependentReview: ['Actual start no earlier than schedule and at most6hours later', 'Game end within12hours of actual start'],
  sourcePins: ['history-qualification-01/SCHEDULE-RAW.json', 'resume-reconciliation-01/HISTORY-RAW.json', 'history-qualification-01/GAME-DATE-MAP.json'].map(p => ({ path: p, sha256: sha(read(p)) })),
  admissionsChanged: false, liveActivation: false, premiumActivation: false,
  conclusion: 'Ten official report identities and minute clocks match captured schedule/history. Nine end minutes precede the cutoff; game167 ends after it. Conversion remains explicitly schedule-bound; this packet is not an admission, exact-second proof, metric definition or league ranking population.',
};
writeFileSync(path.join(here, 'REPORT-VALIDATION.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
