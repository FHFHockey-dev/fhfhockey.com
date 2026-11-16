// Preload route (--require / NODE_OPTIONS): refuse non-loopback, then preinstall a global loopback dispatcher.
const net = require("node:net"), tls = require("node:tls"), fs = require("node:fs");
const c = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...a) { const f = a[0], h = typeof f === "object" ? f.host : a[1]; if (!["127.0.0.1", "localhost", "::1"].includes(h)) throw new Error("reviewer guard"); return c.apply(this, a); };
const cfg = JSON.parse(fs.readFileSync(process.env.REVIEW_CFG, "utf8"));
const { Agent, setGlobalDispatcher } = require("module").createRequire("/Users/tim/Code/fhfhockey.com/web/package.json")("undici");
setGlobalDispatcher(new Agent({ connect: (o, cb) => { const s = tls.connect({ host: "127.0.0.1", port: cfg.port, servername: o.servername || o.hostname, ca: fs.readFileSync(cfg.cert) }); s.once("secureConnect", () => cb(null, s)); s.once("error", cb); return s; } }));
