/** Shared by the hosted one-date route and the separately pinned local acquisition. */
import { X509Certificate } from "node:crypto";
import { request } from "node:https";
import { performance } from "node:perf_hooks";
import { rootCertificates } from "node:tls";

export const BUDGET = Object.freeze({ maxGames: 16, perRequestTimeoutMs: 15000, totalMs: 120000, maxBodyBytes: 4 * 1024 * 1024, spacingMs: 1000, retries: 0 });
const host = "api-web.nhle.com";
export const officialUrl = id => `https://${host}/v1/gamecenter/${id}/boxscore`;
export const liveRoots = () => [...rootCertificates];
function need(ok, code) { if (!ok) throw Object.assign(new Error(code), { code }); }

// Verify the actual leaf, its identity, validity intervals and signature chain against the enumerated roots.
// Each operation demands a fresh full handshake, so there is no inferred certificate from an earlier game.
export function verifyOfficialTLS(observed, roots, when) {
  need(observed?.servername === host && observed.authorized === true && observed.authorizationError === null
    && observed.channel === "https.ClientRequest:secureConnect" && observed.sessionReused === false && observed.connectionReused === false
    && ["TLSv1.2", "TLSv1.3"].includes(observed.protocol) && typeof observed.cipher === "string" && observed.cipher.length > 0
    && Array.isArray(observed.chainDER) && observed.chainDER.length > 0 && observed.chainDER.length <= 10, "official_tls_observation_invalid");
  const chain = observed.chainDER.map(der => {
    need(typeof der === "string" && der.length <= 32768 && /^[A-Za-z0-9+/]+=*$/.test(der), "official_certificate_invalid");
    const certificate = new X509Certificate(Buffer.from(der, "base64"));
    need(Date.parse(certificate.validFrom) <= when && when <= Date.parse(certificate.validTo), "official_certificate_time");
    return certificate;
  });
  need(chain[0].checkHost(host) && chain[0].fingerprint256 === observed.peerFingerprint256, "official_certificate_identity");
  for (let i = 1; i < chain.length; i++) need(chain[i].ca && chain[i-1].checkIssued(chain[i]) && chain[i-1].verify(chain[i].publicKey), "official_certificate_chain");
  const top = chain.at(-1);
  need(roots.some(pem => {
    const ca = new X509Certificate(pem);
    return ca.ca && Date.parse(ca.validFrom) <= when && when <= Date.parse(ca.validTo) &&
      (top.fingerprint256 === ca.fingerprint256 || (top.checkIssued(ca) && top.verify(ca.publicKey)));
  }), "official_certificate_untrusted");
}

export function getBox(url, journalWall, journalMono, runWall, runMono, fixture) {
  return new Promise((resolveGet, reject) => {
    const endpoint = new URL(url), roots = fixture ? [fixture.ca] : liveRoots();
    need(/^https:\/\/api-web\.nhle\.com\/v1\/gamecenter\/202602\d{4}\/boxscore$/.test(url), "official_endpoint_invalid");
    if (fixture) need(Number.isSafeInteger(fixture.port) && fixture.port > 0 && fixture.port <= 65535 && typeof fixture.ca === "string", "official_fixture_parameters");
    let observation, writes = 0;
    const requestOptions = { method: "GET", agent: false, ca: roots, rejectUnauthorized: true, servername: host,
      headers: { Host: host, Accept: "application/json", "Accept-Encoding": "identity", Connection: "close" },
      // A fixture can only connect to numeric loopback. It can never route to a provider.
      ...(fixture ? { hostname: "127.0.0.1", port: fixture.port } : {}) };
    // The journal and its directory have been fsynced. Re-read both clocks at
    // the actual outbound boundary; journaling consumes the original operation budget.
    const dispatched = Date.now(), dispatchedMono = performance.now();
    const wallDeadline = journalWall + BUDGET.perRequestTimeoutMs, monoDeadline = journalMono + BUDGET.perRequestTimeoutMs;
    need(dispatched >= journalWall && dispatched < wallDeadline && dispatchedMono >= journalMono && dispatchedMono < monoDeadline, "official_request_deadline");
    need(dispatched + BUDGET.perRequestTimeoutMs <= runWall + BUDGET.totalMs
      && dispatchedMono + BUDGET.perRequestTimeoutMs <= runMono + BUDGET.totalMs, "official_acquisition_deadline");
    const req = request(url, requestOptions, response => {
      const chunks = []; let size = 0;
      const fail = error => { reject(error); req.destroy(); response.destroy(); };
      try {
        need(response.statusCode === 200 && !response.headers.location && ["identity", undefined].includes(response.headers["content-encoding"])
          && req.method === "GET" && req.path === endpoint.pathname && req.getHeader("host") === host
          && writes === 1 && observation, "official_transport_response_invalid");
      } catch (e) { fail(e); return; }
      response.on("data", chunk => {
        size += chunk.length;
        if (size > BUDGET.maxBodyBytes) { fail(new Error("official_body_limit")); return; }
        chunks.push(chunk);
      });
      response.once("aborted", () => fail(new Error("official_incomplete_body")));
      response.once("error", fail);
      response.once("end", () => {
        if (!response.complete || !size) { fail(new Error("official_incomplete_body")); return; }
        resolveGet({ body: Buffer.concat(chunks), tls: observation, writes, httpStatus: response.statusCode, dispatchedAtUTC: new Date(dispatched).toISOString() });
      });
    });
    // Hard timeout covers resolution, handshake, headers and body, including a stalled stream.
    const timer = setTimeout(() => req.destroy(new Error("official_request_deadline")), Math.max(1, Math.min(wallDeadline - Date.now(), monoDeadline - performance.now())));
    req.once("close", () => clearTimeout(timer));
    req.once("error", reject);
    req.once("finish", () => { writes++; });
    req.once("socket", socket => socket.once("secureConnect", () => {
      try {
        const chainDER = [], seen = new Set(); let cert = socket.getPeerCertificate(true);
        while (cert?.raw && !seen.has(cert.fingerprint256)) {
          need(chainDER.length < 10, "official_certificate_chain_length");
          seen.add(cert.fingerprint256); chainDER.push(cert.raw.toString("base64")); cert = cert.issuerCertificate;
        }
        observation = { channel: "https.ClientRequest:secureConnect", servername: socket.servername, authorized: socket.authorized,
          authorizationError: socket.authorizationError || null, protocol: socket.getProtocol(), cipher: socket.getCipher()?.name,
          sessionReused: socket.isSessionReused(), connectionReused: req.reusedSocket === true, peerFingerprint256: socket.getPeerCertificate().fingerprint256, chainDER };
        verifyOfficialTLS(observation, roots, Date.now());
      } catch (error) { req.destroy(error); }
    }));
    req.end();
  });
}
