const http = require("node:http"), tls = require("node:tls");
const K = Symbol.for("undici.globalDispatcher.1");
const d = () => { const v = globalThis[K]; return v ? `${v.constructor?.name}` : "unset"; };
(async () => {
  console.log("getCACertificates:", typeof tls.getCACertificates, "setDefaultCACertificates:", typeof tls.setDefaultCACertificates, "default==bundled:", tls.getCACertificates("default").join("\n") === tls.rootCertificates.join("\n"));
  console.log("before any fetch:", d());
  const s = http.createServer((q, r) => r.end("ok")).listen(0, "127.0.0.1"); await new Promise(r => s.on("listening", r));
  const url = `http://127.0.0.1:${s.address().port}/`;
  await (await fetch(url)).text(); const first = globalThis[K]; console.log("after first fetch:", d());
  await (await fetch(url)).text(); console.log("same object after second fetch:", globalThis[K] === first);
  const undici = require(process.cwd() + "/node_modules/undici"); let used = false;
  const custom = new undici.Agent({ connect: { lookup: (...a) => { used = true; return require("node:dns").lookup(...a); } } });
  undici.setGlobalDispatcher(custom);
  console.log("after npm undici setGlobalDispatcher:", d(), "identity changed:", globalThis[K] !== first);
  try { await (await fetch(url)).text(); console.log("bundled fetch used the replaced dispatcher:", globalThis[K] === custom); } catch (e) { console.log("bundled fetch with custom dispatcher error:", e.message); }
  s.close(); process.exit(0);
})();
