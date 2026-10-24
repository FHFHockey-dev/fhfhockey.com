// Concurrency-1 guard for approved live checks: every counted local request (page or API) must start
// only after the previous one finished, and the total may not exceed the approved cap.
function createSerialGuard(cap) {
  let inFlight = null, started = 0;
  const violations = [], log = [];
  return {
    begin(kind, url) {
      if (inFlight) { violations.push({ type: "overlap", kind, url, while: inFlight.url, at: Date.now() }); return null; }
      if (started >= cap) { violations.push({ type: "cap", kind, url, cap, at: Date.now() }); return null; }
      started++;
      inFlight = { n: started, kind, url, startedAt: Date.now() };
      return inFlight;
    },
    end(token, details = {}) {
      if (!token || inFlight !== token) throw new Error("serial guard: end() without the matching begin()");
      log.push({ ...token, endedAt: Date.now(), ms: Date.now() - token.startedAt, ...details });
      inFlight = null;
    },
    get started() { return started; },
    get violations() { return violations.slice(); },
    get log() { return log.slice(); },
  };
}
module.exports = { createSerialGuard };
