import { Worker, isMainThread } from "node:worker_threads"; import { channel } from "node:diagnostics_channel"; import https from "node:https"; import fs from "node:fs";
if (isMainThread) {
  const dir = process.argv[2];
  const server = https.createServer({ key: fs.readFileSync(dir + "/key.pem"), cert: fs.readFileSync(dir + "/cert.pem") }, (q, r) => { q.resume(); q.on("end", () => r.end("x")); });
  await new Promise(r => server.listen(0, "127.0.0.1", r)); const O = `https://localhost:${server.address().port}`;
  let main = 0; channel("undici:client:sendHeaders").subscribe(() => main++);
  const w = new Worker(new URL(import.meta.url), { workerData: O });
  const workerSaw = await new Promise(res => w.once("message", res));
  const before = main; await fetch(O + "/main").then(r => r.text());
  console.log(JSON.stringify({ mainSawDuringWorker: before, mainSawOwn: main - before, workerSaw }));
  server.close(); process.exit(0);
} else {
  const { workerData, parentPort } = await import("node:worker_threads");
  let n = 0; channel("undici:client:sendHeaders").subscribe(() => n++);
  await fetch(workerData + "/w").then(r => r.text()); parentPort.postMessage(n);
}
