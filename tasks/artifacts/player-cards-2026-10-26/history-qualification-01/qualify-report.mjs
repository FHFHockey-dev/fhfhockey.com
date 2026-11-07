import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.resolve(here, '../../../../web/package.json'));
const { load } = require('cheerio');
const $ = load(readFileSync(path.join(here, 'REPORT-RAW.html'), 'utf8'));
$('script,style').remove();
const text = $('body').text().replace(/\s+/g, ' ').trim();
const landing = JSON.parse(readFileSync(path.join(here, 'LANDING-RAW.json'), 'utf8'));
assert.equal(landing.id, 2026020167);
assert.equal(landing.season, 20262027);
assert.equal(landing.gameType, 2);
assert.equal(landing.gameState, 'OFF');
assert.ok(text.includes('Game 0167 Final'));
assert.ok(text.includes('Friday, October 23, 2026'));
assert.ok(text.includes('TAMPA BAY LIGHTNING') && text.includes('COLORADO AVALANCHE'));
const times = /Start (\d{1,2}):(\d{2}) ([A-Z]+); End (\d{1,2}):(\d{2}) ([A-Z]+)/.exec(text);
assert.ok(times);
assert.equal(times[3], 'MDT'); assert.equal(times[6], 'MDT');
assert.equal(landing.venueTimezone, 'America/Denver');
assert.equal(landing.venueUTCOffset, '-06:00');

// This report omits AM/PM and seconds. These bounds are diagnostic disambiguation
// assumptions for review, not approved product policy or an exact-endedAt receipt.
const midnight = Date.parse(landing.gameDate + 'T00:00:00Z');
const scheduled = Date.parse(landing.startTimeUTC);
const localCandidates = (hour, minute, days) => days.flatMap(day => [0, 12].map(half => midnight + (day * 24 + Number(hour) % 12 + half + 6) * 3600000 + Number(minute) * 60000));
const starts = localCandidates(times[1], times[2], [0, 1]).filter(t => t >= scheduled && t - scheduled <= 6 * 3600000);
assert.equal(starts.length, 1);
const ends = localCandidates(times[4], times[5], [0, 1, 2]).filter(t => t >= starts[0] && t - starts[0] <= 12 * 3600000);
assert.equal(ends.length, 1);
const minuteStart = ends[0], minuteEndExclusive = ends[0] + 60000;
assert.equal(new Intl.DateTimeFormat('en-GB', { timeZone: landing.venueTimezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(minuteStart)), '21:58');
const cutoff = Date.parse('2026-10-24T00:00:00Z');
const result = {
  gameId: landing.id, identityMatches: true,
  reportUrl: 'https://www.nhl.com/scores/htmlreports/20262027/GS020167.HTM',
  reportGameDate: landing.gameDate, reportedLocalStart: '7:09 MDT', reportedLocalEnd: '9:58 MDT',
  timezoneEvidence: { venueTimezone: landing.venueTimezone, venueUTCOffset: landing.venueUTCOffset, scheduledStartUTC: landing.startTimeUTC },
  inferredActualStartMinuteUTC: new Date(starts[0]).toISOString(),
  inferredActualEndRangeUTC: { inclusive: new Date(minuteStart).toISOString(), exclusive: new Date(minuteEndExclusive).toISOString() },
  precision: 'minute; AM/PM inferred using the official scheduled evening start',
  assumptionsRequiringReview: ['Actual start no earlier than schedule and at most6hours later', 'Game end within12hours of actual start'],
  originalCutoff: new Date(cutoff).toISOString(),
  originalCutoffBeforeInferredStart: cutoff < starts[0], originalCutoffBeforeInferredEndRange: cutoff < minuteStart,
  exactEndSecondVerified: false, admissionChanged: false, liveActivation: false,
  conclusion: 'Official end-time evidence located for one game. Review precision/AM-PM conversion before admission. Do not substitute00seconds or ingestion time as exact end.'
};
writeFileSync(path.join(here, 'REPORT-QUALIFICATION.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
