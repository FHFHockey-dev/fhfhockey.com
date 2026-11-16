// Offline classification after fresh source preparation has qualified a game.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { verify } = require('./apply-stored-repair.cjs');
globalThis.fetch = () => { throw new Error('Network disabled during stored comparison'); };
async function main() {
  const [, , beforeFile, preparedFile, resultFile] = process.argv;
  const before = JSON.parse(fs.readFileSync(beforeFile, 'utf8'));
  const prepared = JSON.parse(fs.readFileSync(preparedFile, 'utf8'));
  assert.equal(prepared.status, 'prepared_only');
  assert.equal(before.game.id, prepared.gameId);
  let result;
  try {
    assert.ok(before.manifest, 'No stored materialization receipt');
    const checks = await verify(before, prepared);
    result = { gameId: prepared.gameId, status: 'already_current_no_write', checks };
  } catch (error) {
    if (!(error instanceof assert.AssertionError)) throw error;
    result = { gameId: prepared.gameId, status: 'qualified_candidate_needs_repair', reason: error.message.slice(0, 1000) };
  }
  result.checkedAt = new Date().toISOString();
  fs.writeFileSync(resultFile, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ gameId: result.gameId, status: result.status }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
