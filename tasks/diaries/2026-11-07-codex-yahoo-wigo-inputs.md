# Yahoo / WiGO input diagnosis

- Scope: diagnose Yahoo ownership unavailability and WiGO historical missing identity failures; apply bounded local fixes only when supported. No deployments, production writes, cron report edits, or goalie/FORGE changes.
- Where: canonical `/Users/tim/Code/fhfhockey.com`, `octoberBranch`; concurrent work preserved.
- State: loaded repository instructions and inspecting nearest code/tests. Parent evidence: Yahoo 1610 profiles / 579 ownership values / 1031 unavailable; WiGO 33 historical null gameID failures / 953 successes.
- Next: establish input semantics and defect boundaries, coordinate ownership with Astra, then focused regression verification.
- Blockers/approvals: no production repair/deployment authority in this lane.

## Checkpoint: cause classified, no runtime change warranted

- Yahoo: current writer treats absent `percent_owned.value` as unavailable, never zero. Existing `1606/1027` regression represents the same 579-observed pattern. Transport/persistence succeeds while ownership remains incomplete; sheet export is correctly withheld. Parent audit evidence for November 7: 1610 profiles, 579 observations, 1031 missing values, zero failed/provider-omitted/deferred rows. No additional Yahoo provider call made in this lane.
- WiGO: bounded read-only SQL confirmed November 7 08:51:30 audit: 986 listed, 953 processed, 1906 writes, 33 missing-identity rejects. All 33 have positive current/last-season totals and legitimately belong to the active cohort. Their last-20 frames contain 273 null-game-ID rows across 184 dates, 2016-11-23 through 2023-04-14. All 273 also lack team and opponent; none lacks season. Zero exact schedule matches are possible from these columns. No false active-cohort inclusion was found.
- Current WGO ingestion already resolves and validates game identity. Migration `20260814020808_harden_wgo_game_identity.sql` makes identity checks NOT VALID, intentionally retaining legacy rows. The WiGO guard and cross-season last-20 contract are deliberate. Filtering away those old games or weakening the guard would hide incomplete evidence, not repair it.
- Checks: `npm test -- --run __tests__/pages/api/v1/db/update-yahoo-players.route.test.ts __tests__/pages/api/v1/db/calculate-wigo-stats.test.ts lib/integrations/yahoo/writerPermissions.test.ts` passed 3 files / 97 tests. No typecheck/build needed because no runtime source changed.
- External usage: Supabase project listing and four bounded read-only SQL queries (first audit lookup returned no rows because the job name required its full route); no writes, no endpoint invocations, no providers, no deployment/build.
- Handoff: Astra and parent informed. Next useful step is separately authorized source-backed identity repair preparation for exact 273 rows, then approved production repair/recompute. Yahoo needs explicit provider values, not a zero fallback. No runtime files or unrelated work changed.

## Follow-up: Yahoo endpoint and resume diagnosis

- Parent forwarded TJ's question: can another endpoint or resume-from-last-ID recover 1031 ownership values? Reopened read-only investigation; no writer execution or credential access.
- Fresh direct provider evidence: five diagnostic omissions (477.p.30000 Nesterenko, 30104 Kaiser, 30106 McDonough, 30107 Tverberg, 30108 Struble) plus valued control 477.p.30024 Nazar. Both production-style combined resource and dedicated `/percent_owned` return all six profiles. Missing five have `{coverage_type: week, week: 6, delta: "0"}` without value; Nazar has explicit 9. XML also has no value element for the five. Existing retained October 29 canonical JSON comparison showed the same distinction, so flattening/format is not the cause.
- Read-only production profile distribution: all 1610 active keys updated 08:40:02.554–08:40:43.713, including final key477.p.9603. Nulls and values appear in all five sorted key bands. This contradicts a stalled loop or lost tail. The loop requests65 batches of25 (last10), after complete key enumeration; audit records0 provider omissions,0 retries,0 deferred,0 errors. Resuming at the final ID would have no remaining work.
- `yahoo_players.percent_ownership` carries forward last known values on omission; its853 stored values are not853 current observations (only579 current receipts). Do not reuse old values as fresh.
- Public Yahoo Sports profile supplied no ownership field. Official API guide read succeeded but provides no missing-value-means-zero contract. No blanket zero normalization is supported. Next discriminating test is a small official authenticated Yahoo API comparison using approved account access; if it supplies explicit numbers, add a missing-keys-only fallback with valid-value receipts and no full replay. That source is not tested in this lane.
- External follow-up usage:5 public read-only Yahoo web/API requests, one bounded Supabase SELECT. Two initial Node DNS failures preceded successful standard curl transport; no authentication/rate denial occurred, and no TLS verification was disabled. Raw API evidence retained in `/tmp/yahoo-ownership-source-20261107/`. No runtime edits.

## Existing connection check: blocked as instructed

- Parent asked for an existing-plugin/session-only authenticated six-player comparison, stopping if new sign-in or credential access is needed.
- Plugin discovery returned no Yahoo Fantasy integration. Connected Chrome Yahoo Fantasy page showed Sign in rather than an established account session. No login was started.
- The repository authenticated API path requires stored OAuth secrets; no secret table/file was read, no credential used or refreshed, and no production write occurred. Reported precise blocker to parent. No browser research tab was retained.

- Additional code-only follow-up: existing OAuth routes cannot request global `percent_owned`; league `/ownership` is a different metric. Provider token manager may auto-refresh and mutate status, roster/discovery paths cache state, and global credential route refreshes/stores tokens. No route invoked. Reported exact minimal next step to parent: approved local six-key OAuth probe, refresh disabled, abort on expired token/401, no DB writes, public result fields only.

## Approved six-player OAuth comparison

- Parent supplied exact conversation authorization for six-player existing Yahoo authorization check. New scope: one official Yahoo read using existing stored authorization, no refresh or DB writes, stop on expired token. If effective, prepare bounded local fallback with tests; no coverage guarantee or deployment.
- Probe will load only the existing global access token in process, never output/export it, and issue one HTTPS GET to Yahoo's official six-key percent_owned resource. No refresh token/client secret will be read. Current source paths remain clean; repository concurrency boundaries retained.

- Approved OAuth result: one official Yahoo six-key GET returned401. Existing global access token read only in process, never output/exported; no client secret/refresh token read. Expiry timestamp absent, so exact401 cause unknown. Stopped without retry/refresh, zero DB writes. Safe receipt `tasks/artifacts/yahoo-ownership-source-2026-11-07/oauth-six-key-result.json`. No effective fallback demonstrated; parent informed, including caution not to claim proven expiry. Next step requires separate refresh/reauthorization permission before repeating only six-key sample.

## Approved refresh: failed callback, no persisted update

- Parent supplied user approval to refresh existing authorization and repeat the six-key check. Sent one POST to existing production manual-refresh route at20:04:40Z; client timed out after120seconds, so no blind retry was made.
- Read-only outcome check: credential metadata remains updated2026-08-13T05:08:50Z with no expiry, no new refresh audit. Vercel request268bn-1794081893157-e4390662866f reached the route20:04:53Z and produced unhandled YahooGlobalCredentialError: Yahoo refreshed credentials are invalid in the yahoo-fantasy refresh callback. This is evidence of failed persistence and a concrete unhandled-error/hanging route bug. Provider refresh response details are not available, so whether invalid grant or a valid access-only refresh caused it is not yet established.

- Parent explicitly prohibited retry until first provider outcome conclusively reconciled. Read-only metadata still unchanged; SDK code/logs cannot distinguish rejection from access-only refresh or prove provider rotation. Reported this uncertainty and stopped. No second refresh/sample. Notified Astra of concrete local hardening opportunity, no code change pending integration scope.

## Local refresh hardening authorized

- Root assigned a local-only fix and tests. No additional OAuth/production requests are allowed. Astra's goalie/FORGE/report candidate remains separate.
- Owned paths: manual refresh route; a narrow global-refresh helper and regression tests; existing global credential/source-boundary and cron-auth tests only where their expectations must reflect the new flow.
- Plan: replace the SDK's unhandled callback with one explicitly awaited, time-bounded refresh request, validate HTTP/JSON/tokens, preserve the existing refresh token only when the provider omits that field on success, await persistence, and return redacted failure/uncertain-outcome metadata. Never automatically retry a possibly rotating refresh. Keep authorization and credential ownership unchanged.


## Local hardening complete; independent handoff

- Five owned source/test files changed: manual refresh route, new refreshGlobalCredentials helper/test, globalCredentials.test, and cron-auth-boundaries.test. The credential store implementation, ownership pipeline, goalie/FORGE/report work, and concurrent unrelated files remain untouched.
- Verification passed: 54 targeted tests (22 helper, 10 credential owner, 22 route/auth); targeted ESLint; git diff --check; npm run typecheck using the repository's configured 8GB heap. Initial bare npx tsc --noEmit exhausted its default4GB heap; the corrected existing script completed successfully. No build, commit, deploy, new production/auth call, or repair.
- Standalone five-file patch and SHA256 verification receipt are under the Yahoo source artifact directory. Parent owns review/integration, separate from Astra's candidate.
- Reauthorization: account connect/callback is per-user storage, not the legacy global credential. There is no global reconnect UI/callback in the maintained code. Reauthorizing that global grant requires a separately approved operator flow using the same client and verified registered redirect. Do not promise that Refresh Yahoo Data or account reconnection repairs the global row. Previous refresh outcome remains unresolved and no retry is allowed.
- Next: parent review/integration decision; authenticated ownership sampling remains blocked. No fallback or 100% coverage claim is justified.
