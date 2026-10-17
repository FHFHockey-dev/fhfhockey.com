/** One fixed, owner-approved investigation; dates are an assumption, never provider evidence. */
export const DIAGNOSTIC_SCOPE = {
  provider: "yahoo", leagueName: "2026-27 FHFH", teamName: "FHFH TJ",
  seasonId: 20262027, startDate: "2026-10-12", endDate: "2026-10-18",
  horizonStatus: "owner_working_assumption", timeZone: null,
} as const;

export function diagnosticLocalOnly(environment: string | undefined, host: string | undefined, peer: string | undefined) {
  return environment === "development" && ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(peer ?? "") && /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host ?? "");
}

export function diagnosticHtml(storageKey: string, nonce: string) {
  const config = JSON.stringify({ storageKey, scope: DIAGNOSTIC_SCOPE }).replace(/</g, "\\u003c");
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>RSO baseline diagnostic</title>
<body><main><h1>RSO baseline diagnostic</h1>
<p>Local preparation only. Run only after approval for this exact origin and scope. This page does not open the optimizer.</p>
<p>2026-27 FHFH · FHFH TJ · October 12–18, 2026 (working assumption). Provider dates and timezone may remain unknown.</p>
<p>One application GET, at most five sequential backend reads. No refresh, retry, save or restore. The result is a sanitized summary, not a restorable backup.</p>
<label><input id="approved" type="checkbox"> I have approval to run this exact read-only scope.</label>
<button id="run" type="button">Read baseline once</button>
<p id="status" role="status">Not run. No account requests made.</p><pre id="report"></pre>
<script nonce="${nonce}">
(() => {
  const config = ${config};
  const button = document.getElementById('run');
  const status = document.getElementById('status');
  const output = document.getElementById('report');
  let used = false;
  button.addEventListener('click', async () => {
    if (used || !document.getElementById('approved').checked) return;
    used = true; button.disabled = true;
    const result = { scope: config.scope, startedAt: new Date().toISOString(), completedAt: null,
      applicationRequests: 0, backendReads: null, status: 'blocked', reason: 'normal_session_unavailable', data: null };
    const finish = () => { result.completedAt = new Date().toISOString(); status.textContent = result.status + ': ' + result.reason; output.textContent = JSON.stringify(result, null, 2); };
    try {
      // Same exact project key as the normal auth client. Never initialize its auto-refreshing singleton.
      const session = JSON.parse(localStorage.getItem(config.storageKey) || 'null');
      if (!session || typeof session.access_token !== 'string' || !session.access_token ||
          typeof session.expires_at !== 'number' || session.expires_at * 1000 <= Date.now() + 60000 ||
          !session.user || typeof session.user.id !== 'string') { finish(); return; }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      try {
        result.applicationRequests = 1;
        const response = await fetch('/api/v1/roster-schedule-optimizer/diagnostic-context', {
          method: 'GET', headers: { Authorization: 'Bearer ' + session.access_token },
          credentials: 'omit', cache: 'no-store', redirect: 'error', signal: controller.signal
        });
        result.httpStatus = response.status;
        const report = await response.json();
        // Server emits an allowlisted report; never print thrown errors, headers or session objects.
        if (report.kind !== 'rso-readonly-diagnostic-v1' || report.principalId && report.principalId !== session.user.id) {
          result.reason = 'unexpected_response'; finish(); return;
        }
        result.backendReads = report.backendReads;
        result.status = report.status;
        result.reason = report.reason;
        result.data = report;
      } finally { clearTimeout(timeout); }
    } catch { result.reason = 'read_failed_or_session_unavailable'; }
    finish();
  });
})();
</script></main></body></html>`;
}
