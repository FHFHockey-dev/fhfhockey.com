const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const file = '/Users/tim/Code/fhfhockey.com/tasks/artifacts/schedule-refresh-recurring-2026-10-15/verify-offline.cjs';
// Reuse only the synthetic VM fixture. No production import/transport/authority.
let text = fs.readFileSync(file, 'utf8').split("test('selected Oct 12")[0];
const needle = "return { abortSignal: async signal => ({ error: options.writeError ?? null }) };";
assert.equal(text.split(needle).length, 2);
text = text.replace(needle, "return { abortSignal: async signal => options.onCommit ? options.onCommit(rows, signal) : ({ error: options.writeError ?? null }) };");
const moduleFixture = { exports: {} };
vm.runInThisContext(`(function(require,module,exports,__dirname){${text}\nmodule.exports={fixture,game};})`, { filename: file })(createRequire(file), moduleFixture, moduleFixture.exports, path.dirname(file));
const { fixture, game } = moduleFixture.exports;
test('a delayed earlier recurring observation cannot overwrite a newer committed scope', async () => {
  let releaseEarlier, reachedEarlier, cache;
  const earlierBlocked = new Promise(resolve => reachedEarlier = resolve);
  const canCommitEarlier = new Promise(resolve => releaseEarlier = resolve);
  const earlier = fixture({ now: '2026-10-16T12:00:00Z', games: [game()], onCommit: async rows => {
    reachedEarlier(); await canCommitEarlier; cache = structuredClone(rows); return { error: null };
  } });
  const later = fixture({ now: '2026-10-16T12:00:01Z', games: [{ ...game(), gameState: 'LIVE' }],
    onCommit: async rows => { cache = structuredClone(rows); return { error: null }; } });
  const pendingEarlier = earlier.invoke();
  await earlierBlocked;
  const laterResult = await later.invoke();
  const observedLaterClock = cache[0].fetched_at;
  assert.equal(laterResult.statusCode, 200);
  releaseEarlier();
  const earlierResult = await pendingEarlier;
  assert.equal(earlierResult.statusCode, 200);
  assert.equal(cache[0].game_status, 'LIVE', 'older FUT scope must not replace the committed LIVE scope');
  assert.equal(cache[0].fetched_at, observedLaterClock);
});
