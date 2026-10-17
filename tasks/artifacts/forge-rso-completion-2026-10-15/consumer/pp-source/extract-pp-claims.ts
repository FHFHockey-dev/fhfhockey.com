/** Offline metadata-only PP diagnostic. No network, database, model or publishing calls. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as cheerio from 'cheerio';
import { buildTeamDirectory, parseGameDayTweetsLinesPage } from '../../../../../web/lib/sources/lineupSourceIngestion';
import { interpretTweetUnits } from '../../../../../web/lib/sources/tweetInterpretation';
import { parseTweetOEmbedHtml, extractStatusUrlsFromText } from '../../../../../web/lib/sources/tweetLineupParsing';
import { teamsInfo } from '../../../../../web/lib/teamsInfo';

type Identity = { playerId: number; nhlPlayerId: number; teamId: number; fullName: string; lastName: string; position?: string };
const ORIGINAL = /^https:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/(?!GameDayLines\/)[A-Za-z0-9_]+\/status\/\d+$/i;
function publicationDay(label: string | null): string | null {
  const match = label?.match(/^([A-Z][a-z]+) (\d{1,2}), (\d{4})$/);
  if (!match) return null;
  const month = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(match[1].slice(0, 3));
  const day = `${match[3]}-${String(month + 1).padStart(2, '0')}-${match[2].padStart(2, '0')}`;
  return month >= 0 && Number.isFinite(Date.parse(day)) && new Date(day).toISOString().slice(0, 10) === day ? day : null;
}
export function extract(input: { kind: 'page' | 'oembed'; body: string; teamId: number; capturedAt: string;
  sourceUrl: string; originalTweetUrl?: string; ownedIds: number[]; directory: Identity[] }) {
  if (!Number.isFinite(Date.parse(input.capturedAt))) throw new Error('Invalid capture clock');
  const catalog = Object.values(teamsInfo).find(team => team.id === input.teamId);
  if (!catalog) throw new Error('Unknown club');
  const team = buildTeamDirectory([{ id: catalog.id, name: catalog.name, abbreviation: catalog.abbrev } as any])[0];
  const directory = input.directory.filter(row => row.teamId === team.id);
  const body = input.kind === 'oembed' ? JSON.parse(input.body).html : input.body;
  if (typeof body !== 'string') throw new Error('Missing original HTML');
  const root = cheerio.load(body);
  const feed = input.kind === 'page' ? parseGameDayTweetsLinesPage({ html: body, team, rosterEntries: directory, sourceUrl: input.sourceUrl }) : null;
  const claims: any[] = [], optional: string[] = [];
  root(input.kind === 'page' ? 'blockquote.tweet' : 'blockquote.twitter-tweet, blockquote.tweet').each((index, element) => {
    const fragment = root.html(element), parsed = parseTweetOEmbedHtml(fragment), text = parsed.text ?? '';
    if (!/\b(?:pp|power\s*play)\s*[12]\b/i.test(text)) return;
    // Reuse the feed's source-day parser; source day remains an interval, never an exact publication instant.
    const postedDay = publicationDay(parsed.postedLabel);
    if (input.kind === 'page' && !feed?.tweets[index]) return;
    if (input.kind === 'oembed' && (!input.originalTweetUrl || !ORIGINAL.test(input.originalTweetUrl)
      || parsed.sourceTweetUrl?.match(/\/status\/(\d+)/)?.[1] !== input.originalTweetUrl.match(/\/status\/(\d+)/)?.[1])) return;
    if (!postedDay || postedDay > input.capturedAt.slice(0, 10)) return;
    const interpreted = interpretTweetUnits(text, directory);
    const owned = new Set(input.ownedIds);
    const eligible = interpreted.units.filter(unit => unit.situation === 'pp' && unit.explicitNumber
      && (unit.number === 1 || unit.number === 2) && unit.complete && !unit.group);
    for (const unit of eligible) for (const player of unit.players) {
      if (!owned.has(player.playerId)) continue;
      const matches = directory.filter(row => row.playerId === player.playerId);
      if (matches.length !== 1) continue;
      const row = matches[0];
      claims.push({ playerId: row.playerId, nhlPlayerId: row.nhlPlayerId, teamId: row.teamId,
        role: `PP${unit.number}`, sourceUrl: input.sourceUrl, sourcePublicationDay: postedDay,
        originalPostedLabel: parsed.postedLabel, publicationPrecision: 'day', publishedAt: null,
        capturedAt: input.capturedAt, context: interpreted.context,
        classification: 'unqualified_complete_explicit_unit_claim', originalTweetUrl: input.originalTweetUrl ?? null,
        gameId: null, expiresAt: null, evidence: unit.evidence });
    }
    // Original citation only: never follow wrapper/t.co links or arbitrary URLs.
    const mentionsOwned = interpreted.units.some(unit => unit.players.some(player => owned.has(player.playerId)));
    if (mentionsOwned) {
      const links = root(element).find('a').map((_, a) => root(a).attr('href') ?? '').get();
      for (const url of [...links, ...extractStatusUrlsFromText(text)]) if (ORIGINAL.test(url)) optional.push(url);
    }
  });
  return { claims, optionalOriginalTweetUrl: [...new Set(optional)][0] ?? null,
    limitations: ['Only owned players emitted; complete-unit context resolved using approved metadata directory.',
      'Source day is not exact publication time. No synthetic game, expiry, legal eligibility or confirmation.',
      'Stale/conflicting/context-unknown claims require separate qualification; no forecast admission or absent-player inference.'] };
}
function selftest() {
  const names = ['Alpha One', 'Beta Two', 'Gamma Three', 'Delta Four', 'Epsilon Five'];
  const directory = names.map((fullName, i) => ({ playerId: i + 1, nhlPlayerId: i + 11, teamId: 14, fullName, lastName: fullName.split(' ')[1], position: 'C' }));
  const html = (date: string, text: string) => `<blockquote class="tweet"><p>${text}</p><a href="https://twitter.com/reporter/status/123">${date}</a></blockquote>`;
  const base = { kind: 'page' as const, teamId: 14, capturedAt: '2026-10-16T12:00:00Z', sourceUrl: 'https://www.gamedaytweets.com/lines?team=TBL', ownedIds: [1], directory };
  const text = `Today PP1: ${names.join(' - ')}`;
  const valid = extract({ ...base, body: html('Oct 16, 2026', text) });
  assert.equal(valid.claims.length, 1); assert.equal(valid.claims[0].role, 'PP1');
  assert.equal(valid.claims[0].publishedAt, null); assert.equal(valid.claims[0].sourcePublicationDay, '2026-10-16');
  assert.equal(valid.optionalOriginalTweetUrl, 'https://twitter.com/reporter/status/123');
  for (const [date, value] of [['', text], ['Oct 17, 2026', text], ['Oct 16, 2026', 'Alpha One scored a power-play goal'], ['Oct 16, 2026', 'PP1: Alpha One - Beta Two - Gamma Three'], ['Oct 16, 2026', 'PP1: Other One - Beta Two - Gamma Three - Delta Four - Epsilon Five']]) {
    assert.equal(extract({ ...base, body: html(date, value) }).claims.length, 0);
  }
  assert.equal(extract({ ...base, kind: 'oembed', body: JSON.stringify({ html: html('October 16, 2026', text.replace('PP1', 'PP2')) }), originalTweetUrl: 'https://twitter.com/reporter/status/123' }).claims[0].role, 'PP2');
  console.log('7 offline PP parser fixture checks passed');
}
if (require.main === module) {
  if (process.argv[2] === '--self-test') selftest();
  else {
    const input = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
    fs.writeFileSync(process.argv[3], JSON.stringify(extract({ ...input, body: fs.readFileSync(input.bodyPath, 'utf8') }), null, 2), { flag: 'wx', mode: 0o600 });
  }
}
