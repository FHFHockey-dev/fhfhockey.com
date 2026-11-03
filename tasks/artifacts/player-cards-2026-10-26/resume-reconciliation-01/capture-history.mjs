import { writeFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
const here = path.dirname(fileURLToPath(import.meta.url));
const url = 'https://api-web.nhle.com/v1/player/8476453/game-log/20262027/2';
const receiptPath = path.join(here, 'HISTORY-READ-RECEIPT.json');
try { await access(receiptPath); throw new Error('This one-time request already has a receipt; do not retry'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const receipt = { startedAt: new Date().toISOString(), url, method: 'GET', requests: 0, maxRequests: 1, concurrency: 1, retries: 0, maxRows: 100, maxBytes: 2097152, requestTimeoutMs: 5000, processTimeoutMs: 15000, status: 'prepared', admissionsChanged: false };
await writeFile(receiptPath, JSON.stringify(receipt, null, 2) + '\n');
try {
  receipt.requests = 1;
  await writeFile(receiptPath, JSON.stringify({ ...receipt, status: 'dispatching' }, null, 2) + '\n');
  const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(5000), headers: { Accept: 'application/json' } });
  receipt.httpStatus = response.status;
  const reader = response.body.getReader(), chunks = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.length;
    if (size > receipt.maxBytes) { await reader.cancel(); throw new Error('Response exceeds2MiB; no retry'); }
    chunks.push(value);
  }
  const bytes = Buffer.concat(chunks);
  await writeFile(path.join(here, 'HISTORY-RAW.json'), bytes);
  receipt.bytes = bytes.length; receipt.sha256 = createHash('sha256').update(bytes).digest('hex');
  if (!response.ok) throw new Error(`HTTP${response.status}; response retained; no retry`);
  const body = JSON.parse(bytes.toString('utf8'));
  if (!Array.isArray(body.gameLog) || body.gameLog.length > receipt.maxRows) throw new Error('Missing gameLog or more than100rows; no retry');
  receipt.rows = body.gameLog.length;
  receipt.responseKeys = Object.keys(body);
  receipt.status = 'captured-unadmitted';
} catch (error) {
  receipt.status = 'failed-no-retry'; receipt.error = String(error);
  if (error.cause) receipt.cause = String(error.cause);
  process.exitCode = 1;
} finally {
  receipt.finishedAt = new Date().toISOString();
  await writeFile(receiptPath, JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify(receipt));
}
