import { writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const here = path.dirname(fileURLToPath(import.meta.url));
const url = 'https://www.nhl.com/scores/htmlreports/20262027/GS020167.HTM';
const target = path.join(here, 'REPORT-RECEIPT.json');
try { await access(target); throw new Error('Receipt already exists; no retry'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
const r = { url, gameId: 2026020167, startedAt: new Date().toISOString(), requests: 0, retries: 0, maxRequests: 1, maxBytes: 2097152, timeoutMs: 5000, processTimeoutMs: 15000, status: 'prepared', admissionsChanged: false };
await writeFile(target, JSON.stringify(r, null, 2) + '\n');
try {
  r.requests = 1; r.status = 'dispatching'; await writeFile(target, JSON.stringify(r, null, 2) + '\n');
  const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(r.timeoutMs), headers: { Accept: 'text/html' } });
  r.httpStatus = res.status;
  const reader = res.body.getReader(), chunks = []; let count = 0;
  while (true) { const { done, value } = await reader.read(); if (done) break; count += value.length; if (count > r.maxBytes) { await reader.cancel(); throw new Error('2MiB limit exceeded'); } chunks.push(value); }
  const bytes = Buffer.concat(chunks); r.bytes = bytes.length; r.sha256 = createHash('sha256').update(bytes).digest('hex');
  await writeFile(path.join(here, 'REPORT-RAW.html'), bytes);
  if (!res.ok) throw new Error(`HTTP${res.status}; no retry`);
  r.status = 'captured-unadmitted';
  r.identityCheckPending = true;
} catch (e) { r.status = 'failed-no-retry'; r.error = String(e); if (e.cause) r.cause = String(e.cause); process.exitCode = 1; }
finally { r.finishedAt = new Date().toISOString(); await writeFile(target, JSON.stringify(r, null, 2) + '\n'); console.log(JSON.stringify(r)); }
