// Real Node https/tls/net stack; every DNS answer is loopback, so no external traffic is possible.
const dns = require("node:dns");
const net = require("node:net");
const calls = [];
dns.lookup = (hostname, options, callback) => {
  calls.push({ hostname, options });
  (typeof options === "function" ? options : callback)(null, [{ address: "127.0.0.1", family: 4 }]);
};
const { fetchNhlProxyText } = require(process.argv[2]);
const target = new URL("https://api-web.nhle.com/v1/standings/now");
(async () => {
  const out = {};
  try { await fetchNhlProxyText(target); out.blocked = "UNEXPECTED SUCCESS"; }
  catch (e) { out.blocked = { message: e.message, type: e.type, code: e.code }; }
  out.blockedLookupCalls = calls.splice(0);
  const realCheck = net.BlockList.prototype.check;
  net.BlockList.prototype.check = () => false; // simulate a "public" answer that is really loopback
  try { await fetchNhlProxyText(target); out.pinned = "UNEXPECTED SUCCESS"; }
  catch (e) { out.pinned = { message: e.message, type: e.type, code: e.code }; }
  net.BlockList.prototype.check = realCheck;
  out.pinnedLookupCalls = calls.splice(0);
  console.log(JSON.stringify({ node: process.version, ...out }, null, 2));
})();
