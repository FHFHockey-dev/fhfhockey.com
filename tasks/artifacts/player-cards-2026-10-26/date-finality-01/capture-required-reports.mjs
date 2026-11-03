import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
const here = path.dirname(fileURLToPath(import.meta.url));
const target = path.join(here, 'PUBLIC-REPORT-BATCH-RECEIPT.json');
try { await access(target); throw new Error('Batch receipt exists; no automatic retry'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
const map = JSON.parse(await readFile(path.join(here, '../history-qualification-01/GAME-DATE-MAP.json'), 'utf8'));
const games = map.mapping.filter(g => g.startTimeUTC < '2026-10-24T00:00:00Z');
if (games.length !== 9 || new Set(games.map(g => g.gameId)).size !== 9) throw new Error('Unexpected bounded game set');
const receipt = { startedAt: new Date().toISOString(), maxRequests: 9, concurrency: 1, retries: 0, perRequestTimeoutMs: 5000, overallProcessTimeoutMs: 50000, perResponseByteCap: 262144, totalByteCap: 2097152, results: [], totalBytes: 0, status: 'prepared', admissionsChanged: false };
await mkdir(path.join(here, 'reports'), { recursive: true });
await writeFile(target, JSON.stringify(receipt, null, 2) + '\n');
try {
  for (const game of games) {
    const suffix = String(game.gameId).slice(4);
    const url = `https://www.nhl.com/scores/htmlreports/20262027/GS${suffix}.HTM`;
    const item = { gameId: game.gameId, url, startedAt: new Date().toISOString(), status: 'dispatching' };
    receipt.results.push(item); await writeFile(target, JSON.stringify(receipt, null, 2) + '\n');
    const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(5000), headers: { Accept: 'text/html' } });
    item.httpStatus = response.status;
    const reader = response.body.getReader(), chunks = []; let size = 0;
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.length;
      if (size > receipt.perResponseByteCap || receipt.totalBytes + size > receipt.totalByteCap) { await reader.cancel(); throw new Error('Report byte cap exceeded'); }
      chunks.push(value);
    }
    const bytes = Buffer.concat(chunks); item.bytes = bytes.length; receipt.totalBytes += bytes.length;
    item.sha256 = createHash('sha256').update(bytes).digest('hex');
    await writeFile(path.join(here, 'reports', `GS${suffix}.html`), bytes);
    if (!response.ok) throw new Error(`HTTP${response.status} for ${game.gameId}; stop without retry`);
    item.status = 'captured-unadmitted'; item.finishedAt = new Date().toISOString();
    await writeFile(target, JSON.stringify(receipt, null, 2) + '\n');
  }
  receipt.status = 'captured-unadmitted';
} catch (e) { receipt.status = 'stopped-no-retry'; receipt.error = String(e); process.exitCode = 1; }
finally { receipt.finishedAt = new Date().toISOString(); await writeFile(target, JSON.stringify(receipt, null, 2) + '\n'); console.log(JSON.stringify(receipt)); }
